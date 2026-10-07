import { pathToFileURL } from 'node:url';
import { getSortedBlogPosts } from '../config/blog.js';
import { getBlogReadingMinutes } from '../config/blog-format.js';
import { getBlogModifiedAt, getPublishedBlogLocales } from '../config/blog-publication.js';

const localized = (value, locale) => value && typeof value === 'object' && !Array.isArray(value) ? value[locale] : value;
const publicLocalized = (value, post) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(getPublishedBlogLocales(post).filter((locale) => value[locale] !== undefined).map((locale) => [locale, value[locale]])) : value;

// Derive cards and per-locale articles from the authoritative source on every
// Nuxt build. No second hand-maintained editorial registry can become stale.
export function buildBlogClientData(posts = getSortedBlogPosts()) {
  posts = posts.filter((post) => getPublishedBlogLocales(post).length > 0);
  const summaries = posts.map((post) => ({
    slug: post.slug,
    _path: post._path,
    date: post.date,
    updatedAt: post.updatedAt,
    ...(post.updatedAtByLocale ? { updatedAtByLocale: publicLocalized(post.updatedAtByLocale, post) } : {}),
    publishedLocales: getPublishedBlogLocales(post),
    title: publicLocalized(post.title, post),
    description: publicLocalized(post.description, post),
    tags: publicLocalized(post.tags, post),
    ...(post.image ? { image: { ...post.image, alt: publicLocalized(post.image.alt, post), ...(post.image.caption ? { caption: publicLocalized(post.image.caption, post) } : {}) } } : {}),
    relatedCourses: post.relatedCourses,
    readingMinutes: Object.fromEntries(getPublishedBlogLocales(post).map((locale) => [locale, getBlogReadingMinutes(localized(post.bodyHtml, locale))])),
  }));
  const articles = Object.fromEntries(posts.flatMap((post) => getPublishedBlogLocales(post).map((locale) => [
    `${post.slug}:${locale}`,
    {
      ...post,
      updatedAt: getBlogModifiedAt(post, locale),
      ...(post.checkedAtByLocale?.[locale] ? { checkedAt: post.checkedAtByLocale[locale] } : {}),
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
