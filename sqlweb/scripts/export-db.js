// Builds real SQLite files from the level seeds so you can open the evidence
// in any SQLite tool (DB Browser for SQLite, the sqlite3 CLI, VS Code extensions).
//   npm run db:export             -> dist-db/<level>.sqlite for every level
//   npm run db:export -- coldcase -> just that level
// Level 4 also gets its backup as dist-db/tampered-backup.sqlite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { LEVELS } from '../src/levels/index.js';
import { prepareLevel, renderTemplate } from '../src/levels/database.js';
import { buildCanonicalBytes } from '../src/sql/engine.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'dist-db');
const read = (p) => fs.readFileSync(path.join(root, 'src', 'levels', p), 'utf8');
const wanted = process.argv[2];

const SQL = await initSqlJs();
fs.mkdirSync(outDir, { recursive: true });

const write = (name, bytes) => {
  const out = path.join(outDir, name);
  fs.writeFileSync(out, bytes);
  console.log(`Wrote ${bytes.length.toLocaleString()} bytes to ${out}`);
};

for (const level of LEVELS.filter((l) => !wanted || l.id === wanted)) {
  write(`${level.id}.sqlite`, prepareLevel(SQL, level, 'en', read).bytes);
  if (level.database.backup) {
    write(`${level.id}-backup.sqlite`, buildCanonicalBytes(SQL, renderTemplate(read(`${level.id}/${level.database.seed}`), 'main')));
  }
}
