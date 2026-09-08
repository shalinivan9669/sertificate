/** Bounded HTTPS CDN isolation probe. No browser cache overrides, no redirected secrets, no production target. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeploymentAcknowledgment, deploymentBinding, previewOrigin, readFixture } from './staging-cache-fixture.ts';

const sha = value => createHash('sha256').update(value).digest('hex');
export function safeProbeFailure(error) { return { code: 'STAGING_CACHE_CHECK_FAILED', diagnosticSha256: sha(error instanceof Error ? error.stack || error.message : 'Unknown failure') }; }
export function createProbeTransport(originInput, { bypassSecret = '', fetchImpl = fetch, maximumRequests = 40, timeoutMs = 15000 } = {}) {
  const origin = previewOrigin(originInput); assert.ok(Number.isSafeInteger(maximumRequests) && maximumRequests > 0 && maximumRequests <= 48);
  const counters = { requests: 0, postRequests: 0, redirectsRejected: 0 }; const started = Date.now();
  async function request(path, jar, body) {
    const url = new URL(path, origin); assert.equal(url.origin, origin); assert.ok(path.startsWith('/') && !path.startsWith('//') && !url.search && !url.hash);
    assert.ok(Date.now() - started < 8 * 60 * 1000, 'Probe time budget exceeded'); assert.ok(counters.requests < maximumRequests, 'Probe request budget exceeded');
    if (body !== undefined) assert.ok(['/api/auth/sign-in/email', '/api/auth/sign-out'].includes(url.pathname), 'Only real auth POST operations allowed');
    else assert.match(url.pathname, /^\/(?:cabinet|api\/ready|api\/v1\/(?:auth\/config|commerce\/me|me|enrollments\/[a-f0-9-]{36}|credentials\/[a-f0-9-]{36}\/download))$/, 'Only the bounded private read endpoints are allowed');
    const headers = { accept: 'application/json,text/html,application/pdf' };
    if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret;
    if (jar.size) headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    if (body !== undefined) { headers.origin = origin; headers['content-type'] = 'application/json'; counters.postRequests++; }
    counters.requests++;
    const response = await fetchImpl(url.href, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (response.status >= 300 && response.status < 400) { counters.redirectsRejected++; await response.body?.cancel(); throw new Error('Redirect refused; deployment protection/origin must be resolved explicitly'); }
    const length = Number(response.headers.get('content-length')); assert.ok(!length || length <= 2 * 1024 * 1024, 'Response too large');
    const chunks = []; let bytes = 0;
    if (response.body) { const reader = response.body.getReader(); while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Response budget exceeded'); } chunks.push(part.value); } }
    return { status: response.status, headers: response.headers, bytes: Buffer.concat(chunks), url: url.href };
  }
  return { request, counters };
}
export function acceptAuthCookies(headers, jar) {
  let sessionCookies = 0;
  for (const raw of headers.getSetCookie()) {
    const parts = raw.split(';').map(part => part.trim()); const split = parts[0].indexOf('='); assert.ok(split > 0);
    const name = parts[0].slice(0, split), value = parts[0].slice(split + 1); const attributes = parts.slice(1).map(part => part.toLowerCase());
    if (!name.startsWith('__Secure-better-auth.') && !name.startsWith('better-auth.')) continue;
    assert.ok(attributes.includes('httponly') && attributes.includes('secure') && attributes.includes('samesite=lax'));
    assert.ok(!attributes.some(attribute => attribute.startsWith('domain=')) && attributes.includes('path=/'));
    if (value) jar.set(name, value); else jar.delete(name);
    if (name.endsWith('.session_token') && value) sessionCookies++;
  }
  assert.ok(sessionCookies >= 1, 'Real secure server session cookie required'); return sessionCookies;
}
export function privateResponseMetadata(response) {
  const cache = response.headers.get('cache-control') || ''; const robots = response.headers.get('x-robots-tag') || '';
  assert.ok(/(?:^|,)\s*private(?:\s*,|$)/i.test(cache) && /(?:^|,)\s*no-store(?:\s*,|$)/i.test(cache), 'Private no-store required');
  assert.ok(/noindex/i.test(robots), 'Private noindex required');
  assert.equal((response.headers.get('server') || '').toLowerCase(), 'vercel', 'Actual Vercel response required');
  const rawCache = (response.headers.get('x-vercel-cache') || '').toUpperCase();
  assert.ok(['', 'MISS', 'BYPASS', 'DYNAMIC'].includes(rawCache), 'Shared cache HIT/STALE refused');
  const ageRaw = response.headers.get('age'); const age = ageRaw === null ? null : Number(ageRaw); assert.ok(age === null || age === 0, 'Private response cannot have positive cache age');
  const rawEdge = response.headers.get('x-vercel-id') || ''; assert.match(rawEdge, /^[a-z0-9]+(?:::[a-z0-9]+)*::[A-Za-z0-9-]+$/);
  return { status: response.status, privateNoStore: true, noindex: true, vercel: true, cacheState: rawCache || 'unreported', age, edge: rawEdge.split('::').slice(0, -1).join('::'), bytes: response.bytes.length, sha256: sha(response.bytes) };
}

export async function runStagingCacheCheck(directory, expectedOrigin, env = process.env, fetchImpl = fetch) {
  assert.equal(env.OT_APP_ENV, 'staging'); assert.equal(env.OT_ALLOW_STAGING_CACHE_CHECK, '1'); assert.ok(!env.VERCEL && !env.VERCEL_ENV);
  assertDeploymentAcknowledgment(env);
  const fixture = await readFixture(directory); const origin = previewOrigin(expectedOrigin); assert.equal(origin, fixture.origin);
  const imported = JSON.parse(await readFile(resolve(directory, 'import-report.json'), 'utf8')); assert.equal(imported.status, 'passed'); assert.equal(imported.runId, fixture.runId);
  assert.deepEqual(imported.deploymentBinding, deploymentBinding); assert.equal(imported.expectedHost, deploymentBinding.tursoHostname);
  assert.equal(imported.fixtureSha256, sha(await readFile(resolve(directory, 'fixture-private.json'))));
  assert.equal(imported.preparationFingerprint, fixture.preparationSource.fingerprint);
  const id = randomUUID(); const output = resolve('artifacts/staging-cache', id); await mkdir(output, { recursive: true });
  const privatePath = resolve(directory, `probe-${id}-private.log`);
  const transport = createProbeTransport(origin, { bypassSecret: env.OT_STAGING_CACHE_VERCEL_BYPASS || '', fetchImpl });
  const report = { format: 'ot-staging-cache-probe-v1', runId: fixture.runId, startedAt: new Date().toISOString(), origin, deploymentBinding, bindingVerification: 'Operator-observed deployment/source/database mapping; stable alias must still resolve to this deployment when invoked.', preparationFingerprint: fixture.preparationSource.fingerprint, deploymentProtectionBypassUsed: Boolean(env.OT_STAGING_CACHE_VERCEL_BYPASS), scope: 'One explicitly selected Vercel preview deployment/observed edge; synthetic accounts and private TEST PDF only. A protection bypass, when configured, is reported; results cover those requests and do not prove behavior of requests without that header. No production identity or global CDN claim.', checks: [], requests: [], status: 'running', failure: null, externalDelivery: false };
  const jars = [new Map(), new Map(), new Map()]; const labels = ['owner', 'other', 'anonymous'];
  const loggedOut = new Set();
  const bodyText = response => response.bytes.toString('utf8');
  const noOther = (text, indexes) => { for (const index of indexes) for (const value of [fixture.learners[index].id, fixture.learners[index].email, fixture.learners[index].name]) assert.ok(!text.includes(value), 'Private identity canary must not cross account boundary'); };
  const observe = (label, kind, response) => report.requests.push({ actor: label, kind, ...privateResponseMetadata(response) });
  try {
    const ready = await transport.request('/api/ready', jars[2]); assert.equal(ready.status, 200); assert.equal(JSON.parse(bodyText(ready)).status, 'ready');
    const configuration = await transport.request('/api/v1/auth/config', jars[2]); assert.equal(configuration.status, 200); const auth = JSON.parse(bodyText(configuration)); assert.equal(auth.available, true); assert.equal(auth.emailDeliveryConfigured, false);
    for (const index of [0, 1]) {
      const learner = fixture.learners[index]; const response = await transport.request('/api/auth/sign-in/email', jars[index], { email: learner.email, password: learner.password, rememberMe: false });
      assert.equal(response.status, 200); acceptAuthCookies(response.headers, jars[index]);
    }
    assert.notDeepEqual([...jars[0]], [...jars[1]], 'Independent users require distinct sessions');
    for (const index of [0, 1]) { const commerce = await transport.request('/api/v1/commerce/me', jars[index]); assert.equal(commerce.status, 200); assert.equal(JSON.parse(bodyText(commerce)).paymentProvider, 'disabled'); }
    report.checks.push('two-real-Better-Auth-sessions; email and payments disabled');
    // Identical URLs and normal request headers; second round reverses warming order.
    for (const order of [[0, 1, 2], [2, 1, 0]]) for (const index of order) {
      const jar = jars[index], label = labels[index];
      const me = await transport.request('/api/v1/me', jar); observe(label, 'identity-json', me);
      if (index < 2) { assert.equal(me.status, 200); assert.equal(JSON.parse(bodyText(me)).user.id, fixture.learners[index].id); noOther(bodyText(me), [1 - index]); }
      else { assert.equal(me.status, 401); noOther(bodyText(me), [0, 1]); }
      const html = await transport.request('/cabinet', jar); observe(label, 'private-html', html); assert.equal(html.status, 200);
      if (index < 2) { assert.ok(bodyText(html).includes(fixture.learners[index].name), 'SSR must contain the authenticated owner canary'); noOther(bodyText(html), [1 - index]); }
      else noOther(bodyText(html), [0, 1]);
      const entity = await transport.request('/api/v1/enrollments/' + fixture.enrollmentId, jar); observe(label, 'private-entity-json', entity);
      if (index === 0) { assert.equal(entity.status, 200); assert.equal(JSON.parse(bodyText(entity)).id, fixture.enrollmentId); }
      else { assert.equal(entity.status, index === 1 ? 404 : 401); noOther(bodyText(entity), [0, 1]); }
      const pdf = await transport.request('/api/v1/credentials/' + fixture.credentialId + '/download', jar); observe(label, 'private-test-pdf', pdf);
      if (index === 0) { assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type') || '', /^application\/pdf/); assert.equal(sha(pdf.bytes), fixture.pdfSha256); }
      else { assert.equal(pdf.status, index === 1 ? 404 : 401); assert.ok(!bodyText(pdf).includes('%PDF-')); noOther(bodyText(pdf), [0, 1]); }
    }
    report.checks.push('owner-other-anonymous and reverse order preserve private HTML/JSON/PDF isolation on identical URLs');
    for (const index of [0, 1]) { const logout = await transport.request('/api/auth/sign-out', jars[index], {}); assert.equal(logout.status, 200); loggedOut.add(index); const revoked = await transport.request('/api/v1/me', jars[index]); assert.equal(revoked.status, 401); observe(labels[index], 'revoked-session-json', revoked); }
    report.checks.push('both real sessions revoked; replayed old cookies rejected'); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = safeProbeFailure(error); await writeFile(privatePath, error instanceof Error ? error.stack || error.message : 'Unknown failure', { flag: 'wx', mode: 0o600 });
  } finally {
    for (const index of [0, 1]) if (jars[index].size && !loggedOut.has(index)) {
      try { if ((await transport.request('/api/auth/sign-out', jars[index], {})).status === 200) loggedOut.add(index); } catch { /* Record incomplete cleanup; never follow a redirect or bypass request limits. */ }
    }
    report.sessionCleanup = { successfulLogouts: loggedOut.size, remoteResourceDeletionPerformed: false };
    for (const jar of jars) jar.clear(); report.finishedAt = new Date().toISOString(); report.requestCounts = { ...transport.counters };
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  }
  return { status: report.status, checks: report.checks.length, requests: report.requestCounts.requests, report: resolve(output, 'report.json'), failure: report.failure };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const [directory, origin] = process.argv.slice(2); assert.ok(directory && origin); const result = await runStagingCacheCheck(directory, origin); console.log(JSON.stringify(result)); if (result.status !== 'passed') process.exitCode = 1; }
  catch (error) { console.error(JSON.stringify({ status: 'failed', ...safeProbeFailure(error) })); process.exitCode = 1; }
}
