// Grades a lesson task. Pure logic: the worker (and the tests) supply a
// context with the player's result and small helpers that run SQL.
//
// A check is plain data written in a level file, for example
//   { type: 'rows', sql: "SELECT name FROM suspects WHERE age > 40" }
// Supported types:
//   rows      the player's result must hold the same rows as a reference query
//             options: ordered, exactColumns, columnNames
//   value     every row of the player's result contains this value
//   state     after the run, a query on the database returns a truthy first cell
//   stateRows a query on the database after the run must match a reference query
//   sql       the player's SQL must match a regular expression (source string)
//   blocked   each statement must fail on a copy of the database after the run
//   allowed   each statement must succeed on a copy of the database after the run
//   plan      EXPLAIN QUERY PLAN of a query must match a regular expression
//   file      a file the run wrote with VACUUM INTO must satisfy a query
//   read      reading-only lesson, completed with a button instead of a query
//   all       every check in `checks` must pass (the first failure is reported)
// Failures return a reason code that the UI turns into a sentence. Checks
// with a `message` report that text instead for reasons that need context.

const key = (v) => {
  if (v === null || v === undefined) return '\u0000null';
  if (typeof v === 'number') return `n:${Number.isInteger(v) ? v : Number(v.toPrecision(12))}`;
  if (v instanceof Uint8Array) return `b:${v.length}`;
  return `s:${String(v)}`;
};

const rowKey = (row) => JSON.stringify(row.map(key));

function multiset(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const m = multiset(a);
  for (const v of b) {
    const n = m.get(v);
    if (!n) return false;
    m.set(v, n - 1);
  }
  return true;
}

/**
 * Compares a player's result with the expected one.
 * By default the player may include extra columns and any column order:
 * every expected column must be matched by one of the player's columns.
 */
export function compareResults(expected, actual, { ordered = false, exactColumns = false, columnNames = false } = {}) {
  if (!actual || !actual.producedRows) return { passed: false, reason: 'noResult' };
  const exp = expected.rows;
  const act = actual.rows;
  if (exactColumns && actual.columns.length !== expected.columns.length) {
    return {
      passed: false,
      reason: 'columnCount',
      detail: { expected: expected.columns.length, got: actual.columns.length },
    };
  }
  if (act.length !== exp.length) {
    return { passed: false, reason: 'rowCount', detail: { expected: exp.length, got: act.length } };
  }
  if (exp.length === 0) return { passed: true };

  const k = expected.columns.length;
  const colValues = (rows, i) => rows.map((r) => key(r[i]));
  const candidates = [];
  for (let j = 0; j < k; j++) {
    const want = colValues(exp, j);
    const found = [];
    for (let i = 0; i < actual.columns.length; i++) {
      if (sameMultiset(want, colValues(act, i))) found.push(i);
    }
    if (found.length === 0) {
      return { passed: false, reason: 'values', detail: { column: expected.columns[j] } };
    }
    candidates.push(found);
  }

  const expRows = exp.map(rowKey);
  let unorderedMatch = null;
  const used = new Set();
  const mapping = [];
  const search = (j) => {
    if (j === k) {
      const projected = act.map((r) => rowKey(mapping.map((i) => r[i])));
      if (!sameMultiset(expRows, projected)) return false;
      unorderedMatch ??= [...mapping];
      if (!ordered) return true;
      return projected.every((p, idx) => p === expRows[idx]);
    }
    for (const i of candidates[j]) {
      if (used.has(i)) continue;
      used.add(i);
      mapping.push(i);
      if (search(j + 1)) return true;
      mapping.pop();
      used.delete(i);
    }
    return false;
  };

  if (!search(0)) {
    if (unorderedMatch) return { passed: false, reason: 'order' };
    return { passed: false, reason: 'values', detail: { column: null } };
  }
  if (columnNames) {
    for (let j = 0; j < k; j++) {
      const want = String(expected.columns[j]).toLowerCase();
      if (String(actual.columns[mapping[j]]).toLowerCase() !== want) {
        return { passed: false, reason: 'columnName', detail: { name: expected.columns[j] } };
      }
    }
  }
  return { passed: true };
}

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * ctx = {
 *   result, sql,                  the player's run
 *   reference(sql) -> {columns, rows}   on the level's starting data
 *   state(sql)     -> {columns, rows}   on the database after the run
 *   attempt(sql)   -> null | error message   on a throwaway copy after the run
 *   files: [{ name, query(sql) -> {columns, rows} }]   VACUUM INTO output
 * }
 */
export function evaluateCheck(check, ctx) {
  const fail = (reason, detail) => ({ passed: false, reason, detail, message: check.message });
  try {
    switch (check.type) {
      case 'read':
        return { passed: false, reason: 'read' };
      case 'all': {
        for (const sub of check.checks) {
          const out = evaluateCheck(sub, ctx);
          if (!out.passed) return out;
        }
        return { passed: true };
      }
      case 'rows': {
        const out = compareResults(ctx.reference(check.sql), ctx.result, check);
        return out.passed ? out : fail(out.reason, out.detail);
      }
      case 'stateRows': {
        const actual = { ...ctx.state(check.sql), producedRows: true };
        const out = compareResults(ctx.reference(check.reference), actual, check);
        return out.passed ? out : fail('custom');
      }
      case 'value': {
        const r = ctx.result;
        if (!r || !r.producedRows) return fail('noResult');
        if (r.rows.length === 0) return fail('rowCount', { expected: 1, got: 0 });
        const want = norm(check.value);
        const ok = r.rows.every((row) => row.some((v) => norm(v) === want));
        return ok ? { passed: true } : fail('value');
      }
      case 'state': {
        const { rows } = ctx.state(check.sql);
        return rows.length && rows[0][0] ? { passed: true } : fail('custom');
      }
      case 'sql':
        return new RegExp(check.pattern, 'i').test(ctx.sql ?? '') ? { passed: true } : fail('custom');
      case 'blocked':
        return check.statements.every((s) => ctx.attempt(s) !== null) ? { passed: true } : fail('custom');
      case 'allowed':
        return check.statements.every((s) => ctx.attempt(s) === null) ? { passed: true } : fail('custom');
      case 'plan': {
        const { rows } = ctx.state(`EXPLAIN QUERY PLAN ${check.sql}`);
        const text = rows.map((r) => r.at(-1)).join('\n');
        return new RegExp(check.pattern, 'i').test(text) ? { passed: true } : fail('custom', { plan: text });
      }
      case 'file': {
        if (!ctx.files?.length) return fail('noFile');
        const ok = ctx.files.some((f) => {
          try {
            const { rows } = f.query(check.sql);
            return Boolean(rows.length && rows[0][0]);
          } catch {
            return false;
          }
        });
        return ok ? { passed: true } : fail('custom');
      }
      default:
        return fail('custom');
    }
  } catch (err) {
    // A check query failing usually means the player's database lacks
    // something the task needs (e.g. a view that was never created).
    return fail('custom', { error: String(err?.message ?? err) });
  }
}
