import './styles.css';
import { SqlClient, TimeoutError, QUERY_TIMEOUT_MS } from './sql/client.js';
import { MAX_ROWS } from './sql/engine.js';
import { getCase } from './case/case.js';
import { judgeAccusation, normalizeName, getEnding } from './case/solution.js';
import { Store } from './state/storage.js';
import { t, setLang, getLang, detectLang, applyStatic } from './i18n/i18n.js';
import { el, copyText } from './ui/dom.js';
import { renderSchema } from './ui/schema.js';
import { renderIdle, renderLoading, renderError, renderResult, describeResult, resultToText } from './ui/results.js';

const $ = (sel) => document.querySelector(sel);
const store = new Store((lang) => getCase(lang).startingQuery, undefined, detectLang());
setLang(store.state.lang);
const client = new SqlClient({ lang: store.state.lang });
const caseText = () => getCase(getLang());

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
  langButtons: document.querySelectorAll('.lang-btn'),
};

let engineReady = false;
let engineState = 'loading';
let running = false;
let lastResult = null;
let lastSchema = null;

/* ------------------------------------------------------------------ */
/* Views: tabs on mobile, sidebar + desk on desktop                    */
/* ------------------------------------------------------------------ */
const desktop = window.matchMedia('(min-width: 900px)');

function setView(view) {
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
  store.update({ draft: sql });
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
    notes: caseText().tableNotes,
    onInsert: loadIntoEditor,
    onCopy: async (sql, button) => {
      const ok = await copyText(sql);
      const label = button.firstChild;
      label.textContent = t(ok ? 'copied' : 'copyFailed');
      setTimeout(() => (label.textContent = t('copy')), 1400);
    },
  });
}

let engineGeneration = 0;

async function startEngine() {
  const generation = ++engineGeneration;
  engineReady = false;
  ui.run.disabled = true;
  ui.engineError.hidden = true;
  setStatus('loading');
  try {
    const { schema } = await client.start(getLang());
    if (generation !== engineGeneration) return false; // a newer restart took over
    engineReady = true;
    ui.engineError.hidden = true;
    ui.run.disabled = false;
    setStatus('ready');
    lastSchema = schema;
    renderSchemaPanel();
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
  setLangButtonsDisabled(true);
  setRunButton(true);
  ui.resultMeta.textContent = '';
  ui.pin.disabled = true;
  renderLoading(ui.results);

  const ranAt = new Date().toISOString();
  try {
    const result = await client.query(sql);
    lastResult = result;
    renderResult(ui.results, result);
    const extra = result.statementCount > 1 ? t('multiStatement', result.statementCount) : '';
    ui.resultMeta.textContent = `${describeResult(result)} · ${result.elapsedMs} ms${extra}`;
    ui.pin.disabled = !result.producedRows;
    store.addHistory({ sql, ranAt, ok: true, summary: summaryCode(result) });
  } catch (err) {
    lastResult = null;
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
    setLangButtonsDisabled(false);
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
  draftTimer = setTimeout(() => store.update({ draft: ui.editor.value }), 250);
});

$('#load-starter').addEventListener('click', () => loadIntoEditor(caseText().startingQuery));

ui.pin.addEventListener('click', () => {
  if (!lastResult) return;
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const block = `\n--- ${stamp} · ${describeResult(lastResult)} ---\n${resultToText(lastResult)}\n`;
  ui.notes.value = (ui.notes.value.trimEnd() + '\n' + block).trimStart();
  store.update({ notes: ui.notes.value });
  ui.pin.textContent = t('pinned');
  setTimeout(() => (ui.pin.textContent = t('pin')), 1400);
});

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */
function renderHistory() {
  const { history } = store.state;
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
  store.update({ history: [] });
  renderHistory();
});

/* ------------------------------------------------------------------ */
/* Notebook                                                            */
/* ------------------------------------------------------------------ */
let notesTimer = null;
ui.notes.addEventListener('input', () => {
  ui.notesStatus.textContent = t('saving');
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    store.update({ notes: ui.notes.value });
    ui.notesStatus.textContent = t(store.storage ? 'saved' : 'notSaved');
  }, 300);
});

/* ------------------------------------------------------------------ */
/* Hints                                                               */
/* ------------------------------------------------------------------ */
function renderHints() {
  const { hints, bonusLead } = caseText();
  const n = Math.min(store.state.hintsRevealed, hints.length);
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
  ui.revealBonus.hidden = store.state.bonusRevealed;
  ui.bonusBody.hidden = !store.state.bonusRevealed;
  ui.bonusBody.replaceChildren(el('h3', { text: bonusLead.title }), el('p', { text: bonusLead.body }));
}

ui.revealHint.addEventListener('click', () => {
  store.update({ hintsRevealed: Math.min(store.state.hintsRevealed + 1, caseText().hints.length) });
  renderHints();
  const heading = ui.hintList.lastElementChild?.querySelector('h3');
  heading?.setAttribute('tabindex', '-1');
  heading?.focus();
});
ui.revealBonus.addEventListener('click', () => {
  store.update({ bonusRevealed: true });
  renderHints();
});

/* ------------------------------------------------------------------ */
/* Accusation and ending                                               */
/* ------------------------------------------------------------------ */
function renderSolved() {
  ui.solvedBanner.hidden = !store.state.solved;
  document.body.classList.toggle('is-solved', store.state.solved);
}

function fillEnding() {
  const ending = getEnding(getLang());
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
  const raw = ui.accuseInput.value;
  const name = normalizeName(raw);
  ui.accuseFeedback.className = 'accuse-feedback';
  if (!name) {
    ui.accuseFeedback.textContent = judgeAccusation('', false, getLang()).message;
    return;
  }
  let exists = true;
  try {
    exists = Boolean(await client.findPerson(name));
  } catch {
    exists = true; // engine hiccup: fall back to the generic message
  }
  const outcome = judgeAccusation(raw, exists, getLang());
  ui.accuseFeedback.textContent = outcome.message;
  ui.accuseFeedback.classList.add(`is-${outcome.verdict}`);
  store.update({ guesses: [...store.state.guesses, name].slice(-20) });
  if (outcome.verdict === 'correct') {
    store.update({ solved: true });
    renderSolved();
    openEnding();
  }
});

$('#reopen-ending').addEventListener('click', openEnding);
$('#goto-accuse').addEventListener('click', () => {
  setView('case');
  ui.accuseInput.focus();
  ui.accuseForm.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
});
ui.ending.addEventListener('click', (e) => {
  if (e.target === ui.ending || e.target.closest('[data-close]')) ui.ending.close();
});

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
  store.reset();
  clearWorkspace();
  hydrate();
  setView('case');
  showNotice(t('resetDone'));
  // A new worker guarantees a pristine copy of the evidence.
  if (await startEngine()) runQuery(ui.editor.value);
});

function clearWorkspace() {
  lastResult = null;
  ui.accuseInput.value = '';
  ui.accuseFeedback.textContent = '';
  ui.accuseFeedback.className = 'accuse-feedback';
  ui.resultMeta.textContent = '';
  ui.pin.disabled = true;
  renderIdle(ui.results);
}

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */
function setLangButtonsDisabled(disabled) {
  for (const b of ui.langButtons) b.disabled = disabled;
}

function syncLangButtons() {
  for (const b of ui.langButtons) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
}

/** Re-renders every piece of text in the current language. */
function renderAllText() {
  applyStatic();
  syncLangButtons();
  setStatus(engineState);
  setRunButton(running);
  ui.pin.textContent = t('pin');
  ui.editor.title = t('editorTimeoutTip', QUERY_TIMEOUT_MS / 1000);
  renderBriefing();
  renderHints();
  renderHistory();
  renderSolved();
  renderSchemaPanel();
  if (ui.ending.open) fillEnding();
}

async function switchLanguage(lang) {
  if (lang === getLang() || running) return;
  const oldStarter = caseText().startingQuery.trim();
  const wasStarter = ui.editor.value.trim() === oldStarter;

  setLang(lang);
  store.update({ lang });
  if (wasStarter) {
    ui.editor.value = caseText().startingQuery;
    store.update({ draft: ui.editor.value });
  }
  clearWorkspace();
  renderAllText();
  showNotice(t('langSwitched'));

  // The evidence itself is translated, so load it again in the new language.
  if (await startEngine()) {
    if (wasStarter) runQuery(ui.editor.value);
    else renderIdle(ui.results, { returning: true });
  }
}

for (const b of ui.langButtons) b.addEventListener('click', () => switchLanguage(b.dataset.lang));

/* ------------------------------------------------------------------ */
/* Briefing and boot                                                   */
/* ------------------------------------------------------------------ */
function renderBriefing() {
  const { briefing } = caseText();
  $('#case-premise').textContent = briefing.premise;
  $('#case-objective').textContent = briefing.objective;
  $('#case-facts').replaceChildren(...briefing.facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
  $('#case-conventions').replaceChildren(...briefing.conventions.map((c) => el('li', { text: c })));
}

function showNotice(text) {
  ui.notice.textContent = text;
  ui.notice.hidden = !text;
}

function showStoreWarning() {
  if (store.warning) showNotice(t(store.warning));
}

function hydrate() {
  ui.editor.value = store.state.draft;
  ui.notes.value = store.state.notes;
  ui.notesStatus.textContent = '';
  renderAllText();
}

hydrate();
renderIdle(ui.results);
showStoreWarning();
setView('case');

startEngine().then((ok) => {
  // A first visit runs the starting query so there is evidence on screen immediately.
  // Returning players get a prompt instead, so a slow saved draft never runs by surprise.
  if (!ok) return;
  if (store.state.history.length === 0) runQuery(ui.editor.value);
  else renderIdle(ui.results, { returning: true });
});
