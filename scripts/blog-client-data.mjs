import { pathToFileURL } from 'node:url';
import { getSortedBlogPosts } from '../config/blog.js';
import { getBlogReadingMinutes } from '../config/blog-format.js';

const locales = ['ru', 'kk'];
const localized = (value, locale) => value?.[locale] ?? value?.ru ?? value;

// Derive cards and per-locale articles from the authoritative source on every
// Nuxt build. No second hand-maintained editorial registry can become stale.
export function buildBlogClientData(posts = getSortedBlogPosts()) {
  const summaries = posts.map((post) => ({
    slug: post.slug,
    _path: post._path,
    date: post.date,
    updatedAt: post.updatedAt,
    title: post.title,
    description: post.description,
    tags: post.tags,
    image: post.image,
    relatedCourses: post.relatedCourses,
    readingMinutes: Object.fromEntries(locales.map((locale) => [locale, getBlogReadingMinutes(localized(post.bodyHtml, locale))])),
  }));
  const articles = Object.fromEntries(posts.flatMap((post) => locales.map((locale) => [
    `${post.slug}:${locale}`,
    {
      ...post,
      title: localized(post.title, locale),
      seoTitle: localized(post.seoTitle, locale),
      description: localized(post.description, locale),
      tags: localized(post.tags, locale),
      toc: localized(post.toc, locale),
      bodyHtml: localized(post.bodyHtml, locale),
      image: post.image ? {
        ...post.image,
        alt: localized(post.image.alt, locale),
        caption: localized(post.image.caption, locale),
      } : undefined,
    },
  ])));
  return { summaries, articles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(buildBlogClientData()));
}
