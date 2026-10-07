import { publicContactPhone } from '../config/public-contacts.js';
import { canonicalPublicPath, isNonIndexableRoute, stripLocale } from '../config/public-route-runtime.js';
import { cities } from '../config/cities.js';
import { resolveCourseDirection } from './course-registry';

export const whatsAppGreeting = 'Здравствуйте! Пишу с сайта otcenter.kz. Хочу уточнить условия обучения и получить предложение';

/** Build a public-page enquiry; never forward query, hash, form values or personal routes. */
export function buildWhatsAppContactUrl(path: string, siteUrl: string, locale: string = 'ru'): string | undefined {
  if (isNonIndexableRoute(path)) return undefined;
  const canonicalPath = canonicalPublicPath(path);
  const segments = stripLocale(canonicalPath).split('/').filter(Boolean);
  const isCoursePage = segments.length === 1 || (segments.length === 2
    && (segments[0] === 'courses' || cities.some(city => city.slug === segments[0])));
  const direction = isCoursePage ? resolveCourseDirection(segments.at(-1)) : undefined;
  const title = direction?.title[locale === 'kk' ? 'kk' : 'ru'];
  const canonical = new URL(canonicalPath, siteUrl);
  canonical.search = '';
  canonical.hash = '';
  const context = title ? `Курс: ${title}.\n${canonical.toString()}` : `Страница: ${canonical.toString()}`;
  const message = `${whatsAppGreeting}\n\n${context}`;
  return `https://wa.me/${publicContactPhone.e164.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
