import { createHash } from 'node:crypto';
import { z } from 'zod';
import { execute, queryAll, queryOne, type Db } from '../db';
import { businessFail as fail, parse } from '../utils/business';
import { assertRole, type AppUser } from '../utils/auth';
import { analyticsCities, analyticsConsentVersion, analyticsPrograms, clientAnalyticsEvents, safeClientAnalyticsDimensions, serverAnalyticsEvents, type ClientAnalyticsDimensions } from '../../shared/analytics';
import { resolveCourseDirection } from '../../shared/course-registry';
import { leadDeliveryCohort } from './lead-cohort';

const clientSchema = z.object({ id: z.string().uuid(), name: z.enum(clientAnalyticsEvents), dimensions: z.object({
  programId: z.enum(analyticsPrograms as [string, ...string[]]).optional(), locale: z.enum(['ru', 'kk']).optional(),
  city: z.enum(analyticsCities).optional(), format: z.enum(['online', 'classroom', 'onsite']).optional(), audience: z.enum(['b2c', 'b2b']).optional(),
}).strict() }).strict();

/** Opt-in interface telemetry and aggregate service metrics use this first-party store only. */
export function analyticsConfiguration() {
  const text = process.env.OT_ANALYTICS_RETENTION_DAYS || '';
  const days = /^\d{1,2}$/.test(text) ? Number(text) : 0;
  const retentionDays = days >= 1 && days <= 90 ? days : null;
  return { enabled: process.env.OT_ANALYTICS_ENABLED === '1' && retentionDays !== null, consentVersion: analyticsConsentVersion, retentionDays };
}

export async function recordClientAnalytics(data: unknown, consent?: string, beforeWrite?: () => Promise<unknown>) {
  const event = parse(clientSchema, data);
  if (!analyticsConfiguration().enabled) return { accepted: false, reason: 'disabled' };
  if (consent !== analyticsConsentVersion) return { accepted: false, reason: 'consent_required' };
  // Disabled or non-consenting public traffic performs no database write, including rate-limit counters.
  if (beforeWrite) await beforeWrite();
  await execute('INSERT OR IGNORE INTO analytics_events(id,name,dimensions_json,created_at) VALUES(?,?,?,?)', [event.id, event.name, JSON.stringify(event.dimensions), new Date().toISOString()]);
  return { accepted: true };
}

type Dimension = ClientAnalyticsDimensions & { version?: number; channel?: 'self_service' | 'staff' | 'user_submit' | 'deadline' | 'sandbox' | 'manual_invoice' | 'document_operation' | 'crm' };
type ServerEvent = typeof serverAnalyticsEvents[number];
type VersionRow = { program_id: string; version: number; data_json: string; organization_id?: string | null };
function versionDimensions(row: VersionRow): Dimension {
  let data: any = {}; try { data = JSON.parse(row.data_json); } catch { /* Corrupt content is not copied to telemetry. */ }
  return { ...safeClientAnalyticsDimensions({ programId: row.program_id, locale: data.language, format: data.format, audience: row.organization_id ? 'b2b' : 'b2c' }), ...(Number.isSafeInteger(Number(row.version)) && Number(row.version) > 0 ? { version: Number(row.version) } : {}) };
}
function stableId(name: ServerEvent, entity: string) { return 'server:' + createHash('sha256').update(`${name}\0${entity}`).digest('hex'); }
async function emit(name: ServerEvent, entity: string, dimensions: Dimension, createdAt: string, db?: Db) {
  await execute('INSERT OR IGNORE INTO analytics_events(id,name,dimensions_json,created_at) VALUES(?,?,?,?)', [stableId(name, entity), name, JSON.stringify(dimensions), createdAt], db);
}
async function enrollment(id: string, db?: Db) {
  return queryOne<VersionRow & { id: string; status: string }>('SELECT e.id,e.status,e.organization_id,v.program_id,v.version,v.data_json FROM enrollments e JOIN program_versions v ON v.id=e.version_id WHERE e.id=?', [id], db);
}
async function activation(id: string, createdAt: string, channel: Dimension['channel'], db?: Db) {
  const row = await enrollment(id, db);
  if (row && ['active', 'learning_complete', 'assessment_eligible', 'completed'].includes(row.status)) await emit('enrollment_activated', row.id, { ...versionDimensions(row), channel }, createdAt, db);
}

/** Projects confirmed audit transitions in their transaction; never trusts a client stage/result. */
export async function projectServerAnalytics(input: { action: string; target: string; createdAt: string }, db?: Db) {
  if (!analyticsConfiguration().enabled) return;
  const { action, target, createdAt } = input;
  if (action === 'lead_accepted' || action === 'lead_crm_delivered') {
    const row = await queryOne<{ payload_json: string; status: string }>('SELECT payload_json,status FROM lead_submissions WHERE id=?', [target], db);
    if (!row || action === 'lead_crm_delivered' && row.status !== 'delivered') return;
    let payload: any = {}; try { payload = JSON.parse(row.payload_json); } catch { return; }
    const dimensions = safeClientAnalyticsDimensions({ programId: resolveCourseDirection(payload.programId)?.id, city: payload.city, locale: payload.locale, format: payload.format, audience: payload.organizationName ? 'b2b' : 'b2c' });
    await emit(action, target, { ...dimensions, channel: 'crm' }, createdAt, db); return;
  }
  if (action === 'learning.enrollment_created' || action === 'learning.enrollment_activated') {
    await activation(target, createdAt, action.endsWith('created') ? undefined : 'staff', db); return;
  }
  if (action === 'learning.lesson_completed' || action === 'learning.practice_confirmed') {
    const separator = target.indexOf('/'); if (separator < 1) return;
    const enrollmentId = target.slice(0, separator), lessonId = target.slice(separator + 1);
    const row = await enrollment(enrollmentId, db);
    if (row && await queryOne('SELECT 1 AS found FROM lesson_progress WHERE enrollment_id=? AND lesson_id=? AND completed=1', [enrollmentId, lessonId], db)) await emit('lesson_completed', target, versionDimensions(row), createdAt, db);
    return;
  }
  if (['assessment.started', 'assessment.submitted', 'assessment.expired'].includes(action)) {
    const row = await queryOne<VersionRow & { status: string; result_json: string | null }>('SELECT a.status,a.result_json,e.organization_id,v.program_id,v.version,v.data_json FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id JOIN program_versions v ON v.id=e.version_id WHERE a.id=?', [target], db);
    if (!row) return;
    if (action === 'assessment.started' && row.status === 'in_progress') await emit('assessment_started', target, versionDimensions(row), createdAt, db);
    else if (action !== 'assessment.started' && ['graded', 'expired'].includes(row.status) && row.result_json) {
      const dimensions = { ...versionDimensions(row), channel: action.endsWith('expired') ? 'deadline' as const : 'user_submit' as const };
      await emit('assessment_submitted', target, dimensions, createdAt, db); await emit('assessment_graded', target, dimensions, createdAt, db);
    }
    return;
  }
  if (action === 'payment_confirmed' || action === 'refund_confirmed') {
    const row = await queryOne<VersionRow & { status: string; enrollment_id: string | null }>('SELECT o.status,o.enrollment_id,o.organization_id,v.program_id,v.version,v.data_json FROM orders o JOIN program_versions v ON v.id=o.version_id WHERE o.id=?', [target], db);
    const confirmed = action === 'payment_confirmed' ? await queryOne("SELECT 1 AS ok FROM payments WHERE order_id=? AND status='succeeded'", [target], db) : await queryOne("SELECT 1 AS ok FROM refunds WHERE order_id=? AND status='confirmed'", [target], db);
    if (row && confirmed) { await emit(action, `order:${target}`, { ...versionDimensions(row), channel: 'sandbox' }, createdAt, db); if (action === 'payment_confirmed' && row.enrollment_id) await activation(row.enrollment_id, createdAt, 'sandbox', db); }
    return;
  }
  if (action === 'invoice.payment_confirmed_manually') {
    const row = await queryOne<VersionRow>('SELECT i.organization_id,v.program_id,v.version,v.data_json FROM corporate_invoices i JOIN program_versions v ON v.id=i.version_id WHERE i.id=? AND i.status=?', [target, 'confirmed'], db);
    if (!row) return;
    await emit('payment_confirmed', `invoice:${target}`, { ...versionDimensions(row), channel: 'manual_invoice' }, createdAt, db);
    const lines = await queryAll<{ enrollment_id: string }>("SELECT f.enrollment_id FROM corporate_invoice_lines l JOIN corporate_invoice_fulfillments f ON f.line_id=l.id JOIN enrollments e ON e.id=f.enrollment_id WHERE l.invoice_id=? AND e.status IN ('active','learning_complete','assessment_eligible','completed')", [target], db);
    if (lines.length) await execute(`INSERT OR IGNORE INTO analytics_events(id,name,dimensions_json,created_at) VALUES ${lines.map(() => '(?,?,?,?)').join(',')}`, lines.flatMap(line => [stableId('enrollment_activated', line.enrollment_id), 'enrollment_activated', JSON.stringify({ ...versionDimensions(row), channel: 'manual_invoice' }), createdAt]), db);
    return;
  }
  if (action === 'credential_issued' || action === 'credential_revoked') {
    const row = await queryOne<VersionRow & { status: string }>('SELECT c.status,e.organization_id,v.program_id,v.version,v.data_json FROM credentials c JOIN enrollments e ON e.id=c.enrollment_id JOIN program_versions v ON v.id=e.version_id WHERE c.id=?', [target], db);
    if (row && row.status === (action === 'credential_issued' ? 'issued' : 'revoked')) await emit(action, target, { ...versionDimensions(row), channel: 'document_operation' }, createdAt, db);
  }
}

export async function analyticsReport(actor: AppUser, query: Record<string, unknown>, now = Date.now()) {
  assertRole(actor, []);
  const configuration = analyticsConfiguration();
  const requested = query.days === undefined ? 7 : Number(query.days);
  if (!Number.isInteger(requested) || requested < 1 || requested > 31) fail(400, 'ANALYTICS_WINDOW_INVALID');
  const days = Math.min(requested, configuration.retentionDays || 31);
  const until = new Date(now).toISOString(), from = new Date(now - days * 86400000).toISOString();
  const rows = await queryAll<{ name: string; events: number }>('SELECT name,COUNT(*) AS events FROM analytics_events WHERE created_at>=? AND created_at<? GROUP BY name', [from, until]);
  const counts = new Map(rows.map(row => [row.name, Number(row.events)]));
  const client = clientAnalyticsEvents.map(name => ({ name, events: counts.get(name) || 0 }));
  const server = serverAnalyticsEvents.map(name => ({ name, events: counts.get(name) || 0 }));
  const leadCohort = await leadDeliveryCohort(from, until, new Date().toISOString());
  return { configuration, window: { from, until, days, timezone: 'UTC', bounds: '[from,until)' }, unit: 'deduplicated_events', clientPopulation: 'opted_in_browser_actions', serverPopulation: 'confirmed_service_transitions', uniqueVisitorsMeasured: false, conversionRate: null,
    client, server, totals: { client: client.reduce((n, row) => n + row.events, 0), server: server.reduce((n, row) => n + row.events, 0) }, leadCohort };
}

/** Only optional analytics records; never audit, attempts, payments, files or consent history. */
export async function expireAnalytics(now = Date.now()) {
  const { enabled, retentionDays } = analyticsConfiguration();
  if (!enabled || !retentionDays) return { deleted: 0, enabled: false };
  const cutoff = new Date(now - retentionDays * 86400000).toISOString();
  const started = Date.now(); let deleted = 0;
  for (let batch = 0; batch < 10 && Date.now() - started < 3000; batch++) {
    const result = await execute('DELETE FROM analytics_events WHERE id IN (SELECT id FROM analytics_events WHERE created_at<? ORDER BY created_at LIMIT 500)', [cutoff]);
    deleted += Number(result.rowsAffected); if (Number(result.rowsAffected) < 500) break;
  }
  return { deleted, enabled: true, cutoff, batchLimit: 5000, elapsedMs: Date.now() - started };
}
