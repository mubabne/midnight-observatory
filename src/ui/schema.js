import { el } from './dom.js';
import { t } from '../i18n/i18n.js';

/** Builds the table reference from the live database schema. */
export function renderSchema(container, schema, { notes = {}, onInsert, onCopy }) {
  container.removeAttribute('aria-busy');
  const cards = schema.map((table) => {
    const example = `SELECT *\nFROM ${table.name}\nLIMIT 10;`;
    const cols = el(
      'ul',
      { class: 'col-table', 'aria-label': t('columnsIn', table.name) },
      table.columns.map((c) =>
        el(
          'li',
          {},
          el('code', { class: 'col-name', text: c.name }),
          el('span', { class: 'col-type', text: c.type.toLowerCase() }),
          c.primaryKey ? el('span', { class: 'key-pk', title: t('primaryKey'), text: 'PK' }) : null,
          c.references
            ? el(
                'span',
                { class: 'key-fk', title: t('joinsTo', `${c.references.table}.${c.references.column}`) },
                `→ ${c.references.table}.${c.references.column}`
              )
            : null
        )
      )
    );
    return el(
      'details',
      { class: 'schema-card', open: true },
      el(
        'summary',
        {},
        el('code', { class: 'table-name', text: table.name }),
        el('span', { class: 'muted small', text: t('rowsCount', table.rowCount) })
      ),
      el('p', { class: 'muted small', text: notes[table.name] ?? '' }),
      cols,
      el(
        'div',
        { class: 'schema-actions' },
        el(
          'button',
          { type: 'button', class: 'btn btn-small btn-secondary', onclick: () => onInsert(example) },
          el('span', { text: t('insertSelect') }),
          el('span', { class: 'sr-only', text: t('insertSelectFor', table.name) })
        ),
        el(
          'button',
          { type: 'button', class: 'btn btn-small btn-ghost', onclick: (e) => onCopy(example, e.currentTarget) },
          el('span', { text: t('copy') }),
          el('span', { class: 'sr-only', text: t('copySelectFor', table.name) })
        )
      )
    );
  });
  container.replaceChildren(...cards);
}
