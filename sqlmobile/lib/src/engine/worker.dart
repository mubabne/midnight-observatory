// Runs SQL jobs in a short-lived isolate so the UI never freezes.
//
// A slow query can't be stopped by killing its isolate, because the isolate
// is busy inside native SQLite code. So the worker sends the native handle of
// the player's connection to the UI isolate, which can call
// sqlite3_interrupt() on it (that call is thread-safe). To make sure the
// handle is never used after the connection closes, the worker asks the UI
// for permission ("gate") before it closes that connection.
import 'dart:async';
import 'dart:ffi';
import 'dart:io';
import 'dart:isolate';

import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';

import 'checks.dart';
import 'engine.dart';

const Duration queryTimeout = Duration(seconds: 5);

/// Runs one job in a fresh isolate. Returns the worker's result map, or
/// {'ok': false, 'timeout': true} if it ran past [timeout].
Future<Map<String, Object?>> runJob(Map<String, Object?> job, {Duration? timeout}) async {
  final port = ReceivePort();
  final done = Completer<Map<String, Object?>>();
  SendPort? workerPort;
  int? handle;
  var interruptAllowed = false;
  var timedOut = false;
  Timer? timer;
  Timer? killTimer;
  Isolate? isolate;

  void finish(Map<String, Object?> result) {
    if (done.isCompleted) return;
    timer?.cancel();
    killTimer?.cancel();
    port.close();
    done.complete(result);
  }

  port.listen((msg) {
    if (msg is Map) {
      switch (msg['kind']) {
        case 'port':
          workerPort = msg['port'] as SendPort;
        case 'handle':
          handle = msg['value'] as int;
          interruptAllowed = true;
        case 'gate':
          interruptAllowed = false;
          workerPort?.send('release');
        case 'result':
          final result = Map<String, Object?>.from(msg['value'] as Map);
          if (timedOut && result['interrupted'] == true) {
            finish({'ok': false, 'timeout': true});
          } else {
            finish(result);
          }
      }
    } else if (msg is List) {
      finish({'ok': false, 'message': msg.isNotEmpty ? '${msg.first}' : 'Worker failed'});
    } else if (msg == null) {
      finish({'ok': false, 'message': 'The SQL engine stopped unexpectedly.'});
    }
  });

  isolate = await Isolate.spawn(_workerMain, [port.sendPort, job], onError: port.sendPort, onExit: port.sendPort);
  if (timeout != null) {
    timer = Timer(timeout, () {
      timedOut = true;
      final h = handle;
      if (interruptAllowed && h != null) {
        sqlite3.fromPointer(Pointer<Void>.fromAddress(h), borrowed: true).interrupt();
      }
      // If SQLite doesn't stop in time, give up on the isolate.
      killTimer = Timer(const Duration(seconds: 2), () {
        isolate?.kill(priority: Isolate.immediate);
        finish({'ok': false, 'timeout': true});
      });
    });
  }
  return done.future;
}

Future<void> _workerMain(List<Object?> args) async {
  final out = args[0] as SendPort;
  final job = Map<String, Object?>.from(args[1] as Map);
  final inbox = ReceivePort();
  out.send({'kind': 'port', 'port': inbox.sendPort});
  final releases = StreamIterator(inbox);
  final worker = _Worker(
    job,
    onHandle: (h) => out.send({'kind': 'handle', 'value': h}),
    gate: () async {
      out.send({'kind': 'gate'});
      await releases.moveNext();
    },
  );
  Map<String, Object?> result;
  try {
    result = await worker.run();
  } on FriendlyError catch (e) {
    result = {'ok': false, 'message': e.message, 'detail': e.detail, 'interrupted': e.interrupted};
  } catch (e) {
    result = {'ok': false, 'message': e.toString()};
  }
  out.send({'kind': 'result', 'value': result});
  inbox.close();
}

class _Worker {
  _Worker(this.job, {required this.onHandle, required this.gate});

  final Map<String, Object?> job;
  final void Function(int handle) onHandle;
  final Future<void> Function() gate;

  String get lang => (job['lang'] as String?) ?? 'en';
  bool get writable => job['writable'] == true;
  String? get attachSql => job['attachSql'] as String?;
  String get startPath => job['startPath'] as String;
  String get currentPath => (job['currentPath'] as String?) ?? startPath;

  Future<Map<String, Object?>> run() async {
    switch (job['type']) {
      case 'build':
        return _build();
      case 'schema':
        return {'ok': true, 'schema': _schema(currentPath)};
      case 'validate':
        try {
          final db = sqlite3.open(currentPath, mode: OpenMode.readOnly);
          try {
            db.select('SELECT COUNT(*) FROM sqlite_schema;');
          } finally {
            db.close();
          }
          return {'ok': true};
        } catch (_) {
          return {'ok': false};
        }
      case 'findPerson':
        return {
          'ok': true,
          'exists': personExists(startPath, job['name'] as String, job['lookup'] as String),
        };
      case 'run':
        return writable ? _runWritable() : _runReadOnly();
    }
    throw StateError('Unknown job ${job['type']}');
  }

  Map<String, Object?> _build() {
    final targets = (job['targets'] as List).cast<Map>();
    for (final t in targets) {
      final path = t['path'] as String;
      if (File(path).existsSync()) continue;
      Directory(p.dirname(path)).createSync(recursive: true);
      buildDatabaseFile(path, (t['scripts'] as List).cast<String>());
    }
    return {'ok': true};
  }

  Database _open(String path) => openDb(path, readOnly: !writable, attachSql: attachSql);

  QueryOutput Function(String) _query(String path) => (sql) {
        final db = _open(path);
        try {
          return selectAll(db, sql);
        } finally {
          db.close();
        }
      };

  List<Map<String, Object?>> _schema(String path) {
    final db = sqlite3.open(path, mode: OpenMode.readOnly);
    try {
      return describeSchema(db);
    } finally {
      db.close();
    }
  }

  /// Opens the player's connection, runs their SQL, and closes it only
  /// after the UI has stopped being allowed to interrupt it.
  Future<(QueryOutput?, FriendlyError?, bool rolledBack, int changes)> _runOn(Database db, String sql) async {
    QueryOutput? output;
    FriendlyError? failure;
    var rolledBack = false;
    var changes = 0;
    try {
      onHandle(db.handle.address);
      final before = writable ? totalChanges(db) : 0;
      try {
        output = execute(db, sql, lang: lang);
      } on FriendlyError catch (e) {
        failure = e;
      }
      if (writable) {
        try {
          db.execute('ROLLBACK;');
          rolledBack = true; // only succeeds if the run left a transaction open
        } catch (_) {
          // no open transaction: nothing to undo
        }
        changes = rolledBack ? 0 : totalChanges(db) - before;
      }
    } finally {
      await gate();
      db.close();
    }
    return (output, failure, rolledBack, changes);
  }

  Map<String, Object?> _resultMap(QueryOutput out, Stopwatch sw) => {
        'ok': true,
        'columns': out.columns,
        'rows': out.rows,
        'truncated': out.truncated,
        'statementCount': out.statementCount,
        'producedRows': out.producedRows,
        'elapsedMs': sw.elapsedMilliseconds,
      };

  String get _sql {
    final sql = job['sql'] as String? ?? '';
    if (sql.trim().isEmpty) throw FriendlyError((engineMessages[lang] ?? engineMessages['en']!).empty);
    return sql;
  }

  Future<Map<String, Object?>> _runReadOnly() async {
    final sql = _sql;
    final sw = Stopwatch()..start();
    final (out, failure, _, _) = await _runOn(openDb(startPath), sql);
    if (failure != null) throw failure;
    final result = _resultMap(out!, sw);
    _grade(result, sql, out, const []);
    return result;
  }

  Future<Map<String, Object?>> _runWritable() async {
    final sql = _sql;
    final msg = engineMessages[lang] ?? engineMessages['en']!;
    final workDir = job['workDir'] as String;
    final filesDir = job['filesDir'] as String;
    final snapshotPath = job['snapshotPath'] as String;
    Directory(workDir).createSync(recursive: true);
    Directory(filesDir).createSync(recursive: true);
    Directory(p.dirname(snapshotPath)).createSync(recursive: true);
    // VACUUM INTO 'name.db' writes relative to the working directory.
    Directory.current = filesDir;

    final work = p.join(workDir, 'run-${DateTime.now().microsecondsSinceEpoch}.sqlite');
    File(currentPath).copySync(work);
    final sw = Stopwatch()..start();
    final (out, failure, rolledBack, changes) =
        await _runOn(openDb(work, readOnly: false, attachSql: attachSql), sql);

    void discard() {
      for (final suffix in ['', '-journal', '-wal', '-shm']) {
        final f = File('$work$suffix');
        if (f.existsSync()) f.deleteSync();
      }
    }

    if (failure != null && failure.interrupted) {
      discard();
      throw failure;
    }
    if (File(work).lengthSync() > maxDbBytes) {
      discard();
      throw FriendlyError(msg.tooBig(maxDbBytes ~/ 1024 ~/ 1024));
    }
    // Statements before a failing one still count, as in SQLite.
    File(work).renameSync(snapshotPath);
    if (failure != null) {
      return {
        'ok': false,
        'message': failure.message,
        'detail': failure.detail,
        'snapshotWritten': true,
        'schema': _schema(snapshotPath),
      };
    }

    final files = <String>[];
    for (final name in vacuumTargets(sql)) {
      final path = p.isAbsolute(name) ? name : p.join(filesDir, name);
      if (!File(path).existsSync()) continue;
      try {
        final db = sqlite3.open(path, mode: OpenMode.readOnly);
        try {
          final n = db.select("SELECT COUNT(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%';");
          if ((n.first.values.first as int) > 0) files.add(path);
        } finally {
          db.close();
        }
      } catch (_) {
        // not a readable database: skip it
      }
    }

    final result = _resultMap(out!, sw)
      ..['changes'] = changes
      ..['rolledBack'] = rolledBack
      ..['snapshotWritten'] = true
      ..['files'] = files
      ..['schema'] = _schema(snapshotPath);
    _grade(result, sql, out, files, statePath: snapshotPath, workDir: workDir);
    return result;
  }

  void _grade(Map<String, Object?> result, String sql, QueryOutput out, List<String> files,
      {String? statePath, String? workDir}) {
    final check = job['check'];
    if (check is! Map || check['type'] == 'read') return;
    final state = statePath ?? startPath;
    final ctx = CheckContext(
      result: out,
      sql: sql,
      reference: _query(startPath),
      state: _query(state),
      attempt: (statement) {
        final tmp = p.join(workDir ?? Directory.systemTemp.path,
            'attempt-${DateTime.now().microsecondsSinceEpoch}.sqlite');
        File(state).copySync(tmp);
        try {
          final db = openDb(tmp, readOnly: false, attachSql: attachSql);
          try {
            db.execute(statement);
            return null;
          } catch (e) {
            return e.toString();
          } finally {
            db.close();
          }
        } finally {
          File(tmp).deleteSync();
        }
      },
      files: [for (final f in files) _query(f)],
    );
    final verdict = evaluateCheck(Map<String, dynamic>.from(check), ctx);
    result['check'] = {'lessonId': job['lessonId'], ...verdict.toMap()};
  }
}
