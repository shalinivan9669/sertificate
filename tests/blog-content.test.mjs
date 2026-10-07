import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { blogPosts } from '../config/blog.js';
import { getPublishedBlogLocales } from '../config/blog-publication.js';
import { courseDirections } from '../shared/course-registry.ts';
import { buildPublicRoutes } from '../config/public-route-policy.js';

test('blog articles have distinct localized metadata, real covers and valid editorial dates', async () => {
  const slugs = new Set();
  const images = new Set();
  const titles = { ru: new Set(), kk: new Set() };
  const descriptions = { ru: new Set(), kk: new Set() };
  const courseSlugs = new Set(courseDirections.map((course) => course.id));
  for (const post of blogPosts) {
    assert.ok(!slugs.has(post.slug), `duplicate article slug: ${post.slug}`);
    slugs.add(post.slug);
    assert.equal(post._path, `/blog/${post.slug}`);
    for (const date of [post.date, post.updatedAt]) {
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(date).toISOString().slice(0, 10), date);
    }
    assert.ok(post.updatedAt >= post.date, `${post.slug}: revision precedes publication`);
    if (!post.publicationStatus) assert.ok(post.image, `${post.slug}: preserve the existing cover`);
    if (post.image) {
      assert.match(post.image.src, /^\/images\/(?:blog|optimized)\/[a-z0-9-]+\.webp$/);
      assert.ok(!images.has(post.image.src), `${post.slug}: cover is reused`);
      images.add(post.image.src);
      const bytes = await readFile(new URL(`../public${post.image.src}`, import.meta.url));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(post.image.width >= 1200 && post.image.height > 0, `${post.slug}: cover dimensions`);
    }
    for (const course of post.relatedCourses) assert.ok(courseSlugs.has(course), `${post.slug}: unknown related course ${course}`);
    for (const locale of getPublishedBlogLocales(post)) {
      assert.ok(post.title[locale]?.trim(), `${post.slug}: missing ${locale} heading`);
      assert.ok(post.seoTitle[locale]?.trim(), `${post.slug}: missing ${locale} SEO title`);
      assert.ok(post.description[locale]?.trim(), `${post.slug}: missing ${locale} description`);
      if (post.image) assert.ok(post.image.alt[locale]?.trim(), `${post.slug}: missing ${locale} image alternative`);
      assert.ok(!titles[locale].has(post.seoTitle[locale]), `${locale}: duplicate SEO title`);
      assert.ok(!descriptions[locale].has(post.description[locale]), `${locale}: duplicate description`);
      titles[locale].add(post.seoTitle[locale]);
      descriptions[locale].add(post.description[locale]);
    }
    if (getPublishedBlogLocales(post).includes('kk')) assert.notEqual(post.bodyHtml.ru, post.bodyHtml.kk, `${post.slug}: untranslated article`);
    else assert.equal(post.bodyHtml.kk, undefined, `${post.slug}: no unpublished KK brief in the public content registry`);
  }
});

test('article contents and internal links resolve in the correct locale, with official sources', () => {
  const publicRoutes = new Set(buildPublicRoutes());
  for (const post of blogPosts) for (const locale of getPublishedBlogLocales(post)) {
    const label = `${post.slug}/${locale}`;
    const html = post.bodyHtml[locale];
    assert.doesNotMatch(html, /<h1[\s>]/i, `${label}: the page already supplies its h1`);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${label}: duplicate anchor`);
    const headingIds = new Set([...html.matchAll(/<h[23]\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]));
    assert.ok(post.toc[locale].length > 0, `${label}: missing contents`);
    for (const entry of post.toc[locale]) {
      assert.ok(entry.title.trim(), `${label}: empty contents label`);
      assert.ok(headingIds.has(entry.id), `${label}: missing contents destination ${entry.id}`);
    }
    let officialSourceCount = 0;
    let siteSourceCount = 0;
    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
      if (href.startsWith('#')) {
        assert.ok(ids.includes(href.slice(1)), `${label}: broken anchor ${href}`);
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        const path = new URL(href, 'https://otcenter.kz').pathname;
        if (path.startsWith('/downloads/seo-2026-2027/')) {
          assert.match(path, /^\/downloads\/seo-2026-2027\/T0[1-8]_[a-z_]+\.(?:xlsx|csv|md)$/);
          assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${label}: missing downloadable file ${path}`);
          continue;
        }
        assert.ok(publicRoutes.has(path), `${label}: unknown internal route ${path}`);
        siteSourceCount++;
        if (!(post.contentId === 'N11' && path === '/kk/blog')) assert.equal(path.startsWith('/kk/'), locale === 'kk', `${label}: internal link switches language ${path}`);
      } else if (href.startsWith('http')) {
        const url = new URL(href);
        assert.equal(url.protocol, 'https:', `${label}: insecure external source`);
        if (url.hostname === 'adilet.zan.kz' || url.hostname === 'gov.kz' || url.hostname.endsWith('.gov.kz') || url.hostname === 'www.iso.org' || url.hostname === 'committee.iso.org') officialSourceCount++;
      }
    }
    const editorialWithoutLegalClaims = ['N04', 'N05', 'N10', 'N11'].includes(post.contentId) && (post.claimIds || []).length === 0;
    assert.ok(officialSourceCount > 0 || editorialWithoutLegalClaims && siteSourceCount > 0, `${label}: missing official source or scoped editorial references`);
  }
});
