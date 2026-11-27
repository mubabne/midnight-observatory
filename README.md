# Midnight at the Observatory

An original SQL detective game. A researcher has been found dead in the West Dome of Halvorsen Ridge Observatory. You solve the case by writing real SQLite queries against the evidence: police reports, interviews, badge logs, equipment loans and event check-ins.

Everything runs in the browser. There are no accounts, servers or API keys. The game takes about 15 to 25 minutes and practises `SELECT`, `WHERE`, `LIKE`, `ORDER BY` and `JOIN`, with an optional `GROUP BY` / `HAVING` bonus lead.

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
| `npm run db:export` | Writes `dist-db/observatory.sqlite` so you can open the evidence in any SQLite tool |

`dist/` is a static site, so you can host it anywhere. Asset paths are relative, so it also works from a subfolder.

### Note on locked-down Windows machines

`package.json` uses npm `overrides` to swap Rollup and esbuild for their official WebAssembly builds (`@rollup/wasm-node`, `esbuild-wasm`). Vite then runs with **no native binaries**, so the project builds on machines where Smart App Control or another application-control policy blocks unsigned `.node`/`.exe` files. (That is why it's on Vite 7: Vite 8's bundler needs native binaries.) The project is small, so the speed cost is negligible. On an unrestricted machine you can delete the `overrides` block and reinstall if you want the native tools.

## How to play

1. Read the **Case** tab. It gives the date, place and type of crime.
2. Run the starting query. It lists the police reports from the morning of the murder.
3. Follow the witnesses into `people` and `interviews`, then check what they told you against the badge logs, loans and check-ins.
4. When one person fits all of the evidence, type their name into **Name the killer**.

Ctrl+Enter (⌘+Enter on a Mac) runs the query. If you highlight part of the editor, only that part runs. Hints unlock one at a time, and your notebook, history, hints and solved state are saved in this browser.

## Architecture

```
index.html              Page layout: case file, tables, hints, notebook, history, query desk
src/
  main.js               Wires the UI to the engine and saved state
  styles.css            All styling (CSS custom properties, no framework)
  case/
    seed.sql            THE CASE: schema plus every row of evidence (plain SQLite)
    case.js             Player-facing text: briefing, table notes, hints, starting query
    solution.js         Answer check and ending (spoilers)
  sql/
    engine.js           Pure SQL logic shared by the browser and the tests
    sql.worker.js       Web Worker that hosts sql.js and answers requests
    client.js           Main-thread wrapper: promises, 5 s timeout, restarts the worker
  state/storage.js      localStorage with validation and graceful fallback
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

Results are rendered with `textContent` only, so text in the database can never run as HTML.

### Saved progress

`state/storage.js` keeps one JSON object under the key `midnight-observatory/v1`: the draft query, history (last 50), notes, revealed hints and solved state. Every field is validated when it loads. If storage is blocked, the game runs in memory and says so. If the saved data is damaged, the game starts fresh and says so. **Start over** asks for confirmation, then clears everything and restarts the engine.

## Creating a new case

The case is data plus a little text, so a new mystery mostly means writing a new `seed.sql`.

1. **Design the answer first.** Decide the culprit, motive, method and timeline minute by minute. Then work backwards: what would each witness have seen, and which records would prove it?
2. **Plan the clue chain.** Report → witness → interview → matching records → corroboration → one suspect. Each step should hand the player a concrete filter (a time, a place, an item, a role). Make sure the filters overlap on exactly one person, and give each red herring a record that clears them. Never let a *missing* record be the only proof.
3. **Write `src/case/seed.sql`.** Keep the `YYYY-MM-DD HH:MM` time format so text comparison sorts correctly. Use stable IDs and never renumber existing rows. Add enough unrelated rows that filtering matters.
4. **Update `src/case/case.js`** with the briefing, table notes, starting query and three or four hints, ordered from idea to near-solution query. Don't name the culprit there.
5. **Update `src/case/solution.js`** with the culprit, nudges for likely wrong answers, and the ending.
6. **Update the tests.** `tests/data.test.js` checks data integrity in general. `tests/mystery.test.js` encodes this case's clue path, so rewrite it for your case. It's the fastest way to catch a clue that contradicts the data.
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
