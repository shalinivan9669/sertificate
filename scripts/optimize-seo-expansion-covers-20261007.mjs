import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only these six covers are in scope. Existing images and manifest entries are
// retained; no original PNG is copied into the public directory.
const articles = [
  { contentId: 'N04', slug: 'kp-na-obuchenie-personala-kak-sravnit' },
  { contentId: 'N05', slug: 'audit-obucheniya-pered-koncom-goda' },
  { contentId: 'N06', slug: 'iso-9001-2026-obuchenie-plan-2027' },
  { contentId: 'N07', slug: 'iso-14001-2026-podgotovka-personala' },
  { contentId: 'N10', slug: 'pervaya-pomoshch-vybor-kursa-dlya-kompanii' },
  { contentId: 'N11', slug: 'obuchenie-smennoy-komandy-yazyki-grafik' },
];
const settings = { avif: { quality: 63, effort: 6 }, webp: { quality: 90, effort: 6 } };
const encodingSalt = 'seo-expansion-20261007-v1-avif63-webp90-effort6-auto-orient';
const [sharpPackage, sourceDirectory, reportArgument] = process.argv.slice(2);
if (!sharpPackage || !sourceDirectory || !reportArgument) {
  throw new Error('Usage: node scripts/optimize-seo-expansion-covers-20261007.mjs <sharp-package-path> <source-directory> <report-path>');
}
const require = createRequire(import.meta.url);
const sharp = require(sharpPackage);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(root, 'public');
const sourceRoot = path.resolve(sourceDirectory);
const reportPath = path.resolve(reportArgument);
const manifestPath = path.join(root, 'config/responsive-images.json');
if (reportPath === manifestPath) throw new Error('The generation report must not replace the image manifest.');
const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!previous || typeof previous !== 'object' || Array.isArray(previous)) {
  throw new Error('The existing responsive image manifest must be an object.');
}
const manifest = { ...previous };
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

// Validate the complete input set and plan keys before writing any public asset.
const plans = [];
const masterHashes = new Set();
for (const article of articles) {
  const sourcePath = path.join(sourceRoot, `${article.slug}-source.png`);
  const buffer = await readFile(sourcePath);
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== 'png' || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)
    || metadata.width < 1 || metadata.height < 1 || (metadata.pages || 1) !== 1) {
    throw new Error(`Expected one non-empty PNG image: ${sourcePath}`);
  }
  const masterSha256 = sha256(buffer);
  if (masterHashes.has(masterSha256)) throw new Error(`Duplicate master image: ${sourcePath}`);
  masterHashes.add(masterSha256);
  const swapsDimensions = metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = swapsDimensions ? metadata.height : metadata.width;
  const height = swapsDimensions ? metadata.width : metadata.height;
  const hash = createHash('sha256').update(buffer).update(encodingSalt).digest('hex').slice(0, 12);
  const widths = [...new Set([320, 480, 768, 1152, 1536, width].filter(value => value <= width))].sort((a, b) => a - b);
  const variants = { avif: [], webp: [] };
  for (const targetWidth of widths) for (const format of ['avif', 'webp']) {
    variants[format].push({
      src: `/images/optimized/${article.slug}-20261007-${hash}-${targetWidth}.${format}`,
      width: targetWidth,
    });
  }
  const entry = { src: variants.webp.at(-1).src, width, height, artSource: 'generated-image', ...variants };
  if (Object.hasOwn(previous, entry.src) && !isDeepStrictEqual(previous[entry.src], entry)) {
    throw new Error(`Refusing to change an existing manifest entry: ${entry.src}`);
  }
  plans.push({ ...article, sourcePath, buffer, masterSha256, hash, entry });
}

async function writeJsonAtomically(destination, value) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

await mkdir(path.join(publicDirectory, 'images/optimized'), { recursive: true });
const report = [];
for (const plan of plans) {
  const assets = [];
  for (const format of ['avif', 'webp']) for (const variant of plan.entry[format]) {
    const filePath = path.join(publicDirectory, variant.src.slice(1));
    const encoded = await sharp(plan.buffer).rotate().resize({ width: variant.width, withoutEnlargement: true })[format](settings[format]).toBuffer();
    const metadata = await sharp(encoded).metadata();
    if (metadata.width !== variant.width || !metadata.height) throw new Error(`Unexpected output dimensions: ${variant.src}`);
    await writeFile(filePath, encoded);
    assets.push({ src: variant.src, filePath, format, width: metadata.width, height: metadata.height, sha256: sha256(encoded), bytes: encoded.byteLength });
  }
  manifest[plan.entry.src] = plan.entry;
  report.push({
    contentId: plan.contentId,
    slug: plan.slug,
    sourcePath: plan.sourcePath,
    masterSha256: plan.masterSha256,
    masterBytes: plan.buffer.byteLength,
    width: plan.entry.width,
    height: plan.entry.height,
    encodingHash: plan.hash,
    imageSrc: plan.entry.src,
    assets,
  });
}
for (const [key, value] of Object.entries(previous)) {
  if (!isDeepStrictEqual(manifest[key], value)) throw new Error(`Existing manifest entry changed: ${key}`);
}
await writeJsonAtomically(reportPath, {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  encodingSalt,
  settings,
  previousManifestEntries: Object.keys(previous).length,
  currentManifestEntries: Object.keys(manifest).length,
  covers: report,
});
await writeJsonAtomically(manifestPath, manifest);
console.log(`Optimized ${report.length} SEO expansion covers; preserved all ${Object.keys(previous).length} existing manifest entries. Report: ${reportPath}`);
