/** Actual eight-emitter UI pilot and administrator report. Never posts analytics through a test API. */
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createClient } from '@libsql/client';
import { chromium, expect } from '@playwright/test';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key])) throw new Error('Explicit isolated local browser environment required');
const root = resolve('.');
const artifact = resolve(process.env.OT_ANALYTICS_ARTIFACT_OUTPUT || '.output');
const build = JSON.parse(await readFile(resolve(artifact, 'public/_nuxt/builds/latest.json'), 'utf8'));
const runId = randomUUID(); const directory = resolve('.data', 'analytics-browser-' + runId); await mkdir(directory, { recursive: false });
const childPath = relative(resolve('.data'), directory); assert.ok(childPath && !isAbsolute(childPath) && !childPath.startsWith('..' + sep));
const output = resolve('artifacts/analytics-browser', runId); await mkdir(output, { recursive: true });
await cp(artifact, resolve(directory, '.output'), { recursive: true, force: false, errorOnExist: true, dereference: true });
const migrations = resolve(directory, 'migrations'); await mkdir(migrations);
const migrationNames = (await readdir('server/db/migrations')).filter(name => /^\d+[-_].*\.sql$/.test(name));
for (const name of migrationNames) await cp(resolve('server/db/migrations', name), resolve(migrations, name), { force: false, errorOnExist: true });
console.log('Completed artifact copied to owned analytics-browser directory:', directory);
const base = 'http://127.0.0.1:3109';
const env = { ...process.env, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', PORT: '3109', NITRO_PORT: '3109', BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base,
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'), OT_DATABASE_PATH: resolve(directory, 'e2e.sqlite'), OT_ANALYTICS_FIXTURE_PATH: resolve(directory, 'fixture.json'), OT_MIGRATIONS_DIR: migrations,
  OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_INVOICE_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled', OT_ANALYTICS_ENABLED: '1', OT_ANALYTICS_RETENTION_DAYS: '14' };
for (const key of Object.keys(env)) if (/^(?:SMTP_|MAIL_FROM$|AMO_|TURSO_|VERCEL|OT_SANDBOX_|CRON_SECRET$|OT_ALERT_EMAIL$|OT_INVOICE_ISSUER_JSON$|OT_BUILD_MODE$|NITRO_UNIX_SOCKET$|NITRO_SSL_)/.test(key)) delete env[key];
const probe = createServer(); probe.listen(3109, '127.0.0.1'); await once(probe, 'listening'); await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
const seed = spawn(process.execPath, ['--import', 'tsx', 'tests/analytics-browser-fixtures.ts'], { cwd: root, env: { ...env, OT_ANALYTICS_ENABLED: '0' }, windowsHide: true, stdio: 'inherit' }); const [seedCode] = await once(seed, 'exit'); assert.equal(seedCode, 0);
const fixture = JSON.parse(await readFile(env.OT_ANALYTICS_FIXTURE_PATH, 'utf8')); assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY');
const log = createWriteStream(resolve(directory, 'server-private.log'), { flags: 'wx' });
const server = spawn(process.execPath, [resolve(directory, '.output/server/index.mjs')], { cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.pipe(log); server.stderr.pipe(log);
const db = createClient({ url: 'file:' + env.OT_DATABASE_PATH.replaceAll('\\', '/'), concurrency: 1 });
const checks = [], errors = [], requests = [], events = [], reportWindows = [];
const eventNames = ['program_view', 'selection_start', 'selection_complete', 'contact_click', 'lead_form_start', 'checkout_view', 'lesson_open', 'support_open'];
const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const useWindowsChrome = process.platform === 'win32' && existsSync(windowsChrome);
const browserExecutable = process.env.BROWSER_PATH || (useWindowsChrome ? windowsChrome : chromium.executablePath());
const browserSelection = process.env.BROWSER_PATH ? 'override' : useWindowsChrome ? 'windows-system' : 'playwright';
const canary = 'PRIVATE_FORM_' + randomBytes(10).toString('hex');
let browser, currentPage, enrollmentId, failure = null;
const passed = name => { checks.push({ name, status: 'passed' }); console.log('PASS', name); };
const rows = async (sql, args = []) => (await db.execute({ sql, args })).rows;
function totp(uri) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...new URL(uri).searchParams.get('secret').toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  return String((hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function go(page, path) {
  currentPage = page;
  const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__)); return response;
}
async function uiResponse(page, pathname, method, action) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === method);
  await action(); const response = await pending; assert.equal(response.status(), 200, await response.text()); return response.json();
}
async function uiEvent(page, name, action) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/analytics' && response.request().method() === 'POST' && response.request().postDataJSON()?.name === name);
  await action(); const response = await pending; assert.equal(response.status(), 200, name); assert.equal((await response.json()).accepted, true, name + ' accepted by server');
  const payload = response.request().postDataJSON(); assert.deepEqual(Object.keys(payload).sort(), ['dimensions', 'id', 'name']); assert.match(payload.id, /^[a-f\d-]{36}$/i);
  assert.ok(Object.keys(payload.dimensions).every(key => ['programId', 'locale', 'city', 'format', 'audience'].includes(key)));
  passed('Actual UI emitter: ' + name); return payload;
}
function attach(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/analytics')) requests.push({ path: url.pathname, method: request.method() });
    if (url.pathname === '/api/v1/analytics' && request.method() === 'POST') events.push(request.postDataJSON());
  });
}
async function login(page, user) {
  await page.getByLabel('Email', { exact: true }).fill(user.email); await page.getByLabel('Пароль', { exact: true }).fill(user.password);
  let pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click(); let response = await pending;
  if (response.status() === 429) {
    const retryMs = Math.max(1000, Number(response.headers()['retry-after'] || 60) * 1000); assert.ok(retryMs <= 60_000, 'Bounded rate-limit retry');
    await page.waitForTimeout(retryMs); pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email');
    await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click(); response = await pending;
  }
  assert.equal(response.status(), 200, 'Actual password authentication');
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error('Owned runtime exited during startup');
    try { const result = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(1000) }); ready = result.ok && (await result.json()).status === 'ready'; } catch { /* bounded cold start */ }
    if (ready) break; await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready); assert.equal(Number((await rows('SELECT COUNT(*) AS n FROM analytics_events'))[0].n), 0);
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const learnerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const learner = await learnerContext.newPage(); attach(learner);
  await go(learner, '/courses'); await go(learner, '/courses/ohrana-truda'); await expect(learner.getByLabel(/^Вариант и язык обучения/)).toBeVisible();
  await go(learner, '/program-selection'); await learner.getByRole('radio', { name: 'Охрана труда', exact: true }).check();
  await learner.waitForTimeout(400); assert.equal(requests.length, 0); assert.ok(!(await learnerContext.cookies()).some(cookie => cookie.name === 'ot_analytics_consent'));
  passed('Fresh browser catalog/program/wizard interactions produce no analytics/config request and no consent cookie');

  await go(learner, '/privacy');
  const consent = learner.getByRole('region', { name: 'Необязательная статистика сайта', exact: true });
  await expect(consent.getByRole('button', { name: 'Разрешить статистику', exact: true })).toBeEnabled();
  await consent.getByRole('button', { name: 'Разрешить статистику', exact: true }).click();
  await expect.poll(async () => (await learnerContext.cookies()).find(cookie => cookie.name === 'ot_analytics_consent')?.value).toBe('analytics-v1');
  const cookie = (await learnerContext.cookies()).find(cookie => cookie.name === 'ot_analytics_consent'); assert.equal(cookie.expires, -1); assert.equal(cookie.path, '/'); assert.equal(cookie.sameSite, 'Lax'); assert.equal(events.length, 0);
  passed('Explicit RU opt-in creates only the session consent cookie; consent itself is not an event');

  const programEvent = await uiEvent(learner, 'program_view', () => go(learner, '/astana/ohrana-truda'));
  assert.equal(programEvent.dimensions.programId, fixture.programId); assert.equal(programEvent.dimensions.city, 'astana');
  await go(learner, '/program-selection');
  await uiEvent(learner, 'selection_start', () => learner.getByRole('button', { name: 'Следующий шаг', exact: true }).click());
  await learner.getByLabel(/^Ваша роль/).selectOption('worker');
  await learner.getByRole('button', { name: 'Следующий шаг', exact: true }).click();
  await learner.getByRole('radio', { name: 'Онлайн', exact: true }).check();
  await uiEvent(learner, 'selection_complete', () => learner.getByRole('button', { name: 'Следующий шаг', exact: true }).click());
  await expect(learner.getByRole('link', { name: 'Посмотреть программу', exact: true })).toBeVisible();
  await learner.getByRole('link', { name: 'Посмотреть программу', exact: true }).click(); await learner.waitForURL(url => url.pathname === '/courses/ohrana-truda');
  await uiEvent(learner, 'contact_click', () => learner.getByRole('link', { name: 'Обсудить обучение', exact: true }).click());
  await learner.waitForURL(url => url.pathname === '/contacts');
  await uiEvent(learner, 'lead_form_start', () => learner.locator('input[name=name]').fill(canary));
  await learner.locator('input[name=email]').fill('private-' + runId + '@example.test'); await learner.locator('textarea[name=comment]').fill(canary + ' response and private note');
  assert.equal(Number((await rows('SELECT COUNT(*) AS n FROM lead_submissions'))[0].n), 0, 'Form is not submitted to any service');

  await go(learner, '/courses/ohrana-truda'); await expect(learner.getByLabel(/^Вариант и язык обучения/)).toBeVisible();
  await uiEvent(learner, 'support_open', () => learner.locator('.lms').getByRole('link', { name: 'Связаться с OT Center', exact: true }).click());
  await learner.waitForURL(url => url.pathname === '/contacts');
  await go(learner, '/courses/ohrana-truda'); await learner.getByLabel(/^Вариант и язык обучения/).selectOption(fixture.paidVersionId);
  await uiEvent(learner, 'checkout_view', () => learner.getByRole('link', { name: 'Условия записи и оплаты', exact: true }).click());
  await learner.waitForURL(url => url.pathname === '/payment/ohrana-truda');
  assert.equal(Number((await rows('SELECT COUNT(*) AS n FROM orders'))[0].n), 0, 'Checkout view does not create or pay an order');

  await go(learner, '/auth/login?returnTo=%2Fcourses%2Fohrana-truda'); await login(learner, fixture.users.learner); await learner.waitForURL(url => url.pathname === '/courses/ohrana-truda');
  await learner.getByLabel(/^Вариант и язык обучения/).selectOption(fixture.freeVersionId);
  await uiEvent(learner, 'lesson_open', () => learner.getByRole('button', { name: 'Записаться на обучение', exact: true }).click());
  await learner.waitForURL(/\/learn\/[^/?]+$/); enrollmentId = new URL(learner.url()).pathname.split('/').pop();
  await expect(learner.getByRole('heading', { name: 'TEST ONLY lesson', exact: true })).toBeVisible();
  await uiResponse(learner, `/api/v1/enrollments/${enrollmentId}/progress/${fixture.lessonId}`, 'PUT', () => learner.getByRole('button', { name: 'Материал изучен — завершить урок', exact: true }).click());
  await expect(learner.getByRole('status').filter({ hasText: 'Завершение урока сохранено.' })).toBeVisible();

  await expect.poll(() => new Set(events.map(event => event.name)).size).toBe(8);
  for (const name of eventNames) assert.ok(events.some(event => event.name === name));
  await expect.poll(async () => Number((await rows("SELECT COUNT(*) AS n FROM analytics_events WHERE id NOT LIKE 'server:%'"))[0].n)).toBe(new Set(events.map(event => event.id)).size);
  const stored = await rows('SELECT id,name,dimensions_json FROM analytics_events');
  const savedClient = stored.filter(event => !String(event.id).startsWith('server:'));
  for (const value of savedClient) {
    const sent = events.find(event => event.id === value.id); assert.ok(sent); assert.equal(sent.name, value.name); assert.deepEqual(JSON.parse(value.dimensions_json), sent.dimensions);
    assert.ok(Object.keys(sent.dimensions).every(key => ['programId', 'locale', 'city', 'format', 'audience'].includes(key)));
  }
  const persisted = JSON.stringify(stored), transmitted = JSON.stringify(events);
  for (const value of [canary, fixture.users.learner.id, fixture.users.learner.email, fixture.users.learner.password, fixture.lessonId, enrollmentId, 'private-' + runId + '@example.test']) { assert.equal(persisted.includes(value), false); assert.equal(transmitted.includes(value), false); }
  assert.ok(stored.some(event => event.name === 'enrollment_activated')); assert.ok(stored.some(event => event.name === 'lesson_completed'));
  passed('All eight observed UI event names match persisted safe payloads; actual enrollment/lesson completion produce separate server events');

  const learnerDenied = await learner.request.get(base + '/api/v1/admin/analytics?days=7'); assert.equal(learnerDenied.status(), 403);
  await go(learner, '/admin'); await expect(learner.getByRole('link', { name: 'Статистика действий', exact: true })).toHaveCount(0);
  passed('Learner cannot read the admin analytics API and receives no report navigation link');

  await learner.setViewportSize({ width: 360, height: 900 }); await go(learner, '/kk/privacy');
  const kkConsent = learner.getByRole('region', { name: 'Сайттың міндетті емес статистикасы', exact: true });
  await kkConsent.getByRole('button', { name: 'Статистикаға келісімді қайтарып алу', exact: true }).click();
  await expect.poll(async () => (await learnerContext.cookies()).some(cookie => cookie.name === 'ot_analytics_consent')).toBe(false);
  const beforeWithdrawal = events.length;
  await learner.screenshot({ path: resolve(output, 'withdrawal-kk-360.png'), fullPage: true });
  await go(learner, '/kk/courses/ohrana-truda'); await go(learner, '/kk/contacts'); await learner.locator('input[name=name]').fill(canary);
  await learner.waitForTimeout(1300); assert.equal(events.length, beforeWithdrawal);
  passed('KK mobile withdrawal removes consent and subsequent real course/form interactions send no analytics');

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const admin = await adminContext.newPage(); attach(admin);
  await go(admin, '/admin/analytics'); await admin.getByRole('link', { name: 'Войти в аккаунт', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Вход в личный кабинет', exact: true })).toBeVisible();
  assert.equal(new URL(admin.url()).searchParams.get('returnTo'), '/admin/analytics');
  await login(admin, fixture.users.admin); await admin.waitForURL(url => url.pathname === '/admin/analytics');
  await admin.getByRole('link', { name: 'Проверить подтверждение безопасности входа', exact: true }).click(); await admin.waitForURL(url => url.pathname === '/cabinet/security');
  await admin.getByLabel('Текущий пароль', { exact: true }).fill(fixture.users.admin.password); await admin.getByRole('button', { name: 'Настроить приложение', exact: true }).click();
  await expect(admin.locator('code')).toContainText('otpauth://'); await admin.getByLabel('Код из приложения', { exact: true }).fill(totp(await admin.locator('code').textContent()));
  await admin.getByRole('button', { name: 'Подтвердить и включить', exact: true }).click(); await expect(admin.getByText('Настройки безопасности сохранены.', { exact: true })).toBeVisible();
  await go(admin, '/admin'); const initialReport = await uiResponse(admin, '/api/v1/admin/analytics', 'GET', () => admin.getByRole('link', { name: 'Статистика действий', exact: true }).click());
  await expect(admin.getByRole('heading', { name: 'Статистика действий', exact: true })).toBeVisible();
  assert.equal(initialReport.window.days, 7); assert.equal(initialReport.unit, 'deduplicated_events'); assert.equal(initialReport.uniqueVisitorsMeasured, false); assert.equal(initialReport.conversionRate, null);
  assert.equal(initialReport.client.length, 8); assert.equal(initialReport.server.length, 11);
  await expect(admin.locator('tbody tr')).toHaveCount(19);
  await expect(admin.getByText(/уникальные посетители здесь не измеряются/)).toBeVisible();
  await expect(admin.getByText(/У браузерных действий и серверных операций разные группы участников/)).toContainText('процент конверсии не рассчитывается');
  passed('Anonymous report returns through real login; actual admin TOTP MFA unlocks the report with all19 named rows and separate populations');
  for (const requestedDays of [14, 30, 7]) {
    await admin.getByLabel(/^Период отчёта/).selectOption(String(requestedDays));
    const report = await uiResponse(admin, '/api/v1/admin/analytics', 'GET', () => admin.getByRole('button', { name: 'Обновить отчёт', exact: true }).click());
    assert.equal(report.window.days, Math.min(requestedDays, 14)); assert.equal(report.window.timezone, 'UTC'); assert.equal(report.window.bounds, '[from,until)');
    assert.equal(report.totals.client, savedClient.length); assert.equal(report.totals.server, stored.length - savedClient.length);
    reportWindows.push({ requestedDays, actualDays: report.window.days, from: report.window.from, until: report.window.until });
    if (requestedDays === 30) await expect(admin.getByText('Выбранный период ограничен настроенным окном хранения статистики.', { exact: true })).toBeVisible();
  }
  await admin.screenshot({ path: resolve(output, 'report-ru-1440.png'), fullPage: true });
  await admin.setViewportSize({ width: 360, height: 900 }); await go(admin, '/kk/admin/analytics');
  await expect(admin.getByRole('heading', { name: 'Әрекеттер статистикасы', exact: true })).toBeVisible(); await expect(admin.locator('tbody tr')).toHaveCount(19);
  assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await admin.screenshot({ path: resolve(output, 'report-kk-360.png'), fullPage: true });
  passed('Admin manual 7/14/30-day reports reflect actual server UTC bounds and retention clamp; KK360 has19 rows without horizontal overflow');
  assert.deepEqual(errors, []); passed('No JavaScript errors during the complete isolated eight-emitter and actual-MFA report pilot');
} catch (error) {
  failure = error.stack;
  if (currentPage) await currentPage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', runId, buildId: build.id, base, finishedAt: new Date().toISOString(), browserSelection, browserPlatform: process.platform, syntheticOnly: true, externalDelivery: false, collectionEnabledOnlyLocally: true, checks, errors, failure, emittedNames: [...new Set(events.map(event => event.name))], eventRequestCount: events.length, distinctEventIds: new Set(events.map(event => event.id)).size, reportWindows, privateDirectory: relative(root, directory).replaceAll('\\', '/') }, null, 2));
  console.log('Browser report:', resolve(output, 'report.json'));
  if (browser) await browser.close(); db.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; } log.end();
}
