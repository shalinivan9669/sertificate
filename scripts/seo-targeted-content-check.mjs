import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { courseDirections, legacyCourseDirections, getCoursePublicPath } from '../shared/course-registry.ts';
import { getCourseSearchContent } from '../shared/course-search-content.ts';
import { blogPosts, getSortedBlogPosts } from '../config/blog.js';
import { canonicalPublicPath, localizePublicPath } from '../config/public-route-runtime.js';
import { publicMoneyFindings } from '../shared/public-data-guard.ts';

const origin = process.argv[2];
assert.match(origin || '', /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/, 'Use an explicitly local, already built preview');
const reportDirectory = resolve(process.argv[3] || 'artifacts/seo-targeted');
const canonicalOrigin = process.env.NUXT_PUBLIC_SITE_URL || 'https://www.otcenter.kz';
const decode = value => value.replace(/&(amp|quot|apos|lt|gt|nbsp);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity])
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => String.fromCodePoint(number[0].toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number(number)));
const visibleText = html => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const links = html => [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].flatMap(([, href]) => {
  const url = new URL(decode(href), origin);
  return [origin, canonicalOrigin].includes(url.origin) ? [canonicalPublicPath(url.pathname)] : [];
});
const ldNodes = html => [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(([, json]) => {
    const node = JSON.parse(json);
    return Array.isArray(node) ? node : node['@graph'] || [node];
  });
const records = [];
const internalTargets = new Set();
async function page(route) {
  const response = await fetch(new URL(route, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${route}: public page`);
  const html = await response.text();
  // Never include the value of a suspected monetary field in an error/report.
  assert.equal(/"(?:priceMinor|publicPriceMinor|priceRange|priceSpecification|amountMinor)"\s*:/.test(html), false, `${route}: public monetary data field`);
  const destinations = links(html);
  destinations.forEach(destination => internalTargets.add(destination));
  return { html, text: visibleText(html), destinations };
}

for (const locale of ['ru', 'kk']) {
  for (const direction of courseDirections) {
    const content = getCourseSearchContent(direction.id, locale);
    const cardPath = localizePublicPath(`/courses/${direction.id}`, locale);
    const card = await page(cardPath);
    assert.ok(card.text.includes(content.summary), `${cardPath}: substantive explanation must be in visible SSR HTML`);
    assert.ok(card.text.includes(content.question), `${cardPath}: selection question must be in visible SSR HTML`);
    const h1 = visibleText(card.html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || '');
    assert.equal(h1, content.programHeading, `${cardPath}: program heading`);
    const course = ldNodes(card.html).find(node => node['@type'] === 'Course');
    assert.ok(course, `${cardPath}: public Course structured data`);
    assert.equal(course.name, h1, `${cardPath}: structured data describes visible course`);
    assert.equal(course.url, new URL(cardPath, canonicalOrigin).toString(), `${cardPath}: schema canonical`);
    assert.ok(!course.offers && !course.aggregateRating, `${cardPath}: no invented price or rating`);
    const breadcrumb = ldNodes(card.html).find(node => node['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb?.itemListElement?.at(-1)?.item, course.url, `${cardPath}: breadcrumb ends at current course`);
    for (const related of content.related) {
      assert.ok(card.destinations.includes(localizePublicPath(getCoursePublicPath(related), locale)), `${cardPath}: related training destination`);
    }
    const selectionSection = card.html.match(/<section\b[^>]*id=["']training-documents["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || '';
    const selectionDestinations = links(selectionSection);
    const relatedArticles = getSortedBlogPosts().filter(post => post.relatedCourses?.includes(direction.id)).slice(0, 3);
    for (const article of relatedArticles) {
      assert.ok(selectionDestinations.includes(localizePublicPath(article._path, locale)), `${cardPath}: visible reciprocal article link inside program explanation`);
    }
    records.push({ route: cardPath, kind: 'program', h1, visibleCharacters: card.text.length, relatedArticles: relatedArticles.length });
  }
  for (const direction of legacyCourseDirections) {
    const route = localizePublicPath(`/${direction.id}`, locale);
    const landing = await page(route);
    const content = getCourseSearchContent(direction.id, locale);
    assert.ok(landing.text.includes(content.summary), `${route}: visible direction explanation`);
    assert.ok(landing.text.includes(content.answer), `${route}: visible answer to selection question`);
    assert.ok(landing.destinations.includes(localizePublicPath(`/courses/${direction.id}`, locale)), `${route}: service links to program`);
    records.push({ route, kind: 'service', visibleCharacters: landing.text.length });
  }
  const home = await page(localizePublicPath('/', locale));
  for (const direction of legacyCourseDirections) {
    assert.ok(home.destinations.includes(localizePublicPath(`/${direction.id}`, locale)), `home: ${locale} service crawl link`);
  }
  records.push({ route: localizePublicPath('/', locale), kind: 'home' });
  const business = await page(localizePublicPath('/b2b', locale));
  for (const id of ['raboty-na-vysote', 'gazoopasnye-raboty', 'seminar-dekretirovannoy-gruppy-sez']) {
    assert.ok(business.destinations.includes(localizePublicPath(getCoursePublicPath(id), locale)), `business: ${id} industry selection link`);
  }
  records.push({ route: localizePublicPath('/b2b', locale), kind: 'business' });
  for (const article of blogPosts) {
    const route = localizePublicPath(article._path, locale);
    const rendered = await page(route);
    for (const id of article.relatedCourses || []) {
      const destination = getCoursePublicPath(id);
      assert.ok(destination, `${route}: known article training tag`);
      assert.ok(rendered.destinations.includes(localizePublicPath(destination, locale)), `${route}: relevant service destination`);
    }
    records.push({ route, kind: 'article', trainingLinks: article.relatedCourses?.length || 0 });
  }
}

const responses = [];
for (const destination of internalTargets) {
  const response = await fetch(new URL(destination, origin), { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  // Login and other intentionally private destinations can require authentication.
  assert.ok(response.status < 400 || [401, 403].includes(response.status), `${destination}: internal link HTTP ${response.status}`);
  responses.push({ route: destination, status: response.status });
  await response.body?.cancel();
}
const publicCatalog = await fetch(new URL('/api/v1/catalog/programs', origin));
assert.equal(publicCatalog.status, 200);
assert.deepEqual(publicMoneyFindings(await publicCatalog.json()), [], 'public catalog money boundary');
for (const endpoint of ['/api/v1/checkout/programs', '/api/v1/checkout/programs/ohrana-truda']) {
  const response = await fetch(new URL(endpoint, origin));
  assert.equal(response.status, 401, `${endpoint}: authentication required`);
  assert.match(response.headers.get('cache-control') || '', /no-store/i, `${endpoint}: private response cannot be cached`);
  await response.body?.cancel();
}
await mkdir(reportDirectory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), origin, canonicalOrigin, records, internalLinks: responses };
await writeFile(resolve(reportDirectory, 'content-link-report.json'), JSON.stringify(report, null, 2));
console.log(`Targeted SEO content passed: ${records.length} bilingual pages; ${responses.length} internal link destinations; 40 program schemas; no public monetary fields.`);
