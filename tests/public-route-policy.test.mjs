import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import { cities } from '../config/cities.js';
import { courses } from '../config/courses.js';
import { formats } from '../config/formats.js';
import { blogPosts } from '../config/blog.js';
import { additionalSourceDirections } from '../shared/source-products.ts';
import {
  buildPrivateRouteRules, buildPublicRoutes, buildSitemapEntries,
  isNonIndexableRoute, localizePublicPath, resolvePublicCityPage,
} from '../config/public-route-policy.js';

test('all existing directions, cities and format combinations retain both public locales', () => {
  const routes = new Set(buildPublicRoutes());
  assert.equal(courses.length, 9, 'the nine legacy directions remain published');
  for (const locale of ['ru', 'kk']) {
    for (const course of courses) assert.ok(routes.has(localizePublicPath(`/${course.slug}`, locale)));
    for (const city of cities) {
      assert.ok(routes.has(localizePublicPath(`/${city.slug}`, locale)));
      for (const entity of [...courses, ...formats]) {
        const path = `/${city.slug}/${entity.slug}`;
        assert.ok(routes.has(localizePublicPath(path, locale)), path);
        assert.equal(resolvePublicCityPage(city.slug, entity.slug).city.slug, city.slug);
      }
    }
  }
  assert.equal(routes.size, buildPublicRoutes().length, 'no duplicate sitemap URLs');
  assert.equal(routes.size, 550 + (blogPosts.length - 1) * 2, '550 preserved addresses plus both locales for each additional article');
  assert.ok(routes.has('/blog/pozharnyj-tekhnicheskiy-minimum'), 'the established article address remains published');
  assert.equal(additionalSourceDirections.length, 11);
  for (const direction of additionalSourceDirections) for (const locale of ['ru', 'kk']) {
    assert.ok(routes.has(localizePublicPath(`/courses/${direction.id}`, locale)));
  }
});

test('the city resolver returns the requested entity and rejects invalid or reserved paths', () => {
  for (const city of cities) {
    for (const course of courses) {
      const resolved = resolvePublicCityPage(city.slug, course.slug);
      assert.equal(resolved.kind, 'course');
      assert.equal(resolved.course.slug, course.slug);
    }
    for (const format of formats) {
      const resolved = resolvePublicCityPage(city.slug, format.slug);
      assert.equal(resolved.kind, 'format');
      assert.equal(resolved.format.slug, format.slug);
    }
    for (const invalid of ['unknown-course', 'industrial-safety', '../learn', 'courses', 'admin']) {
      assert.equal(resolvePublicCityPage(city.slug, invalid), null);
    }
  }
  for (const invalid of ['unknown-city', 'courses', 'learn', 'blog', 'auth', 'admin', '../karaganda']) {
    assert.equal(resolvePublicCityPage(invalid, 'ohrana-truda'), null);
  }
});

test('private, interactive and verification state cannot enter public build inventory', () => {
  const privatePaths = ['/cabinet', '/cabinet/organization', '/learn/industrial-safety/exam',
    '/payment/pending', '/certificates/serial', '/admin/content', '/auth/login',
    '/verify/opaque-token', '/api/learning', '/program-selection?role=manager', '/wizard', '/src'];
  for (const path of privatePaths) {
    assert.equal(isNonIndexableRoute(path), true, path);
    assert.equal(isNonIndexableRoute(`/kk${path}`), true, `/kk${path}`);
  }
  for (const path of buildPublicRoutes()) assert.equal(isNonIndexableRoute(path), false, path);
  assert.equal(isNonIndexableRoute('/learn-more'), false, 'match segments, not similar prefixes');
  assert.equal(isNonIndexableRoute('/KK/LEARN/course/exam'), true, 'case variants stay private');
  assert.equal(isNonIndexableRoute('/%6cearn/course/exam'), true, 'decoded path variants stay private');
});

test('both locale variants of private routes disable prerender and cache and carry noindex', () => {
  const rules = buildPrivateRouteRules();
  for (const [pattern, rule] of Object.entries(rules)) {
    assert.equal(rule.prerender, false, pattern);
    assert.equal(rule.cache, false, pattern);
    assert.equal(rule.swr, false, pattern);
    assert.equal(rule.sitemap, false, pattern);
    assert.match(rule.headers['cache-control'], /private.*no-store/, pattern);
    assert.match(rule.headers['x-robots-tag'], /noindex/, pattern);
  }
  assert.ok(rules['/learn/**']);
  assert.ok(rules['/kk/learn/**']);
  assert.ok(!rules['/_nuxt/**'], 'public JavaScript and styles stay crawlable');
});

test('sitemap alternates are reciprocal and lastmod comes only from actual blog revisions', () => {
  const entries = buildSitemapEntries('https://otcenter.kz');
  const locations = new Set(entries.map(({ loc }) => loc));
  for (const entry of entries) {
    assert.equal(new URL(entry.loc).origin, 'https://otcenter.kz');
    const basePath = localizePublicPath(new URL(entry.loc).pathname, 'ru');
    const post = blogPosts.find((item) => item._path === basePath);
    const latestBlogRevision = blogPosts.map((item) => item.updatedAt || item.date).sort().at(-1);
    assert.equal(entry.lastmod, post ? post.updatedAt || post.date : basePath === '/blog' ? latestBlogRevision : undefined);
    if (post?.image?.src) assert.deepEqual(entry.images, [{ loc: new URL(post.image.src, 'https://otcenter.kz').toString() }]);
    else assert.equal(entry.images, undefined);
    assert.equal(entry.alternatives.length, 3);
    for (const alternate of entry.alternatives) assert.ok(locations.has(alternate.href));
    assert.ok(entry.alternatives.some(({ href }) => href === entry.loc));
  }
});

test('only one dynamic resolver exists at each public URL depth', async () => {
  await access(new URL('../pages/[course].vue', import.meta.url));
  await access(new URL('../pages/[city]/[slug].vue', import.meta.url));
  await assert.rejects(access(new URL('../pages/[city]/[course].vue', import.meta.url)));
  await assert.rejects(access(new URL('../pages/[city]/index.vue', import.meta.url)));
  const middleware = await readFile(new URL('../middleware/city.global.js', import.meta.url), 'utf8');
  assert.match(middleware, /statusCode: 404/);
  assert.doesNotMatch(middleware, /navigateTo|FALLBACK_CITY/);
});
