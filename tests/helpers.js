import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { buildCanonicalBytes, runQuery } from '../src/sql/engine.js';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const seedSql = fs.readFileSync(path.join(root, 'src', 'case', 'seed.sql'), 'utf8');
export const mnOverlay = fs.readFileSync(path.join(root, 'src', 'case', 'i18n', 'mn.sql'), 'utf8');

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
