import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { chromium, expect } from '@playwright/test';

// A single initial navigation is permitted. Every UI interaction below uses keyboard events.
if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key])) throw new Error('Explicit isolated keyboard test environment required');
const root = resolve('.');
const artifactRoot = resolve(process.env.OT_KEYBOARD_ARTIFACT_ROOT || '');
assert.ok(basename(artifactRoot).startsWith('keyboard-pilot-') && artifactRoot.startsWith(resolve('.data') + '\\'), 'Use the copied artifact in its own ignored keyboard-pilot-* directory');
const build = JSON.parse(await readFile(resolve(artifactRoot, '.output/public/_nuxt/builds/latest.json'), 'utf8'));
const directory = resolve(artifactRoot, 'run-' + randomUUID()); await mkdir(directory, { recursive: false });
const output = resolve('artifacts/keyboard-learning'); await mkdir(output, { recursive: true });
const base = 'http://127.0.0.1:3107';
const env = { ...process.env, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', HOST: '127.0.0.1', PORT: '3107', BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base,
  BETTER_AUTH_SECRET: 'isolated-keyboard-learning-secret-not-production-2026', OT_DATABASE_PATH: resolve(directory, 'e2e.sqlite'), OT_E2E_FIXTURE_PATH: resolve(directory, 'fixture.json'), OT_MIGRATIONS_DIR: resolve(artifactRoot, 'migrations'),
  OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_INVOICE_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled' };
for (const key of Object.keys(env)) if (/^(?:SMTP_|MAIL_FROM$|AMO_|TURSO_|VERCEL|OT_SANDBOX_|CRON_SECRET$|OT_ALERT_EMAIL$)/.test(key)) delete env[key];
const probe = createServer(); probe.listen(3107, '127.0.0.1'); await once(probe, 'listening'); await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
function child(args, options = {}) { return spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: 'inherit', ...options }); }
const fixtureSource = resolve(artifactRoot, 'fixture-source');
const seed = child(['--import', 'tsx', resolve(fixtureSource, 'tests/e2e-fixtures.ts')], { cwd: fixtureSource }); const [seedCode] = await once(seed, 'exit'); assert.equal(seedCode, 0);
const fixture = JSON.parse(await readFile(env.OT_E2E_FIXTURE_PATH, 'utf8')); assert.equal(fixture.notice, 'SYNTHETIC LOCAL TEST DATA ONLY');
const log = createWriteStream(resolve(directory, 'server.log'), { flags: 'wx' });
const server = child([resolve(artifactRoot, '.output/server/index.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.pipe(log); server.stderr.pipe(log);
const checks = [], errors = [], focusTrail = [], actions = [], responses = [];
let browser, page, enrollmentId, attemptId, failed = null;
const passed = name => { checks.push({ name, status: 'passed' }); console.log('PASS', name); };
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Isolated server exited during startup');
    try { const result = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(1000) }); ready = result.ok && (await result.json()).status === 'ready'; } catch { /* bounded readiness */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Copied Node artifact passes schema readiness');
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const initial = await page.goto(base + '/auth/login?returnTo=%2Fcabinet', { waitUntil: 'domcontentloaded' }); assert.equal(initial.status(), 200);
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  async function focusState() {
    return page.evaluate(() => {
      const element = document.activeElement; if (!(element instanceof HTMLElement)) return null;
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return { tag: element.tagName, type: element.getAttribute('type'), name: element.getAttribute('aria-label') || [...(element.labels || [])].map(label => label.textContent.trim()).join(' ') || element.textContent.trim().slice(0, 140) || element.querySelector('img')?.alt || '',
        href: element.getAttribute('href'), focusVisible: element.matches(':focus-visible'), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow,
        inHeader: Boolean(element.closest('header')), inLms: Boolean(element.closest('.lms')), bounds: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewportWidth: innerWidth, viewportHeight: innerHeight }, inViewport: box.top >= -1 && box.bottom <= innerHeight + 1 && box.left >= -1 && box.right <= innerWidth + 1 };
    });
  }
  async function press(key) { actions.push({ kind: 'key', key, path: new URL(page.url()).pathname }); await page.keyboard.press(key); }
  async function tabTo(locator, name, backwards = false) {
    await expect(locator).toBeVisible(); await expect(locator).toBeEnabled();
    for (let i = 0; i < 130; i++) {
      if (await locator.evaluate(element => element === document.activeElement)) {
        // Native Tab scrolling uses the site's smooth-scroll CSS. Only observe it settling.
        await expect.poll(async () => (await focusState()).inViewport, { timeout: 2500, message: name + ': native keyboard scrolling brings the control into view' }).toBe(true);
        const state = await focusState();
        assert.ok(state.focusVisible, name + ': visible keyboard focus selector');
        assert.ok(parseFloat(state.outlineWidth) >= 1 && state.outlineStyle !== 'none' || state.boxShadow !== 'none', name + ': focus indicator');
        assert.ok(state.inViewport, name + ': focused control is visible in viewport');
        focusTrail.push({ target: name, tabSteps: i, backwards, ...state }); return state;
      }
      await press(backwards ? 'Shift+Tab' : 'Tab');
    }
    throw new Error('Keyboard focus never reached ' + name);
  }
  async function activate(locator, name, key = 'Enter', backwards = false) { await tabTo(locator, name, backwards); await press(key); }
  async function requestByKey(path, method, perform) {
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === method);
    await perform(); const response = await responsePromise; const body = await response.json(); responses.push({ path, method, status: response.status() }); assert.equal(response.status(), 200, JSON.stringify(body)); return body;
  }
  const brand = page.locator('header').getByRole('link', { name: 'OT Center', exact: true });
  await tabTo(brand, 'Header brand link');
  await page.screenshot({ path: resolve(output, 'header-keyboard-focus.png') });
  const email = page.getByLabel('Email', { exact: true }); const password = page.getByLabel('Пароль', { exact: true });
  await tabTo(email, 'Email label');
  await press('Tab'); assert.equal(await password.evaluate(element => element === document.activeElement), true);
  await press('Shift+Tab'); assert.equal(await email.evaluate(element => element === document.activeElement), true);
  actions.push({ kind: 'typedCredential', field: 'email', characters: fixture.learner.email.length }); await page.keyboard.type(fixture.learner.email);
  await tabTo(password, 'Password label');
  actions.push({ kind: 'typedCredential', field: 'password', characters: fixture.learner.password.length }); await page.keyboard.type(fixture.learner.password);
  await requestByKey('/api/auth/sign-in/email', 'POST', () => activate(page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }), 'Login submit'));
  await page.waitForURL(url => url.pathname === '/cabinet');
  await expect(page.getByRole('heading', { name: 'Моё обучение', exact: true })).toBeVisible();
  passed('Tab and Shift+Tab expose labelled login fields and visible header/LMS focus; Enter performs real login to cabinet');

  await activate(page.getByRole('navigation', { name: 'Навигация обучения' }).getByRole('link', { name: /Каталог программ/ }), 'Cabinet to catalog');
  await page.waitForURL(url => url.pathname === '/courses');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Охрана труда', exact: true }) });
  await activate(card.getByRole('link', { name: 'Содержание и условия', exact: true }), 'Named course card');
  await page.waitForURL(url => url.pathname === '/courses/' + fixture.programId);
  await requestByKey('/api/v1/enrollments', 'POST', () => activate(page.getByRole('button', { name: 'Записаться на обучение', exact: true }), 'Enroll selected program'));
  await page.waitForURL(/\/learn\/[^/?]+$/); enrollmentId = new URL(page.url()).pathname.split('/').pop();
  const completion = page.getByRole('button', { name: 'Материал изучен — завершить урок', exact: true });
  await requestByKey(`/api/v1/enrollments/${enrollmentId}/progress/${fixture.lessonId}`, 'PUT', () => activate(completion, 'Complete material'));
  const completedStatus = page.getByRole('status').filter({ hasText: 'Завершение урока сохранено.' }); await expect(completedStatus).toBeVisible();
  passed('Keyboard navigation reaches the named catalog card, enrolls and completes a real lesson; completion has a status region');

  await activate(page.getByRole('link', { name: /^Условия проверки знаний\s*→?$/ }), 'Knowledge-check conditions');
  await page.waitForURL(/\/pre-test$/);
  const start = page.getByRole('button', { name: 'Начать попытку — запустить таймер', exact: true }); await expect(start).toBeDisabled();
  const agree = page.getByRole('checkbox', { name: 'Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.', exact: true });
  await activate(agree, 'Pre-test consent', 'Space'); await expect(agree).toBeChecked();
  const attempt = await requestByKey(`/api/v1/enrollments/${enrollmentId}/attempts`, 'POST', () => activate(start, 'Start timed attempt'));
  await page.waitForURL(/\/exam\?attempt=/); attemptId = new URL(page.url()).searchParams.get('attempt'); assert.equal(attemptId, attempt.id);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  passed('Space checks explicit pre-test consent and unlocks Enter start; fixed server attempt has a non-announcing timer');

  const status = page.getByRole('status').filter({ hasText: /Сохраняем|Все ответы сохранены|Есть несохранённые/ });
  for (let question = 0; question < 2; question++) {
    const correct = page.getByRole('checkbox', { name: 'Correct test option', exact: true });
    const saved = await requestByKey(`/api/v1/attempts/${attemptId}/answers/${attempt.questions[question].id}`, 'PUT', () => activate(correct, `Question ${question + 1} option`, 'Space'));
    await expect(correct).toBeChecked(); assert.equal(saved.answers[attempt.questions[question].id].length, 1);
    await expect(status).toHaveText('Все ответы сохранены'); await expect(status).toHaveAttribute('aria-live', 'polite');
    if (!question) await activate(page.getByRole('button', { name: 'Следующий вопрос', exact: true }), 'Next question');
  }
  await page.screenshot({ path: resolve(output, 'exam-keyboard-focus.png'), fullPage: true });
  passed('Space selects both exam answers; Enter changes question; actual PUT autosaves finish in polite saved-status region');

  const submit = page.getByRole('button', { name: 'Отправить ответы и завершить попытку', exact: true }); await expect(submit).toBeDisabled();
  const finish = page.getByRole('checkbox', { name: 'Завершить попытку сейчас. После отправки ответы изменить нельзя.', exact: true });
  await activate(finish, 'Final irreversible confirmation', 'Space'); await expect(finish).toBeChecked();
  const graded = await requestByKey(`/api/v1/attempts/${attemptId}/submit`, 'POST', () => activate(submit, 'Submit answers'));
  assert.equal(graded.status, 'graded'); assert.equal(graded.result.pass, true); assert.equal(graded.result.correct, 2);
  await expect(page.getByRole('heading', { name: 'Проверка знаний пройдена', exact: true })).toBeVisible();
  await writeFile(resolve(output, 'result-accessibility.yml'), await page.locator('.lms').ariaSnapshot());
  await page.screenshot({ path: resolve(output, 'keyboard-server-result.png'), fullPage: true });
  passed('Keyboard-only explicit final confirmation and Enter submit produce the actual server-graded result with a named heading');

  await activate(page.getByRole('link', { name: 'Открыть личный кабинет', exact: true }), 'Result to cabinet');
  await page.waitForURL(url => url.pathname === '/cabinet');
  await requestByKey('/api/auth/sign-out', 'POST', () => activate(page.getByRole('button', { name: 'Выйти', exact: true }), 'Logout', 'Enter', true));
  await page.waitForURL(url => url.pathname === '/auth/login');
  assert.equal((await context.request.get(base + '/api/v1/me')).status(), 401);
  assert.deepEqual(errors, []);
  passed('Tab/Shift+Tab reach cabinet logout; Enter invalidates the real session, protected API returns401, and JavaScript errors stay zero');
} catch (error) {
  failed = error.stack; if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ status: failed ? 'failed' : 'passed', buildId: build.id, base, checkedAt: new Date().toISOString(), scope: 'keyboard-only actual local learning; no screen reader or physical-device claim', syntheticOnly: true, externalDelivery: false, initialNavigations: 1, inputMethods: ['Tab', 'Shift+Tab', 'Enter', 'Space', 'keyboard character events in focused auth fields'], checks, errors, failed, enrollmentId, attemptId, focusTrail, actions, responses }, null, 2));
  if (browser) await browser.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  log.end();
}
