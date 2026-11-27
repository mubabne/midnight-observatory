// Pure SQL logic shared by the browser worker and the Node tests.
// It never touches the DOM, so it can run anywhere sql.js runs.

export const MAX_ROWS = 200;

/**
 * Builds the case database from the seed script (plus optional translation
 * overlays) and returns it as bytes. Every query later opens its own throwaway
 * copy of these bytes, so the canonical evidence can never be changed.
 */
export function buildCanonicalBytes(SQL, seedSql, overlays = []) {
  const db = new SQL.Database();
  try {
    db.exec(seedSql);
    for (const overlay of overlays) db.exec(overlay);
    return db.export();
  } finally {
    db.close();
  }
}

/** Opens a disposable, read-only copy of the evidence. */
export function openDisposable(SQL, bytes) {
  const db = new SQL.Database(bytes);
  registerUnicodeFunctions(db);
  // query_only makes SQLite itself refuse any statement that would write.
  // That is far more reliable than inspecting the SQL text ourselves, and
  // it lets WITH queries, comments and subqueries through untouched.
  db.exec('PRAGMA query_only = ON;');
  return db;
}

/*
 * SQLite's built-in LIKE, lower() and upper() only understand ASCII letters,
 * so LIKE '%баруун%' would not match 'Баруун бөмбөгөр'. Replacing them with
 * JavaScript versions makes them work for Cyrillic (and every other script)
 * while behaving exactly the same for English text.
 */
const likeCache = new Map();

function likeToRegExp(pattern, escape) {
  const key = `${escape ?? ''}\u0000${pattern}`;
  let re = likeCache.get(key);
  if (re) return re;
  let src = '';
  const chars = [...pattern];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (escape && ch === escape && i + 1 < chars.length) {
      src += chars[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (ch === '%') {
      src += '.*';
    } else if (ch === '_') {
      src += '.';
    } else {
      src += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  re = new RegExp(`^${src}$`, 'isu');
  if (likeCache.size > 500) likeCache.clear();
  likeCache.set(key, re);
  return re;
}

function registerUnicodeFunctions(db) {
  // like(pattern, value) is what SQLite calls for "value LIKE pattern".
  db.create_function('like', (pattern, value) => {
    if (pattern === null || value === null) return null;
    return likeToRegExp(String(pattern)).test(String(value)) ? 1 : 0;
  });
  db.create_function('like', (pattern, value, escape) => {
    if (pattern === null || value === null) return null;
    return likeToRegExp(String(pattern), escape === null ? null : String(escape)).test(String(value)) ? 1 : 0;
  });
  db.create_function('lower', (s) => (s === null ? null : String(s).toLowerCase()));
  db.create_function('upper', (s) => (s === null ? null : String(s).toUpperCase()));
}

/**
 * Runs one or more statements against a fresh copy of the evidence.
 * Returns the last statement that produced columns (like most SQL consoles),
 * capped at maxRows rows.
 */
export function runQuery(SQL, bytes, sqlText, { maxRows = MAX_ROWS, lang = 'en' } = {}) {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  if (!sqlText || !sqlText.trim()) {
    throw friendlyError(msg.empty);
  }

  const db = openDisposable(SQL, bytes);
  const started = performance.now();
  let statementCount = 0;
  let last = null;

  try {
    for (const stmt of db.iterateStatements(sqlText)) {
      statementCount += 1;
      try {
        const columns = stmt.getColumnNames();
        const rows = [];
        let truncated = false;
        while (stmt.step()) {
          if (rows.length >= maxRows) {
            truncated = true;
            break;
          }
          rows.push(stmt.get());
        }
        if (columns.length > 0) {
          last = { columns, rows, truncated };
        }
      } finally {
        stmt.free();
      }
    }
  } catch (err) {
    throw translateError(err, lang);
  } finally {
    db.close();
  }

  if (statementCount === 0) {
    throw friendlyError(msg.onlyComments);
  }

  return {
    columns: last ? last.columns : [],
    rows: last ? last.rows : [],
    truncated: last ? last.truncated : false,
    statementCount,
    producedRows: last !== null,
    elapsedMs: Math.round(performance.now() - started),
  };
}

/** Parameterised lookup used by the accusation form (never string-built SQL). */
export function findPersonByName(SQL, bytes, normalizedName) {
  const db = openDisposable(SQL, bytes);
  try {
    const stmt = db.prepare('SELECT id, name FROM people WHERE lower(trim(name)) = ? LIMIT 1;');
    try {
      stmt.bind([normalizedName]);
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
}

/** Reads the live schema so the reference panel can never drift from the data. */
export function describeSchema(SQL, bytes) {
  const db = openDisposable(SQL, bytes);
  try {
    const tables = db.exec(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid;"
    );
    const names = tables.length ? tables[0].values.map((r) => r[0]) : [];
    return names.map((name) => {
      const cols = db.exec(`SELECT name, type, pk, "notnull" FROM pragma_table_info('${name}');`);
      const fks = db.exec(`SELECT "from", "table", "to" FROM pragma_foreign_key_list('${name}');`);
      const count = db.exec(`SELECT COUNT(*) FROM "${name}";`)[0].values[0][0];
      const fkMap = new Map((fks[0]?.values ?? []).map(([from, table, to]) => [from, { table, column: to }]));
      return {
        name,
        rowCount: count,
        columns: (cols[0]?.values ?? []).map(([col, type, pk, notnull]) => ({
          name: col,
          type: type || 'ANY',
          primaryKey: pk > 0,
          notNull: notnull === 1,
          references: fkMap.get(col) ?? null,
        })),
      };
    });
  } finally {
    db.close();
  }
}

function friendlyError(message, detail) {
  const err = new Error(message);
  err.friendly = true;
  if (detail) err.detail = detail;
  return err;
}

/** Friendly SQL error messages, per language. */
export const MESSAGES = {
  en: {
    empty: 'Type a query first, for example: SELECT * FROM people;',
    onlyComments: 'That only contained comments. Add a statement to run.',
    readOnly:
      'The evidence locker is read-only. Investigate with SELECT (or WITH … SELECT) queries; INSERT, UPDATE, DELETE, CREATE and DROP are blocked.',
    noTable: (t) => `There is no table called "${t}". Check the Tables tab for exact names.`,
    noColumn: (c) =>
      `There is no column called "${c}" in the tables you are querying. Check spelling, or prefix it with the table name when joining.`,
    ambiguous: (c) =>
      `"${c}" exists in more than one joined table. Write it as table.${c.split('.').pop()} so SQLite knows which one you mean.`,
    incomplete: 'The query ends too early. Look for a missing closing bracket, quote or clause.',
    near: (t) => `SQLite got confused near "${t}". Check the spelling and punctuation around it.`,
    token: "There is an unclosed quote or a stray character. Text values go in single quotes, like 'West Dome'.",
  },
  mn: {
    empty: 'Эхлээд асуулга бичнэ үү. Жишээ нь: SELECT * FROM people;',
    onlyComments: 'Зөвхөн тайлбар (comment) байна. Ажиллуулах команд нэмнэ үү.',
    readOnly:
      'Нотлох баримтын сан зөвхөн уншигдана. SELECT (эсвэл WITH … SELECT) асуулгаар мөрдөөрэй; INSERT, UPDATE, DELETE, CREATE, DROP хориглогдсон.',
    noTable: (t) => `"${t}" нэртэй хүснэгт байхгүй. Зөв нэрийг «Хүснэгт» хэсгээс харна уу.`,
    noColumn: (c) =>
      `Асууж буй хүснэгтүүдэд "${c}" нэртэй багана алга. Бичлэгээ шалгах эсвэл JOIN хийхдээ өмнө нь хүснэгтийн нэрийг бичээрэй.`,
    ambiguous: (c) =>
      `"${c}" багана JOIN хийсэн хэд хэдэн хүснэгтэд байна. Аль нь болохыг SQLite мэдэхийн тулд хүснэгт.${c.split('.').pop()} гэж бичээрэй.`,
    incomplete: 'Асуулга дутуу дууссан байна. Хаалт, хашилт эсвэл хэсэг дутсан эсэхийг шалгаарай.',
    near: (t) => `SQLite "${t}"-ийн орчимд ойлгохгүй байна. Тэр хавийн бичлэг, цэг таслалыг шалгаарай.`,
    token: "Хаагдаагүй хашилт эсвэл илүү тэмдэгт байна. Текст утгыг 'Баруун бөмбөгөр' гэх мэтээр дан хашилтанд бичнэ.",
  },
};

/** Turns raw SQLite errors into something a new SQL student can act on. */
export function translateError(err, lang = 'en') {
  if (err && err.friendly) return err;
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const raw = String(err?.message ?? err);

  if (/readonly|query_only|attempt to write/i.test(raw)) return friendlyError(msg.readOnly, raw);
  let m = raw.match(/no such table: (\S+)/i);
  if (m) return friendlyError(msg.noTable(m[1]), raw);
  m = raw.match(/no such column: (\S+)/i);
  if (m) return friendlyError(msg.noColumn(m[1]), raw);
  m = raw.match(/ambiguous column name: (\S+)/i);
  if (m) return friendlyError(msg.ambiguous(m[1]), raw);
  if (/incomplete input/i.test(raw)) return friendlyError(msg.incomplete, raw);
  m = raw.match(/near "([^"]*)": syntax error/i);
  if (m) return friendlyError(msg.near(m[1]), raw);
  if (/unrecognized token/i.test(raw)) return friendlyError(msg.token, raw);
  return friendlyError(raw, raw);
}
