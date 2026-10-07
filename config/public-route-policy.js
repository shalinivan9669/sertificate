import { cities } from './cities.js';
import { courses } from './courses.js';
import { formats } from './formats.js';
import { blogPosts } from './blog.js';
import { getBlogModifiedAt, getPublishedBlogLocales } from './blog-publication.js';
import { additionalSourceDirections } from '../shared/source-products.ts';
import { localizePublicPath, nonIndexableRoots, stripLocale } from './public-route-runtime.js';
export { canonicalPublicPath, canonicalPublicUrl, courseCardAliases, isNonIndexableRoute, localizePublicPath, nonIndexableRoots, resolvePublicCityPage, stripLocale } from './public-route-runtime.js';

// One inventory is shared by Nitro, the sitemap generator and route contract tests.
// Existing public addresses are retained; interactive and personal state is never
// discovered by crawling links during a build.
export const defaultSiteUrl = 'https://otcenter.kz';

export function buildPublicRoutes() {
  const national = [
    '/', '/courses', '/b2b', '/blog', '/contacts', '/licenses', '/privacy', '/public-offer',
    ...additionalSourceDirections.map((direction) => `/courses/${direction.id}`),
    ...courses.map((course) => `/${course.slug}`),
    ...formats.map((format) => `/${format.slug}`),
    ...cities.flatMap((city) => [
      `/${city.slug}`,
      ...courses.map((course) => `/${city.slug}/${course.slug}`),
      ...formats.map((format) => `/${city.slug}/${format.slug}`),
    ]),
  ];
  return [...new Set([
    ...national.flatMap((path) => [path, localizePublicPath(path, 'kk')]),
    ...blogPosts.flatMap((post) => getPublishedBlogLocales(post).map((locale) => localizePublicPath(post._path, locale))),
  ])];
}

export function buildPrivateRouteRules() {
  const rules = {};
  for (const root of nonIndexableRoots) {
    for (const localizedRoot of [root, `/kk${root}`]) {
      for (const pattern of [localizedRoot, `${localizedRoot}/**`]) {
        rules[pattern] = {
          prerender: false,
          cache: false,
          swr: false,
          robots: false,
          sitemap: false,
          headers: {
            'cache-control': 'private, no-store, max-age=0',
            'x-robots-tag': 'noindex, nofollow, noarchive',
            'referrer-policy': 'same-origin',
          },
        };
      }
    }
  }
  return rules;
}

export function buildSitemapEntries(siteUrl = defaultSiteUrl) {
  const postsByPath = new Map(blogPosts.map((post) => [post._path, post]));
  // Editorial dates are stable across builds. Other pages still omit lastmod
  // because no verified content-revision date is maintained for them.
  return buildPublicRoutes().map((path) => {
    const basePath = stripLocale(path);
    const locale = path.startsWith('/kk/') || path === '/kk' ? 'kk' : 'ru';
    const post = postsByPath.get(basePath);
    const latestBlogRevision = blogPosts.filter((item) => getPublishedBlogLocales(item).includes(locale))
      .map((item) => getBlogModifiedAt(item, locale)).filter(Boolean).sort().at(-1);
    const lastmod = post ? getBlogModifiedAt(post, locale) : basePath === '/blog' ? latestBlogRevision : undefined;
    const publishedLocales = post ? getPublishedBlogLocales(post) : ['ru', 'kk'];
    return {
      loc: new URL(path, siteUrl).toString(),
      ...(lastmod ? { lastmod } : {}),
      ...(post?.image?.src ? { images: [{ loc: new URL(post.image.src, siteUrl).toString() }] } : {}),
      alternatives: publishedLocales.length > 1 ? [
        ...publishedLocales.map((code) => ({ hreflang: `${code}-KZ`, href: new URL(localizePublicPath(path, code), siteUrl).toString() })),
        { hreflang: 'x-default', href: new URL(localizePublicPath(path, 'ru'), siteUrl).toString() },
      ] : [],
    };
  });
}
