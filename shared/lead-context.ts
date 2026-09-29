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

/** Accept only known direction IDs/aliases, preserving selection order. */
export function readLeadPrograms(input: unknown): string[] {
  const value = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const selected = Object.hasOwn(value, 'programs') ? value.programs
    : Object.hasOwn(value, 'programIds') ? value.programIds
      : Object.hasOwn(value, 'directionIds') ? value.directionIds
        : readLeadContext(input).programId;
  // An explicitly empty list clears the selection instead of restoring its
  // legacy first ID. Query content is never used as a title or a comment.
  const candidates = Array.isArray(selected) ? selected.slice(0, 64) : [selected];
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length > 4096) continue;
    for (const token of candidate.split(',').slice(0, 64)) {
      const direction = resolveCourseDirection(token.trim());
      if (direction) ids.add(direction.id);
    }
  }
  return [...ids];
}

/** Safe routing context; the first program remains compatible with old forms. */
export function leadProgramQuery(input: unknown): Record<string, string> {
  const context = readLeadContext(input);
  const programs = readLeadPrograms(input);
  return {
    ...(programs[0] ? { program: programs[0] } : {}),
    ...(programs.length > 1 ? { programs: programs.join(',') } : {}),
    ...(context.city ? { city: context.city } : {}),
    ...(context.format ? { format: context.format } : {}),
  };
}

/** Explicit CTA context wins; callers never mix it with an unrelated stored selection. */
export function leadContextQuery(input: unknown): Record<string, string> {
  return leadProgramQuery(input);
}

/** Only registry-owned titles reach the editable multi-program comment. */
export function leadProgramsComment(input: unknown, locale: unknown) {
  const programs = readLeadPrograms(input);
  if (programs.length < 2) return '';
  const language = locale === 'kk' ? 'kk' : 'ru';
  const heading = language === 'kk' ? 'Қажетті оқу бағыттары:' : 'Интересуют направления обучения:';
  return [heading, ...programs.map(id => `• ${resolveCourseDirection(id)!.title[language]}`)].join('\n');
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
