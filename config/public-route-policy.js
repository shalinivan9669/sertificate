import { cities } from './cities.js';
import { courses } from './courses.js';
import { formats } from './formats.js';
import { blogPosts } from './blog.js';
import { additionalSourceDirections } from '../shared/source-products.ts';
import { localizePublicPath, nonIndexableRoots, stripLocale } from './public-route-runtime.js';
export { isNonIndexableRoute, localizePublicPath, nonIndexableRoots, resolvePublicCityPage, stripLocale } from './public-route-runtime.js';

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
    ...blogPosts.map((post) => post._path),
    ...cities.flatMap((city) => [
      `/${city.slug}`,
      ...courses.map((course) => `/${city.slug}/${course.slug}`),
      ...formats.map((format) => `/${city.slug}/${format.slug}`),
    ]),
  ];
  return [...new Set(national.flatMap((path) => [path, localizePublicPath(path, 'kk')]))];
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
  const latestBlogRevision = blogPosts.map((post) => post.updatedAt || post.date).filter(Boolean).sort().at(-1);
  return buildPublicRoutes().map((path) => {
    const basePath = stripLocale(path);
    const post = postsByPath.get(basePath);
    const lastmod = post ? post.updatedAt || post.date : basePath === '/blog' ? latestBlogRevision : undefined;
    return {
      loc: new URL(path, siteUrl).toString(),
      ...(lastmod ? { lastmod } : {}),
      ...(post?.image?.src ? { images: [{ loc: new URL(post.image.src, siteUrl).toString() }] } : {}),
      alternatives: [
        { hreflang: 'ru-KZ', href: new URL(localizePublicPath(path, 'ru'), siteUrl).toString() },
        { hreflang: 'kk-KZ', href: new URL(localizePublicPath(path, 'kk'), siteUrl).toString() },
        { hreflang: 'x-default', href: new URL(localizePublicPath(path, 'ru'), siteUrl).toString() },
      ],
    };
  });
}
