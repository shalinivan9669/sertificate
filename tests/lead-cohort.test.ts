import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import type { InStatement } from '@libsql/client/web';
import { closeDb, execute, getDb, queryAll, type Db } from '../server/db';
import { analyticsReport } from '../server/services/analytics';
import { leadDeliveryCohort } from '../server/services/lead-cohort';
import { acceptLead, deliverLead } from '../server/services/leads';
import type { AppUser } from '../server/utils/auth';

let directory: string;
const envKeys = ['OT_DATABASE_PATH', 'OT_MIGRATIONS_DIR', 'NODE_ENV', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_ANALYTICS_ENABLED', 'OT_ANALYTICS_RETENTION_DAYS', 'AMO_BASE_URL', 'AMO_ACCESS_TOKEN'];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const admin: AppUser = { id: 'isolated-cohort-admin', name: 'ISOLATED ADMIN', email: 'cohort-admin@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const zero = { accepted: 0, delivered: 0, pending: 0, notePending: 0, invalid: 0, deliveryRate: null };
const payload = (organizationName = '') => ({ name: 'PRIVATE_COHORT_NAME_CANARY', phone: '+77000000000', email: 'private-cohort-canary@example.test', comment: 'PRIVATE_COHORT_MESSAGE_CANARY', organizationName });
const window = (month: number) => ({ from: new Date(Date.UTC(2040, month, 1)).toISOString(), until: new Date(Date.UTC(2040, month, 2)).toISOString() });
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error?.data?.code === code);

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-lead-cohort-test-'));
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_ANALYTICS_ENABLED: '0', OT_ANALYTICS_RETENTION_DAYS: '14', AMO_BASE_URL: 'https://cohort-fixture.invalid', AMO_ACCESS_TOKEN: 'ISOLATED_NO_NETWORK_TOKEN' });
  for (const key of ['OT_MIGRATIONS_DIR', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) delete process.env[key];
  await getDb();
  await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,1)', [admin.id,admin.name,admin.email,Date.now(),Date.now(),'admin']);
});
after(async () => {
  await closeDb(); const target = resolve(directory);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ot-lead-cohort-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

async function accepted(createdAt: string, organizationName = '') {
  const body = payload(organizationName), key = randomUUID();
  const result = await acceptLead(body, key); assert.ok('submissionId' in result && result.submissionId);
  await execute('UPDATE lead_submissions SET created_at=? WHERE id=?', [createdAt, result.submissionId]);
  return { id: result.submissionId, body, key };
}
// Historical corruption fixtures are inserted only in this isolated database, never through production APIs.
async function historical(createdAt: string, data: string, status = 'accepted', lead: number | string | null = null, note: number | string | null = null) {
  const id = randomUUID();
  await execute('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,status,crm_lead_id,crm_note_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [id, data, id, id, status, lead, note, createdAt, createdAt]);
}
function isolatedCrm(noteFailure = false) {
  const calls: string[] = [];
  return { calls, transport: async (url: string, options: { method: string }): Promise<Response> => {
    assert.equal(new URL(url).origin, 'https://cohort-fixture.invalid'); calls.push(`${options.method} ${new URL(url).pathname}`);
    if (options.method === 'GET') return new Response(null, { status: 204 });
    if (url.endsWith('/complex')) return Response.json({ _embedded: { leads: [{ id: 54321 }] } });
    assert.ok(url.endsWith('/54321/notes'));
    return noteFailure ? new Response(null, { status: 503 }) : Response.json({ _embedded: { notes: [{ id: 65432 }] } });
  } };
}

test('empty cohort uses null rate and the protected report rejects wrong role, absent or expired MFA', async () => {
  const { from, until } = window(0);
  const result = await leadDeliveryCohort(from, until, until);
  assert.deepEqual(result.totals, zero);
  assert.deepEqual(result.audiences, ['b2c', 'b2b', 'unknown'].map(audience => ({ audience, ...zero })));
  assert.deepEqual(result.window, { from, until, bounds: '[from,until)' });
  assert.equal(result.unit, 'accepted_leads'); assert.equal(result.statusTime, 'current');
  await rejectsCode(analyticsReport({ ...admin, role: 'learner' }, {}), 'FORBIDDEN');
  await rejectsCode(analyticsReport({ ...admin, twoFactorEnabled: false }, {}), 'MFA_REQUIRED');
  await rejectsCode(analyticsReport({ ...admin, mfaVerifiedAt: Date.now() - 13 * 3600000 }, {}), 'MFA_REQUIRED');
  await rejectsCode(analyticsReport(admin, { days: 32 }), 'ANALYTICS_WINDOW_INVALID');
});

test('actual accepted and delivered rows share one creation cohort; replay and honeypot do not inflate denominator', async () => {
  const { from, until } = window(1);
  const person = await accepted(from);
  const company = await accepted(from, 'PRIVATE_COHORT_COMPANY_CANARY');
  const noteWaiting = await accepted(from, 'PRIVATE_COHORT_COMPANY_CANARY');
  const replay = await acceptLead(person.body, person.key); assert.ok('submissionId' in replay); assert.equal(replay.submissionId, person.id);
  await acceptLead({ ...payload(), company: 'HONEYPOT' }, randomUUID());
  const crm = isolatedCrm(); await deliverLead(person.id, crm.transport);
  const failedCrm = isolatedCrm(true); await rejectsCode(deliverLead(noteWaiting.id, failedCrm.transport), 'CRM_NOTE_FAILED');
  const beforeRetry = await leadDeliveryCohort(from, until, until);
  assert.deepEqual(beforeRetry.totals, { accepted: 3, delivered: 1, pending: 2, notePending: 1, invalid: 0, deliveryRate: 1 / 3 });
  assert.deepEqual(beforeRetry.audiences[0], { audience: 'b2c', accepted: 1, delivered: 1, pending: 0, notePending: 0, invalid: 0, deliveryRate: 1 });
  assert.deepEqual(beforeRetry.audiences[1], { audience: 'b2b', accepted: 2, delivered: 0, pending: 2, notePending: 1, invalid: 0, deliveryRate: 0 });
  // An exhausted job does not become a successful delivery or a promise that retries will run.
  await execute("UPDATE outbox SET status='failed',attempts=100 WHERE aggregate_id=?", [company.id]);
  assert.deepEqual((await leadDeliveryCohort(from, until, until)).totals, beforeRetry.totals);
  const retryCrm = isolatedCrm(); await deliverLead(noteWaiting.id, retryCrm.transport); await deliverLead(person.id, crm.transport);
  assert.ok(!retryCrm.calls.some(call => call.includes('/complex')));
  const result = await leadDeliveryCohort(from, until, until);
  assert.deepEqual(result.totals, { accepted: 3, delivered: 2, pending: 1, notePending: 0, invalid: 0, deliveryRate: 2 / 3 });
  assert.equal(result.asOf, until); // Caller labels observation time; statuses are not reconstructed from updated_at.
});

test('half-open boundaries, disabled telemetry and later delivery retain exact accepted-lead denominator', async () => {
  const { from, until } = window(2);
  await historical(new Date(Date.parse(from) - 1).toISOString(), JSON.stringify(payload()), 'delivered', 1, 2);
  await historical(from, JSON.stringify(payload()), 'delivered', 1, 2);
  await historical(new Date(Date.parse(until) - 1).toISOString(), JSON.stringify(payload('Company')));
  await historical(until, JSON.stringify(payload()), 'delivered', 1, 2);
  await execute('INSERT INTO analytics_events(id,name,dimensions_json,created_at) VALUES(?,?,?,?)', [randomUUID(), 'lead_accepted', '{}', from]);
  const result = await analyticsReport(admin, { days: 1 }, Date.parse(until));
  assert.equal(result.configuration.enabled, false);
  assert.equal(result.leadCohort.window.from, result.window.from); assert.equal(result.leadCohort.window.until, result.window.until);
  assert.deepEqual(result.leadCohort.totals, { accepted: 2, delivered: 1, pending: 1, notePending: 0, invalid: 0, deliveryRate: 0.5 });
  assert.equal(result.totals.server, 1); assert.equal(result.totals.client, 0);
  assert.equal(result.conversionRate, null); assert.equal(result.uniqueVisitorsMeasured, false);
  assert.equal(result.unit, 'deduplicated_events'); assert.equal(result.leadCohort.unit, 'accepted_leads');
  const cohortBefore = result.leadCohort.totals;
  await execute('DELETE FROM analytics_events WHERE created_at>=? AND created_at<?', [from, until]);
  const afterRetention = await analyticsReport(admin, { days: 1 }, Date.parse(until));
  assert.equal(afterRetention.totals.server, 0); assert.deepEqual(afterRetention.leadCohort.totals, cohortBefore);
});

test('malformed historical payloads, unknown states and invalid CRM IDs remain explicit invalid records', async () => {
  const { from, until } = window(3);
  const valid = JSON.stringify(payload());
  const malformed = ['not-json PRIVATE_PAYLOAD_CANARY', 'null', '[]', '"PRIVATE_PAYLOAD_CANARY"', '{}', '{"organizationName":null}', '{"organizationName":12}', '{"organizationName":{}}'];
  for (const json of malformed) await historical(from, json, 'delivered', 1, 2);
  for (const invalid of [null, 0, -1, 1.5, 'PRIVATE_PROVIDER_ID_CANARY', '9007199254740992', '9223372036854775807']) {
    await historical(from, valid, 'delivered', invalid, 2);
    await historical(from, valid, 'delivered', 1, invalid);
  }
  await historical(from, valid, 'PRIVATE_STATUS_CANARY', 1, 2);
  await historical(from, valid, 'note_pending', 0);
  await historical(from, valid, 'note_pending', 1, 2);
  await historical(from, valid, 'accepted', 1);
  await historical(from, valid, 'delivered', '9007199254740991', '9007199254740991');
  const result = await leadDeliveryCohort(from, until, until);
  assert.deepEqual(result.totals, { accepted: 27, delivered: 1, pending: 0, notePending: 0, invalid: 26, deliveryRate: 1 / 27 });
  assert.deepEqual(result.audiences[2], { audience: 'unknown', accepted: 8, delivered: 0, pending: 0, notePending: 0, invalid: 8, deliveryRate: 0 });
  const rendered = JSON.stringify(result);
  for (const canary of ['PRIVATE_', '@example.test', '77000000000', '9007199254740991']) assert.ok(!rendered.includes(canary));
  assert.deepEqual(Object.keys(result).sort(), ['asOf', 'audiences', 'statusTime', 'totals', 'unit', 'window']);
  for (const group of result.audiences) assert.equal(group.accepted, group.delivered + group.pending + group.invalid);
});

test('cohort calculation issues one indexed read and returns at most three rows with no writes', async () => {
  const { from, until } = window(4), client = await getDb();
  await client.batch(Array.from({ length: 600 }, (_, index) => {
    const id = randomUUID();
    return { sql: 'INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?)', args: [id, JSON.stringify(payload(index % 2 ? 'Company' : '')), id, id, from, from] };
  }), 'write');
  const recordCounts = `SELECT (SELECT COUNT(*) FROM lead_submissions) AS leads,
    (SELECT COUNT(*) FROM analytics_events) AS telemetry,(SELECT COUNT(*) FROM audit_events) AS audit,
    (SELECT COUNT(*) FROM outbox) AS jobs,(SELECT COUNT(*) FROM consent_records) AS consents,
    (SELECT COUNT(*) FROM rate_limits) AS rate_limits`;
  const before = await queryAll(recordCounts);
  let calls = 0; let actualSql = ''; let returnedRows = 0;
  const tracked = new Proxy(client, { get(target, property) {
    if (property === 'execute') return async (statement: InStatement) => {
      calls++; actualSql = typeof statement === 'string' ? statement : statement.sql;
      const result = await target.execute(statement); returnedRows += result.rows.length; return result;
    };
    const member = Reflect.get(target, property); return typeof member === 'function' ? member.bind(target) : member;
  } }) as Db;
  const result = await leadDeliveryCohort(from, until, until, tracked);
  assert.equal(calls, 1); assert.ok(returnedRows <= 3);
  assert.deepEqual(result.totals, { accepted: 600, delivered: 0, pending: 600, notePending: 0, invalid: 0, deliveryRate: 0 });
  assert.equal(result.audiences[0]?.accepted, 300); assert.equal(result.audiences[1]?.accepted, 300);
  const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${actualSql}`, args: [from, until] });
  assert.match(plan.rows.map(row => row.detail).join('\n'), /SEARCH lead_submissions USING INDEX leads_created/);
  assert.deepEqual(await queryAll(recordCounts), before);
});
