// Engine tests: the same checks as the web game's tests/levels.test.js,
// run against real SQLite through the worker isolate.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:midnight_observatory/src/engine/session.dart';
import 'package:midnight_observatory/src/levels/catalog.dart';
import 'package:midnight_observatory/src/levels/solutions.dart';
import 'package:path/path.dart' as p;

void main() {
  // The worker changes the working directory (for VACUUM INTO), so read
  // every asset up front with absolute paths.
  final root = Directory.current.absolute.path;
  final catalog = Catalog.fromJson(File(p.join(root, 'assets', 'levels.json')).readAsStringSync());
  final scripts = <String, String>{};
  for (final level in catalog.levels) {
    for (final s in level.allScripts) {
      scripts[s] = File(p.join(root, 'assets', 'levels', s)).readAsStringSync();
    }
  }
  late Directory base;

  setUp(() => base = Directory.systemTemp.createTempSync('sqlgame-'));
  tearDown(() {
    Directory.current = root;
    try {
      base.deleteSync(recursive: true);
    } catch (_) {}
  });

  Future<LevelSession> session(String id, [String lang = 'en']) async {
    final s = LevelSession(level: catalog.byId(id), lang: lang, baseDir: base.path, read: (f) => scripts[f]!);
    await s.open();
    return s;
  }

  test('four levels, numbered 1 to 4', () {
    expect(catalog.levels.map((l) => l.number), [1, 2, 3, 4]);
  });

  test('every Academy answer passes its own check', () async {
    final s = await session('academy');
    for (final l in catalog.byId('academy').content('en').lessons) {
      final r = await s.run(l.answer!, lesson: l);
      expect(r.ok, isTrue, reason: '${l.id}: ${r.message}');
      expect(r.check?.passed, isTrue, reason: '${l.id}: ${r.check?.reason} ${r.check?.detail}');
    }
  });

  test('common mistakes fail with a reason', () async {
    final s = await session('academy');
    final lessons = catalog.byId('academy').content('en').lessons;
    final columns = lessons.firstWhere((l) => l.id == 'columns');
    var r = await s.run('SELECT * FROM suspects;', lesson: columns);
    expect(r.check?.reason, 'columnCount');
    final order = lessons.firstWhere((l) => l.id == 'order-by');
    r = await s.run('SELECT name, age FROM suspects ORDER BY age;', lesson: order);
    expect(r.check?.reason, 'order');
  });

  test('read-only levels refuse writes', () async {
    final s = await session('academy');
    final r = await s.run("DELETE FROM suspects;");
    expect(r.ok, isFalse);
    expect(r.message, contains('read-only'));
    final after = await s.run('SELECT COUNT(*) FROM suspects;');
    expect(after.rows.first.first, greaterThan(0));
  });

  test('friendly errors', () async {
    final s = await session('academy');
    expect((await s.run('SELECT * FROM nope;')).message, contains('no table called "nope"'));
    expect((await s.run('SELECT nme FROM suspects;')).message, contains('no column called "nme"'));
    expect((await s.run('-- just a comment')).message, contains('only contained comments'));
    expect((await s.run('SELECT 1; SELECT 2 AS two;')).columns, ['two']);
  });

  test('a runaway query times out and the engine keeps working', () async {
    final s = await session('academy');
    final sw = Stopwatch()..start();
    final r = await s.run(
      'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT COUNT(*) FROM c;',
      timeout: const Duration(seconds: 1),
    );
    expect(r.timeout, isTrue);
    expect(sw.elapsed, lessThan(const Duration(seconds: 4)));
    expect((await s.run('SELECT 1 AS one;')).rows, [
      [1],
    ]);
  });

  test('LIKE and lower() understand Cyrillic', () async {
    final s = await session('observatory', 'mn');
    final r = await s.run("SELECT COUNT(*) FROM access_logs WHERE location LIKE '%баруун%';");
    expect(r.rows.first.first, greaterThan(0));
    final u = await s.run("SELECT lower('БАРУУН') AS l;");
    expect(u.rows.first.first, 'баруун');
  });

  test('every case hint query runs and returns rows', () async {
    for (final id in ['observatory', 'coldcase']) {
      for (final lang in catalog.byId(id).hasLanguage('mn') ? ['en', 'mn'] : ['en']) {
        final s = await session(id, lang);
        final c = catalog.byId(id).content(lang);
        for (final sql in [c.startingQuery, ...c.hints.map((h) => h['sql']).whereType<String>()]) {
          final r = await s.run(sql);
          expect(r.ok, isTrue, reason: '$id/$lang: ${r.message}\n$sql');
          expect(r.rows, isNotEmpty, reason: '$id/$lang:\n$sql');
        }
      }
    }
  });

  test('every Tampered Evidence mission passes when done in order', () async {
    final s = await session('tampered');
    for (final l in catalog.byId('tampered').content('en').lessons.where((l) => !l.isReading)) {
      final r = await s.run(l.answer!, lesson: l, timeout: const Duration(seconds: 30));
      expect(r.ok, isTrue, reason: '${l.id}: ${r.message}');
      expect(r.check?.passed, isTrue,
          reason: '${l.id}: ${r.check?.reason} ${r.check?.message} ${r.check?.detail}');
    }
  });

  test('writable level: changes persist, transactions roll back, errors keep earlier statements', () async {
    var s = await session('tampered');
    await s.run("CREATE TABLE notes_t (x TEXT); INSERT INTO notes_t VALUES ('a');");
    s = await session('tampered'); // reopen: the snapshot survives
    expect((await s.run('SELECT COUNT(*) FROM notes_t;')).rows.first.first, 1);

    final rb = await s.run("BEGIN; INSERT INTO notes_t VALUES ('b');");
    expect(rb.rolledBack, isTrue);
    expect((await s.run('SELECT COUNT(*) FROM notes_t;')).rows.first.first, 1);

    final err = await s.run("INSERT INTO notes_t VALUES ('c'); SELECT * FROM missing_table;");
    expect(err.ok, isFalse);
    expect((await s.run('SELECT COUNT(*) FROM notes_t;')).rows.first.first, 2);

    final backup = await s.run('DELETE FROM backup.badge_scans;');
    final still = await s.run('SELECT COUNT(*) FROM backup.badge_scans;');
    expect(backup.ok && still.rows.first.first == 0, isFalse, reason: 'the backup is rebuilt every run');

    s.resetDatabase();
    expect((await s.run('SELECT COUNT(*) FROM notes_t;')).ok, isFalse);
  });

  test('writable level: VACUUM INTO writes a file and never overwrites', () async {
    final s = await session('tampered');
    final r = await s.run("VACUUM INTO 'copy.db';");
    expect(r.ok, isTrue, reason: r.message);
    expect(r.files.single, endsWith('copy.db'));
    expect(File(r.files.single).existsSync(), isTrue);
    final again = await s.run("VACUUM INTO 'copy.db';");
    expect(again.message, contains('already exists'));
  });

  test('a trigger body with semicolons runs as one statement', () async {
    final s = await session('tampered');
    final r = await s.run('''
CREATE TABLE t (x);
CREATE TRIGGER t_guard BEFORE DELETE ON t BEGIN
  SELECT RAISE(ABORT, 'no');
END;
INSERT INTO t VALUES (1);
SELECT COUNT(*) AS n FROM t;''');
    expect(r.ok, isTrue, reason: r.message);
    expect(r.statementCount, 4);
    expect(r.rows.first.first, 1);
  });

  test('accusations', () {
    expect(judgeAccusation('observatory', 'Dr. Corin Ashdown', true, 'en').correct, isTrue);
    expect(judgeAccusation('observatory', 'корин эшдаун', true, 'mn').correct, isTrue);
    expect(judgeAccusation('observatory', 'Felix Ward', true, 'en').message, startsWith('Not quite.'));
    expect(judgeAccusation('observatory', 'Nobody Here', false, 'en').kind, 'unknown');
    expect(judgeAccusation('observatory', '  ', false, 'en').kind, 'empty');
    expect(judgeAccusation('coldcase', 'margo  ELLERY', true, 'en').correct, isTrue);
    expect(judgeAccusation('coldcase', 'Dov Pereira', true, 'en').kind, 'wrong');
  });

  test('the person lookup finds real people only', () async {
    final s = await session('coldcase');
    expect(await s.findPerson('margo ellery'), isTrue);
    expect(await s.findPerson('nobody at all'), isFalse);
  });
}
