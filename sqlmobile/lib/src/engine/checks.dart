// Grades a lesson task. Ported from the web game's src/sql/checks.js.
// A check is plain data from levels.json; see that file for the types:
// rows, value, state, stateRows, sql, blocked, allowed, plan, file, read, all.
import 'dart:convert';
import 'dart:typed_data';

import 'engine.dart';

class CheckResult {
  const CheckResult(this.passed, {this.reason, this.detail = const {}, this.message});
  final bool passed;
  final String? reason;
  final Map<String, Object?> detail;
  final String? message;

  static const pass = CheckResult(true);

  Map<String, Object?> toMap() => {'passed': passed, 'reason': reason, 'detail': detail, 'message': message};
}

/// Everything a check can look at.
class CheckContext {
  CheckContext({
    required this.result,
    required this.sql,
    required this.reference,
    required this.state,
    required this.attempt,
    this.files = const [],
  });

  final QueryOutput? result;
  final String sql;

  /// Runs SQL on the level's starting data.
  final QueryOutput Function(String sql) reference;

  /// Runs SQL on the database as it stands after the run.
  final QueryOutput Function(String sql) state;

  /// Runs a statement on a throwaway copy after the run; null if it succeeded.
  final String? Function(String statement) attempt;

  /// Query functions for files the run wrote with VACUUM INTO.
  final List<QueryOutput Function(String sql)> files;
}

String _key(Object? v) {
  if (v == null) return '\u0000null';
  if (v is int) return 'n:$v';
  if (v is double) {
    if (v.isFinite && v == v.truncateToDouble() && v.abs() < 9e15) return 'n:${v.toInt()}';
    return 'n:${double.parse(v.toStringAsPrecision(12))}';
  }
  if (v is Uint8List) return 'b:${v.length}';
  return 's:$v';
}

String _rowKey(List<Object?> row) => jsonEncode(row.map(_key).toList());

bool _sameMultiset(List<String> a, List<String> b) {
  if (a.length != b.length) return false;
  final m = <String, int>{};
  for (final v in a) {
    m[v] = (m[v] ?? 0) + 1;
  }
  for (final v in b) {
    final n = m[v];
    if (n == null || n == 0) return false;
    m[v] = n - 1;
  }
  return true;
}

/// Compares a player's result with the expected one. By default the player
/// may include extra columns in any order: every expected column must be
/// matched by one of the player's columns.
CheckResult compareResults(
  QueryOutput expected,
  QueryOutput? actual, {
  bool ordered = false,
  bool exactColumns = false,
  bool columnNames = false,
}) {
  if (actual == null || !actual.producedRows) return const CheckResult(false, reason: 'noResult');
  final exp = expected.rows;
  final act = actual.rows;
  if (exactColumns && actual.columns.length != expected.columns.length) {
    return CheckResult(false,
        reason: 'columnCount', detail: {'expected': expected.columns.length, 'got': actual.columns.length});
  }
  if (act.length != exp.length) {
    return CheckResult(false, reason: 'rowCount', detail: {'expected': exp.length, 'got': act.length});
  }
  if (exp.isEmpty) return CheckResult.pass;

  final k = expected.columns.length;
  List<String> colValues(List<List<Object?>> rows, int i) => [for (final r in rows) _key(r[i])];
  final candidates = <List<int>>[];
  for (var j = 0; j < k; j++) {
    final want = colValues(exp, j);
    final found = <int>[];
    for (var i = 0; i < actual.columns.length; i++) {
      if (_sameMultiset(want, colValues(act, i))) found.add(i);
    }
    if (found.isEmpty) return CheckResult(false, reason: 'values', detail: {'column': expected.columns[j]});
    candidates.add(found);
  }

  final expRows = exp.map(_rowKey).toList();
  List<int>? unorderedMatch;
  final used = <int>{};
  final mapping = <int>[];
  bool search(int j) {
    if (j == k) {
      final projected = [for (final r in act) _rowKey([for (final i in mapping) r[i]])];
      if (!_sameMultiset(expRows, projected)) return false;
      unorderedMatch ??= List.of(mapping);
      if (!ordered) return true;
      for (var idx = 0; idx < projected.length; idx++) {
        if (projected[idx] != expRows[idx]) return false;
      }
      return true;
    }
    for (final i in candidates[j]) {
      if (used.contains(i)) continue;
      used.add(i);
      mapping.add(i);
      if (search(j + 1)) return true;
      mapping.removeLast();
      used.remove(i);
    }
    return false;
  }

  if (!search(0)) {
    if (unorderedMatch != null) return const CheckResult(false, reason: 'order');
    return const CheckResult(false, reason: 'values', detail: {'column': null});
  }
  if (columnNames) {
    for (var j = 0; j < k; j++) {
      if (actual.columns[mapping[j]].toLowerCase() != expected.columns[j].toLowerCase()) {
        return CheckResult(false, reason: 'columnName', detail: {'name': expected.columns[j]});
      }
    }
  }
  return CheckResult.pass;
}

String _norm(Object? v) => (v ?? '').toString().trim().toLowerCase();

bool truthy(Object? v) {
  if (v == null) return false;
  if (v is num) return v != 0;
  if (v is String) return v.isNotEmpty;
  return true;
}

CheckResult evaluateCheck(Map<String, dynamic> check, CheckContext ctx) {
  final message = check['message'] as String?;
  CheckResult fail(String reason, [Map<String, Object?> detail = const {}]) =>
      CheckResult(false, reason: reason, detail: detail, message: message);
  try {
    switch (check['type']) {
      case 'read':
        return const CheckResult(false, reason: 'read');
      case 'all':
        for (final sub in (check['checks'] as List)) {
          final out = evaluateCheck(Map<String, dynamic>.from(sub as Map), ctx);
          if (!out.passed) return out;
        }
        return CheckResult.pass;
      case 'rows':
        final out = compareResults(
          ctx.reference(check['sql'] as String),
          ctx.result,
          ordered: check['ordered'] == true,
          exactColumns: check['exactColumns'] == true,
          columnNames: check['columnNames'] == true,
        );
        return out.passed ? out : fail(out.reason!, out.detail);
      case 'stateRows':
        final s = ctx.state(check['sql'] as String);
        final actual = QueryOutput(
            columns: s.columns, rows: s.rows, truncated: false, statementCount: 1, producedRows: true);
        final out = compareResults(
          ctx.reference(check['reference'] as String),
          actual,
          ordered: check['ordered'] == true,
          exactColumns: check['exactColumns'] == true,
          columnNames: check['columnNames'] == true,
        );
        return out.passed ? out : fail('custom');
      case 'value':
        final r = ctx.result;
        if (r == null || !r.producedRows) return fail('noResult');
        if (r.rows.isEmpty) return fail('rowCount', {'expected': 1, 'got': 0});
        final want = _norm(check['value']);
        final ok = r.rows.every((row) => row.any((v) => _norm(v) == want));
        return ok ? CheckResult.pass : fail('value');
      case 'state':
        final rows = ctx.state(check['sql'] as String).rows;
        return rows.isNotEmpty && truthy(rows.first.first) ? CheckResult.pass : fail('custom');
      case 'sql':
        return RegExp(check['pattern'] as String, caseSensitive: false).hasMatch(ctx.sql)
            ? CheckResult.pass
            : fail('custom');
      case 'blocked':
        return (check['statements'] as List).every((s) => ctx.attempt(s as String) != null)
            ? CheckResult.pass
            : fail('custom');
      case 'allowed':
        return (check['statements'] as List).every((s) => ctx.attempt(s as String) == null)
            ? CheckResult.pass
            : fail('custom');
      case 'plan':
        final rows = ctx.state('EXPLAIN QUERY PLAN ${check['sql']}').rows;
        final text = rows.map((r) => r.last).join('\n');
        return RegExp(check['pattern'] as String, caseSensitive: false).hasMatch(text)
            ? CheckResult.pass
            : fail('custom', {'plan': text});
      case 'file':
        if (ctx.files.isEmpty) return fail('noFile');
        final ok = ctx.files.any((query) {
          try {
            final rows = query(check['sql'] as String).rows;
            return rows.isNotEmpty && truthy(rows.first.first);
          } catch (_) {
            return false;
          }
        });
        return ok ? CheckResult.pass : fail('custom');
      default:
        return fail('custom');
    }
  } catch (err) {
    // A check query failing usually means the player's database lacks
    // something the task needs (e.g. a view that was never created).
    return fail('custom', {'error': err.toString()});
  }
}
