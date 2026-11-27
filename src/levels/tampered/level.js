// Level 4 · Tampered Evidence. The one writable level: missions on a database
// that keeps its state between runs, with last night's backup attached.
// Each mission also says how the same job is done on a database server.

const RESTORED = 'NOT EXISTS (SELECT * FROM backup.badge_scans EXCEPT SELECT * FROM badge_scans)';

const lessons = [
  {
    id: 'attach',
    title: 'Two copies of the truth',
    body: [
      "Someone changed the archive's badge records after the burglary. Luckily, the server takes a backup every night at 01:00. The backup is **attached** to your session under the name `backup`. That means one connection can read two database files.",
      'Put the database name in front of a table to say which copy you mean. Plain `badge_scans` (or `main.badge_scans`) is the live table. `backup.badge_scans` is the 01:00 copy.',
      { sql: 'PRAGMA database_list;' },
      'A scalar subquery is a query in brackets that returns a single value. You can use one anywhere a value fits, even in the `SELECT` list:',
      { sql: 'SELECT (SELECT COUNT(*) FROM employees) AS staff_count;' },
      { note: "On a server: PostgreSQL and MySQL don't ATTACH files. You would restore the backup into its own database (pg_restore -d archive_backup) and query across with postgres_fdw, or restore it into a separate schema in the same database." },
    ],
    task: 'In **one** query, show the number of rows in the live `badge_scans` next to the number in `backup.badge_scans`.',
    hint: 'Two scalar subqueries in one SELECT: `SELECT (SELECT COUNT(*) FROM …) AS live, (SELECT COUNT(*) FROM …) AS backup;`',
    answer: 'SELECT (SELECT COUNT(*) FROM badge_scans)        AS live,\n       (SELECT COUNT(*) FROM backup.badge_scans) AS backup;',
    check: {
      type: 'rows',
      sql: 'SELECT (SELECT COUNT(*) FROM badge_scans) AS live, (SELECT COUNT(*) FROM backup.badge_scans) AS backup',
    },
  },
  {
    id: 'except',
    title: 'What changed? EXCEPT',
    body: [
      '`A EXCEPT B` returns the rows of A that do not appear in B, comparing every column. Both sides need the same number of columns.',
      { sql: 'SELECT * FROM admin_sessions\nEXCEPT\nSELECT * FROM backup.admin_sessions;' },
      'Its relatives are `UNION` (rows in either, without duplicates) and `INTERSECT` (rows in both).',
      'Expect some honest rows in your answer. The badge readers kept working after 01:00, so this morning\'s scans are new too. Look at `scanned_at` and `modified_at` to tell them apart.',
    ],
    task: 'List every row of the live `badge_scans` that is **not identical** to a row in the backup.',
    hint: 'Same shape as the example, with badge_scans on both sides.',
    answer: 'SELECT * FROM badge_scans\nEXCEPT\nSELECT * FROM backup.badge_scans;',
    check: { type: 'rows', sql: 'SELECT id FROM (SELECT * FROM badge_scans EXCEPT SELECT * FROM backup.badge_scans)' },
  },
  {
    id: 'vanished',
    title: 'What vanished? Anti-joins',
    body: [
      'EXCEPT finds changed rows, but deleted rows only exist in the backup. To find rows with no partner, use an **anti-join**: a LEFT JOIN keeps every row on the left, puts NULLs where there is no match, and then you keep only the NULLs.',
      { sql: 'SELECT e.name\nFROM employees AS e\nLEFT JOIN admin_sessions AS s ON s.employee_id = e.id\nWHERE s.id IS NULL;   -- people who never used the console' },
      '`WHERE id NOT IN (SELECT id FROM …)` gives the same answer here. Be careful with NOT IN, though: if the subquery returns even one NULL, it matches nothing at all.',
    ],
    task: 'Find the backup rows of `badge_scans` whose `id` **no longer exists** in the live table.',
    hint: 'LEFT JOIN badge_scans (live) to backup.badge_scans on id, from the backup side, and keep the rows where the live id IS NULL.',
    answer:
      'SELECT b.*\nFROM backup.badge_scans AS b\nLEFT JOIN badge_scans AS l ON l.id = b.id\nWHERE l.id IS NULL;',
    check: {
      type: 'rows',
      sql: 'SELECT id FROM backup.badge_scans WHERE id NOT IN (SELECT id FROM badge_scans)',
    },
  },
  {
    id: 'who',
    title: 'Who was at the console?',
    body: [
      'The admin console stamps `modified_at` on every row it touches. `admin_sessions` records who was signed in to the console, and when.',
      'Join the tampered rows to the sessions they fall inside. Careful: one console edit happened **before** the backup. It was a routine fix, and it is in both copies.',
    ],
    task: 'Find the person whose console session covers the edits made **after** the backup. Every row of your result should name that person.',
    hint: 'Start from the rows that EXCEPT found and that have a modified_at. Join admin_sessions ON modified_at BETWEEN logged_in_at AND logged_out_at, then employees.',
    answer: `WITH changed AS (
  SELECT * FROM badge_scans
  EXCEPT
  SELECT * FROM backup.badge_scans
)
SELECT DISTINCT e.name, s.workstation, s.logged_in_at, s.logged_out_at
FROM changed AS c
JOIN admin_sessions AS s ON c.modified_at BETWEEN s.logged_in_at AND s.logged_out_at
JOIN employees AS e ON e.id = s.employee_id;`,
    check: {
      type: 'value',
      value: 'Gideon Marsh',
      message: 'Not yet. Every row of your result should name the one person who was signed in during the after-backup edits.',
    },
  },
  {
    id: 'rollback',
    title: 'The undo button: transactions',
    body: [
      'This level is writable, and changes you make **stay** until you press "Reset database". So learn the safety net first.',
      '`BEGIN` starts a transaction. Nothing inside it is final until `COMMIT`. `ROLLBACK` throws all of it away, as if it never happened. Inside the transaction, your own queries already see the changes.',
      { sql: 'BEGIN;\nDELETE FROM employees;\nSELECT COUNT(*) FROM employees;   -- 0, but only inside the transaction\nROLLBACK;\nSELECT COUNT(*) FROM employees;   -- everyone is back' },
      'Here, each press of Run is one session. A transaction you start but never COMMIT is rolled back when the run ends.',
      { note: 'On a server: transactions work the same way in PostgreSQL and MySQL. Many clients (psql, DBeaver) commit each statement on its own unless you BEGIN first. Get into the habit of opening a transaction before any manual UPDATE or DELETE on production data.' },
    ],
    task: 'Inside a transaction, **delete every row** of `badge_scans`, then **ROLLBACK** so nothing is lost. Finish by counting the rows.',
    hint: 'Use the example, with badge_scans instead of employees.',
    answer: 'BEGIN;\nDELETE FROM badge_scans;\nSELECT COUNT(*) FROM badge_scans;\nROLLBACK;\nSELECT COUNT(*) FROM badge_scans;',
    check: {
      type: 'all',
      checks: [
        { type: 'sql', pattern: '\\bBEGIN\\b[\\s\\S]*\\bDELETE\\b[\\s\\S]*\\bROLLBACK\\b', message: 'Write BEGIN, then the DELETE, then ROLLBACK, all in one run.' },
        { type: 'state', sql: 'SELECT COUNT(*) > 0 FROM badge_scans', message: 'badge_scans is empty! Press "Reset database" in the Lessons tab and try again with ROLLBACK.' },
      ],
    },
  },
  {
    id: 'restore',
    title: 'Restore the evidence',
    body: [
      'Now repair the live table, using the backup as the source of truth. Three kinds of damage need fixing:',
      {
        list: [
          '**Edited** rows: copy the backup version back over them.',
          '**Deleted** rows: insert them again from the backup.',
          '**Forged** rows: delete the row that is not in the backup **and** carries a console stamp in modified_at.',
        ],
      },
      "Don't just wipe every row the backup lacks. This morning's honest scans aren't in the backup either.",
      '`INSERT OR REPLACE` inserts a row, or replaces the existing row with the same primary key. Together with `INSERT … SELECT`, which inserts a query\'s rows, it handles the first two cases in one statement:',
      { sql: 'INSERT OR REPLACE INTO badge_scans\nSELECT * FROM backup.badge_scans;' },
      'Wrap all of it in `BEGIN … COMMIT` so the table is never left half-repaired. If you make a mess, "Reset database" brings back the tampered starting state.',
      { note: 'On a server: you would usually restore the whole backup to a scratch database, check it, then copy the rows you need, exactly as here. For "undo everything since 01:00" there is point-in-time recovery (PostgreSQL WAL archiving, MySQL binlogs). Those replay the log up to a chosen moment.' },
    ],
    task: 'Repair `badge_scans`: every backup row back exactly as it was, the forged row gone, and this morning\'s honest scans kept.',
    hint: 'Two statements in a transaction. A DELETE for rows whose id is NOT IN the backup AND whose modified_at IS NOT NULL. Then the INSERT OR REPLACE from the example.',
    answer:
      'BEGIN;\nDELETE FROM badge_scans\nWHERE id NOT IN (SELECT id FROM backup.badge_scans)\n  AND modified_at IS NOT NULL;\nINSERT OR REPLACE INTO badge_scans\nSELECT * FROM backup.badge_scans;\nCOMMIT;',
    check: {
      type: 'all',
      checks: [
        {
          type: 'state',
          sql: `SELECT ${RESTORED}`,
          message: 'Some backup rows are still missing or different in the live badge_scans. Check with EXCEPT.',
        },
        {
          type: 'state',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM badge_scans WHERE id NOT IN (SELECT id FROM backup.badge_scans) AND modified_at IS NOT NULL)',
          message: "There is still a row that isn't in the backup and that the console stamped in modified_at. That is the forged scan.",
        },
        {
          type: 'state',
          // ids 63-67 are the honest scans the readers added after the backup.
          sql: 'SELECT COUNT(*) = 5 FROM badge_scans WHERE id BETWEEN 63 AND 67 AND modified_at IS NULL',
          message: 'This morning\'s honest scans are gone too. They happened after the backup, so the backup can\'t bring them back. Press "Reset database" and restore more carefully.',
        },
      ],
    },
  },
  {
    id: 'trigger',
    title: 'Lock it down with a trigger',
    body: [
      'A **trigger** is SQL that the database runs by itself when something happens to a table. `RAISE(ABORT, \'message\')` inside a trigger cancels the statement that fired it.',
      { sql: "CREATE TRIGGER no_new_sessions\nBEFORE INSERT ON admin_sessions\nBEGIN\n  SELECT RAISE(ABORT, 'admin_sessions is append-only for the system');\nEND;" },
      'Badge readers must still be able to add scans, but nobody should ever change or delete one again. So you need **two** triggers: one `BEFORE UPDATE` and one `BEFORE DELETE` on `badge_scans`. To remove a trigger you made by mistake, use `DROP TRIGGER name;`.',
      { note: "On a server you would also use permissions. SQLite has no users, so a trigger is the closest tool. In PostgreSQL: REVOKE UPDATE, DELETE ON badge_scans FROM console_role; and give the console a role that can only INSERT and SELECT. Triggers are still useful there for audit tables." },
    ],
    task: 'Make `badge_scans` **append-only**: UPDATE and DELETE must fail, and INSERT must still work.',
    hint: "CREATE TRIGGER … BEFORE UPDATE ON badge_scans BEGIN SELECT RAISE(ABORT, '…'); END; and the same again for BEFORE DELETE, with a different trigger name.",
    answer:
      "CREATE TRIGGER badge_scans_no_update\nBEFORE UPDATE ON badge_scans\nBEGIN\n  SELECT RAISE(ABORT, 'badge_scans is append-only');\nEND;\n\nCREATE TRIGGER badge_scans_no_delete\nBEFORE DELETE ON badge_scans\nBEGIN\n  SELECT RAISE(ABORT, 'badge_scans is append-only');\nEND;",
    check: {
      type: 'all',
      checks: [
        {
          type: 'blocked',
          statements: ['UPDATE badge_scans SET door = door WHERE id = 1;', 'DELETE FROM badge_scans WHERE id = 1;'],
          message: 'An UPDATE or a DELETE on badge_scans still goes through. You need a BEFORE UPDATE and a BEFORE DELETE trigger.',
        },
        {
          type: 'allowed',
          statements: ["INSERT INTO badge_scans (employee_id, door, direction, scanned_at) VALUES (3, 'Main Entrance', 'in', '2026-10-22 09:15');"],
          message: 'New scans are being blocked too, so the badge readers would stop working. Only UPDATE and DELETE should fail. Use DROP TRIGGER to remove the wrong one.',
        },
      ],
    },
  },
  {
    id: 'index',
    title: 'Make it fast: indexes',
    body: [
      "Investigators keep asking for one person's scans. Without an index, SQLite reads every row to find them, which is called a **scan**. An **index** is a sorted copy of one or more columns, so SQLite can jump straight to the matching rows instead. That is called a **search**.",
      '`EXPLAIN QUERY PLAN` shows which one SQLite will do:',
      { sql: "EXPLAIN QUERY PLAN\nSELECT * FROM badge_scans\nWHERE employee_id = 1 AND scanned_at >= '2026-10-20';" },
      'Run it now and you\'ll see `SCAN badge_scans`. Create an index whose **first** column is the one you filter on, then run the plan again.',
      'With only 67 rows you won\'t feel the difference. With 67 million you would. Indexes cost a little space and make writes slightly slower.',
      { note: 'On a server: same idea. CREATE INDEX CONCURRENTLY (PostgreSQL) builds an index without locking out writers, and EXPLAIN ANALYZE runs the query to show real timings.' },
    ],
    task: 'Create an index so that the query above **searches** badge_scans using an index instead of scanning it.',
    hint: 'CREATE INDEX idx_badge_scans_employee ON badge_scans (employee_id, scanned_at);',
    answer: 'CREATE INDEX idx_badge_scans_employee\nON badge_scans (employee_id, scanned_at);\n\nEXPLAIN QUERY PLAN\nSELECT * FROM badge_scans\nWHERE employee_id = 1 AND scanned_at >= \'2026-10-20\';',
    check: {
      type: 'plan',
      sql: "SELECT * FROM badge_scans WHERE employee_id = 1 AND scanned_at >= '2026-10-20'",
      pattern: 'USING (COVERING )?INDEX',
      message: 'The plan still scans badge_scans. The index has to start with employee_id.',
    },
  },
  {
    id: 'view',
    title: 'A view for the prosecutor',
    body: [
      'A **view** is a saved query with a name. You select from it like a table, and it always shows the current data, because it runs its query each time. Views give other people a simple, fixed window onto messy tables.',
      { sql: "CREATE VIEW console_users AS\nSELECT DISTINCT e.name, e.department\nFROM admin_sessions AS s\nJOIN employees AS e ON e.id = s.employee_id;\n\nSELECT * FROM console_users;" },
      'To change a view, `DROP VIEW name;` and create it again.',
    ],
    task:
      "Create a view called `vault_timeline` that lists every **Records Vault** scan between 18:00 on 20 October and 06:00 on 21 October, with the person's `name`, the `direction` and `scanned_at`, oldest first.",
    hint: "Join badge_scans to employees, filter door = 'Records Vault' and scanned_at BETWEEN '2026-10-20 18:00' AND '2026-10-21 06:00', then ORDER BY scanned_at. If the view shows the forged rows, restore the evidence first.",
    answer:
      "CREATE VIEW vault_timeline AS\nSELECT e.name, b.direction, b.scanned_at\nFROM badge_scans AS b\nJOIN employees AS e ON e.id = b.employee_id\nWHERE b.door = 'Records Vault'\n  AND b.scanned_at BETWEEN '2026-10-20 18:00' AND '2026-10-21 06:00'\nORDER BY b.scanned_at;\n\nSELECT * FROM vault_timeline;",
    check: {
      type: 'stateRows',
      sql: 'SELECT * FROM vault_timeline',
      reference: `SELECT e.name, b.direction, b.scanned_at
FROM backup.badge_scans AS b JOIN backup.employees AS e ON e.id = b.employee_id
WHERE b.door = 'Records Vault' AND b.scanned_at BETWEEN '2026-10-20 18:00' AND '2026-10-21 06:00'
ORDER BY b.scanned_at`,
      ordered: true,
      message:
        "vault_timeline doesn't show the true vault scans yet. Check the view's name, its filters and its ORDER BY. If it still shows the forged rows, finish \"Restore the evidence\" first.",
    },
  },
  {
    id: 'backup',
    title: 'Take your own backup',
    body: [
      '`VACUUM INTO \'file.db\'` writes a complete, compact copy of the database to a new file. It is the simplest safe way to back up a SQLite database while it is in use.',
      { sql: "VACUUM INTO 'archive-2026-10-22.db';" },
      'It will not overwrite an existing file, so use a new name each time. The file is kept in your browser for this session, and a **Download** button appears in the Lessons tab so you can open it in any SQLite tool.',
      { note: 'On a server: pg_dump archive > archive.sql (or pg_dump -Fc for a compressed archive you restore with pg_restore), and mysqldump for MySQL. Real setups automate this, keep copies off the machine, and, most importantly, regularly test that the backups actually restore.' },
    ],
    task: 'Once the evidence is restored and locked down, back up the database to a file with `VACUUM INTO`.',
    hint: "VACUUM INTO 'archive-2026-10-22.db'; (VACUUM can't run inside a transaction.)",
    answer: "VACUUM INTO 'archive-2026-10-22.db';",
    check: {
      type: 'file',
      sql: `SELECT EXISTS (SELECT 1 FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'badge_scans') AND ${RESTORED}`,
      message:
        'The backup file was written, but it should contain the restored badge_scans and your triggers. Finish those missions, then run VACUUM INTO again with a new file name.',
    },
  },
  {
    id: 'beyond',
    title: 'Beyond SQLite: running a database server',
    body: [
      'SQLite is a file. PostgreSQL, MySQL and SQL Server are **servers**: long-running programs that many users connect to over the network. Your SQL carries over almost unchanged. What servers add is mostly about people, uptime and scale:',
      {
        list: [
          '**Users and roles.** CREATE ROLE analyst LOGIN; GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst; Each app and person gets only what they need.',
          '**Backups.** pg_dump and mysqldump for logical copies, base backups plus WAL or binlog archiving for point-in-time recovery. Test your restores.',
          '**Replication.** A primary streams its changes to replicas. They serve reads and can take over if the primary fails.',
          '**Connections.** Servers limit concurrent connections, and pools like PgBouncer share a few among many clients.',
          '**Monitoring.** Slow-query logs, pg_stat_statements and EXPLAIN ANALYZE show where time goes.',
          '**Migrations.** Schema changes are versioned scripts (Flyway, Liquibase, or your framework\'s tool), run the same way everywhere.',
        ],
      },
      'Want to practise for real? Install PostgreSQL locally, or start it with `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres`. Then try the missions of this level again: create a role, revoke UPDATE from it, dump the database and restore it somewhere else.',
    ],
    task: 'Read this one, then mark it done.',
    check: { type: 'read' },
  },
];

export default {
  id: 'tampered',
  number: 4,
  kind: 'lessons',
  writable: true,
  database: { seed: 'seed.sql', template: true, extra: ['tamper.sql'], backup: true },
  content: {
    en: {
      title: 'Tampered Evidence',
      difficulty: 'Database admin',
      eyebrow: 'Level 4 · Database admin · Larkspur Falls City Archive',
      stamp: 'Evidence integrity · Urgent',
      summary:
        "Someone edited the badge records after a burglary. You get write access: compare against last night's backup, find who did it, restore the data, then lock it down and back it up.",
      skills: ['ATTACH', 'EXCEPT', 'anti-joins', 'transactions', 'INSERT … SELECT', 'triggers', 'indexes', 'views', 'VACUUM INTO', 'server concepts'],
      intro:
        "The 1897 town charter vanished from the City Archive's Records Vault on the night of 20 October. Before the police could copy the badge database, someone changed it. Your session has the live database, which you **can** write to, and the 01:00 backup, attached read-only as `backup`. Your changes stay between runs, and \"Reset database\" puts everything back to the tampered starting state.",
      startingQuery: "-- You have write access here. Changes stay until you press \"Reset database\".\n-- Start with mission 1, or explore:\nSELECT * FROM badge_scans ORDER BY scanned_at;\n",
      tableNotes: {
        employees: 'Archive staff.',
        badge_scans: 'Door scans. modified_at is set when the admin console edits or adds a row. Also attached as backup.badge_scans (01:00 copy).',
        admin_sessions: 'Who was signed in to the admin console, and when.',
      },
      lessons,
      finale: {
        title: 'Evidence secured',
        body: 'You diffed a live database against a backup, traced the tampering to one console session, repaired the data inside a transaction, locked the table with triggers, sped it up with an index, published a view, and took a verified backup. That is the everyday work of a database administrator.',
      },
    },
  },
};
