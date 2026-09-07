import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { courses } from '../config/courses.js';
import { additionalSourceDirections } from '../shared/source-products.ts';
import {
  buildPublicRoutes, defaultSiteUrl, isNonIndexableRoute, localizePublicPath,
} from '../config/public-route-policy.js';

const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(([, key, value]) => [key.toLowerCase(), value.replaceAll('&amp;', '&')]),
);

export function inspectPublicHtml(html, route, siteUrl = defaultSiteUrl) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const canonical = links.filter(({ rel }) => rel === 'canonical');
  assert.equal(canonical.length, 1, `${route}: exactly one canonical`);
  assert.equal(new URL(canonical[0].href).toString(), new URL(route.split('?')[0], siteUrl).toString(), `${route}: self canonical`);
  assert.equal((html.match(/<title\b/gi) || []).length, 1, `${route}: one title`);
  assert.equal(metas.filter(({ name }) => name === 'description').length, 1, `${route}: one description`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${route}: one SSR H1`);
  assert.doesNotMatch(metas.find(({ name }) => name === 'robots')?.content || '', /noindex/, `${route}: indexable`);
  for (const [locale, hreflang] of [['ru', 'ru-KZ'], ['kk', 'kk-KZ']]) {
    const alternate = links.find((link) => link.rel === 'alternate' && link.hreflang === hreflang);
    assert.ok(alternate, `${route}: ${hreflang} alternate`);
    assert.equal(new URL(alternate.href).toString(), new URL(localizePublicPath(route, locale), siteUrl).toString());
  }
  assert.match(html, route.startsWith('/kk') ? /<html\b[^>]*lang=["']kk-KZ["']/ : /<html\b[^>]*lang=["']ru-KZ["']/);
  assert.doesNotMatch(html, /"@type"\s*:\s*"LocalBusiness"/, `${route}: no invented city branches`);
  assert.doesNotMatch(html, /New flow entry|SEO-страница остаётся|runtime-flow/, `${route}: no developer copy`);
  return { canonical: canonical[0].href, title: html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] };
}

export async function runHttpSeoCheck(baseUrl, siteUrl = defaultSiteUrl, options = { all: false }) {
  assert.ok(baseUrl, 'Pass the URL of an already running local/staging SSR server');
  const report = { baseUrl, canonicalHost: siteUrl, checkedAt: new Date().toISOString(), inventoryMode: options.all ? 'all' : 'sample', public: [], private: [], missing: [] };
  const check = async (route) => {
    const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    return { response, html: await response.text() };
  };
  const sample = ['/', '/contacts', '/licenses', '/courses', '/b2b', '/karaganda',
    '/karaganda/ohrana-truda', '/karaganda/promyshlennaya-bezopasnost',
    '/karaganda/online-obuchenie', ...courses.map(({ slug }) => `/${slug}`),
    ...additionalSourceDirections.map(({ id }) => `/courses/${id}`)];
  const publicRoutes = options.all ? buildPublicRoutes() : [...new Set(sample.flatMap((route) => [route, localizePublicPath(route, 'kk')]))];
  for (const route of publicRoutes) {
    const { response, html } = await check(route);
    assert.equal(response.status, 200, `${route}: public HTTP 200`);
    report.public.push({ route, status: response.status, ...inspectPublicHtml(html, route, siteUrl) });
  }
  for (const route of ['/not-a-city/not-a-course', '/karaganda/not-a-course', '/unknown-direction',
    '/unknown-city/online-obuchenie', '/kk/unknown-city/ohrana-truda', '/courses/unknown-course']) {
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
  for (const loc of locations) {
    assert.ok(expected.has(loc), `unexpected sitemap location ${loc}`);
    assert.equal(isNonIndexableRoute(new URL(loc).pathname), false);
  }
  report.sitemap = { status: sitemap.response.status, urls: locations.length };
  const robots = await check('/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.doesNotMatch(robots.html, /Disallow:\s*\/_nuxt/i);
  assert.match(robots.html, /Sitemap:/i);
  report.robots = { status: robots.response.status, assetsAllowed: true };
  await fs.mkdir('artifacts/seo', { recursive: true });
  await fs.writeFile(`artifacts/seo/http-contract${options.all ? '-all' : ''}-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runHttpSeoCheck(process.argv[2] || process.env.SEO_BASE_URL, process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl, { all: process.argv.includes('--all') })
    .then((report) => console.log(`SEO HTTP contracts passed: ${report.public.length} public, ${report.private.length} private, ${report.missing.length} 404 routes; ${report.sitemap.urls} sitemap URLs.`))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
