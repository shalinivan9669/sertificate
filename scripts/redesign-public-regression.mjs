import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3102';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const phase = process.env.REDESIGN_PHASE || 'after';
assert.match(phase, /^[a-z0-9-]+$/);
const output = resolve('artifacts/redesign/2026-09-14', phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const report = { base, phase, generatedAt: new Date().toISOString(), checks: [], failures: [], pageErrors: [], hydration: [], blockedMutations: [] };
await page.route('**/*', route => {
  const request = route.request();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
    report.blockedMutations.push({ url: request.url(), method: request.method() });
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
page.on('pageerror', e => report.pageErrors.push({ url: page.url(), error: e.message }));
page.on('console', e => { if (/hydration/i.test(e.text())) report.hydration.push({ url: page.url(), text: e.text() }); });
async function go(route) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await ready();
}
async function ready() {
  await page.waitForFunction(() => {
    const app = document.querySelector('#__nuxt')?.__vue_app__;
    return Boolean(app?.$nuxt && app.$nuxt.isHydrating === false);
  });
  await page.evaluate(() => document.fonts.ready);
}
async function check(name, fn) {
  if (process.env.REDESIGN_CHECK_FILTER && !new RegExp(process.env.REDESIGN_CHECK_FILTER).test(name)) return;
  try { await fn(); report.checks.push({ name, status: 'passed' }); }
  catch (error) { report.failures.push({ name, error: error.stack, url: page.url() }); await page.screenshot({ path: resolve(output, `regression-failure-${report.failures.length}.png`), fullPage: true }).catch(() => {}); }
  await writeFile(resolve(output, 'public-regression.json'), JSON.stringify(report, null, 2));
}
const sizes = [[1440, 900], [1280, 720], [820, 1180], [390, 844], [360, 800]];
const trigger = page.locator('.ed-menu-trigger');
const menu = page.locator('#editorial-menu');
try {
  for (const locale of ['ru', 'kk']) {
    const prefix = locale === 'kk' ? '/kk' : '';
    for (const [width, height] of sizes) {
      await check(`${locale} menu keyboard, focus, reflow ${width}×${height}`, async () => {
        await page.setViewportSize({ width, height }); await go(prefix + '/?city=almaty&format=classroom');
        await page.evaluate(() => window.scrollTo(0, 260));
        await trigger.focus();
        const initialScroll = await page.evaluate(() => scrollY);
        await page.keyboard.press('Enter'); await expect(menu).toBeVisible();
        assert.equal(await menu.evaluate(el => el.contains(document.activeElement)), true, 'Initial focus inside menu');
        for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
        assert.equal(await menu.evaluate(el => el.contains(document.activeElement)), true, 'Tab stays in menu');
        const bounds = await menu.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, viewport: innerWidth, document: document.documentElement.scrollWidth }));
        assert.ok(bounds.scroll <= bounds.client + 1 && bounds.document <= bounds.viewport + 1, JSON.stringify(bounds));
        await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible(); await expect(trigger).toBeFocused();
        await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - initialScroll) <= 1, 'Menu preserves document scroll position');
      });
    }
    await check(`${locale} menu tab keyboard, search, empty result, resize and chosen city`, async () => {
      await page.setViewportSize({ width: 1440, height: 900 }); await go(prefix + '/?city=almaty&format=classroom');
      await trigger.click();
      await menu.locator('#ed-nav-tab-programs').click();
      const search = menu.getByRole('searchbox');
      await search.fill('ISO'); await expect(menu.locator('.ed-nav-programs a')).toHaveCount(2);
      await page.setViewportSize({ width: 360, height: 460 }); await expect(search).toHaveValue('ISO');
      await search.fill('zz-redesign-no-direction'); await expect(menu.locator('.ed-nav-empty')).toBeVisible();
      await menu.locator('.ed-nav-empty button').click(); await expect(menu.locator('.ed-nav-programs a')).toHaveCount(20);
      await menu.locator('#ed-nav-tab-programs').focus(); await page.keyboard.press('ArrowRight');
      await expect(menu.locator('#ed-nav-tab-places')).toBeFocused(); await expect(menu.locator('#ed-nav-panel-places')).toBeVisible();
      await menu.locator('.ed-nav-city-links a').filter({ hasText: locale === 'ru' ? 'Астана' : 'Астана' }).click();
      await expect(menu).not.toBeVisible();
      await page.waitForURL(url => url.searchParams.get('city') === 'astana');
      assert.equal(new URL(page.url()).searchParams.get('city'), 'astana');
      assert.equal(new URL(page.url()).searchParams.get('format'), 'classroom');
      await expect(page.locator('header select:visible').first()).toHaveValue('astana');
    });
    await check(`${locale} catalog search, empty result, form survives menu and resize`, async () => {
      await go(prefix + '/courses?city=almaty&format=classroom');
      const search = page.locator('main input[type="search"]').first();
      await search.fill('redesign-no-match-92741');
      await trigger.click(); await expect(menu).toBeVisible();
      await page.setViewportSize({ width: 390, height: 460 });
      await page.keyboard.press('Escape');
      await expect(search).toHaveValue('redesign-no-match-92741');
      await page.locator('main form[role="search"] button').click();
      await expect(page.locator('.ed-course-list article')).toHaveCount(0);
      await expect(page.locator('.ed-catalog-empty')).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get('q'), 'redesign-no-match-92741');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready();
      await page.locator('.ed-catalog-empty').waitFor();
      await expect(search).toHaveValue('redesign-no-match-92741');
      await page.locator('.ed-catalog-empty button').click();
      await expect(page.locator('.ed-course-list article').first()).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get('q'), null);
      const link = page.locator('main a[href*="/courses/ohrana-truda"]').first();
      const href = await link.getAttribute('href');
      const url = new URL(href, base); assert.equal(url.searchParams.get('city'), 'almaty'); assert.equal(url.searchParams.get('format'), 'classroom');
    });
    await check(`${locale} four-step selection retains direction, role, industry, format and city`, async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await go(prefix + '/program-selection?city=almaty&format=classroom');
      await page.locator('input[name="direction"][value="ohrana-truda"]').check();
      const next = page.getByRole('button', { name: locale === 'ru' ? 'Следующий шаг' : 'Келесі қадам', exact: true });
      await next.click();
      await page.getByLabel(locale === 'ru' ? /^Ваша роль/ : /^Сіздің рөліңіз/).selectOption('hr');
      await page.getByLabel(locale === 'ru' ? /^Отрасль/ : /^Сала/).selectOption('industry');
      await next.click();
      await page.getByLabel(locale === 'ru' ? 'На площадке организации' : 'Ұйым аумағында', { exact: true }).check();
      await next.click();
      const program = page.getByRole('link', { name: locale === 'ru' ? 'Посмотреть программу' : 'Бағдарламаны көру', exact: true });
      const url = new URL(await program.getAttribute('href'), base);
      for (const [key, value] of Object.entries({ city: 'almaty', format: 'onsite', role: 'hr', industry: 'industry' })) assert.equal(url.searchParams.get(key), value);
      await program.click(); await expect(page).toHaveURL(url.toString());
      assert.match(await page.locator('h1').innerText(), locale === 'ru' ? /[А-Яа-я]/ : /[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/);
    });
    await check(`${locale} auth return destination and anonymous assessment are preserved`, async () => {
      await go(prefix + '/cabinet?city=almaty&format=classroom#assessments');
      const signIn = page.locator('main a[href*="/auth/login"]').first();
      const href = new URL(await signIn.getAttribute('href'), base);
      assert.match(href.searchParams.get('returnTo'), /#assessments$/);
      await signIn.click();
      await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get('returnTo'), href.searchParams.get('returnTo'));
    });
    await check(`${locale} portrait-landscape preserves entered search and open menu`, async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await go(prefix + '/courses');
      const search = page.locator('main input[type="search"]').first();
      await search.fill(locale === 'ru' ? 'Охрана труда' : 'Еңбекті қорғау');
      const entered = await search.inputValue();
      await trigger.click(); await menu.locator('#ed-nav-tab-programs').click();
      await menu.getByRole('searchbox').fill('ISO');
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(menu).toBeVisible(); await expect(menu.getByRole('searchbox')).toHaveValue('ISO');
      await page.screenshot({ path: resolve(output, `landscape-menu-${locale}-844x390.png`) });
      await page.keyboard.press('Escape'); await expect(search).toHaveValue(entered);
      await page.setViewportSize({ width: 390, height: 844 }); await expect(search).toHaveValue(entered);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });
    await check(`${locale} 200 percent zoom equivalent reflow with keyboard menu`, async () => {
      // A 1440×900 physical viewport at 200% browser zoom exposes 720×450 CSS
      // pixels and a pixel ratio of two. CSS zoom alone leaves media queries
      // at 1440px and does not reproduce browser zoom breakpoints.
      const zoomContext = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      const zoomPage = await zoomContext.newPage();
      try {
        await zoomPage.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.abort('blockedbyclient') : route.continue());
        await zoomPage.goto(base + prefix + '/courses', { waitUntil: 'domcontentloaded' });
        await zoomPage.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false);
        await zoomPage.evaluate(() => document.fonts.ready);
        const metrics = await zoomPage.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, ratio: devicePixelRatio }));
        assert.ok(metrics.document <= metrics.viewport + 1, JSON.stringify(metrics));
        assert.equal(metrics.ratio, 2);
        const zoomTrigger = zoomPage.locator('.ed-menu-trigger');
        await zoomTrigger.focus(); await zoomPage.keyboard.press('Enter'); await expect(zoomPage.locator('#editorial-menu')).toBeVisible();
        await zoomPage.screenshot({ path: resolve(output, `zoom200-menu-${locale}.png`) });
        await zoomPage.keyboard.press('Escape'); await expect(zoomTrigger).toBeFocused();
        await zoomPage.locator('main input[type="search"]').fill('ISO');
      } finally { await zoomContext.close(); }
    });
    await check(`${locale} reduced motion and unavailable artwork preserve content and primary action`, async () => {
      const pattern = '**/images/editorial/**';
      await page.route(pattern, route => route.abort('failed'));
      try {
        await page.setViewportSize({ width: 390, height: 844 }); await go(prefix + '/');
        assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
        await expect(page.locator('.ed-cover--fallback')).toBeVisible();
        await expect(page.locator('.ed-cover h1')).toBeVisible();
        const primary = page.locator('.ed-cover-actions a[href*="/program-selection"]').first();
        await expect(primary).toBeVisible();
        const bounds = await primary.boundingBox(); assert.ok(bounds.height >= 44, 'Primary touch target at least 44px');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: resolve(output, `image-unavailable-reduced-motion-${locale}.png`) });
        await primary.click(); await page.waitForURL(/\/program-selection/);
      } finally { await page.unroute(pattern); }
    });
    await check(`${locale} unknown route recovers to correct locale catalog`, async () => {
      await go(prefix + '/missing-redesign-preview');
      await expect(page.locator('.ed-error-page')).toBeVisible();
      await expect(page.locator('h1')).toHaveText(locale === 'ru' ? 'Страница не найдена' : 'Бет табылмады');
      await page.locator('.ed-error-primary').click();
      await page.waitForURL(base + prefix + '/courses');
      await ready(); await expect(page.locator('.ed-catalog-filters')).toBeVisible();
    });
  }
} finally {
  await writeFile(resolve(output, 'public-regression.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, pageErrors: report.pageErrors, hydration: report.hydration }, null, 2));
  process.exitCode = report.failures.length || report.pageErrors.length || report.hydration.length ? 1 : 0;
  await browser.close();
}
