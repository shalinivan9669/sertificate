import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.output/public');
const origin = 'https://otcenter.kz';
const report = { root, checkedAt: new Date().toISOString(), html: 0, references: 0, buildIds: [], missing: [] };
const inspected = new Set();
const ids = new Set();
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}
function localFile(reference, source) {
  if (!reference || /^(data:|blob:|#|mailto:|tel:)/.test(reference)) return null;
  // HTML paths are resolved against the served route, with index.html removed.
  const relative = path.relative(root, source).replaceAll('\\', '/');
  const base = `${origin}/${relative.endsWith('index.html') ? relative.slice(0, -10) : relative}`;
  let url;
  try { url = new URL(reference.replaceAll('&amp;', '&'), base); } catch { return null; }
  if (url.origin !== origin) return null;
  const resolved = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  assert.ok(resolved.startsWith(root + path.sep), 'Asset must stay inside the chosen build artifact');
  return resolved;
}
async function check(reference, source) {
  const resolved = localFile(reference, source);
  if (!resolved) return;
  report.references++;
  const key = `${source}\0${resolved}`;
  if (inspected.has(key)) return;
  inspected.add(key);
  try { assert.equal((await stat(resolved)).isFile(), true); }
  catch { report.missing.push({ source: path.relative(root, source).replaceAll('\\', '/'), reference, expected: path.relative(root, resolved).replaceAll('\\', '/') }); }
}
for (const file of await walk(root)) {
  if (!/\.(html|css|js)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (file.endsWith('.html')) {
    report.html++;
    for (const [tag] of text.matchAll(/<(?:script|link|img|source)\b[^>]*>/gi)) {
      const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), value]));
      if (attrs.src) await check(attrs.src, file);
      if (attrs['data-src']) await check(attrs['data-src'], file);
      if (attrs.href && /(?:stylesheet|preload|modulepreload|prefetch|icon)/.test(attrs.rel || '')) await check(attrs.href, file);
      if (attrs.srcset) for (const candidate of attrs.srcset.split(',')) await check(candidate.trim().split(/\s+/, 1)[0], file);
    }
    for (const [, id] of text.matchAll(/(?:["']?buildId["']?\s*:\s*["']|[?&]_b=)([a-f0-9-]{36})/g)) ids.add(id);
  }
  if (file.endsWith('.css')) for (const [, reference] of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) await check(reference, file);
  if (file.endsWith('.js')) for (const [, reference] of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']((?:\.{1,2}\/|\/_nuxt\/)[^"']+)["']/g)) await check(reference, file);
}
report.buildIds = [...ids];
await mkdir('artifacts/seo', { recursive: true });
const label = root.replaceAll('\\', '/').includes('.vercel/') ? 'vercel' : 'node';
await writeFile(`artifacts/seo/${label}-assets.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ html: report.html, references: report.references, buildIds: report.buildIds, missing: report.missing.length, samples: report.missing.slice(0, 8) }, null, 2));
assert.equal(report.missing.length, 0, 'Every referenced local HTML/CSS/JS asset and extracted Nuxt payload must exist in this artifact');
assert.equal(report.buildIds.length, 1, 'Prerendered HTML must come from a single Nuxt build, without stale pages');
