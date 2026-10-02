import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Extend the existing manifest for this release without rebuilding older art.
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'config/responsive-images.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const slugs = [
  'proverki-ohrany-truda-itogi-2026',
  'antikorrupcionnyj-komplaens-trudovye-garantii-2026',
  'proizvodstvennyj-kontrol-neftegaz-2026',
  'vnutrennie-trenery-ohrana-truda-2026',
  'ii-umnye-kaski-ohrana-truda-2026',
];
await mkdir(path.join(root, 'public/images/optimized'), { recursive: true });
const report = [];
for (const slug of slugs) {
  const source = `/images/blog/${slug}-20261002.webp`;
  const buffer = await readFile(path.join(root, 'public', source.slice(1)));
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== 'webp' || metadata.width < 1200 || !metadata.height) {
    throw new Error(`Invalid source cover: ${source}`);
  }
  const hash = createHash('sha256').update(buffer).update('news-v1-avif58-webp85').digest('hex').slice(0, 12);
  const widths = [...new Set([320, 480, 768, 1152, metadata.width].filter(width => width <= metadata.width))].sort((a, b) => a - b);
  const variants = { avif: [], webp: [] };
  for (const width of widths) for (const format of ['avif', 'webp']) {
    const src = `/images/optimized/${slug}-20261002-${hash}-${width}.${format}`;
    const pipeline = sharp(buffer).rotate().resize({ width, withoutEnlargement: true });
    const output = format === 'avif' ? pipeline.avif({ quality: 58, effort: 6 }) : pipeline.webp({ quality: 85, effort: 6 });
    await output.toFile(path.join(root, 'public', src.slice(1)));
    variants[format].push({ src, width });
  }
  const entry = { src: variants.webp.at(-1).src, width: metadata.width, height: metadata.height, artSource: 'generated-photo', ...variants };
  manifest[source] = entry;
  manifest[entry.src] = entry;
  report.push({ source, width: metadata.width, height: metadata.height, originalBytes: buffer.byteLength, ...variants });
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await mkdir(path.join(root, 'artifacts/blog-news-2026-10-02'), { recursive: true });
await writeFile(path.join(root, 'artifacts/blog-news-2026-10-02/responsive-image-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Optimized ${report.length} new covers; existing image entries preserved.`);
