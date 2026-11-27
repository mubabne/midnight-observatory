// Runs SQLite off the main thread so a slow query never freezes the page.
// The main thread can terminate this worker at any time (see client.js).
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import seedSql from '../case/seed.sql?raw';
import mnOverlay from '../case/i18n/mn.sql?raw';
import { buildCanonicalBytes, runQuery, describeSchema, findPersonByName } from './engine.js';

// Translation overlays run after the seed. English needs none.
const OVERLAYS = { en: [], mn: [mnOverlay] };

let SQL = null;
let lang = 'en';
let canonical = null; // Uint8Array snapshot of the untouched evidence

async function init(requestedLang) {
  lang = OVERLAYS[requestedLang] ? requestedLang : 'en';
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl });
  canonical = buildCanonicalBytes(SQL, seedSql, OVERLAYS[lang]);
}

const handlers = {
  init: async ({ lang: requested }) => {
    await init(requested);
    return { schema: describeSchema(SQL, canonical), lang };
  },
  query: async ({ sql }) => runQuery(SQL, canonical, sql, { lang }),
  findPerson: async ({ name }) => findPersonByName(SQL, canonical, name),
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    const handler = handlers[type];
    if (!handler) throw new Error(`Unknown request: ${type}`);
    if (type !== 'init' && !canonical) throw new Error('The evidence has not loaded yet.');
    const result = await handler(payload ?? {});
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: { message: String(err?.message ?? err), detail: err?.detail ?? null },
    });
  }
};
