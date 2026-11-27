// Runs SQLite off the main thread so a slow query never freezes the page.
// The main thread can terminate this worker at any time (see client.js).
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { getLevel } from '../levels/index.js';
import { LevelSession } from './session.js';

// Every level's SQL files, bundled as text. Keys are paths under src/levels/.
const FILES = import.meta.glob('../levels/**/*.sql', { query: '?raw', import: 'default', eager: true });
const read = (path) => {
  const text = FILES[`../levels/${path}`];
  if (text === undefined) throw new Error(`Missing level file: ${path}`);
  return text;
};

let SQL = null;
let session = null;

const errorPayload = (err) => ({
  message: String(err?.message ?? err),
  detail: err?.detail ?? null,
  snapshot: err?.snapshot ?? null,
  schema: err?.schema ?? null,
  rolledBack: err?.rolledBack ?? false,
});

const handlers = {
  init: async ({ lang, level: levelId, snapshot }) => {
    SQL ??= await initSqlJs({ locateFile: () => wasmUrl });
    const level = getLevel(levelId);
    // Error messages follow the language; levels without a translation overlay keep English data.
    session = new LevelSession(SQL, level, lang === 'mn' ? 'mn' : 'en', read, snapshot ?? null);
    return {
      schema: session.schema(),
      level: level.id,
      writable: session.writable,
      snapshotRejected: Boolean(session.snapshotRejected),
    };
  },
  query: async ({ sql, lessonId }) => session.run(sql, lessonId ?? null),
  findPerson: async ({ name }) => session.findPerson(name),
  resetDb: async () => {
    session.reset();
    return { schema: session.schema() };
  },
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    const handler = handlers[type];
    if (!handler) throw new Error(`Unknown request: ${type}`);
    if (type !== 'init' && !session) throw new Error('The evidence has not loaded yet.');
    const result = await handler(payload ?? {});
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: errorPayload(err) });
  }
};
