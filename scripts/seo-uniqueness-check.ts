import fs from 'node:fs/promises';
import path from 'node:path';
import { cities } from '../content/cities';
import { courses } from '../content/courses';

type PageType = 'city' | 'city-course';

type PageEntry = {
  route: string;
  locale: string;
  type: PageType;
  shingles: Set<string>;
};

const OUTPUT_DIR = path.resolve('.output/public');
const SHINGLE_SIZE = 5;
const SIMILARITY_THRESHOLD = 0.7;

const locales = ['ru', 'kk'];

const normalizeRoute = (route: string) => (route !== '/' ? route.replace(/\/+$/, '') : '/');

const withLocale = (route: string, locale: string) => {
  if (locale === 'ru') return route;
  return route === '/' ? `/${locale}` : `/${locale}${route}`;
};

const routeToFilePath = (route: string) => {
  const normalized = normalizeRoute(route);
  const relativePath =
    normalized === '/' ? 'index.html' : path.join(normalized.slice(1), 'index.html');
  return path.join(OUTPUT_DIR, relativePath);
};

const extractMainText = (html: string) => {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let text = mainMatch ? mainMatch[1] : html;
  text = text.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  return text.replace(/\s+/g, ' ').trim();
};

const wordRegex = /[A-Za-zА-Яа-яЁёӘәӨөҮүҚқҒғІі0-9]+/g;

const toWords = (text: string) => text.toLowerCase().match(wordRegex) || [];

const buildShingles = (words: string[], size: number) => {
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - size; i += 1) {
    shingles.add(words.slice(i, i + size).join(' '));
  }
  return shingles;
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const buildRoutes = () => {
  const cityRoutes = cities.map((city) => `/${city.slug}`);
  const cityCourseRoutes = cities.flatMap((city) =>
    courses.map((course) => `/${city.slug}/${course.slug}`),
  );
  return { cityRoutes, cityCourseRoutes };
};

const buildEntries = async () => {
  const { cityRoutes, cityCourseRoutes } = buildRoutes();
  const entries: PageEntry[] = [];

  for (const locale of locales) {
    for (const route of cityRoutes) {
      const localizedRoute = withLocale(route, locale);
      const filePath = routeToFilePath(localizedRoute);
      const html = await fs.readFile(filePath, 'utf8');
      const text = extractMainText(html);
      const words = toWords(text);
      entries.push({
        route: localizedRoute,
        locale,
        type: 'city',
        shingles: buildShingles(words, SHINGLE_SIZE),
      });
    }

    for (const route of cityCourseRoutes) {
      const localizedRoute = withLocale(route, locale);
      const filePath = routeToFilePath(localizedRoute);
      const html = await fs.readFile(filePath, 'utf8');
      const text = extractMainText(html);
      const words = toWords(text);
      entries.push({
        route: localizedRoute,
        locale,
        type: 'city-course',
        shingles: buildShingles(words, SHINGLE_SIZE),
      });
    }
  }

  return entries;
};

const run = async () => {
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    console.log(
      `Uniqueness check skipped: ${OUTPUT_DIR} not found. Run after static generate.`,
    );
    return;
  }

  const entries = await buildEntries();
  const groups = new Map<string, PageEntry[]>();

  entries.forEach((entry) => {
    const key = `${entry.type}|${entry.locale}`;
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
  });

  const topPairs: Array<{ a: string; b: string; similarity: number }> = [];
  let hasFailures = false;

  for (const [groupKey, list] of groups.entries()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const similarity = jaccardSimilarity(list[i].shingles, list[j].shingles);
        if (similarity >= SIMILARITY_THRESHOLD) {
          hasFailures = true;
        }
        topPairs.push({
          a: list[i].route,
          b: list[j].route,
          similarity,
        });
      }
    }
    console.log(
      `Checked ${groupKey} (${list.length} pages) with threshold ${SIMILARITY_THRESHOLD}`,
    );
  }

  topPairs.sort((a, b) => b.similarity - a.similarity);
  console.log('\nTop similar pairs:');
  topPairs.slice(0, 10).forEach((pair) => {
    console.log(`${pair.similarity.toFixed(3)}  ${pair.a}  <->  ${pair.b}`);
  });

  if (hasFailures) {
    console.error('\nUniqueness check failed: similarity above threshold.');
    process.exitCode = 1;
  } else {
    console.log('\nUniqueness check passed.');
  }
};

run().catch((error) => {
  console.error('Uniqueness check error:', error);
  process.exitCode = 1;
});
