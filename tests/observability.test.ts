import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { createApp, defineEventHandler, getResponseStatus, toNodeListener, type H3Event } from 'h3';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { audit, closeDb, enqueue, execute, getDb, queryAll, queryOne, withTransaction } from '../server/db';
import { resetAuthInstance } from '../server/services/auth';
import { processOutbox, retryJob } from '../server/services/operations';
import { observeApiResponse } from '../server/services/request-observations';
import { currentObservation, eventObservation, jobObservation, logObservation, newRequestContext, runWithObservation, safeApiFailure, safeDeliveryCode, safeLogRecord, safeOperationalCode, safeRoute } from '../server/utils/observability';
import { strictKeys } from '../server/utils/validation';
import security from '../server/middleware/security';
import authHandler from '../server/api/auth/[...all]';
import apiHandler from '../server/api/v1/[...path]';
import leadHandler from '../server/api/amo-lead.post';
import { analyticsConsentVersion, analyticsCookieName } from '../shared/analytics';

let directory: string; let server: Server; let origin: string;
const envKeys = ['NODE_ENV', 'OT_APP_ENV', 'OT_DATABASE_PATH', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'OT_CRM_DELIVERY_ENABLED', 'OT_EMAIL_DELIVERY_ENABLED', 'OT_OPERATIONAL_ALERTS_ENABLED', 'SMTP_URL', 'MAIL_FROM'];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const logs: ReturnType<typeof safeLogRecord>[] = [];
const originalInfo = console.info;
const canaries = ['PRIVATE_UPPERCASE_SECRET_CANARY', 'private-observation@example.test', 'PRIVATE_ANSWER_CANARY', 'PRIVATE_VERIFICATION_CANARY'];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const fakeEvent = (path: string, method = 'PUT') => ({ context: {}, path, method }) as H3Event;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-observation-'));
  for (const key of envKeys) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_DATABASE_PATH: join(directory, 'test.sqlite'), BETTER_AUTH_SECRET: 'Isolated-observation-test-secret-thirty-two-characters', OT_CRM_DELIVERY_ENABLED: '0', OT_EMAIL_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0' });
  console.info = (...values: unknown[]) => { if (typeof values[0] === 'string') logs.push(JSON.parse(values[0])); };
  await getDb();
  const app = createApp({ onBeforeResponse: async event => { await observeApiResponse(event, getResponseStatus(event)); } });
  app.use(security).use(defineEventHandler(event => event.path.startsWith('/api/auth/') ? authHandler(event) : event.path.startsWith('/api/amo-lead') ? leadHandler(event) : apiHandler(event)));
  server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`; process.env.BETTER_AUTH_URL = origin;
});
after(async () => {
  console.info = originalInfo; resetAuthInstance();
  await new Promise<void>(resolve => server.close(() => resolve())); await closeDb();
  const serialized = JSON.stringify(logs); for (const canary of canaries) assert.equal(serialized.includes(canary), false);
  const output = resolve('artifacts/observability'); await mkdir(output, { recursive: true });
  await writeFile(join(output, 'safe-fixture-samples.json'), JSON.stringify({ scope: 'isolated synthetic local tests; no provider or external delivery', records: logs }, null, 2));
  const target = resolve(directory); assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-observation-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

test('B52 asynchronous concurrent request and nested job contexts remain isolated through real transactions', async () => {
  // Four overlapping native writers test isolation within the existing bounded
  // acquisition budget. This is not a database-capacity or unlimited-contention test.
  const contexts = Array.from({ length: 4 }, newRequestContext);
  const rows = await Promise.all(contexts.map((context, index) => runWithObservation(context, async () => {
    await pause((index % 4) * 2);
    assert.equal(currentObservation()!.requestId, context.requestId);
    const row = await withTransaction(async tx => {
      await pause(index % 3);
      const auditId = await audit(null, 'TEST_OBSERVATION', `test-${index}`, '', null, tx);
      const jobId = await enqueue('test.context', `test-${index}`, { privateAnswer: canaries[2] }, tx);
      return { auditId, jobId };
    });
    const nested = jobObservation({ id: row.jobId, correlation_id: context.correlationId, request_id: context.requestId });
    await runWithObservation(nested, async () => { await pause(1); assert.equal(currentObservation()!.sourceJobId, row.jobId); assert.notEqual(currentObservation()!.requestId, context.requestId); });
    assert.equal(currentObservation()!.requestId, context.requestId);
    return { ...row, context };
  })));
  assert.equal(currentObservation(), undefined);
  for (const row of rows) for (const [table, key] of [['audit_events', row.auditId], ['outbox', row.jobId]]) {
    const stored = (await queryOne(`SELECT request_id,correlation_id,origin_request_id,source_job_id FROM ${table} WHERE id=?`, [key!]))!;
    assert.deepEqual(stored, { request_id: row.context.requestId, correlation_id: row.context.correlationId, origin_request_id: row.context.originRequestId, source_job_id: null });
  }
});

test('B52 log allowlist rejects dynamic routes, query/body/stack, uppercase secrets, malformed identifiers and log-sink failure', async () => {
  for (const path of [`/api/v1/verify/${canaries[3]}?email=${canaries[1]}`, `/api/v1/attempts/${canaries[0]}/answers/${canaries[2]}?token=x`, '/api/' + canaries[0]!.repeat(1000)]) {
    const record = safeLogRecord({ event: 'api_failure', context: { requestId: canaries[0]!, correlationId: 'x'.repeat(50000), originRequestId: canaries[1]!, sourceJobId: canaries[2]! }, route: path, method: canaries[0], status: 500, code: canaries[0], elapsedMs: Infinity });
    const text = JSON.stringify(record); for (const canary of canaries) assert.equal(text.includes(canary), false);
    assert.equal(record.errorCode, 'SERVER_REQUEST_FAILED'); assert.equal(record.requestId, null); assert.equal(record.method, 'OTHER'); assert.ok(text.length < 500);
  }
  assert.equal(safeRoute(`/api/v1/attempts/${randomUUID()}/answers/private-question`), '/api/v1/attempts/:id/answers');
  assert.equal(safeRoute(`/api/v1/analytics/journey?source=${canaries[1]}`), '/api/v1/analytics/journey');
  assert.equal(safeRoute(`/api/v1/analytics/journey/authenticated?token=${canaries[1]}`), '/api/v1/analytics/journey/authenticated');
  assert.equal(safeRoute(`/api/v1/analytics/journey/${canaries[0]}`), '/api/:unmatched');
  assert.equal(safeDeliveryCode({ statusMessage: canaries[0], message: canaries[1], stack: canaries[2] }), 'DELIVERY_FAILED');
  assert.equal(safeOperationalCode(canaries[0]), 'UNCLASSIFIED');
  const event = fakeEvent('/api/v1/analytics', 'POST');
  const failed = safeApiFailure(event, Object.assign(new Error(canaries[1]), { code: canaries[0], privateAnswer: canaries[2] }));
  assert.equal(failed.statusCode, 500); assert.equal(failed.message, 'SERVER_REQUEST_FAILED');
  for (const canary of canaries) assert.equal(JSON.stringify(failed).includes(canary), false);
  try { strictKeys({ [canaries[0]!]: canaries[2] }, []); assert.fail('Unknown keys must be rejected'); }
  catch (error) { const response = safeApiFailure(event, error); assert.equal(response.data.code, 'UNKNOWN_FIELD'); for (const canary of canaries) assert.equal(JSON.stringify(response).includes(canary), false); }
  const capture = console.info; console.info = () => { throw new Error(canaries[0]); };
  try { assert.doesNotThrow(() => logObservation({ event: 'outbox_failed', code: canaries[0] })); } finally { console.info = capture; }
});

test('B52 genuine HTTP requests ignore even valid incoming IDs and preserve first domain correlation across idempotent replay', async () => {
  const external = randomUUID(); const key = randomUUID();
  const requests = await Promise.all([0, 1, 2].map(async index => {
    const response = await fetch(`${origin}/api/amo-lead`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Request-Id': index === 0 ? external : canaries[0]!.repeat(100), 'X-Correlation-Id': external, 'Idempotency-Key': key }, body: JSON.stringify({ name: 'Synthetic observation only', email: canaries[1], consentVersion: 'TEST_ONLY' }) });
    assert.equal(response.status, 202); const requestId = response.headers.get('x-request-id')!; assert.match(requestId, /^[0-9a-f-]{36}$/); assert.notEqual(requestId, external);
    return { requestId, data: await response.json() as { submissionId: string } };
  }));
  assert.equal(new Set(requests.map(row => row.requestId)).size, 3); assert.equal(new Set(requests.map(row => row.data.submissionId)).size, 1);
  const target = requests[0]!.data.submissionId;
  const records = await queryAll('SELECT * FROM audit_events WHERE action=? AND target=?', ['lead_accepted', target]); assert.equal(records.length, 1);
  const job = (await queryOne('SELECT * FROM outbox WHERE aggregate_id=?', [target]))!;
  assert.ok(requests.some(row => row.requestId === records[0]!.request_id)); assert.equal(job.request_id, records[0]!.request_id);
  assert.equal(job.correlation_id, job.request_id); assert.equal(job.origin_request_id, job.request_id); assert.equal(job.source_job_id, null);
  assert.equal((await queryOne('SELECT COUNT(*) total FROM outbox WHERE aggregate_id=?', [target]))!.total, 1);
});

test('B52 actual Better Auth transactional email outbox inherits HTTP context without copying body or secrets', async () => {
  const response = await fetch(`${origin}/api/auth/sign-up/email`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Correlation-Id': canaries[0]! }, body: JSON.stringify({ name: 'Synthetic context learner', email: 'auth-observation@example.test', password: 'Isolated-observation-password-2026!' }) });
  assert.equal(response.status, 200); const requestId = response.headers.get('x-request-id');
  const row = (await queryOne('SELECT id,aggregate_id,request_id,correlation_id,origin_request_id,source_job_id FROM outbox WHERE type=? ORDER BY created_at DESC LIMIT 1', ['auth.email']))!;
  assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual({ request_id: row.request_id, correlation_id: row.correlation_id, origin_request_id: row.origin_request_id, source_job_id: row.source_job_id }, { request_id: requestId, correlation_id: requestId, origin_request_id: requestId, source_job_id: null });
  const queued = await queryOne('SELECT * FROM outbox WHERE id=?', [row.id]);
  assert.equal((await processOutbox({ aggregateId: row.aggregate_id, limit: 1, allowExternal: false })).processed, 0);
  assert.deepEqual(await queryOne('SELECT * FROM outbox WHERE id=?', [row.id]), queued);
  assert.equal(logs.some(log => log.sourceJobId === row.id), false, 'Paused delivery does not create a fabricated attempt span');
  // Explicitly enabled but unconfigured email remains an observable configuration error.
  process.env.OT_EMAIL_DELIVERY_ENABLED = '1';
  try {
    await processOutbox({ aggregateId: row.aggregate_id, limit: 1, allowExternal: true });
    const failure = logs.findLast(log => log.sourceJobId === row.id)!;
    assert.equal(failure.correlationId, requestId); assert.equal(failure.originRequestId, requestId); assert.equal(failure.errorCode, 'EMAIL_DELIVERY_NOT_CONFIGURED');
  } finally { process.env.OT_EMAIL_DELIVERY_ENABLED = '0'; }
});

test('B52 handled Better Auth Web Response 401 is observed once without changing its authentication response', async () => {
  const before = Number((await queryOne('SELECT SUM(count) AS total FROM operational_counters WHERE metric=?', ['api_error']))?.total || 0);
  const authBefore = Number((await queryOne('SELECT SUM(count) AS total FROM operational_counters WHERE metric=?', ['auth_failure']))?.total || 0);
  const response = await fetch(`${origin}/api/auth/sign-in/email?token=${canaries[3]}`, {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'auth-observation@example.test', password: 'Wrong-isolated-test-password-2026!' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'INVALID_EMAIL_OR_PASSWORD', 'Keep the supported Better Auth response body');
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.equal(response.headers.get('set-cookie'), null, 'Failed authentication creates no session');
  const matches = logs.filter(row => row.requestId === response.headers.get('x-request-id') && row.event === 'api_failure');
  assert.equal(matches.length, 1); assert.equal(matches[0]!.status, 401);
  assert.equal(matches[0]!.route, '/api/auth/:operation'); assert.equal(matches[0]!.errorCode, 'AUTHENTICATION_REQUIRED');
  assert.equal(Number((await queryOne('SELECT SUM(count) AS total FROM operational_counters WHERE metric=?', ['api_error']))!.total), before + 1);
  assert.equal(Number((await queryOne('SELECT SUM(count) AS total FROM operational_counters WHERE metric=?', ['auth_failure']))!.total), authBefore + 1);
});

test('order write errors have a bounded aggregate counter; reads, successful responses and duplicate hooks do not inflate it', async () => {
  const count = async () => Number((await queryOne('SELECT SUM(count) AS total FROM operational_counters WHERE metric=?', ['checkout_failure']))?.total || 0);
  const initial = await count();
  for (const path of ['/api/v1/orders', `/api/v1/orders/${randomUUID()}/checkout`]) {
    const response = await fetch(origin + path, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401, 'Actual anonymous writes fail through the existing authorization path');
  }
  assert.equal(await count(), initial + 2);
  const read = await fetch(`${origin}/api/v1/orders/${randomUUID()}`); assert.equal(read.status, 401);
  assert.equal(await count(), initial + 2, 'Reading an order is not an attempted checkout');
  const metrics: string[][] = [], write = async (names: readonly string[]) => { metrics.push([...names]); };
  const event = fakeEvent(`/api/v1/orders/${randomUUID()}/checkout`, 'POST');
  await observeApiResponse(event, 503, write); await observeApiResponse(event, 503, write);
  await observeApiResponse(fakeEvent('/api/v1/orders', 'POST'), 200, write);
  assert.deepEqual(metrics, [['api_error','checkout_failure']], 'One write per failed response with no personal dimension');
});

test('B52 worker failure/retry uses source correlation and job span rather than the operator request; success is not redelivered', async () => {
  const source = newRequestContext(); const operator = newRequestContext();
  const jobId = await runWithObservation(source, () => enqueue('test.unknown', 'observation-worker', { privateEmail: canaries[1] }));
  await execute('UPDATE outbox SET attempts=7 WHERE id=?', [jobId]);
  const before = logs.length;
  const first = await runWithObservation(operator, () => processOutbox({ aggregateId: 'observation-worker', limit: 1, allowExternal: false }));
  assert.equal(first.results[0]!.status, 'failed'); assert.equal(first.results[0]!.code, 'JOB_HANDLER_NOT_CONFIGURED');
  const delivery = logs.slice(before).find(row => row.event === 'outbox_failed')!;
  assert.equal(delivery.sourceJobId, jobId); assert.equal(delivery.correlationId, source.correlationId); assert.equal(delivery.originRequestId, source.requestId);
  assert.notEqual(delivery.requestId, operator.requestId); assert.notEqual(delivery.requestId, source.requestId);
  const auditRow = (await queryOne('SELECT * FROM audit_events WHERE action=? AND correlation_id=?', ['incident_opened', source.correlationId]))!;
  assert.equal(auditRow.source_job_id, jobId); assert.equal(auditRow.request_id, delivery.requestId);
  await runWithObservation(operator, () => retryJob('test-operator', jobId, 'Synthetic retry evidence, no external operation'));
  const second = await runWithObservation(operator, () => processOutbox({ aggregateId: 'observation-worker', limit: 1, allowExternal: false }));
  assert.equal(second.results[0]!.id, jobId);
  const failureLogs = logs.slice(before).filter(row => row.event === 'outbox_failed'); assert.equal(failureLogs.length, 2);
  assert.notEqual(failureLogs[0]!.requestId, failureLogs[1]!.requestId); assert.equal(failureLogs[1]!.correlationId, source.correlationId);
  const legacy = await enqueue('notification.test', 'observation-success', {});
  await processOutbox({ aggregateId: 'observation-success', limit: 1 });
  assert.equal(logs.findLast(row => row.sourceJobId === legacy)!.correlationId, legacy, 'Legacy jobs use their opaque job ID as stable fallback');
  assert.equal((await processOutbox({ aggregateId: 'observation-success', limit: 1 })).processed, 0);
  // Earlier Better Auth queues used non-UUID IDs. Do not rename history; persist a
  // new safe correlation once and explicitly omit the incompatible source ID.
  const oldId = 'legacy-auth-opaque-test-job'; const stamp = new Date().toISOString();
  await execute('INSERT INTO outbox(id,type,aggregate_id,payload_json,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', [oldId, 'test.unknown', 'old-observation', '{}', stamp, stamp, stamp]);
  await processOutbox({ aggregateId: 'old-observation', limit: 1 });
  const oldRow = (await queryOne('SELECT correlation_id FROM outbox WHERE id=?', [oldId]))!;
  assert.match(oldRow.correlation_id, /^[0-9a-f-]{36}$/);
  await retryJob('test-operator', oldId, 'Synthetic legacy correlation retry'); await processOutbox({ aggregateId: 'old-observation', limit: 1 });
  const legacyLogs = logs.filter(row => row.correlationId === oldRow.correlation_id && row.event === 'outbox_failed');
  assert.equal(legacyLogs.length, 2); assert.ok(legacyLogs.every(row => row.sourceJobId === null && row.originRequestId === null));
});

test('B52 real API failure/autosave responses log once and increment bounded daily counters; telemetry failure leaves original outcome intact', async () => {
  const marker = randomUUID();
  const failed = await fetch(`${origin}/api/v1/attempts/${marker}/answers/${canaries[2]}?token=${canaries[3]}`, { method: 'PUT', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, selectedOptionIds: [canaries[2]] }) });
  assert.equal(failed.status, 401); const requestId = failed.headers.get('x-request-id');
  const record = logs.filter(row => row.requestId === requestId && row.event === 'api_failure'); assert.equal(record.length, 1); assert.equal(record[0]!.route, '/api/v1/attempts/:id/answers');
  assert.equal((await queryOne('SELECT count FROM operational_counters WHERE metric=?', ['autosave_failure']))!.count, 1);
  // A deliberately failing trigger in this temporary DB proves an unexpected driver error is scrubbed.
  const analyticsEnv = { enabled: process.env.OT_ANALYTICS_ENABLED, retention: process.env.OT_ANALYTICS_RETENTION_DAYS };
  Object.assign(process.env, { OT_ANALYTICS_ENABLED: '1', OT_ANALYTICS_RETENTION_DAYS: '14' });
  await execute(`CREATE TEMP TRIGGER observation_fail_analytics BEFORE INSERT ON analytics_events BEGIN SELECT RAISE(ABORT,'PRIVATE_UPPERCASE_SECRET_CANARY'); END`);
  try {
    const response = await fetch(`${origin}/api/v1/analytics?token=${canaries[3]}`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', cookie: `${analyticsCookieName}=${analyticsConsentVersion}` }, body: JSON.stringify({ id: randomUUID(), name: 'program_view', dimensions: {} }) });
    assert.equal(response.status, 500); const body = await response.text(); for (const canary of canaries) assert.equal(body.includes(canary), false);
    const record = logs.find(row => row.requestId === response.headers.get('x-request-id')); assert.equal(record!.errorCode, 'SERVER_REQUEST_FAILED');
  } finally {
    await execute('DROP TRIGGER observation_fail_analytics');
    if (analyticsEnv.enabled === undefined) delete process.env.OT_ANALYTICS_ENABLED; else process.env.OT_ANALYTICS_ENABLED = analyticsEnv.enabled;
    if (analyticsEnv.retention === undefined) delete process.env.OT_ANALYTICS_RETENTION_DAYS; else process.env.OT_ANALYTICS_RETENTION_DAYS = analyticsEnv.retention;
  }
  const event = fakeEvent(`/api/v1/attempts/${randomUUID()}/answers/${canaries[2]}`);
  let writes = 0; const writer = async () => { writes++; throw new Error(canaries[1]); };
  await Promise.all([observeApiResponse(event, 409, writer), observeApiResponse(event, 409, writer)]);
  assert.equal(writes, 1); const request = eventObservation(event).context.requestId;
  assert.deepEqual(logs.filter(row => row.requestId === request).map(row => row.event), ['api_failure', 'telemetry_write_failed']);
  await observeApiResponse(fakeEvent('/api/v1/catalog/programs', 'GET'), 200, async () => { throw new Error('A success path must not write telemetry'); });
  assert.equal(currentObservation(), undefined);
});

test('B52 middleware failures use controlled JSON without raw query/token even before a domain handler', async () => {
  const requests = [
    fetch(`${origin}/api/not-a-route/${canaries[0]}?token=${canaries[3]}`),
    fetch(`${origin}/api/v1/leads?token=${canaries[3]}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://not-our-site.example' }, body: '{}' }),
    fetch(`${origin}/api/auth/sign-up/email?token=${canaries[3]}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({ value: canaries[0]!.repeat(1000) }) }),
  ];
  const expected = [404, 403, 413];
  for (const [index, response] of (await Promise.all(requests)).entries()) {
    assert.equal(response.status, expected[index]); const body = await response.text();
    for (const canary of canaries) assert.equal(body.includes(canary), false);
    const parsed = JSON.parse(body); assert.equal(parsed.url, undefined); assert.equal(parsed.stack, undefined);
    assert.equal(parsed.data.requestId, response.headers.get('x-request-id'));
  }
});
