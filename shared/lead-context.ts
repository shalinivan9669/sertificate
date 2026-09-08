import { cities } from '../config/cities';
import { resolveCourseDirection } from './course-registry';

export const leadCities = cities.map(({ slug, nameRu, nameKk }) => ({
  id: slug,
  title: { ru: nameRu, kk: nameKk || nameRu },
}));
export const leadFormats = [
  { id: 'online', title: { ru: 'Онлайн', kk: 'Онлайн' } },
  { id: 'classroom', title: { ru: 'В учебном центре', kk: 'Оқу орталығында' } },
  { id: 'onsite', title: { ru: 'На площадке организации', kk: 'Ұйым аумағында' } },
] as const;

/** Only the existing public query / selection fields; no contact data or attribution. */
export function readLeadContext(input: unknown) {
  const value = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const program = Object.hasOwn(value, 'program') ? value.program
    : Object.hasOwn(value, 'programId') ? value.programId : value.direction;
  return {
    programId: resolveCourseDirection(program)?.id || '',
    city: leadCities.find(city => city.id === value.city)?.id || '',
    format: leadFormats.find(format => format.id === value.format)?.id || '',
  };
}

/** Explicit CTA context wins; callers never mix it with an unrelated stored selection. */
export function leadContextQuery(input: unknown): Record<string, string> {
  const context = readLeadContext(input);
  return {
    ...(context.programId ? { program: context.programId } : {}),
    ...(context.city ? { city: context.city } : {}),
    ...(context.format ? { format: context.format } : {}),
  };
}

export function leadCityLabel(slug: string, locale: unknown) {
  return leadCities.find(city => city.id === slug)?.title[locale === 'kk' ? 'kk' : 'ru'] || '';
}

/** The existing editable city field accepts a manually entered location as before. */
export function leadCityValue(input: string) {
  const value = input.trim();
  const known = leadCities.find(city => [city.id, city.title.ru, city.title.kk]
    .some(name => name.toLocaleLowerCase() === value.toLocaleLowerCase()));
  return known?.id || value;
}
