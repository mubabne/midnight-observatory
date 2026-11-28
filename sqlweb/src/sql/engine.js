// Pure SQL logic shared by the browser worker and the Node tests.
// It never touches the DOM, so it can run anywhere sql.js runs.

export const MAX_ROWS = 200;
/** A writable level's database may not grow past this (it is saved in the browser). */
export const MAX_DB_BYTES = 4 * 1024 * 1024;

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

/**
 * Opens a disposable copy of a database.
 * attachSql (optional) runs first, e.g. to attach an in-memory backup.
 * readOnly turns on query_only afterwards: SQLite itself then refuses any
 * statement that would write. That is far more reliable than inspecting the
 * SQL text ourselves, and it lets WITH queries, comments and subqueries
 * through untouched.
 */
export function openDb(SQL, bytes, { readOnly = true, attachSql = null } = {}) {
  const db = new SQL.Database(bytes);
  try {
    registerUnicodeFunctions(db);
    if (attachSql) db.exec(attachSql);
    if (readOnly) db.exec('PRAGMA query_only = ON;');
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

/** Opens a disposable, read-only copy of the evidence. */
export function openDisposable(SQL, bytes) {
  return openDb(SQL, bytes);
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
export function runQuery(SQL, bytes, sqlText, { maxRows = MAX_ROWS, lang = 'en', attachSql = null } = {}) {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  if (!sqlText || !sqlText.trim()) {
    throw friendlyError(msg.empty);
  }

  const db = openDb(SQL, bytes, { attachSql });
  const started = performance.now();
  try {
    const out = execute(db, sqlText, maxRows, lang);
    return { ...out, elapsedMs: Math.round(performance.now() - started) };
  } finally {
    db.close();
  }
}

/**
 * Runs SQL against a writable copy and returns the database as it stands
 * afterwards (result.bytes). This is how a writable level keeps its state
 * between runs: the caller stores the bytes and passes them to the next run.
 *
 * Each run is one connection, like one session in a SQL console:
 * - statements outside a transaction take effect one by one, so if a later
 *   statement fails, the earlier ones still count (exactly as in SQLite);
 * - a transaction that is still open at the end of the run is rolled back.
 * On a SQL error the thrown error carries .snapshot with the new bytes.
 */
export function runSession(
  SQL,
  bytes,
  sqlText,
  { maxRows = MAX_ROWS, lang = 'en', attachSql = null, maxBytes = MAX_DB_BYTES } = {}
) {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  if (!sqlText || !sqlText.trim()) {
    throw friendlyError(msg.empty);
  }

  const db = openDb(SQL, bytes, { readOnly: false, attachSql });
  const started = performance.now();
  let out = null;
  let failure = null;
  let rolledBack = false;
  let changes = 0;
  let after;
  try {
    const before = totalChanges(db);
    try {
      out = execute(db, sqlText, maxRows, lang);
    } catch (err) {
      failure = err;
    }
    try {
      db.exec('ROLLBACK;');
      rolledBack = true; // only succeeds if the run left a transaction open
    } catch {
      /* no open transaction: nothing to undo */
    }
    changes = rolledBack ? 0 : totalChanges(db) - before;
    after = db.export();
  } finally {
    db.close();
  }

  if (after.length > maxBytes) {
    throw friendlyError(msg.tooBig(Math.round(maxBytes / 1024 / 1024)));
  }
  if (failure) {
    failure.snapshot = after;
    failure.rolledBack = rolledBack;
    throw failure;
  }
  return {
    ...out,
    bytes: after,
    rolledBack,
    changes,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function totalChanges(db) {
  return db.exec('SELECT total_changes();')[0].values[0][0];
}

/** Steps through every statement and keeps the last result set. */
function execute(db, sqlText, maxRows, lang) {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
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
  };
}

/** Runs one query with no row cap, for checks and tests. Returns { columns, rows }. */
export function selectAll(db, sql) {
  const res = db.exec(sql);
  const last = res.at(-1);
  return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] };
}

const DEFAULT_PERSON_LOOKUP = 'SELECT name FROM people WHERE lower(trim(name)) = :name LIMIT 1;';

/**
 * Parameterised lookup used by the accusation form (never string-built SQL).
 * lookupSql must use the :name parameter.
 */
export function findPersonByName(SQL, bytes, normalizedName, lookupSql = DEFAULT_PERSON_LOOKUP) {
  const db = openDisposable(SQL, bytes);
  try {
    const stmt = db.prepare(lookupSql);
    try {
      stmt.bind({ ':name': normalizedName });
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
}

/**
 * Finds the file names a script asks VACUUM INTO to write, so the worker can
 * read the finished backups back. Comments are ignored.
 */
export function vacuumTargets(sqlText) {
  const code = String(sqlText ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
  const names = [];
  for (const m of code.matchAll(/\bVACUUM\b(?:\s+[A-Za-z_][\w]*)?\s+INTO\s+'((?:[^']|'')+)'/gi)) {
    const name = m[1].replace(/''/g, "'");
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Reads a database file that VACUUM INTO wrote inside SQLite's in-memory
 * file system and returns it as bytes. sql.js does not expose that file
 * system, so this attaches the file to a fresh database and copies the
 * schema and every row across. Returns null if the file holds nothing.
 */
export function readBackFile(SQL, name) {
  const db = new SQL.Database();
  try {
    const attach = db.prepare('ATTACH ? AS src;');
    try {
      attach.bind([name]);
      attach.step();
    } finally {
      attach.free();
    }
    const objects = selectAll(
      db,
      `SELECT type, name, sql FROM src.sqlite_schema
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
       ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, rowid;`
    ).rows;
    if (objects.length === 0) return null;
    for (const [type, objName, sql] of objects) {
      db.exec(sql);
      if (type === 'table') {
        const quoted = `"${String(objName).replace(/"/g, '""')}"`;
        db.exec(`INSERT INTO main.${quoted} SELECT * FROM src.${quoted};`);
      }
    }
    db.exec('DETACH DATABASE src;');
    return db.export();
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Reads the live schema so the reference panel can never drift from the data. */
export function describeSchema(SQL, bytes) {
  const db = openDisposable(SQL, bytes);
  try {
    const tables = db.exec(
      "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, rowid;"
    );
    const entries = tables.length ? tables[0].values : [];
    return entries.map(([name, kind]) => {
      const q = String(name).replace(/'/g, "''");
      const cols = db.exec(`SELECT name, type, pk, "notnull" FROM pragma_table_info('${q}');`);
      const fks = db.exec(`SELECT "from", "table", "to" FROM pragma_foreign_key_list('${q}');`);
      let count = null;
      try {
        count = db.exec(`SELECT COUNT(*) FROM "${String(name).replace(/"/g, '""')}";`)[0].values[0][0];
      } catch {
        count = null; // a broken view (e.g. it names a dropped table)
      }
      const fkMap = new Map((fks[0]?.values ?? []).map(([from, table, to]) => [from, { table, column: to }]));
      return {
        name,
        kind,
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
    empty: 'Type a query first. Open the Tables tab to see what you can SELECT from.',
    onlyComments: 'That only contained comments. Add a statement to run.',
    readOnly:
      'This database is read-only. Investigate with SELECT (or WITH … SELECT) queries; INSERT, UPDATE, DELETE, CREATE and DROP are blocked here. Level 4 (Tampered Evidence) is the level where you can change data.',
    tooBig: (mb) => `That run made the database bigger than ${mb} MB, so its changes were thrown away. Check for an INSERT that copies far more rows than you meant.`,
    fileExists: "A file with that name already exists in this session. VACUUM INTO never overwrites, so pick a new name, like 'archive-2.db'.",
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
    empty: 'Эхлээд асуулгаа бичээрэй. «Хүснэгт» хэсгээс ямар хүснэгтэд SELECT асуулга ажиллуулж болохыг хараарай.',
    onlyComments: 'Зөвхөн тайлбар бичсэн байна. Ажиллуулах SQL команд нэмээрэй.',
    readOnly:
      'Энэ түвшний өгөгдлийн сан зөвхөн уншигдана. SELECT эсвэл WITH … SELECT асуулгаар баримтуудыг шалгаарай. INSERT, UPDATE, DELETE, CREATE, DROP команд энд ажиллахгүй. Өгөгдөл өөрчлөх даалгаврууд 4-р түвшинд бий.',
    tooBig: (mb) => `Командуудыг ажиллуулсны дараа өгөгдлийн сан ${mb} MB-аас хэтэрсэн тул өөрчлөлтүүдийг цуцаллаа. INSERT командаар санамсаргүй хэт олон мөр хуулсан эсэхээ шалгаарай.`,
    fileExists: "Одоогийн тоглолтод ийм нэртэй файл аль хэдийн үүссэн байна. VACUUM INTO өмнөх файлыг дарж бичдэггүй тул 'archive-2.db' гэх мэт өөр нэр сонгоорой.",
    noTable: (t) => `"${t}" нэртэй хүснэгт байхгүй. Зөв нэрийг «Хүснэгт» хэсгээс харна уу.`,
    noColumn: (c) =>
      `Асуулгад ашигласан хүснэгтүүдэд "${c}" нэртэй багана алга. Баганын нэрийг зөв бичсэн эсэхээ шалгаарай. JOIN ашиглаж байгаа бол баганын өмнө хүснэгтийн нэрийг бичиж үзээрэй.`,
    ambiguous: (c) =>
      `"${c}" нэртэй багана JOIN хийсэн хэд хэдэн хүснэгтэд байна. Аль хүснэгтийн баганыг сонгохоо тодруулж, table.${c.split('.').pop()} хэлбэрээр бичээрэй. table гэдгийн оронд хүснэгтийнхээ нэр эсвэл товчилсон нэрийг тавина.`,
    incomplete: 'Асуулга дутуу байна. Хаалт, хашилтаа хаасан эсэх болон командын аль нэг хэсгийг орхисон эсэхээ шалгаарай.',
    near: (t) => `SQLite "${t}" орчмын бичлэгийг ойлгохгүй байна. Тэр хэсгийн үг, тэмдэгтүүдээ шалгаарай.`,
    token: "Хаагаагүй хашилт эсвэл илүү тэмдэгт байна. Текстэн утгыг 'Баруун бөмбөгөр' гэх мэтээр дан хашилтад бичээрэй.",
  },
};

/** Turns raw SQLite errors into something a new SQL student can act on. */
export function translateError(err, lang = 'en') {
  if (err && err.friendly) return err;
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const raw = String(err?.message ?? err);

  if (/readonly|query_only|attempt to write/i.test(raw)) return friendlyError(msg.readOnly, raw);
  if (/output file already exists/i.test(raw)) return friendlyError(msg.fileExists, raw);
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
