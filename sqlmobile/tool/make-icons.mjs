// Usage: node make-icons.mjs <app-icon.svg> <flutter project dir>
// Writes Android legacy + adaptive launcher icons and every iOS AppIcon size.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg, initWasm } from './node_modules/@resvg/resvg-wasm/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
await initWasm(await readFile(path.join(here, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')));
const [svgFile, project] = process.argv.slice(2);
const svg = await readFile(svgFile, 'utf8');

const render = (src, px) => {
  const r = new Resvg(src, { fitTo: { mode: 'width', value: px } });
  const img = r.render();
  const png = Buffer.from(img.asPng());
  img.free(); r.free();
  return png;
};

const defs = svg.match(/<defs>[\s\S]*<\/defs>/)[0];
const body = svg.slice(svg.indexOf('</defs>') + 7, svg.lastIndexOf('</svg>')).split('\n');
const isBg = (l) => /url\(#(bg|light)\)/.test(l) && /M0 0h512v512H0z/.test(l);
const isFrame = (l) => /<rect x="24" y="24"/.test(l);
const bgLines = body.filter(isBg).join('\n');
const art = body.filter((l) => !isBg(l) && !isFrame(l)).join('\n');
const ns = 'xmlns="http://www.w3.org/2000/svg"';
const fullSvg = svg;
const bgSvg = `<svg ${ns} width="512" height="512" viewBox="0 0 512 512">${defs}${bgLines}</svg>`;
// Adaptive icons show a 72dp circle-ish window of a 108dp layer: keep the
// artwork inside the 66dp safe zone by giving it extra margin.
const fgSvg = `<svg ${ns} width="704" height="704" viewBox="-96 -96 704 704">${defs}${art}</svg>`;

const res = path.join(project, 'android/app/src/main/res');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const dir = path.join(res, `mipmap-${d}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'ic_launcher.png'), render(fullSvg, Math.round(48 * k)));
  await writeFile(path.join(dir, 'ic_launcher_foreground.png'), render(fgSvg, Math.round(108 * k)));
  await writeFile(path.join(dir, 'ic_launcher_background.png'), render(bgSvg, Math.round(108 * k)));
}
await mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
await writeFile(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`);

const iosSet = path.join(project, 'ios/Runner/Assets.xcassets/AppIcon.appiconset');
if (existsSync(path.join(iosSet, 'Contents.json'))) {
  const contents = JSON.parse(await readFile(path.join(iosSet, 'Contents.json'), 'utf8'));
  for (const img of contents.images) {
    if (!img.filename) continue;
    const px = Math.round(parseFloat(img.size) * parseFloat(img.scale));
    await writeFile(path.join(iosSet, img.filename), render(fullSvg, px));
  }
}
await writeFile(path.join(project, 'icon-preview-foreground.png'), render(fgSvg, 432));
console.log('icons written for', project);
