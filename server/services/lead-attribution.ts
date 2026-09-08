import { execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail } from '../utils/business';
import { logObservation } from '../utils/observability';
import { analyticsConsentVersion } from '../../shared/analytics';
import type { AppUser } from '../utils/auth';
import { journeyContextSchema, journeyEventSchema, leadAttributionReferenceSchema } from '../../shared/lead-attribution';

// Kept independent from the server-truth projection to avoid a leads -> analytics -> leads cycle.
export function leadAttributionConfiguration() {
  const raw = process.env.OT_ANALYTICS_RETENTION_DAYS || '';
  const days = /^\d{1,2}$/.test(raw) ? Number(raw) : 0;
  return { enabled: process.env.OT_ANALYTICS_ENABLED === '1' && days >= 1 && days <= 90, days: days >= 1 && days <= 90 ? days : null };
}

export async function recordPublicJourney(input: unknown, consent?: string, beforeWrite?: () => Promise<unknown>, now = Date.now()) {
  const result = journeyEventSchema.safeParse(input);
  if (!result.success) fail(400, 'JOURNEY_INVALID');
  const configuration = leadAttributionConfiguration();
  if (!configuration.enabled) return { accepted: false, reason: 'disabled' };
  if (consent !== analyticsConsentVersion) return { accepted: false, reason: 'consent_required' };
  if (beforeWrite) await beforeWrite();
  const event = result.data, timestamp = new Date(now).toISOString();
  return withTransaction(async tx => {
    const current = await queryOne<{ expires_at: string }>('SELECT expires_at FROM public_journeys WHERE id=?', [event.journeyId], tx);
    if (current && current.expires_at <= timestamp) return { accepted: false, reason: 'expired' };
    const old = await queryOne<{ journey_id: string; sequence: number; step: string; context_json: string }>('SELECT journey_id,sequence,step,context_json FROM public_journey_steps WHERE id=? OR (journey_id=? AND sequence=?)', [event.id, event.journeyId, event.sequence], tx);
    const json = JSON.stringify(event.context);
    if (old) {
      if (old.journey_id !== event.journeyId || Number(old.sequence) !== event.sequence || old.step !== event.step || old.context_json !== json) fail(409, 'JOURNEY_EVENT_CONFLICT');
      return { accepted: true };
    }
    await execute('INSERT OR IGNORE INTO public_journeys(id,consent_version,created_at,updated_at,expires_at) VALUES(?,?,?,?,?)', [event.journeyId, analyticsConsentVersion, timestamp, timestamp, new Date(now + configuration.days! * 86400000).toISOString()], tx);
    await execute('INSERT INTO public_journey_steps(id,journey_id,sequence,step,context_json,created_at) VALUES(?,?,?,?,?,?)', [event.id, event.journeyId, event.sequence, event.step, json, timestamp], tx);
    await execute('UPDATE public_journeys SET updated_at=? WHERE id=?', [timestamp, event.journeyId], tx);
    return { accepted: true };
  });
}

/** The public event schema has no auth-confirmed variant. Only a fresh verified session can mark it. */
export async function confirmPublicJourneyAuth(input: unknown, consent: string | undefined, authenticated: () => Promise<AppUser>, beforeWrite?: () => Promise<unknown>, now = Date.now()) {
  const parsed = leadAttributionReferenceSchema.safeParse(input);
  if (!parsed.success) fail(400, 'JOURNEY_INVALID');
  if (!leadAttributionConfiguration().enabled) return { accepted: false, reason: 'disabled' };
  if (consent !== analyticsConsentVersion) return { accepted: false, reason: 'consent_required' };
  if (beforeWrite) await beforeWrite();
  const user = await authenticated();
  if (user.twoFactorEnabled && (!user.mfaVerifiedAt || user.mfaVerifiedAt > now || now - user.mfaVerifiedAt > 12 * 3600000)) fail(403, 'MFA_REQUIRED');
  const timestamp = new Date(now).toISOString();
  const changed = await execute(`UPDATE public_journeys SET auth_confirmed_at=COALESCE(auth_confirmed_at,?)
    WHERE id=? AND consent_version=? AND expires_at>?
    AND EXISTS(SELECT 1 FROM public_journey_steps s WHERE s.journey_id=public_journeys.id AND s.step='auth_start' AND s.created_at<=?)`, [timestamp, parsed.data.journeyId, analyticsConsentVersion, timestamp, timestamp]);
  return Number(changed.rowsAffected) > 0 ? { accepted: true } : { accepted: false, reason: 'no_started_journey' };
}

/** Called only for the first successful business acceptance, after its transaction commits.
 * There is deliberately no retry from a repeated business request: it cannot rewrite first-touch.
 */
export async function attachLeadAttribution(leadId: string, reference: unknown, consent?: string, now = Date.now()) {
  const parsed = leadAttributionReferenceSchema.safeParse(reference);
  const configuration = leadAttributionConfiguration();
  if (!configuration.enabled || consent !== analyticsConsentVersion || !parsed.success) return false;
  try {
    return await withTransaction(async tx => {
      const timestamp = new Date(now).toISOString();
      const journey = await queryOne<{ expires_at: string }>('SELECT expires_at FROM public_journeys WHERE id=? AND expires_at>? AND consent_version=?', [parsed.data.journeyId, timestamp, analyticsConsentVersion], tx);
      if (!journey) return false;
      const lead = await queryOne<{ created_at: string }>('SELECT created_at FROM lead_submissions WHERE id=?', [leadId], tx);
      if (!lead) return false;
      const steps = await queryAll<{ sequence: number; context_json: string }>('SELECT sequence,context_json FROM public_journey_steps WHERE journey_id=? AND created_at<=? ORDER BY sequence', [parsed.data.journeyId, lead.created_at], tx);
      if (!steps.length) return false;
      // Revalidate historical JSON before persisting any context outside its optional table.
      const first = journeyContextSchema.parse(JSON.parse(steps[0]!.context_json));
      const last = journeyContextSchema.parse(JSON.parse(steps[steps.length - 1]!.context_json));
      const expiry = new Date(Math.min(Date.parse(journey.expires_at), now + configuration.days! * 86400000)).toISOString();
      const changed = await execute('INSERT OR IGNORE INTO lead_attributions(lead_id,journey_id,last_sequence,first_touch_json,last_touch_json,consent_version,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)', [leadId, parsed.data.journeyId, steps[steps.length - 1]!.sequence, JSON.stringify(first), JSON.stringify(last), analyticsConsentVersion, lead.created_at, expiry], tx);
      return Number(changed.rowsAffected) === 1;
    });
  } catch { logObservation({ event: 'telemetry_write_failed' }); return false; }
}

/** Only enum context reaches the existing common note. Never expose the journey identifier. */
export async function leadAttributionNote(leadId: string, db?: Db, now = Date.now()) {
  try {
    const row = await queryOne<{ first_touch_json: string; last_touch_json: string }>('SELECT first_touch_json,last_touch_json FROM lead_attributions WHERE lead_id=? AND expires_at>?', [leadId, new Date(now).toISOString()], db);
    if (!row) return '';
    const values = [row.first_touch_json, row.last_touch_json].map(json => journeyContextSchema.parse(JSON.parse(json)));
    return values.map((context, index) => `${index ? 'Последний' : 'Первый'} публичный источник (с согласия): ${JSON.stringify(context)}`).join('\n');
  } catch { logObservation({ event: 'telemetry_write_failed' }); return ''; }
}

/** Expiry runs even after collection is disabled. Bounded indexed deletes preserve service records. */
export async function expireLeadAttribution(now = Date.now()) {
  const timestamp = new Date(now).toISOString(), started = Date.now(); let deleted = 0;
  for (let batch = 0; batch < 10 && Date.now() - started < 3000; batch++) {
    const sidecars = await execute('DELETE FROM lead_attributions WHERE lead_id IN (SELECT lead_id FROM lead_attributions WHERE expires_at<=? LIMIT 250)', [timestamp]);
    const journeys = await execute('DELETE FROM public_journeys WHERE id IN (SELECT id FROM public_journeys WHERE expires_at<=? LIMIT 250)', [timestamp]);
    deleted += Number(sidecars.rowsAffected) + Number(journeys.rowsAffected);
    if (Number(sidecars.rowsAffected) < 250 && Number(journeys.rowsAffected) < 250) break;
  }
  return { deleted };
}
