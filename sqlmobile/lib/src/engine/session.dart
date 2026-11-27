// One level's database plus everything around a run. No Flutter imports, so
// the tests drive exactly the same code as the app.
import 'dart:io';

import 'package:path/path.dart' as p;

import '../levels/catalog.dart';
import 'engine.dart' show renderTemplate;
import 'worker.dart';

/// Bump when the seed files change, so old built databases are rebuilt.
const int dbVersion = 1;

class TableInfo {
  TableInfo(Map m)
      : name = m['name'] as String,
        isView = m['kind'] == 'view',
        rowCount = m['rowCount'] as int?,
        columns = [for (final c in (m['columns'] as List)) ColumnInfo(c as Map)];
  final String name;
  final bool isView;
  final int? rowCount;
  final List<ColumnInfo> columns;
}

class ColumnInfo {
  ColumnInfo(Map m)
      : name = m['name'] as String,
        type = (m['type'] as String).toLowerCase(),
        primaryKey = m['primaryKey'] == true,
        references = m['references'] as String?;
  final String name;
  final String type;
  final bool primaryKey;
  final String? references;
}

class CheckVerdict {
  CheckVerdict(Map m)
      : lessonId = m['lessonId'] as String?,
        passed = m['passed'] == true,
        reason = m['reason'] as String?,
        detail = Map<String, Object?>.from((m['detail'] as Map?) ?? const {}),
        message = m['message'] as String?;
  final String? lessonId;
  final bool passed;
  final String? reason;
  final Map<String, Object?> detail;
  final String? message;
}

class RunResult {
  RunResult(Map<String, Object?> m)
      : ok = m['ok'] == true,
        timeout = m['timeout'] == true,
        message = m['message'] as String?,
        detail = m['detail'] as String?,
        columns = ((m['columns'] as List?) ?? const []).cast<String>(),
        rows = [for (final r in (m['rows'] as List?) ?? const []) List<Object?>.from(r as List)],
        truncated = m['truncated'] == true,
        statementCount = (m['statementCount'] as int?) ?? 0,
        producedRows = m['producedRows'] == true,
        elapsedMs = (m['elapsedMs'] as int?) ?? 0,
        changes = (m['changes'] as int?) ?? 0,
        rolledBack = m['rolledBack'] == true,
        files = ((m['files'] as List?) ?? const []).cast<String>(),
        schema = m['schema'] == null ? null : [for (final t in m['schema'] as List) TableInfo(t as Map)],
        check = m['check'] == null ? null : CheckVerdict(m['check'] as Map);

  final bool ok;
  final bool timeout;
  final String? message;
  final String? detail;
  final List<String> columns;
  final List<List<Object?>> rows;
  final bool truncated;
  final int statementCount;
  final bool producedRows;
  final int elapsedMs;
  final int changes;
  final bool rolledBack;
  final List<String> files;
  final List<TableInfo>? schema;
  final CheckVerdict? check;
}

/// Reads a level script by its path relative to assets/levels/.
typedef ScriptReader = String Function(String path);

class LevelSession {
  LevelSession({required this.level, required this.lang, required this.baseDir, required this.read});

  final LevelDef level;
  final String lang;
  final String baseDir;
  final ScriptReader read;

  /// Set when a saved database could not be read and was thrown away.
  bool snapshotRejected = false;

  String get startPath => p.join(baseDir, 'db', 'v$dbVersion', '${level.id}-${level.dbLang(lang)}.sqlite');
  String get snapshotPath => p.join(baseDir, 'snapshots', '${level.id}.sqlite');
  String get workDir => p.join(baseDir, 'work');

  /// Where VACUUM INTO writes. Cleared when the session opens or resets.
  String get filesDir => p.join(baseDir, 'files', level.id);

  String get currentPath => level.writable && File(snapshotPath).existsSync() ? snapshotPath : startPath;

  String? get attachSql {
    if (level.database['backup'] != true) return null;
    final seed = read('${level.id}/${level.database['seed']}');
    return "ATTACH DATABASE ':memory:' AS backup;\n${renderTemplate(seed, 'backup')}";
  }

  List<String> _scripts() {
    final paths = level.scriptsFor(lang);
    return [
      for (final (i, path) in paths.indexed)
        i == 0 && level.database['template'] == true ? renderTemplate(read(path), 'main') : read(path),
    ];
  }

  Map<String, Object?> get _base => {
        'lang': lang,
        'writable': level.writable,
        'attachSql': attachSql,
        'startPath': startPath,
        'currentPath': currentPath,
      };

  /// Builds the starting database if needed and checks a saved snapshot.
  Future<void> open() async {
    final built = await runJob({
      'type': 'build',
      'targets': [
        {'path': startPath, 'scripts': _scripts()},
      ],
    });
    if (built['ok'] != true) throw StateError('${built['message']}');
    _clearFiles();
    if (level.writable && File(snapshotPath).existsSync()) {
      final valid = await runJob({..._base, 'type': 'validate', 'currentPath': snapshotPath});
      if (valid['ok'] != true) {
        File(snapshotPath).deleteSync();
        snapshotRejected = true;
      }
    }
  }

  Future<List<TableInfo>> schema() async {
    final r = await runJob({..._base, 'type': 'schema'});
    if (r['ok'] != true) throw StateError('${r['message']}');
    return [for (final t in r['schema'] as List) TableInfo(t as Map)];
  }

  Future<RunResult> run(String sql, {Lesson? lesson, Duration? timeout = queryTimeout}) async {
    final r = await runJob({
      ..._base,
      'type': 'run',
      'sql': sql,
      'snapshotPath': snapshotPath,
      'workDir': workDir,
      'filesDir': filesDir,
      'lessonId': lesson?.id,
      'check': lesson?.check,
    }, timeout: timeout);
    return RunResult(r);
  }

  Future<bool> findPerson(String normalizedName) async {
    final lookup = level.personLookup;
    if (lookup == null) return false;
    final r = await runJob({..._base, 'type': 'findPerson', 'name': normalizedName, 'lookup': lookup});
    return r['ok'] != true || r['exists'] == true; // engine hiccup: fall back to "exists"
  }

  /// Throws the writable database away and starts from the level's data again.
  void resetDatabase() {
    final f = File(snapshotPath);
    if (f.existsSync()) f.deleteSync();
    _clearFiles();
  }

  /// Empties the VACUUM INTO folder. It may be the working directory, which
  /// Windows refuses to delete, so the folder itself stays.
  void _clearFiles() {
    final dir = Directory(filesDir);
    if (!dir.existsSync()) return;
    for (final e in dir.listSync()) {
      try {
        e.deleteSync(recursive: true);
      } catch (_) {}
    }
  }
}
