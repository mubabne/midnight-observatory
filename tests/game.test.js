// Game behaviour that doesn't need a browser: accusations, spoiler hygiene,
// saved-progress handling and the worker timeout/restart logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeName, judgeAccusation, getEnding } from '../src/case/solution.js';
import { CASES, getCase } from '../src/case/case.js';
import { Store, STORAGE_KEY, defaultState, WARN } from '../src/state/storage.js';
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

test('the culprit is never named in player-facing case content', () => {
  const text = JSON.stringify(CASES);
  assert.ok(!/corin|ashdown|корин|эшдаун/i.test(text), 'case.js mentions the culprit');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/corin|ashdown/i.test(html), 'index.html mentions the culprit');
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

/* ---------------- storage ---------------- */

class MemoryStorage {
  constructor(initial = {}) { this.data = { ...initial }; }
  getItem(k) { return k in this.data ? this.data[k] : null; }
  setItem(k, v) { this.data[k] = String(v); }
  removeItem(k) { delete this.data[k]; }
}

test('progress round-trips through storage, including the language', () => {
  const mem = new MemoryStorage();
  const a = new Store('SELECT 1;', mem);
  a.update({ notes: 'custodian saw 23:51', hintsRevealed: 2, solved: true, draft: 'SELECT 2;', lang: 'mn' });
  a.addHistory({ sql: 'SELECT 3;', ranAt: '2026-10-17T00:00:00Z', ok: true, summary: 'rows:1' });
  const b = new Store('SELECT 1;', mem);
  assert.equal(b.state.notes, 'custodian saw 23:51');
  assert.equal(b.state.hintsRevealed, 2);
  assert.equal(b.state.solved, true);
  assert.equal(b.state.draft, 'SELECT 2;');
  assert.equal(b.state.lang, 'mn');
  assert.equal(b.state.history[0].sql, 'SELECT 3;');
  assert.equal(b.warning, null);
});

test('a fresh game uses the starting query of the default language', () => {
  const starter = (lang) => getCase(lang).startingQuery;
  const s = new Store(starter, new MemoryStorage(), 'mn');
  assert.equal(s.state.lang, 'mn');
  assert.equal(s.state.draft, getCase('mn').startingQuery);
});

test('corrupt saved data falls back to a fresh game with a warning', () => {
  const mem = new MemoryStorage({ [STORAGE_KEY]: '{not json' });
  const s = new Store('SELECT 1;', mem);
  assert.deepEqual(s.state, defaultState('SELECT 1;'));
  assert.equal(s.warning, WARN.damaged);
});

test('wrongly-typed fields are ignored individually', () => {
  const mem = new MemoryStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 1, notes: 42, hintsRevealed: 'lots', history: [{ sql: 1 }, { sql: 'ok', ranAt: 'x' }], solved: 'yes', lang: 'klingon' }),
  });
  const s = new Store('SELECT 1;', mem);
  assert.equal(s.state.notes, '');
  assert.equal(s.state.hintsRevealed, 0);
  assert.equal(s.state.solved, false);
  assert.equal(s.state.lang, 'en');
  assert.equal(s.state.history.length, 1);
});

test('blocked storage still lets the game run in memory', () => {
  const s = new Store('SELECT 1;', null);
  s.update({ notes: 'x' });
  assert.equal(s.state.notes, 'x');
  assert.equal(s.warning, WARN.blocked);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const t = new Store('SELECT 1;', throwing);
  t.update({ notes: 'y' });
  assert.equal(t.state.notes, 'y');
  assert.ok(t.warning);
});

test('reset restores the starting state but keeps the chosen language', () => {
  const starter = (lang) => getCase(lang).startingQuery;
  const mem = new MemoryStorage();
  const s = new Store(starter, mem);
  s.update({ notes: 'n', hintsRevealed: 3, solved: true, draft: 'x', lang: 'mn' });
  s.reset();
  assert.deepEqual(s.state, defaultState(getCase('mn').startingQuery, 'mn'));
  assert.deepEqual(new Store(starter, mem).state, defaultState(getCase('mn').startingQuery, 'mn'));
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
