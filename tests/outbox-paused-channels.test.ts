import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import nodemailer from 'nodemailer';
import type { InStatement, TransactionMode } from '@libsql/client/web';
import { closeDb, enqueue, execute, getDb, queryAll, queryOne, withTransaction } from '../server/db';
import { acceptLead } from '../server/services/leads';
import { processOutbox } from '../server/services/operations';

const keys = ['NODE_ENV', 'OT_APP_ENV', 'OT_DATABASE_PATH', 'OT_MIGRATIONS_DIR', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL', 'VERCEL_ENV', 'OT_EMAIL_DELIVERY_ENABLED', 'OT_CRM_DELIVERY_ENABLED', 'OT_OPERATIONAL_ALERTS_ENABLED', 'OT_ANALYTICS_ENABLED', 'SMTP_URL', 'MAIL_FROM', 'OT_ALERT_EMAIL', 'AMO_BASE_URL', 'AMO_ACCESS_TOKEN', 'AMO_SUBDOMAIN', 'AMO_LONG_TOKEN'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let directory: string;
const past = '2026-01-01T00:00:00.000Z';
const mail = { to: 'paused-channel@example.test', subject: 'ISOLATED TEST', text: 'Synthetic mail captured in memory only' };

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-outbox-paused-'));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_DATABASE_PATH: join(directory, 'test.sqlite') });
  await getDb();
  await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)', ['paused-user', 'SYNTHETIC USER', 'paused-user@example.test', Date.now(), Date.now()]);
});
beforeEach(async () => {
  for (const table of ['notifications', 'operational_incidents', 'operational_counters', 'outbox', 'consent_records', 'lead_submissions']) await execute(`DELETE FROM ${table}`);
  Object.assign(process.env, { OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_ANALYTICS_ENABLED: '0', AMO_BASE_URL: 'https://crm.example.test', AMO_ACCESS_TOKEN: 'ISOLATED-NO-PROVIDER-TOKEN', SMTP_URL: 'smtp://smtp.example.test:2525', MAIL_FROM: 'test@example.test' });
});
after(async () => {
  await closeDb();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-outbox-paused-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

test('disabled email and alert backlog cannot consume the only CRM slot or change queued attempts', async context => {
  await withTransaction(async tx => {
    for (let index = 0; index < 64; index++) {
      const jobId = await enqueue(index % 2 ? 'auth.email' : 'operations.alert', `paused-${index}`, index % 2 ? mail : { cycle: 1 }, tx);
      await execute('UPDATE outbox SET created_at=?,available_at=?,attempts=?,status=?,lease_until=? WHERE id=?', [past, past, index === 0 ? 7 : 0, index === 0 ? 'processing' : 'pending', index === 0 ? past : null, jobId], tx);
    }
  });
  const paused = await queryAll('SELECT * FROM outbox ORDER BY id');
  const accepted = await acceptLead({ email: 'crm-slot@example.test' }, randomUUID());
  assert.ok('submissionId' in accepted);
  process.env.OT_CRM_DELIVERY_ENABLED = '1';
  const transport = context.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
    const url = String(input); assert.equal(new URL(url).origin, 'https://crm.example.test');
    if (url.includes('/notes')) return options?.method === 'GET' ? Response.json({ _embedded: { notes: [] } }) : Response.json({ _embedded: { notes: [{ id: 202 }] } });
    return options?.method === 'GET' ? new Response(null, { status: 204 }) : Response.json([{ id: 101 }]);
  });
  const smtp = context.mock.method(nodemailer, 'createTransport', () => { throw new Error('Disabled mail must not create a transport'); });
  const db = await getDb(); const transaction = db.transaction.bind(db);
  const selections: InStatement[] = [];
  context.mock.method(db, 'transaction', async (mode?: TransactionMode) => {
    const tx = await transaction(mode); const original = tx.execute.bind(tx);
    context.mock.method(tx, 'execute', async (statement: InStatement) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.startsWith('SELECT * FROM outbox WHERE')) selections.push(statement);
      return original(statement);
    });
    return tx;
  });
  const result = await processOutbox({ limit: 1, allowExternal: true });
  assert.equal(result.processed, 1); assert.equal(result.results[0]?.status, 'delivered');
  assert.equal(transport.mock.callCount(), 4); assert.equal(smtp.mock.callCount(), 0);
  assert.deepEqual(await queryAll("SELECT * FROM outbox WHERE type IN ('auth.email','operations.alert') ORDER BY id"), paused);
  assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [accepted.submissionId!]))!.status, 'delivered');
  assert.equal((await queryOne("SELECT COUNT(*) count FROM audit_events WHERE action='lead_crm_delivered' AND target=?", [accepted.submissionId!]))!.count, 1);
  assert.equal(selections.length, 1, 'One selection per processed slot, no application-side backlog loop');
  const statement = selections[0]!;
  const plan = await db.execute(typeof statement === 'string' ? `EXPLAIN QUERY PLAN ${statement}` : { ...statement, sql: `EXPLAIN QUERY PLAN ${statement.sql}` });
  assert.ok(plan.rows.some(row => /USING INDEX outbox_pending/.test(String(row.detail))), 'Actual selection uses the existing due-job index; this does not bound all rows scanned inside SQLite');
});

test('external-off worker preserves scoped jobs and in-app delivery; explicitly re-enabled mail resumes once', async context => {
  Object.assign(process.env, { OT_EMAIL_DELIVERY_ENABLED: '1', OT_CRM_DELIVERY_ENABLED: '1', OT_OPERATIONAL_ALERTS_ENABLED: '1' });
  const target = randomUUID();
  const emailId = await enqueue('auth.email', target, mail);
  await enqueue('crm.lead', target, {}); await enqueue('operations.alert', target, { cycle: 1 });
  const otherId = await enqueue('notification.test', 'other-aggregate', { userId: 'paused-user' });
  const inboxId = await enqueue('notification.test', target, { userId: 'paused-user' });
  const before = await queryAll('SELECT * FROM outbox WHERE id<>? ORDER BY id', [inboxId]);
  const fetchSpy = context.mock.method(globalThis, 'fetch', async () => { throw new Error('External fetch must not run'); });
  const messages: unknown[] = [];
  const smtpSpy = context.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (message: unknown) => { messages.push(message); return {}; }, close() {} }) as unknown as ReturnType<typeof nodemailer.createTransport>);
  const local = await processOutbox({ aggregateId: target, limit: 1, allowExternal: false });
  assert.equal(local.results[0]?.id, inboxId); assert.equal(local.results[0]?.status, 'delivered');
  assert.deepEqual(await queryAll('SELECT * FROM outbox WHERE id<>? ORDER BY id', [inboxId]), before);
  assert.equal((await queryOne('SELECT COUNT(*) count FROM notifications'))!.count, 1);
  assert.equal(fetchSpy.mock.callCount(), 0); assert.equal(smtpSpy.mock.callCount(), 0);
  process.env.OT_CRM_DELIVERY_ENABLED = '0'; process.env.OT_OPERATIONAL_ALERTS_ENABLED = '0'; process.env.OT_EMAIL_DELIVERY_ENABLED = '0';
  assert.equal((await processOutbox({ aggregateId: target, allowExternal: true })).processed, 0);
  process.env.OT_EMAIL_DELIVERY_ENABLED = '1';
  const resumed = await processOutbox({ aggregateId: target, limit: 1, allowExternal: true });
  assert.equal(resumed.results[0]?.id, emailId); assert.equal(resumed.results[0]?.status, 'delivered');
  assert.equal(messages.length, 1); assert.equal(smtpSpy.mock.callCount(), 1); assert.equal(fetchSpy.mock.callCount(), 0);
  assert.equal((messages[0] as { messageId: string }).messageId, `<${emailId}@otcenter.local>`);
  const row = (await queryOne('SELECT * FROM outbox WHERE id=?', [emailId]))!;
  assert.equal(row.attempts, 1); assert.equal(row.payload_json, '{}');
  assert.equal((await queryOne('SELECT attempts FROM outbox WHERE id=?', [otherId]))!.attempts, 0);
  assert.equal((await processOutbox({ aggregateId: target, allowExternal: true })).processed, 0);
  assert.equal(messages.length, 1);
});

test('enabled CRM with missing credentials still fails visibly and remains retryable without network access', async context => {
  const accepted = await acceptLead({ email: 'configuration-error@example.test' }, randomUUID()); assert.ok('submissionId' in accepted);
  delete process.env.AMO_ACCESS_TOKEN; process.env.OT_CRM_DELIVERY_ENABLED = '1';
  const fetchSpy = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Missing credentials cannot reach a provider'); });
  const result = await processOutbox({ aggregateId: accepted.submissionId, limit: 1, allowExternal: true });
  assert.equal(result.processed, 1); assert.equal(result.results[0]?.code, 'CRM_NOT_CONFIGURED'); assert.equal(result.results[0]?.status, 'pending');
  assert.equal(fetchSpy.mock.callCount(), 0);
  const row = (await queryOne('SELECT * FROM outbox WHERE aggregate_id=?', [accepted.submissionId!]))!;
  assert.equal(row.attempts, 1); assert.equal(row.last_error, 'CRM_NOT_CONFIGURED'); assert.equal(row.lease_token, null);
  assert.ok(row.available_at > row.updated_at);
  assert.equal((await queryOne('SELECT COUNT(*) count FROM operational_incidents WHERE target_id=?', [row.id]))!.count, 1);
  assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [accepted.submissionId!]))!.status, 'accepted');
  assert.equal((await processOutbox({ aggregateId: accepted.submissionId, limit: 1, allowExternal: true })).processed, 0, 'Retry backoff is retained');
});
