import { el } from './dom.js';
import { t } from '../i18n/i18n.js';
import { MAX_ROWS } from '../sql/engine.js';

const LONG_TEXT = 60;

export function renderIdle(container, { returning = false, lesson = false } = {}) {
  container.removeAttribute('aria-busy');
  const key = returning ? 'idleReturning' : lesson ? 'idleLesson' : 'idle';
  container.replaceChildren(el('p', { class: 'empty-state', text: t(key) }));
}

export function renderLoading(container) {
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(
    el('p', { class: 'loading-state' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('runningQuery'))
  );
}

export function renderError(container, { title, message, detail }) {
  container.removeAttribute('aria-busy');
  const box = el(
    'div',
    { class: 'error-box', role: 'alert' },
    el('p', { class: 'error-title', text: title }),
    el('p', { text: message })
  );
  if (detail && detail !== message) {
    box.append(el('details', {}, el('summary', { text: t('sqliteSaid') }), el('code', { text: detail })));
  }
  container.replaceChildren(box);
}

/** Renders a real result set. Values are only ever set as text. */
export function renderResult(container, result) {
  container.removeAttribute('aria-busy');
  const { columns, rows, truncated, producedRows } = result;

  if (!producedRows) {
    container.replaceChildren(el('p', { class: 'empty-state', text: t('noColumns') }));
    return;
  }
  if (rows.length === 0) {
    container.replaceChildren(
      el(
        'div',
        { class: 'empty-state' },
        el('p', { class: 'empty-title', text: t('noRowsTitle') }),
        el('p', { text: t('noRowsHelp') }),
        el('div', { class: 'col-list' }, t('columnsLabel'), ...columns.map((c) => el('code', { text: c })))
      )
    );
    return;
  }

  const longCols = columns.map((_, i) => rows.some((r) => typeof r[i] === 'string' && r[i].length > LONG_TEXT));

  const table = el(
    'table',
    { class: 'result-table' },
    el('caption', { class: 'sr-only', text: t('tableCaption', rows.length, columns.length) }),
    el('thead', {}, el('tr', {}, columns.map((c) => el('th', { scope: 'col', text: c }))))
  );
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    row.forEach((value, i) => {
      const td = el('td');
      if (value === null) {
        td.append(el('span', { class: 'null', text: 'NULL' }));
      } else if (value instanceof Uint8Array) {
        td.textContent = `<blob ${value.length} bytes>`;
      } else {
        td.textContent = String(value);
        if (typeof value === 'number') td.className = 'num';
      }
      if (longCols[i]) td.classList.add('long');
      tr.append(td);
    });
    tbody.append(tr);
  }
  table.append(tbody);

  const nodes = [];
  if (truncated) nodes.push(el('p', { class: 'truncated', role: 'note', text: t('truncated', MAX_ROWS) }));
  nodes.push(el('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': t('tableRegion') }, table));
  container.replaceChildren(...nodes);
}

export function describeResult(result) {
  if (!result.producedRows) return t('statementRan');
  return result.truncated ? t('rowsSummaryMore', MAX_ROWS) : t('rowsSummary', result.rows.length);
}

/** Plain-text snapshot for the notebook (first few rows only). */
export function resultToText(result, limit = 8) {
  if (!result?.producedRows) return '';
  const lines = [result.columns.join(' | ')];
  for (const row of result.rows.slice(0, limit)) {
    lines.push(row.map((v) => (v === null ? 'NULL' : String(v))).join(' | '));
  }
  if (result.rows.length > limit) lines.push(`… +${result.rows.length - limit}`);
  return lines.join('\n');
}
