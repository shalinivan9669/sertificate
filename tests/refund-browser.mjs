/** Actual loopback-only UI refund and same-artifact recovery checks, against a completed Node build. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { relative, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { chromium, expect } from '@playwright/test';
import { decryptBackup, encryptBackup, exportDatabase, restoreDatabase } from '../scripts/db-backup.ts';
import { readBrowserRows } from './helpers/browser-read-observer.mjs';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key])) throw new Error('Explicit local isolated test environment required');
const root = resolve('.'); const runId = randomUUID(); const directory = resolve('.data', `refund-browser-${runId}`);
await mkdir(directory, { recursive: false }); const artifactDirectory = resolve('artifacts/refund-browser', runId); await mkdir(artifactDirectory, { recursive: true });
await writeFile(resolve(directory, '.fixture-owner.json'), JSON.stringify({ format: 'ot-refund-browser-fixture-v1', runId }), { flag: 'wx', mode: 0o600 });
const buildRoot = resolve(process.env.OT_E2E_ARTIFACT_ROOT || root); const entry = resolve(buildRoot, '.output/server/index.mjs');
assert.ok(existsSync(entry), 'A completed current Node build is required');
const build = JSON.parse(await readFile(resolve(buildRoot, '.output/public/_nuxt/builds/latest.json'), 'utf8'));
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
const entrySha256 = createHash('sha256').update(await readFile(entry)).digest('hex');
const sourceFiles = ['server/services/commerce.ts', 'server/services/credentials.ts', 'server/handlers/business.ts', 'server/services/operations.ts', 'server/db/migrations/013-partial-refunds.sql', 'pages/admin/index.vue', 'pages/payment/pending.vue', 'composables/useLmsApi.ts', 'components/lms/LmsOrderAmounts.vue', 'tests/refund-browser.mjs', 'tests/refund-browser-fixture.ts'];
const sourceFingerprints = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')])));
async function compiledFingerprint() {
  const files = []; const serverRoot = resolve(buildRoot, '.output/server');
  async function collect(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue;
      const path = resolve(directory, item.name);
      if (item.isDirectory()) await collect(path);
      else if (item.isFile() && (item.name.endsWith('.mjs') || item.name === 'package.json')) files.push([relative(serverRoot, path).replaceAll('\\', '/'), createHash('sha256').update(await readFile(path)).digest('hex')]);
    }
  }
  await collect(serverRoot); files.sort(([left], [right]) => left.localeCompare(right)); assert.ok(files.length > 1);
  return { sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files: files.length };
}
const compiledArtifact = await compiledFingerprint();
if (process.env.OT_REFUND_EXPECT_BUILD_ID) assert.equal(build.id, process.env.OT_REFUND_EXPECT_BUILD_ID);
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening'); const port = portProbe.address().port;
await new Promise((yes, no) => portProbe.close(error => error ? no(error) : yes())); const base = `http://127.0.0.1:${port}`;
const environment = { ...process.env };
for (const key of Object.keys(environment)) if (/^(?:OT_|BETTER_AUTH_|NUXT_|NITRO_|VERCEL|TURSO_|AMO_|SMTP_|MAIL_FROM$|CRON_|DATABASE_|HOST$|PORT$)/.test(key) || /TOKEN|SECRET|PASSWORD|API_KEY/.test(key)) delete environment[key];
Object.assign(environment, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', HOST: '127.0.0.1', PORT: String(port), TEST_BASE_URL: base, BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base,
  OT_E2E_RUN_ID: runId,
  BETTER_AUTH_SECRET: 'SYNTHETIC-refund-browser-auth-secret-not-production-2026', OT_DATABASE_PATH: resolve(directory, 'e2e.sqlite'), OT_E2E_FIXTURE_PATH: resolve(directory, 'fixture.json'), OT_MIGRATIONS_DIR: resolve(root, 'server/db/migrations'),
  OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_ANALYTICS_ENABLED: '0', OT_INVOICE_ENABLED: '0', OT_PAYMENT_PROVIDER: 'sandbox', OT_PAYMENT_TERMS_APPROVED: '1', OT_PAYMENT_TERMS_VERSION: 'SYNTHETIC-refund-test-v1',
  OT_SANDBOX_WEBHOOK_SECRET: 'SYNTHETIC-refund-webhook-key-not-production-2026', OT_SANDBOX_MERCHANT: 'SYNTHETIC-refund-test-merchant' });
const report = { startedAt: new Date().toISOString(), buildId: build.id, scope: 'Actual UI on isolated local synthetic database; no remote writes, real payments or external delivery. Recovery restarts the same compiled artifact, not an old release or Vercel rollback.', checks: [], recovery: null, failures: [], javascriptErrors: [] };
const clients = []; const contexts = []; let browser; let server; let log;
const privateDiagnostics = [];
Object.assign(report, { sourceSha, sourceFingerprints, entrySha256, compiledArtifact, runtimeStarts: [] });
let recoveryPhase = false; let recoveryPostRequests = 0;
const pass = (name, detail) => { report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(JSON.stringify({ passed: name })); };
const sha = data => createHash('sha256').update(data).digest('hex');
const money = minor => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(minor / 100).replace(/\s/g, '\u00a0') + '\u00a0₸';
async function start(database, mode, label) {
  assert.deepEqual(await compiledFingerprint(), compiledArtifact);
  assert.equal(JSON.parse(await readFile(resolve(buildRoot, '.output/public/_nuxt/builds/latest.json'), 'utf8')).id, build.id);
  assert.ok(!server); log = createWriteStream(resolve(directory, label + '.log'), { flags: 'wx' });
  server = spawn(process.execPath, [entry], { cwd: root, env: { ...environment, OT_DATABASE_PATH: database, OT_PAYMENT_PROVIDER: mode }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Local compiled server exited');
    let ready = false;
    try { const response = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(1000) }); ready = response.ok && (await response.json()).status === 'ready'; } catch { /* bounded startup */ }
    if (ready) {
      const metadata = await fetch(base + '/_nuxt/builds/latest.json', { signal: AbortSignal.timeout(2000) }); assert.equal(metadata.status, 200); assert.equal((await metadata.json()).id, build.id);
      report.runtimeStarts.push({ label, mode, buildId: build.id, compiledSha256: compiledArtifact.sha256 }); return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Local compiled server readiness failed');
}
async function stop() { if (!server) return; const process = server; server = undefined; if (process.exitCode === null) { const exited = once(process, 'exit'); process.kill(); await exited; } log?.end(); }
async function go(page, path) { await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__)); }
function totp(uri) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const character of new URL(uri).searchParams.get('secret').toUpperCase().replace(/=+$/, '')) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2))); const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest(); return String((digest.readUInt32BE(digest[digest.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function session(actor, mfa) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); contexts.push(context);
  context.on('request', request => { if (recoveryPhase && request.method() === 'POST') recoveryPostRequests++; });
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.fallback() : route.abort(); });
  const page = await context.newPage(); page.on('pageerror', error => { const diagnostic = error.stack || error.message; privateDiagnostics.push(diagnostic); report.javascriptErrors.push({ code: 'BROWSER_PAGE_ERROR', diagnosticSha256: sha(diagnostic) }); });
  await go(page, '/auth/login?returnTo=' + encodeURIComponent(mfa ? '/cabinet/security' : '/cabinet'));
  await page.getByLabel('Email', { exact: true }).fill(actor.email); await page.getByLabel('Пароль', { exact: true }).fill(actor.password);
  const signing = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click(); assert.equal((await signing).status(), 200);
  await page.waitForURL(url => url.pathname === (mfa ? '/cabinet/security' : '/cabinet'));
  if (mfa) {
    await page.getByLabel('Текущий пароль', { exact: true }).fill(actor.password); await page.getByRole('button', { name: 'Настроить приложение', exact: true }).click();
    await expect(page.locator('code')).toContainText('otpauth://'); const uri = await page.locator('code').textContent();
    await page.getByLabel('Код из приложения', { exact: true }).fill(totp(uri)); await page.getByRole('button', { name: 'Подтвердить и включить', exact: true }).click();
    await page.getByText('Настройки безопасности сохранены.', { exact: true }).waitFor();
  }
  return page;
}
const labels = {
  ru: { orders: 'Заказы', open: 'Тестовый возврат с основанием', submit: 'Зарегистрировать тестовый возврат', amount: 'Сумма возврата, ₸', reason: 'Основание и сведения для проверки (не менее 10 символов)', confirm: 'Подтверждаю действие и указанное основание.', refresh: 'Обновить финансовые данные', partial: 'Частично возвращено', full: 'Возвращено', totals: ['Подтверждённая оплата', 'Уже возвращено', 'Остаток для возврата'] },
  kk: { orders: 'Тапсырыстар', open: 'Негіздемемен тестілік қайтару', submit: 'Тестілік қайтаруды тіркеу', amount: 'Қайтару сомасы, ₸', reason: 'Негіздеме және тексеру мәліметтері (кемінде 10 таңба)', confirm: 'Әрекетті және көрсетілген негіздемені растаймын.', refresh: 'Қаржылық деректерді жаңарту', partial: 'Ішінара қайтарылды', full: 'Қайтарылды', totals: ['Расталған төлем', 'Қайтарылған сома', 'Қайтаруға қалған сома'] },
};
const article = (page, id) => page.locator('article').filter({ hasText: id });
async function totals(page, locator, values, locale = 'ru') {
  for (const [index, label] of labels[locale].totals.entries()) await expect(locator.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(money(values[index]));
}
async function fillRefund(page, id, value, reason, locale = 'ru') {
  const text = labels[locale]; await article(page, id).getByRole('button', { name: text.open, exact: true }).click();
  await page.getByLabel(text.amount, { exact: true }).fill(value); await page.getByLabel(text.reason, { exact: true }).fill(reason);
  await page.getByLabel(text.confirm, { exact: true }).check();
}
async function submitRefund(page, id, locale = 'ru') {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/admin/orders/${id}/refund` && response.request().method() === 'POST');
  await page.getByRole('button', { name: labels[locale].submit, exact: true }).click(); const received = await response; assert.equal(received.status(), 200); return received.json();
}
async function get(page, path) { const response = await page.request.get(base + '/api/v1' + path); assert.equal(response.status(), 200); return response.json(); }

try {
  async function seedFixture(label) {
    const seedLog = createWriteStream(resolve(directory, label + '-private.log'), { flags: 'wx', mode: 0o600 });
    const seed = spawn(process.execPath, ['--import', 'tsx', 'tests/refund-browser-fixture.ts'], { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    seed.stdout.pipe(seedLog, { end: false }); seed.stderr.pipe(seedLog, { end: false });
    const [seedCode] = await once(seed, 'exit'); seedLog.end(); return seedCode;
  }
  assert.equal(await seedFixture('seed'), 0, 'Isolated seed failed; diagnostics are private');
  const fixture = JSON.parse(await readFile(environment.OT_E2E_FIXTURE_PATH, 'utf8')); assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY');
  assert.equal(fixture.databasePath, environment.OT_DATABASE_PATH);
  const databaseBeforeRepeat = sha(await readFile(fixture.databasePath)); const fixtureBeforeRepeat = sha(await readFile(environment.OT_E2E_FIXTURE_PATH));
  assert.notEqual(await seedFixture('rejected-existing-seed'), 0, 'Existing owned database must reject fixture replay before migrations');
  assert.equal(sha(await readFile(fixture.databasePath)), databaseBeforeRepeat); assert.equal(sha(await readFile(environment.OT_E2E_FIXTURE_PATH)), fixtureBeforeRepeat);
  report.fixtureSafety = { exclusiveExistingDatabaseRejected: true, existingDatabaseAndFixtureUnchanged: true, seedDiagnostics: 'private .data only' };
  const db = createClient({ url: 'file:' + fixture.databasePath.replaceAll('\\', '/'), concurrency: 1, intMode: 'bigint' }); clients.push(db);
  const academic = async database => Object.fromEntries(await Promise.all(['enrollments', 'lesson_progress', 'attempts', 'credentials'].map(async table => [table, await readBrowserRows(database, `SELECT * FROM ${table} ORDER BY ${table === 'lesson_progress' ? 'enrollment_id,lesson_id' : 'id'}`)])));
  const originalAcademic = await academic(db);
  await start(fixture.databasePath, 'sandbox', 'sandbox-runtime');
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : chromium.executablePath()), headless: true });
  const finance = await session(fixture.actors.finance, true); await go(finance, '/admin');
  await finance.getByRole('heading', { name: 'Заказы', exact: true }).waitFor();
  const { ru, kk, refresh: refreshOrder, manual } = fixture.orders;
  const overview = await get(finance, '/admin/operations'); assert.equal(overview.orders.find(order => order.id === manual.id).refundAllowed, false);
  await totals(finance, article(finance, manual.id), [125000, 0, 125000]); await expect(article(finance, manual.id).getByRole('button', { name: labels.ru.open, exact: true })).toHaveCount(0);
  pass('actual-finance-password-and-TOTP-session; manual-bank-ledger-excluded');

  await fillRefund(finance, ru.id, '0', 'SYNTHETIC partial refund; no real money'); await expect(finance.getByRole('button', { name: labels.ru.submit, exact: true })).toBeDisabled();
  for (const value of ['1250.001', '1250.01']) {
    await finance.getByLabel(labels.ru.amount, { exact: true }).fill(value); await finance.getByLabel(labels.ru.confirm, { exact: true }).check(); await expect(finance.getByRole('button', { name: labels.ru.submit, exact: true })).toBeDisabled();
  }
  await finance.getByLabel(labels.ru.amount, { exact: true }).fill('250,25'); await expect(finance.getByLabel(labels.ru.confirm, { exact: true })).not.toBeChecked(); await finance.getByLabel(labels.ru.confirm, { exact: true }).check();
  const first = await submitRefund(finance, ru.id); assert.equal(first.amountMinor, 25025); assert.equal(first.orderStatus, 'partially_refunded');
  await totals(finance, article(finance, ru.id), [125000, 25025, 99975]); await expect(article(finance, ru.id)).toContainText(labels.ru.partial);
  pass('RU actual partial refund; decimal-comma amount; invalid/overflow precision gated; server totals');
  await finance.getByRole('heading', { name: 'Заказы', exact: true }).locator('..').screenshot({ path: resolve(artifactDirectory, 'finance-ru-partial.png') });
  const learner = await session(fixture.actors.learner, false); await go(learner, '/payment/pending?order=' + ru.id);
  const originalDocumentResponse = await learner.request.get(`${base}/api/v1/credentials/${ru.credentialId}/download`); assert.equal(originalDocumentResponse.status(), 200);
  const originalDocument = await originalDocumentResponse.body(); assert.equal(originalDocument.subarray(0, 5).toString(), '%PDF-');
  await expect(learner.getByRole('heading', { name: labels.ru.partial, exact: true })).toBeVisible(); await totals(learner, learner.locator('.lms-card').filter({ has: learner.getByRole('heading', { name: labels.ru.partial, exact: true }) }), [125000, 25025, 99975]);
  await expect(learner.getByRole('button', { name: 'Создать тестовую платёжную сессию', exact: true })).toHaveCount(0);
  pass('learner reads server partial totals and cannot restart checkout');

  const refundPath = `/api/v1/admin/orders/${ru.id}/refund`; let lostReceipt; const requests = [];
  finance.on('request', request => { if (new URL(request.url()).pathname === refundPath && request.method() === 'POST') requests.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() }); });
  await fillRefund(finance, ru.id, '800', 'SYNTHETIC lost-response retry; no real money');
  await finance.route('**' + refundPath, async route => { const response = await route.fetch(); assert.equal(response.status(), 200); lostReceipt = await response.json(); await route.abort('failed'); }, { times: 1 });
  await finance.getByRole('button', { name: labels.ru.submit, exact: true }).click();
  await finance.getByRole('button', { name: 'Повторить тот же запрос', exact: true }).waitFor(); await expect(finance.getByLabel(labels.ru.amount, { exact: true })).toBeDisabled(); await expect(finance.getByLabel(labels.ru.reason, { exact: true })).toBeDisabled();
  await finance.getByRole('button', { name: labels.ru.refresh, exact: true }).click(); await totals(finance, article(finance, ru.id), [125000, 105025, 19975]);
  await expect(finance.getByRole('button', { name: 'Повторить тот же запрос', exact: true })).toBeEnabled();
  const replaying = finance.waitForResponse(response => new URL(response.url()).pathname === refundPath && response.request().method() === 'POST'); await finance.getByRole('button', { name: 'Повторить тот же запрос', exact: true }).click(); const replay = await replaying; assert.equal(replay.status(), 200); assert.deepEqual(await replay.json(), lostReceipt);
  assert.equal(requests.length, 2); assert.deepEqual(requests[1], requests[0]); assert.ok(requests[0].key); assert.equal(requests[0].body.currency, 'KZT');
  assert.equal((await readBrowserRows(db, 'SELECT COUNT(*) AS count FROM refunds WHERE order_id=?', [ru.id]))[0].count, 2n);
  assert.equal((await readBrowserRows(db, "SELECT COUNT(*) AS count FROM audit_events WHERE action='refund_confirmed' AND target=?", [ru.id]))[0].count, 2n);
  await totals(finance, article(finance, ru.id), [125000, 105025, 19975]);
  pass('actual committed refund with dropped browser response replays exact key/body/receipt after lower server balance; no duplicate', { postRequests: 2, newRefundRows: 1, newAuditEvents: 1 });

  await fillRefund(finance, ru.id, '199.75', 'SYNTHETIC final remainder; no real money'); const finalReceipt = await submitRefund(finance, ru.id); assert.equal(finalReceipt.orderStatus, 'refunded');
  await totals(finance, article(finance, ru.id), [125000, 125000, 0]); await expect(article(finance, ru.id)).toContainText(labels.ru.full); await expect(article(finance, ru.id).getByRole('button', { name: labels.ru.open, exact: true })).toHaveCount(0);
  pass('actual final remainder creates full refund, server total equals paid amount and action disappears');

  await finance.setViewportSize({ width: 390, height: 900 }); await go(finance, '/kk/admin'); await fillRefund(finance, kk.id, '12,34', 'SYNTHETIC KK тестілік қайтару, нақты ақша жоқ', 'kk'); const kkReceipt = await submitRefund(finance, kk.id, 'kk'); assert.equal(kkReceipt.amountMinor, 1234);
  await totals(finance, article(finance, kk.id), [125000, 1234, 123766], 'kk'); await expect(article(finance, kk.id)).toContainText(labels.kk.partial);
  assert.equal(await finance.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await finance.getByRole('heading', { name: labels.kk.orders, exact: true }).locator('..').screenshot({ path: resolve(artifactDirectory, 'finance-kk-mobile.png') });
  await go(learner, '/kk/payment/pending?order=' + kk.id); await expect(learner.getByRole('heading', { name: labels.kk.partial, exact: true })).toBeVisible(); await expect(learner.getByRole('button', { name: 'Тестілік төлем сеансын жасау', exact: true })).toHaveCount(0);
  pass('KK mobile actual partial refund and learner localized status; no horizontal overflow or second checkout');

  await finance.setViewportSize({ width: 1440, height: 1000 }); await go(finance, '/admin'); let blockRefresh = false; let refreshPosts = 0;
  await finance.route('**/api/v1/admin/operations', route => blockRefresh ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, data: { code: 'DATABASE_UNAVAILABLE' } }) }) : route.fallback());
  finance.on('request', request => { if (new URL(request.url()).pathname === `/api/v1/admin/orders/${refreshOrder.id}/refund` && request.method() === 'POST') refreshPosts++; });
  await fillRefund(finance, refreshOrder.id, '50', 'SYNTHETIC successful POST then failed refresh');
  await finance.route(`**/api/v1/admin/orders/${refreshOrder.id}/refund`, async route => { const response = await route.fetch(); assert.equal(response.status(), 200); blockRefresh = true; await route.fulfill({ response }); }, { times: 1 });
  await submitRefund(finance, refreshOrder.id);
  await finance.getByText('Возврат уже подтверждён сервером. Обновите финансовые данные перед следующей операцией; повторять выполненный возврат не нужно.', { exact: true }).waitFor();
  await expect(finance.getByRole('button', { name: labels.ru.submit, exact: true })).toHaveCount(0); await expect(finance.getByRole('button', { name: 'Повторить тот же запрос', exact: true })).toHaveCount(0);
  await expect(finance.getByRole('button', { name: labels.ru.refresh, exact: true })).toBeEnabled(); blockRefresh = false; await finance.getByRole('button', { name: labels.ru.refresh, exact: true }).click();
  await totals(finance, article(finance, refreshOrder.id), [125000, 5000, 120000]); assert.equal(refreshPosts, 1);
  assert.equal((await readBrowserRows(db, 'SELECT COUNT(*) AS count FROM refunds WHERE order_id=?', [refreshOrder.id]))[0].count, 1n);
  assert.equal((await readBrowserRows(db, "SELECT COUNT(*) AS count FROM audit_events WHERE action='refund_confirmed' AND target=?", [refreshOrder.id]))[0].count, 1n);
  pass('successful POST remains final when subsequent GET fails; recovery performs GET only and no second refund');

  await stop(); await start(fixture.databasePath, 'disabled', 'disabled-runtime'); await go(finance, '/admin');
  await finance.getByRole('heading', { name: labels.ru.orders, exact: true }).waitFor(); const disabled = await get(finance, '/admin/operations'); assert.ok(disabled.orders.every(order => order.refundMode === 'disabled' && order.refundAllowed === false));
  await expect(finance.getByRole('button', { name: labels.ru.open, exact: true })).toHaveCount(0); await totals(finance, article(finance, kk.id), [125000, 1234, 123766]);
  await go(learner, '/payment/pending?order=' + ru.id); await expect(learner.getByRole('heading', { name: labels.ru.full, exact: true })).toBeVisible();
  pass('same compiled runtime with disabled provider hides every refund action and preserves financial totals');
  assert.deepEqual(await academic(db), originalAcademic);

  await stop(); const backupStarted = performance.now(); const beforeSnapshot = await exportDatabase(db); const beforeReceipts = await readBrowserRows(db, 'SELECT * FROM refunds ORDER BY id');
  const password = 'SYNTHETIC local recovery backup password 2026!'; const encrypted = encryptBackup(beforeSnapshot, password);
  const archive = resolve(directory, 'recovery.otb'); await writeFile(archive, encrypted, { flag: 'wx', mode: 0o600 }); const backupMs = Math.round(performance.now() - backupStarted);
  const restoredPath = resolve(directory, 'restored.sqlite'); const reservation = await open(restoredPath, 'wx', 0o600); await reservation.close();
  const restored = createClient({ url: 'file:' + restoredPath.replaceAll('\\', '/'), concurrency: 1, intMode: 'bigint' }); clients.push(restored); const restoreStarted = performance.now();
  await restoreDatabase(restored, decryptBackup(await readFile(archive), password)); const restoredSnapshot = await exportDatabase(restored); assert.deepEqual(restoredSnapshot.schema, beforeSnapshot.schema); assert.deepEqual(restoredSnapshot.tables, beforeSnapshot.tables); const restoreMs = Math.round(performance.now() - restoreStarted);
  assert.equal((await readBrowserRows(restored, 'SELECT COUNT(*) AS count FROM schema_migrations'))[0].count, 13n);
  assert.equal(sha(await readFile(entry)), entrySha256); recoveryPhase = true;
  const restartStarted = performance.now(); await start(restoredPath, 'disabled', 'restored-current-runtime');
  const staffSession = await get(finance, '/me'); assert.equal(staffSession.user.id, fixture.actors.finance.id); assert.equal(staffSession.user.mfaVerified, true);
  const learnerSession = await get(learner, '/me'); assert.equal(learnerSession.user.id, fixture.actors.learner.id);
  const recoveredOrders = await get(finance, '/admin/operations');
  for (const original of disabled.orders) assert.deepEqual(recoveredOrders.orders.find(order => order.id === original.id), original);
  assert.deepEqual(await readBrowserRows(restored, 'SELECT * FROM refunds ORDER BY id'), beforeReceipts); assert.deepEqual(await academic(restored), originalAcademic);
  const recoveredLearnerOrder = (await get(learner, '/orders/' + ru.id)).order; assert.equal(recoveredLearnerOrder.status, 'refunded'); assert.equal(recoveredLearnerOrder.refundableMinor, 0);
  const restoredDocumentResponse = await learner.request.get(`${base}/api/v1/credentials/${ru.credentialId}/download`); assert.equal(restoredDocumentResponse.status(), 200);
  assert.equal(sha(await restoredDocumentResponse.body()), sha(originalDocument));
  const deniedDocumentResponse = await finance.request.get(`${base}/api/v1/credentials/${ru.credentialId}/download`); assert.equal(deniedDocumentResponse.status(), 404);
  await go(finance, '/kk/admin'); await finance.getByRole('heading', { name: labels.kk.orders, exact: true }).waitFor(); await totals(finance, article(finance, kk.id), [125000, 1234, 123766], 'kk');
  await expect(finance.getByRole('button', { name: labels.kk.open, exact: true })).toHaveCount(0);
  assert.equal(recoveryPostRequests, 0); assert.equal(sha(await readFile(entry)), entrySha256);
  assert.deepEqual(await compiledFingerprint(), compiledArtifact);
  assert.equal(JSON.parse(await readFile(resolve(buildRoot, '.output/public/_nuxt/builds/latest.json'), 'utf8')).id, build.id);
  pass('restored populated synthetic PDF bytes retain SHA256 and ownership: learner 200, foreign finance 404', { syntheticDocuments: 1, serverGradedAttempts: originalAcademic.attempts.length, documentSha256: sha(originalDocument) });
  report.recovery = { artifactBuildId: build.id, schemaMigrations: 13, tables: beforeSnapshot.tables.length, rows: beforeSnapshot.tables.reduce((sum, table) => sum + table.rows.length, 0), refundRows: beforeReceipts.length, bytes: encrypted.length, sha256: sha(encrypted), backupMs, restoreMs, restartToVerifiedReadsMs: Math.round(performance.now() - restartStarted), sameArtifact: true, preservedSessions: 2, preservedMfa: true, postRequestsAfterRestore: 0, restoreTarget: 'new local database', externalUpload: false };
  pass('encrypted backup and fresh local restore preserve every schema/data value; same compiled013 restart retains financial receipts, learner/staff sessions and MFA', report.recovery);
  assert.deepEqual(report.javascriptErrors, []); report.status = 'passed';
} catch (error) {
  const diagnostic = error instanceof Error ? error.stack || error.message : 'Unknown test failure'; privateDiagnostics.push(diagnostic);
  report.status = 'failed'; report.failures.push({ code: 'REFUND_BROWSER_FAILED', diagnosticSha256: sha(diagnostic) }); process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close(); await browser?.close(); await stop(); for (const client of clients) client.close();
  if (privateDiagnostics.length) await writeFile(resolve(directory, 'failures-private.log'), privateDiagnostics.join('\n\n'), { flag: 'wx', mode: 0o600 });
  report.finishedAt = new Date().toISOString(); await writeFile(resolve(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, buildId: build.id, report: relative(root, resolve(artifactDirectory, 'report.json')), failures: report.failures }));
}
