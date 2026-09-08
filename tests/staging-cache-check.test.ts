import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProbeTransport, acceptAuthCookies, privateResponseMetadata, safeProbeFailure, runStagingCacheCheck } from '../scripts/staging-cache-check.mjs';
import { deploymentBinding } from '../scripts/staging-cache-fixture';

const origin = deploymentBinding.origin;
const jar = () => new Map<string, string>();
const privateHeaders = () => new Headers({ 'cache-control': 'private, no-store, max-age=0', 'x-robots-tag': 'noindex, nofollow', server: 'Vercel', 'x-vercel-id': 'fra1::iad1::synthetic-123', 'x-vercel-cache': 'MISS' });

test('T017 HTTPS transport rejects production/cross-origin/query targets before calling fetch', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; return new Response('{}'); };
  for (const target of ['https://www.otcenter.kz', 'https://sertificate.vercel.app', 'http://127.0.0.1:3000', 'https://sertificate-git-main-shalinivan9669s-projects.vercel.app', 'https://sertificate-c6isjblmg-shalinivan9669s-projects.vercel.app']) assert.throws(() => createProbeTransport(target, { fetchImpl }));
  const transport = createProbeTransport(origin, { fetchImpl });
  for (const path of ['https://example.com/collect', '//example.com/collect', '/api/v1/me?cacheBust=1', '/api/v1/me#fragment']) await assert.rejects(transport.request(path, jar()));
  assert.equal(calls, 0);
});
test('T017 redirect is rejected without forwarding cookies/bypass or following Location', async () => {
  const requests: { url: string; options: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, options = {}) => { requests.push({ url: String(input), options }); return new Response('', { status: 307, headers: { location: 'https://example.com/collect' } }); };
  const transport = createProbeTransport(origin, { bypassSecret: 'SYNTHETIC-PROTECTION-CANARY', fetchImpl });
  await assert.rejects(transport.request('/cabinet', new Map([['__Secure-better-auth.session_token', 'SYNTHETIC-COOKIE-CANARY']])));
  assert.equal(requests.length, 1); assert.equal(requests[0]!.url, origin + '/cabinet'); assert.equal(requests[0]!.options.redirect, 'manual');
  const headers = requests[0]!.options.headers as Record<string, string>; assert.equal(headers['x-vercel-protection-bypass'], 'SYNTHETIC-PROTECTION-CANARY');
  for (const key of ['cache-control', 'pragma', 'if-none-match', 'if-modified-since']) assert.equal(headers[key], undefined);
  assert.equal(transport.counters.redirectsRejected, 1);
});
test('T017 transport permits only auth writes and enforces request/response budgets', async () => {
  let calls = 0; const transport = createProbeTransport(origin, { maximumRequests: 1, fetchImpl: async () => { calls++; return new Response('{}'); } });
  await assert.rejects(transport.request('/api/v1/operations/tick', jar(), {})); assert.equal(calls, 0);
  await assert.rejects(transport.request('/api/v1/operations/tick', jar())); assert.equal(calls, 0);
  await transport.request('/api/v1/me', jar()); await assert.rejects(transport.request('/api/v1/me', jar())); assert.equal(calls, 1);
  const oversized = createProbeTransport(origin, { fetchImpl: async () => new Response('small', { headers: { 'content-length': String(3 * 1024 * 1024) } }) });
  await assert.rejects(oversized.request('/cabinet', jar()));
});
test('T017 cookie handling accepts only real secure HttpOnly host-only session attributes', () => {
  const valid = '__Secure-better-auth.session_token=SYNTHETIC; Path=/; HttpOnly; Secure; SameSite=Lax'; const cookies = jar();
  assert.equal(acceptAuthCookies(new Headers({ 'set-cookie': valid }), cookies), 1); assert.equal(cookies.size, 1);
  for (const invalid of [valid.replace('; HttpOnly', ''), valid.replace('; Secure', ''), valid.replace('SameSite=Lax', 'SameSite=None'), valid + '; Domain=.vercel.app']) assert.throws(() => acceptAuthCookies(new Headers({ 'set-cookie': invalid }), jar()));
});
test('T017 actual private response policy refuses CDN HIT, positive Age and missing boundaries', () => {
  const response = { status: 200, bytes: Buffer.from('{}'), headers: privateHeaders() };
  assert.equal(privateResponseMetadata(response).edge, 'fra1::iad1');
  for (const [name, value] of [['x-vercel-cache', 'HIT'], ['x-vercel-cache', 'STALE'], ['age', '1'], ['cache-control', 'public, max-age=100'], ['x-robots-tag', 'index'], ['server', 'other'], ['x-vercel-id', '']]) {
    const headers = privateHeaders(); headers.set(name!, value!); assert.throws(() => privateResponseMetadata({ ...response, headers }));
  }
});
test('T017 public failure metadata cannot reflect server/auth/PDF canary text', () => {
  const canary = 'SYNTHETIC-CREDENTIAL-PRIVATE-CANARY'; const output = JSON.stringify(safeProbeFailure(new Error(canary)));
  assert.equal(output.includes(canary), false); assert.ok(output.includes('STAGING_CACHE_CHECK_FAILED')); assert.match(JSON.parse(output).diagnosticSha256, /^[a-f0-9]{64}$/);
});
test('T017 check rejects production flag before reading fixtures or invoking network', async () => {
  let calls = 0; await assert.rejects(runStagingCacheCheck('nonexistent-fixture', origin, { OT_APP_ENV: 'production', OT_ALLOW_STAGING_CACHE_CHECK: '1' }, async () => { calls++; return new Response('{}'); })); assert.equal(calls, 0);
});
