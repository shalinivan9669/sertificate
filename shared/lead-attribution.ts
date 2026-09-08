import { z } from 'zod';
import { cities } from '../config/cities';
import { courseDirections, legacyCourseDirections, resolveCourseDirection } from './course-registry';

export const journeyStorageKey = 'ot-public-journey-v1';
export const journeyLifetimeMs = 24 * 60 * 60 * 1000;
export const journeySteps = ['landing', 'program', 'consultation', 'selection_start', 'selection_matched', 'selection_unmatched', 'auth_start'] as const;
export type JourneyStep = typeof journeySteps[number];
export const journeySources = ['direct', 'internal', 'search', 'social', 'email', 'other'] as const;
export const journeyRoutes = ['home', 'catalog', 'program', 'city', 'city_program', 'contacts', 'b2b', 'selection', 'auth_login', 'auth_signup'] as const;
const ids = courseDirections.map(row => row.id) as [string, ...string[]];
const cityIds = cities.map(row => row.slug) as [string, ...string[]];
export const journeyContextSchema = z.object({
  routeId: z.enum(journeyRoutes), locale: z.enum(['ru', 'kk']), source: z.enum(journeySources),
  programId: z.enum(ids).optional(), city: z.enum(cityIds).optional(),
  format: z.enum(['online', 'classroom', 'onsite']).optional(),
}).strict().superRefine((value, context) => {
  const program = value.routeId === 'program' || value.routeId === 'city_program';
  if (program && !value.programId) context.addIssue({ code: 'custom', message: 'Program required' });
  if ((value.routeId === 'city' || value.routeId === 'city_program') && !value.city) context.addIssue({ code: 'custom', message: 'City required' });
  if (value.routeId.startsWith('auth_') && (value.programId || value.city || value.format || value.source !== 'internal')) context.addIssue({ code: 'custom', message: 'Auth context is fixed' });
});
export type JourneyContext = z.infer<typeof journeyContextSchema>;
export function journeyStep(context: JourneyContext): typeof journeySteps[number] {
  if (context.routeId === 'selection') return 'selection_start';
  if (context.routeId.startsWith('auth_')) return 'auth_start';
  return context.routeId === 'contacts' || context.routeId === 'b2b' ? 'consultation'
    : context.routeId === 'program' || context.routeId === 'city_program' ? 'program' : 'landing';
}
export function validJourneyStep(step: JourneyStep, context: JourneyContext) {
  return context.routeId === 'selection'
    ? ['selection_start', 'selection_matched', 'selection_unmatched'].includes(step) && (step !== 'selection_matched' || Boolean(context.programId))
    : step === journeyStep(context);
}
export const journeyEventSchema = z.object({
  id: z.string().uuid({ version: 'v4' }), journeyId: z.string().uuid({ version: 'v4' }), sequence: z.number().int().min(1).max(64),
  step: z.enum(journeySteps), context: journeyContextSchema,
}).strict().refine(value => validJourneyStep(value.step, value.context), { message: 'Route and step differ' });
export type JourneyEvent = z.infer<typeof journeyEventSchema>;
export const leadAttributionReferenceSchema = z.object({ journeyId: z.string().uuid({ version: 'v4' }) }).strict();

/** Categories only. Raw campaign text, referrer paths and query values are never retained. */
export function journeySource(referrer: unknown, medium: unknown, origin: string): JourneyContext['source'] {
  if (medium === 'email') return 'email';
  if (medium === 'social') return 'social';
  if (medium === 'organic' || medium === 'cpc' || medium === 'ppc') return 'search';
  if (!referrer) return 'direct';
  if (typeof referrer !== 'string' || referrer.length > 2048) return 'other';
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol)) return 'other';
    if (url.origin === origin) return 'internal';
    const host = url.hostname.toLowerCase();
    if (/^(?:www\.)?(?:google\.(?:com|kz)|yandex\.(?:ru|kz)|bing\.com|duckduckgo\.com)$/.test(host)) return 'search';
    if (/^(?:www\.)?(?:facebook\.com|instagram\.com|linkedin\.com|t\.co|vk\.com)$/.test(host)) return 'social';
    return 'other';
  } catch { return 'other'; }
}

/** Called on real public navigation. Private URLs and arbitrary query fields have no representation. */
export function publicJourneyContext(pathname: string, query: Record<string, unknown>, source: JourneyContext['source']): JourneyContext | undefined {
  const locale = pathname === '/kk' || pathname.startsWith('/kk/') ? 'kk' : 'ru';
  const path = pathname.replace(/^\/kk(?=\/|$)/, '').replace(/\/$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  let routeId: JourneyContext['routeId']; let programId: string | undefined; let city: string | undefined;
  if (path === '/') routeId = 'home';
  else if (path === '/courses') routeId = 'catalog';
  else if (path === '/contacts' || path === '/b2b') {
    routeId = path === '/contacts' ? 'contacts' : 'b2b';
    programId = resolveCourseDirection(query.program)?.id;
    city = cities.find(row => row.slug === query.city)?.slug;
  } else if (parts.length === 2 && parts[0] === 'courses' && resolveCourseDirection(parts[1])) {
    routeId = 'program'; programId = resolveCourseDirection(parts[1])!.id;
    city = cities.find(row => row.slug === query.city)?.slug;
  } else if (parts.length === 1 && legacyCourseDirections.some(row => row.id === parts[0])) {
    routeId = 'program'; programId = parts[0];
  } else if (parts.length === 1 && cities.some(row => row.slug === parts[0])) {
    routeId = 'city'; city = parts[0];
  } else if (parts.length === 2 && cities.some(row => row.slug === parts[0]) && legacyCourseDirections.some(row => row.id === parts[1])) {
    routeId = 'city_program'; city = parts[0]; programId = parts[1];
  } else return undefined;
  const format = ['online', 'classroom', 'onsite'].find(value => value === query.format) as JourneyContext['format'];
  return journeyContextSchema.parse({ routeId, locale, source, ...(programId ? { programId } : {}), ...(city ? { city } : {}), ...(format ? { format } : {}) });
}
