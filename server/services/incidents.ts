import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, nowIso, parse } from '../utils/business';
import { assertRole, type AppUser } from '../utils/auth';

const kinds = ['outbox_failed', 'outbox_stalled', 'lead_undelivered', 'credential_pending', 'payment_pending', 'webhook_rejected'] as const;
type IncidentKind = typeof kinds[number];
type OwnerRole = 'admin' | 'finance' | 'issuer';
type Observation = { kind: IncidentKind; targetId: string; severity: 'warning' | 'critical'; code: string; ageMinutes?: number; attempts?: number };
const scopes: Record<IncidentKind, { targetType: string; role: OwnerRole }> = {
  outbox_failed: { targetType: 'outbox', role: 'admin' }, outbox_stalled: { targetType: 'outbox', role: 'admin' },
  lead_undelivered: { targetType: 'lead', role: 'admin' }, credential_pending: { targetType: 'credential', role: 'issuer' },
  payment_pending: { targetType: 'order', role: 'finance' }, webhook_rejected: { targetType: 'integration', role: 'finance' },
};
const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : 'UNCLASSIFIED';
const iso = (value: Date) => { if (!Number.isFinite(value.valueOf())) fail(400, 'INVALID_OPERATION_TIME'); return value.toISOString(); };
const age = (created: string, now: string) => Math.max(0, Math.floor((Date.parse(now) - Date.parse(created)) / 60000));
function threshold(name: string, fallback: number) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1 || value > 525600) fail(503, 'ALERT_THRESHOLD_INVALID');
  return value;
}
export function incidentThresholds() {
  return {
    outboxMinutes: threshold('OT_ALERT_OUTBOX_MINUTES', 60), leadMinutes: threshold('OT_ALERT_LEAD_MINUTES', 120),
    credentialMinutes: threshold('OT_ALERT_CREDENTIAL_MINUTES', 60), paymentMinutes: threshold('OT_ALERT_PAYMENT_MINUTES', 1440),
  };
}
const counterNames = ['webhook_invalid_signature', 'webhook_expired', 'webhook_mismatch', 'webhook_conflict', 'webhook_duplicate', 'outbox_delivered', 'outbox_failed'] as const;
export async function incrementOperationalCounter(metric: typeof counterNames[number], db?: Db, at = nowIso()) {
  if (!counterNames.includes(metric)) fail(400, 'UNKNOWN_OPERATIONAL_METRIC');
  await execute('INSERT INTO operational_counters(day,metric,count) VALUES(?,?,1) ON CONFLICT(day,metric) DO UPDATE SET count=count+1', [at.slice(0, 10), metric], db);
}

/** Only bounded codes, counts and opaque entity IDs are persisted; never request/provider payloads. */
export async function recordIncident(observation: Observation, at = new Date()) {
  const now = iso(at);
  if (!kinds.includes(observation.kind) || !/^[a-zA-Z0-9_-]{1,120}$/.test(observation.targetId)) fail(400, 'INVALID_INCIDENT_TARGET');
  const scope = scopes[observation.kind];
  const details = { code: safeCode(observation.code), ...(Number.isFinite(observation.ageMinutes) ? { ageMinutes: Math.max(0, Math.floor(observation.ageMinutes!)) } : {}), ...(Number.isSafeInteger(observation.attempts) ? { attempts: Math.max(0, observation.attempts!) } : {}) };
  return withTransaction(async tx => {
    const fingerprint = `${observation.kind}:${observation.targetId}`;
    const existing = await queryOne('SELECT * FROM operational_incidents WHERE fingerprint=?', [fingerprint], tx);
    const reopened = existing?.status === 'resolved';
    const incidentId = existing?.id || id(); const cycle = existing ? existing.cycle + (reopened ? 1 : 0) : 1;
    if (!existing) {
      await execute(`INSERT INTO operational_incidents(id,fingerprint,kind,severity,target_type,target_id,owner_role,details_json,first_seen_at,last_seen_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`, [incidentId, fingerprint, observation.kind, observation.severity, scope.targetType, observation.targetId, scope.role, JSON.stringify(details), now, now], tx);
    } else {
      const severity = !reopened && existing.severity === 'critical' ? 'critical' : observation.severity;
      await execute(`UPDATE operational_incidents SET severity=?,details_json=?,last_seen_at=?,observations=observations+1,cycle=?,status=?,
        acknowledged_by=CASE WHEN ? THEN NULL ELSE acknowledged_by END,acknowledged_at=CASE WHEN ? THEN NULL ELSE acknowledged_at END,resolved_at=NULL WHERE id=?`,
      [severity, JSON.stringify(details), now, cycle, reopened ? 'open' : existing.status, reopened ? 1 : 0, reopened ? 1 : 0, incidentId], tx);
    }
    if (!existing || reopened) {
      await audit(null, reopened ? 'incident_reopened' : 'incident_opened', incidentId, details.code, null, tx);
      // A bounded internal operator inbox. External alerts require their own explicit configuration.
      const recipients = await queryAll('SELECT id FROM "user" WHERE role IN (?,?) ORDER BY id LIMIT 20', ['admin', scope.role], tx);
      for (const recipient of recipients) await execute(`INSERT OR IGNORE INTO notifications(id,user_id,purpose,template,payload_json,dedupe_key,created_at)
        VALUES(?,?,?,?,?,?,?)`, [id(), recipient.id, 'service', 'operations.incident', JSON.stringify({ incidentId, cycle }), `incident:${incidentId}:${cycle}:${recipient.id}`, now], tx);
      if (process.env.OT_OPERATIONAL_ALERTS_ENABLED === '1') await enqueue('operations.alert', incidentId, { cycle }, tx);
    }
    return { id: incidentId, cycle, opened: !existing || reopened };
  });
}

export async function recordWebhookRejection(code: string) {
  const metrics: Record<string, typeof counterNames[number]> = { INVALID_SIGNATURE: 'webhook_invalid_signature', WEBHOOK_EXPIRED: 'webhook_expired', PAYMENT_MISMATCH: 'webhook_mismatch', EVENT_CONFLICT: 'webhook_conflict' };
  const metric = metrics[code]; if (!metric) return;
  await incrementOperationalCounter(metric);
  await recordIncident({ kind: 'webhook_rejected', targetId: `sandbox-${code.toLowerCase()}`, severity: code === 'PAYMENT_MISMATCH' ? 'critical' : 'warning', code });
}
function incidentDto(row: any) {
  return { id: row.id, kind: row.kind, severity: row.severity, targetType: row.target_type, targetId: row.target_id, ownerRole: row.owner_role,
    status: row.status, cycle: row.cycle, observations: row.observations, details: JSON.parse(row.details_json), firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at, acknowledgedBy: row.acknowledged_by, acknowledgedAt: row.acknowledged_at, resolvedAt: row.resolved_at };
}
function assertIncidentScope(actor: AppUser, row: any) {
  assertRole(actor, ['finance', 'issuer']);
  if (actor.role !== 'admin' && actor.role !== row.owner_role) fail(404, 'INCIDENT_NOT_FOUND');
}
export async function listIncidents(actor: AppUser, input: unknown = {}) {
  assertRole(actor, ['finance', 'issuer']);
  const query = parse(z.object({ status: z.enum(['active', 'resolved', 'all']).default('active'), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }).strict(), input);
  const roleWhere = actor.role === 'admin' ? '1=1' : 'owner_role=?'; const roleArgs = actor.role === 'admin' ? [] : [actor.role];
  const statusWhere = query.status === 'active' ? "status!='resolved'" : query.status === 'resolved' ? "status='resolved'" : '1=1';
  const [rows, count, counters] = await Promise.all([
    queryAll(`SELECT * FROM operational_incidents WHERE ${roleWhere} AND ${statusWhere} ORDER BY last_seen_at DESC,id LIMIT ? OFFSET ?`, [...roleArgs, query.pageSize, (query.page - 1) * query.pageSize]),
    queryOne(`SELECT COUNT(*) AS total FROM operational_incidents WHERE ${roleWhere} AND ${statusWhere}`, roleArgs),
    actor.role === 'admin' ? queryAll('SELECT day,metric,count FROM operational_counters WHERE day>=? ORDER BY day DESC,metric', [new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)]) : [],
  ]);
  return { incidents: rows.map(incidentDto), pagination: { page: query.page, pageSize: query.pageSize, total: Number(count?.total || 0), hasMore: query.page * query.pageSize < Number(count?.total || 0) }, counters,
    thresholds: actor.role === 'admin' ? incidentThresholds() : null, externalAlerts: { enabled: process.env.OT_OPERATIONAL_ALERTS_ENABLED === '1', configured: Boolean(process.env.SMTP_URL && process.env.MAIL_FROM && process.env.OT_ALERT_EMAIL) } };
}
async function sourceStillActive(row: any, db: Db, now: string) {
  if (row.kind === 'outbox_failed') return Boolean(await queryOne("SELECT id FROM outbox WHERE id=? AND status='failed'", [row.target_id], db));
  if (row.kind === 'outbox_stalled') return Boolean(await queryOne("SELECT id FROM outbox WHERE id=? AND status IN ('pending','processing')", [row.target_id], db));
  if (row.kind === 'lead_undelivered') return Boolean(await queryOne("SELECT id FROM lead_submissions WHERE id=? AND status!='delivered'", [row.target_id], db));
  if (row.kind === 'credential_pending') return Boolean(await queryOne("SELECT id FROM credentials WHERE id=? AND status='pending'", [row.target_id], db));
  if (row.kind === 'payment_pending') return Boolean(await queryOne("SELECT id FROM orders WHERE id=? AND status='pending'", [row.target_id], db));
  if (row.kind === 'webhook_rejected') return Date.parse(now) - Date.parse(row.last_seen_at) < 5 * 60000;
  return true;
}
export async function transitionIncident(actor: AppUser, incidentId: string, input: unknown) {
  assertRole(actor, ['finance', 'issuer']);
  const body = parse(z.object({ action: z.enum(['acknowledge', 'resolve']), reason: z.string().trim().min(10).max(2000) }).strict(), input);
  return withTransaction(async tx => {
    const row = await queryOne('SELECT * FROM operational_incidents WHERE id=?', [incidentId], tx);
    if (!row) fail(404, 'INCIDENT_NOT_FOUND'); assertIncidentScope(actor, row);
    if (body.action === 'acknowledge') {
      if (row.status === 'resolved') fail(409, 'INCIDENT_ALREADY_RESOLVED');
      if (row.status === 'acknowledged' && row.acknowledged_by === actor.id) return { incident: incidentDto(row), duplicate: true };
      await execute("UPDATE operational_incidents SET status='acknowledged',acknowledged_by=?,acknowledged_at=? WHERE id=?", [actor.id, nowIso(), incidentId], tx);
    } else {
      if (row.status === 'resolved') return { incident: incidentDto(row), duplicate: true };
      if (await sourceStillActive(row, tx, nowIso())) fail(409, 'INCIDENT_SOURCE_NOT_RECOVERED');
      await execute("UPDATE operational_incidents SET status='resolved',resolved_at=? WHERE id=?", [nowIso(), incidentId], tx);
    }
    await audit(actor.id, `incident_${body.action}`, incidentId, body.reason, null, tx);
    return { incident: incidentDto(await queryOne('SELECT * FROM operational_incidents WHERE id=?', [incidentId], tx)), duplicate: false };
  });
}

/** Bounded database scans run on the existing daily cron/manual tick; there is no permanent monitor. */
export async function scanOperationalIncidents(options: { limit?: number; now?: Date; budgetMs?: number } = {}) {
  const started = Date.now(); const now = iso(options.now || new Date()); const limits = incidentThresholds();
  const maximum = Math.max(1, Math.min(100, Math.floor(options.limit || 20))); const budget = Math.max(100, Math.min(10000, options.budgetMs || 5000));
  const cutoff = (minutes: number) => new Date(Date.parse(now) - minutes * 60000).toISOString();
  const groups = await Promise.all([
    queryAll(`SELECT o.id,o.status,o.attempts,o.last_error,o.created_at FROM outbox o WHERE o.type NOT IN ('credential.render','operations.alert') AND
      (o.status='failed' OR (o.status IN ('pending','processing') AND o.created_at<=? AND (o.lease_until IS NULL OR o.lease_until<?)))
      ORDER BY COALESCE((SELECT i.last_seen_at FROM operational_incidents i WHERE i.fingerprint=(CASE WHEN o.status='failed' THEN 'outbox_failed:' ELSE 'outbox_stalled:' END)||o.id AND i.status!='resolved'),''),o.created_at,o.id LIMIT ?`, [cutoff(limits.outboxMinutes), now, maximum]),
    queryAll(`SELECT l.id,l.created_at FROM lead_submissions l WHERE l.status!='delivered' AND l.created_at<=?
      ORDER BY COALESCE((SELECT i.last_seen_at FROM operational_incidents i WHERE i.fingerprint='lead_undelivered:'||l.id AND i.status!='resolved'),''),l.created_at,l.id LIMIT ?`, [cutoff(limits.leadMinutes), maximum]),
    queryAll(`SELECT c.id,c.created_at,EXISTS(SELECT 1 FROM outbox o WHERE o.type='credential.render' AND o.aggregate_id=c.id AND o.status='failed') AS render_failed
      FROM credentials c WHERE c.status='pending' AND (c.created_at<=? OR EXISTS(SELECT 1 FROM outbox o WHERE o.type='credential.render' AND o.aggregate_id=c.id AND o.status='failed'))
      ORDER BY COALESCE((SELECT i.last_seen_at FROM operational_incidents i WHERE i.fingerprint='credential_pending:'||c.id AND i.status!='resolved'),''),c.created_at,c.id LIMIT ?`, [cutoff(limits.credentialMinutes), maximum]),
    queryAll(`SELECT o.id,o.created_at FROM orders o WHERE o.status='pending' AND o.created_at<=?
      ORDER BY COALESCE((SELECT i.last_seen_at FROM operational_incidents i WHERE i.fingerprint='payment_pending:'||o.id AND i.status!='resolved'),''),o.created_at,o.id LIMIT ?`, [cutoff(limits.paymentMinutes), maximum]),
  ]);
  const observations: Observation[][] = [
    groups[0]!.map(row => ({ kind: row.status === 'failed' ? 'outbox_failed' : 'outbox_stalled', targetId: row.id, severity: row.status === 'failed' ? 'critical' : 'warning', code: safeCode(row.last_error) === 'UNCLASSIFIED' ? 'QUEUE_PENDING_TOO_LONG' : safeCode(row.last_error), ageMinutes: age(row.created_at, now), attempts: row.attempts })),
    groups[1]!.map(row => ({ kind: 'lead_undelivered', targetId: row.id, severity: 'critical', code: 'CRM_DELIVERY_OVERDUE', ageMinutes: age(row.created_at, now) })),
    groups[2]!.map(row => ({ kind: 'credential_pending', targetId: row.id, severity: row.render_failed ? 'critical' : 'warning', code: row.render_failed ? 'CREDENTIAL_RENDER_FAILED' : 'CREDENTIAL_PENDING_TOO_LONG', ageMinutes: age(row.created_at, now) })),
    groups[3]!.map(row => ({ kind: 'payment_pending', targetId: row.id, severity: 'warning', code: 'PAYMENT_RECONCILIATION_REQUIRED', ageMinutes: age(row.created_at, now) })),
  ];
  let observed = 0; let opened = 0;
  // Round-robin prevents a long lead queue from starving document/payment observations.
  for (let index = 0; index < maximum && Date.now() - started < budget; index++) for (const group of observations) {
    if (!group[index] || observed >= maximum || Date.now() - started >= budget) continue;
    const result = await recordIncident(group[index]!, new Date(now)); observed++; if (result.opened) opened++;
  }
  // Filter recovered sources before LIMIT: a large active queue must not starve reconciliation.
  const unresolved = await queryAll(`SELECT i.* FROM operational_incidents i WHERE i.status!='resolved' AND (
    (i.kind='outbox_failed' AND NOT EXISTS(SELECT 1 FROM outbox o WHERE o.id=i.target_id AND o.status='failed')) OR
    (i.kind='outbox_stalled' AND NOT EXISTS(SELECT 1 FROM outbox o WHERE o.id=i.target_id AND o.status IN ('pending','processing'))) OR
    (i.kind='lead_undelivered' AND NOT EXISTS(SELECT 1 FROM lead_submissions l WHERE l.id=i.target_id AND l.status!='delivered')) OR
    (i.kind='credential_pending' AND NOT EXISTS(SELECT 1 FROM credentials c WHERE c.id=i.target_id AND c.status='pending')) OR
    (i.kind='payment_pending' AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=i.target_id AND o.status='pending'))
  ) ORDER BY i.last_seen_at,i.id LIMIT ?`, [maximum]);
  let resolved = 0;
  for (const row of unresolved) {
    if (Date.now() - started >= budget || row.kind === 'webhook_rejected') continue;
    await withTransaction(async tx => {
      const fresh = await queryOne('SELECT * FROM operational_incidents WHERE id=?', [row.id], tx);
      if (!fresh || fresh.status === 'resolved' || await sourceStillActive(fresh, tx, now)) return;
      await execute("UPDATE operational_incidents SET status='resolved',resolved_at=? WHERE id=?", [now, row.id], tx);
      await audit(null, 'incident_auto_resolved', row.id, 'SOURCE_RECOVERED', null, tx); resolved++;
    });
  }
  return { observed, opened, resolved, limit: maximum, moreCandidates: groups.some(group => group.length >= maximum) || observations.reduce((sum, group) => sum + group.length, 0) > observed, elapsedMs: Date.now() - started };
}
