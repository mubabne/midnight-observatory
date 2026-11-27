// Builds a level's database from its SQL files. Shared by the worker (which
// reads the files through Vite ?raw imports) and the Node tests (which read
// them from disk). `read(path)` returns the text of a file under src/levels/.
import { buildCanonicalBytes } from '../sql/engine.js';

/** Seeds written as templates use {{db}} for the schema name (main or backup). */
export function renderTemplate(sql, schema) {
  return sql.replace(/\{\{db\}\}/g, schema);
}

/**
 * Returns { bytes, attachSql, writable } for a level in a language.
 *  bytes      the level's starting database
 *  attachSql  SQL that attaches the read-only backup (writable levels), or null
 */
export function prepareLevel(SQL, level, lang, read) {
  const spec = level.database;
  const seedText = read(`${level.id}/${spec.seed}`);
  const seed = spec.template ? renderTemplate(seedText, 'main') : seedText;
  const overlays = [
    ...(spec.overlays?.[lang] ?? []).map((p) => read(`${level.id}/${p}`)),
    ...(spec.extra ?? []).map((p) => read(`${level.id}/${p}`)),
  ];
  const bytes = buildCanonicalBytes(SQL, seed, overlays);
  const attachSql = spec.backup
    ? `ATTACH DATABASE ':memory:' AS backup;\n${renderTemplate(seedText, 'backup')}`
    : null;
  return { bytes, attachSql, writable: Boolean(level.writable) };
}

/** Every SQL file a level needs, as paths relative to src/levels/. */
export function levelFiles(level) {
  const spec = level.database;
  return [
    spec.seed,
    ...Object.values(spec.overlays ?? {}).flat(),
    ...(spec.extra ?? []),
  ].map((p) => `${level.id}/${p}`);
}
