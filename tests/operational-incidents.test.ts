import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, enqueue, execute, getDb, queryAll, queryOne } from '../server/db';
import { incidentThresholds, listIncidents, recordIncident, scanOperationalIncidents, transitionIncident } from '../server/services/incidents';
import { processOutbox } from '../server/services/operations';
import { processPaymentWebhook } from '../server/services/commerce';
import type { AppUser } from '../server/utils/auth';

let directory: string;
const admin: AppUser = { id: 'incident-admin', name: 'TEST ADMIN', email: 'admin@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const issuer: AppUser = { ...admin, id: 'incident-issuer', role: 'issuer' };
const finance: AppUser = { ...admin, id: 'incident-finance', role: 'finance' };
const learner: AppUser = { ...admin, id: 'incident-learner', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const reason = 'Isolated operational test: source reviewed and recovered';
const keys = ['NODE_ENV', 'OT_APP_ENV', 'OT_DATABASE_PATH', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL', 'VERCEL_ENV', 'OT_OPERATIONAL_ALERTS_ENABLED', 'OT_ALERT_EMAIL', 'OT_ALERT_OUTBOX_MINUTES', 'OT_ALERT_LEAD_MINUTES', 'OT_ALERT_CREDENTIAL_MINUTES', 'OT_ALERT_PAYMENT_MINUTES', 'OT_EMAIL_DELIVERY_ENABLED', 'OT_CRM_DELIVERY_ENABLED', 'OT_PAYMENT_PROVIDER', 'OT_SANDBOX_WEBHOOK_SECRET', 'SMTP_URL', 'MAIL_FROM'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const rejects = (operation: Promise<unknown>, code: string) => assert.rejects(operation, (error: any) => error?.data?.code === code || error?.statusMessage === code);

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-operational-incidents-'));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_DATABASE_PATH: join(directory, 'test.sqlite'), OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled' });
  await getDb();
  for (const actor of [admin, issuer, finance, learner]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,?)', [actor.id, actor.name, `${actor.id}@example.test`, Date.now(), Date.now(), actor.role, Number(actor.twoFactorEnabled)]);
});
beforeEach(async () => {
  for (const table of ['notifications', 'operational_incidents', 'operational_counters', 'outbox', 'lead_submissions']) await execute(`DELETE FROM ${table}`);
  for (const key of ['OT_ALERT_OUTBOX_MINUTES', 'OT_ALERT_LEAD_MINUTES', 'OT_ALERT_CREDENTIAL_MINUTES', 'OT_ALERT_PAYMENT_MINUTES', 'SMTP_URL', 'MAIL_FROM', 'OT_ALERT_EMAIL']) delete process.env[key];
  process.env.OT_OPERATIONAL_ALERTS_ENABLED = '0'; process.env.OT_PAYMENT_PROVIDER = 'disabled';
});
after(async () => {
  await closeDb(); const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-operational-incidents-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

test('B52 concurrent repeated observations open one incident and one inbox entry per eligible role without external delivery', async () => {
  const observed = { kind: 'credential_pending' as const, targetId: 'test-document', severity: 'critical' as const, code: 'RENDER_FAILED' };
  const results = await Promise.all(Array.from({ length: 8 }, () => recordIncident(observed)));
  assert.equal(new Set(results.map(row => row.id)).size, 1); assert.equal(results.filter(row => row.opened).length, 1);
  const row = (await queryOne('SELECT * FROM operational_incidents'))!;
  assert.equal(row.observations, 8); assert.equal(row.cycle, 1); assert.equal(row.owner_role, 'issuer');
  assert.deepEqual((await queryAll('SELECT user_id FROM notifications ORDER BY user_id')).map(row => row.user_id), [admin.id, issuer.id]);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM outbox'))!.n, 0);
  assert.equal((await queryOne("SELECT COUNT(*) n FROM audit_events WHERE action='incident_opened' AND target=?", [row.id]))!.n, 1);
});

test('B52 scoped MFA operators acknowledge with evidence; active source cannot be closed; recovery and recurrence preserve history', async () => {
  const jobId = await enqueue('test.unsupported', 'test-entity', {});
  await execute("UPDATE outbox SET status='failed' WHERE id=?", [jobId]);
  const recorded = await recordIncident({ kind: 'outbox_failed', targetId: jobId, severity: 'critical', code: 'JOB_HANDLER_NOT_CONFIGURED' });
  await rejects(listIncidents(learner), 'FORBIDDEN');
  await rejects(transitionIncident({ ...admin, mfaVerifiedAt: 1 }, 'missing', { action: 'resolve', reason }), 'MFA_REQUIRED');
  await rejects(transitionIncident(finance, recorded.id, { action: 'acknowledge', reason }), 'INCIDENT_NOT_FOUND');
  assert.equal((await listIncidents(finance)).pagination.total, 0);
  const acknowledged = await transitionIncident(admin, recorded.id, { action: 'acknowledge', reason });
  assert.equal(acknowledged.incident.acknowledgedBy, admin.id);
  assert.equal((await transitionIncident(admin, recorded.id, { action: 'acknowledge', reason })).duplicate, true);
  await rejects(transitionIncident(admin, recorded.id, { action: 'resolve', reason }), 'INCIDENT_SOURCE_NOT_RECOVERED');
  await execute("UPDATE outbox SET status='delivered' WHERE id=?", [jobId]);
  assert.equal((await transitionIncident(admin, recorded.id, { action: 'resolve', reason })).incident.status, 'resolved');
  assert.equal((await transitionIncident(admin, recorded.id, { action: 'resolve', reason })).duplicate, true);
  await execute("UPDATE outbox SET status='failed' WHERE id=?", [jobId]);
  assert.equal((await recordIncident({ kind: 'outbox_failed', targetId: jobId, severity: 'critical', code: 'DELIVERY_FAILED' })).cycle, 2);
  const reopened = (await queryOne('SELECT * FROM operational_incidents WHERE id=?', [recorded.id]))!;
  assert.equal(reopened.acknowledged_by, null); assert.equal(reopened.status, 'open');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM notifications WHERE user_id=?', [admin.id]))!.n, 2);
});

test('B52 bounded scans rotate past old incidents and reconcile recovered sources behind a larger active queue', async () => {
  const now = new Date(); const old = new Date(now.valueOf() - 3 * 86400000).toISOString();
  const leadIds = [];
  for (let index = 0; index < 9; index++) {
    const leadId = `test-lead-${index}`; leadIds.push(leadId);
    await execute('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?)', [leadId, '{"email":"never-retain@example.test"}', `hash-${index}`, `key-${index}`, old, old]);
  }
  for (let tick = 0; tick < 3; tick++) { const result = await scanOperationalIncidents({ limit: 3, now: new Date(now.valueOf() + tick * 1000), budgetMs: 10000 }); assert.equal(result.observed, 3); }
  assert.equal((await queryOne('SELECT COUNT(*) n FROM operational_incidents'))!.n, 9);
  const last = leadIds.at(-1)!;
  await execute("UPDATE lead_submissions SET status='delivered' WHERE id=?", [last]);
  const result = await scanOperationalIncidents({ limit: 2, now: new Date(now.valueOf() + 4000), budgetMs: 10000 });
  assert.equal(result.resolved, 1);
  assert.equal((await queryOne('SELECT status FROM operational_incidents WHERE target_id=?', [last]))!.status, 'resolved');
  assert.equal(JSON.stringify(await queryAll('SELECT * FROM operational_incidents')).includes('never-retain@example.test'), false);
  const first = await listIncidents(admin, { page: 1, pageSize: 3 }); const second = await listIncidents(admin, { page: 2, pageSize: 3 });
  assert.equal(first.pagination.total, 8); assert.equal(first.pagination.hasMore, true);
  assert.equal(new Set([...first.incidents, ...second.incidents].map(row => row.id)).size, 6);
});

test('B52 age thresholds and live leases prevent premature alerts; unknown private error text is redacted', async () => {
  const now = new Date(); const old = new Date(now.valueOf() - 3 * 3600000).toISOString();
  const freshJob = await enqueue('test.unsupported', 'fresh', {});
  const leasedJob = await enqueue('test.unsupported', 'leased', {});
  const failedJob = await enqueue('test.unsupported', 'failed', {});
  await execute("UPDATE outbox SET created_at=?,status='processing',lease_until=? WHERE id=?", [old, new Date(now.valueOf() + 60000).toISOString(), leasedJob]);
  await execute("UPDATE outbox SET status='failed',last_error=? WHERE id=?", ['private@example.test password=never-store', failedJob]);
  const result = await scanOperationalIncidents({ now, budgetMs: 10000 }); assert.equal(result.observed, 1);
  const row = (await queryOne('SELECT * FROM operational_incidents'))!;
  assert.equal(row.target_id, failedJob); assert.equal(row.severity, 'critical');
  assert.equal(row.details_json.includes('private@'), false);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM operational_incidents WHERE target_id IN (?,?)', [freshJob, leasedJob]))!.n, 0);
  process.env.OT_ALERT_OUTBOX_MINUTES = '0'; assert.throws(incidentThresholds, (error: any) => error?.data?.code === 'ALERT_THRESHOLD_INVALID');
});

test('T052 rejected sandbox webhooks retain only bounded codes and counts; no raw request, signature or payment mutation', async () => {
  process.env.OT_PAYMENT_PROVIDER = 'sandbox'; process.env.OT_SANDBOX_WEBHOOK_SECRET = 'isolated-webhook-secret-minimum-thirty-two-characters';
  const privateBody = JSON.stringify({ email: 'private-request@example.test', secret: 'RAW-PAYLOAD-CANARY' });
  for (let index = 0; index < 3; index++) await rejects(processPaymentWebhook(privateBody, 'invalid-private-signature'), 'INVALID_SIGNATURE');
  const expired = JSON.stringify({ eventId: 'expired-test-event', paymentId: randomUUID(), merchant: 'PRIVATE-MERCHANT', amountMinor: 100, currency: 'KZT', status: 'pending', timestamp: Date.now() - 86400000 });
  await rejects(processPaymentWebhook(expired, createHmac('sha256', process.env.OT_SANDBOX_WEBHOOK_SECRET).update(expired).digest('hex')), 'WEBHOOK_EXPIRED');
  assert.equal((await queryOne("SELECT count FROM operational_counters WHERE metric='webhook_invalid_signature'"))!.count, 3);
  assert.equal((await queryOne("SELECT count FROM operational_counters WHERE metric='webhook_expired'"))!.count, 1);
  assert.equal((await listIncidents(finance)).pagination.total, 2); assert.equal((await listIncidents(issuer)).pagination.total, 0);
  const retained = JSON.stringify(await queryAll('SELECT * FROM operational_incidents')) + JSON.stringify(await queryAll("SELECT * FROM audit_events WHERE action LIKE 'incident_%'"));
  for (const canary of ['private-request', 'RAW-PAYLOAD-CANARY', 'invalid-private-signature', 'PRIVATE-MERCHANT']) assert.equal(retained.includes(canary), false);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM payment_events'))!.n, 0);
  const incident = (await listIncidents(finance)).incidents[0]!;
  await rejects(transitionIncident(finance, incident.id, { action: 'resolve', reason }), 'INCIDENT_SOURCE_NOT_RECOVERED');
  await execute('UPDATE operational_incidents SET last_seen_at=? WHERE id=?', [new Date(Date.now() - 6 * 60000).toISOString(), incident.id]);
  assert.equal((await transitionIncident(finance, incident.id, { action: 'resolve', reason })).incident.status, 'resolved');
});

test('B52 resolved external alerts are cancelled without contacting SMTP; failed telemetry never retries a completed notification', async () => {
  process.env.OT_OPERATIONAL_ALERTS_ENABLED = '1'; process.env.OT_ALERT_EMAIL = 'owner@example.test';
  const incident = await recordIncident({ kind: 'credential_pending', targetId: 'recovered-document', severity: 'critical', code: 'RENDER_FAILED' });
  await transitionIncident(issuer, incident.id, { action: 'resolve', reason });
  const alerts = await processOutbox({ limit: 1, aggregateId: incident.id, allowExternal: true });
  assert.equal(alerts.results[0]?.status, 'cancelled');
  assert.equal((await queryOne("SELECT status FROM outbox WHERE type='operations.alert'"))!.status, 'cancelled');
  // Fault injection at the telemetry store, after a real in-app delivery, must not alter domain success.
  await execute("CREATE TRIGGER test_counter_failure BEFORE INSERT ON operational_counters BEGIN SELECT RAISE(ABORT, 'INJECTED_COUNTER_FAILURE'); END");
  try {
    const notificationId = await enqueue('notification.enrollment', 'test-enrollment', { userId: learner.id });
    const delivery = await processOutbox({ limit: 1, aggregateId: 'test-enrollment' });
    assert.equal(delivery.results[0]?.status, 'delivered');
    assert.equal((await queryOne('SELECT status FROM outbox WHERE id=?', [notificationId]))!.status, 'delivered');
    assert.equal((await queryOne('SELECT COUNT(*) n FROM notifications WHERE user_id=?', [learner.id]))!.n, 1);
    assert.equal((await processOutbox({ limit: 1, aggregateId: 'test-enrollment' })).processed, 0);
  } finally { await execute('DROP TRIGGER test_counter_failure'); }
});

test('B52 queue failures become visible with a bounded code after final retry and no fabricated delivered status', async () => {
  const jobId = await enqueue('unimplemented.provider', 'test-target', { private: 'do-not-copy' });
  await execute('UPDATE outbox SET attempts=7 WHERE id=?', [jobId]);
  const result = await processOutbox({ limit: 1, aggregateId: 'test-target' });
  assert.equal(result.results[0]?.status, 'failed'); assert.equal(result.results[0]?.code, 'JOB_HANDLER_NOT_CONFIGURED');
  const row = (await queryOne('SELECT * FROM operational_incidents'))!;
  assert.equal(row.kind, 'outbox_failed'); assert.equal(row.target_id, jobId); assert.equal(row.details_json.includes('do-not-copy'), false);
  assert.equal((await queryOne("SELECT count FROM operational_counters WHERE metric='outbox_failed'"))!.count, 1);
});
