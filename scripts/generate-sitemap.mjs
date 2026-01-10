import fs from 'node:fs/promises';
import { cities } from '../config/cities.js';
import { courses } from '../config/courses.js';
import { formats } from '../config/formats.js';
import { blogPosts } from '../config/blog.js';

const siteUrl = 'https://otcenter.kz';

const baseRoutes = [
  '/',
  '/blog',
  '/contacts',
  '/licenses',
  '/public-offer',
  '/privacy',
  ...courses.map((course) => `/${course.slug}`),
  ...formats.map((format) => `/${format.slug}`),
];

const blogRoutes = blogPosts.map((post) => post._path);
const cityRoutes = cities.map((city) => `/${city.slug}`);
const courseRoutes = cities.flatMap((city) =>
  courses.map((course) => `/${city.slug}/${course.slug}`),
);
const formatRoutes = cities.flatMap((city) =>
  formats.map((format) => `/${city.slug}/${format.slug}`),
);

const allRoutes = [
  ...baseRoutes,
  ...blogRoutes,
  ...cityRoutes,
  ...courseRoutes,
  ...formatRoutes,
];

const prefixRoutes = (routes, locale) =>
  routes.map((route) => (route === '/' ? `/${locale}` : `/${locale}${route}`));

const localizedRoutes = prefixRoutes(allRoutes, 'kk');
const uniqueRoutes = Array.from(new Set([...allRoutes, ...localizedRoutes]));

const urls = uniqueRoutes
  .map(
    (route) => `  <url>\n    <loc>${siteUrl}${route}</loc>\n  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

await fs.writeFile('public/sitemap.xml', xml);
console.log(`Generated sitemap with ${uniqueRoutes.length} URLs`);
