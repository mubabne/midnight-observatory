# Midnight at the Observatory

An original SQL detective game with four levels, from your first `SELECT` to restoring a tampered database. You play by writing real SQLite queries.

| Level | For | You learn | Format |
| --- | --- | --- | --- |
| 1 · The Academy | Beginners | `SELECT`, `WHERE`, `AND`/`OR`/`IN`, `LIKE`, `NULL`, `ORDER BY`, `LIMIT`, `DISTINCT`, `COUNT`, `AS` | 13 guided lessons on one table. Each explains one idea, and your query is checked automatically. Ends with a small case. |
| 2 · Midnight at the Observatory | Intermediate | `JOIN`, `BETWEEN`, combining evidence; `GROUP BY` bonus | The original murder case across six tables (English and Mongolian) |
| 3 · The Millrace Poisonings | Advanced queries | `GROUP BY`/`HAVING`, subqueries, CTEs, `LEAD() OVER`, date functions, `LEFT JOIN … IS NULL` | A cold case: five poisonings, one stall, one person |
| 4 · Tampered Evidence | Database admin | `ATTACH`, `EXCEPT`, anti-joins, transactions, `INSERT … SELECT`, triggers, indexes, views, `VACUUM INTO`, and how servers handle roles, backups and replication | 11 missions on a **writable** database, with last night's backup attached |

Every level is open, so players start wherever their SQL is. Everything runs in the browser. There are no accounts, servers or API keys.

The mechanics are inspired by Knight Lab's [SQL Murder Mystery](https://mystery.knightlab.com/). The story, characters, data and design here are all new.

> Spoilers live in [`docs/SOLUTION.md`](docs/SOLUTION.md). Don't open it if you want to play.

## Quick start

You need Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build at http://localhost:4173 |
| `npm test` | Checks the data, the mystery, the SQL engine and game logic (Node's built-in test runner) |
| `npm run check` | Tests, then a production build |
| `npm run db:export` | Writes `dist-db/<level>.sqlite` for every level (plus Level 4's backup) so you can open the data in any SQLite tool |

`dist/` is a static site, so you can host it anywhere. Asset paths are relative, so it also works from a subfolder.

### Note on locked-down Windows machines

`package.json` uses npm `overrides` to swap Rollup and esbuild for their official WebAssembly builds (`@rollup/wasm-node`, `esbuild-wasm`). Vite then runs with **no native binaries**, so the project builds on machines where Smart App Control or another application-control policy blocks unsigned `.node`/`.exe` files. (That is why it's on Vite 7: Vite 8's bundler needs native binaries.) The project is small, so the speed cost is negligible. On an unrestricted machine you can delete the `overrides` block and reinstall if you want the native tools.

## How to play

Pick a level with the **Levels** button. The picker opens by itself on a first visit.

- **Lesson levels (1 and 4).** The **Lessons** tab explains the idea and gives you a task. The current task is also shown above the editor. Each time you run a query it is checked against the task, and a banner says either "Correct!" or what is still wrong (row count, missing column, wrong order, missing alias…). Hints and model answers are one click away.
- **Case levels (2 and 3).** Read the **Case** tab, run the starting query, follow the clues, and name the culprit. Hints unlock one at a time.
- **Level 4 is writable.** Your changes stay between runs, even across reloads, until you press **Reset database**. Each press of Run is one session: a transaction you `BEGIN` but never `COMMIT` is rolled back at the end of the run. Files written with `VACUUM INTO` get a **Download** button.

Ctrl+Enter (⌘+Enter on a Mac) runs the query. If you highlight part of the editor, only that part runs. Each level saves its own notebook, history, hints and progress in this browser. **Start level over** clears only the current level.

## Architecture

```
index.html              Page layout: case file, tables, hints, notebook, history, query desk
src/
  main.js               Wires the UI to the engine and saved state
  styles.css            All styling (CSS custom properties, no framework)
  levels/
    index.js            The ladder: level list, lookup, language fallback
    database.js         Builds a level's database from its SQL files
    academy/            Level 1: seed.sql + level.js (lessons with checks)
    observatory/        Level 2: seed.sql, i18n/mn.sql, case.js, solution.js (spoilers), level.js
    coldcase/           Level 3: seed.sql, level.js, solution.js (spoilers)
    tampered/           Level 4: seed.sql (a {{db}} template, also the backup), tamper.sql (spoilers), level.js
  sql/
    engine.js           Pure SQL logic: read-only runs, writable sessions, schema, VACUUM INTO read-back
    checks.js           Grades a lesson task (result comparison, state, triggers, plans, files)
    session.js          One level's database plus grading; used by the worker and the tests
    sql.worker.js       Web Worker that hosts sql.js and answers requests
    client.js           Main-thread wrapper: promises, 5 s timeout, restarts the worker
  state/storage.js      localStorage with validation, per-level progress and v1 migration
  ui/                   Small rendering helpers (results table, schema reference, DOM)
tests/                  node:test suites, run with npm test
scripts/export-db.js    Builds a .sqlite file from the seed
docs/SOLUTION.md        Developer walkthrough (spoilers)
```

### How a query runs

1. When the page loads, `client.js` starts `sql.worker.js`. The worker loads the sql.js WebAssembly file, which Vite hosts with the app (`sql-wasm-browser.wasm` in `dist/assets/`), and runs `seed.sql` on an empty database.
2. The worker exports that database as bytes: the **canonical evidence**.
3. Each query opens a **fresh, disposable copy** of those bytes with `PRAGMA query_only = ON`. SQLite itself rejects any write. The game never inspects your SQL text to decide what's allowed, so `WITH` queries, comments and subqueries all just work. Even if a query switches `query_only` off, it only changes its own copy, which is thrown away when the query finishes.
4. The engine steps through every statement and returns the last result set, capped at 200 rows and flagged when truncated.
5. If a query hasn't finished after 5 seconds, `client.js` terminates the worker and starts a fresh one. Terminating is the only way to stop a busy WebAssembly loop. You see a timeout message and can run the next query right away.
6. In a lesson level, the worker also grades the run against the current lesson's `check` and sends the verdict back with the result.

**Writable level (4).** `query_only` is off, and the run works on the latest snapshot of the player's database instead of the canonical bytes. Before the player's SQL runs, an in-memory database is attached as `backup` and rebuilt from `seed.sql` on every run, so it can never be damaged. After the run, any still-open transaction is rolled back and the database is exported. Those bytes become the new snapshot: the worker keeps them, `client.js` keeps them for restarts, and `main.js` saves them in localStorage (base64). A run that grows the database past 4 MB is discarded. sql.js doesn't expose its virtual file system, so files written with `VACUUM INTO` are read back by attaching them to a fresh database and copying the schema and rows.

Results are rendered with `textContent` only, so text in the database can never run as HTML.

### Saved progress

`state/storage.js` keeps one JSON object under the key `midnight-observatory/v1` (format version 2): the language, the current level, and one record per level with the draft query, history (last 50), notes, revealed hints, solved state, completed lessons and, for Level 4, the database snapshot. Every field is validated when it loads. Saves from the single-case version (format 1) are migrated into Level 2. If storage is blocked, the game runs in memory and says so. If the saved data is damaged, the game starts fresh and says so. **Start level over** asks for confirmation, then clears that level only and restarts the engine.

## Creating a new level

Add a folder under `src/levels/` with a `seed.sql` and a `level.js`, then list it in `src/levels/index.js`. The worker bundles every `.sql` file under `src/levels/` automatically. A level's `kind` is either `'lessons'` (tasks with checks, see `academy/level.js` and the check types listed in `src/sql/checks.js`) or `'case'` (briefing, hints, `judge` and `ending`, see `coldcase/`). Set `writable: true` and `database.backup: true` for a level like Level 4. `tests/levels.test.js` runs every lesson's model answer through its own check, so a check that can't be passed fails the tests.

For a case, the steps below still apply. A new mystery mostly means writing a new `seed.sql`.

1. **Design the answer first.** Decide the culprit, motive, method and timeline minute by minute. Then work backwards: what would each witness have seen, and which records would prove it?
2. **Plan the clue chain.** Report → witness → interview → matching records → corroboration → one suspect. Each step should hand the player a concrete filter (a time, a place, an item, a role). Make sure the filters overlap on exactly one person, and give each red herring a record that clears them. Never let a *missing* record be the only proof.
3. **Write `src/levels/<id>/seed.sql`.** Keep the `YYYY-MM-DD HH:MM` time format so text comparison sorts correctly. Use stable IDs and never renumber existing rows. Add enough unrelated rows that filtering matters.
4. **Write the level text** (in `level.js`, or a `case.js` like the Observatory) with the briefing, table notes, starting query and three or four hints, ordered from idea to near-solution query. Don't name the culprit there.
5. **Write `solution.js`** with the culprit, nudges for likely wrong answers, and the ending.
6. **Update the tests.** `tests/data.test.js` checks data integrity in general. `tests/mystery.test.js` and the cold-case tests in `tests/levels.test.js` encode each case's clue path, so write one for your case. It's the fastest way to catch a clue that contradicts the data.
7. Update `docs/SOLUTION.md`.

The tables reference panel reads the live schema from SQLite, so new tables and columns appear there automatically.

## Accessibility

- Every control has a label, focus states are visible, and everything works by keyboard.
- Results use a real `<table>` with column headers and a caption, inside a scrollable region you can focus.
- Status changes (results, errors, accusation feedback) are announced through live regions.
- Reduced-motion preferences are respected, and no web fonts are downloaded.

## Limitations

- The answer check runs on the client. This is a casual single-player game, so anyone who reads the source can find the culprit.
- The editor is a plain textarea with no syntax highlighting.
- Progress is stored per browser. It doesn't sync between devices.
- Only Level 2 is translated into Mongolian so far. In Mongolian mode, the other levels show their content in English (with a notice) while the buttons and error messages stay in Mongolian.
- Level 4 teaches server concepts (roles, `GRANT`/`REVOKE`, `pg_dump`, replication) as explanations, because SQLite has no users or server. Its hands-on parts are all real SQLite.
