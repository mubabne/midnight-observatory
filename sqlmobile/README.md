# SQL Detective (mobile)

The Flutter version of [Midnight at the Observatory](../sqlweb): the same four levels, from your first `SELECT` to restoring a tampered database, played on a phone. Every query runs on real SQLite on the device, with no network and no accounts.

| Level | Format |
| --- | --- |
| 1 · The Academy | 13 guided lessons, each checked automatically |
| 2 · Midnight at the Observatory | Murder case across six tables (English and Mongolian) |
| 3 · The Millrace Poisonings | Cold case: `GROUP BY`, CTEs, `LEAD() OVER`, anti-joins |
| 4 · Tampered Evidence | 11 missions on a **writable** database with last night's backup attached |

## Run it

```bash
flutter pub get
flutter run            # on a connected phone or emulator
flutter test           # engine tests: every lesson answer, every Level 4 mission, timeouts, Cyrillic LIKE
flutter build apk --debug
```

**Windows note.** Smart App Control on the development PC blocks unsigned native files. That has two effects:

- `flutter test` loads SQLite from Windows' own signed `winsqlite3.dll`. The `hooks` block in `pubspec.yaml` sets this up, and it only applies on Windows. Phones use the SQLite build bundled by `package:sqlite3`.
- Release builds (`flutter build apk --release`) need Flutter's `gen_snapshot.exe`, which Smart App Control blocks. Debug builds work. For a release build, use a machine without that policy, or allow the Flutter SDK folder.

## How it works

```
lib/
  main.dart                 App entry, theme
  src/engine/
    engine.dart             SQL logic ported from sqlweb/src/sql/engine.js: statement-by-statement
                            execution, Unicode LIKE/lower/upper, friendly errors, schema, VACUUM INTO targets
    checks.dart             Lesson grading (ported from checks.js)
    worker.dart             Runs each job in its own isolate, with a 5 s timeout
    session.dart            One level's database files, runs and resets (no Flutter imports, so tests use it)
  src/levels/
    catalog.dart            Reads assets/levels.json
    solutions.dart          Case culprits and nudges (spoilers)
  src/state/                Saved progress (shared_preferences) and the screen controllers
  src/ui/                   Home, level screen and its tabs (Lessons/Case, Query, Tables, Hints, Notes)
assets/
  levels.json, levels/      Level text and seed SQL, exported from the web game
tool/                       Scripts that regenerate assets and icons
```

- **Read-only levels** open the level's database file with SQLite's read-only flag plus `PRAGMA query_only`, so no query can change the evidence.
- **Level 4** copies the saved database for each run, attaches an in-memory `backup` rebuilt from the seed, runs the player's SQL, rolls back any open transaction, and keeps the result as the new snapshot (up to 4 MB). Files written with `VACUUM INTO` can be shared from the Lessons tab.
- **Timeouts.** A slow query can't be stopped by killing its isolate, because the isolate is inside native SQLite code. So the worker hands the connection's native handle to the UI isolate, which calls `sqlite3_interrupt()`. A handshake makes sure the connection is still open when that happens.
- The Query tab has a row of SQL keywords and table names you can tap to insert, because SQL is slow to type on a phone keyboard.

## Updating content from the web game

The level text, lessons, hints and seed SQL come from `../sqlweb/src/levels`. After changing them there:

```bash
node tool/dump-levels.mjs ../sqlweb assets
```

If a seed file changed, also bump `dbVersion` in `lib/src/engine/session.dart` so phones rebuild their databases. The culprits and nudges are code in the web game, so port any changes to `lib/src/levels/solutions.dart` by hand.

To regenerate the launcher icons from the SVG master:

```bash
npm install --prefix tool --no-save @resvg/resvg-wasm@2.6.2
node tool/make-icons.mjs ../../app-icons/sql/app-icon.svg .
```
