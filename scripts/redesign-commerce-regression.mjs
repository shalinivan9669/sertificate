import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3102';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local preview only');
const out = 'artifacts/redesign/2026-09-14/' + (process.env.REDESIGN_COMMERCE_PHASE || 'commerce-after-v2');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const report = { checks: [], screenshots: [], errors: [], hydrationWarnings: [], boundary: 'Public pages use actual local catalog. Selected-version, recovery submission and organization states use explicitly synthetic intercepted API responses; no enrollment, order or email is created.' };
page.on('pageerror', error => report.errors.push({ url: page.url(), error: error.message }));
page.on('console', event => { if (/hydration/i.test(event.text())) report.hydrationWarnings.push({ url: page.url(), text: event.text() }); });
async function go(route) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false);
  await page.evaluate(() => document.fonts.ready);
}
async function fit(name) {
  const measurement = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(measurement.document, name).toBeLessThanOrEqual(measurement.viewport + 1);
  report.checks.push({ name, ...measurement });
}
async function shot(name) {
  const file = out + '/' + name + '.png';
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}
try {
  for (const lang of ['', '/kk']) {
    for (const [width, height] of [[1440, 900], [1280, 720], [820, 1180], [390, 844], [360, 800]]) {
      await page.setViewportSize({ width, height });
      await go(lang + '/courses?city=atyrau&format=onsite');
      await expect(page.locator('.ed-course-row').first()).toBeVisible();
      await fit('catalog ' + lang + ' ' + width);
      if ([1440,390].includes(width)) await shot('catalog-' + (lang ? 'kk' : 'ru') + '-' + width);
      await go(lang + '/courses/iso-9001?city=atyrau&format=onsite');
      await expect(page.locator('.ed-program-passport')).toBeVisible();
      await fit('program ' + lang + ' ' + width);
      if ([1440,390].includes(width)) await shot('program-' + (lang ? 'kk' : 'ru') + '-' + width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await go('/courses?city=atyrau&format=onsite');
  await page.locator('.ed-catalog-search input').fill('NOT-FOUND-QA');
  await page.locator('.ed-catalog-filters button').click();
  await expect(page.locator('.ed-catalog-empty')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('NOT-FOUND-QA');
  await page.getByRole('button', { name: 'Показать все программы', exact: true }).click();
  await expect(page.locator('.ed-course-row')).toHaveCount(20);
  expect(new URL(page.url()).searchParams.get('city')).toBe('atyrau');
  expect(new URL(page.url()).searchParams.get('format')).toBe('onsite');
  await page.locator('.ed-catalog-search input').fill('ISO');
  await page.locator('.ed-catalog-filters button').click();
  await expect.poll(() => page.locator('.ed-course-row').count()).toBeGreaterThan(0);
  await page.locator('.ed-course-description h2 a').first().click();
  await expect(page.locator('.ed-program-passport')).toBeVisible();
  const back = new URL(await page.locator('.lms-nav-back').getAttribute('href'), base);
  expect(back.searchParams.get('q')).toBe('ISO');
  expect(back.searchParams.get('city')).toBe('atyrau');
  expect(back.searchParams.get('format')).toBe('onsite');
  await page.locator('.lms-nav-back').click();
  await expect(page.locator('.ed-catalog-search input')).toHaveValue('ISO');
  report.checks.push({ name: 'URL filters, empty recovery and program back preserve selected context', passed: true });

  for (const lang of ['', '/kk']) {
    const destination = lang + '/payment/ohrana-truda?versionId=qa-version&city=atyrau&format=onsite';
    await go(lang + '/auth/login?returnTo=' + encodeURIComponent(destination));
    const forgot = page.locator('a[href*="/auth/forgot"]').first();
    const verify = page.locator('a[href*="/auth/verify"]').first();
    for (const link of [forgot, verify]) expect(new URL(await link.getAttribute('href'), base).searchParams.get('returnTo')).toBe(destination);
    await forgot.click();
    await page.waitForURL(url => url.pathname === lang + '/auth/forgot');
    await expect(page.locator('h1')).toContainText(lang ? 'Қолжетімділікті қалпына келтіру' : 'Восстановление доступа');
    let capturedReset = null;
    await page.route('**/api/auth/request-password-reset', async route => {
      capturedReset = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.locator('input[type=email]').fill('qa-no-mail@example.invalid');
    await page.locator('.ed-auth-form form button').click();
    await expect.poll(() => capturedReset).not.toBeNull();
    expect(new URL(capturedReset.redirectTo, base).searchParams.get('returnTo')).toBe(destination);
    expect(new URL(capturedReset.redirectTo, base).pathname).toBe(lang + '/auth/reset');
    await page.unroute('**/api/auth/request-password-reset');
    report.checks.push({ name: 'Auth forgot/verify/reset callback preserves full destination ' + (lang || 'ru'), passed: true });
  }
  await go('/cabinet?city=almaty&format=classroom#assessments');
  const login = page.locator('.lms-error a[href*="/auth/login"]').first();
  await expect(login).toBeVisible();
  expect(new URL(await login.getAttribute('href'), base).searchParams.get('returnTo')).toBe('/cabinet?city=almaty&format=classroom#assessments');
  report.checks.push({ name: 'Unauthorized cabinet preserves destination fragment after hydration', passed: true });

  const publicProgram = (await (await fetch(base + '/api/v1/catalog/programs/ohrana-truda')).json()).program;
  const version = (id, format) => ({ id, title: 'Изолированный вариант ' + id, language: 'ru', durationHours: 16, priceMinor: 0, currency: 'KZT', modules: [{ id: 'qa-module', title: 'Учебная тема для проверки интерфейса', lessons: [{ id: 'qa-lesson', title: 'Изолированный материал', kind: 'text', required: true }] }], audience: 'Синтетическая проверка интерфейса.', outcomes: 'Не является опубликованной учебной программой.', format, intakeOpen: true, accessModel: 'free', billingBasis: 'learner' });
  const fixtureProgram = { ...publicProgram, versions: [version('qa-version-a', 'online'), version('qa-version-b', 'onsite')], availability: 'published' };
  await page.route('**/api/v1/catalog/programs/ohrana-truda', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ program: fixtureProgram }) }));
  await page.route('**/api/v1/enrollments', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ statusCode: 401, message: 'Synthetic unauthorized response' }) }));
  await go('/courses/ohrana-truda?city=atyrau&format=onsite');
  await expect(page.locator('.ed-version-field select')).toBeVisible();
  await page.locator('.ed-version-field select').selectOption('qa-version-a');
  await expect.poll(() => new URL(page.url()).searchParams.get('versionId')).toBe('qa-version-a');
  await page.getByRole('button', { name: /Записаться на обучение/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/auth/login');
  const retained = new URL(new URL(page.url()).searchParams.get('returnTo'), base);
  expect(retained.searchParams.get('versionId')).toBe('qa-version-a');
  expect(retained.searchParams.get('city')).toBe('atyrau');
  expect(retained.searchParams.get('format')).toBe('onsite');
  report.checks.push({ name: 'Synthetic free version remains selected through 401 redirect', passed: true });
  await go('/payment/ohrana-truda?versionId=qa-version-a&city=atyrau&format=onsite');
  const paymentBack = new URL(await page.locator('.lms-nav-back').getAttribute('href'), base);
  expect(paymentBack.searchParams.get('versionId')).toBe('qa-version-a');
  expect(paymentBack.searchParams.get('city')).toBe('atyrau');
  expect(paymentBack.searchParams.get('format')).toBe('onsite');
  report.checks.push({ name: 'Payment back includes version and context', passed: true });
  await page.unroute('**/api/v1/enrollments');
  await page.unroute('**/api/v1/catalog/programs/ohrana-truda');
  expect(report.errors).toHaveLength(0);
  expect(report.hydrationWarnings).toHaveLength(0);
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({ path: out + '/failure.png', fullPage: true });
  process.exitCode = 1;
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ passed: !report.failure, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, hydrationWarnings: report.hydrationWarnings, failure: report.failure, report: out + '/report.json' }, null, 2));
}
