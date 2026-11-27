// The Mongolian version: the overlay translates text without changing any
// facts, every value is translated, and the case solves the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bytes, bytesMn, bind, SQL } from './helpers.js';
import { getCase } from '../src/case/case.js';
import { judgeAccusation, normalizeName, getEnding } from '../src/case/solution.js';
import { STRINGS } from '../src/i18n/strings.js';
import { detectLang } from '../src/i18n/i18n.js';
import { runQuery, findPersonByName } from '../src/sql/engine.js';

const en = bind(bytes, 'en');
const mn = bind(bytesMn, 'mn');
const CYRILLIC = /[Ѐ-ӿ]/;
const mnCase = getCase('mn');
const transcript = (name) =>
  mn.col(`SELECT i.transcript FROM interviews i JOIN people p ON p.id = i.person_id WHERE p.name = '${name}'`)[0];

// Columns the overlay translates. Everything else must be byte-for-byte identical.
const TRANSLATED = {
  people: ['occupation', 'department'],
  crime_reports: ['location', 'type', 'description'],
  interviews: ['transcript'],
  access_logs: ['location', 'direction'],
  equipment_loans: ['item_name'],
  event_attendance: ['event_name', 'location'],
};

test('the overlay changes no ids, names, times or relationships', () => {
  for (const [table, translated] of Object.entries(TRANSLATED)) {
    const cols = en.q(`SELECT name FROM pragma_table_info('${table}')`).map((r) => r.name).filter((c) => !translated.includes(c));
    const sql = `SELECT ${cols.join(', ')} FROM ${table} ORDER BY id`;
    assert.deepEqual(mn.q(sql), en.q(sql), table);
  }
});

test('every translated value is actually in Mongolian', () => {
  for (const [table, cols] of Object.entries(TRANSLATED)) {
    for (const c of cols) {
      const untranslated = mn.col(`SELECT DISTINCT ${c} FROM ${table}`).filter((v) => !CYRILLIC.test(v));
      assert.deepEqual(untranslated, [], `${table}.${c}`);
    }
  }
});

test('equal English values map to equal Mongolian values (filters stay consistent)', () => {
  for (const [table, cols] of Object.entries(TRANSLATED)) {
    for (const c of cols.filter((c) => !['description', 'transcript'].includes(c))) {
      const pairs = new Map();
      const enRows = en.q(`SELECT id, ${c} AS v FROM ${table} ORDER BY id`);
      const mnRows = mn.q(`SELECT id, ${c} AS v FROM ${table} ORDER BY id`);
      enRows.forEach((r, i) => {
        const seen = pairs.get(r.v);
        if (seen === undefined) pairs.set(r.v, mnRows[i].v);
        else assert.equal(mnRows[i].v, seen, `${table}.${c}: "${r.v}" translated two ways`);
      });
      assert.equal(new Set(pairs.values()).size, pairs.size, `${table}.${c}: two English values share one translation`);
    }
  }
});

test('Mongolian: the starting query returns the murder report', () => {
  const rows = mn.q(mnCase.startingQuery);
  assert.ok(rows.some((r) => r.type === 'аллага' && r.location.includes('Баруун бөмбөгөр')));
});

test('Mongolian: report and witnesses are found the same way', () => {
  const rows = mn.q("SELECT * FROM crime_reports WHERE type = 'аллага' AND location LIKE 'Халворсен Ридж%'");
  assert.equal(rows.length, 1);
  assert.match(rows[0].description, /шөнийн үйлчлэгч/);
  assert.match(rows[0].description, /Priya нэртэй сайн дурын хөтөч/);
  assert.match(rows[0].description, /23:45-аас 00:05/);
  assert.equal(mn.col("SELECT COUNT(*) FROM people WHERE occupation LIKE '%үйлчлэгч%'")[0], 2);
  assert.deepEqual(mn.col("SELECT name FROM people WHERE occupation = 'Шөнийн үйлчлэгч'"), ['Tomas Reyes']);
  assert.deepEqual(mn.col("SELECT name FROM people WHERE name LIKE 'Priya%' AND occupation LIKE '%хөтөч%'"), ['Priya Raman']);
});

test('Mongolian: interviews carry the same clues', () => {
  const tomas = transcript('Tomas Reyes');
  assert.match(tomas, /23:51/);
  assert.match(tomas, /урт хар хатуу хайрцаг/);
  assert.match(tomas, /Улаан оосор/);
  assert.match(transcript('Priya Raman'), /аль хэдийн илгээгдчихсэн/);
  assert.match(transcript('Jasper Thorne'), /улаан оосор/);
  assert.match(transcript('Ottoline Pike'), /докторын дараах судлаач/);
  assert.match(transcript('Wendell Fairbanks'), /07:58/);
  assert.match(transcript('Corin Ashdown'), /шууд дээврийн тавцан/);
  assert.equal(mn.col("SELECT COUNT(*) FROM people WHERE occupation = 'Докторын дараах судлаач'")[0], 2);
});

test('Mongolian: every hint query runs, and the last one finds exactly one suspect', () => {
  for (const hint of mnCase.hints.filter((h) => h.sql)) {
    assert.ok(mn.q(hint.sql).length > 0, hint.title);
  }
  const names = new Set(mn.q(mnCase.hints.at(-1).sql).map((r) => r.name));
  assert.deepEqual([...names], ['Corin Ashdown']);
});

test('Mongolian: hint queries return the same people as the English ones', () => {
  const enHints = getCase('en').hints;
  mnCase.hints.forEach((hint, i) => {
    if (!hint.sql) return;
    const names = (rows) => rows.map((r) => r.name).sort();
    assert.deepEqual(names(mn.q(hint.sql)), names(en.q(enHints[i].sql)), hint.title);
  });
});

test('Mongolian: the GROUP BY bonus lead works with Mongolian values', () => {
  const rows = mn.q(`
    SELECT p.name, COUNT(*) AS entries
    FROM access_logs a JOIN people p ON p.id = a.person_id
    WHERE a.location = 'Баруун бөмбөгөр' AND a.direction = 'орсон'
      AND a.accessed_at LIKE '2026-10-16%'
    GROUP BY p.id HAVING COUNT(*) >= 3`);
  assert.deepEqual(rows, [{ name: 'Corin Ashdown', entries: 3 }]);
});

test('LIKE and lower() ignore case for Cyrillic', () => {
  assert.equal(mn.col("SELECT COUNT(*) FROM access_logs WHERE location LIKE 'баруун бөмбөгөр'")[0],
    mn.col("SELECT COUNT(*) FROM access_logs WHERE location = 'Баруун бөмбөгөр'")[0]);
  assert.equal(mn.col("SELECT COUNT(*) FROM equipment_loans WHERE item_name LIKE '%УРТ ХАТУУ%'")[0],
    en.col("SELECT COUNT(*) FROM equipment_loans WHERE item_name LIKE '%long hard case%'")[0]);
  assert.deepEqual(mn.col("SELECT lower('БАРУУН')"), ['баруун']);
  // English behaviour is unchanged.
  assert.equal(en.col("SELECT COUNT(*) FROM access_logs WHERE location LIKE 'west dome'")[0],
    en.col("SELECT COUNT(*) FROM access_logs WHERE location = 'West Dome'")[0]);
  assert.equal(en.col("SELECT COUNT(*) FROM people WHERE name LIKE 'P_iya%'")[0], 2);
});

test('Mongolian: accusations accept Latin or Cyrillic spellings of the culprit', () => {
  const exists = (n) => Boolean(findPersonByName(SQL, bytesMn, normalizeName(n)));
  for (const guess of ['Corin Ashdown', 'Корин Эшдаун', '  корин   эшдаун ', 'Доктор Corin Ashdown']) {
    assert.equal(judgeAccusation(guess, exists(guess), 'mn').verdict, 'correct', guess);
  }
  const wrong = judgeAccusation('Felix Ward', exists('Felix Ward'), 'mn');
  assert.equal(wrong.verdict, 'wrong');
  assert.ok(CYRILLIC.test(wrong.message));
  const unknown = judgeAccusation('Бат Болд', exists('Бат Болд'), 'mn');
  assert.equal(unknown.verdict, 'unknown');
  assert.ok(CYRILLIC.test(unknown.message));
});

test('Mongolian: engine errors are explained in Mongolian', () => {
  const run = (sql) => runQuery(SQL, bytesMn, sql, { lang: 'mn' });
  assert.throws(() => run('DELETE FROM people'), /зөвхөн уншигдана/);
  assert.throws(() => run('SELECT * FROM suspects'), /хүснэгт байхгүй/);
  assert.throws(() => run('SELEC 1'), /ойлгохгүй/);
});

test('every interface string exists in both languages with the same shape', () => {
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(Object.keys(STRINGS.mn).sort(), enKeys);
  for (const key of enKeys) {
    assert.equal(typeof STRINGS.mn[key], typeof STRINGS.en[key], key);
  }
});

test('every data-i18n key used in index.html exists', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((p) => p.split(':')[1].trim())),
  ];
  assert.ok(keys.length > 40);
  for (const key of keys) assert.ok(key in STRINGS.en && key in STRINGS.mn, key);
});

test('Mongolian case text and ending are written in Mongolian', () => {
  const texts = [
    mnCase.briefing.premise, mnCase.briefing.objective, ...mnCase.briefing.conventions,
    ...mnCase.hints.flatMap((h) => [h.title, h.body]), mnCase.bonusLead.body,
    ...Object.values(mnCase.tableNotes), getEnding('mn').motive, ...getEnding('mn').chain.flat(),
  ];
  for (const text of texts) assert.ok(CYRILLIC.test(text), text);
});

test('the default language follows the browser', () => {
  assert.equal(detectLang({ languages: ['mn-MN', 'en'] }), 'mn');
  assert.equal(detectLang({ languages: ['en-US'] }), 'en');
  assert.equal(detectLang({ language: 'mn' }), 'mn');
  assert.equal(detectLang(undefined), 'en');
});
