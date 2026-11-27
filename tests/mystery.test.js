// Walks the intended solution with real SQL and checks every clue agrees
// with the records, and that exactly one person fits the evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { q, col } from './helpers.js';
import { getCase } from '../src/levels/observatory/case.js';

const { hints: HINTS, startingQuery: STARTING_QUERY } = getCase('en');

const transcript = (name) =>
  col(`SELECT i.transcript FROM interviews i JOIN people p ON p.id = i.person_id WHERE p.name = '${name}'`)[0];

test('the starting query returns the murder report among the morning reports', () => {
  const rows = q(STARTING_QUERY);
  assert.ok(rows.length >= 2, 'more than one report, so filtering is still needed');
  assert.ok(rows.some((r) => r.type === 'murder' && r.location.includes('West Dome')));
});

test('step 1: exactly one murder report at the observatory', () => {
  const rows = q("SELECT * FROM crime_reports WHERE type = 'murder' AND location LIKE 'Halvorsen Ridge%'");
  assert.equal(rows.length, 1);
  assert.match(rows[0].description, /night custodian/);
  assert.match(rows[0].description, /volunteer docent named Priya/);
  assert.match(rows[0].description, /between 23:45 and 00:05/);
  // Two murders exist overall, so the location filter matters.
  assert.equal(col("SELECT COUNT(*) FROM crime_reports WHERE type = 'murder'")[0], 2);
});

test('step 2: the witnesses can be found with LIKE, and need disambiguating', () => {
  assert.equal(col("SELECT COUNT(*) FROM people WHERE occupation LIKE '%custodian%'")[0], 2);
  assert.deepEqual(col("SELECT name FROM people WHERE occupation = 'Night Custodian'"), ['Tomas Reyes']);
  assert.equal(col("SELECT COUNT(*) FROM people WHERE name LIKE 'Priya%'")[0], 2);
  assert.deepEqual(
    col("SELECT name FROM people WHERE name LIKE 'Priya%' AND occupation LIKE '%Docent%'"),
    ['Priya Raman']
  );
});

test('step 3: witness interviews give the filters', () => {
  const tomas = transcript('Tomas Reyes');
  assert.match(tomas, /23:51/);
  assert.match(tomas, /long black hard cases/);
  assert.match(tomas, /red lanyard/);
  assert.match(transcript('Priya Raman'), /already submitted/);
  assert.match(transcript('Jasper Thorne'), /Staff wear red lanyards\. Volunteer Program people wear blue/);
});

test('clue check: the witnesses are where they say they were', () => {
  // Tomas left the lounge before 23:30 and only entered the dome at 00:35.
  assert.deepEqual(
    col("SELECT accessed_at FROM access_logs WHERE person_id = 1012 AND location = 'West Dome'"),
    ['2026-10-17 00:35']
  );
  // Priya left the East Dome at 23:38 and reached the roof at 23:44: the corridor at ~23:40.
  assert.deepEqual(
    col("SELECT accessed_at FROM access_logs WHERE person_id = 1019 AND accessed_at BETWEEN '2026-10-16 23:30' AND '2026-10-16 23:59' ORDER BY accessed_at"),
    ['2026-10-16 23:38', '2026-10-16 23:44']
  );
  // Ezra's jacket trip matches the badge log.
  assert.deepEqual(
    col("SELECT direction || ' ' || accessed_at FROM access_logs WHERE person_id = 1020 AND location = 'West Dome' ORDER BY accessed_at"),
    ['in 2026-10-16 23:44', 'out 2026-10-16 23:47']
  );
});

test('the victim entered the West Dome at 23:05 and never badged out', () => {
  const rows = q("SELECT direction, accessed_at FROM access_logs WHERE person_id = 1001 AND accessed_at >= '2026-10-16 23:00'");
  assert.deepEqual(rows, [{ direction: 'in', accessed_at: '2026-10-16 23:05' }]);
});

test('filter A: West Dome occupants during the argument and time of death', () => {
  // Who was inside at any point between 23:40 and 00:05 (excluding the victim)?
  // An entry counts if it began before 00:05 and its matching exit came after 23:40.
  const inside = col(`
    SELECT DISTINCT p.name FROM access_logs AS i
    JOIN people AS p ON p.id = i.person_id
    WHERE i.location = 'West Dome' AND i.direction = 'in'
      AND i.accessed_at <= '2026-10-17 00:05'
      AND p.name <> 'Imogen Varga'
      AND COALESCE(
            (SELECT MIN(o.accessed_at) FROM access_logs AS o
             WHERE o.person_id = i.person_id AND o.location = 'West Dome'
               AND o.direction = 'out' AND o.accessed_at > i.accessed_at),
            '9999') >= '2026-10-16 23:40'
    ORDER BY p.name`);
  assert.deepEqual(inside, ['Corin Ashdown', 'Ezra Lindqvist']);
});

test('filter B: three people had a long hard case out at 23:51', () => {
  const rows = col(`
    SELECT p.name FROM equipment_loans l JOIN people p ON p.id = l.person_id
    WHERE l.item_name LIKE '%long hard case%'
      AND l.borrowed_at <= '2026-10-16 23:51'
      AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51')
    ORDER BY p.name`);
  assert.deepEqual(rows, ['Corin Ashdown', 'Felix Ward', 'Noor Haddad']);
});

test('filter C: red lanyard (staff) narrows the loans to two', () => {
  const rows = col(`
    SELECT p.name FROM equipment_loans l JOIN people p ON p.id = l.person_id
    WHERE l.item_name LIKE '%long hard case%'
      AND l.borrowed_at <= '2026-10-16 23:51'
      AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51')
      AND p.department NOT IN ('Volunteer Program', 'Visitor')
    ORDER BY p.name`);
  assert.deepEqual(rows, ['Corin Ashdown', 'Felix Ward']);
});

test('the final hint query identifies exactly one suspect', () => {
  const rows = q(HINTS.at(-1).sql);
  assert.equal(new Set(rows.map((r) => r.name)).size, 1);
  assert.equal(rows[0].name, 'Corin Ashdown');
});

test('every hint query runs without error', () => {
  for (const hint of HINTS.filter((h) => h.sql)) {
    assert.ok(q(hint.sql).length > 0, hint.title);
  }
});

test('alternative approach: GROUP BY finds the badge that kept coming back', () => {
  const rows = q(`
    SELECT p.name, COUNT(*) AS entries
    FROM access_logs a JOIN people p ON p.id = a.person_id
    WHERE a.location = 'West Dome' AND a.direction = 'in'
      AND a.accessed_at LIKE '2026-10-16%'
    GROUP BY p.id
    HAVING COUNT(*) >= 3`);
  assert.deepEqual(rows, [{ name: 'Corin Ashdown', entries: 3 }]);
});

test('alternative approach: subquery from the motive (postdoc in her group, inside at the time)', () => {
  const rows = col(`
    SELECT name FROM people
    WHERE occupation = 'Postdoctoral Researcher' AND department = 'Astrophysics'
      AND id IN (SELECT person_id FROM access_logs
                 WHERE location = 'West Dome'
                   AND accessed_at BETWEEN '2026-10-16 23:40' AND '2026-10-17 00:05')`);
  assert.deepEqual(rows, ['Corin Ashdown']);
});

test('corroboration: the suspect lied about the Roof Deck, and the drive story fits', () => {
  assert.match(transcript('Corin Ashdown'), /straight up to the Roof Deck/);
  assert.match(transcript('Corin Ashdown'), /did not go near the West Dome/);
  assert.deepEqual(
    col("SELECT location || ' ' || direction || ' ' || accessed_at FROM access_logs WHERE person_id = 1006 AND accessed_at BETWEEN '2026-10-16 23:30' AND '2026-10-17 00:00' ORDER BY accessed_at"),
    ['West Dome in 2026-10-16 23:38', 'West Dome out 2026-10-16 23:51', 'Roof Deck in 2026-10-16 23:57']
  );
  assert.deepEqual(
    col("SELECT checked_in_at FROM event_attendance WHERE person_id = 1006 AND event_name = 'Midnight Meteor Watch'"),
    ['2026-10-16 23:58']
  );
  assert.match(transcript('Wendell Fairbanks'), /07:58/);
  assert.deepEqual(col("SELECT returned_at FROM equipment_loans WHERE person_id = 1006 AND borrowed_at LIKE '2026-10-16%'"), ['2026-10-17 07:58']);
  assert.match(transcript('Ottoline Pike'), /postdoc in her own group/);
  assert.equal(col("SELECT COUNT(*) FROM people WHERE occupation = 'Postdoctoral Researcher' AND department = 'Astrophysics'")[0], 2);
});

test('the main red herrings each have a record that clears them', () => {
  // Felix: on the roof from 23:35 and never in the West Dome that night.
  assert.equal(col("SELECT COUNT(*) FROM access_logs WHERE person_id = 1008 AND location = 'West Dome'")[0], 0);
  // Rafael: returned his case at 23:19 and left the dome at 23:36.
  assert.deepEqual(col("SELECT returned_at FROM equipment_loans WHERE person_id = 1003"), ['2026-10-16 23:19']);
  // Lena: second postdoc, on the roof from 23:43, no long case.
  assert.equal(col("SELECT COUNT(*) FROM equipment_loans WHERE person_id = 1005 AND item_name LIKE '%long%'")[0], 0);
  // Hattie: out of the dome at 23:24, small case.
  assert.deepEqual(col("SELECT item_name FROM equipment_loans WHERE person_id = 1009"), ['Torque wrench kit (small hard case)']);
});
