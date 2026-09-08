import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, idempotent, nowIso, parse } from '../utils/business';
import type { AppUser } from '../utils/auth';
import { requireMembership } from './organizations';

const timeZone = z.string().min(1).max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; } }, 'Valid IANA time zone required');
const leadDays = z.array(z.number().int().min(0).max(365)).min(1).max(3).refine(days => new Set(days).size === days.length, 'Offsets must be unique');
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reason = z.string().trim().min(10).max(1000);
const createBody = z.object({ enrollmentId: z.string().min(1).max(100), kind: z.enum(['access_deadline','renewal']), timezone: timeZone, leadDays, dueDate: localDate.optional(), reason }).strict();
const updateBody = z.object({ revision: z.number().int().min(0), timezone: timeZone, leadDays, dueDate: localDate.optional(), reason }).strict();
const listQuery = z.object({ page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) }).strict();
type ReminderRow = { id: string; user_id: string; enrollment_id: string; organization_id: string | null; kind: 'access_deadline' | 'renewal'; due_at: string; timezone: string; lead_days_json: string; status: string; revision: number; created_by: string; reason: string; created_at: string; updated_at: string };
type DeliveryRow = { id: string; reminder_id: string; revision: number; offset_days: number; scheduled_at: string; expires_at: string; status: string; outbox_id: string | null };

export function calendarDate(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(400, 'INVALID_REMINDER_DATE');
  date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
/** Find the start of a local calendar date, including 23/25-hour days and midnight DST jumps. */
export function calendarDayStart(value: string, timezone: string) {
  shiftDate(value, 0);
  const center = Date.parse(`${value}T12:00:00.000Z`);
  let left = center - 36 * 3600000; let right = center + 36 * 3600000;
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    if (calendarDate(new Date(middle), timezone) < value) left = middle; else right = middle;
  }
  if (calendarDate(new Date(right), timezone) !== value) fail(400, 'NONEXISTENT_LOCAL_DATE');
  return new Date(right).toISOString();
}
function reminderDto(row: any) {
  return { id: row.id, enrollmentId: row.enrollment_id, organizationId: row.organization_id, userId: row.user_id, learnerName: row.learner_name, programTitle: row.program_title,
    kind: row.kind, dueAt: row.due_at, dueDate: calendarDate(new Date(row.due_at), row.timezone), timezone: row.timezone, leadDays: JSON.parse(row.lead_days_json),
    status: row.status, revision: row.revision, reason: row.reason, createdAt: row.created_at, updatedAt: row.updated_at,
    delivered: Number(row.delivered || 0), scheduled: Number(row.scheduled || 0), queued: Number(row.queued || 0), missed: Number(row.missed || 0), channel: 'in_app' };
}
async function authorizedEnrollment(actor: AppUser, enrollmentId: string, organizationId: string | undefined, tx: Db) {
  const enrollment = await queryOne('SELECT e.*,u.emailVerified FROM enrollments e JOIN "user" u ON u.id=e.user_id WHERE e.id=?', [enrollmentId], tx);
  if (!enrollment || !enrollment.emailVerified) fail(404, 'REMINDER_ENROLLMENT_NOT_FOUND');
  if (organizationId !== undefined) {
    await requireMembership(actor.id, organizationId, ['owner','manager'], tx);
    if (enrollment.organization_id !== organizationId) fail(404, 'REMINDER_ENROLLMENT_NOT_FOUND');
  } else if (enrollment.user_id !== actor.id) fail(404, 'REMINDER_ENROLLMENT_NOT_FOUND');
  if (enrollment.organization_id) await requireMembership(enrollment.user_id, enrollment.organization_id, ['owner','manager','member'], tx);
  return enrollment;
}
async function authorizedReminder(actor: AppUser, reminderId: string, tx: Db) {
  const row = await queryOne<ReminderRow>('SELECT * FROM learning_reminders WHERE id=?', [reminderId], tx);
  if (!row) fail(404, 'REMINDER_NOT_FOUND');
  if (row.user_id !== actor.id) {
    if (!row.organization_id) fail(404, 'REMINDER_NOT_FOUND');
    await requireMembership(actor.id, row.organization_id, ['owner','manager'], tx);
  }
  return row;
}
async function preference(userId: string, kind: string, tx: Db) {
  const row = await queryOne('SELECT access_deadline,renewal FROM learning_reminder_preferences WHERE user_id=?', [userId], tx);
  return !row || Number(row[kind]) === 1;
}
function dueAt(kind: string, body: { timezone: string; dueDate?: string }, enrollment: any, now: Date) {
  if (kind === 'access_deadline') {
    if (body.dueDate !== undefined) fail(400, 'ACCESS_DEADLINE_FROM_ENROLLMENT');
    if (!enrollment.access_until || enrollment.access_until <= now.toISOString() || ['completed','expired','cancelled','suspended'].includes(enrollment.status)) fail(409, 'FUTURE_ACCESS_DEADLINE_REQUIRED');
    return new Date(enrollment.access_until).toISOString();
  }
  if (!body.dueDate || body.dueDate <= calendarDate(now, body.timezone)) fail(400, 'FUTURE_RENEWAL_DATE_REQUIRED');
  // An explicitly planned training date, never inferred credential validity or a statutory period.
  calendarDayStart(body.dueDate, body.timezone);
  const result = new Date(Date.parse(calendarDayStart(shiftDate(body.dueDate, 1), body.timezone)) - 1).toISOString();
  if (Date.parse(result) - now.getTime() > 10 * 366 * 86400000) fail(400, 'REMINDER_DATE_TOO_DISTANT');
  return result;
}
async function createSlots(row: ReminderRow, offsets: number[], now: Date, tx: Db) {
  const dueDate = calendarDate(new Date(row.due_at), row.timezone);
  for (const days of offsets) {
    const day = shiftDate(dueDate, -days);
    const scheduled = calendarDayStart(day, row.timezone);
    const dayEnd = calendarDayStart(shiftDate(day, 1), row.timezone);
    const expires = row.kind === 'access_deadline' && row.due_at < dayEnd ? row.due_at : dayEnd;
    await execute('INSERT INTO learning_reminder_deliveries(id,reminder_id,revision,offset_days,scheduled_at,expires_at,status,created_at) VALUES(?,?,?,?,?,?,?,?)', [id(), row.id, row.revision, days, scheduled, expires, expires <= now.toISOString() ? 'missed' : 'scheduled', now.toISOString()], tx);
  }
}
async function cancelSlots(row: ReminderRow, tx: Db) {
  // Clearing leases makes a worker's stale completion CAS harmless; unread notices from the
  // old revision disappear, while previously read history remains available.
  await execute("UPDATE outbox SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=? WHERE type='learning.reminder' AND aggregate_id IN (SELECT id FROM learning_reminder_deliveries WHERE reminder_id=? AND revision=?) AND status!='delivered'", [nowIso(), row.id, row.revision], tx);
  await execute("UPDATE notifications SET status='cancelled' WHERE id IN (SELECT notification_id FROM learning_reminder_deliveries WHERE reminder_id=? AND revision=?) AND status!='read'", [row.id, row.revision], tx);
  await execute("UPDATE learning_reminder_deliveries SET status='cancelled' WHERE reminder_id=? AND revision=? AND status IN ('scheduled','queued')", [row.id, row.revision], tx);
}
async function finishRule(row: ReminderRow, tx: Db) {
  await execute("UPDATE learning_reminders SET status='completed',updated_at=? WHERE id=? AND revision=? AND status='active' AND NOT EXISTS(SELECT 1 FROM learning_reminder_deliveries WHERE reminder_id=? AND revision=? AND status IN ('scheduled','queued'))", [nowIso(), row.id, row.revision, row.id, row.revision], tx);
}
export async function createLearningReminder(actor: AppUser, organizationId: string | undefined, input: unknown, key: string, now = new Date()) {
  const body = parse(createBody, input);
  return idempotent(`reminder:${actor.id}:${organizationId || 'personal'}`, key, body, async tx => {
    const enrollment = await authorizedEnrollment(actor, body.enrollmentId, organizationId, tx);
    if (!await preference(enrollment.user_id, body.kind, tx)) fail(409, 'REMINDER_PREFERENCE_DISABLED');
    if (await queryOne("SELECT id FROM learning_reminders WHERE enrollment_id=? AND kind=? AND status='active'", [body.enrollmentId, body.kind], tx)) fail(409, 'ACTIVE_REMINDER_EXISTS');
    if (Number((await queryOne("SELECT COUNT(*) n FROM learning_reminders WHERE user_id=? AND status='active'", [enrollment.user_id], tx))!.n) >= 100) fail(409, 'REMINDER_LIMIT_REACHED');
    const row: ReminderRow = { id: id(), user_id: enrollment.user_id, enrollment_id: enrollment.id, organization_id: enrollment.organization_id, kind: body.kind, due_at: dueAt(body.kind, body, enrollment, now), timezone: body.timezone, lead_days_json: JSON.stringify([...body.leadDays].sort((a,b) => b-a)), status: 'active', revision: 0, created_by: actor.id, reason: body.reason, created_at: now.toISOString(), updated_at: now.toISOString() };
    await execute('INSERT INTO learning_reminders(id,user_id,enrollment_id,organization_id,kind,due_at,timezone,lead_days_json,status,revision,created_by,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [row.id,row.user_id,row.enrollment_id,row.organization_id,row.kind,row.due_at,row.timezone,row.lead_days_json,row.status,row.revision,row.created_by,row.reason,row.created_at,row.updated_at], tx);
    await createSlots(row, body.leadDays, now, tx); await finishRule(row, tx);
    await audit(actor.id, 'learning_reminder_created', row.id, body.reason, row.organization_id, tx);
    return { resourceId: row.id, value: { reminder: reminderDto((await queryOne('SELECT * FROM learning_reminders WHERE id=?', [row.id], tx))!) } };
  }, async (reminderId, tx) => { const row = await authorizedReminder(actor, reminderId, tx); await authorizedEnrollment(actor, row.enrollment_id, organizationId, tx); return { reminder: reminderDto(row) }; });
}
export async function updateLearningReminder(actor: AppUser, reminderId: string, input: unknown, now = new Date()) {
  const body = parse(updateBody, input);
  return withTransaction(async tx => {
    const row = await authorizedReminder(actor, reminderId, tx);
    if (row.revision !== body.revision) fail(409, 'REMINDER_REVISION_CONFLICT');
    const enrollment = await authorizedEnrollment(actor, row.enrollment_id, row.user_id === actor.id ? undefined : row.organization_id || undefined, tx);
    if (!await preference(row.user_id, row.kind, tx)) fail(409, 'REMINDER_PREFERENCE_DISABLED');
    if (row.status !== 'active' && Number((await queryOne("SELECT COUNT(*) n FROM learning_reminders WHERE user_id=? AND status='active'", [row.user_id], tx))!.n) >= 100) fail(409, 'REMINDER_LIMIT_REACHED');
    if (await queryOne("SELECT id FROM learning_reminders WHERE enrollment_id=? AND kind=? AND status='active' AND id!=?", [row.enrollment_id, row.kind, row.id], tx)) fail(409, 'ACTIVE_REMINDER_EXISTS');
    const updated = { ...row, due_at: dueAt(row.kind, body, enrollment, now), timezone: body.timezone, lead_days_json: JSON.stringify([...body.leadDays].sort((a,b) => b-a)), revision: row.revision + 1, status: 'active', reason: body.reason, updated_at: now.toISOString() };
    await cancelSlots(row, tx);
    await execute('UPDATE learning_reminders SET due_at=?,timezone=?,lead_days_json=?,revision=?,status=?,reason=?,updated_at=? WHERE id=? AND revision=?', [updated.due_at,updated.timezone,updated.lead_days_json,updated.revision,updated.status,updated.reason,updated.updated_at,row.id,row.revision], tx);
    await createSlots(updated, body.leadDays, now, tx); await finishRule(updated, tx);
    await audit(actor.id, 'learning_reminder_rescheduled', row.id, body.reason, row.organization_id, tx);
    return { reminder: reminderDto((await queryOne('SELECT * FROM learning_reminders WHERE id=?', [row.id], tx))!) };
  });
}
export async function cancelLearningReminder(actor: AppUser, reminderId: string, input: unknown) {
  const body = parse(z.object({ revision: z.number().int().min(0), reason }).strict(), input);
  return withTransaction(async tx => {
    const row = await authorizedReminder(actor, reminderId, tx);
    if (row.revision !== body.revision) fail(409, 'REMINDER_REVISION_CONFLICT');
    if (row.status === 'cancelled') return { cancelled: true, revision: row.revision };
    await cancelSlots(row, tx);
    await execute("UPDATE learning_reminders SET status='cancelled',revision=revision+1,reason=?,updated_at=? WHERE id=?", [body.reason, nowIso(), row.id], tx);
    await audit(actor.id, 'learning_reminder_cancelled', row.id, body.reason, row.organization_id, tx);
    return { cancelled: true, revision: row.revision + 1 };
  });
}
export async function listLearningReminders(actor: AppUser, organizationId: string | undefined, input: unknown = {}) {
  const options = parse(listQuery, input);
  return withTransaction(async tx => {
    if (organizationId) await requireMembership(actor.id, organizationId, ['owner','manager'], tx);
    const condition = organizationId ? 'r.organization_id=?' : 'r.user_id=?'; const owner = organizationId || actor.id;
    const total = Number((await queryOne(`SELECT COUNT(*) n FROM learning_reminders r WHERE ${condition}`, [owner], tx))!.n);
    const totalPages = Math.max(1, Math.ceil(total / options.pageSize)); const page = Math.min(options.page, totalPages);
    const rows = await queryAll(`SELECT r.*,u.name AS learner_name,json_extract(v.data_json,'$.title') AS program_title,
      (SELECT COUNT(*) FROM learning_reminder_deliveries d WHERE d.reminder_id=r.id AND d.revision=r.revision AND d.status='delivered') AS delivered,
      (SELECT COUNT(*) FROM learning_reminder_deliveries d WHERE d.reminder_id=r.id AND d.revision=r.revision AND d.status='scheduled') AS scheduled,
      (SELECT COUNT(*) FROM learning_reminder_deliveries d WHERE d.reminder_id=r.id AND d.revision=r.revision AND d.status='queued') AS queued,
      (SELECT COUNT(*) FROM learning_reminder_deliveries d WHERE d.reminder_id=r.id AND d.revision=r.revision AND d.status='missed') AS missed
      FROM learning_reminders r JOIN "user" u ON u.id=r.user_id JOIN enrollments e ON e.id=r.enrollment_id JOIN program_versions v ON v.id=e.version_id WHERE ${condition} ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?`, [owner,options.pageSize,(page-1)*options.pageSize], tx);
    return { reminders: rows.map(reminderDto), pagination: { page, pageSize: options.pageSize, total, totalPages, hasPrevious: page>1, hasMore: page<totalPages }, channel: 'in_app', timing: 'next_scheduler_run_within_selected_local_calendar_day' };
  }, undefined, 'read');
}
export async function getReminderPreferences(actor: AppUser) {
  const row = await queryOne('SELECT * FROM learning_reminder_preferences WHERE user_id=?', [actor.id]);
  return { accessDeadline: !row || Number(row.access_deadline) === 1, renewal: !row || Number(row.renewal) === 1, channel: 'in_app' };
}
export async function reminderEnrollmentChoices(actor: AppUser, input: unknown = {}) {
  const options = parse(listQuery, input);
  return withTransaction(async tx => {
    const total = Number((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE user_id=?', [actor.id], tx))!.n);
    const totalPages = Math.max(1, Math.ceil(total / options.pageSize)); const page = Math.min(options.page, totalPages);
    const enrollments = await queryAll(`SELECT e.id,e.status,e.access_until AS accessUntil,json_extract(v.data_json,'$.title') AS title FROM enrollments e JOIN program_versions v ON v.id=e.version_id WHERE e.user_id=? ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?`, [actor.id,options.pageSize,(page-1)*options.pageSize], tx);
    return { enrollments, pagination: { page, total, totalPages, hasPrevious: page>1, hasMore: page<totalPages } };
  }, undefined, 'read');
}
export async function updateReminderPreferences(actor: AppUser, input: unknown) {
  const body = parse(z.object({ accessDeadline: z.boolean(), renewal: z.boolean() }).strict(), input);
  return withTransaction(async tx => {
    await execute('INSERT INTO learning_reminder_preferences(user_id,access_deadline,renewal,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET access_deadline=excluded.access_deadline,renewal=excluded.renewal,updated_at=excluded.updated_at', [actor.id, Number(body.accessDeadline),Number(body.renewal),nowIso()], tx);
    const disabled = [!body.accessDeadline && 'access_deadline', !body.renewal && 'renewal'].filter(Boolean) as string[];
    for (const kind of disabled) {
      await execute("UPDATE notifications SET status='cancelled' WHERE user_id=? AND template='learning.reminder' AND status!='read' AND id IN (SELECT d.notification_id FROM learning_reminder_deliveries d JOIN learning_reminders r ON r.id=d.reminder_id WHERE r.user_id=? AND r.kind=?)", [actor.id,actor.id,kind], tx);
      const rows = await queryAll<ReminderRow>("SELECT * FROM learning_reminders WHERE user_id=? AND kind=? AND status='active'", [actor.id,kind], tx);
      for (const row of rows) { await cancelSlots(row, tx); await execute("UPDATE learning_reminders SET status='cancelled',revision=revision+1,updated_at=? WHERE id=?", [nowIso(),row.id], tx); }
    }
    await audit(actor.id, 'learning_reminder_preferences_updated', actor.id, JSON.stringify(body), null, tx);
    return { ...body, channel: 'in_app' };
  });
}
async function stillEligible(row: ReminderRow, now: Date, tx: Db) {
  const source = await queryOne(`SELECT e.status,e.access_until,u.emailVerified,o.status AS organization_status,m.status AS membership_status FROM enrollments e JOIN "user" u ON u.id=e.user_id LEFT JOIN organizations o ON o.id=e.organization_id LEFT JOIN memberships m ON m.organization_id=e.organization_id AND m.user_id=e.user_id WHERE e.id=? AND e.user_id=?`, [row.enrollment_id,row.user_id], tx);
  if (!source || !source.emailVerified || row.organization_id && (source.organization_status !== 'active' || source.membership_status !== 'active')) return false;
  if (!await preference(row.user_id, row.kind, tx)) return false;
  return row.kind !== 'access_deadline' || source.access_until === row.due_at && source.access_until > now.toISOString() && !['completed','cancelled','suspended','expired'].includes(source.status);
}
/** Bounded durable scheduling, independent of open browser tabs. It sends no external messages. */
export async function scheduleLearningReminders(options: { limit?: number; now?: Date; budgetMs?: number } = {}) {
  const maximum = Math.max(1, Math.min(50, Math.trunc(options.limit || 50))); const now = options.now || new Date();
  const started = Date.now(); const budget = Math.max(100, Math.min(5000, options.budgetMs || 5000));
  return withTransaction(async tx => {
    const slots = await queryAll<DeliveryRow>("SELECT * FROM learning_reminder_deliveries WHERE status='scheduled' AND scheduled_at<=? ORDER BY scheduled_at,id LIMIT ?", [now.toISOString(),maximum], tx);
    let enqueued = 0; let skipped = 0;
    for (const slot of slots) {
      if (Date.now() - started >= budget) break;
      const row = await queryOne<ReminderRow>('SELECT * FROM learning_reminders WHERE id=?', [slot.reminder_id], tx);
      const eligible = row && row.status === 'active' && row.revision === slot.revision ? await stillEligible(row, now, tx) : false;
      if (!row || row.status !== 'active' || row.revision !== slot.revision || slot.expires_at <= now.toISOString() || !eligible) {
        await execute("UPDATE learning_reminder_deliveries SET status=? WHERE id=? AND status='scheduled'", [slot.expires_at <= now.toISOString() ? 'missed' : 'cancelled',slot.id], tx);
        if (row?.status === 'active' && row.revision === slot.revision && !eligible) {
          await cancelSlots(row, tx);
          await execute("UPDATE learning_reminders SET status='cancelled',revision=revision+1,updated_at=? WHERE id=?", [now.toISOString(),row.id], tx);
          await audit(null, 'learning_reminder_source_unavailable', row.id, 'Current access, membership, verified account or notification preference no longer permits delivery', row.organization_id, tx);
        }
        if (row) await finishRule(row, tx); skipped++; continue;
      }
      const jobId = await enqueue('learning.reminder', slot.id, { reminderId: row.id, revision: row.revision }, tx);
      await execute("UPDATE learning_reminder_deliveries SET status='queued',outbox_id=? WHERE id=? AND status='scheduled'", [jobId,slot.id], tx); enqueued++;
    }
    return { selected: slots.length, processed: enqueued + skipped, enqueued, skipped, limit: maximum, elapsedMs: Date.now() - started };
  });
}
/** Root outbox dispatcher calls this before acknowledging the job. Old revision/ACL jobs are harmless. */
export async function deliverLearningReminder(job: { aggregate_id: string; payload_json: string }, now = new Date()): Promise<'delivered' | 'cancelled'> {
  const payload = parse(z.object({ reminderId: z.string(), revision: z.number().int() }).strict(), JSON.parse(job.payload_json));
  return withTransaction(async tx => {
    const slot = await queryOne<DeliveryRow>('SELECT * FROM learning_reminder_deliveries WHERE id=? AND reminder_id=? AND revision=?', [job.aggregate_id,payload.reminderId,payload.revision], tx);
    if (slot?.status === 'delivered') return 'delivered';
    const row = await queryOne<ReminderRow>('SELECT * FROM learning_reminders WHERE id=?', [payload.reminderId], tx);
    if (!slot || slot.status !== 'queued' || !row || row.status !== 'active' || row.revision !== slot.revision || slot.scheduled_at > now.toISOString() || slot.expires_at <= now.toISOString() || !await stillEligible(row, now, tx)) {
      if (slot && slot.status === 'queued') await execute("UPDATE learning_reminder_deliveries SET status='cancelled' WHERE id=?", [slot.id], tx);
      if (row) await finishRule(row, tx); return 'cancelled';
    }
    const noticeId = id();
    await execute('INSERT INTO notifications(id,user_id,purpose,template,payload_json,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?)', [noticeId,row.user_id,row.kind === 'renewal' ? 'optional_service' : 'service','learning.reminder',JSON.stringify({ reminderId: row.id,enrollmentId: row.enrollment_id,kind: row.kind,dueAt: row.due_at,timezone: row.timezone }),`learning.reminder:${slot.id}`,now.toISOString()], tx);
    await execute("UPDATE learning_reminder_deliveries SET status='delivered',notification_id=?,delivered_at=? WHERE id=?", [noticeId,now.toISOString(),slot.id], tx);
    await audit(null, 'learning_reminder_delivered', row.id, `revision=${row.revision};offset_days=${slot.offset_days};channel=in_app`, row.organization_id, tx);
    await finishRule(row, tx); return 'delivered';
  });
}
