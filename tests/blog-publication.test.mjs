import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import { createApp, createRouter, toNodeListener } from 'h3';
import { blogPosts } from '../config/blog.js';
import { getBlogModifiedAt, getPublishedBlogLocales } from '../config/blog-publication.js';
import { buildPublicRoutes, buildSitemapEntries, isNonIndexableRoute } from '../config/public-route-policy.js';
import { buildBlogClientData } from '../scripts/blog-client-data.mjs';
import { isPreviewableSeoDraft, seoDraftPreviewAllowed } from '../server/utils/seo-draft-preview.ts';
import previewHandler from '../server/api/seo-preview/[id].get.ts';
import securityMiddleware from '../server/middleware/security.ts';
import previewMiddleware from '../server/middleware/seo-draft-preview.ts';
import { inspectPublicHtml } from '../scripts/seo-http-check.mjs';
const legacyPost = () => blogPosts.find((post) => !post.publicationStatus && getPublishedBlogLocales(post).length === 2);

test('existing bilingual articles remain published while unapproved imports default to draft', () => {
  const existingPosts = blogPosts.filter((post) => !post.publicationStatus);
  assert.equal(existingPosts.length, 27);
  for (const post of existingPosts) assert.deepEqual(getPublishedBlogLocales(post), ['ru', 'kk'], post.slug);
  const post = { ...structuredClone(legacyPost()), slug: 'new-unapproved-article', _path: '/blog/new-unapproved-article' };
  assert.deepEqual(getPublishedBlogLocales(post), []);
  assert.deepEqual(buildBlogClientData([post]), { summaries: [], articles: {} });
  post.publicationStatus = 'published';
  post.publishedLocales = ['ru'];
  assert.deepEqual(getPublishedBlogLocales(post), [], 'published text alone does not replace editorial approval');
  post.editorialApproved = true;
  const { summaries, articles } = buildBlogClientData([post]);
  assert.deepEqual(getPublishedBlogLocales(post), ['ru']);
  assert.equal(summaries[0].title.kk, undefined);
  assert.equal(summaries[0].image.alt.kk, undefined);
  assert.deepEqual(Object.keys(articles), ['new-unapproved-article:ru']);
  assert.equal(articles['new-unapproved-article:kk'], undefined);
  delete post.bodyHtml.ru;
  assert.deepEqual(getPublishedBlogLocales(post), [], 'a missing language body is never replaced by another language');
});

test('HOLD or localization briefs cannot be published by setting a published flag', () => {
  for (const override of [
    { publicationStatus: 'HOLD_LEGAL' },
    { publicationStatus: 'published', editorialApproved: true, packagePublicationStatus: 'HOLD_METHODIST' },
    { publicationStatus: 'published', editorialApproved: true, contentKind: 'localization_brief' },
  ]) assert.deepEqual(buildBlogClientData([{ ...blogPosts[0], ...override }]), { summaries: [], articles: {} });
});

test('route inventory and sitemap expose only an approved language, without a fabricated hreflang pair', () => {
  const originalLength = blogPosts.length;
  const post = { ...structuredClone(legacyPost()), slug: 'editorial-gate-fixture', _path: '/blog/editorial-gate-fixture' };
  blogPosts.push(post);
  try {
    assert.ok(!buildPublicRoutes().includes(post._path), 'an accidental draft import stays absent');
    Object.assign(post, { publicationStatus: 'published', editorialApproved: true, publishedLocales: ['ru'] });
    assert.ok(buildPublicRoutes().includes(post._path));
    assert.ok(!buildPublicRoutes().includes(`/kk${post._path}`));
    const entries = buildSitemapEntries('https://www.otcenter.kz');
    const entry = entries.find((item) => new URL(item.loc).pathname === post._path);
    assert.deepEqual(entry.alternatives, []);
    assert.ok(!entries.some((item) => new URL(item.loc).pathname === `/kk${post._path}`));
  } finally { blogPosts.length = originalLength; }
});

test('HTML contract rejects hreflang for RU-only articles while retaining reciprocal bilingual requirements', () => {
  const site = 'https://www.otcenter.kz';
  const article = blogPosts.find((post) => getPublishedBlogLocales(post).length === 1);
  assert.ok(article, 'the explicitly released RU-only articles are present');
  const html = `<html lang="ru-KZ"><head><title>Article</title><meta name="description" content="Description"><link rel="canonical" href="${site}${article._path}"></head><body><h1>Article</h1></body></html>`;
  assert.doesNotThrow(() => inspectPublicHtml(html, article._path, site));
  const fabricatedPair = html.replace('</head>', `<link rel="alternate" hreflang="kk-KZ" href="${site}/kk${article._path}"></head>`);
  assert.throws(() => inspectPublicHtml(fabricatedPair, article._path, site), /alternates exist only for published equivalents/);
  const existing = legacyPost();
  const incompleteBilingual = html.replaceAll(article._path, existing._path);
  assert.throws(() => inspectPublicHtml(incompleteBilingual, existing._path, site), /alternates exist only for published equivalents/);
});

test('bilingual HTML accepts Nuxt regional and base-language alternates but rejects unknown, duplicate or wrong targets', () => {
  const site = 'https://www.otcenter.kz';
  const article = legacyPost();
  const alternate = (hreflang, target) => `<link rel="alternate" hreflang="${hreflang}" href="${site}${target}">`;
  const required = alternate('ru-KZ', article._path) + alternate('kk-KZ', `/kk${article._path}`) + alternate('x-default', article._path);
  const optional = alternate('ru', article._path) + alternate('kk', `/kk${article._path}`);
  const html = (alternates) => `<html lang="ru-KZ"><head><title>Article</title><meta name="description" content="Description"><link rel="canonical" href="${site}${article._path}">${alternates}</head><body><h1>Article</h1></body></html>`;
  assert.doesNotThrow(() => inspectPublicHtml(html(required), article._path, site));
  assert.doesNotThrow(() => inspectPublicHtml(html(required + optional), article._path, site));
  assert.throws(() => inspectPublicHtml(html(required + optional.replace('hreflang="ru"', 'hreflang="en"')), article._path, site), /unsupported en alternate/);
  assert.throws(() => inspectPublicHtml(html(required + optional.replace('hreflang="ru"', 'hreflang="ru-KZ"')), article._path, site), /exactly one ru-KZ alternate/);
  assert.throws(() => inspectPublicHtml(html(required + optional.replace(`href="${site}/kk${article._path}"`, `href="${site}${article._path}"`)), article._path, site), /kk alternate targets preferred route/);
});

test('RU-only revisions preserve the KK visible and structured revision date', () => {
  const post = structuredClone(legacyPost());
  const original = post.updatedAt;
  post.updatedAtByLocale = { ru: '2026-10-07', kk: original };
  post.checkedAtByLocale = { ru: '2026-10-07' };
  assert.equal(getBlogModifiedAt(post, 'ru'), '2026-10-07');
  assert.equal(getBlogModifiedAt(post, 'kk'), original);
  const { articles } = buildBlogClientData([post]);
  assert.equal(articles[`${post.slug}:ru`].updatedAt, '2026-10-07');
  assert.equal(articles[`${post.slug}:kk`].updatedAt, original);
  assert.equal(articles[`${post.slug}:ru`].checkedAt, '2026-10-07');
  assert.equal(articles[`${post.slug}:kk`].checkedAt, undefined);
  assert.equal(articles[`${post.slug}:ru`].date, post.date);
  const entries = buildSitemapEntries('https://www.otcenter.kz');
  for (const source of blogPosts) for (const locale of getPublishedBlogLocales(source)) {
    const pathname = `${locale === 'kk' ? '/kk' : ''}${source._path}`;
    assert.equal(entries.find((entry) => new URL(entry.loc).pathname === pathname).lastmod, getBlogModifiedAt(source, locale));
  }
});

test('draft review requires explicit local development opt-in and always denies production', () => {
  const allowed = { OT_SEO_DRAFT_PREVIEW: '1', NODE_ENV: 'development' };
  assert.equal(seoDraftPreviewAllowed(allowed, 'localhost'), true);
  assert.equal(seoDraftPreviewAllowed(allowed, '127.0.0.1'), true);
  assert.equal(seoDraftPreviewAllowed(allowed, 'otcenter.kz'), false);
  assert.equal(seoDraftPreviewAllowed({ NODE_ENV: 'development' }, 'localhost'), false);
  assert.equal(seoDraftPreviewAllowed({ ...allowed, NODE_ENV: 'production' }, 'localhost'), false);
  assert.equal(seoDraftPreviewAllowed({ ...allowed, VERCEL: '1' }, 'localhost'), false);
  assert.equal(seoDraftPreviewAllowed({ ...allowed, VERCEL_ENV: 'preview' }, 'localhost'), false);
});

test('conditional material remains outside public inventory until editorial release, with no fabricated KK counterpart', async () => {
  const registry = JSON.parse(await readFile(new URL('../server/content/seo-expansion-drafts.json', import.meta.url), 'utf8'));
  assert.deepEqual([...registry.drafts.map((draft) => draft.contentId), ...(registry.releasedIds || [])].sort(), ['N04', 'N05', 'N06', 'N07', 'N10', 'N11']);
  const routes = new Set(buildPublicRoutes());
  const data = buildBlogClientData();
  for (const draft of registry.drafts) {
    assert.equal(isPreviewableSeoDraft(draft), true, draft.contentId);
    assert.equal(draft.datePublished, undefined);
    assert.equal(draft.date, undefined);
    assert.equal(draft.updatedAt, undefined);
    assert.equal(Boolean(draft.publishedAt), false);
    assert.ok(!routes.has(draft.targetPath));
    assert.ok(!routes.has(`/kk${draft.targetPath}`));
    assert.equal(data.articles[`${draft.slug}:ru`], undefined);
    assert.ok(!data.summaries.some((summary) => summary.slug === draft.slug));
    assert.equal(isNonIndexableRoute(`/preview/seo/${draft.contentId}`), true);
    assert.equal(isNonIndexableRoute(`/api/seo-preview/${draft.contentId}`), true);
    assert.equal(isPreviewableSeoDraft({ ...draft, publicationStatus: 'HOLD_LEGAL' }), false);
    assert.equal(isPreviewableSeoDraft({ ...draft, locale: 'kk' }), false);
  }
  for (const contentId of registry.releasedIds || []) {
    const post = blogPosts.find((post) => post.contentId === contentId);
    assert.equal(post.publicationStatus, 'published');
    assert.equal(post.editorialApproved, true);
    assert.deepEqual(getPublishedBlogLocales(post), ['ru']);
    assert.equal(post.bodyHtml.kk, undefined);
    assert.ok(routes.has(post._path));
    assert.ok(!routes.has(`/kk${post._path}`));
    assert.ok(data.articles[`${post.slug}:ru`]);
    assert.equal(data.articles[`${post.slug}:kk`], undefined);
    assert.ok(!registry.drafts.some((draft) => draft.contentId === contentId));
  }
  const preview = await readFile(new URL('../pages/preview/seo/[id].vue', import.meta.url), 'utf8');
  assert.doesNotMatch(preview, /seo-expansion-drafts\.json|application\/ld\+json|datePublished|hreflang/);
  assert.match(preview, /noindex, nofollow, noarchive/);
});

test('draft API serves only opted-in loopback review and denies production without returning a draft body', async (context) => {
  const keys = ['NODE_ENV', 'OT_SEO_DRAFT_PREVIEW', 'VERCEL', 'VERCEL_ENV'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const app = createApp().use(securityMiddleware).use(previewMiddleware).use(createRouter().get('/api/seo-preview/:id', previewHandler));
  const server = createServer(toNodeListener(app));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  Object.assign(process.env, { NODE_ENV: 'development', OT_SEO_DRAFT_PREVIEW: '1' });
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  const registry = JSON.parse(await readFile(new URL('../server/content/seo-expansion-drafts.json', import.meta.url), 'utf8'));
  const draft = registry.drafts.find((entry) => entry.contentId === 'N04');
  const allowed = await fetch(`${base}/api/seo-preview/N04`);
  assert.equal(allowed.status, draft ? 200 : 404, 'released content leaves the draft endpoint');
  assert.match(allowed.headers.get('cache-control'), /private.*no-store/);
  assert.match(allowed.headers.get('x-robots-tag'), /noindex/);
  if (draft) {
    const payload = await allowed.json();
    assert.equal(payload.draft.contentId, 'N04');
    assert.equal(payload.draft.locale, 'ru');
    assert.equal(payload.draft.publicationStatus, 'draft');
  }
  assert.equal((await fetch(`${base}/api/seo-preview/N01`)).status, 404, 'HOLD has no previewable entry');
  for (const pathname of ['/preview/seo/N01', '/kk/preview/seo/N04']) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  }
  const spoofedHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/api/seo-preview/N04`, { headers: { host: 'otcenter.kz', 'x-forwarded-host': 'localhost' } }, (response) => {
      response.resume(); resolve(response.statusCode);
    });
    request.on('error', reject); request.end();
  });
  assert.equal(spoofedHostStatus, 404);
  process.env.NODE_ENV = 'production';
  const denied = await fetch(`${base}/api/seo-preview/N04`);
  assert.equal(denied.status, 404);
  assert.match(denied.headers.get('cache-control'), /private.*no-store/);
  assert.match(denied.headers.get('x-robots-tag'), /noindex/);
  const body = draft?.bodyHtml || blogPosts.find((post) => post.contentId === 'N04')?.bodyHtml.ru;
  assert.ok(body && !(await denied.text()).includes(body));
  const deniedPage = await fetch(`${base}/preview/seo/N04`);
  assert.equal(deniedPage.status, 404);
  assert.match(deniedPage.headers.get('cache-control'), /private.*no-store/);
  assert.match(deniedPage.headers.get('x-robots-tag'), /noindex/);
});
