import { cities } from './cities.js';
import { courses } from './courses.js';
import { formats } from './formats.js';

// Browser/SSR routing has no dependency on the build-time source-product inventory.
// Keep shared TypeScript registries in public-route-policy's build graph: Nuxt's
// SSR externalization of shared files must not rebase relative config imports.
export const nonIndexableRoots = [
  '/auth', '/cabinet', '/account', '/organizations', '/learn', '/exam', '/payment', '/orders', '/certificates',
  '/verify', '/admin', '/api', '/preview', '/src', '/second',
  '/program-selection', '/wizard', '/categories',
];

export function stripLocale(path) {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return pathname === '/kk' ? '/' : pathname.replace(/^\/kk(?=\/)/, '');
}

export function isNonIndexableRoute(path) {
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { /* Retain malformed paths for the 404 handler. */ }
  const pathname = stripLocale(decoded.toLowerCase());
  return nonIndexableRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function localizePublicPath(path, locale = 'ru') {
  const base = stripLocale(path);
  return locale === 'kk' ? (base === '/' ? '/kk' : `/kk${base}`) : base;
}

export function resolvePublicCityPage(citySlug, pageSlug) {
  const city = cities.find((item) => item.slug === citySlug);
  if (!city) return null;
  const course = courses.find((item) => item.slug === pageSlug);
  if (course) return { kind: 'course', city, course };
  const format = formats.find((item) => item.slug === pageSlug);
  return format ? { kind: 'format', city, format } : null;
}
