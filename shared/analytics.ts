import { courseDirections } from './course-registry';

export const clientAnalyticsEvents = ['program_view', 'selection_start', 'selection_complete', 'contact_click', 'lead_form_start', 'checkout_view', 'lesson_open', 'support_open'] as const;
export const serverAnalyticsEvents = ['lead_accepted', 'lead_crm_delivered', 'enrollment_activated', 'lesson_completed', 'assessment_started', 'assessment_submitted', 'assessment_graded', 'payment_confirmed', 'refund_confirmed', 'credential_issued', 'credential_revoked'] as const;
export const analyticsConsentVersion = 'analytics-v2' as const;
export const analyticsCookieName = 'ot_analytics_consent' as const;
export const analyticsCities = ['almaty', 'astana', 'shymkent', 'karaganda', 'atyrau', 'aktau', 'pavlodar', 'ust-kamenogorsk', 'kostanay', 'taraz', 'kyzylorda', 'aktobe', 'petropavlovsk', 'semey', 'uralsk'] as const;
export const analyticsPrograms = courseDirections.map(direction => direction.id);
export type ClientAnalyticsEvent = typeof clientAnalyticsEvents[number];
export type ClientAnalyticsDimensions = { programId?: string; locale?: 'ru' | 'kk'; city?: string; format?: 'online' | 'classroom' | 'onsite'; audience?: 'b2c' | 'b2b' };

/** Operational lead counts, separate from optional browser/server event telemetry. */
export type LeadCohortCounts = { accepted: number; delivered: number; pending: number; notePending: number; invalid: number; deliveryRate: number | null };
export type LeadCohortReport = {
  unit: 'accepted_leads';
  window: { from: string; until: string; bounds: '[from,until)' };
  asOf: string;
  statusTime: 'current';
  totals: LeadCohortCounts;
  audiences: Array<LeadCohortCounts & { audience: 'b2c' | 'b2b' | 'unknown' }>;
};

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
