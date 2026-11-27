// The level ladder: every level builds, every lesson's model answer passes
// its own check, common mistakes fail with a helpful reason, and each
// case's clue chain leads to exactly one person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SQL, readLevelFile, levelsDir, asObjects } from './helpers.js';
import { LEVELS, getLevel, levelContent } from '../src/levels/index.js';
import { levelFiles } from '../src/levels/database.js';
import { LevelSession } from '../src/sql/session.js';
import { compareResults } from '../src/sql/checks.js';
import { normalizeName } from '../src/levels/observatory/solution.js';

const session = (id, snapshot = null) => new LevelSession(SQL, getLevel(id), 'en', readLevelFile, snapshot);
const lessonsOf = (id) => levelContent(getLevel(id), 'en').lessons;
const check = (s, lessonId, sql) => s.run(sql, lessonId).check;

/* ---------------- the ladder ---------------- */

test('four levels, numbered 1 to 4, each with complete player-facing text', () => {
  assert.deepEqual(LEVELS.map((l) => l.number), [1, 2, 3, 4]);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 4);
  for (const level of LEVELS) {
    const c = levelContent(level, 'en');
    for (const key of ['title', 'difficulty', 'eyebrow', 'stamp', 'summary', 'startingQuery']) {
      assert.ok(typeof c[key] === 'string' && c[key].length, `${level.id}.${key}`);
    }
    assert.ok(c.skills.length >= 4, `${level.id} skills`);
    assert.ok(['lessons', 'case'].includes(level.kind));
    if (level.kind === 'case') {
      for (const key of ['accuseHeading', 'accuseHelp', 'solvedText', 'bonusButton']) assert.ok(c[key], `${level.id}.${key}`);
      assert.ok(c.hints.length >= 3 && c.briefing.facts.length && c.bonusLead.body);
      assert.equal(typeof level.judge, 'function');
      assert.ok(level.ending('en').chain.length >= 5);
    } else {
      assert.ok(c.lessons.length >= 8 && c.intro && c.finale.body);
    }
  }
});

test('every SQL file a level needs exists (the worker bundles these)', () => {
  for (const level of LEVELS) {
    for (const file of levelFiles(level)) assert.ok(fs.existsSync(path.join(levelsDir, file)), file);
  }
});

test('lesson ids are unique and every task can be completed', () => {
  for (const level of LEVELS.filter((l) => l.kind === 'lessons')) {
    const lessons = lessonsOf(level.id);
    assert.equal(new Set(lessons.map((l) => l.id)).size, lessons.length, level.id);
    for (const l of lessons) {
      assert.ok(l.title && l.body.length && l.task && l.check, `${level.id}/${l.id}`);
      if (l.check.type !== 'read') assert.ok(l.answer && l.hint, `${level.id}/${l.id} needs a hint and an answer`);
    }
  }
});

test('every Academy answer passes its own check', () => {
  const s = session('academy');
  for (const l of lessonsOf('academy')) {
    const c = check(s, l.id, l.answer);
    assert.equal(c.passed, true, `${l.id}: ${JSON.stringify(c)}`);
  }
});

/* ---------------- grading ---------------- */

test('extra columns and any column order are fine unless the task says otherwise', () => {
  const s = session('academy');
  assert.equal(check(s, 'where-text', "SELECT * FROM suspects WHERE neighborhood = 'Riverside'").passed, true);
  assert.equal(check(s, 'where-text', "SELECT age, name FROM suspects WHERE neighborhood = 'Riverside'").passed, true);
  const tooMany = check(s, 'columns', 'SELECT name, occupation, age FROM suspects');
  assert.deepEqual([tooMany.passed, tooMany.reason], [false, 'columnCount']);
});

test('common beginner mistakes fail with a reason the player can act on', () => {
  const s = session('academy');
  const cases = [
    ['where-text', "SELECT name FROM suspects WHERE neighborhood = 'riverside'", 'rowCount'],
    ['where-numbers', 'SELECT name, height_cm FROM suspects WHERE height_cm >= 185', 'rowCount'],
    ['or', "SELECT name FROM suspects WHERE neighborhood = 'Northside' OR neighborhood = 'Old Town' AND age < 30", 'rowCount'],
    ['null', 'SELECT name FROM suspects WHERE alibi = NULL', 'rowCount'],
    ['order-by', 'SELECT name, age FROM suspects ORDER BY age', 'order'],
    ['limit', 'SELECT name FROM suspects ORDER BY height_cm LIMIT 3', 'values'],
    ['count', 'SELECT COUNT(*) FROM suspects WHERE alibi IS NULL', 'columnName'],
    ['final', "SELECT name FROM suspects WHERE hair = 'red' AND vehicle LIKE '%green%'", 'value'],
  ];
  for (const [lesson, sql, reason] of cases) {
    const c = check(s, lesson, sql);
    assert.equal(c.passed, false, `${lesson} should fail: ${sql}`);
    assert.equal(c.reason, reason, `${lesson}: ${JSON.stringify(c)}`);
  }
  const typo = check(s, 'final', "SELECT name FROM suspects WHERE hair = 'red'");
  assert.ok(typo.message, 'custom message for the final exam');
});

test('compareResults matches columns by content, not name or position', () => {
  const exp = { columns: ['name', 'age'], rows: [['A', 1], ['B', 2]] };
  const ok = (actual, opts) => compareResults(exp, { producedRows: true, ...actual }, opts);
  assert.equal(ok({ columns: ['age', 'name'], rows: [[2, 'B'], [1, 'A']] }).passed, true);
  assert.equal(ok({ columns: ['x', 'name', 'age'], rows: [[0, 'A', 1], [0, 'B', 2]] }).passed, true);
  assert.equal(ok({ columns: ['name', 'age'], rows: [['B', 2], ['A', 1]] }, { ordered: true }).reason, 'order');
  // Same values per column but paired wrongly: not the same rows.
  assert.equal(ok({ columns: ['name', 'age'], rows: [['A', 2], ['B', 1]] }).passed, false);
  assert.equal(ok({ columns: ['name'], rows: [['A'], ['B']] }).reason, 'values');
  assert.equal(compareResults(exp, { producedRows: false }).reason, 'noResult');
  // 1 and 1.0 are the same number.
  assert.equal(compareResults({ columns: ['n'], rows: [[1]] }, { producedRows: true, columns: ['n'], rows: [[1.0]] }).passed, true);
});

/* ---------------- Level 1 data ---------------- */

test('Academy data: no ties when sorting, and each final-exam clue alone leaves several people', () => {
  const s = session('academy');
  const one = (sql) => s.run(sql).rows[0][0];
  assert.equal(one('SELECT COUNT(DISTINCT age) FROM suspects'), one('SELECT COUNT(*) FROM suspects'));
  assert.equal(one('SELECT COUNT(DISTINCT height_cm) FROM suspects'), one('SELECT COUNT(*) FROM suspects'));
  const clues = ['height_cm > 180', "hair = 'red'", "vehicle LIKE '%green%'", 'alibi IS NULL'];
  for (const clue of clues) assert.ok(one(`SELECT COUNT(*) FROM suspects WHERE ${clue}`) >= 4, clue);
  for (let i = 0; i < clues.length; i++) {
    const three = clues.filter((_, j) => j !== i).join(' AND ');
    assert.ok(one(`SELECT COUNT(*) FROM suspects WHERE ${three}`) >= 2, `without "${clues[i]}" more than one person fits`);
  }
  assert.equal(one(`SELECT COUNT(*) FROM suspects WHERE ${clues.join(' AND ')}`), 1);
});

test('Academy is read-only', () => {
  assert.throws(() => session('academy').run('DELETE FROM suspects'), /read-only/);
});

/* ---------------- Level 3: the cold case ---------------- */

const cold = session('coldcase');
const coldRows = (sql) => asObjects(cold.run(sql, null, { maxRows: 10_000 }));
const coldHints = levelContent(getLevel('coldcase'), 'en').hints;

test('cold case: the starting query shows five thallium cases among other illnesses', () => {
  const rows = coldRows(levelContent(getLevel('coldcase'), 'en').startingQuery);
  assert.equal(rows.filter((r) => r.diagnosis === 'thallium poisoning').length, 5);
  assert.ok(rows.length > 5);
});

test('cold case: every hint query runs and narrows the field', () => {
  const [patients, stall, shifts, drinks] = coldHints.map((h) => coldRows(h.sql));
  assert.equal(patients.length, 5);
  assert.deepEqual(stall, [{ name: 'Ember & Oak Tea Bar', patients_served: 5 }]);
  const onShift = shifts.filter((r) => r.poisoned_orders_on_shift === 5).map((r) => r.name).sort();
  assert.deepEqual(onShift, ['Dov Pereira', 'Margo Ellery'], 'two people were working for all five');
  assert.deepEqual(drinks, [{ name: 'Margo Ellery', drinks_made: 5 }]);
});

test('cold case: the 48-hour window matters, or a second stall looks guilty', () => {
  const noWindow = coldRows(`
    WITH patients AS (SELECT customer_id FROM illness_reports WHERE diagnosis = 'thallium poisoning')
    SELECT s.name FROM patients p JOIN orders o ON o.customer_id = p.customer_id JOIN stalls s ON s.id = o.stall_id
    GROUP BY s.id HAVING COUNT(DISTINCT o.customer_id) = 5`);
  assert.deepEqual(noWindow.map((r) => r.name).sort(), ['Copperline Coffee', 'Ember & Oak Tea Bar']);
});

test('cold case: every patient left a 1-star review of the stall before being poisoned (the motive)', () => {
  const rows = coldRows(`
    SELECT COUNT(*) AS n FROM illness_reports i
    JOIN reviews r ON r.customer_id = i.customer_id AND r.stall_id = 3 AND r.rating = 1
    WHERE i.diagnosis = 'thallium poisoning' AND r.posted_at < i.onset_at`);
  assert.equal(rows[0].n, 5);
});

test('cold case bonus: the LEFT JOIN anti-join finds the two people still at risk, and the WHERE trap finds none', () => {
  const right = coldRows(`
    SELECT c.name FROM reviews r
    JOIN customers c ON c.id = r.customer_id
    LEFT JOIN illness_reports i ON i.customer_id = r.customer_id AND i.diagnosis = 'thallium poisoning'
    WHERE r.stall_id = 3 AND r.rating = 1 AND i.id IS NULL ORDER BY c.name`);
  assert.deepEqual(right.map((r) => r.name), ['Beatrix Coyle', 'Hugo Varela']);
  const trap = coldRows(`
    SELECT c.name FROM reviews r
    JOIN customers c ON c.id = r.customer_id
    LEFT JOIN illness_reports i ON i.customer_id = r.customer_id
    WHERE r.stall_id = 3 AND r.rating = 1 AND i.diagnosis = 'thallium poisoning' AND i.id IS NULL`);
  assert.deepEqual(trap, []);
  const anyIllness = coldRows(`
    SELECT c.name FROM reviews r JOIN customers c ON c.id = r.customer_id
    LEFT JOIN illness_reports i ON i.customer_id = r.customer_id
    WHERE r.stall_id = 3 AND r.rating = 1 AND i.id IS NULL`);
  assert.deepEqual(anyIllness.map((r) => r.name), ['Beatrix Coyle'], 'joining any illness wrongly drops Hugo');
});

test('cold case: accusations', () => {
  const { judge } = getLevel('coldcase');
  const exists = (n) => Boolean(cold.findPerson(normalizeName(n)));
  assert.equal(judge('Margo Ellery', exists('Margo Ellery')).verdict, 'correct');
  assert.equal(judge('  margo   ELLERY ', true).verdict, 'correct');
  assert.match(judge('Dov Pereira', exists('Dov Pereira')).message, /drinks station for two/);
  assert.equal(judge('Ivy Thackeray', exists('Ivy Thackeray')).verdict, 'wrong');
  assert.equal(judge('Nobody Here', exists('Nobody Here')).verdict, 'unknown');
  assert.equal(cold.findPerson("x' OR '1'='1"), null);
});

test('cold case data: every stint starts after the previous one and every shift ends with off', () => {
  const rows = coldRows(`
    SELECT staff_id, station, started_at,
           LEAD(started_at) OVER (PARTITION BY staff_id ORDER BY started_at) AS next_at,
           LEAD(station) OVER (PARTITION BY staff_id ORDER BY started_at) AS next_station
    FROM station_log`);
  for (const r of rows) {
    if (r.next_at) assert.ok(r.next_at > r.started_at);
    if (r.station !== 'off') assert.ok(r.next_at && r.next_at.slice(0, 10) === r.started_at.slice(0, 10), `${r.staff_id} ${r.started_at} runs past midnight`);
    if (!r.next_at) assert.equal(r.station, 'off');
  }
});

/* ---------------- Level 4: the writable level ---------------- */

test('every Tampered Evidence mission passes when done in order', () => {
  const s = session('tampered');
  for (const l of lessonsOf('tampered').filter((x) => x.check.type !== 'read')) {
    const result = s.run(l.answer, l.id);
    assert.equal(result.check.passed, true, `${l.id}: ${JSON.stringify(result.check)}`);
  }
});

test('writable level: changes persist between runs and through a saved snapshot', () => {
  const s = session('tampered');
  const r = s.run("UPDATE employees SET department = 'Moved' WHERE id = 10");
  assert.equal(r.changes, 1);
  assert.equal(s.run('SELECT department FROM employees WHERE id = 10').rows[0][0], 'Moved');
  const reloaded = session('tampered', r.snapshot);
  assert.equal(reloaded.restoredSnapshot, true);
  assert.equal(reloaded.run('SELECT department FROM employees WHERE id = 10').rows[0][0], 'Moved');
  reloaded.reset();
  assert.equal(reloaded.run('SELECT department FROM employees WHERE id = 10').rows[0][0], 'Conservation');
});

test('writable level: a damaged snapshot falls back to the starting data', () => {
  const s = session('tampered', new Uint8Array([1, 2, 3, 4]));
  assert.equal(s.snapshotRejected, true);
  assert.equal(s.run('SELECT COUNT(*) FROM badge_scans').rows[0][0], 65);
});

test('writable level: an unfinished transaction is rolled back at the end of the run', () => {
  const s = session('tampered');
  const r = s.run('BEGIN; DELETE FROM badge_scans; SELECT COUNT(*) FROM badge_scans;');
  assert.equal(r.rows[0][0], 0, 'inside the transaction the rows are gone');
  assert.equal(r.rolledBack, true);
  assert.equal(r.changes, 0);
  assert.equal(s.run('SELECT COUNT(*) FROM badge_scans').rows[0][0], 65);
});

test('writable level: statements before an error still count, like in SQLite', () => {
  const s = session('tampered');
  const err = (() => {
    try {
      s.run("UPDATE employees SET name = 'Renamed' WHERE id = 9; SELECT * FROM no_such_table;");
    } catch (e) {
      return e;
    }
  })();
  assert.match(err.message, /no table called/);
  assert.ok(err.snapshot instanceof Uint8Array);
  assert.equal(s.run('SELECT name FROM employees WHERE id = 9').rows[0][0], 'Renamed');
  // ...but inside a transaction that never commits, nothing sticks.
  assert.throws(() => s.run("BEGIN; UPDATE employees SET name = 'Again' WHERE id = 8; SELECT * FROM nope;"));
  assert.equal(s.run('SELECT name FROM employees WHERE id = 8').rows[0][0], 'Ruth Okeke');
});

test('writable level: the attached backup cannot be changed', () => {
  const s = session('tampered');
  s.run('DELETE FROM backup.badge_scans;');
  assert.equal(s.run('SELECT COUNT(*) FROM backup.badge_scans').rows[0][0], 61, 'a fresh backup is attached for every run');
});

test('writable level: a careless restore loses the honest scans and the check says so', () => {
  const s = session('tampered');
  const r = s.run(
    'BEGIN; DELETE FROM badge_scans WHERE id NOT IN (SELECT id FROM backup.badge_scans); INSERT OR REPLACE INTO badge_scans SELECT * FROM backup.badge_scans; COMMIT;',
    'restore'
  );
  assert.equal(r.check.passed, false);
  assert.match(r.check.message, /honest scans/);
});

test('writable level: the trigger check rejects a trigger that also blocks inserts', () => {
  const s = session('tampered');
  const r = s.run(
    "CREATE TRIGGER t1 BEFORE UPDATE ON badge_scans BEGIN SELECT RAISE(ABORT, 'no'); END; CREATE TRIGGER t2 BEFORE DELETE ON badge_scans BEGIN SELECT RAISE(ABORT, 'no'); END; CREATE TRIGGER t3 BEFORE INSERT ON badge_scans BEGIN SELECT RAISE(ABORT, 'no'); END;",
    'trigger'
  );
  assert.equal(r.check.passed, false);
  assert.match(r.check.message, /badge readers would stop/);
});

test('writable level: VACUUM INTO produces a downloadable copy, and never overwrites', () => {
  const s = session('tampered');
  const r = s.run("-- VACUUM INTO 'ignored.db'\nVACUUM INTO 'test-copy.db';");
  assert.deepEqual(r.backupFiles.map((f) => f.name), ['test-copy.db']);
  const copy = new SQL.Database(r.backupFiles[0].bytes);
  assert.equal(copy.exec('SELECT COUNT(*) FROM badge_scans')[0].values[0][0], 65);
  copy.close();
  assert.throws(() => s.run("VACUUM INTO 'test-copy.db';"), /never overwrites/);
});

test('writable level: schema changes show up in the Tables panel, views included', () => {
  const s = session('tampered');
  const r = s.run('CREATE VIEW v_people AS SELECT name FROM employees;');
  const view = r.schema.find((t) => t.name === 'v_people');
  assert.equal(view.kind, 'view');
  assert.equal(view.rowCount, 10);
});

test('writable level: a run that bloats the database is thrown away', () => {
  const s = session('tampered');
  const big = "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 3000) INSERT INTO employees (name, department) SELECT 'p' || i, hex(randomblob(2000)) FROM n;";
  assert.throws(() => s.run(big), /bigger than/);
  assert.equal(s.run('SELECT COUNT(*) FROM employees').rows[0][0], 10);
});
