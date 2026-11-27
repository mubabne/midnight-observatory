// One level's database plus the logic around a run: read-only or writable
// execution, reading VACUUM INTO files back, and grading the current lesson.
// The worker uses it, and so do the tests, so both exercise the same code.
import { prepareLevel } from '../levels/database.js';
import { findLesson } from '../levels/index.js';
import {
  openDb,
  runQuery,
  runSession,
  selectAll,
  describeSchema,
  findPersonByName,
  vacuumTargets,
  readBackFile,
} from './engine.js';
import { evaluateCheck } from './checks.js';

export class LevelSession {
  /**
   * snapshot: saved bytes of a writable level's database, or null to start
   * from the level's starting data.
   */
  constructor(SQL, level, lang, read, snapshot = null) {
    this.SQL = SQL;
    this.level = level;
    this.lang = lang;
    this.prepared = prepareLevel(SQL, level, lang, read);
    this.current = level.writable && snapshot ? this.#validSnapshot(snapshot) : this.prepared.bytes;
  }

  get writable() {
    return this.prepared.writable;
  }

  /** Falls back to the starting data if saved bytes are not a usable database. */
  #validSnapshot(bytes) {
    try {
      const db = new this.SQL.Database(bytes);
      try {
        db.exec('SELECT COUNT(*) FROM sqlite_schema;');
      } finally {
        db.close();
      }
      this.restoredSnapshot = true;
      return bytes;
    } catch {
      this.snapshotRejected = true;
      return this.prepared.bytes;
    }
  }

  schema() {
    return describeSchema(this.SQL, this.current);
  }

  /** Throws the writable database away and starts from the level's data again. */
  reset() {
    this.current = this.prepared.bytes;
  }

  findPerson(name) {
    return findPersonByName(this.SQL, this.prepared.bytes, name, this.level.personLookup);
  }

  run(sql, lessonId = null, { maxRows } = {}) {
    const opts = { lang: this.lang, attachSql: this.prepared.attachSql, ...(maxRows ? { maxRows } : {}) };
    let result;
    let files = [];
    if (this.writable) {
      try {
        const { bytes, ...rest } = runSession(this.SQL, this.current, sql, opts);
        this.current = bytes;
        result = rest;
      } catch (err) {
        if (err.snapshot) {
          // Statements before the failing one still count, as in SQLite.
          this.current = err.snapshot;
          err.snapshot = this.current;
          err.schema = this.schema();
        }
        throw err;
      }
      files = vacuumTargets(sql)
        .map((name) => ({ name, bytes: readBackFile(this.SQL, name) }))
        .filter((f) => f.bytes);
      result.snapshot = this.current;
      result.schema = this.schema();
      result.backupFiles = files;
    } else {
      result = runQuery(this.SQL, this.prepared.bytes, sql, opts);
    }

    const lesson = lessonId ? findLesson(this.level, this.lang, lessonId) : null;
    if (lesson?.check && lesson.check.type !== 'read') {
      result.check = { lessonId, ...this.grade(lesson.check, sql, result, files) };
    }
    return result;
  }

  grade(check, sql, result, files = []) {
    const { SQL } = this;
    const attachSql = this.prepared.attachSql;
    const query = (bytes) => (q) => {
      const db = openDb(SQL, bytes, { attachSql });
      try {
        return selectAll(db, q);
      } finally {
        db.close();
      }
    };
    const ctx = {
      result,
      sql,
      reference: query(this.prepared.bytes),
      state: query(this.current),
      attempt: (statement) => {
        const db = openDb(SQL, this.current, { readOnly: false, attachSql });
        try {
          db.exec(statement);
          return null;
        } catch (err) {
          return String(err?.message ?? err);
        } finally {
          db.close();
        }
      },
      files: files.map((f) => ({ name: f.name, query: query(f.bytes) })),
    };
    const { passed, reason, detail, message } = evaluateCheck(check, ctx);
    return { passed, reason: reason ?? null, detail: detail ?? null, message: passed ? null : (message ?? null) };
  }
}
