// Integrity checks on the seed data: shape, relationships and timeline sanity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQL, bytes, seedSql, q, col } from './helpers.js';
import { buildCanonicalBytes } from '../src/sql/engine.js';

const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const TIME_COLUMNS = {
  crime_reports: ['occurred_at'],
  interviews: ['recorded_at'],
  access_logs: ['accessed_at'],
  equipment_loans: ['borrowed_at', 'returned_at'],
  event_attendance: ['checked_in_at', 'checked_out_at'],
};

test('has the six expected tables', () => {
  const tables = col("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name");
  assert.deepEqual(tables, [
    'access_logs', 'crime_reports', 'equipment_loans', 'event_attendance', 'interviews', 'people',
  ]);
});

test('dataset size matches the brief (20-40 people, ~100-200 evidence rows)', () => {
  const people = col('SELECT COUNT(*) FROM people')[0];
  assert.ok(people >= 20 && people <= 40, `people: ${people}`);
  const evidence = col(`SELECT
    (SELECT COUNT(*) FROM crime_reports) + (SELECT COUNT(*) FROM interviews) +
    (SELECT COUNT(*) FROM access_logs) + (SELECT COUNT(*) FROM equipment_loans) +
    (SELECT COUNT(*) FROM event_attendance)`)[0];
  assert.ok(evidence >= 100 && evidence <= 200, `evidence rows: ${evidence}`);
});

test('every foreign key points at a real person', () => {
  assert.deepEqual(q('PRAGMA foreign_key_check'), []);
  for (const table of Object.keys(TIME_COLUMNS).filter((t) => t !== 'crime_reports')) {
    const orphans = col(`SELECT COUNT(*) FROM ${table} WHERE person_id NOT IN (SELECT id FROM people)`)[0];
    assert.equal(orphans, 0, `${table} has orphan rows`);
  }
});

test('every timestamp uses YYYY-MM-DD HH:MM', () => {
  for (const [table, cols] of Object.entries(TIME_COLUMNS)) {
    for (const c of cols) {
      for (const v of col(`SELECT ${c} FROM ${table} WHERE ${c} IS NOT NULL`)) {
        assert.match(v, TIME, `${table}.${c} = ${v}`);
        const [d, t] = v.split(' ');
        const [hh, mm] = t.split(':').map(Number);
        assert.ok(hh < 24 && mm < 60, `${table}.${c} invalid time ${v}`);
        assert.ok(!Number.isNaN(Date.parse(`${d}T${t}:00`)), `${table}.${c} invalid date ${v}`);
      }
    }
  }
});

test('returns and check-outs never happen before borrows and check-ins', () => {
  assert.equal(col('SELECT COUNT(*) FROM equipment_loans WHERE returned_at < borrowed_at')[0], 0);
  assert.equal(col('SELECT COUNT(*) FROM event_attendance WHERE checked_out_at < checked_in_at')[0], 0);
});

test('badge logs alternate in/out per person and door', () => {
  const rows = q('SELECT person_id, location, direction, accessed_at FROM access_logs ORDER BY person_id, location, accessed_at, id');
  const state = new Map();
  for (const r of rows) {
    const key = `${r.person_id}|${r.location}`;
    const prev = state.get(key);
    if (r.direction === 'in') {
      assert.notEqual(prev, 'in', `${key} badged in twice without leaving (${r.accessed_at})`);
    } else {
      assert.equal(prev, 'in', `${key} badged out without being in (${r.accessed_at})`);
    }
    state.set(key, r.direction);
  }
});

test('nobody is inside two badge-controlled rooms at once', () => {
  const rooms = ['West Dome', 'East Dome', 'Roof Deck', 'Staff Lounge'];
  const rows = q(`SELECT person_id, location, direction, accessed_at FROM access_logs
                  WHERE location IN (${rooms.map((r) => `'${r}'`).join(',')})
                  ORDER BY person_id, accessed_at, id`);
  const inside = new Map();
  for (const r of rows) {
    const where = inside.get(r.person_id);
    if (r.direction === 'in') {
      assert.equal(where, undefined, `${r.person_id} entered ${r.location} at ${r.accessed_at} while still in ${where}`);
      inside.set(r.person_id, r.location);
    } else {
      inside.delete(r.person_id);
    }
  }
});

test('only staff and volunteers appear in badge logs and loans', () => {
  for (const table of ['access_logs', 'equipment_loans']) {
    const visitors = col(`SELECT COUNT(*) FROM ${table} t JOIN people p ON p.id = t.person_id WHERE p.department = 'Visitor'`)[0];
    assert.equal(visitors, 0, `${table} contains visitors`);
  }
});

test('meteor watch check-ins all happen after the kiosk opened at 23:45', () => {
  const early = col("SELECT COUNT(*) FROM event_attendance WHERE event_name = 'Midnight Meteor Watch' AND checked_in_at < '2026-10-16 23:45'")[0];
  assert.equal(early, 0);
});

test('badge holders who scanned into the meteor watch were on the Roof Deck at the time', () => {
  const mismatches = q(`
    SELECT p.name, e.checked_in_at FROM event_attendance e
    JOIN people p ON p.id = e.person_id
    WHERE e.event_name = 'Midnight Meteor Watch'
      AND p.department <> 'Visitor'
      AND NOT EXISTS (
        SELECT 1 FROM access_logs i
        WHERE i.person_id = e.person_id AND i.location = 'Roof Deck' AND i.direction = 'in'
          AND i.accessed_at <= e.checked_in_at
          AND COALESCE((SELECT MIN(o.accessed_at) FROM access_logs o
                        WHERE o.person_id = i.person_id AND o.location = 'Roof Deck'
                          AND o.direction = 'out' AND o.accessed_at > i.accessed_at), '9999') >= e.checked_in_at)`);
  assert.deepEqual(mismatches, []);
});

test('building the database is deterministic', () => {
  const again = buildCanonicalBytes(SQL, seedSql);
  const dump = (b) => {
    const db = new SQL.Database(b);
    const out = db.exec("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")[0].values
      .map(([t]) => JSON.stringify(db.exec(`SELECT * FROM ${t} ORDER BY 1`)));
    db.close();
    return out.join('\n');
  };
  assert.equal(dump(again), dump(bytes));
});
