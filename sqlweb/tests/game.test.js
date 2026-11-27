// Game behaviour that doesn't need a browser: accusations, spoiler hygiene,
// saved-progress handling and the worker timeout/restart logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeName, judgeAccusation, getEnding } from '../src/levels/observatory/solution.js';
import { CASES, getCase } from '../src/levels/observatory/case.js';
import { LEVELS, LEVEL_IDS, getLevel, levelContent } from '../src/levels/index.js';
import { Store, STORAGE_KEY, defaultState, defaultLevelState, WARN, bytesToBase64, base64ToBytes } from '../src/state/storage.js';
import { SqlClient, TimeoutError } from '../src/sql/client.js';
import { SQL, bytes } from './helpers.js';
import { findPersonByName } from '../src/sql/engine.js';

const exists = (name) => Boolean(findPersonByName(SQL, bytes, normalizeName(name)));

test('accepts the culprit with different capitalisation, spacing and titles', () => {
  for (const guess of ['Corin Ashdown', '  corin ashdown ', 'CORIN   ASHDOWN', 'Dr. Corin Ashdown', 'dr corin ashdown']) {
    assert.equal(judgeAccusation(guess, exists(guess)).verdict, 'correct', guess);
  }
});

test('wrong answers keep the case open', () => {
  assert.equal(judgeAccusation('Felix Ward', exists('Felix Ward')).verdict, 'wrong');
  assert.equal(judgeAccusation('Lena Sato', exists('Lena Sato')).verdict, 'wrong');
  assert.equal(judgeAccusation('Kwame Asante', exists('Kwame Asante')).verdict, 'wrong');
  assert.equal(judgeAccusation('Corin', exists('Corin')).verdict, 'unknown');
  assert.equal(judgeAccusation('Sherlock Holmes', exists('Sherlock Holmes')).verdict, 'unknown');
  assert.equal(judgeAccusation('   ', false).verdict, 'empty');
});

test('the person lookup is parameterised, not string-built', () => {
  assert.equal(findPersonByName(SQL, bytes, "x' OR '1'='1"), null);
});

test('the ending explains culprit and motive', () => {
  const ending = getEnding('en');
  assert.equal(ending.culprit, 'Corin Ashdown');
  assert.match(ending.motive, /misconduct/);
  assert.ok(ending.chain.length >= 5);
});

test('hints get more specific: idea first, near-solution query last', () => {
  for (const lang of Object.keys(CASES)) {
    const { hints } = getCase(lang);
    assert.ok(hints.length >= 3 && hints.length <= 4, lang);
    assert.equal(hints[0].sql, undefined, `${lang}: first hint is an idea, not a query`);
    assert.match(hints.at(-1).sql, /JOIN/);
  }
});

test('no level names its culprit in player-facing text', () => {
  const culprits = { observatory: /corin|ashdown|корин|эшдаун/i, coldcase: /margo|ellery/i, tampered: /gideon|marsh/i, academy: /rory|calloway/i };
  for (const [id, pattern] of Object.entries(culprits)) {
    const level = getLevel(id);
    const text = JSON.stringify(
      Object.values(level.content).map((c) => {
        // Lesson answers and checks are only shown on request, so they may name the answer.
        const { lessons, ...rest } = c;
        return [rest, (lessons ?? []).map(({ title, body, task, hint }) => ({ title, body, task, hint }))];
      })
    );
    assert.ok(!pattern.test(text), `${id} level text names the culprit`);
  }
  assert.ok(!/corin|ashdown|корин|эшдаун/i.test(JSON.stringify(CASES)), 'case.js mentions the culprit');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/corin|ashdown|margo|ellery|gideon/i.test(html), 'index.html mentions a culprit');
});

/* ---------------- storage ---------------- */

class MemoryStorage {
  constructor(initial = {}) { this.data = { ...initial }; }
  getItem(k) { return k in this.data ? this.data[k] : null; }
  setItem(k, v) { this.data[k] = String(v); }
  removeItem(k) { delete this.data[k]; }
}

const starterFor = (id, lang) => levelContent(getLevel(id), lang).startingQuery;
const makeStore = (storage, extra = {}) => new Store({ starterFor, storage, levelIds: LEVEL_IDS, defaultLevel: 'academy', ...extra });

test('progress round-trips per level, including the language and current level', () => {
  const mem = new MemoryStorage();
  const a = makeStore(mem);
  assert.equal(a.isNew, true);
  a.update({ level: 'observatory', lang: 'mn' });
  a.updateLevel({ notes: 'custodian saw 23:51', hintsRevealed: 2, solved: true, draft: 'SELECT 2;' });
  a.addHistory({ sql: 'SELECT 3;', ranAt: '2026-10-17T00:00:00Z', ok: true, summary: 'rows:1' });
  a.updateLevel({ lessonsDone: ['select-star', 'columns'], lesson: 'where-text' }, 'academy');
  const b = makeStore(mem);
  assert.equal(b.isNew, false);
  assert.equal(b.state.level, 'observatory');
  assert.equal(b.state.lang, 'mn');
  assert.equal(b.lv.notes, 'custodian saw 23:51');
  assert.equal(b.lv.hintsRevealed, 2);
  assert.equal(b.lv.solved, true);
  assert.equal(b.lv.draft, 'SELECT 2;');
  assert.equal(b.lv.history[0].sql, 'SELECT 3;');
  assert.deepEqual(b.levelState('academy').lessonsDone, ['select-star', 'columns']);
  assert.equal(b.levelState('academy').lesson, 'where-text');
  assert.equal(b.levelState('coldcase').solved, false, 'unplayed levels start fresh');
  assert.equal(b.warning, null);
});

test('a version 1 save becomes the Observatory progress', () => {
  const v1 = { version: 1, lang: 'mn', draft: 'SELECT 9;', history: [{ sql: 'SELECT 1;', ranAt: 'x', ok: true, summary: 'rows:1' }], notes: 'old notes', hintsRevealed: 3, bonusRevealed: true, solved: true, guesses: ['felix ward'] };
  const s = makeStore(new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(v1) }));
  assert.equal(s.state.version, 2);
  assert.equal(s.state.level, 'observatory');
  assert.equal(s.state.lang, 'mn');
  assert.equal(s.lv.notes, 'old notes');
  assert.equal(s.lv.solved, true);
  assert.equal(s.lv.hintsRevealed, 3);
  assert.deepEqual(s.lv.guesses, ['felix ward']);
  assert.equal(s.isNew, false);
});

test('a fresh level uses its own starting query in the current language', () => {
  const s = makeStore(new MemoryStorage(), { defaultLang: 'mn' });
  assert.equal(s.state.lang, 'mn');
  assert.equal(s.state.level, 'academy');
  assert.equal(s.levelState('observatory').draft, getCase('mn').startingQuery);
  assert.equal(s.levelState('academy').draft, levelContent(getLevel('academy'), 'en').startingQuery);
});

test('corrupt saved data falls back to a fresh game with a warning', () => {
  const mem = new MemoryStorage({ [STORAGE_KEY]: '{not json' });
  const s = makeStore(mem);
  assert.deepEqual(s.state, defaultState({ lang: 'en', level: 'academy' }));
  assert.equal(s.warning, WARN.damaged);
});

test('wrongly-typed fields are ignored individually', () => {
  const mem = new MemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 2,
      lang: 'klingon',
      level: 'nowhere',
      levels: {
        observatory: { notes: 42, hintsRevealed: 'lots', history: [{ sql: 1 }, { sql: 'ok', ranAt: 'x' }], solved: 'yes' },
        tampered: { lessonsDone: ['a', 7, 'a', 'b'], snapshot: '<script>' },
        bogus: { notes: 'ignored' },
      },
    }),
  });
  const s = makeStore(mem);
  assert.equal(s.state.lang, 'en');
  assert.equal(s.state.level, 'academy');
  const obs = s.levelState('observatory');
  assert.equal(obs.notes, '');
  assert.equal(obs.hintsRevealed, 0);
  assert.equal(obs.solved, false);
  assert.equal(obs.history.length, 1);
  assert.deepEqual(s.levelState('tampered').lessonsDone, ['a', 'b']);
  assert.equal(s.levelState('tampered').snapshot, null);
  assert.equal(s.state.levels.bogus, undefined);
});

test('blocked storage still lets the game run in memory', () => {
  const s = makeStore(null);
  s.updateLevel({ notes: 'x' });
  assert.equal(s.lv.notes, 'x');
  assert.equal(s.warning, WARN.blocked);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const t = makeStore(throwing);
  t.updateLevel({ notes: 'y' });
  assert.equal(t.lv.notes, 'y');
  assert.ok(t.warning);
});

test('resetting a level clears only that level and keeps the language', () => {
  const mem = new MemoryStorage();
  const s = makeStore(mem);
  s.update({ lang: 'mn', level: 'observatory' });
  s.updateLevel({ notes: 'n', hintsRevealed: 3, solved: true, draft: 'x' });
  s.updateLevel({ lessonsDone: ['select-star'] }, 'academy');
  s.resetLevel();
  assert.deepEqual(s.lv, defaultLevelState(getCase('mn').startingQuery));
  const again = makeStore(mem);
  assert.equal(again.state.lang, 'mn');
  assert.deepEqual(again.levelState('observatory'), defaultLevelState(getCase('mn').startingQuery));
  assert.deepEqual(again.levelState('academy').lessonsDone, ['select-star']);
});

test('database snapshots survive the base64 round trip', () => {
  const sample = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
  assert.deepEqual(base64ToBytes(bytesToBase64(sample)), sample);
  assert.equal(base64ToBytes('%%%'), null);
});

/* ---------------- worker timeout and restarts ---------------- */

test('restarting while the engine is still loading leaves the new engine running', async () => {
  const created = [];
  class SlowWorker {
    constructor() { this.terminated = false; created.push(this); }
    postMessage({ id, type }) {
      setTimeout(() => {
        if (!this.terminated) this.onmessage?.({ data: { id, ok: true, result: type === 'init' ? { schema: [] } : { rows: [[2]] } } });
      }, 20);
    }
    terminate() { this.terminated = true; }
  }
  const original = globalThis.Worker;
  globalThis.Worker = SlowWorker;
  try {
    const client = new SqlClient({ timeoutMs: 500 });
    const first = client.start();
    const second = client.start(); // e.g. the player hits "Start over" during loading
    await assert.rejects(first);
    await second;
    assert.equal(created[1].terminated, false, 'the newer worker must survive');
    assert.deepEqual(await client.query('SELECT 2'), { rows: [[2]] });
  } finally {
    globalThis.Worker = original;
  }
});

test('a query that never finishes times out, the worker is replaced in the same language, and the next query works', async () => {
  const created = [];
  const inits = [];
  class FakeWorker {
    constructor() { this.terminated = false; created.push(this); }
    postMessage({ id, type, payload }) {
      if (type === 'init') inits.push(payload.lang);
      // init answers at once; a query containing "forever" never answers.
      if (type === 'query' && payload.sql.includes('forever')) return;
      queueMicrotask(() => this.onmessage?.({ data: { id, ok: true, result: type === 'init' ? { schema: [] } : { rows: [[1]] } } }));
    }
    terminate() { this.terminated = true; }
  }
  const original = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  try {
    const client = new SqlClient({ timeoutMs: 50 });
    await client.start('mn');
    const err = await client.query('SELECT forever').catch((e) => e);
    assert.ok(err instanceof TimeoutError);
    assert.equal(err.seconds, 0);
    assert.equal(created[0].terminated, true, 'the stuck worker is terminated');
    assert.equal(created.length, 2, 'a fresh worker is started');
    assert.deepEqual(await client.query('SELECT 1'), { rows: [[1]] });
    assert.deepEqual(inits, ['mn', 'mn'], 'the restart keeps the language');
  } finally {
    globalThis.Worker = original;
  }
});
