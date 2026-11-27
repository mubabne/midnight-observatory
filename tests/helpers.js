import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { buildCanonicalBytes, runQuery } from '../src/sql/engine.js';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const levelsDir = path.join(root, 'src', 'levels');
/** Reads a level file the same way the worker's bundled imports do. */
export const readLevelFile = (p) => fs.readFileSync(path.join(levelsDir, p), 'utf8');

export const seedSql = readLevelFile('observatory/seed.sql');
export const mnOverlay = readLevelFile('observatory/i18n/mn.sql');

export const SQL = await initSqlJs();
export const bytes = buildCanonicalBytes(SQL, seedSql);
export const bytesMn = buildCanonicalBytes(SQL, seedSql, [mnOverlay]);

/** Query helpers bound to one language's evidence, using the game's own engine. */
export function bind(dbBytes, lang = 'en') {
  const q = (sql) => {
    const { columns, rows } = runQuery(SQL, dbBytes, sql, { maxRows: 10_000, lang });
    return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])));
  };
  const col = (sql) => q(sql).map((r) => Object.values(r)[0]);
  return { q, col };
}

export const { q, col } = bind(bytes, 'en');

/** Rows of a LevelSession run as objects. */
export function asObjects(result) {
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])));
}
