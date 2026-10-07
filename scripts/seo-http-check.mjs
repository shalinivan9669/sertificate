import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { courses } from '../config/courses.js';
import { formats } from '../config/formats.js';
import { additionalSourceDirections } from '../shared/source-products.ts';
import { getPublicCourseSeo } from '../shared/public-course-seo.ts';
import { blogPosts } from '../config/blog.js';
import { getPublishedBlogLocales } from '../config/blog-publication.js';
import {
  buildPublicRoutes, canonicalPublicPath, courseCardAliases, defaultSiteUrl, isNonIndexableRoute, localizePublicPath, stripLocale,
} from '../config/public-route-policy.js';

const decodeEntities = (value) => value
  .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (entity) => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity])
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => String.fromCodePoint(number[0].toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number(number)));

const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(([, key, doubleQuoted, singleQuoted]) => [key.toLowerCase(), decodeEntities(doubleQuoted ?? singleQuoted)]),
);

export function buildCourseContractRoutes() {
  const routes = [...courses.map(({ slug }) => `/courses/${slug}`),
    ...additionalSourceDirections.map(({ id }) => `/courses/${id}`),
    ...Object.keys(courseCardAliases).map((alias) => `/courses/${alias}`)];
  return [...new Set(routes.flatMap((route) => [route, localizePublicPath(route, 'kk')]))];
}

export function assertCourseMetadataUniqueness(records) {
  const seen = new Map();
  for (const record of records) {
    if (!/^\/courses\/[^/]+$/.test(stripLocale(record.route))) continue;
    const locale = record.route.startsWith('/kk/') ? 'kk' : 'ru';
    const canonicalGroup = canonicalPublicPath(record.route);
    for (const field of ['title', 'description']) {
      assert.ok(record[field]?.trim(), `${record.route}: course ${field} must not be empty`);
      const key = `${locale}|${field}|${record[field]?.trim().toLocaleLowerCase()}`;
      const prior = seen.get(key);
      assert.ok(!prior || prior.canonicalGroup === canonicalGroup,
        `${record.route}: duplicate course ${field} with ${prior?.route}`);
      seen.set(key, { route: record.route, canonicalGroup });
    }
  }
}

export function inspectPublicHeaders(headers, route, options = {}) {
  const robots = headers.get('x-robots-tag') || '';
  if (options.indexable !== false) {
    assert.doesNotMatch(robots, /\b(?:noindex|none)\b/i, `${route}: public HTTP headers must allow indexing`);
  }
}

export function assertStablePublicSeo(reference, variant, route) {
  for (const field of ['canonical', 'title', 'description', 'h1']) {
    assert.equal(variant[field], reference[field], `${route}: journey preferences must preserve ${field}`);
  }
}

export function inspectPublicHtml(html, route, siteUrl = defaultSiteUrl, options = {}) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const canonical = links.filter(({ rel }) => rel === 'canonical');
  assert.equal(canonical.length, 1, `${route}: exactly one canonical`);
  const expectedPath = canonicalPublicPath(route);
  assert.equal(new URL(canonical[0].href).toString(), new URL(expectedPath, siteUrl).toString(), `${route}: expected canonical`);
  assert.equal((html.match(/<title\b/gi) || []).length, 1, `${route}: one title`);
  assert.equal(metas.filter(({ name }) => name === 'description').length, 1, `${route}: one description`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${route}: one SSR H1`);
  const robots = metas.filter(({ name }) => /^(?:robots|googlebot|googlebot-news)$/i.test(name || ''))
    .map(({ content }) => content || '').join(',');
  if (options.indexable === false) {
    assert.match(robots, /\b(?:noindex|none)\b/i, `${route}: explicit non-indexable environment`);
  } else {
    assert.doesNotMatch(robots, /\b(?:noindex|none)\b/i, `${route}: indexable`);
  }
  const article = blogPosts.find((post) => post._path === stripLocale(expectedPath));
  const publishedLocales = article ? getPublishedBlogLocales(article) : ['ru', 'kk'];
  const expectedAlternates = publishedLocales.length > 1 ? [['ru', 'ru-KZ'], ['kk', 'kk-KZ'], ['ru', 'x-default']] : [];
  const alternates = links.filter((link) => link.rel === 'alternate' && link.hreflang);
  assert.ok(expectedAlternates.length ? [3, 5].includes(alternates.length) : alternates.length === 0, `${route}: alternates exist only for published equivalents`);
  // Nuxt i18n may also emit the base-language pair alongside its regional pair.
  // Both forms describe the same real translations and must target those URLs.
  const allowedAlternates = new Map(expectedAlternates.length ? [...expectedAlternates, ['ru', 'ru'], ['kk', 'kk']].map(([locale, hreflang]) => [hreflang, locale]) : []);
  for (const alternate of alternates) {
    const locale = allowedAlternates.get(alternate.hreflang);
    assert.ok(locale, `${route}: unsupported ${alternate.hreflang} alternate`);
    assert.equal(alternates.filter((link) => link.hreflang === alternate.hreflang).length, 1, `${route}: exactly one ${alternate.hreflang} alternate`);
    assert.equal(new URL(alternate.href).toString(), new URL(localizePublicPath(expectedPath, locale), siteUrl).toString(), `${route}: ${alternate.hreflang} alternate targets preferred route`);
  }
  for (const [locale, hreflang] of expectedAlternates) {
    const equivalents = alternates.filter((link) => link.hreflang === hreflang);
    assert.equal(equivalents.length, 1, `${route}: exactly one ${hreflang} alternate`);
    assert.equal(new URL(equivalents[0].href).toString(), new URL(localizePublicPath(expectedPath, locale), siteUrl).toString(), `${route}: ${hreflang} alternate targets preferred route`);
  }
  assert.match(html, route.startsWith('/kk') ? /<html\b[^>]*lang=["']kk-KZ["']/ : /<html\b[^>]*lang=["']ru-KZ["']/);
  assert.doesNotMatch(html, /"@type"\s*:\s*"LocalBusiness"/, `${route}: no invented city branches`);
  assert.doesNotMatch(html, /New flow entry|SEO-страница остаётся|runtime-flow/, `${route}: no developer copy`);
  const title = decodeEntities(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || '');
  const description = metas.find(({ name }) => name === 'description')?.content || '';
  const courseId = stripLocale(expectedPath).match(/^\/courses\/([^/]+)$/)?.[1];
  if (courseId) {
    const expected = getPublicCourseSeo(courseId, route.startsWith('/kk/') ? 'kk' : 'ru');
    assert.ok(expected, `${route}: known course metadata`);
    assert.equal(title, expected.title, `${route}: course title matches locale and direction`);
    assert.equal(description, expected.description, `${route}: course description matches locale and direction`);
    for (const [attribute, name, value] of [
      ['property', 'og:title', expected.title], ['property', 'og:description', expected.description],
      ['name', 'twitter:title', expected.title], ['name', 'twitter:description', expected.description],
    ]) {
      const found = metas.filter((meta) => meta[attribute] === name);
      assert.equal(found.length, 1, `${route}: exactly one ${name}`);
      assert.equal(found[0].content, value, `${route}: ${name} matches course metadata`);
    }
  }
  const h1 = decodeEntities(html.match(/<h1\b[^>]*>(.*?)<\/h1>/is)?.[1] || '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return { canonical: canonical[0].href, title, description, h1 };
}

export async function runHttpSeoCheck(baseUrl, siteUrl = defaultSiteUrl, options = { all: false }) {
  assert.ok(baseUrl, 'Pass the URL of an already running local/staging SSR server');
  const report = { baseUrl, canonicalHost: siteUrl, indexable: options.indexable !== false, checkedAt: new Date().toISOString(), inventoryMode: options.all ? 'all' : 'sample', public: [], queryVariants: [], private: [], missing: [] };
  const check = async (route) => {
    const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    return { response, html: await response.text() };
  };
  const sample = ['/', '/contacts', '/licenses', '/courses', '/b2b', '/karaganda',
    '/karaganda/ohrana-truda', '/karaganda/promyshlennaya-bezopasnost',
    '/karaganda/online-obuchenie', ...courses.map(({ slug }) => `/${slug}`),
    ...additionalSourceDirections.map(({ id }) => `/courses/${id}`)];
  const publicRoutes = [...new Set([
    ...(options.all ? buildPublicRoutes() : sample.flatMap((route) => [route, localizePublicPath(route, 'kk')])),
    ...buildCourseContractRoutes(),
  ])];
  for (const route of publicRoutes) {
    const { response, html } = await check(route);
    assert.equal(response.status, 200, `${route}: public HTTP 200`);
    inspectPublicHeaders(response.headers, route, { indexable: options.indexable });
    report.public.push({ route, status: response.status, ...inspectPublicHtml(html, route, siteUrl, { indexable: options.indexable }) });
  }
  assertCourseMetadataUniqueness(report.public);
  // Query preferences remain usable by conversion links, while each format's
  // indexable identity is owned by its national/city path in both languages.
  const stableFormatRoutes = [...formats.map(({ slug }) => `/${slug}`), '/almaty/online-obuchenie']
    .flatMap((route) => [route, localizePublicPath(route, 'kk')]);
  for (const route of stableFormatRoutes) {
    let reference = report.public.find((record) => record.route === route);
    if (!reference) {
      const { response, html } = await check(route);
      assert.equal(response.status, 200, `${route}: format baseline HTTP 200`);
      inspectPublicHeaders(response.headers, route, { indexable: options.indexable });
      reference = inspectPublicHtml(html, route, siteUrl, { indexable: options.indexable });
    }
    const variantRoute = `${route}?city=astana&format=onsite`;
    const { response, html } = await check(variantRoute);
    assert.equal(response.status, 200, `${variantRoute}: preferences remain accessible`);
    inspectPublicHeaders(response.headers, variantRoute, { indexable: options.indexable });
    const variant = inspectPublicHtml(html, variantRoute, siteUrl, { indexable: options.indexable });
    assertStablePublicSeo(reference, variant, variantRoute);
    report.queryVariants.push({ route: variantRoute, status: response.status, ...variant });
  }
  const unpublishedArticleRoutes = blogPosts.flatMap((post) => ['ru', 'kk'].filter((locale) => !getPublishedBlogLocales(post).includes(locale)).map((locale) => localizePublicPath(post._path, locale)));
  for (const route of ['/not-a-city/not-a-course', '/karaganda/not-a-course', '/unknown-direction',
    '/unknown-city/online-obuchenie', '/kk/unknown-city/ohrana-truda', '/courses/unknown-course', ...unpublishedArticleRoutes]) {
    const { response } = await check(route);
    assert.equal(response.status, 404, `${route}: real HTTP 404 without fallback redirect`);
    report.missing.push({ route, status: response.status });
  }
  for (const route of ['/cabinet', '/kk/cabinet', '/learn/industrial-safety/exam',
    '/payment/pending', '/kk/payment/pending', '/certificates/unknown', '/auth/login',
    '/admin', '/verify/unknown', '/program-selection']) {
    const { response } = await check(route);
    assert.ok(response.status < 500, `${route}: no server error`);
    assert.match(response.headers.get('cache-control') || '', /no-store/, `${route}: no shared cache`);
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/, `${route}: header noindex`);
    report.private.push({ route, status: response.status, cacheControl: response.headers.get('cache-control') });
  }
  const sitemap = await check('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  assert.match(sitemap.html, /<urlset\b/);
  const locations = [...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => new URL(loc.replaceAll('&amp;', '&')).toString());
  const expected = new Set(buildPublicRoutes().map((route) => new URL(route, siteUrl).toString()));
  assert.equal(locations.length, expected.size, 'sitemap matches explicit public inventory');
  assert.equal(new Set(locations).size, expected.size, 'sitemap contains each expected URL exactly once');
  for (const loc of locations) {
    assert.ok(expected.has(loc), `unexpected sitemap location ${loc}`);
    assert.equal(isNonIndexableRoute(new URL(loc).pathname), false);
  }
  report.sitemap = { status: sitemap.response.status, urls: locations.length };
  const robots = await check('/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.doesNotMatch(robots.html, /Disallow:\s*\/_nuxt/i);
  if (options.indexable === false) {
    assert.match(robots.html, /Disallow:\s*\/\s*(?:\r?\n|$)/i, 'explicit non-indexable environment blocks all crawling');
  } else {
    assert.match(robots.html, /Sitemap:/i);
    assert.doesNotMatch(robots.html, /Disallow:\s*\/\s*(?:\r?\n|$)/i, 'indexable environment allows public crawling');
  }
  report.robots = { status: robots.response.status, assetsAllowed: options.indexable !== false };
  const artifactDir = path.resolve(options.artifactDir || process.env.SEO_ARTIFACT_DIR || 'artifacts/seo');
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, `http-contract${options.all ? '-all' : ''}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const artifactFlag = process.argv.indexOf('--artifact-dir');
  assert.ok(artifactFlag === -1 || (process.argv[artifactFlag + 1] && !process.argv[artifactFlag + 1].startsWith('--')), '--artifact-dir requires a directory');
  const baseUrl = process.argv.slice(2).find((argument, index, args) => !argument.startsWith('--') && args[index - 1] !== '--artifact-dir');
  runHttpSeoCheck(baseUrl || process.env.SEO_BASE_URL, process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl, { all: process.argv.includes('--all'), indexable: process.env.OT_NOINDEX !== 'true', artifactDir: artifactFlag === -1 ? undefined : process.argv[artifactFlag + 1] })
    .then((report) => console.log(`SEO HTTP contracts passed: ${report.public.length} public, ${report.private.length} private, ${report.missing.length} 404 routes; ${report.sitemap.urls} sitemap URLs.`))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
