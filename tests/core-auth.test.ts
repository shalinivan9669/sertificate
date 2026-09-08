import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { createApp, defineEventHandler, toNodeListener } from 'h3';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { closeDb, execute, getDb, queryAll, queryOne } from '../server/db';
import { authEmailLocale, resetAuthInstance } from '../server/services/auth';
import authHandler from '../server/api/auth/[...all]';
import coreHandler from '../server/handlers/core';

let directory: string; let server: Server; let origin: string;
const password = 'Isolated-test-password-2026!';
type Jar = Map<string, string>;
async function request(path: string, method = 'GET', body?: unknown, jar: Jar = new Map(), extras: Record<string, string> = {}) {
  const response = await fetch(`${origin}${path}`, { method, headers: { ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), ...extras }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const cookie of response.headers.getSetCookie()) { const [name, ...pieces] = (cookie.split(';', 1)[0] || '').split('='); if (!name) continue; const value = pieces.join('='); if (value) jar.set(name, value); else jar.delete(name); }
  const text = await response.text(); let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, headers: response.headers, data };
}
async function account(name: string) {
  const email = `${name}@example.test`; const jar = new Map<string, string>();
  const signup = await request('/api/auth/sign-up/email', 'POST', { name: 'Isolated Test Learner', email, password, callbackURL: '/auth/verify' }, jar);
  assert.equal(signup.status, 200, JSON.stringify(signup.data));
  const messages = await queryAll('SELECT payload_json FROM outbox WHERE type=? ORDER BY created_at DESC', ['auth.email']);
  const message = messages.map((row) => JSON.parse(row.payload_json)).find((message) => message.to === email && message.purpose === 'email_verification');
  assert.ok(message, JSON.stringify({ messages: messages.map((row) => { const data = JSON.parse(row.payload_json); return { to: data.to, purpose: data.purpose }; }), users: await queryAll('SELECT email FROM "user"') })); const url = new URL(message.text.split(' ').at(-1));
  const verification = await request(`${url.pathname}${url.search}`, 'GET', undefined, jar);
  assert.ok([200, 302].includes(verification.status), JSON.stringify(verification.data));
  const login = await request('/api/auth/sign-in/email', 'POST', { email, password }, jar);
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { email, jar, id: (await queryOne('SELECT id FROM "user" WHERE email=?', [email]))!.id as string };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-auth-test-'));
  process.env.OT_DATABASE_PATH = join(directory, 'test.sqlite'); process.env.NODE_ENV = 'test'; delete process.env.VERCEL; delete process.env.TURSO_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = 'Isolated-test-secret-at-least-thirty-two-characters';
  const app = createApp(); app.use(defineEventHandler((event) => event.path.startsWith('/api/auth/') ? authHandler(event) : coreHandler(event)));
  server = createServer(toNodeListener(app)); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`; process.env.BETTER_AUTH_URL = origin;
  await getDb();
});
beforeEach(async () => { await execute('DELETE FROM rateLimit'); });
after(async () => { resetAuthInstance(); await new Promise<void>((resolve) => server.close(() => resolve())); await closeDb(); await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

test('T020 anonymous API has no fake learner and no-store/noindex; mail is honestly unconfigured', async () => {
  const response = await request('/api/v1/me'); assert.equal(response.status, 401, JSON.stringify(response.data));
  assert.match(response.headers.get('cache-control')!, /no-store/); assert.match(response.headers.get('x-robots-tag')!, /noindex/);
  const configuration = await request('/api/v1/auth/config'); assert.equal(configuration.data.available, true); assert.equal(configuration.data.emailDeliveryConfigured, false);
});
test('T020 password sign-up requires email verification; no client-assigned privileged roles', async () => {
  const signup = await request('/api/auth/sign-up/email', 'POST', { name: 'Isolated unverified', email: 'unverified@example.test', password });
  assert.equal(signup.status, 200, JSON.stringify(signup.data));
  assert.equal((await request('/api/auth/sign-in/email', 'POST', { email: 'unverified@example.test', password })).status, 403);
  assert.equal((await request('/api/auth/sign-up/email', 'POST', { name: 'Bad role', email: 'bad-role@example.test', password, role: 'admin' })).status, 400);
  assert.equal((await queryOne('SELECT role FROM "user" WHERE email=?', ['unverified@example.test']))!.role, 'learner');
});
test('T020/T021 real signup, verify, login, logout revokes the old session cookie', async () => {
  const actor = await account('logout-test');
  const me = await request('/api/v1/me', 'GET', undefined, actor.jar); assert.equal(me.status, 200); assert.equal(me.data.user.id, actor.id);
  const oldCookie = new Map(actor.jar); assert.equal((await request('/api/auth/sign-out', 'POST', {}, actor.jar)).status, 200);
  assert.equal((await request('/api/v1/me', 'GET', undefined, oldCookie)).status, 401);
});
test('T022/T028 cookies cannot grant admin, payment, pass or enrollment state; CSRF is denied', async () => {
  const actor = await account('authorization-test'); actor.jar.set('passed', 'true'); actor.jar.set('paid', 'true'); actor.jar.set('role', 'admin'); actor.jar.set('stage', 'b2b');
  assert.equal((await request('/api/v1/admin/program-versions', 'GET', undefined, actor.jar)).status, 403);
  const enrollments = await request('/api/v1/me/enrollments', 'GET', undefined, actor.jar); assert.deepEqual(enrollments.data.enrollments, []);
  const response = await request('/api/v1/enrollments', 'POST', { versionId: 'fake' }, actor.jar, { origin: 'https://evil.test', 'idempotency-key': 'csrf-test' });
  assert.equal(response.status, 403); assert.equal(response.data.data.code, 'ORIGIN_NOT_ALLOWED');
  assert.equal((await request('/api/auth/sign-out', 'POST', {}, actor.jar, { origin: 'https://evil.test' })).status, 403);
});
test('T020 reset password uses the queued one-time link and invalidates previous sessions', async () => {
  const actor = await account('reset-test'); const oldCookie = new Map(actor.jar);
  const reset = await request('/api/auth/request-password-reset', 'POST', { email: actor.email, redirectTo: '/auth/reset' }); assert.equal(reset.status, 200);
  const messages = (await queryAll('SELECT payload_json FROM outbox WHERE type=?', ['auth.email'])).map((row) => JSON.parse(row.payload_json));
  const message = messages.find((entry) => entry.to === actor.email && entry.purpose === 'password_reset'); assert.ok(message);
  const url = new URL(message.text.split(' ').at(-1)); const token = url.pathname.split('/').at(-1);
  const changed = await request('/api/auth/reset-password', 'POST', { token, newPassword: `${password}changed` }); assert.equal(changed.status, 200, JSON.stringify(changed.data));
  assert.equal((await request('/api/v1/me', 'GET', undefined, oldCookie)).status, 401);
  assert.equal((await request('/api/auth/reset-password', 'POST', { token, newPassword: `${password}again` })).status, 400);
});
test('T026 real TOTP is required for privileged API; password-only sessions have no MFA assurance', async () => {
  const actor = await account('mfa-test'); await execute('UPDATE "user" SET role=? WHERE id=?', ['editor', actor.id]);
  let access = await request('/api/v1/admin/program-versions', 'GET', undefined, actor.jar); assert.equal(access.status, 403); assert.equal(access.data.data.code, 'MFA_REQUIRED');
  const setup = await request('/api/auth/two-factor/enable', 'POST', { password, method: 'totp' }, actor.jar); assert.equal(setup.status, 200, JSON.stringify(setup.data));
  const encoded = new URL(setup.data.totpURI).searchParams.get('secret')!;
  const secret = new TextDecoder().decode(base32.decode(encoded)); const code = await createOTP(secret).totp();
  const verified = await request('/api/auth/two-factor/verify-totp', 'POST', { code }, actor.jar); assert.equal(verified.status, 200, JSON.stringify(verified.data));
  access = await request('/api/v1/admin/program-versions', 'GET', undefined, actor.jar); assert.equal(access.status, 200, JSON.stringify(access.data));
  await request('/api/auth/sign-out', 'POST', {}, actor.jar);
  const passwordOnly = await request('/api/auth/sign-in/email', 'POST', { email: actor.email, password }, actor.jar); assert.equal(passwordOnly.data.twoFactorRedirect, true);
  assert.equal((await request('/api/v1/me', 'GET', undefined, actor.jar)).status, 401);
  assert.equal((await request('/api/auth/two-factor/verify-totp', 'POST', { code: await createOTP(secret).totp() }, actor.jar)).status, 200);
  assert.equal((await request('/api/v1/admin/program-versions', 'GET', undefined, actor.jar)).status, 200);
});
test('T069 authentication limiter persists and ignores spoofed forwarding headers', async () => {
  const statuses = [];
  for (let index = 0; index < 6; index++) statuses.push((await request('/api/auth/sign-in/email', 'POST', { email: 'missing@example.test', password }, new Map(), { 'x-forwarded-for': `203.0.113.${index + 1}` })).status);
  assert.equal(statuses.at(-1), 429, statuses.join(',')); assert.ok((await queryAll('SELECT id FROM rateLimit')).length > 0);
});

test('Kazakh verification/reset emails preserve trusted localized callbacks in the transactional outbox', async () => {
  assert.equal(authEmailLocale(`${origin}/api/auth/verify-email?callbackURL=${encodeURIComponent('/kk/auth/verify')}`, origin), 'kk');
  assert.equal(authEmailLocale(`${origin}/api/auth/reset-password/test?callbackURL=${encodeURIComponent('https://evil.test/kk/auth/reset')}`, origin), 'ru');
  assert.equal(authEmailLocale('https://evil.test/kk/auth/verify', origin), 'ru');
  const email = 'kazakh-auth@example.test';
  const signup = await request('/api/auth/sign-up/email', 'POST', { name: 'Isolated Kazakh Test', email, password, callbackURL: '/kk/auth/verify' });
  assert.equal(signup.status, 200, JSON.stringify(signup.data));
  const rows = (await queryAll('SELECT payload_json FROM outbox WHERE type=?', ['auth.email'])).map(row => JSON.parse(row.payload_json));
  const verification = rows.find(row => row.to === email && row.purpose === 'email_verification');
  assert.equal(verification.locale, 'kk'); assert.match(verification.subject, /поштаны растау/);
  const url = new URL(verification.text.split(' ').at(-1)); assert.equal(url.searchParams.get('callbackURL'), '/kk/auth/verify');
  assert.ok([200, 302].includes((await request(url.pathname + url.search)).status));
  assert.equal((await request('/api/auth/request-password-reset', 'POST', { email, redirectTo: '/kk/auth/reset' })).status, 200);
  const reset = (await queryAll('SELECT payload_json FROM outbox WHERE type=?', ['auth.email'])).map(row => JSON.parse(row.payload_json)).find(row => row.to === email && row.purpose === 'password_reset');
  assert.equal(reset.locale, 'kk'); assert.match(reset.subject, /қалпына келтіру/);
  assert.ok(reset.text.includes('kk%2Fauth%2Freset') || reset.text.includes('/kk/auth/reset'));
});
