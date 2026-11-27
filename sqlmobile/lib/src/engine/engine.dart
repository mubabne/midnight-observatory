// Pure SQL logic, ported from the web game's src/sql/engine.js.
// Runs inside a worker isolate (see worker.dart) and in the tests.
import 'dart:io';

import 'package:sqlite3/sqlite3.dart';

const int maxRows = 200;

/// A writable level's database may not grow past this.
const int maxDbBytes = 4 * 1024 * 1024;

/// An error the player can act on. [detail] keeps SQLite's own words.
class FriendlyError implements Exception {
  FriendlyError(this.message, [this.detail]);
  final String message;
  final String? detail;
  bool interrupted = false;

  @override
  String toString() => message;
}

/// The last result set of a run.
class QueryOutput {
  QueryOutput({
    required this.columns,
    required this.rows,
    required this.truncated,
    required this.statementCount,
    required this.producedRows,
  });

  final List<String> columns;
  final List<List<Object?>> rows;
  final bool truncated;
  final int statementCount;
  final bool producedRows;
}

/// Opens a database file.
/// [attachSql] runs first (Level 4 uses it to attach an in-memory backup).
/// [readOnly] opens the file read-only and turns on query_only, so SQLite
/// itself refuses any write. The game never inspects the SQL text to decide
/// what is allowed.
Database openDb(String path, {bool readOnly = true, String? attachSql}) {
  final db = sqlite3.open(path, mode: readOnly ? OpenMode.readOnly : OpenMode.readWrite);
  try {
    registerUnicodeFunctions(db);
    if (attachSql != null) db.execute(attachSql);
    if (readOnly) db.execute('PRAGMA query_only = ON;');
  } catch (_) {
    db.close();
    rethrow;
  }
  return db;
}

/*
 * SQLite's built-in LIKE, lower() and upper() only understand ASCII letters,
 * so LIKE '%баруун%' would not match 'Баруун бөмбөгөр'. Dart versions make
 * them work for Cyrillic (and every other script) and behave the same for
 * English text.
 */
final Map<String, RegExp> _likeCache = {};

RegExp likeToRegExp(String pattern, [String? escape]) {
  final key = '${escape ?? ''}\u0000$pattern';
  final cached = _likeCache[key];
  if (cached != null) return cached;
  final buf = StringBuffer('^');
  final chars = pattern.runes.map(String.fromCharCode).toList();
  final esc = (escape != null && escape.isNotEmpty) ? escape : null;
  for (var i = 0; i < chars.length; i++) {
    final ch = chars[i];
    if (esc != null && ch == esc && i + 1 < chars.length) {
      buf.write(RegExp.escape(chars[++i]));
    } else if (ch == '%') {
      buf.write('.*');
    } else if (ch == '_') {
      buf.write('.');
    } else {
      buf.write(RegExp.escape(ch));
    }
  }
  buf.write(r'$');
  final re = RegExp(buf.toString(), caseSensitive: false, dotAll: true, unicode: true);
  if (_likeCache.length > 500) _likeCache.clear();
  _likeCache[key] = re;
  return re;
}

String _text(Object v) {
  if (v is double && v.isFinite && v == v.truncateToDouble() && v.abs() < 1e15) {
    return v.toStringAsFixed(1);
  }
  return v.toString();
}

void registerUnicodeFunctions(Database db) {
  // like(pattern, value) is what SQLite calls for "value LIKE pattern".
  // directOnly is off so views and triggers the player writes can use them.
  db.createFunction(
    functionName: 'like',
    argumentCount: const AllowedArgumentCount(2),
    deterministic: true,
    directOnly: false,
    function: (args) {
      final p = args[0], v = args[1];
      if (p == null || v == null) return null;
      return likeToRegExp(_text(p)).hasMatch(_text(v)) ? 1 : 0;
    },
  );
  db.createFunction(
    functionName: 'like',
    argumentCount: const AllowedArgumentCount(3),
    deterministic: true,
    directOnly: false,
    function: (args) {
      final p = args[0], v = args[1], e = args[2];
      if (p == null || v == null) return null;
      return likeToRegExp(_text(p), e == null ? null : _text(e)).hasMatch(_text(v)) ? 1 : 0;
    },
  );
  db.createFunction(
    functionName: 'lower',
    argumentCount: const AllowedArgumentCount(1),
    deterministic: true,
    directOnly: false,
    function: (args) => args[0] == null ? null : _text(args[0]!).toLowerCase(),
  );
  db.createFunction(
    functionName: 'upper',
    argumentCount: const AllowedArgumentCount(1),
    deterministic: true,
    directOnly: false,
    function: (args) => args[0] == null ? null : _text(args[0]!).toUpperCase(),
  );
}

/// True when [s] holds only whitespace, semicolons and *closed* comments.
bool _onlyTrivia(String s) {
  var i = 0;
  while (i < s.length) {
    final c = s[i];
    if (c == ';' || c.trim().isEmpty) {
      i++;
    } else if (s.startsWith('--', i)) {
      final nl = s.indexOf('\n', i);
      if (nl < 0) return true;
      i = nl + 1;
    } else if (s.startsWith('/*', i)) {
      final end = s.indexOf('*/', i + 2);
      if (end < 0) return false;
      i = end + 2;
    } else {
      return false;
    }
  }
  return true;
}

/// Where the compiled statement [stmtSql] ends inside [rest].
int _consumed(String rest, String stmtSql) {
  var from = 0;
  while (true) {
    final p = rest.indexOf(stmtSql, from);
    if (p < 0) return stmtSql.length.clamp(1, rest.length);
    if (p == 0 || _onlyTrivia(rest.substring(0, p))) return p + stmtSql.length;
    from = p + 1;
  }
}

/// Steps through every statement one at a time (so a statement can use a
/// table an earlier one created) and keeps the last result set.
QueryOutput execute(Database db, String sqlText, {int rowLimit = maxRows, String lang = 'en'}) {
  final msg = engineMessages[lang] ?? engineMessages['en']!;
  var statementCount = 0;
  List<String>? lastColumns;
  List<List<Object?>> lastRows = const [];
  var lastTruncated = false;
  var rest = sqlText;
  try {
    while (rest.isNotEmpty) {
      final PreparedStatement stmt;
      try {
        stmt = db.prepare(rest);
      } on ArgumentError {
        break; // only whitespace or comments left
      }
      rest = rest.substring(_consumed(rest, stmt.sql));
      statementCount++;
      try {
        final cursor = stmt.selectCursor();
        final rows = <List<Object?>>[];
        var truncated = false;
        while (cursor.moveNext()) {
          if (rows.length >= rowLimit) {
            truncated = true;
            break;
          }
          rows.add(List<Object?>.of(cursor.current.values));
        }
        final columns = cursor.columnNames;
        if (columns.isNotEmpty) {
          lastColumns = List.of(columns);
          lastRows = rows;
          lastTruncated = truncated;
        }
      } finally {
        stmt.close();
      }
    }
  } catch (err) {
    throw translateError(err, lang);
  }
  if (statementCount == 0) throw FriendlyError(msg.onlyComments);
  return QueryOutput(
    columns: lastColumns ?? const [],
    rows: lastRows,
    truncated: lastTruncated,
    statementCount: statementCount,
    producedRows: lastColumns != null,
  );
}

/// Runs a query with no row cap, for checks and tests.
QueryOutput selectAll(Database db, String sql) => execute(db, sql, rowLimit: 1 << 30);

int totalChanges(Database db) => db.select('SELECT total_changes();').first.values.first as int;

/// Finds the files a script asks VACUUM INTO to write. Comments are ignored.
List<String> vacuumTargets(String sqlText) {
  final code = sqlText
      .replaceAll(RegExp(r'/\*[\s\S]*?\*/'), ' ')
      .replaceAll(RegExp(r'--[^\n]*'), ' ');
  final names = <String>[];
  final re = RegExp(r"\bVACUUM\b(?:\s+[A-Za-z_]\w*)?\s+INTO\s+'((?:[^']|'')+)'", caseSensitive: false);
  for (final m in re.allMatches(code)) {
    final name = m.group(1)!.replaceAll("''", "'");
    if (!names.contains(name)) names.add(name);
  }
  return names;
}

/// Reads the live schema so the Tables tab can never drift from the data.
List<Map<String, Object?>> describeSchema(Database db) {
  final tables = db.select(
    "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, rowid;",
  );
  return [
    for (final t in tables)
      () {
        final name = t['name'] as String;
        final q = name.replaceAll("'", "''");
        final cols = db.select('SELECT name, type, pk, "notnull" FROM pragma_table_info(\'$q\');');
        final fks = db.select('SELECT "from", "table", "to" FROM pragma_foreign_key_list(\'$q\');');
        int? count;
        try {
          count = db.select('SELECT COUNT(*) FROM "${name.replaceAll('"', '""')}";').first.values.first as int;
        } catch (_) {
          count = null; // a broken view (e.g. it names a dropped table)
        }
        final fkMap = {for (final f in fks) f['from'] as String: '${f['table']}.${f['to']}'};
        return <String, Object?>{
          'name': name,
          'kind': t['type'],
          'rowCount': count,
          'columns': [
            for (final c in cols)
              {
                'name': c['name'],
                'type': ((c['type'] as String?) ?? '').isEmpty ? 'ANY' : c['type'],
                'primaryKey': (c['pk'] as int) > 0,
                'references': fkMap[c['name']],
              },
          ],
        };
      }(),
  ];
}

/// Parameterised lookup used by the accusation form (never string-built SQL).
bool personExists(String dbPath, String normalizedName, String lookupSql) {
  final db = openDb(dbPath);
  try {
    final stmt = db.prepare(lookupSql);
    try {
      return stmt.selectWith(StatementParameters.named({':name': normalizedName})).isNotEmpty;
    } finally {
      stmt.close();
    }
  } finally {
    db.close();
  }
}

/// Seeds written as templates use {{db}} for the schema name.
String renderTemplate(String sql, String schema) => sql.replaceAll('{{db}}', schema);

/// Builds a level's starting database file from its SQL scripts.
void buildDatabaseFile(String path, List<String> scripts) {
  final tmp = File('$path.building');
  if (tmp.existsSync()) tmp.deleteSync();
  final db = sqlite3.open(tmp.path);
  try {
    for (final s in scripts) {
      db.execute(s);
    }
  } finally {
    db.close();
  }
  tmp.renameSync(path);
}

class EngineMessages {
  const EngineMessages({
    required this.empty,
    required this.onlyComments,
    required this.readOnly,
    required this.tooBig,
    required this.fileExists,
    required this.noTable,
    required this.noColumn,
    required this.ambiguous,
    required this.incomplete,
    required this.near,
    required this.token,
  });
  final String empty, onlyComments, readOnly, fileExists, incomplete, token;
  final String Function(int mb) tooBig;
  final String Function(String t) noTable, noColumn, ambiguous, near;
}

final Map<String, EngineMessages> engineMessages = {
  'en': EngineMessages(
    empty: 'Type a query first. Open the Tables tab to see what you can SELECT from.',
    onlyComments: 'That only contained comments. Add a statement to run.',
    readOnly:
        'This database is read-only. Investigate with SELECT (or WITH … SELECT) queries; INSERT, UPDATE, DELETE, CREATE and DROP are blocked here. Level 4 (Tampered Evidence) is the level where you can change data.',
    tooBig: (mb) =>
        'That run made the database bigger than $mb MB, so its changes were thrown away. Check for an INSERT that copies far more rows than you meant.',
    fileExists:
        "A file with that name already exists in this session. VACUUM INTO never overwrites, so pick a new name, like 'archive-2.db'.",
    noTable: (t) => 'There is no table called "$t". Check the Tables tab for exact names.',
    noColumn: (c) =>
        'There is no column called "$c" in the tables you are querying. Check spelling, or prefix it with the table name when joining.',
    ambiguous: (c) =>
        '"$c" exists in more than one joined table. Write it as table.${c.split('.').last} so SQLite knows which one you mean.',
    incomplete: 'The query ends too early. Look for a missing closing bracket, quote or clause.',
    near: (t) => 'SQLite got confused near "$t". Check the spelling and punctuation around it.',
    token: "There is an unclosed quote or a stray character. Text values go in single quotes, like 'West Dome'.",
  ),
  'mn': EngineMessages(
    empty: 'Эхлээд асуулга бичнэ үү. Жишээ нь: SELECT * FROM people;',
    onlyComments: 'Зөвхөн тайлбар (comment) байна. Ажиллуулах команд нэмнэ үү.',
    readOnly:
        'Нотлох баримтын сан зөвхөн уншигдана. SELECT (эсвэл WITH … SELECT) асуулгаар мөрдөөрэй; INSERT, UPDATE, DELETE, CREATE, DROP хориглогдсон.',
    tooBig: (mb) =>
        'Энэ ажиллуулалт өгөгдлийн санг $mb MB-аас томруулсан тул өөрчлөлтийг хаялаа. Хэт олон мөр хуулсан INSERT байгаа эсэхийг шалгаарай.',
    fileExists:
        "Ийм нэртэй файл энэ сессэд аль хэдийн байна. VACUUM INTO дарж бичдэггүй тул 'archive-2.db' гэх мэт шинэ нэр сонгоорой.",
    noTable: (t) => '"$t" нэртэй хүснэгт байхгүй. Зөв нэрийг «Хүснэгт» хэсгээс харна уу.',
    noColumn: (c) =>
        'Асууж буй хүснэгтүүдэд "$c" нэртэй багана алга. Бичлэгээ шалгах эсвэл JOIN хийхдээ өмнө нь хүснэгтийн нэрийг бичээрэй.',
    ambiguous: (c) =>
        '"$c" багана JOIN хийсэн хэд хэдэн хүснэгтэд байна. Аль нь болохыг SQLite мэдэхийн тулд хүснэгт.${c.split('.').last} гэж бичээрэй.',
    incomplete: 'Асуулга дутуу дууссан байна. Хаалт, хашилт эсвэл хэсэг дутсан эсэхийг шалгаарай.',
    near: (t) => 'SQLite "$t"-ийн орчимд ойлгохгүй байна. Тэр хавийн бичлэг, цэг таслалыг шалгаарай.',
    token: "Хаагдаагүй хашилт эсвэл илүү тэмдэгт байна. Текст утгыг 'Баруун бөмбөгөр' гэх мэтээр дан хашилтанд бичнэ.",
  ),
};

/// Turns raw SQLite errors into something a new SQL student can act on.
FriendlyError translateError(Object err, [String lang = 'en']) {
  if (err is FriendlyError) return err;
  final msg = engineMessages[lang] ?? engineMessages['en']!;
  final raw = err is SqliteException ? err.message : err.toString();
  final interrupted = err is SqliteException && (err.extendedResultCode & 0xff) == 9; // SQLITE_INTERRUPT

  FriendlyError f(String m) => FriendlyError(m, raw)..interrupted = interrupted;
  if (RegExp('readonly|query_only|attempt to write', caseSensitive: false).hasMatch(raw)) return f(msg.readOnly);
  if (RegExp('output file already exists', caseSensitive: false).hasMatch(raw)) return f(msg.fileExists);
  var m = RegExp(r'no such table: (\S+)', caseSensitive: false).firstMatch(raw);
  if (m != null) return f(msg.noTable(m.group(1)!));
  m = RegExp(r'no such column: (\S+)', caseSensitive: false).firstMatch(raw);
  if (m != null) return f(msg.noColumn(m.group(1)!));
  m = RegExp(r'ambiguous column name: (\S+)', caseSensitive: false).firstMatch(raw);
  if (m != null) return f(msg.ambiguous(m.group(1)!));
  if (RegExp('incomplete input', caseSensitive: false).hasMatch(raw)) return f(msg.incomplete);
  m = RegExp(r'near "([^"]*)": syntax error', caseSensitive: false).firstMatch(raw);
  if (m != null) return f(msg.near(m.group(1)!));
  if (RegExp('unrecognized token', caseSensitive: false).hasMatch(raw)) return f(msg.token);
  return f(raw);
}
