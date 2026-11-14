import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = ['index.html', 'style.css', 'calendar.js', 'effects.js'];
for (const file of await readdir(new URL('public/assets/', root))) {
  files.push('assets/' + file);
}
const assets = Object.fromEntries(await Promise.all(files.map(async file => {
  const bytes = await readFile(new URL('public/' + file, root));
  return ['/' + file, bytes.toString('base64')];
})));
const calendar = JSON.parse(await readFile(new URL('src/calendar.json', root), 'utf8'));
if (calendar.length !== 24 || calendar.some((item, index) => item.day !== index + 1)) {
  throw new Error('The schedule must contain December 1 through 24 in order.');
}
for (const project of calendar) {
  if (!Number.isInteger(project.started) || project.started < 1900 || project.started > 2026) {
    throw new Error('Set a valid start year for ' + project.title + '.');
  }
}
const worker = await readFile(new URL('src/worker.mjs', root), 'utf8');
await mkdir(new URL('dist/server/', root), { recursive: true });
await writeFile(new URL('dist/server/index.js', root),
  'const calendar = ' + JSON.stringify(calendar) + ';\nconst files = ' + JSON.stringify(assets) + ';\n' + worker);
