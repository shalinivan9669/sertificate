/** T076: genuine local HTTP/log sampling. Synthetic data only; never a production-wide privacy claim. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, readFile, writeFile, cp, open, readdir } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';
import { chromium, expect } from '@playwright/test';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const base = 'http://127.0.0.1:3108';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const results = [], negativeResponses = [], observations = [];
const report = { checkedAt: new Date().toISOString(), scope: 'Local copied Node artifact, synthetic database, genuine stdout/stderr and selected negative HTTP responses. Successful owner auth/learning bodies excluded from negative response scan. No real providers, SMTP, hosted/CDN logs or production data.', results, observations, failures: [], externalDelivery: false };
const marker = randomBytes(12).toString('hex');
const canaries = {
  name: `PRIVATE PERSON ${marker}`, email: `private-${marker}@example.test`, phone: `+7${String(parseInt(marker.slice(0, 10), 16)).padStart(10, '0').slice(-10)}`,
  password: `PRIVATE-PASSWORD-${randomBytes(24).toString('base64url')}`, answer: `PRIVATE-ANSWER-${marker}`,
  verificationToken: randomBytes(32).toString('base64url'), unknownKey: `PRIVATE_FIELD_${marker}`,
  sqlMessage: `PRIVATE_SQL_${marker}`, jobType: `PRIVATE_JOB_${marker}`, forgedRequestId: `PRIVATE_REQUEST_${marker}`,
  authSecret: randomBytes(48).toString('base64url'), cronSecret: randomBytes(48).toString('base64url'),
};
let directory, output, server, browser, db;
let stdout = '', stderr = '', cookie = '';
function childPath(parent, path) { const rel = relative(parent, resolve(path)); assert.ok(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), 'Exclusive child path required'); }
function pass(name, details = {}) { results.push({ name, status: 'passed', ...details }); console.log(JSON.stringify({ check: name, passed: true })); }
function scan(text) { return Object.entries(canaries).filter(([, value]) => text.includes(value) || text.includes(encodeURIComponent(value))).map(([name]) => name); }
const digest = value => createHash('sha256').update(value).digest('hex');
const row = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
async function stopChild() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const stopped = once(server, 'exit'); server.kill();
  await Promise.race([stopped, new Promise(done => setTimeout(done, 5000))]);
  if (server.exitCode === null) { server.kill('SIGKILL'); await stopped; }
}
async function startRuntime(copy, env) {
  server = spawn(process.execPath, [join(copy, 'server/index.mjs')], { cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => { stdout += data; }); server.stderr.on('data', data => { stderr += data; });
  const deadline = Date.now() + 30000; let ready = false;
  while (Date.now() < deadline && !ready) {
    assert.equal(server.exitCode, null, 'Owned runtime must remain running'); assert.equal(server.signalCode, null);
    try { const response = await request('/api/ready'); ready = response.ok && (await response.json()).status === 'ready'; } catch { /* bounded cold start */ }
    if (!ready) await new Promise(done => setTimeout(done, 200));
  }
  assert.equal(ready, true);
}
async function request(path, { method = 'GET', data, headers = {}, authenticated = false } = {}) {
  return fetch(base + path, { method, headers: { Origin: base, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authenticated ? { Cookie: cookie } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
async function success(path, options, expected = 200) {
  const response = await request(path, options); assert.equal(response.status, expected, 'Synthetic setup request must succeed');
  return { body: await response.json(), requestId: response.headers.get('x-request-id') };
}
async function negative(name, path, expected, options = {}) {
  const response = await request(path, options); const body = await response.text(); const requestId = response.headers.get('x-request-id');
  negativeResponses.push({ name, status: response.status, requestId, body, headers: Object.fromEntries(response.headers) });
  assert.equal(response.status, expected, `${name}: expected status`); assert.match(requestId || '', uuid, 'Server-generated request UUID required');
  assert.deepEqual(scan(body), [], `${name}: private input appeared in error body`);
  pass(name, { status: response.status, requestId, bodySha256: digest(body) }); return requestId;
}

try {
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.OT_ALLOW_PRIVACY_AUDIT, '1');
  assert.ok(!['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key]), 'Remote/provider environments forbidden');
  assert.equal(process.argv.length, 3, 'Supply only a completed local Node artifact-output directory');
  const artifact = await realpath(resolve(process.argv[2]));
  const build = JSON.parse(await readFile(join(artifact, 'public/_nuxt/builds/latest.json'), 'utf8')); assert.match(build.id, uuid);
  await readFile(join(artifact, 'server/index.mjs'));
  report.buildId = build.id;
  const parent = join(root, '.data'); await mkdir(parent, { recursive: true }); assert.equal((await realpath(parent)).toLowerCase(), parent.toLowerCase());
  directory = await mkdtemp(join(parent, 'privacy-runtime-')); childPath(parent, directory);
  const runId = randomUUID(); output = join(root, 'artifacts/privacy-runtime', runId); await mkdir(output, { recursive: true });
  report.privateDirectory = relative(root, directory).replaceAll('\\', '/');
  await writeFile(join(directory, 'SYNTHETIC-ONLY.json'), JSON.stringify({ runId, notice: 'NEW SYNTHETIC LOCAL DB AND COPIED ARTIFACT ONLY' }), { flag: 'wx', mode: 0o600 });
  const copy = join(directory, 'app-output'); childPath(directory, copy);
  await cp(artifact, copy, { recursive: true, errorOnExist: true, force: false, dereference: true });
  const migrations = join(directory, 'migrations'); await mkdir(migrations);
  const migrationNames = (await readdir(join(root, 'server/db/migrations'))).filter(name => /^\d+[-_].*\.sql$/.test(name)).sort();
  assert.ok(migrationNames.some(name => name.startsWith('010-')), 'Observability migration must exist before this audit');
  for (const name of migrationNames) await cp(join(root, 'server/db/migrations', name), join(migrations, name), { errorOnExist: true, force: false });
  report.migrations = migrationNames;
  const databasePath = join(directory, 'e2e.sqlite'); const reserved = await open(databasePath, 'wx', 0o600); await reserved.close();
  const fixturePath = join(directory, 'fixture.json');
  const env = { ...process.env, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', OT_DATABASE_PATH: databasePath, OT_E2E_FIXTURE_PATH: fixturePath,
    OT_MIGRATIONS_DIR: migrations, BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base, BETTER_AUTH_SECRET: canaries.authSecret, CRON_SECRET: canaries.cronSecret,
    HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', PORT: '3108', NITRO_PORT: '3108', OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled', OT_INVOICE_ENABLED: '0', OT_ANALYTICS_ENABLED: '0', OT_ANALYTICS_RETENTION_DAYS: '14' };
  for (const key of Object.keys(env)) if (/^(?:SMTP_|MAIL_FROM$|AMO_|TURSO_|VERCEL|OT_SANDBOX_|OT_ALERT_EMAIL$|OT_INVOICE_ISSUER_JSON$|OT_BUILD_MODE$|NITRO_UNIX_SOCKET$|NITRO_SSL_)/.test(key)) delete env[key];
  const probe = createServer(); probe.listen(3108, '127.0.0.1'); await once(probe, 'listening'); await new Promise(done => probe.close(done));
  const seed = spawn(process.execPath, ['--import', 'tsx', 'tests/e2e-fixtures.ts'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let seedLog = ''; seed.stdout.on('data', data => { seedLog += data; }); seed.stderr.on('data', data => { seedLog += data; });
  const [seedCode] = await once(seed, 'exit'); await writeFile(join(directory, 'seed-private.log'), seedLog, { flag: 'wx', mode: 0o600 }); assert.equal(seedCode, 0, 'Private fixture setup must pass');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')); assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY'); assert.equal(fixture.databasePath, databasePath);
  db = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}`, concurrency: 1 });
  await db.execute({ sql: 'UPDATE "user" SET name=?,email=? WHERE id=?', args: [canaries.name, canaries.email, fixture.learner.id] });
  await db.execute({ sql: 'UPDATE account SET password=? WHERE userId=?', args: [await hashPassword(canaries.password), fixture.learner.id] });
  await startRuntime(copy, env); assert.equal((await success('/_nuxt/builds/latest.json')).body.id, build.id);
  pass('isolated-copied-artifact-and-current-schema-ready', { buildId: build.id });
  const disabledConfig = (await success('/api/v1/analytics/config')).body; assert.equal(disabledConfig.enabled, false);
  const disabledEvent = await success('/api/v1/analytics', { method: 'POST', headers: { Cookie: 'ot_analytics_consent=analytics-v2' }, data: { id: randomUUID(), name: 'program_view', dimensions: { programId: 'ohrana-truda', locale: 'ru' } } });
  assert.equal(disabledEvent.body.accepted, false); assert.equal(disabledEvent.body.reason, 'disabled');
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events')).n), 0);
  pass('default-disabled-analytics-does-not-store-even-with-consent');
  const authJourneyId = randomUUID();
  const authJourneyEvent = { id: randomUUID(), journeyId: authJourneyId, sequence: 1, step: 'auth_start', context: { routeId: 'auth_login', locale: 'ru', source: 'internal' } };
  for (const [path, data] of [['/api/v1/analytics/journey', authJourneyEvent], ['/api/v1/analytics/journey/authenticated', { journeyId: authJourneyId }]]) {
    const disabled = await success(path, { method: 'POST', headers: { Cookie: 'ot_analytics_consent=analytics-v2' }, data });
    assert.deepEqual(disabled.body, { accepted: false, reason: 'disabled' });
  }
  assert.equal(Number((await row('SELECT COUNT(*) n FROM public_journeys')).n), 0);
  pass('disabled-journey-and-auth-proof-do-not-require-session-or-store-data');
  await negative('disabled-analytics-still-rejects-private-dimensions', '/api/v1/analytics', 400, {
    method: 'POST', headers: { Cookie: 'ot_analytics_consent=analytics-v2' },
    data: { id: randomUUID(), name: 'program_view', dimensions: { programId: 'ohrana-truda', email: canaries.email, answer: canaries.answer } },
  });
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events')).n), 0);

  // Successful owner responses legitimately contain identity and session data. Only keep those in memory.
  const signedIn = await request('/api/auth/sign-in/email', { method: 'POST', data: { email: canaries.email, password: canaries.password, rememberMe: false } });
  assert.equal(signedIn.status, 200); cookie = signedIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); assert.ok(cookie.includes('session_token='));
  const signedInBody = await signedIn.json();
  for (const [key, value] of [['sessionToken', signedInBody.token], ['sessionCookie', cookie]]) if (typeof value === 'string' && value.length >= 16) canaries[key] = value;
  pass('normal-http-auth-kept-private', { successfulAuthBodyExcluded: true });
  const enrolled = await success('/api/v1/enrollments', { authenticated: true, method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, data: { versionId: fixture.versionId } });
  const enrollmentId = enrolled.body.enrollment.id;
  await success(`/api/v1/enrollments/${enrollmentId}/progress/${fixture.lessonId}`, { authenticated: true, method: 'PUT', data: { revision: 0, completed: true } });
  const attempt = (await success(`/api/v1/enrollments/${enrollmentId}/attempts`, { authenticated: true, method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, data: {} })).body;
  const attemptId = attempt.attempt?.id || attempt.id;
  const liveAttempt = (await success('/api/v1/attempts/' + attemptId, { authenticated: true })).body;
  const attemptDto = liveAttempt.attempt || liveAttempt;
  assert.equal(JSON.stringify(attemptDto).includes('correctOptionIds'), false, 'Owner attempt DTO must still exclude answer keys');
  const questionId = attemptDto.questions[0].id;

  const spoofedHeaders = { 'X-Request-Id': canaries.forgedRequestId, 'X-Correlation-Id': canaries.verificationToken, Authorization: `Bearer ${canaries.password}` };
  await negative('unknown-api-path-query-and-spoofed-identifiers', `/api/v1/private-${marker}?email=${encodeURIComponent(canaries.email)}&token=${canaries.verificationToken}`, 404, { authenticated: true, headers: spoofedHeaders });
  await negative('middleware-unknown-api-path', `/api/private-${marker}?token=${canaries.verificationToken}&email=${encodeURIComponent(canaries.email)}`, 404, { headers: spoofedHeaders });
  const forgedUuid = randomUUID();
  const parallelIds = await Promise.all(['a', 'b'].map(suffix => negative(`concurrent-request-isolation-${suffix}`, `/api/v1/catalog/programs/private-${marker}-${suffix}`, 404, { headers: { 'X-Request-Id': forgedUuid, 'X-Correlation-Id': forgedUuid } })));
  assert.equal(new Set(parallelIds).size, 2); assert.ok(parallelIds.every(id => id !== forgedUuid));
  pass('concurrent-errors-ignore-even-well-formed-caller-correlation-uuid');
  await negative('unknown-verification-token', `/api/v1/verify/${canaries.verificationToken}?email=${encodeURIComponent(canaries.email)}`, 404);
  await negative('wrong-auth-credentials', '/api/auth/sign-in/email', 401, { method: 'POST', data: { email: canaries.email, password: canaries.password + '-wrong' }, headers: spoofedHeaders });
  await negative('oversized-auth-body', '/api/auth/sign-up/email', 413, { method: 'POST', data: { name: canaries.name, email: canaries.email, password: canaries.password, padding: canaries.answer.repeat(1000) } });
  await negative('cross-site-request', '/api/v1/analytics', 403, { method: 'POST', data: { email: canaries.email }, headers: { Origin: `https://${marker}.example.test`, 'Sec-Fetch-Site': 'cross-site' } });
  await negative('middleware-rejects-non-json-content', '/api/v1/analytics', 415, { method: 'POST', data: { email: canaries.email }, headers: { 'Content-Type': 'text/plain' } });
  await negative('invalid-autosave-answer', `/api/v1/attempts/${attemptId}/answers/${questionId}`, 400, { authenticated: true, method: 'PUT', data: { revision: attemptDto.revision, selectedOptionIds: [canaries.answer] }, headers: spoofedHeaders });
  await negative('unknown-autosave-json-key', `/api/v1/attempts/${attemptId}/answers/${questionId}`, 400, { authenticated: true, method: 'PUT', data: { revision: attemptDto.revision, selectedOptionIds: [], [canaries.unknownKey]: canaries.answer } });

  const streamed = await new Promise((done, reject) => {
    const req = httpRequest(base + '/api/v1/analytics', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, response => {
      let body = ''; response.on('data', data => { body += data; }); response.on('end', () => done({ status: response.statusCode, requestId: response.headers['x-request-id'], body }));
    });
    req.on('error', reject); req.write('{"private":"'); req.write(canaries.answer.repeat(2000)); req.end('"}');
  });
  negativeResponses.push({ name: 'streamed-body-limit', ...streamed }); assert.equal(streamed.status, 413); assert.deepEqual(scan(streamed.body), []); pass('streamed-body-limit', { status: streamed.status, requestId: streamed.requestId });

  // A genuine SQLite failure only in this new QA database: no application debug endpoint or provider.
  await db.execute(`CREATE TRIGGER privacy_audit_sql_failure BEFORE INSERT ON lead_submissions BEGIN SELECT RAISE(ABORT,'${canaries.sqlMessage}'); END`);
  try { await negative('genuine-database-5xx-redacts-private-diagnostic', '/api/amo-lead', 500, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, data: { email: canaries.email, phone: canaries.phone, name: canaries.name, comment: canaries.answer } }); }
  finally { await db.execute('DROP TRIGGER privacy_audit_sql_failure'); }

  const lead = await success('/api/amo-lead', { method: 'POST', headers: { ...spoofedHeaders, 'Idempotency-Key': randomUUID() }, data: { name: canaries.name, email: canaries.email, phone: canaries.phone, comment: canaries.answer, sourcePath: '/contacts', consentVersion: 'synthetic-privacy-audit' } }, 202);
  assert.match(lead.requestId, uuid);
  const audit = await row("SELECT request_id,correlation_id FROM audit_events WHERE action='lead_accepted' AND target=?", [lead.body.submissionId]);
  const job = await row('SELECT id,request_id,correlation_id FROM outbox WHERE aggregate_id=?', [lead.body.submissionId]);
  assert.equal(audit.request_id, lead.requestId); assert.equal(job.request_id, lead.requestId); assert.equal(job.correlation_id, audit.correlation_id); assert.match(job.correlation_id, uuid);
  // Unsupported synthetic handler gives a genuine worker failure while retaining original HTTP correlation.
  await db.execute({ sql: 'UPDATE outbox SET type=?,payload_json=? WHERE id=?', args: [canaries.jobType, JSON.stringify(canaries), job.id] });
  const tick = await success('/api/v1/operations/tick', { headers: { Authorization: `Bearer ${canaries.cronSecret}` } });
  assert.ok(tick.body.results.some(result => result.id === job.id && ['pending', 'failed'].includes(result.status)));
  assert.deepEqual(scan(JSON.stringify(tick.body)), []);
  pass('lead-http-audit-outbox-correlation-and-genuine-worker-failure', { requestId: lead.requestId, correlationId: job.correlation_id, jobId: job.id });
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events')).n), 0, 'Disabled feature must suppress both client and server analytics collection');
  pass('disabled-analytics-remains-empty-after-real-domain-transitions');
  // Restart only our own copied runtime with explicit local test analytics settings.
  await stopChild(); await startRuntime(copy, { ...env, OT_ANALYTICS_ENABLED: '1' });
  const enabledConfig = (await success('/api/v1/analytics/config')).body;
  assert.equal(enabledConfig.enabled, true); assert.equal(enabledConfig.consentVersion, 'analytics-v2'); assert.equal(enabledConfig.retentionDays, 14);
  const noConsentEvent = await success('/api/v1/analytics', { method: 'POST', data: { id: randomUUID(), name: 'program_view', dimensions: { programId: 'ohrana-truda', locale: 'ru' } } });
  assert.equal(noConsentEvent.body.accepted, false); assert.equal(noConsentEvent.body.reason, 'consent_required');
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events')).n), 0);
  pass('enabled-analytics-requires-separate-client-consent');
  for (const consent of ['', 'ot_analytics_consent=analytics-v1']) {
    const response = await success('/api/v1/analytics/journey/authenticated', { method: 'POST', headers: { Cookie: consent }, data: { journeyId: authJourneyId } });
    assert.deepEqual(response.body, { accepted: false, reason: 'consent_required' });
  }
  pass('journey-auth-proof-requires-current-consent-before-session-access');
  const journeyHeaders = { Cookie: 'ot_analytics_consent=analytics-v2' };
  await negative('journey-context-rejects-private-query-and-contact-fields', '/api/v1/analytics/journey', 400, {
    method: 'POST', headers: journeyHeaders, data: { ...authJourneyEvent, context: { ...authJourneyEvent.context, email: canaries.email, returnTo: canaries.verificationToken } },
  });
  await negative('journey-rejects-client-forged-auth-confirmation', '/api/v1/analytics/journey', 400, {
    method: 'POST', headers: journeyHeaders, data: { ...authJourneyEvent, step: 'auth_confirmed', auth_confirmed_at: canaries.answer },
  });
  await negative('journey-auth-proof-rejects-private-extra-fields', '/api/v1/analytics/journey/authenticated', 400, {
    method: 'POST', headers: journeyHeaders, data: { journeyId: authJourneyId, email: canaries.email, sessionToken: canaries.sessionToken },
  });
  const authStart = await success('/api/v1/analytics/journey', { method: 'POST', headers: journeyHeaders, data: authJourneyEvent });
  assert.equal(authStart.body.accepted, true);
  await negative('journey-auth-proof-requires-actual-session', '/api/v1/analytics/journey/authenticated', 401, {
    method: 'POST', headers: journeyHeaders, data: { journeyId: authJourneyId },
  });
  assert.equal((await row('SELECT auth_confirmed_at FROM public_journeys WHERE id=?', [authJourneyId])).auth_confirmed_at, null);
  const proofOptions = { method: 'POST', headers: { Cookie: cookie + '; ot_analytics_consent=analytics-v2' }, data: { journeyId: authJourneyId } };
  assert.equal((await success('/api/v1/analytics/journey/authenticated', proofOptions)).body.accepted, true);
  const confirmed = await row('SELECT * FROM public_journeys WHERE id=?', [authJourneyId]);
  assert.ok(Number.isFinite(Date.parse(confirmed.auth_confirmed_at)));
  assert.deepEqual(scan(JSON.stringify(confirmed)), []);
  assert.equal((await success('/api/v1/analytics/journey/authenticated', proofOptions)).body.accepted, true);
  assert.equal((await row('SELECT auth_confirmed_at FROM public_journeys WHERE id=?', [authJourneyId])).auth_confirmed_at, confirmed.auth_confirmed_at);
  pass('actual-session-confirms-one-stable-timestamp-without-account-or-session-fields');
  const acceptedLeadKey = randomUUID();
  const privateLead = { name: canaries.name, email: canaries.email, phone: canaries.phone, comment: canaries.answer, city: canaries.name, programId: 'ohrana-truda', sourcePath: '/contacts', consentVersion: 'synthetic-privacy-audit' };
  const operationalLead = await success('/api/amo-lead', { method: 'POST', headers: { 'Idempotency-Key': acceptedLeadKey }, data: privateLead }, 202);
  const operationalRetry = await success('/api/amo-lead', { method: 'POST', headers: { 'Idempotency-Key': acceptedLeadKey }, data: privateLead }, 202);
  assert.equal(operationalRetry.body.submissionId, operationalLead.body.submissionId);
  const projected = await db.execute("SELECT id,name,dimensions_json FROM analytics_events WHERE name='lead_accepted'");
  assert.equal(projected.rows.length, 1); assert.match(projected.rows[0].id, /^server:[a-f0-9]{64}$/);
  assert.deepEqual(scan(JSON.stringify(projected.rows)), []);
  const projectedDimensions = JSON.parse(projected.rows[0].dimensions_json);
  assert.equal(projectedDimensions.programId, 'ohrana-truda'); assert.equal(projectedDimensions.city, undefined);
  pass('actual-server-lead-event-excludes-contact-free-text-and-deduplicates', { serverEvents: 1, separatePopulation: 'confirmed_service_transitions' });

  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || chromium.executablePath(), headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const clientEvents = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/analytics') clientEvents.push(request.postDataJSON());
  });
  async function openPage(path) {
    const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' }); assert.equal(response.status(), 200);
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__), { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  }
  await openPage('/courses/ohrana-truda'); await openPage('/program-selection');
  assert.equal(clientEvents.length, 0); assert.equal(Number((await row("SELECT COUNT(*) n FROM analytics_events WHERE id NOT LIKE 'server:%'")).n), 0);
  pass('actual-program-and-selection-pages-collect-no-client-events-before-opt-in');
  await openPage('/privacy');
  await page.getByRole('button', { name: 'Разрешить статистику', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Отозвать согласие на статистику', exact: true })).toBeVisible();
  const consentCookie = (await context.cookies()).find(value => value.name === 'ot_analytics_consent');
  assert.equal(consentCookie?.value, 'analytics-v2'); assert.equal(clientEvents.length, 0, 'Consent itself is not a product analytics event');
  const programEventResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/analytics');
  await openPage('/courses/ohrana-truda');
  const programEvent = await programEventResponse; assert.equal(programEvent.status(), 200); assert.equal((await programEvent.json()).accepted, true);
  const event = clientEvents.find(value => value.name === 'program_view'); assert.ok(event); assert.match(event.id, uuid);
  assert.ok(Object.keys(event).every(key => ['id', 'name', 'dimensions'].includes(key)));
  assert.equal(event.dimensions.programId, 'ohrana-truda'); assert.deepEqual(scan(JSON.stringify(clientEvents)), []);
  const stored = await row('SELECT dimensions_json FROM analytics_events WHERE id=?', [event.id]); assert.ok(stored); assert.deepEqual(scan(stored.dimensions_json), []);
  const repeated = await page.evaluate(async event => {
    const response = await fetch('/api/v1/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }); return { status: response.status, body: await response.json() };
  }, event);
  assert.equal(repeated.status, 200); assert.equal(repeated.body.accepted, true);
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events WHERE id=?', [event.id])).n), 1);
  pass('explicit-browser-opt-in-emits-minimal-program-view-and-stable-retry-deduplicates', { eventName: event.name, clientEvents: clientEvents.length });
  await openPage('/privacy'); await page.getByRole('button', { name: 'Отозвать согласие на статистику', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Разрешить статистику', exact: true })).toBeVisible();
  const beforeRevisit = clientEvents.length; await openPage('/courses/ohrana-truda'); assert.equal(clientEvents.length, beforeRevisit);
  pass('revoking-browser-analytics-consent-stops-subsequent-program-events');
  const eventId = randomUUID();
  const analytics = await page.evaluate(async ({ eventId, email, answer, verificationToken }) => {
    const response = await fetch('/api/v1/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: eventId, name: 'program_view', dimensions: { programId: 'ohrana-truda', email, answer, verificationToken } }) });
    return { status: response.status, requestId: response.headers.get('x-request-id'), body: await response.text() };
  }, { eventId, email: canaries.email, answer: canaries.answer, verificationToken: canaries.verificationToken });
  negativeResponses.push({ name: 'browser-analytics-private-dimensions', ...analytics }); assert.equal(analytics.status, 400); assert.deepEqual(scan(analytics.body), []);
  assert.equal(Number((await row('SELECT COUNT(*) n FROM analytics_events WHERE id IN (?,?)', [eventId, `client:${eventId}`])).n), 0);
  pass('browser-origin-analytics-rejects-private-dimensions-before-storage', { status: analytics.status, rejectedRows: 0, requestId: analytics.requestId });
  await browser.close(); browser = undefined;
  let apiErrors = 0, autosaveErrors = 0;
  for (let tries = 0; tries < 20; tries++) {
    apiErrors = Number((await row("SELECT COALESCE(SUM(count),0) n FROM operational_counters WHERE metric='api_error'")).n);
    autosaveErrors = Number((await row("SELECT COALESCE(SUM(count),0) n FROM operational_counters WHERE metric='autosave_failure'")).n);
    if (apiErrors >= negativeResponses.length && autosaveErrors >= 2) break;
    await new Promise(done => setTimeout(done, 100));
  }
  report.counterSamples = { apiErrors, selectedNegativeResponses: negativeResponses.length, autosaveErrors };
  assert.ok(apiErrors >= negativeResponses.length, 'Every selected failed HTTP response must increment api_error');
  assert.ok(autosaveErrors >= 2, 'Both rejected autosaves must increment autosave_failure');
  pass('real-api-and-autosave-failure-counters-recorded', { apiErrors, autosaveErrors });
  await stopChild();

  assert.deepEqual(scan(stdout + stderr), [], 'Private canary appeared in actual runtime output');
  const lines = (stdout + '\n' + stderr).split(/\r?\n/).filter(Boolean); const records = [];
  for (const line of lines) {
    if (line.startsWith('Listening on http://127.0.0.1:3108')) continue;
    let parsed; try { parsed = JSON.parse(line); } catch { observations.push({ kind: 'unstructured-runtime-line', sha256: digest(line) }); continue; }
    records.push(parsed);
  }
  assert.ok(records.some(record => record.event === 'api_failure'), 'Real API failure JSON must be present');
  const worker = records.find(record => record.event === 'outbox_failed' && record.sourceJobId === job.id);
  assert.ok(worker, 'Worker failure must be observable'); assert.equal(worker.correlationId, job.correlation_id); assert.equal(worker.originRequestId, lead.requestId);
  for (const record of records) for (const key of ['requestId', 'correlationId', 'originRequestId', 'sourceJobId']) if (record[key] !== undefined && record[key] !== null) assert.match(record[key], uuid, 'Only generated UUID correlation identifiers may appear in logs');
  const logKeys = new Set(['schemaVersion', 'event', 'requestId', 'correlationId', 'originRequestId', 'sourceJobId', 'route', 'method', 'status', 'errorCode', 'elapsedMs']);
  const events = new Set(['api_failure', 'outbox_delivered', 'outbox_cancelled', 'outbox_failed', 'telemetry_write_failed']);
  const routes = new Set(['/api/:unmatched', '/api/v1/attempts/:id/answers', '/api/v1/attempts/:id', '/api/v1/enrollments/:id', '/api/v1/verify/:token', '/api/v1/orders/:id', '/api/v1/credentials/:id', '/api/v1/organizations/:id', '/api/v1/admin/:operation', '/api/v1/me/:resource', '/api/auth/:operation', '/api/leads', '/api/v1/payments/webhook', '/api/v1/operations/tick', '/api/v1/analytics', '/api/v1/catalog/programs/:id', '/api/health', '/api/ready']);
  routes.add('/api/v1/analytics/journey'); routes.add('/api/v1/analytics/journey/authenticated');
  for (const record of records) {
    assert.equal(record.schemaVersion, 1); assert.ok(events.has(record.event)); assert.ok(Object.keys(record).every(key => logKeys.has(key)), 'Runtime log fields must use the closed schema');
    if (record.route !== undefined) assert.ok(routes.has(record.route), 'Runtime route must be a fixed template');
    if (record.elapsedMs !== undefined) assert.ok(Number.isInteger(record.elapsedMs) && record.elapsedMs >= 0 && record.elapsedMs <= 3600000);
    if (record.event === 'api_failure') {
      const expected = ({ 401: 'AUTHENTICATION_REQUIRED', 403: 'ACCESS_DENIED', 404: 'RESOURCE_NOT_FOUND', 409: 'STATE_CONFLICT', 413: 'BODY_TOO_LARGE', 429: 'RATE_LIMITED' })[record.status] || (record.status >= 500 ? 'SERVER_REQUEST_FAILED' : 'REQUEST_REJECTED');
      assert.equal(record.errorCode, expected); assert.equal(record.correlationId, record.requestId); assert.equal(record.originRequestId, record.requestId); assert.equal(record.sourceJobId, null);
    } else if (record.event === 'telemetry_write_failed') assert.equal(record.errorCode, 'OBSERVATION_UNAVAILABLE');
    else if (record.event === 'outbox_delivered') assert.equal(record.errorCode, 'DELIVERED');
    else if (record.event === 'outbox_cancelled') assert.equal(record.errorCode, 'CANCELLED');
    else assert.equal(record.errorCode, 'JOB_HANDLER_NOT_CONFIGURED', 'This fixture intentionally fails only its unsupported handler');
  }
  for (const response of negativeResponses) assert.ok(records.some(record => record.requestId === response.requestId), 'Each selected negative HTTP response must correlate to actual runtime log');
  assert.equal(observations.length, 0, 'Unexpected unstructured runtime output needs review');
  pass('actual-runtime-log-canaries-and-correlation', { records: records.length, negativeResponses: negativeResponses.length, canaryCategories: Object.keys(canaries), canaryMatches: 0, successfulOwnerResponsesExcluded: true });
  report.logSchema = [...new Set(records.flatMap(record => Object.keys(record)))].sort(); report.events = [...new Set(records.map(record => record.event))].sort();
  report.runtimeLogDigests = { stdout: digest(stdout), stderr: digest(stderr) };
} catch (error) {
  report.failures.push({ name: error?.name || 'UnknownError', code: error?.code || 'PRIVACY_AUDIT_FAILED' }); process.exitCode = 1;
  if (directory) await writeFile(join(directory, 'failure-private.log'), String(error?.stack || error), { flag: 'wx', mode: 0o600 });
} finally {
  await browser?.close(); await stopChild(); db?.close();
  if (directory) {
    await writeFile(join(directory, 'runtime-stdout-private.log'), stdout, { flag: 'wx', mode: 0o600 });
    await writeFile(join(directory, 'runtime-stderr-private.log'), stderr, { flag: 'wx', mode: 0o600 });
    await writeFile(join(directory, 'negative-network-private.json'), JSON.stringify(negativeResponses, null, 2), { flag: 'wx', mode: 0o600 });
  }
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - Date.parse(report.checkedAt);
  if (output) await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: results.length, failures: report.failures.length, elapsedMs: report.elapsedMs, report: output ? relative(root, join(output, 'report.json')).replaceAll('\\', '/') : null }));
}
