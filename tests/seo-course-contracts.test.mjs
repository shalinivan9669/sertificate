import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicRoutes, canonicalPublicPath, localizePublicPath, stripLocale } from '../config/public-route-policy.js';
import { getPublicCourseSeo } from '../shared/public-course-seo.ts';
import { assertCourseMetadataUniqueness, buildCourseContractRoutes, inspectPublicHtml } from '../scripts/seo-http-check.mjs';
import { collectDuplicateIssues } from '../scripts/seo-uniqueness-check.ts';

const origin = 'https://www.otcenter.kz';
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function fixture(route, overrides = {}) {
  const preferred = canonicalPublicPath(route);
  const locale = route.startsWith('/kk/') ? 'kk' : 'ru';
  const id = stripLocale(preferred).split('/').at(-1);
  const seo = { ...getPublicCourseSeo(id, locale), ...overrides };
  return `<html lang="${locale}-KZ"><head><title>${escape(seo.title)}</title>
    <meta name="description" content="${escape(seo.description)}">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${escape(seo.title)}">
    <meta property="og:description" content="${escape(seo.description)}">
    <meta name="twitter:title" content="${escape(seo.title)}">
    <meta name="twitter:description" content="${escape(seo.description)}">
    <link rel="canonical" href="${origin}${preferred}">
    ${[['ru', 'ru-KZ'], ['kk', 'kk-KZ'], ['ru', 'x-default']].map(([language, hreflang]) => `<link rel="alternate" hreflang="${hreflang}" href="${origin}${localizePublicPath(preferred, language)}">`).join('')}
    </head><body><main><h1>${escape(seo.title)}</h1></main></body></html>`;
}

test('HTTP inventory includes 20 course details and three aliases in both languages outside sitemap coverage', () => {
  const routes = buildCourseContractRoutes();
  assert.equal(routes.length, 46);
  assert.equal(new Set(routes).size, routes.length);
  for (const route of ['/courses/ohrana-truda', '/courses/iso-9001', '/courses/labor-safety', '/courses/industrial-safety', '/courses/fire-safety']) {
    assert.ok(routes.includes(route), route);
    assert.ok(routes.includes(`/kk${route}`), `/kk${route}`);
  }
  assert.ok(!buildPublicRoutes().includes('/courses/labor-safety'), 'Alias coverage must not depend on adding it to sitemap');
});

test('all course details and aliases have exact localized SEO and social metadata contracts', () => {
  const records = buildCourseContractRoutes().map((route) => ({ route, ...inspectPublicHtml(fixture(route), route, origin) }));
  assert.doesNotThrow(() => assertCourseMetadataUniqueness(records));
});

test('course checker rejects inherited global descriptions and Russian fallback on a Kazakh page', () => {
  const inherited = 'Обучение по охране труда, ТБ, БИОТ и промышленной безопасности по всему Казахстану.';
  assert.throws(() => inspectPublicHtml(fixture('/courses/iso-9001', { description: inherited }), '/courses/iso-9001', origin), /course description matches/);
  const russian = getPublicCourseSeo('ohrana-truda', 'ru');
  assert.throws(() => inspectPublicHtml(fixture('/kk/courses/ohrana-truda', { description: russian.description }), '/kk/courses/ohrana-truda', origin), /course description matches/);
});

test('course checker rejects inherited or missing social metadata independently of normal description', () => {
  const route = '/kk/courses/elektrobezopasnost';
  const html = fixture(route);
  assert.throws(() => inspectPublicHtml(html.replace(/(<meta property="og:description" content=")[^"]*/, '$1Обучение по охране труда'), route, origin), /og:description matches/);
  assert.throws(() => inspectPublicHtml(html.replace(/<meta name="twitter:title"[^>]+>/, ''), route, origin), /exactly one twitter:title/);
});

test('aliases require preferred canonical and every language alternate while ordinary pages retain their own canonical', () => {
  const alias = '/kk/courses/labor-safety';
  const html = fixture(alias);
  assert.throws(() => inspectPublicHtml(html.replace(`rel="canonical" href="${origin}/kk/courses/ohrana-truda"`, `rel="canonical" href="${origin}${alias}"`), alias, origin), /expected canonical/);
  assert.throws(() => inspectPublicHtml(html.replace(`hreflang="x-default" href="${origin}/courses/ohrana-truda"`, `hreflang="x-default" href="${origin}/courses/labor-safety"`), alias, origin), /x-default alternate targets preferred route/);
  const route = '/courses/iso-9001';
  assert.throws(() => inspectPublicHtml(fixture(route).replace(`rel="canonical" href="${origin}${route}"`, `rel="canonical" href="${origin}/courses/ohrana-truda"`), route, origin), /expected canonical/);
});

test('cross-course duplicate descriptions fail uniqueness while intentional aliases share a canonical group', () => {
  const records = [
    { route: '/courses/ohrana-truda', title: 'Охрана труда', description: 'Описание программы' },
    { route: '/courses/labor-safety', title: 'Охрана труда', description: 'Описание программы' },
  ];
  assert.doesNotThrow(() => assertCourseMetadataUniqueness(records));
  assert.throws(() => assertCourseMetadataUniqueness([...records, { route: '/courses/iso-9001', title: 'ISO 9001', description: 'Описание программы' }]), /duplicate course description/);

  const entries = records.map((record) => ({ ...record, type: 'course-detail', locale: 'ru', citySlug: null, courseSlug: record.route.split('/').at(-1), canonicalPath: canonicalPublicPath(record.route), h1: record.title, shingles: new Set() }));
  assert.deepEqual(collectDuplicateIssues(entries), []);
  assert.ok(collectDuplicateIssues([...entries, { ...entries[0], route: '/courses/iso-9001', canonicalPath: '/courses/iso-9001', title: 'ISO 9001', h1: 'ISO 9001' }]).some((issue) => issue.kind === 'description'));
});
