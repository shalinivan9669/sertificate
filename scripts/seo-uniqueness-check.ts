import fs from 'node:fs/promises';
import path from 'node:path';
import { cities } from '../content/cities';
import { courses } from '../content/courses';

type PageType = 'city' | 'course' | 'city-course';

type PageEntry = {
  route: string;
  locale: string;
  type: PageType;
  citySlug: string | null;
  courseSlug: string | null;
  canonicalPath: string | null;
  title: string;
  description: string;
  h1: string;
  shingles: Set<string>;
};

type DuplicateIssue = {
  kind: 'title' | 'h1' | 'title+description';
  a: string;
  b: string;
  value: string;
};

const OUTPUT_DIR = path.resolve('.output/public');
const SSR_BASE_URL = process.env.SEO_BASE_URL;
const SHINGLE_SIZE = 5;
const SIMILARITY_THRESHOLDS: Record<PageType, number> = {
  city: 0.7,
  course: 0.7,
  'city-course': 0.7,
};

const locales = ['ru', 'kk'];
const citySlugs = new Set(cities.map((city) => city.slug));

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

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, '"')
    .replace(/&raquo;/gi, '"');

const cleanText = (value: string) =>
  decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMeta = (value: string) => cleanText(value).toLowerCase();

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(match[1]) : '';
};

const extractMetaContent = (html: string, attrName: string, attrValue: string) => {
  const patterns = [
    new RegExp(
      `<meta[^>]*${attrName}=["']${attrValue}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${attrValue}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }

  return '';
};

const extractCanonicalHref = (html: string) => {
  const match = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i,
  );
  return match?.[1] || null;
};

const extractCanonicalPath = (html: string) => {
  const canonicalHref = extractCanonicalHref(html);
  if (!canonicalHref) return null;

  try {
    return normalizeRoute(new URL(canonicalHref, 'https://otcenter.kz').pathname);
  } catch {
    return null;
  }
};

const extractMainText = (html: string) => {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let text = mainMatch?.[1] ?? html;
  text = text.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return cleanText(text);
};

const extractFirstH1 = (html: string) => {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const source = mainMatch?.[1] ?? html;
  const match = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? cleanText(match[1]) : '';
};

const wordRegex = /[\p{L}\p{N}]+/gu;

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

const parseRouteInfo = (route: string) => {
  const parts = normalizeRoute(route).split('/').filter(Boolean);
  const localizedParts = parts[0] === 'kk' ? parts.slice(1) : parts;

  if (localizedParts[0] && citySlugs.has(localizedParts[0])) {
    return {
      citySlug: localizedParts[0],
      courseSlug: localizedParts[1] || null,
    };
  }

  return {
    citySlug: null,
    courseSlug: localizedParts[0] || null,
  };
};

const buildRoutes = () => {
  const cityRoutes = cities.map((city) => `/${city.slug}`);
  const courseRoutes = courses.map((course) => `/${course.slug}`);
  const cityCourseRoutes = cities.flatMap((city) =>
    courses.map((course) => `/${city.slug}/${course.slug}`),
  );

  return { cityRoutes, courseRoutes, cityCourseRoutes };
};

const readEntry = async (localizedRoute: string, type: PageType) => {
  const filePath = routeToFilePath(localizedRoute);
  const html = SSR_BASE_URL
    ? await fetch(new URL(localizedRoute, SSR_BASE_URL), { signal: AbortSignal.timeout(30_000) }).then(async (response) => {
      if (response.status !== 200) throw new Error(`${localizedRoute}: expected SSR 200, got ${response.status}`);
      return response.text();
    })
    : await fs.readFile(filePath, 'utf8');
  const text = extractMainText(html);
  if (!extractTitle(html) || !extractMetaContent(html, 'name', 'description') || !extractFirstH1(html)) {
    throw new Error(`${localizedRoute}: missing rendered title, description or H1`);
  }
  const words = toWords(text);
  const { citySlug, courseSlug } = parseRouteInfo(localizedRoute);
  const canonicalPath = extractCanonicalPath(html);

  return {
    entry: {
      route: localizedRoute,
      locale: localizedRoute.startsWith('/kk') ? 'kk' : 'ru',
      type,
      citySlug,
      courseSlug,
      canonicalPath,
      title: extractTitle(html),
      description: extractMetaContent(html, 'name', 'description'),
      h1: extractFirstH1(html),
      shingles: buildShingles(words, SHINGLE_SIZE),
    } satisfies PageEntry,
    canonicalPath,
  };
};

const buildEntries = async () => {
  const { cityRoutes, courseRoutes, cityCourseRoutes } = buildRoutes();
  const entries: PageEntry[] = [];
  const canonicalIssues: Array<{ route: string; canonicalPath: string | null }> = [];

  for (const locale of locales) {
    for (const route of cityRoutes) {
      const localizedRoute = withLocale(route, locale);
      const { entry, canonicalPath } = await readEntry(localizedRoute, 'city');
      if (canonicalPath !== normalizeRoute(localizedRoute)) {
        canonicalIssues.push({ route: localizedRoute, canonicalPath });
      }
      entries.push(entry);
    }

    for (const route of courseRoutes) {
      const localizedRoute = withLocale(route, locale);
      const { entry, canonicalPath } = await readEntry(localizedRoute, 'course');
      if (canonicalPath !== normalizeRoute(localizedRoute)) {
        canonicalIssues.push({ route: localizedRoute, canonicalPath });
      }
      entries.push(entry);
    }

    for (const route of cityCourseRoutes) {
      const localizedRoute = withLocale(route, locale);
      const { entry, canonicalPath } = await readEntry(localizedRoute, 'city-course');
      if (canonicalPath !== normalizeRoute(localizedRoute)) {
        canonicalIssues.push({ route: localizedRoute, canonicalPath });
      }
      entries.push(entry);
    }
  }

  return { entries, canonicalIssues };
};

const collectDuplicateIssues = (list: PageEntry[]) => {
  const duplicates: DuplicateIssue[] = [];
  const titleMap = new Map<string, string>();
  const h1Map = new Map<string, string>();
  const titleDescriptionMap = new Map<string, string>();

  list.forEach((entry) => {
    const titleKey = normalizeMeta(entry.title);
    const h1Key = normalizeMeta(entry.h1);
    const titleDescriptionKey = `${normalizeMeta(entry.title)}|${normalizeMeta(entry.description)}`;

    if (titleKey) {
      const existingRoute = titleMap.get(titleKey);
      if (existingRoute && existingRoute !== entry.route) {
        duplicates.push({ kind: 'title', a: existingRoute, b: entry.route, value: entry.title });
      } else {
        titleMap.set(titleKey, entry.route);
      }
    }

    if (h1Key) {
      const existingRoute = h1Map.get(h1Key);
      if (existingRoute && existingRoute !== entry.route) {
        duplicates.push({ kind: 'h1', a: existingRoute, b: entry.route, value: entry.h1 });
      } else {
        h1Map.set(h1Key, entry.route);
      }
    }

    if (titleDescriptionKey !== '|') {
      const existingRoute = titleDescriptionMap.get(titleDescriptionKey);
      if (existingRoute && existingRoute !== entry.route) {
        duplicates.push({
          kind: 'title+description',
          a: existingRoute,
          b: entry.route,
          value: `${entry.title} | ${entry.description}`,
        });
      } else {
        titleDescriptionMap.set(titleDescriptionKey, entry.route);
      }
    }
  });

  return duplicates;
};

const canIgnoreTemplateSimilarity = (a: PageEntry, b: PageEntry) => {
  const sameCourseAcrossCities =
    a.type === 'city-course' &&
    b.type === 'city-course' &&
    Boolean(a.courseSlug) &&
    a.courseSlug === b.courseSlug &&
    Boolean(a.citySlug) &&
    Boolean(b.citySlug) &&
    a.citySlug !== b.citySlug;

  const differentNationalCourses =
    a.type === 'course' &&
    b.type === 'course' &&
    Boolean(a.courseSlug) &&
    Boolean(b.courseSlug) &&
    a.courseSlug !== b.courseSlug;

  if (!sameCourseAcrossCities && !differentNationalCourses) return false;

  return (
    normalizeMeta(a.title) !== normalizeMeta(b.title) &&
    normalizeMeta(a.description) !== normalizeMeta(b.description) &&
    normalizeMeta(a.h1) !== normalizeMeta(b.h1)
  );
};

const run = async () => {
  if (!SSR_BASE_URL) {
    try {
      await fs.access(OUTPUT_DIR);
    } catch {
      throw new Error(`No rendered HTML found at ${OUTPUT_DIR}. Build first or set SEO_BASE_URL to a running SSR server.`);
    }
  }

  const { entries, canonicalIssues } = await buildEntries();
  const groups = new Map<string, PageEntry[]>();

  entries.forEach((entry) => {
    const key = `${entry.type}|${entry.locale}`;
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
  });

  const topPairs: Array<{ a: string; b: string; similarity: number }> = [];
  const duplicateIssues: DuplicateIssue[] = [];
  let hasFailures = false;
  let hasSimilarityWarnings = false;

  for (const [groupKey, list] of groups.entries()) {
    duplicateIssues.push(...collectDuplicateIssues(list));

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const left = list[i]!; const right = list[j]!;
        const similarity = jaccardSimilarity(left.shingles, right.shingles);
        const threshold = SIMILARITY_THRESHOLDS[left.type];
        const ignoreTemplateSimilarity = canIgnoreTemplateSimilarity(left, right);

        if (similarity >= threshold && !ignoreTemplateSimilarity) {
          hasSimilarityWarnings = true;
        }

        topPairs.push({
          a: left.route,
          b: right.route,
          similarity,
        });
      }
    }

    console.log(
      `Checked ${groupKey} (${list.length} pages) with threshold ${list[0] ? SIMILARITY_THRESHOLDS[list[0].type] : 'n/a'}`,
    );
  }

  if (canonicalIssues.length) {
    hasFailures = true;
    console.log('\nCanonical mismatches:');
    canonicalIssues.slice(0, 10).forEach((issue) => {
      console.log(`${issue.route} -> ${issue.canonicalPath}`);
    });
  }

  if (duplicateIssues.length) {
    hasFailures = true;
    console.log('\nDuplicate metadata issues:');
    duplicateIssues.slice(0, 10).forEach((issue) => {
      console.log(`${issue.kind}: ${issue.a} <-> ${issue.b}`);
    });
  }

  topPairs.sort((a, b) => b.similarity - a.similarity);
  console.log('\nTop similar pairs:');
  topPairs.slice(0, 10).forEach((pair) => {
    console.log(`${pair.similarity.toFixed(3)}  ${pair.a}  <->  ${pair.b}`);
  });

  if (hasFailures) {
    console.error('\nUniqueness check failed: canonical or metadata contracts violated.');
    process.exitCode = 1;
  } else {
    console.log('\nCanonical and metadata checks passed.');
  }
  if (hasSimilarityWarnings) console.warn('Content similarity needs editorial review; shingle similarity alone is not a correctness gate.');
};

run().catch((error) => {
  console.error('Uniqueness check error:', error);
  process.exitCode = 1;
});
