import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3102';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local test target required');
const phase = process.env.REDESIGN_PHASE || 'before';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid phase');
const output = resolve('artifacts/redesign/2026-09-14', phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
let page = await context.newPage();
const report = { base, phase, generatedAt: new Date().toISOString(), captures: [], errors: [], checks: [], failures: [] };
const mode = process.env.REDESIGN_MODE || 'quick';
const sizes = phase === 'before' ? [{ width: 1440, height: 900 }, { width: 390, height: 844 }] : [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const locales = process.env.REDESIGN_LOCALES?.split(',') || ['ru', 'kk'];
const names = process.env.REDESIGN_NAMES?.split(',');
const excluded = process.env.REDESIGN_EXCLUDE?.split(',') || [];
const watch = p => p.on('pageerror', error => report.errors.push({ url: p.url(), error: error.message }));
watch(page);
async function ready() {
  await page.waitForFunction(() => {
    const app = document.querySelector('#__nuxt')?.__vue_app__;
    return Boolean(app?.$nuxt && app.$nuxt.isHydrating === false);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('body').waitFor({ state: 'visible' });
}
async function capture(name, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await ready();
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, title: document.title, heading: document.querySelector('h1')?.textContent?.trim(), h1Count: document.querySelectorAll('h1').length, language: document.documentElement.lang, selectedCity: [...document.querySelectorAll('header select')].find(el => el.getClientRects().length)?.value || '', brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')) }));
  const path = resolve(output, `${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path, fullPage: true });
  await page.screenshot({ path: path.replace('.png', '-viewport.png') });
  report.captures.push({ name, url: page.url(), viewport, path, ...metrics, overflow: metrics.scrollWidth > metrics.width + 1 });
  await save();
  console.log(path);
}
async function save() { await writeFile(resolve(output, `capture-${mode}-report.json`), JSON.stringify(report, null, 2)); }
async function visit(route) {
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await ready();
  return response?.status();
}
async function matrix(name, route, options = {}) {
  if (excluded.includes(name) || (names && !names.includes(name))) return;
  for (const locale of locales) {
    const target = (locale === 'kk' ? '/kk' : '') + route;
    try {
      const status = await visit(target);
      if (options.setup) await options.setup(locale);
      for (const size of sizes) await capture(`${name}-${locale}`, size);
      report.checks.push({ name, locale, target, status, expectedStatus: options.status || 200 });
    } catch (error) { report.failures.push({ name, target, error: error.stack }); await save(); }
  }
}
const publicRoutes = [
  ['catalog', '/courses'], ['program', '/courses/ohrana-truda'], ['selection', '/program-selection'],
  ['companies', '/b2b'], ['directions', '/categories'], ['direction', '/ohrana-truda'],
  ['city-direction', '/almaty/ohrana-truda'], ['format', '/online-obuchenie'], ['city-format', '/almaty/ochnoe-obuchenie'],
  ['intent', '/srochnoe-obuchenie'], ['city-intent', '/almaty/obuchenie-dlya-tendera'],
  ['articles', '/blog'], ['contacts', '/contacts'], ['licenses', '/licenses'], ['privacy', '/privacy'], ['offer', '/public-offer'],
  ['auth-login', '/auth/login?returnTo=%2Fcabinet'], ['auth-signup', '/auth/signup'], ['auth-forgot', '/auth/forgot'],
  ['auth-reset', '/auth/reset'], ['auth-verify', '/auth/verify'], ['auth-mfa', '/auth/mfa'],
  ['payment', '/payment/ohrana-truda'], ['payment-pending', '/payment/pending'], ['document-invalid', '/verify/redesign-invalid-token'],
  ['certificate-denied', '/certificates/redesign-invalid-id'], ['ui-kit', '/ui-kit'],
];
async function publicMatrix() {
  await matrix('home', '/');
  await matrix('menu', '/', { setup: () => page.locator('.ed-menu-trigger').click() });
  for (const [name, route] of publicRoutes) await matrix(name, route);
  if (phase !== 'before') for (const step of [2, 3, 4]) await matrix('selection-step-' + step, '/program-selection?city=almaty&format=onsite', { setup: async locale => {
    await page.locator('input[name="direction"][value="ohrana-truda"]').check();
    const next = page.getByRole('button', { name: locale === 'ru' ? 'Следующий шаг' : 'Келесі қадам', exact: true });
    await next.click();
    if (step >= 3) {
      await page.getByLabel(locale === 'ru' ? /^Ваша роль/ : /^Сіздің рөліңіз/).selectOption('hr');
      await page.getByLabel(locale === 'ru' ? /^Отрасль/ : /^Сала/).selectOption('industry');
      await next.click();
    }
    if (step === 4) {
      await page.getByLabel(locale === 'ru' ? 'На площадке организации' : 'Ұйым аумағында', { exact: true }).check();
      await next.click();
      await page.getByRole('link', { name: locale === 'ru' ? 'Посмотреть программу' : 'Бағдарламаны көру', exact: true }).waitFor();
    }
  } });
  await matrix('catalog-empty', '/courses?q=zzzz-redesign-no-program', { setup: async () => { await page.locator('.ed-catalog-empty').waitFor(); } });
  await visit('/blog');
  const article = await page.locator('main a[href*="/blog/"]').first().getAttribute('href');
  if (article) await matrix('article', article);
  await matrix('not-found', '/courses/redesign-nonexistent-program', { status: 404 });
  if (phase !== 'before') await matrix('not-found-generic', '/missing-redesign-preview', { status: 404 });
}
function totp(uri) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...new URL(uri).searchParams.get('secret').toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  return String((hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function privateMatrix() {
  assert.equal(process.env.OT_ALLOW_TEST_SEED, '1', 'Explicit isolated fixture authorization required');
  assert.equal(process.env.REDESIGN_SERVER_FIXTURE_CONFIRMED, '1', 'Confirm server is using same fixture database');
  assert.ok(!process.env.TURSO_DATABASE_URL && !process.env.VERCEL, 'Remote environment forbidden');
  const fixture = JSON.parse(await readFile(process.env.OT_E2E_FIXTURE_PATH || '.data/redesign-2026-09-14/fixture.json', 'utf8'));
  assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY');
  assert.equal(resolve(fixture.databasePath), resolve('.data/redesign-2026-09-14/e2e.sqlite'));
  const db = createClient({ url: 'file:' + fixture.databasePath.replaceAll('\\', '/') });
  const password = 'Synthetic-redesign-visual-2026!';
  const hash = await hashPassword(password);
  async function actor(role) {
    const id = `redesign-${role}-${randomUUID()}`;
    const user = { id, name: `TEST ONLY Redesign ${role}`, email: `${id}@example.test`, password };
    await db.execute({ sql: 'INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', args: [id, user.name, user.email, role, Date.now(), Date.now()] });
    await db.execute({ sql: 'INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', args: [id + '-account', id, 'credential', id, hash, Date.now(), Date.now()] });
    return user;
  }
  async function login(user, route) {
    await visit('/auth/login?returnTo=' + encodeURIComponent(route));
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Пароль', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click();
    await page.waitForURL(url => url.pathname === route);
    await ready();
  }
  try {
    const learner = await actor('learner');
    await login(learner, '/courses/ohrana-truda');
    report.checks.push({ name: 'real login returns to selected program', status: 'passed' });
    const variants = page.getByLabel(/^Вариант и язык обучения/);
    const enroll = page.getByRole('button', { name: 'Записаться на обучение', exact: true });
    await variants.or(enroll).first().waitFor();
    if (await variants.count()) await variants.selectOption(fixture.versionId);
    await enroll.click();
    await page.waitForURL(/\/learn\/[^/?]+$/);
    const learn = new URL(page.url()).pathname;
    await matrix('lesson', learn);
    await matrix('cabinet', '/cabinet');
    for (const section of ['organization', 'security', 'reminders']) await matrix('cabinet-' + section, '/cabinet/' + section);
    await visit(learn);
    await page.getByRole('button', { name: 'Материал изучен — завершить урок', exact: true }).click();
    await page.getByText('Урок завершён. Прогресс сохранён на сервере.', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Урок завершён. Прогресс сохранён на сервере.', { exact: true }).waitFor();
    report.checks.push({ name: 'lesson completion survives reload with server state', status: 'passed' });
    await matrix('pre-test', learn + '/pre-test');
    await visit(learn + '/pre-test');
    await page.getByLabel('Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.').check();
    await page.getByRole('button', { name: 'Начать попытку — запустить таймер', exact: true }).click();
    await page.waitForURL(/\/exam\?attempt=/);
    const exam = new URL(page.url());
    await page.getByLabel('Correct test option', { exact: true }).check();
    await page.getByText('Все ответы сохранены', { exact: true }).waitFor();
    await matrix('exam', exam.pathname + exam.search);
    await visit(exam.pathname + exam.search);
    assert.equal(await page.getByLabel('Correct test option', { exact: true }).isChecked(), true);
    report.checks.push({ name: 'exam answer survives sizes, locales, and reload', status: 'passed' });
    await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
    await page.getByLabel('Correct test option', { exact: true }).check();
    await page.getByText('Все ответы сохранены', { exact: true }).waitFor();
    await page.getByLabel('Завершить попытку сейчас. После отправки ответы изменить нельзя.').check();
    await page.getByRole('button', { name: 'Отправить ответы и завершить попытку', exact: true }).click();
    await page.getByRole('heading', { name: 'Проверка знаний пройдена', exact: true }).waitFor();
    const success = new URL(page.url());
    await matrix('exam-result', success.pathname + success.search);
    report.checks.push({ name: 'submitted synthetic attempt produces real passed result', status: 'passed' });
    const adminContext = await browser.newContext({ viewport: sizes[0], reducedMotion: 'reduce' });
    page = await adminContext.newPage(); watch(page);
    const admin = await actor('admin');
    await login(admin, '/cabinet/security');
    await page.getByLabel('Текущий пароль', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: 'Настроить приложение', exact: true }).click();
    await page.locator('code').waitFor();
    await page.getByLabel('Код из приложения', { exact: true }).fill(totp(await page.locator('code').textContent()));
    await page.getByRole('button', { name: 'Подтвердить и включить', exact: true }).click();
    await page.getByText('Настройки безопасности сохранены.', { exact: true }).waitFor();
    report.checks.push({ name: 'synthetic administrator uses actual password and TOTP setup', status: 'passed' });
    for (const section of ['', '/users', '/programs', '/documents', '/document-batches', '/support', '/incidents', '/analytics', '/leads']) await matrix('admin' + (section.replace('/', '-') || '-operations'), '/admin' + section);
  } finally { db.close(); }
}
try {
  if (mode === 'key') {
    await matrix('home', '/');
    await matrix('menu', '/', { setup: () => page.locator('.ed-menu-trigger').click() });
    await matrix('catalog', '/courses');
    await matrix('program', '/courses/ohrana-truda');
  }
  if (mode === 'all' || mode === 'public') await publicMatrix();
  if (mode === 'all' || mode === 'private') await privateMatrix();
  if (mode === 'quick') {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await capture('home-ru');
  await page.locator('.ed-menu-trigger').click();
  await capture('menu-ru');
  await page.keyboard.press('Escape');
  await capture('home-ru', { width: 390, height: 844 });
  await page.locator('.ed-menu-trigger').click();
  await capture('menu-ru', { width: 390, height: 844 });
  }
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.summary = {
    captures: report.captures.length,
    routes: report.checks.filter(check => 'target' in check).length,
    overflow: report.captures.filter(capture => capture.overflow).length,
    brokenImages: report.captures.filter(capture => capture.brokenImages?.length).length,
    pageErrors: report.errors.length,
    failures: report.failures.length + Number(Boolean(report.failure)),
    unexpectedStatus: report.checks.filter(check => check.expectedStatus && check.status !== check.expectedStatus).length,
  };
  await save();
  console.log(JSON.stringify(report.summary, null, 2));
  if (phase !== 'before' && Object.entries(report.summary).some(([key, value]) => !['captures', 'routes'].includes(key) && value > 0)) process.exitCode = 1;
  await browser.close();
}
