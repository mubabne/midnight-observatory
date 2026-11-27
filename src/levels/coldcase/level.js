// Level 3 · Cold Case: The Millrace Poisonings. Nothing in this file names the culprit.
import { judgeAccusation, getEnding } from './solution.js';

const en = {
  title: 'The Millrace Poisonings',
  difficulty: 'Advanced queries',
  eyebrow: 'Level 3 · Advanced queries · Cold case 26-0924 · Millrace Market Hall',
  stamp: 'Cold case · Reopened',
  summary:
    'Five people poisoned in one month, and no arrest. Aggregate thousands of facts at once: GROUP BY, HAVING, subqueries, CTEs, window functions and LEFT JOIN.',
  skills: ['GROUP BY', 'HAVING', 'subqueries', 'WITH (CTEs)', 'LEAD() OVER', 'LEFT JOIN … IS NULL', 'date functions'],
  accuseHeading: 'Name the poisoner',
  accuseHelp: 'Write the full name as it appears in `staff` or `customers`. Wrong guesses cost nothing.',
  solvedText: 'Case closed. You named the poisoner.',
  notesPlaceholder: 'e.g. Five thallium cases. Which stall did all five visit?',
  bonusButton: 'Show the bonus lead (LEFT JOIN)',

  startingQuery: `-- Cold case 26-0924. Press Run (or Ctrl+Enter).
-- Every illness the hospital reported in September 2026.
SELECT *
FROM illness_reports
ORDER BY onset_at;
`,
  briefing: {
    premise:
      'In September 2026, five people were admitted to Larkspur General with thallium poisoning. All of them survived. All of them use the loyalty app at Millrace Market Hall, where six food stalls share one ordering system. The investigation stalled, and the case went cold. The app records, shift logs and reviews have now been handed to you.',
    objective:
      'Find the one stall that served every patient just before they fell ill, then the one person behind its counter who could have poisoned all five. Then name them below.',
    facts: [
      ['When', '1–25 September 2026'],
      ['Where', 'Millrace Market Hall, Larkspur Falls'],
      ['Type', 'poisoning (thallium), five victims'],
    ],
    conventions: [
      "Times are local, 24-hour text like '2026-09-04 09:12'. Text comparison sorts them correctly.",
      'Doctors say thallium symptoms start 12 to 48 hours after it is swallowed. So count only orders placed in the 48 hours before onset_at.',
      "datetime(onset_at, '-48 hours') shifts a time back by 48 hours. Its result has seconds added, but it still compares correctly with these times.",
      'station_log only records when a stint starts. A stint lasts until that person\'s next row. The last row of a shift has station \'off\'.',
      'Each query runs on a fresh copy of the evidence. You cannot break anything.',
    ],
  },
  tableNotes: {
    stalls: 'The six food stalls in the hall.',
    staff: 'Everyone who works a stall. stall_id says which one.',
    customers: 'Loyalty app members. Every app order is in orders.',
    orders: 'Every loyalty app order in September, one row per item.',
    station_log: 'Start of each stint at a station. It ends when that person’s next row starts.',
    illness_reports: 'Hospital reports about loyalty members.',
    reviews: 'Ratings from 1 to 5 that customers posted in the app.',
  },
  hints: [
    {
      title: 'Start with the hospital',
      body:
        "Filter illness_reports to the thallium cases, then turn their customer_ids into names. A subquery is a query inside another query: WHERE id IN (SELECT …). Read the notes too. They tell you how the poison was given.",
      sql: `SELECT name
FROM customers
WHERE id IN (SELECT customer_id
             FROM illness_reports
             WHERE diagnosis = 'thallium poisoning');`,
    },
    {
      title: 'Find the stall that served all five',
      body:
        'WITH gives a subquery a name so you can reuse it, which is called a CTE. Join the patients to their orders from the 48 hours before onset, then GROUP BY stall. HAVING filters groups the way WHERE filters rows, so keep only stalls that served every patient. COUNT(DISTINCT …) stops a patient who ordered twice from counting twice.',
      sql: `WITH patients AS (
  SELECT customer_id, onset_at
  FROM illness_reports
  WHERE diagnosis = 'thallium poisoning'
)
SELECT s.name, COUNT(DISTINCT o.customer_id) AS patients_served
FROM patients AS p
JOIN orders AS o ON o.customer_id = p.customer_id
JOIN stalls AS s ON s.id = o.stall_id
WHERE o.ordered_at BETWEEN datetime(p.onset_at, '-48 hours') AND p.onset_at
GROUP BY s.id
HAVING COUNT(DISTINCT o.customer_id) = (SELECT COUNT(*) FROM patients);`,
    },
    {
      title: 'Rebuild the shifts with a window function',
      body:
        "station_log only has start times. LEAD(started_at) OVER (PARTITION BY staff_id ORDER BY started_at) looks ahead to the same person's next row, which is when the stint ended. Join the five poisoned orders to the stints they fall inside, and count how many each person covered. Leave out the 'off' rows.",
      sql: `WITH stints AS (
  SELECT staff_id, station, started_at,
         LEAD(started_at) OVER (PARTITION BY staff_id ORDER BY started_at) AS ended_at
  FROM station_log
),
poisoned AS (
  SELECT o.id, o.ordered_at
  FROM orders AS o
  JOIN illness_reports AS i ON i.customer_id = o.customer_id
  JOIN stalls AS s ON s.id = o.stall_id
  WHERE i.diagnosis = 'thallium poisoning'
    AND s.name = 'Ember & Oak Tea Bar'
    AND o.ordered_at BETWEEN datetime(i.onset_at, '-48 hours') AND i.onset_at
)
SELECT st.name, st.role, COUNT(DISTINCT p.id) AS poisoned_orders_on_shift
FROM poisoned AS p
JOIN stints AS t ON p.ordered_at >= t.started_at AND p.ordered_at < t.ended_at
JOIN staff AS st ON st.id = t.staff_id
WHERE t.station <> 'off'
GROUP BY st.id
ORDER BY poisoned_orders_on_shift DESC;`,
    },
    {
      title: 'Follow the tea',
      body:
        "The toxicology notes say the poison went into hot drinks. Change the last query so it only counts stints on the 'drinks' station. Keep only people who covered all five with HAVING. Then read the reviews the five patients posted for that stall to see why they were chosen.",
      sql: `WITH stints AS (
  SELECT staff_id, station, started_at,
         LEAD(started_at) OVER (PARTITION BY staff_id ORDER BY started_at) AS ended_at
  FROM station_log
),
poisoned AS (
  SELECT o.id, o.ordered_at
  FROM orders AS o
  JOIN illness_reports AS i ON i.customer_id = o.customer_id
  JOIN stalls AS s ON s.id = o.stall_id
  WHERE i.diagnosis = 'thallium poisoning'
    AND s.name = 'Ember & Oak Tea Bar'
    AND o.ordered_at BETWEEN datetime(i.onset_at, '-48 hours') AND i.onset_at
)
SELECT st.name, COUNT(DISTINCT p.id) AS drinks_made
FROM poisoned AS p
JOIN stints AS t ON p.ordered_at >= t.started_at AND p.ordered_at < t.ended_at
JOIN staff AS st ON st.id = t.staff_id
WHERE t.station = 'drinks'
GROUP BY st.id
HAVING COUNT(DISTINCT p.id) = (SELECT COUNT(*) FROM poisoned);`,
    },
  ],
  bonusLead: {
    title: 'Bonus lead: who is next?',
    body:
      "Every patient had left a 1-star review of the same stall. Who else left a 1-star review there but has NOT been poisoned yet? Use LEFT JOIN to illness_reports and keep the rows where the report IS NULL. Careful: put the diagnosis condition in the ON clause, not in WHERE. One person on the list did go to hospital, just not for thallium.",
  },
};

export default {
  id: 'coldcase',
  number: 3,
  kind: 'case',
  writable: false,
  database: { seed: 'seed.sql' },
  personLookup: `SELECT name FROM staff WHERE lower(trim(name)) = :name
UNION ALL
SELECT name FROM customers WHERE lower(trim(name)) = :name
LIMIT 1;`,
  content: { en },
  judge: judgeAccusation,
  ending: getEnding,
};
