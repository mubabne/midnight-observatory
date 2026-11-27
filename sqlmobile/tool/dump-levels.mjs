import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
const [web, out] = process.argv.slice(2);
const { LEVELS } = await import(pathToFileURL(path.join(web, 'src/levels/index.js')).href);
const { levelFiles } = await import(pathToFileURL(path.join(web, 'src/levels/database.js')).href);
const levels = LEVELS.map((l) => {
  const endings = {};
  if (l.ending) for (const lang of Object.keys(l.content)) endings[lang] = l.ending(lang);
  for (const f of levelFiles(l)) {
    const dest = path.join(out, 'levels', f);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(web, 'src/levels', f), dest);
  }
  return { id: l.id, number: l.number, kind: l.kind, writable: Boolean(l.writable), database: l.database,
    personLookup: l.personLookup ?? null, content: l.content, endings };
});
writeFileSync(path.join(out, 'levels.json'), JSON.stringify({ levels }, null, 1));
console.log(levels.map((l) => `${l.id} ${Object.keys(l.content)} lessons=${l.content.en.lessons?.length ?? 0} hints=${l.content.en.hints?.length ?? 0}`).join('\n'));
