import './styles.css';
import { SqlClient, TimeoutError, QUERY_TIMEOUT_MS } from './sql/client.js';
import { MAX_ROWS } from './sql/engine.js';
import { LEVELS, LEVEL_IDS, DEFAULT_LEVEL, getLevel, levelContent, hasLanguage } from './levels/index.js';
import { normalizeName } from './levels/observatory/solution.js';
import { Store, bytesToBase64, base64ToBytes } from './state/storage.js';
import { t, setLang, getLang, detectLang, applyStatic } from './i18n/i18n.js';
import { el, copyText, richText, renderBlocks } from './ui/dom.js';
import { renderSchema } from './ui/schema.js';
import { renderIdle, renderLoading, renderError, renderResult, describeResult, resultToText } from './ui/results.js';

const $ = (sel) => document.querySelector(sel);
const store = new Store({
  starterFor: (id, lang) => levelContent(getLevel(id), lang).startingQuery,
  defaultLang: detectLang(),
  levelIds: LEVEL_IDS,
  defaultLevel: DEFAULT_LEVEL,
});
setLang(store.state.lang);
let level = getLevel(store.state.level);
const client = new SqlClient({ lang: store.state.lang, level: level.id });
const content = () => levelContent(level, getLang());
const isLessons = () => level.kind === 'lessons';

const ui = {
  status: $('#engine-status'),
  engineError: $('#engine-error'),
  engineErrorText: $('#engine-error-text'),
  notice: $('#notice'),
  editor: $('#editor'),
  run: $('#run'),
  results: $('#results'),
  resultMeta: $('#result-meta'),
  pin: $('#pin-result'),
  notes: $('#notes'),
  notesStatus: $('#notes-status'),
  historyList: $('#history-list'),
  historyBadge: $('#history-badge'),
  hintList: $('#hint-list'),
  hintBadge: $('#hint-badge'),
  revealHint: $('#reveal-hint'),
  bonusBody: $('#bonus-body'),
  revealBonus: $('#reveal-bonus'),
  schema: $('#schema-list'),
  accuseForm: $('#accuse-form'),
  accuseInput: $('#accuse-input'),
  accuseFeedback: $('#accuse-feedback'),
  solvedBanner: $('#solved-banner'),
  ending: $('#ending'),
  confirmReset: $('#confirm-reset'),
  confirmResetDb: $('#confirm-reset-db'),
  levels: $('#levels'),
  levelList: $('#level-list'),
  langButtons: document.querySelectorAll('.lang-btn'),
  lesson: {
    view: $('#lesson-view'),
    caseView: $('#case-view'),
    card: $('#lesson-card'),
    number: $('#lesson-number'),
    title: $('#lesson-title'),
    body: $('#lesson-body'),
    task: $('#lesson-task'),
    status: $('#lesson-status'),
    showHint: $('#lesson-show-hint'),
    showAnswer: $('#lesson-show-answer'),
    markRead: $('#lesson-mark-read'),
    hint: $('#lesson-hint'),
    answer: $('#lesson-answer'),
    prev: $('#lesson-prev'),
    next: $('#lesson-next'),
    list: $('#lesson-list'),
    progressText: $('#lesson-progress-text'),
    progressBar: $('#lesson-progress-bar'),
    finale: $('#lesson-finale'),
    finaleTitle: $('#lesson-finale-title'),
    finaleBody: $('#lesson-finale-body'),
    finaleNext: $('#lesson-finale-next'),
    dbTools: $('#db-tools'),
    downloads: $('#downloads'),
    strip: $('#task-strip'),
    stripLabel: $('#task-strip-label'),
    stripTask: $('#task-strip-task'),
    banner: $('#check-banner'),
    bannerText: $('#check-banner-text'),
    bannerNext: $('#check-banner-next'),
  },
};

let engineReady = false;
let engineState = 'loading';
let running = false;
let lastResult = null;
let lastSchema = null;
let downloads = []; // { name, url } for files written with VACUUM INTO

/* ------------------------------------------------------------------ */
/* Views: tabs on mobile, sidebar + desk on desktop                    */
/* ------------------------------------------------------------------ */
const desktop = window.matchMedia('(min-width: 900px)');

function setView(view) {
  if (view === 'hints' && isLessons()) view = 'case';
  document.body.dataset.view = view;
  if (view !== 'query') document.body.dataset.side = view;
  syncTabs();
}

function syncTabs() {
  const { view, side } = document.body.dataset;
  for (const tab of document.querySelectorAll('.tab')) {
    const target = tab.dataset.target;
    const active = desktop.matches ? target === side : target === view;
    tab.setAttribute('aria-pressed', String(active));
  }
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setView(tab.dataset.target));
}
desktop.addEventListener('change', syncTabs);

/** Puts SQL in the editor and makes sure the editor is visible. */
function loadIntoEditor(sql) {
  ui.editor.value = sql;
  store.updateLevel({ draft: sql });
  if (!desktop.matches) setView('query');
  ui.editor.focus();
  ui.editor.setSelectionRange(sql.length, sql.length);
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */
const STATUS_KEYS = { loading: 'statusLoading', ready: 'statusReady', error: 'statusOffline' };

function setStatus(state) {
  engineState = state;
  ui.status.dataset.state = state;
  ui.status.textContent = t(STATUS_KEYS[state]);
}

function renderSchemaPanel() {
  if (!lastSchema) {
    ui.schema.replaceChildren(el('p', { class: 'muted', text: t(engineState === 'error' ? 'tablesUnavailable' : 'tablesLoading') }));
    return;
  }
  renderSchema(ui.schema, lastSchema, {
    notes: content().tableNotes,
    onInsert: loadIntoEditor,
    onCopy: async (sql, button) => {
      const ok = await copyText(sql);
      const label = button.firstChild;
      label.textContent = t(ok ? 'copied' : 'copyFailed');
      setTimeout(() => (label.textContent = t('copy')), 1400);
    },
  });
}

function savedSnapshot() {
  if (!level.writable || !store.lv.snapshot) return null;
  return base64ToBytes(store.lv.snapshot);
}

function saveSnapshot(bytes) {
  if (!level.writable || !bytes) return;
  store.updateLevel({ snapshot: bytesToBase64(bytes) });
}

let engineGeneration = 0;

async function startEngine() {
  const generation = ++engineGeneration;
  engineReady = false;
  ui.run.disabled = true;
  ui.engineError.hidden = true;
  setStatus('loading');
  try {
    const { schema, snapshotRejected } = await client.start({
      lang: getLang(),
      level: level.id,
      snapshot: savedSnapshot(),
    });
    if (generation !== engineGeneration) return false; // a newer restart took over
    engineReady = true;
    ui.engineError.hidden = true;
    ui.run.disabled = false;
    setStatus('ready');
    lastSchema = schema;
    renderSchemaPanel();
    if (snapshotRejected) {
      store.updateLevel({ snapshot: null });
      showNotice(t('snapshotRejected'));
    }
    return true;
  } catch (err) {
    if (generation !== engineGeneration) return false;
    setStatus('error');
    ui.engineErrorText.textContent = t('engineFailedHelp', err.message);
    ui.engineError.hidden = false;
    lastSchema = null;
    renderSchemaPanel();
    return false;
  }
}

/** What to show once a level's engine is ready. */
function afterStart() {
  // A first visit to a case runs its starting query so there is evidence on
  // screen immediately. Lessons wait for the player's own query. Returning
  // players get a prompt instead, so a slow saved draft never runs by surprise.
  if (!isLessons() && store.lv.history.length === 0) runQuery(ui.editor.value);
  else renderIdle(ui.results, { returning: store.lv.history.length > 0, lesson: isLessons() });
}

$('#engine-retry').addEventListener('click', async () => {
  if (await startEngine()) runQuery(ui.editor.value);
});

/* ------------------------------------------------------------------ */
/* Running queries                                                     */
/* ------------------------------------------------------------------ */
function selectedOrAll() {
  const { selectionStart: s, selectionEnd: e, value } = ui.editor;
  const selected = s !== e ? value.slice(s, e) : '';
  return selected.trim() ? selected : value;
}

// History stores language-neutral summary codes so it reads correctly after switching language.
function summaryCode(result) {
  if (!result.producedRows) return 'ran';
  return result.truncated ? 'rows+' : `rows:${result.rows.length}`;
}

function formatSummary(code, ok) {
  if (code === 'ran') return t('statementRan');
  if (code === 'rows+') return t('rowsSummaryMore', MAX_ROWS);
  if (code === 'error') return t('error');
  if (code === 'timeout') return t('timedOut');
  const m = /^rows:(\d+)$/.exec(code ?? '');
  if (m) return t('rowsSummary', Number(m[1]));
  return code || t(ok ? 'ok' : 'error'); // entries saved by older versions
}

function setRunButton(isRunning) {
  ui.run.textContent = t(isRunning ? 'running' : 'run');
}

async function runQuery(sql) {
  if (running || !engineReady) return;
  running = true;
  ui.run.disabled = true;
  setLevelControlsDisabled(true);
  setRunButton(true);
  ui.resultMeta.textContent = '';
  ui.pin.disabled = true;
  hideBanner();
  renderLoading(ui.results);

  const ranAt = new Date().toISOString();
  const lessonId = isLessons() ? currentLesson()?.id : null;
  const ranLevel = level;
  try {
    const result = await client.query(sql, { lessonId });
    if (ranLevel !== level) return;
    lastResult = result;
    renderResult(ui.results, result);
    let extra = result.statementCount > 1 ? t('multiStatement', result.statementCount) : '';
    if (result.changes > 0) extra += t('rowsChanged', result.changes);
    if (result.rolledBack) extra += t('rolledBackNote');
    ui.resultMeta.textContent = `${describeResult(result)} · ${result.elapsedMs} ms${extra}`;
    ui.pin.disabled = !result.producedRows;
    store.addHistory({ sql, ranAt, ok: true, summary: summaryCode(result) });
    if (result.snapshot) saveSnapshot(result.snapshot);
    if (result.schema) {
      lastSchema = result.schema;
      renderSchemaPanel();
    }
    if (result.backupFiles?.length) addDownloads(result.backupFiles);
    if (result.check) handleCheck(result.check);
  } catch (err) {
    if (ranLevel !== level) return;
    lastResult = null;
    if (err.snapshot) {
      // Statements before the failing one still took effect.
      saveSnapshot(err.snapshot);
      if (err.schema) {
        lastSchema = err.schema;
        renderSchemaPanel();
      }
    }
    if (err instanceof TimeoutError) {
      renderError(ui.results, { title: t('errTimeoutTitle'), message: t('errTimeout', err.seconds) });
      store.addHistory({ sql, ranAt, ok: false, summary: 'timeout' });
    } else if (!engineReady) {
      renderError(ui.results, { title: t('errUnavailableTitle'), message: err.message });
    } else {
      renderError(ui.results, { title: t('errQueryTitle'), message: err.message, detail: err.detail });
      store.addHistory({ sql, ranAt, ok: false, summary: 'error' });
    }
  } finally {
    running = false;
    ui.run.disabled = !engineReady;
    setLevelControlsDisabled(false);
    setRunButton(false);
    renderHistory();
    showStoreWarning();
  }
}

ui.run.addEventListener('click', () => runQuery(selectedOrAll()));
ui.editor.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runQuery(selectedOrAll());
  }
});

let draftTimer = null;
ui.editor.addEventListener('input', () => {
  clearTimeout(draftTimer);
  const forLevel = level.id;
  draftTimer = setTimeout(() => store.updateLevel({ draft: ui.editor.value }, forLevel), 250);
});

$('#load-starter').addEventListener('click', () => loadIntoEditor(content().startingQuery));

ui.pin.addEventListener('click', () => {
  if (!lastResult) return;
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const block = `\n--- ${stamp} · ${describeResult(lastResult)} ---\n${resultToText(lastResult)}\n`;
  ui.notes.value = (ui.notes.value.trimEnd() + '\n' + block).trimStart();
  store.updateLevel({ notes: ui.notes.value });
  ui.pin.textContent = t('pinned');
  setTimeout(() => (ui.pin.textContent = t('pin')), 1400);
});

/* ------------------------------------------------------------------ */
/* Lessons (Academy, Tampered Evidence)                                */
/* ------------------------------------------------------------------ */
const lessons = () => content().lessons ?? [];

function currentLesson() {
  const list = lessons();
  if (!list.length) return null;
  const saved = list.find((l) => l.id === store.lv.lesson);
  if (saved) return saved;
  const done = new Set(store.lv.lessonsDone);
  return list.find((l) => !done.has(l.id)) ?? list[0];
}

function isDone(id) {
  return store.lv.lessonsDone.includes(id);
}

function setLesson(id, { focus = false } = {}) {
  store.updateLevel({ lesson: id });
  hideBanner();
  renderLessons();
  if (focus) {
    if (!desktop.matches) setView('case');
    ui.lesson.title.focus();
    ui.lesson.card.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

function nextLessonAfter(id) {
  const list = lessons();
  const i = list.findIndex((l) => l.id === id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

function completeLesson(id) {
  if (isDone(id)) return false;
  store.updateLevel({ lessonsDone: [...store.lv.lessonsDone, id] });
  return true;
}

function renderLessons() {
  const L = ui.lesson;
  const c = content();
  const list = lessons();
  const lesson = currentLesson();
  const done = list.filter((l) => isDone(l.id)).length;

  L.view.hidden = !isLessons();
  L.caseView.hidden = isLessons();
  L.strip.hidden = !isLessons();
  $('#panel-case').setAttribute('aria-labelledby', isLessons() ? 'lesson-level-title' : 'case-heading');
  if (!isLessons() || !lesson) return;

  $('#lesson-stamp').textContent = c.stamp;
  $('#lesson-level-title').textContent = c.title;
  $('#lesson-intro').replaceChildren(...richText(c.intro));
  L.progressText.textContent = t('levelProgress', done, list.length);
  L.progressBar.style.width = `${Math.round((done / list.length) * 100)}%`;
  $('#lesson-badge').textContent = `${done}/${list.length}`;

  const allDone = done === list.length;
  L.finale.hidden = !allDone;
  if (allDone) {
    L.finaleTitle.textContent = `${c.finale.title}.`;
    L.finaleBody.textContent = c.finale.body;
    const next = LEVELS.find((l) => l.number === level.number + 1);
    L.finaleNext.hidden = !next;
    if (next) {
      L.finaleNext.textContent = t('finaleNext', levelContent(next, getLang()).title);
      L.finaleNext.onclick = () => switchLevel(next.id);
    }
  }

  const index = list.indexOf(lesson);
  L.number.textContent = t('lessonOf', index + 1, list.length);
  L.title.textContent = lesson.title;
  L.body.replaceChildren(...renderBlocks(lesson.body, { onLoad: loadIntoEditor, loadLabel: t('loadIntoEditor'), noteLabel: t('onServer') }));
  L.task.replaceChildren(...richText(lesson.task));
  L.card.classList.toggle('is-done', isDone(lesson.id));
  L.status.textContent = isDone(lesson.id) ? `✓ ${t('lessonDoneBadge')}` : '';

  const reading = lesson.check?.type === 'read';
  L.showHint.hidden = !lesson.hint;
  L.showAnswer.hidden = !lesson.answer;
  L.markRead.hidden = !reading || isDone(lesson.id);
  L.hint.hidden = true;
  L.hint.replaceChildren(...richText(lesson.hint ?? ''));
  L.answer.hidden = true;
  L.answer.replaceChildren(
    ...(lesson.answer
      ? [
          el('pre', { class: 'hint-sql' }, el('code', { text: lesson.answer })),
          el('button', { type: 'button', class: 'btn btn-small btn-secondary', onclick: () => loadIntoEditor(lesson.answer) }, t('loadIntoEditor')),
        ]
      : [])
  );
  L.prev.disabled = index === 0;
  L.next.hidden = index === list.length - 1;

  L.stripLabel.textContent = t('lessonOf', index + 1, list.length);
  L.stripTask.replaceChildren(...richText(lesson.task));

  L.list.replaceChildren(
    ...list.map((l, i) =>
      el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: `lesson-link${isDone(l.id) ? ' is-done' : ''}`,
            'aria-current': l.id === lesson.id ? 'step' : false,
            onclick: () => setLesson(l.id, { focus: true }),
          },
          el('span', { class: 'lesson-link-num', text: String(i + 1) }),
          el('span', { class: 'lesson-link-title', text: l.title }),
          isDone(l.id) ? el('span', { class: 'lesson-link-done', text: '✓', 'aria-label': t('lessonDoneBadge') }) : null
        )
      )
    )
  );

  L.dbTools.hidden = !level.writable;
  renderDownloads();
}

ui.lesson.showHint.addEventListener('click', () => (ui.lesson.hint.hidden = false));
ui.lesson.showAnswer.addEventListener('click', () => (ui.lesson.answer.hidden = false));
ui.lesson.prev.addEventListener('click', () => {
  const list = lessons();
  const i = list.indexOf(currentLesson());
  if (i > 0) setLesson(list[i - 1].id, { focus: true });
});
ui.lesson.next.addEventListener('click', () => {
  const next = nextLessonAfter(currentLesson()?.id);
  if (next) setLesson(next.id, { focus: true });
});
ui.lesson.markRead.addEventListener('click', () => {
  const lesson = currentLesson();
  if (!lesson) return;
  completeLesson(lesson.id);
  renderLessons();
});
$('#task-strip-open').addEventListener('click', () => setLesson(currentLesson()?.id, { focus: true }));
ui.lesson.bannerNext.addEventListener('click', () => {
  const next = nextLessonAfter(currentLesson()?.id);
  if (next) setLesson(next.id, { focus: true });
});

function checkReason(check) {
  const d = check.detail ?? {};
  switch (check.reason) {
    case 'noResult':
      return t('checkNoResult');
    case 'rowCount':
      return t('checkRowCount', d.expected, d.got);
    case 'columnCount':
      return t('checkColumnCount', d.expected, d.got);
    case 'values':
      // Only name the column when it is a plain name, not an expression.
      return t('checkValues', /^[A-Za-z_]\w*$/.test(d.column ?? '') ? d.column : null);
    case 'order':
      return t('checkOrder');
    case 'columnName':
      return t('checkColumnName', d.name);
    case 'value':
      return check.message ?? t('checkValue');
    case 'noFile':
      return t('checkNoFile');
    default:
      return check.message ?? t('checkCustom');
  }
}

function handleCheck(check) {
  const lesson = currentLesson();
  if (!lesson || check.lessonId !== lesson.id) return;
  // A statement with no result set (an UPDATE, a CREATE…) is usually the
  // player exploring or preparing, so it gets no "not yet" for row checks.
  if (!check.passed && check.reason === 'noResult') return;
  const B = ui.lesson;
  B.banner.hidden = false;
  if (check.passed) {
    const fresh = completeLesson(lesson.id);
    const next = nextLessonAfter(lesson.id);
    B.banner.className = 'check-banner is-pass';
    B.bannerText.textContent = t(fresh ? 'lessonPassed' : 'lessonPassedAgain');
    B.bannerNext.hidden = !next;
    renderLessons();
    ui.lesson.status.textContent = `✓ ${t('lessonPassed')}`;
  } else {
    B.banner.className = 'check-banner is-fail';
    B.bannerText.textContent = `${t('notYet')} ${checkReason(check)}`;
    B.bannerNext.hidden = true;
  }
}

function hideBanner() {
  ui.lesson.banner.hidden = true;
}

/* ---------- writable level: downloads and reset ---------- */
function addDownloads(files) {
  for (const file of files) {
    const url = URL.createObjectURL(new Blob([file.bytes], { type: 'application/vnd.sqlite3' }));
    const existing = downloads.find((d) => d.name === file.name);
    if (existing) {
      URL.revokeObjectURL(existing.url);
      existing.url = url;
    } else {
      downloads.push({ name: file.name, url });
    }
  }
  renderDownloads();
}

function clearDownloads() {
  for (const d of downloads) URL.revokeObjectURL(d.url);
  downloads = [];
}

function renderDownloads() {
  ui.lesson.downloads.replaceChildren(
    ...downloads.map((d) =>
      el('li', {}, el('a', { class: 'btn btn-small btn-secondary', href: d.url, download: d.name.split('/').pop() }, t('downloadFile', d.name)))
    )
  );
}

$('#reset-db').addEventListener('click', () => {
  ui.confirmResetDb.returnValue = '';
  ui.confirmResetDb.showModal();
});
ui.confirmResetDb.addEventListener('close', async () => {
  if (ui.confirmResetDb.returnValue !== 'confirm' || running || !engineReady) return;
  try {
    const { schema } = await client.resetDb();
    store.updateLevel({ snapshot: null });
    lastSchema = schema;
    renderSchemaPanel();
    hideBanner();
    renderIdle(ui.results, { lesson: true });
    ui.resultMeta.textContent = '';
    showNotice(t('resetDbDone'));
  } catch (err) {
    showNotice(err.message);
  }
});

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */
function renderHistory() {
  const { history } = store.lv;
  ui.historyBadge.textContent = history.length ? String(history.length) : '';
  if (!history.length) {
    ui.historyList.replaceChildren(el('li', { class: 'muted', text: t('noQueries') }));
    return;
  }
  ui.historyList.replaceChildren(
    ...history.map((h) => {
      const time = new Date(h.ranAt);
      const label = Number.isNaN(time.getTime()) ? '' : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return el(
        'li',
        { class: 'history-item' },
        el(
          'div',
          { class: 'history-meta' },
          el('span', { class: `badge ${h.ok ? 'badge-ok' : 'badge-err'}`, text: formatSummary(h.summary, h.ok) }),
          el('span', { class: 'muted small', text: label })
        ),
        el('pre', { class: 'history-sql' }, el('code', { text: h.sql.trim() })),
        el(
          'div',
          { class: 'history-actions' },
          el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => loadIntoEditor(h.sql) }, t('loadIntoEditor')),
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn-small btn-secondary',
              onclick: () => {
                loadIntoEditor(h.sql);
                runQuery(h.sql);
              },
            },
            t('runAgain')
          )
        )
      );
    })
  );
}

$('#clear-history').addEventListener('click', () => {
  store.updateLevel({ history: [] });
  renderHistory();
});

/* ------------------------------------------------------------------ */
/* Notebook                                                            */
/* ------------------------------------------------------------------ */
let notesTimer = null;
ui.notes.addEventListener('input', () => {
  ui.notesStatus.textContent = t('saving');
  clearTimeout(notesTimer);
  const forLevel = level.id;
  notesTimer = setTimeout(() => {
    store.updateLevel({ notes: ui.notes.value }, forLevel);
    ui.notesStatus.textContent = t(store.storage ? 'saved' : 'notSaved');
  }, 300);
});

/* ------------------------------------------------------------------ */
/* Hints (case levels)                                                 */
/* ------------------------------------------------------------------ */
function renderHints() {
  $('#tab-hints').hidden = isLessons();
  if (isLessons()) {
    ui.hintBadge.textContent = '';
    return;
  }
  const { hints, bonusLead, bonusButton } = content();
  const n = Math.min(store.lv.hintsRevealed, hints.length);
  ui.hintList.replaceChildren(
    ...hints.slice(0, n).map((hint, i) =>
      el(
        'li',
        { class: 'hint' },
        el('h3', { text: `${i + 1}. ${hint.title}` }),
        el('p', { text: hint.body }),
        hint.sql ? el('pre', { class: 'hint-sql' }, el('code', { text: hint.sql })) : null,
        hint.sql
          ? el('button', { type: 'button', class: 'btn btn-small btn-secondary', onclick: () => loadIntoEditor(hint.sql) }, t('loadIntoEditor'))
          : null
      )
    )
  );
  ui.hintBadge.textContent = n ? `${n}/${hints.length}` : '';
  ui.revealHint.hidden = n >= hints.length;
  ui.revealHint.textContent = t('revealHint', n + 1, hints.length);
  ui.revealBonus.textContent = bonusButton;
  ui.revealBonus.hidden = store.lv.bonusRevealed;
  ui.bonusBody.hidden = !store.lv.bonusRevealed;
  ui.bonusBody.replaceChildren(el('h3', { text: bonusLead.title }), el('p', { text: bonusLead.body }));
}

ui.revealHint.addEventListener('click', () => {
  store.updateLevel({ hintsRevealed: Math.min(store.lv.hintsRevealed + 1, content().hints.length) });
  renderHints();
  const heading = ui.hintList.lastElementChild?.querySelector('h3');
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
});
ui.revealBonus.addEventListener('click', () => {
  store.updateLevel({ bonusRevealed: true });
  renderHints();
});

/* ------------------------------------------------------------------ */
/* Accusation and ending (case levels)                                 */
/* ------------------------------------------------------------------ */
function renderSolved() {
  const solved = !isLessons() && store.lv.solved;
  ui.solvedBanner.hidden = !solved;
  document.body.classList.toggle('is-solved', solved);
}

function fillEnding() {
  const ending = level.ending(getLang());
  $('#ending-title').textContent = ending.headline;
  $('#ending-motive').textContent = ending.motive;
  $('#ending-chain').replaceChildren(
    ...ending.chain.map(([label, text]) => el('li', {}, el('strong', { text: `${label}. ` }), text))
  );
}

function openEnding() {
  fillEnding();
  if (!ui.ending.open) ui.ending.showModal();
}

ui.accuseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isLessons()) return;
  const raw = ui.accuseInput.value;
  const name = normalizeName(raw);
  const judging = level;
  ui.accuseFeedback.className = 'accuse-feedback';
  if (!name) {
    ui.accuseFeedback.textContent = level.judge('', false, getLang()).message;
    return;
  }
  let exists = true;
  try {
    exists = Boolean(await client.findPerson(name));
  } catch {
    exists = true; // engine hiccup: fall back to the generic message
  }
  if (judging !== level) return;
  const outcome = level.judge(raw, exists, getLang());
  ui.accuseFeedback.textContent = outcome.message;
  ui.accuseFeedback.classList.add(`is-${outcome.verdict}`);
  store.updateLevel({ guesses: [...store.lv.guesses, name].slice(-20) });
  if (outcome.verdict === 'correct') {
    store.updateLevel({ solved: true });
    renderSolved();
    openEnding();
  }
});

$('#reopen-ending').addEventListener('click', openEnding);
$('#goto-accuse').addEventListener('click', () => {
  setView('case');
  ui.accuseInput.focus();
  ui.accuseForm.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
});
for (const dialog of [ui.ending, ui.levels]) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */
function levelStatus(l) {
  const saved = store.state.levels[l.id];
  if (l.kind === 'lessons') {
    const total = levelContent(l, getLang()).lessons.length;
    const done = saved ? saved.lessonsDone.filter((id) => levelContent(l, getLang()).lessons.some((x) => x.id === id)).length : 0;
    if (!saved || (done === 0 && !saved.history.length)) return { text: t('levelNotStarted'), started: false, done: false };
    return { text: t('levelProgress', done, total), started: true, done: done === total };
  }
  if (saved?.solved) return { text: t('levelSolved'), started: true, done: true };
  if (saved?.history.length) return { text: t('levelInProgress'), started: true, done: false };
  return { text: t('levelNotStarted'), started: false, done: false };
}

function renderLevelList() {
  ui.levelList.replaceChildren(
    ...LEVELS.map((l) => {
      const c = levelContent(l, getLang());
      const status = levelStatus(l);
      const current = l.id === level.id;
      return el(
        'li',
        { class: `level-card${current ? ' is-current' : ''}${status.done ? ' is-done' : ''}` },
        el(
          'div',
          { class: 'level-card-head' },
          el('span', { class: 'level-num', text: t('levelNumber', l.number) }),
          el('span', { class: `level-chip level-chip-${l.number}`, text: c.difficulty }),
          el('span', { class: 'level-status muted small', text: `${status.done ? '✓ ' : ''}${status.text}` })
        ),
        el('h3', { text: c.title }),
        el('p', { class: 'level-summary', text: c.summary }),
        getLang() !== 'en' && !hasLanguage(l, getLang()) ? el('p', { class: 'muted small', text: t('levelEnglishOnly') }) : null,
        el(
          'ul',
          { class: 'skill-list', 'aria-label': t('levelSkills') },
          c.skills.map((s) => el('li', {}, el('code', { text: s })))
        ),
        el(
          'button',
          {
            type: 'button',
            class: `btn ${current ? 'btn-ghost' : 'btn-primary'}`,
            onclick: () => {
              ui.levels.close();
              switchLevel(l.id);
            },
          },
          t(current ? 'levelCurrent' : status.started ? 'levelContinue' : 'levelPlay'),
          el('span', { class: 'sr-only', text: `: ${c.title}` })
        )
      );
    })
  );
}

function openLevels() {
  renderLevelList();
  if (!ui.levels.open) ui.levels.showModal();
}

$('#open-levels').addEventListener('click', openLevels);

async function switchLevel(id) {
  if (running || id === level.id) return;
  store.update({ level: id });
  level = getLevel(id);
  clearDownloads();
  clearWorkspace();
  hydrate();
  setView('case');
  showNotice(englishOnlyNotice());
  if (await startEngine()) afterStart();
}

function englishOnlyNotice() {
  return getLang() !== 'en' && !hasLanguage(level, getLang()) ? t('levelEnglishOnly') : '';
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */
$('#open-reset').addEventListener('click', () => {
  // returnValue survives between openings; clear it so Esc can never re-confirm.
  ui.confirmReset.returnValue = '';
  ui.confirmReset.showModal();
});
ui.confirmReset.addEventListener('close', async () => {
  if (ui.confirmReset.returnValue !== 'confirm') return;
  store.resetLevel();
  client.snapshot = null;
  clearDownloads();
  clearWorkspace();
  hydrate();
  setView('case');
  showNotice(t('resetDone'));
  // A new worker guarantees a pristine copy of the evidence.
  if (await startEngine()) afterStart();
});

function clearWorkspace() {
  lastResult = null;
  ui.accuseInput.value = '';
  ui.accuseFeedback.textContent = '';
  ui.accuseFeedback.className = 'accuse-feedback';
  ui.resultMeta.textContent = '';
  ui.pin.disabled = true;
  hideBanner();
  renderIdle(ui.results, { lesson: isLessons() });
}

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */
function setLevelControlsDisabled(disabled) {
  for (const b of ui.langButtons) b.disabled = disabled;
  $('#open-levels').disabled = disabled;
}

function syncLangButtons() {
  for (const b of ui.langButtons) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
}

/** Re-renders every piece of text in the current language. */
function renderAllText() {
  const c = content();
  applyStatic();
  document.title = `${c.title} · ${t('levelNumber', level.number)}`;
  $('#level-eyebrow').textContent = c.eyebrow;
  $('#level-title').textContent = c.title;
  $('#tab-case-label').textContent = t(isLessons() ? 'tabLessons' : 'tabCase');
  $('#goto-accuse').hidden = isLessons();
  if (!isLessons()) $('#lesson-badge').textContent = '';
  ui.notes.placeholder = c.notesPlaceholder ?? '';
  syncLangButtons();
  setStatus(engineState);
  setRunButton(running);
  ui.pin.textContent = t('pin');
  ui.editor.title = t('editorTimeoutTip', QUERY_TIMEOUT_MS / 1000);
  renderBriefing();
  renderLessons();
  renderHints();
  renderHistory();
  renderSolved();
  renderSchemaPanel();
  if (ui.ending.open && !isLessons()) fillEnding();
  if (ui.levels.open) renderLevelList();
}

async function switchLanguage(lang) {
  if (lang === getLang() || running) return;
  const oldStarter = content().startingQuery.trim();
  const wasStarter = ui.editor.value.trim() === oldStarter;

  setLang(lang);
  store.update({ lang });
  if (wasStarter) {
    ui.editor.value = content().startingQuery;
    store.updateLevel({ draft: ui.editor.value });
  }
  clearWorkspace();
  renderAllText();
  // Only the Observatory's evidence is translated; other levels keep English data.
  const translated = Boolean(level.database.overlays);
  showNotice(englishOnlyNotice() || t(translated ? 'langSwitched' : 'langSwitchedPlain'));

  if (await startEngine()) {
    if (wasStarter && !isLessons()) runQuery(ui.editor.value);
    else renderIdle(ui.results, { returning: true, lesson: isLessons() });
  }
}

for (const b of ui.langButtons) b.addEventListener('click', () => switchLanguage(b.dataset.lang));

/* ------------------------------------------------------------------ */
/* Briefing and boot                                                   */
/* ------------------------------------------------------------------ */
function renderBriefing() {
  if (isLessons()) return;
  const c = content();
  const { briefing } = c;
  $('#case-stamp').textContent = c.stamp;
  $('#case-premise').textContent = briefing.premise;
  $('#case-objective').textContent = briefing.objective;
  $('#case-facts').replaceChildren(...briefing.facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
  $('#case-conventions').replaceChildren(...briefing.conventions.map((x) => el('li', { text: x })));
  $('#accuse-heading').textContent = c.accuseHeading;
  $('#accuse-help').replaceChildren(...richText(c.accuseHelp));
  $('#solved-text').textContent = c.solvedText;
}

function showNotice(text) {
  ui.notice.textContent = text;
  ui.notice.hidden = !text;
}

function showStoreWarning() {
  if (store.warning) showNotice(t(store.warning));
}

function hydrate() {
  ui.editor.value = store.lv.draft;
  ui.notes.value = store.lv.notes;
  ui.notesStatus.textContent = '';
  renderAllText();
}

hydrate();
renderIdle(ui.results, { lesson: isLessons() });
showStoreWarning();
if (!store.warning) showNotice(englishOnlyNotice());
setView('case');
if (store.isNew) openLevels();

startEngine().then((ok) => {
  if (ok) afterStart();
});
