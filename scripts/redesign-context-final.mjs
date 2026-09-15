import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:3102';
const out = 'artifacts/redesign/2026-09-14/context-final';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { checks: [], errors: [], boundary: 'Real local app, read-only browser actions; no lead submission or authenticated mutation.' };
page.on('pageerror', e => report.errors.push(e.message));
await page.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.abort() : route.continue());
async function go(path) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false);
}
try {
  for (const prefix of ['', '/kk']) {
    for (const src of ['/src', '/src/old/link']) {
      await go(prefix + src + '?city=almaty&format=onsite&q=ISO#directions');
      const url = new URL(page.url());
      expect(url.pathname.replace(/\/$/, '')).toBe(prefix);
      expect(url.searchParams.get('city')).toBe('almaty');
      expect(url.searchParams.get('format')).toBe('onsite');
      expect(url.searchParams.get('q')).toBe('ISO');
      expect(url.hash).toBe('#directions');
      report.checks.push({ name: `${prefix || 'ru'} ${src} preserves locale, query and hash`, passed: true });
    }
    for (const route of ['/contacts', '/b2b']) {
      await go(prefix + route + '?city=almaty&format=classroom');
      const city = page.locator(route === '/contacts' ? 'input[name="city"]' : 'input[list="b2b-cities"]');
      await expect(city).toHaveValue('Алматы');
      await page.locator('.ed-header-city select').selectOption('atyrau');
      await expect(city).toHaveValue('Атырау');
      await city.fill('Моя площадка 17');
      await page.locator('.ed-header-city select').selectOption('aktau');
      await expect.poll(() => new URL(page.url()).searchParams.get('city')).toBe('aktau');
      await expect(city).toHaveValue('Моя площадка 17');
      expect(new URL(page.url()).pathname).toBe(prefix + route);
      report.checks.push({ name: `${prefix || 'ru'} ${route} updates automatic city and preserves manual location`, passed: true });
    }
    for (const route of ['/srochnoe-obuchenie', '/obuchenie-dlya-tendera', '/prodlenie-udostovereniy']) {
      await go(prefix + route + '?city=atyrau&format=onsite');
      const cta = page.locator('a[href*="/program-selection"]').filter({ hasText: prefix ? 'Бағдарлама таңдау' : 'Подобрать программу' }).first();
      const href = new URL(await cta.getAttribute('href'), base);
      expect(href.searchParams.get('city')).toBe('atyrau');
      expect(href.searchParams.get('format')).toBe('onsite');
      await cta.click();
      await expect(page.locator('.ed-selection-steps')).toBeVisible();
      await page.locator('.ed-selection-steps button').nth(2).click();
      await expect(page.getByRole('radio', { name: prefix ? 'Ұйым аумағында' : 'На площадке организации', exact: true })).toBeChecked();
      report.checks.push({ name: `${prefix || 'ru'} ${route} preserves and visibly shows explicit format`, passed: true });
    }
    await go(prefix + '/srochnoe-obuchenie?city=atyrau');
    const cta = page.locator('a[href*="/program-selection"]').filter({ hasText: prefix ? 'Бағдарлама таңдау' : 'Подобрать программу' }).first();
    expect(new URL(await cta.getAttribute('href'), base).searchParams.has('format')).toBe(false);
    await cta.click();
    await expect(page.locator('.ed-selection-steps')).toBeVisible();
    await page.locator('.ed-selection-steps button').nth(2).click();
    await expect(page.getByRole('radio', { name: prefix ? 'Ұйым аумағында' : 'На площадке организации', exact: true })).toBeChecked();
    report.checks.push({ name: `${prefix || 'ru'} urgency without explicit format retains visible previous preference`, passed: true });
  }
  expect(report.errors).toHaveLength(0);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(out + '/report.json', JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
