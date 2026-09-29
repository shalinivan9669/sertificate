import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run manually with the installed sharp package path. Generated variants are
// committed, so production does not depend on a runtime image transformation API.
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const output = path.join(publicDir, 'images/optimized');
const previous = await readFile(path.join(root, 'config/responsive-images.json'), 'utf8').then(JSON.parse).catch(() => ({}));
await mkdir(output, { recursive: true });
const sources = [
  ['/images/editorial/workshop-mentor-v2.png'],
  ['/images/editorial/knowledge-city.png', '/images/editorial/knowledge-city-960.webp', '/images/editorial/knowledge-city-1920.webp'],
  ['/images/civic-city.png'],
  ['/Screenshot_8.webp'],
  ...(await readdir(path.join(publicDir, 'images/blog'))).filter(n => n.endsWith('.webp')).map(n => ['/images/blog/' + n]),
];
const manifest = {};
const report = [];
for (const aliases of sources) {
  const sourceUrl = aliases[0];
  const name = path.basename(sourceUrl, path.extname(sourceUrl));
  let input = path.join(publicDir, sourceUrl.slice(1));
  const replacement = path.join(root, 'output/blog-quality-v2', `${name}-source.png`);
  if (sourceUrl.startsWith('/images/blog/')) {
    if (await stat(replacement).catch(() => false)) input = replacement;
    else if (previous[sourceUrl]?.artSource === 'generated-photo' || await stat(path.join(publicDir, sourceUrl.slice(1).replace(/\.webp$/, '.svg'))).catch(() => false)) {
      throw new Error(`Missing original cover ${replacement}; restore the photo source before rebuilding, rather than replacing it with the retired diagram.`);
    }
  }
  const buffer = await readFile(input);
  const metadata = await sharp(buffer).metadata();
  const hash = createHash('sha256').update(buffer).update('responsive-v1-avif52-webp82-effort6').digest('hex').slice(0, 12);
  const widths = [...new Set([320, 480, 768, 1152, metadata.width].filter(w => w <= metadata.width))].sort((a,b) => a-b);
  const variants = { avif: [], webp: [] };
  for (const width of widths) {
    for (const format of ['avif', 'webp']) {
      const url = `/images/optimized/${name}-${hash}-${width}.${format}`;
      const file = path.join(publicDir, url.slice(1));
      if (!await stat(file).catch(() => false)) {
        const image = sharp(buffer).rotate().resize({ width, withoutEnlargement: true });
        await (format === 'avif' ? image.avif({ quality: 52, effort: 6 }) : image.webp({ quality: 82, effort: 6 })).toFile(file);
      }
      variants[format].push({ src: url, width });
    }
  }
  const entry = { width: metadata.width, height: metadata.height, src: variants.webp.at(-1).src, ...(input === replacement ? { artSource: 'generated-photo' } : {}), ...variants };
  for (const alias of [...aliases, entry.src]) manifest[alias] = entry;
  report.push({ source: sourceUrl, originalBytes: (await stat(path.join(publicDir, sourceUrl.slice(1)))).size,
    width: metadata.width, height: metadata.height, variants: await Promise.all(Object.entries(variants).flatMap(([format, files]) => files.map(async file => ({format,...file, bytes:(await stat(path.join(publicDir,file.src.slice(1)))).size})))) });
}
await writeFile(path.join(root, 'config/responsive-images.json'), JSON.stringify(manifest, null, 2) + '\n');
await mkdir(path.join(root, 'artifacts/performance-20260929'), { recursive: true });
await writeFile(path.join(root, 'artifacts/performance-20260929/image-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.map(r => ({source:r.source, before:r.originalBytes, avif768:r.variants.find(v => v.format === 'avif' && v.width === 768)?.bytes, largestWebp:r.variants.at(-1).bytes})), null, 2));
