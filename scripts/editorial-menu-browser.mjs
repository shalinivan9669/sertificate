import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3103';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local verification only');
const out = 'artifacts/editorial/menu';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const report = { checks: [], errors: [], hydrationWarnings: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', event => { if (/hydration/i.test(event.text())) report.hydrationWarnings.push({url:page.url(),text:event.text()}); });
const menu = page.locator('#editorial-menu');
async function ready(route) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.evaluate(() => document.fonts.ready);
}
async function fit(name) {
  const result = await menu.evaluate(el => ({ width: innerWidth, document: document.documentElement.scrollWidth, menu: el.scrollWidth, client: el.clientWidth }));
  expect(result.document, name).toBeLessThanOrEqual(result.width + 1);
  expect(result.menu, name).toBeLessThanOrEqual(result.client + 1);
  report.checks.push({ name, ...result });
}
async function section(value, width) {
  if (width <= 700) await menu.locator('select').selectOption(value);
  else await menu.locator('#ed-nav-tab-' + value).click();
  await expect(menu.locator('#ed-nav-panel-' + value)).toBeVisible();
}
try {
  for (const locale of ['', '/kk']) {
    await ready(locale + '/?city=almaty&format=classroom');
    for (const [width, height] of [[360,800],[390,844],[768,1024],[820,820],[1024,768],[1440,1000],[1920,1080],[844,390]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.ed-menu-trigger').click();
      await expect(menu).toBeVisible();
      for (const id of ['start','programs','places','learning','center']) {
        await section(id, width);
        await fit(`${locale || 'ru'} ${id} ${width}x${height}`);
        if ([390,820,1440].includes(width)) {
          await menu.evaluate(el => { el.scrollTop = 0; });
          await page.screenshot({ path: `${out}/${locale ? 'kk' : 'ru'}-${id}-${width}.png` });
        }
      }
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
      await expect(page.locator('.ed-menu-trigger')).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready('/courses/ohrana-truda?city=almaty&format=classroom');
  await page.locator('.ed-menu-trigger').click();
  await expect(menu.getByRole('tab', { name: /Начать обучение/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('tab', { name: /Направления/ })).toBeFocused();
  await expect(menu.locator('#ed-nav-panel-programs')).toBeVisible();
  await menu.getByRole('searchbox').fill('ISO');
  await expect(menu.locator('.ed-nav-programs a')).toHaveCount(2);
  await menu.getByRole('searchbox').fill('xxxxxxxx');
  await expect(menu.locator('.ed-nav-empty')).toBeVisible();
  await menu.getByRole('searchbox').fill('Охрана труда');
  const course = menu.locator('.ed-nav-programs a').first();
  const href = await course.getAttribute('href');
  expect(href).toContain('city=almaty'); expect(href).toContain('format=classroom');
  await course.click(); await expect(menu).not.toBeVisible();
  report.checks.push({ name: 'keyboard categories, live search, empty search, same-route close and course context' });
  await page.locator('.ed-menu-trigger').click();
  await section('places', 1440);
  await menu.locator('.ed-nav-city-links a').filter({ hasText: 'Астана' }).click();
  await expect(page).toHaveURL(/\/astana\?city=astana&format=classroom/);
  await expect(page.locator('#city-select')).toHaveValue('astana');
  report.checks.push({ name: 'city navigation reflects chosen city and retains preferred format' });
  await page.locator('.ed-menu-trigger').click();
  await section('center', 1440);
  await menu.locator('.ed-nav-credentials').click();
  await expect(page).toHaveURL(/\/licenses$/);
  await page.locator('.ed-menu-trigger').click();
  await expect(menu.locator('.ed-nav-context')).toContainText('Астана');
  report.checks.push({ name:'chosen city persists through a center page without query parameters' });
  await page.keyboard.press('Escape');
  await page.locator('.ed-menu-trigger').click();
  await section('learning', 1440);
  await menu.getByRole('link', { name: /01 \/ Проверка знаний/ }).click();
  await expect(page).toHaveURL(/\/cabinet\?.*#assessments/);
  const loginLink = page.locator('main').getByRole('link', { name: /Войти/ }).first();
  await loginLink.waitFor();
  const loginHref = await loginLink.getAttribute('href');
  expect(new URL(loginHref, base).searchParams.get('returnTo')).toContain('#assessments');
  report.checks.push({ name: 'assessment entry preserves cabinet destination through anonymous sign-in' });
  await ready('/ui-kit');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Второй вариант ответа').check();
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.locator('.ed-menu-trigger').click();
  // Pointer activation scrolls the trigger into view; record the actual open position.
  const openScroll = await page.evaluate(() => scrollY);
  await menu.locator('#ed-nav-tab-programs').click();
  await menu.getByRole('searchbox').fill('Первая');
  await page.setViewportSize({ width:390,height:460 });
  await expect(menu.getByRole('searchbox')).toHaveValue('Первая');
  await fit('menu reduced height with preserved category and query');
  await menu.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `${out}/keyboard-height-390.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Email', { exact:true })).toHaveValue('reader@example.test');
  await expect(page.getByLabel('Второй вариант ответа')).toBeChecked();
  report.checks.push({ name:'opening, resizing and closing the menu preserves the underlying form', scrollBefore, openScroll });
  await page.setViewportSize({ width:1440,height:1000 });
  await ready('/'); await page.locator('.ed-menu-trigger').click();
  await menu.locator('.ed-nav-colophon a').focus();
  await page.keyboard.press('Tab');
  expect(await menu.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await menu.evaluate(el => el.contains(document.activeElement))).toBe(true);
  report.checks.push({ name:'native modal contains keyboard focus' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-menu-trigger')).toBeFocused();
  await page.setViewportSize({ width:720,height:500 });
  await page.locator('.ed-menu-trigger').click(); await fit('200 percent zoom reflow equivalent');
  await expect(menu.locator('.ed-nav-close')).toBeVisible();
  expect(report.errors).toEqual([]);
  expect(report.hydrationWarnings).toEqual([]);
} catch(error) { report.failure = error.stack; process.exitCode=1; await page.screenshot({path:`${out}/failure.png`}).catch(()=>{}); }
finally { await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,failure:report.failure},null,2)); await browser.close(); }
