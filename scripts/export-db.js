// Builds a real SQLite file from the seed so you can open the evidence in
// any SQLite tool (DB Browser for SQLite, the sqlite3 CLI, VS Code extensions).
//   npm run db:export            -> dist-db/observatory.sqlite
//   npm run db:export -- out.db  -> out.db
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { buildCanonicalBytes } from '../src/sql/engine.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.resolve(process.argv[2] ?? path.join(root, 'dist-db', 'observatory.sqlite'));

const SQL = await initSqlJs();
const seed = fs.readFileSync(path.join(root, 'src', 'case', 'seed.sql'), 'utf8');
const bytes = buildCanonicalBytes(SQL, seed);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
console.log(`Wrote ${bytes.length.toLocaleString()} bytes to ${out}`);
