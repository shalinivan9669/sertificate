import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { audit, execute, queryAll, queryOne, withTransaction } from '../db';
import { deliverLead } from './leads';
import { renderCredential } from './credentials';
import { businessFail as fail, id, nowIso, parse } from '../utils/business';
import { assertRole, type AppUser } from '../utils/auth';
import { incrementOperationalCounter, recordIncident, scanOperationalIncidents } from './incidents';
import { deliverLearningReminder, scheduleLearningReminders } from './reminders';
import { expireDueAttempts } from './assessment';
import { expireAnalytics } from './analytics';
import { expireLeadAttribution } from './lead-attribution';
import { jobObservation, logObservation, runWithObservation, safeDeliveryCode } from '../utils/observability';

export function secretEquals(value: string, expected: string | undefined) {
  if (!expected || expected.length < 32) return false;
  const incoming = Buffer.from(value); const configured = Buffer.from(expected);
  return incoming.length === configured.length && timingSafeEqual(incoming, configured);
}
export async function operationsOverview(actor: AppUser) {
  assertRole(actor, ['editor', 'reviewer', 'instructor', 'issuer', 'finance']);
  const permitted = (...roles: string[]) => actor.role === 'admin' || roles.includes(actor.role);
  const [leads, outbox, orders, credentials, templates, auditEvents, enrollments] = await Promise.all([
    permitted() ? queryAll('SELECT id,status,crm_lead_id AS crmLeadId,created_at AS createdAt FROM lead_submissions ORDER BY created_at DESC LIMIT 100') : [],
    permitted() ? queryAll('SELECT id,type,aggregate_id AS aggregateId,status,attempts,available_at AS availableAt,last_error AS lastError FROM outbox ORDER BY created_at DESC LIMIT 100') : [],
    permitted('finance') ? queryAll('SELECT id,status,amount_minor AS amountMinor,currency,created_at AS createdAt FROM orders ORDER BY created_at DESC LIMIT 100') : [],
    permitted('issuer') ? queryAll('SELECT id,enrollment_id AS enrollmentId,serial,status,issued_at AS issuedAt FROM credentials ORDER BY created_at DESC LIMIT 100') : [],
    permitted('issuer', 'reviewer') ? queryAll('SELECT id,program_id AS programId,name,status,created_by AS createdBy FROM credential_templates ORDER BY created_at DESC LIMIT 100') : [],
    permitted() ? queryAll('SELECT id,actor_id AS actorId,action,target,created_at AS createdAt FROM audit_events ORDER BY created_at DESC LIMIT 100') : [],
    permitted('instructor', 'issuer') ? queryAll('SELECT e.id,e.user_id AS userId,e.version_id AS versionId,e.status,u.name AS learnerName,v.program_id AS programId FROM enrollments e JOIN "user" u ON u.id=e.user_id JOIN program_versions v ON v.id=e.version_id ORDER BY e.created_at DESC LIMIT 100') : [],
  ]);
  const metrics = permitted() ? await queryOne(`SELECT
    (SELECT COUNT(*) FROM outbox WHERE status='failed') AS failedJobs,
    (SELECT COUNT(*) FROM outbox WHERE status='pending') AS pendingJobs,
    (SELECT COUNT(*) FROM lead_submissions WHERE status!='delivered') AS undeliveredLeads,
    (SELECT COUNT(*) FROM orders WHERE status='pending') AS pendingOrders,
    (SELECT COUNT(*) FROM credentials WHERE status='pending') AS pendingDocuments`) : null;
  return { leads, outbox, orders, credentials, templates, auditEvents, enrollments, metrics };
}
export async function retryJob(actorId: string, jobId: string, reason: string) {
  if (reason.trim().length < 10 || reason.length > 2000) fail(400, 'REASON_REQUIRED');
  return withTransaction(async tx => {
    const job = await queryOne('SELECT * FROM outbox WHERE id=?', [jobId], tx);
    if (!job) fail(404, 'JOB_NOT_FOUND');
    if (job.status === 'delivered' || job.lease_until && job.lease_until > nowIso()) fail(409, 'JOB_NOT_RETRYABLE');
    await execute('UPDATE outbox SET status=?,available_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=?', ['pending', nowIso(), nowIso(), jobId], tx);
    await audit(actorId, 'outbox_retry', jobId, reason, null, tx);
    return { queued: true };
  });
}
async function notification(job: any) {
  const payload = JSON.parse(job.payload_json);
  let userId = payload.userId;
  if (!userId && job.type === 'learning.enrolled') userId = (await queryOne('SELECT user_id FROM enrollments WHERE id=?', [job.aggregate_id]))?.user_id;
  if (!userId && job.type === 'assessment.graded') userId = (await queryOne('SELECT e.user_id FROM attempts a JOIN enrollments e ON e.id=a.enrollment_id WHERE a.id=?', [job.aggregate_id]))?.user_id;
  if (!userId && payload.credentialId) userId = (await queryOne('SELECT e.user_id FROM credentials c JOIN enrollments e ON e.id=c.enrollment_id WHERE c.id=?', [payload.credentialId]))?.user_id;
  if (!userId) return;
  await execute('INSERT OR IGNORE INTO notifications(id,user_id,purpose,template,payload_json,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?)', [id(), userId, 'service', job.type, JSON.stringify(payload), `${job.type}:${job.aggregate_id}`, nowIso()]);
}
async function deliverAuthMail(job: any) {
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM || process.env.OT_EMAIL_DELIVERY_ENABLED !== '1') fail(503, 'EMAIL_DELIVERY_NOT_CONFIGURED');
  const data = parse(z.object({ to: z.email(), subject: z.string().max(180), text: z.string().max(20000) }), JSON.parse(job.payload_json));
  await sendMail(data, job.id);
}
async function sendMail(data: { to: string; subject: string; text: string }, jobId: string) {
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) fail(503, 'EMAIL_DELIVERY_NOT_CONFIGURED');
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({ url: process.env.SMTP_URL, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, disableFileAccess: true, disableUrlAccess: true });
  const timeout = setTimeout(() => transport.close(), 15000);
  try { await transport.sendMail({ from: process.env.MAIL_FROM, to: data.to, subject: data.subject, text: data.text, messageId: `<${jobId}@otcenter.local>` }); }
  finally { clearTimeout(timeout); transport.close(); }
}
async function deliverOperationalAlert(job: any): Promise<'delivered' | 'cancelled'> {
  if (process.env.OT_OPERATIONAL_ALERTS_ENABLED !== '1') fail(503, 'OPERATIONAL_ALERT_DELIVERY_DISABLED');
  const recipient = z.email().safeParse(process.env.OT_ALERT_EMAIL);
  if (!recipient.success) fail(503, 'OPERATIONAL_ALERT_RECIPIENT_NOT_CONFIGURED');
  const payload = parse(z.object({ cycle: z.number().int().positive() }).strict(), JSON.parse(job.payload_json));
  const incident = await queryOne('SELECT id,kind,severity,status,cycle FROM operational_incidents WHERE id=?', [job.aggregate_id]);
  if (!incident || incident.status === 'resolved' || incident.cycle !== payload.cycle) return 'cancelled';
  await sendMail({ to: recipient.data, subject: `OT Center: ${incident.severity} operational incident`,
    text: `Incident ${incident.id}\nType: ${incident.kind}\nSeverity: ${incident.severity}\nOpen the protected operations page and assign an owner. No learner or provider payload is included in this message.` }, job.id);
  return 'delivered';
}

/** Leased, short batches fit serverless invocations; no process-local queue or perpetual worker. */
export async function processOutbox(options: { limit?: number; budgetMs?: number; aggregateId?: string; allowExternal?: boolean } = {}) {
  const started = Date.now(); const maximum = Math.min(options.limit || 5, 20); const budget = Math.min(options.budgetMs || 20000, 40000);
  // Disabled channels stay queued without spending attempts or the daily batch.
  // Keep configured-but-broken channels eligible so genuine delivery errors remain visible.
  const pausedTypes = [
    ...(!options.allowExternal || process.env.OT_CRM_DELIVERY_ENABLED !== '1' ? ['crm.lead'] : []),
    ...(!options.allowExternal || process.env.OT_EMAIL_DELIVERY_ENABLED !== '1' ? ['auth.email'] : []),
    ...(!options.allowExternal || process.env.OT_OPERATIONAL_ALERTS_ENABLED !== '1' ? ['operations.alert'] : []),
  ];
  const results: { id: string; status: string; code?: string }[] = [];
  for (let index = 0; index < maximum && Date.now() - started < budget; index++) {
    const job: any = await withTransaction(async tx => {
      const extra = options.aggregateId ? ' AND aggregate_id=?' : '';
      const args: any[] = [nowIso(), nowIso()]; if (options.aggregateId) args.push(options.aggregateId);
      const enabled = pausedTypes.length ? ` AND type NOT IN (${pausedTypes.map(() => '?').join(',')})` : '';
      args.push(...pausedTypes);
      const row = await queryOne(`SELECT * FROM outbox WHERE status IN ('pending','processing') AND available_at<=? AND (lease_until IS NULL OR lease_until<?)${extra}${enabled} ORDER BY created_at LIMIT 1`, args, tx);
      if (!row) return undefined;
      const lease = id();
      const observation = jobObservation(row);
      await execute('UPDATE outbox SET status=?,lease_token=?,lease_until=?,attempts=attempts+1,updated_at=?,correlation_id=COALESCE(correlation_id,?) WHERE id=?', ['processing', lease, new Date(Date.now() + 120000).toISOString(), nowIso(), observation.correlationId, row.id], tx);
      return { ...row, lease_token: lease, attempts: row.attempts + 1, observation };
    });
    if (!job) break;
    const jobStarted = Date.now();
    await runWithObservation(job.observation, async () => {
    try {
      let completionStatus = 'delivered';
      if (job.type === 'crm.lead') { if (!options.allowExternal || process.env.OT_CRM_DELIVERY_ENABLED !== '1') fail(503, 'EXTERNAL_DELIVERY_DISABLED'); await deliverLead(job.aggregate_id, fetch, undefined, Math.max(1, budget - (Date.now() - started))); }
      else if (job.type === 'auth.email') { if (!options.allowExternal) fail(503, 'EXTERNAL_DELIVERY_DISABLED'); await deliverAuthMail(job); }
      else if (job.type === 'operations.alert') { if (!options.allowExternal) fail(503, 'EXTERNAL_DELIVERY_DISABLED'); completionStatus = await deliverOperationalAlert(job); }
      else if (job.type === 'credential.render') await renderCredential(job.aggregate_id);
      else if (job.type === 'learning.reminder') completionStatus = await deliverLearningReminder(job);
      else if (job.type.startsWith('notification.') || ['learning.enrolled', 'assessment.graded'].includes(job.type)) await notification(job);
      else fail(409, 'JOB_HANDLER_NOT_CONFIGURED');
      await execute('UPDATE outbox SET status=?,lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=?,payload_json=CASE WHEN type=? THEN ? ELSE payload_json END WHERE id=? AND lease_token=?', [completionStatus, nowIso(), 'auth.email', '{}', job.id, job.lease_token]);
      if (completionStatus === 'delivered') {
        // A telemetry outage must never turn a completed delivery into a retry.
        try { await incrementOperationalCounter('outbox_delivered'); }
        catch { logObservation({ event: 'telemetry_write_failed' }); }
      }
      logObservation({ event: completionStatus === 'cancelled' ? 'outbox_cancelled' : 'outbox_delivered', elapsedMs: Date.now() - jobStarted });
      results.push({ id: job.id, status: completionStatus });
    } catch (error: any) {
      const code = safeDeliveryCode(error);
      const status = job.attempts >= 8 ? 'failed' : 'pending';
      const delay = Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7));
      await execute('UPDATE outbox SET status=?,available_at=?,last_error=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?', [status, new Date(Date.now() + delay).toISOString(), code, nowIso(), job.id, job.lease_token]);
      try {
        await incrementOperationalCounter('outbox_failed');
        if (job.type === 'credential.render') await recordIncident({ kind: 'credential_pending', targetId: job.aggregate_id, severity: 'critical', code, attempts: job.attempts });
        else if (job.type !== 'operations.alert' && (status === 'failed' || job.type === 'crm.lead' && options.allowExternal && process.env.OT_CRM_DELIVERY_ENABLED === '1')) {
          await recordIncident({ kind: status === 'failed' ? 'outbox_failed' : 'outbox_stalled', targetId: job.id, severity: status === 'failed' ? 'critical' : 'warning', code, attempts: job.attempts });
        }
      } catch { logObservation({ event: 'telemetry_write_failed' }); }
      logObservation({ event: 'outbox_failed', code, elapsedMs: Date.now() - jobStarted });
      results.push({ id: job.id, status, code });
    }
    });
  }
  return { processed: results.length, elapsedMs: Date.now() - started, results };
}

export async function runOperationalTick(options: { allowExternal?: boolean } = {}) {
  const started = Date.now();
  const attempts = await expireDueAttempts(20, Date.now(), 3000);
  const reminders = await scheduleLearningReminders({ limit: 20, budgetMs: 3000 });
  const queue = await processOutbox({ limit: 10, budgetMs: Math.max(100, 30000 - (Date.now() - started)), allowExternal: options.allowExternal });
  const incidents = await scanOperationalIncidents({ limit: 20, budgetMs: Math.max(100, Math.min(5000, 40000 - (Date.now() - started))) });
  const analyticsRetention = await expireAnalytics().catch(() => { logObservation({ event: 'telemetry_write_failed' }); return { completed: false }; });
  // Stored expiry still applies after collection is disabled; business records remain untouched.
  const attributionRetention = await expireLeadAttribution().catch(() => { logObservation({ event: 'telemetry_write_failed' }); return { completed: false }; });
  return { ...queue, incidents, reminders, attempts, analyticsRetention, attributionRetention, elapsedMs: Date.now() - started };
}
export async function updateConsent(userId: string, data: unknown) {
  const body = parse(z.object({ marketing: z.boolean(), version: z.string().min(1).max(50) }).strict(), data);
  return withTransaction(async tx => {
    if (body.marketing) await execute('INSERT INTO consent_records(id,user_id,purpose,version,granted_at) VALUES(?,?,?,?,?)', [id(), userId, 'marketing', body.version, nowIso()], tx);
    else {
      await execute('UPDATE consent_records SET withdrawn_at=? WHERE user_id=? AND purpose=? AND withdrawn_at IS NULL', [nowIso(), userId, 'marketing'], tx);
      await execute('UPDATE notifications SET status=? WHERE user_id=? AND purpose=? AND status=?', ['cancelled', userId, 'marketing', 'queued'], tx);
    }
    await audit(userId, body.marketing ? 'marketing_consent_granted' : 'marketing_consent_withdrawn', userId, body.version, null, tx);
    return { marketing: body.marketing };
  });
}
export async function listNotifications(userId: string) {
  const rows = await queryAll<{ id: string; purpose: string; template: string; payload_json: string; status: string; createdAt: string }>('SELECT id,purpose,template,payload_json,CASE WHEN status=? THEN ? ELSE ? END AS status,created_at AS createdAt FROM notifications WHERE user_id=? AND status!=? ORDER BY created_at DESC LIMIT 100', ['read', 'read', 'unread', userId, 'cancelled']);
  const reminderPayload = z.object({ reminderId: z.string().max(100), enrollmentId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), kind: z.enum(['access_deadline', 'renewal']), dueAt: z.iso.datetime(), timezone: z.string().max(80) });
  return { notifications: rows.map(({ payload_json, ...row }) => {
    let payload = null;
    if (row.template === 'learning.reminder') {
      try { const checked = reminderPayload.safeParse(JSON.parse(payload_json)); if (checked.success) payload = checked.data; } catch { /* No private/unvalidated payload crosses the API. */ }
    }
    return { ...row, ...(payload ? { payload } : {}) };
  }) };
}
export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await execute('UPDATE notifications SET status=?,delivered_at=COALESCE(delivered_at,?) WHERE id=? AND user_id=? AND status!=?', ['read', nowIso(), notificationId, userId, 'cancelled']);
  if (!result.rowsAffected) fail(404, 'NOTIFICATION_NOT_FOUND');
  return { read: true };
}
export { recordClientAnalytics as recordAnalytics } from './analytics';
