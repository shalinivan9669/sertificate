import { courseDirections } from './course-registry';

export const clientAnalyticsEvents = ['program_view', 'selection_start', 'selection_complete', 'contact_click', 'lead_form_start', 'checkout_view', 'lesson_open', 'support_open'] as const;
export const serverAnalyticsEvents = ['lead_accepted', 'lead_crm_delivered', 'enrollment_activated', 'lesson_completed', 'assessment_started', 'assessment_submitted', 'assessment_graded', 'payment_confirmed', 'refund_confirmed', 'credential_issued', 'credential_revoked'] as const;
export const analyticsConsentVersion = 'analytics-v1' as const;
export const analyticsCookieName = 'ot_analytics_consent' as const;
export const analyticsCities = ['almaty', 'astana', 'shymkent', 'karaganda', 'atyrau', 'aktau', 'pavlodar', 'ust-kamenogorsk', 'kostanay', 'taraz', 'kyzylorda', 'aktobe', 'petropavlovsk', 'semey', 'uralsk'] as const;
export const analyticsPrograms = courseDirections.map(direction => direction.id);
export type ClientAnalyticsEvent = typeof clientAnalyticsEvents[number];
export type ClientAnalyticsDimensions = { programId?: string; locale?: 'ru' | 'kk'; city?: string; format?: 'online' | 'classroom' | 'onsite'; audience?: 'b2c' | 'b2b' };

/** No arbitrary strings, route/query values, names or persistent visitor identifier. */
export function safeClientAnalyticsDimensions(input: ClientAnalyticsDimensions): ClientAnalyticsDimensions {
  return {
    ...(input.programId && analyticsPrograms.includes(input.programId as typeof analyticsPrograms[number]) ? { programId: input.programId } : {}),
    ...(['ru', 'kk'].includes(input.locale || '') ? { locale: input.locale } : {}),
    ...(analyticsCities.includes(input.city as typeof analyticsCities[number]) ? { city: input.city } : {}),
    ...(['online', 'classroom', 'onsite'].includes(input.format || '') ? { format: input.format } : {}),
    ...(['b2c', 'b2b'].includes(input.audience || '') ? { audience: input.audience } : {}),
  };
}
