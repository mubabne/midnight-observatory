// The query engine: read-only protection, CTEs, row caps and error messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQL, bytes, col } from './helpers.js';
import { runQuery, MAX_ROWS } from '../src/sql/engine.js';

const run = (sql) => runQuery(SQL, bytes, sql);

test('writes are rejected with a clear explanation', () => {
  for (const sql of [
    'DELETE FROM people',
    "UPDATE people SET name = 'x'",
    "INSERT INTO people VALUES (1, 'a', 'b', 'c')",
    'DROP TABLE people',
    'CREATE TABLE t (x)',
  ]) {
    assert.throws(() => run(sql), /read-only/, sql);
  }
});

test('the evidence is unchanged even if a query switches query_only off', () => {
  const r = run('PRAGMA query_only = OFF; DELETE FROM interviews; SELECT COUNT(*) AS n FROM interviews;');
  assert.equal(r.rows[0][0], 0, 'the disposable copy was changed');
  assert.equal(col('SELECT COUNT(*) FROM interviews')[0], 18, 'the canonical evidence must not change');
});

test('WITH queries, comments and lower-case SQL all work', () => {
  const r = run(`-- leading comment
    /* block comment */
    with west as (select * from access_logs where location = 'West Dome')
    select count(*) from west;`);
  assert.equal(r.rows[0][0], col("SELECT COUNT(*) FROM access_logs WHERE location = 'West Dome'")[0]);
});

test('large results are capped and labelled as truncated', () => {
  const r = run('SELECT * FROM access_logs, people');
  assert.equal(r.rows.length, MAX_ROWS);
  assert.equal(r.truncated, true);
  const small = run('SELECT * FROM people');
  assert.equal(small.truncated, false);
});

test('zero-row queries return columns and an empty row list', () => {
  const r = run("SELECT * FROM people WHERE name = 'Nobody'");
  assert.deepEqual(r.rows, []);
  assert.deepEqual(r.columns, ['id', 'name', 'occupation', 'department']);
  assert.equal(r.producedRows, true);
});

test('the last result set is shown when several statements run', () => {
  const r = run('SELECT 1 AS a; SELECT 2 AS b;');
  assert.deepEqual(r.columns, ['b']);
  assert.equal(r.statementCount, 2);
});

test('SQL errors become readable messages but keep the raw text', () => {
  const cases = [
    ['SELEC * FROM people', /confused near "SELEC"/],
    ['SELECT * FROM suspects', /no table called "suspects"/],
    ['SELECT nme FROM people', /no column called "nme"/],
    ['SELECT id FROM people JOIN interviews ON people.id = interviews.person_id', /more than one joined table/],
    ['SELECT * FROM people WHERE (name = 1', /ends too early/],
    ["SELECT * FROM people WHERE name = 'oops", /unclosed quote/],
    ['', /Type a query first/],
    ['-- only a comment', /only contained comments/],
  ];
  for (const [sql, pattern] of cases) {
    assert.throws(() => run(sql), (err) => pattern.test(err.message), sql);
  }
  try {
    run('SELEC 1');
  } catch (err) {
    assert.match(err.detail, /syntax error/);
  }
});
