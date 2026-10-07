import assert from 'node:assert/strict';
import test from 'node:test';
import { getSortedBlogPosts } from '../config/blog.js';
import { getPublishedBlogLocales } from '../config/blog-publication.js';
import { getBlogReadingMinutes } from '../config/blog-format.js';
import { buildBlogClientData } from '../scripts/blog-client-data.mjs';
import { renderBlogClientTemplates } from '../scripts/blog-client-templates.mjs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

test('blog cards preserve current metadata and reading time without article bodies or TOCs', () => {
  const posts = getSortedBlogPosts();
  const { summaries } = buildBlogClientData(posts);
  assert.deepEqual(summaries.map((post) => post.slug), posts.map((post) => post.slug));
  for (const [index, summary] of summaries.entries()) {
    const source = posts[index];
    assert.equal('bodyHtml' in summary, false);
    assert.equal('toc' in summary, false);
    assert.deepEqual(summary.title, source.title);
    assert.deepEqual(summary.image, source.image);
    assert.equal(summary.updatedAt, source.updatedAt);
    for (const locale of getPublishedBlogLocales(source)) assert.equal(summary.readingMinutes[locale], getBlogReadingMinutes(source.bodyHtml[locale]));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(summaries)) < Buffer.byteLength(JSON.stringify(posts)) / 8);
});

test('each article payload contains only its requested language and preserves SEO, contents and body', () => {
  const posts = getSortedBlogPosts();
  const { articles } = buildBlogClientData(posts);
  assert.equal(Object.keys(articles).length, posts.reduce((total, post) => total + getPublishedBlogLocales(post).length, 0));
  for (const post of posts) for (const locale of getPublishedBlogLocales(post)) {
    const article = articles[`${post.slug}:${locale}`];
    assert.equal(article.bodyHtml, post.bodyHtml[locale]);
    assert.equal(article.seoTitle, post.seoTitle[locale]);
    assert.equal(article.title, post.title[locale]);
    assert.deepEqual(article.toc, post.toc[locale]);
    if (post.image) assert.equal(article.image.alt, post.image.alt[locale]);
    else assert.equal(article.image, undefined);
    assert.deepEqual(article.relatedCourses, post.relatedCourses);
  }
});

test('client data is derived from new editorial input rather than a stored summary snapshot', () => {
  const post = structuredClone(getSortedBlogPosts().find((post) => getPublishedBlogLocales(post).length === 2 && post.image));
  post.title.ru = 'Changed source title';
  post.seoTitle.kk = 'Changed Kazakh SEO title';
  post.description.kk = 'Changed Kazakh description';
  post.updatedAt = '2026-10-01';
  post.image.src = '/images/optimized/revised-cover-hash-1536.webp';
  post.bodyHtml.ru = '<p>' + 'word '.repeat(361) + '</p>';
  const { summaries, articles } = buildBlogClientData([post]);
  assert.equal(summaries[0].title.ru, 'Changed source title');
  assert.equal(summaries[0].readingMinutes.ru, 3);
  assert.equal(summaries[0].image.src, post.image.src);
  assert.equal(summaries[0].updatedAt, post.updatedAt);
  assert.equal(summaries[0].description.kk, post.description.kk);
  assert.equal(articles[`${post.slug}:kk`].seoTitle, post.seoTitle.kk);
  assert.equal(articles[`${post.slug}:ru`].bodyHtml, post.bodyHtml.ru);
});

test('generated dynamic modules resolve every locale, safe unknown slugs, and contain no unrelated article bodies', async (context) => {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'ot-blog-shards-'));
  context.after(async () => {
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(directory.startsWith(join(temporaryRoot, 'ot-blog-shards-')));
    await rm(directory, { recursive: true, force: true });
  });
  const source = buildBlogClientData();
  const files = renderBlogClientTemplates(source);
  for (const [filename, contents] of Object.entries(files)) {
    const destination = join(directory, filename);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  const { loadBlogPost } = await import(pathToFileURL(join(directory, 'blog-loaders.mjs')));
  const { getSortedBlogPosts: loadCards } = await import(pathToFileURL(join(directory, 'blog-summaries.mjs')));
  assert.deepEqual(loadCards(), source.summaries);
  assert.equal(await loadBlogPost('missing', 'ru'), null);
  assert.equal(await loadBlogPost('../../config/blog', 'kk'), null);
  assert.doesNotMatch(files['blog-loaders.mjs'], /bodyHtml|<h[123]\b|content\/blog/);
  assert.doesNotMatch(files['blog-summaries.mjs'], /bodyHtml|<h[123]\b|content\/blog/);
  for (const [key, article] of Object.entries(source.articles)) {
    const [slug, locale] = key.split(':');
    assert.deepEqual(await loadBlogPost(slug, locale), JSON.parse(JSON.stringify(article)));
    const otherLocale = locale === 'ru' ? 'kk' : 'ru';
    const shard = files[`blog-content/${slug}.${locale}.mjs`];
    if (source.articles[`${slug}:${otherLocale}`]) assert.ok(!shard.includes(JSON.stringify(source.articles[`${slug}:${otherLocale}`].bodyHtml)));
    else assert.equal(await loadBlogPost(slug, otherLocale), null, 'an unpublished translation has no loader');
  }
});

test('active browser components cannot import the full editorial registry or source article bodies', async () => {
  async function inspect(directory) {
    for (const entry of await readdir(new URL(`../${directory}`, import.meta.url), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await inspect(file);
      else if (/\.(vue|[cm]?[jt]s)$/.test(file)) {
        // Frozen /second design keeps its historical registry; public active
        // pages do not import it, and viewport link prefetch is disabled.
        if (file === 'components/HomePageClassic.vue') continue;
        const contents = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(contents, /(?:from\s*|import\s*\()(['"])[^'"]*(?:config\/blog(?:\.js)?|content\/blog\/[^'"]+)\1/, file);
      }
    }
  }
  for (const directory of ['pages', 'components', 'composables', 'layouts', 'plugins']) await inspect(directory);
});
