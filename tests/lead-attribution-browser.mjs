/** Compiled optional public journey pilot. Own artifact copy/DB/port; no external delivery. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createClient } from '@libsql/client';
import { chromium, expect } from '@playwright/test';
import { readBrowserRows } from './helpers/browser-read-observer.mjs';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key])) throw new Error('Explicit isolated local browser environment required');
const root = resolve('.'), base = 'http://127.0.0.1:3111', runId = randomUUID();
const artifact = resolve(process.env.OT_ATTRIBUTION_ARTIFACT_OUTPUT || '.output');
const build = JSON.parse(await readFile(resolve(artifact, 'public/_nuxt/builds/latest.json'), 'utf8'));
// Name includes analytics-browser because the existing guarded synthetic content helper is reused.
const directory = resolve('.data', 'lead-attribution-analytics-browser-' + runId);
const owned = relative(resolve('.data'), directory); assert.ok(owned && !isAbsolute(owned) && !owned.startsWith('..' + sep));
await mkdir(directory, { recursive: false });
const output = resolve('artifacts/lead-attribution-browser', runId); await mkdir(output, { recursive: true });
await cp(artifact, resolve(directory, '.output'), { recursive: true, force: false, errorOnExist: true, dereference: true });
const migrations = resolve(directory, 'migrations'); await mkdir(migrations);
for (const name of (await readdir('server/db/migrations')).filter(name => /^\d+[-_].*\.sql$/.test(name))) await cp(resolve('server/db/migrations', name), resolve(migrations, name), { force: false, errorOnExist: true });
const env = { ...process.env, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', PORT: '3111', NITRO_PORT: '3111', BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base,
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'), OT_DATABASE_PATH: resolve(directory, 'e2e.sqlite'), OT_ANALYTICS_FIXTURE_PATH: resolve(directory, 'fixture.json'), OT_MIGRATIONS_DIR: migrations,
  OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_INVOICE_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled', OT_ANALYTICS_ENABLED: '0', OT_ANALYTICS_RETENTION_DAYS: '14' };
for (const key of Object.keys(env)) if (/^(?:SMTP_|MAIL_FROM$|AMO_|TURSO_|VERCEL|OT_SANDBOX_|CRON_SECRET$|OT_ALERT_EMAIL$|OT_INVOICE_ISSUER_JSON$|OT_BUILD_MODE$|NITRO_UNIX_SOCKET$|NITRO_SSL_)/.test(key)) delete env[key];
const probe = createServer(); probe.listen(3111, '127.0.0.1'); await once(probe, 'listening'); await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
const seed = spawn(process.execPath, ['--import', 'tsx', 'tests/analytics-browser-fixtures.ts'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
assert.equal((await once(seed, 'exit'))[0], 0);
const fixture = JSON.parse(await readFile(env.OT_ANALYTICS_FIXTURE_PATH, 'utf8')); assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY');
console.log('Owned completed artifact copied:', directory);
const db = createClient({ url: 'file:' + env.OT_DATABASE_PATH.replaceAll('\\', '/'), concurrency: 1 });
const rows = (sql, args = []) => readBrowserRows(db, sql, args);
const count = async table => Number((await rows(`SELECT COUNT(*) n FROM ${table}`))[0].n);
const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.BROWSER_PATH || (process.platform === 'win32' && existsSync(windowsChrome) ? windowsChrome : chromium.executablePath());
const checks = [], errors = [], journeyRequests = [], outboundBlocked = [];
let browser, server, log, currentPage, failure = null;
function passed(name) { checks.push({ name, status: 'passed' }); console.log('PASS', name); }
async function stop() {
  if (server && server.exitCode === null) { const ended = once(server, 'exit'); server.kill('SIGTERM'); await ended; }
  log?.end();
}
async function start(enabled) {
  log = createWriteStream(resolve(directory, `server-${enabled ? 'enabled' : 'disabled'}-private.log`), { flags: 'wx' });
  server = spawn(process.execPath, [resolve(directory, '.output/server/index.mjs')], { cwd: directory, env: { ...env, OT_ANALYTICS_ENABLED: enabled ? '1' : '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  let ready = false;
  for (let index = 0; index < 120; index++) {
    if (server.exitCode !== null) throw new Error('Owned runtime exited before readiness');
    try { const response = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(1000) }); ready = response.ok && (await response.json()).status === 'ready'; } catch { /* bounded cold start */ }
    if (ready) break; await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready);
}
async function context() {
  const value = await browser.newContext({ viewport: { width: 360, height: 900 } });
  await value.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base) { outboundBlocked.push(url.origin); return route.abort(); }
    return route.continue();
  });
  value.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  value.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/analytics/journey') journeyRequests.push(request.postDataJSON()); });
  return value;
}
async function go(page, path) {
  currentPage = page; const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' }); assert.equal(response.status(), 200);
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false);
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.locator('h1')).not.toHaveText(/^\s*(?:404|500)\s*$/);
  await expect(page.getByText('Internal Server Error', { exact: true })).toHaveCount(0);
}
async function observed(page, step, action) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/analytics/journey' && response.request().postDataJSON()?.step === step);
  await action(); const response = await pending; assert.equal(response.status(), 200); assert.equal((await response.json()).accepted, true); return response.request().postDataJSON();
}
const storage = page => page.evaluate(() => sessionStorage.getItem('ot-public-journey-v1'));
try {
  await start(false); browser = await chromium.launch({ executablePath, headless: true });
  const disabled = await context(); await disabled.addCookies([{ name: 'ot_analytics_consent', value: 'analytics-v2', url: base, sameSite: 'Lax' }]);
  const disabledPage = await disabled.newPage(); await go(disabledPage, '/'); await go(disabledPage, '/courses/ohrana-truda'); await disabledPage.waitForTimeout(350);
  assert.equal(journeyRequests.length, 0); assert.equal(await storage(disabledPage), null); assert.equal(await count('public_journeys'), 0);
  passed('Compiled disabled configuration: consent cookie alone creates no journey request, browser state or DB journey');
  await disabled.close(); await stop(); await start(true);

  for (const legacy of [false, true]) {
    const noConsent = await context(); if (legacy) await noConsent.addCookies([{ name: 'ot_analytics_consent', value: 'analytics-v1', url: base, sameSite: 'Lax' }]);
    const page = await noConsent.newPage(); await go(page, '/'); await go(page, '/courses/ohrana-truda'); await go(page, '/contacts'); await page.waitForTimeout(300);
    assert.equal(journeyRequests.length, 0); assert.equal(await storage(page), null); assert.equal(await count('public_journeys'), 0);
    passed(legacy ? 'Old v1 consent does not authorize new path tracking' : 'Fresh browser public navigation has no optional journey collection'); await noConsent.close();
  }
  const active = await context(), page = await active.newPage();
  await go(page, '/privacy');
  const consent = page.getByRole('region', { name: 'Необязательная статистика сайта', exact: true });
  const allow = consent.getByRole('button', { name: 'Разрешить статистику', exact: true }); await expect(allow).toBeEnabled(); await allow.click();
  await expect.poll(async () => (await active.cookies()).find(cookie => cookie.name === 'ot_analytics_consent')?.value).toBe('analytics-v2');
  assert.equal(await storage(page), null); // Consent on privacy is not a fabricated landing.
  const landing = await observed(page, 'landing', () => go(page, '/?utm_medium=email&email=PRIVATE_QUERY_CANARY&utm_campaign=PRIVATE_CAMPAIGN_CANARY'));
  assert.equal(landing.context.source, 'email'); // First touch must read the restored hard-navigation query.
  const program = await observed(page, 'program', () => page.locator('a[href$="/ohrana-truda"]').first().click());
  const consultation = await observed(page, 'consultation', () => page.getByRole('link', { name: 'Заявка на консультацию', exact: true }).click());
  assert.equal(landing.journeyId, program.journeyId); assert.equal(program.journeyId, consultation.journeyId);
  assert.deepEqual([landing.sequence, program.sequence, consultation.sequence], [1, 2, 3]);
  assert.equal(await count('public_journeys'), 1); assert.equal(await count('public_journey_steps'), 3);
  assert.ok(!JSON.stringify(journeyRequests).includes('PRIVATE_'));
  passed('Actual explicit RU opt-in then home → program → consultation creates three ordered received stages in one journey');

  await page.locator('[name="name"]').fill('PRIVATE_JOURNEY_FORM_CANARY'); await page.locator('[name="email"]').fill('journey-' + runId + '@example.test'); await page.locator('[name="consent"]').check();
  const acceptedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/amo-lead' && response.request().method() === 'POST');
  await page.locator('form button[type="submit"]').click(); const accepted = await acceptedResponse; assert.equal(accepted.status(), 202);
  const lead = await accepted.json(), sent = accepted.request().postDataJSON(), key = accepted.request().headers()['idempotency-key'];
  assert.equal(sent.attribution.journeyId, landing.journeyId);
  const snapshot = (await rows('SELECT * FROM lead_attributions WHERE lead_id=?', [lead.submissionId]))[0]; assert.ok(snapshot); assert.equal(snapshot.last_sequence, 3);
  assert.equal(JSON.parse(snapshot.first_touch_json).routeId, 'home'); assert.ok(['contacts', 'b2b'].includes(JSON.parse(snapshot.last_touch_json).routeId));
  const persisted = (await rows('SELECT status,crm_lead_id,crm_note_id FROM lead_submissions WHERE id=?', [lead.submissionId]))[0];
  assert.equal(persisted.status, 'accepted'); assert.equal(persisted.crm_lead_id, null); assert.equal(persisted.crm_note_id, null);
  const { attribution: _attribution, ...business } = sent;
  const replay = await active.request.post(base + '/api/amo-lead', { headers: { Origin: base, 'Idempotency-Key': key }, data: business });
  assert.equal(replay.status(), 202); assert.deepEqual(await replay.json(), lead); assert.deepEqual((await rows('SELECT * FROM lead_attributions WHERE lead_id=?', [lead.submissionId]))[0], snapshot);
  assert.equal(await count('lead_submissions'), 1);
  await expect(page.getByRole('status')).toContainText('Заявка принята'); await page.screenshot({ path: resolve(output, 'ru-accepted-360.png'), fullPage: true });
  passed('Actual contact-form POST commits one lead with server first/last snapshot; same-key HTTP replay without optional data preserves it');

  const popupPromise = page.waitForEvent('popup'); await page.evaluate(() => window.open('/courses/ptm', '_blank'));
  const duplicate = await popupPromise; currentPage = duplicate;
  await duplicate.waitForFunction(() => { const raw = sessionStorage.getItem('ot-public-journey-v1'); return raw && JSON.parse(raw).sequence > 0; });
  await expect.poll(async () => {
    const raw = await storage(duplicate); if (!raw) return false;
    const value = JSON.parse(raw);
    return value.sequence > 0 && typeof value.journeyId === 'string' && value.journeyId !== landing.journeyId;
  }).toBe(true);
  await expect.poll(() => count('public_journeys')).toBe(2);
  assert.equal(JSON.parse(await storage(page)).journeyId, landing.journeyId); await duplicate.close();
  passed('Actual opener-cloned sessionStorage is separated by BroadcastChannel: two live tabs have distinct journey IDs');

  await go(page, '/kk/privacy');
  const kkConsent = page.getByRole('region', { name: 'Сайттың міндетті емес статистикасы', exact: true });
  await expect(kkConsent.getByRole('button', { name: 'Статистикаға келісімді қайтарып алу', exact: true })).toBeVisible();
  await kkConsent.getByRole('button', { name: 'Статистикаға келісімді қайтарып алу', exact: true }).click();
  await expect.poll(() => storage(page)).toBe(null); const requestsBefore = journeyRequests.length, rowsBefore = await count('public_journey_steps');
  await page.screenshot({ path: resolve(output, 'kk-withdraw-360.png'), fullPage: true });
  await go(page, '/kk/courses/ohrana-truda'); await go(page, '/kk/contacts'); await page.waitForTimeout(400);
  assert.equal(journeyRequests.length, requestsBefore); assert.equal(await count('public_journey_steps'), rowsBefore); assert.equal(await storage(page), null);
  assert.equal(await count('lead_submissions'), 1); assert.equal(await count('lead_attributions'), 1);
  passed('Actual KK withdrawal clears browser path and stops new requests; existing service lead and accepted snapshot are preserved');

  await go(page, '/privacy');
  await expect(page.getByRole('button', { name: 'Разрешить статистику', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Разрешить статистику', exact: true }).click();
  await expect.poll(async () => (await active.cookies()).find(cookie => cookie.name === 'ot_analytics_consent')?.value).toBe('analytics-v2');
  await go(page, '/program-selection');
  const selectionStart = await observed(page, 'selection_start', () => page.getByRole('radio', { name: 'Охрана труда', exact: true }).check());
  await page.getByRole('button', { name: 'Следующий шаг', exact: true }).click();
  await page.getByLabel(/^Ваша роль/).selectOption('worker');
  await page.getByRole('button', { name: 'Следующий шаг', exact: true }).click();
  await page.getByRole('radio', { name: 'Онлайн', exact: true }).check();
  const matched = await observed(page, 'selection_matched', () => page.getByRole('button', { name: 'Следующий шаг', exact: true }).click());
  assert.equal(matched.journeyId, selectionStart.journeyId); assert.ok(matched.sequence > selectionStart.sequence);
  await go(page, '/kk/program-selection');
  const unmatched = await observed(page, 'selection_unmatched', () => page.locator('ol button').nth(3).click());
  assert.equal(unmatched.context.locale, 'kk'); // The synthetic fixture only publishes RU versions.
  passed('Actual wizard API filtering emits ordered RU matched and KK unmatched outcomes for the synthetic published inventory');

  await go(page, '/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(fixture.users.learner.email);
  await page.getByLabel('Пароль', { exact: true }).fill('SYNTHETIC_WRONG_PASSWORD');
  const failedLogin = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email');
  const authStart = await observed(page, 'auth_start', () => page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click());
  assert.equal((await failedLogin).status(), 401);
  assert.equal((await rows('SELECT auth_confirmed_at FROM public_journeys WHERE id=?', [authStart.journeyId]))[0].auth_confirmed_at, null);
  const forged = await active.request.post(base + '/api/v1/analytics/journey/authenticated', { headers: { Origin: base }, data: { journeyId: authStart.journeyId } });
  assert.equal(forged.status(), 401);
  await page.getByLabel('Пароль', { exact: true }).fill(fixture.users.learner.password);
  const confirmed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/analytics/journey/authenticated');
  await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click();
  const authResponse = await confirmed; assert.equal(authResponse.status(), 200); assert.equal((await authResponse.json()).accepted, true);
  const authenticated = (await rows('SELECT * FROM public_journeys WHERE id=?', [authStart.journeyId]))[0];
  assert.ok(authenticated.auth_confirmed_at); assert.ok(!JSON.stringify(authenticated).includes(fixture.users.learner.email)); assert.ok(!JSON.stringify(authenticated).includes(fixture.users.learner.id));
  passed('Actual wrong-password and unauthenticated confirmation remain unconfirmed; genuine verified-session login records a server timestamp without account identity');

  for (const row of await rows('SELECT context_json FROM public_journey_steps')) assert.ok(!String(row.context_json).includes('PRIVATE_'));
  assert.deepEqual(errors, []); passed('No browser JavaScript errors; public journey transport/storage context excludes private form/query canaries');
  await active.close();
} catch (error) {
  failure = error.stack; if (currentPage) await currentPage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', runId, buildId: build.id, finishedAt: new Date().toISOString(), checks, errors, failure, syntheticOnly: true, externalDelivery: false, externalRequestsBlocked: outboundBlocked.length, journeyRequestCount: journeyRequests.length, privateDirectory: relative(root, directory).replaceAll('\\', '/') }, null, 2));
  if (browser) await browser.close(); db.close(); await stop(); console.log('Attribution browser report:', resolve(output, 'report.json'));
}
