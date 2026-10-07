import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3127';
assert.match(base, /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/, 'local acceptance only');
const output = resolve(process.env.SEO_ARTIFACT_DIR || 'artifacts/seo');
await mkdir(output, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (existsSync(chrome) ? chrome : undefined), headless: true });
const report = { base, checkedAt: new Date().toISOString(), checks: [], errors: [], blockedWrites: [] };
const readSelection = async (context) => {
  const cookie = (await context.cookies()).find(({ name }) => name === 'ot-center-selection-v1');
  assert.ok(cookie, 'selection cookie exists');
  return JSON.parse(decodeURIComponent(cookie.value));
};
try {
  for (const locale of ['', '/kk']) {
   for (const multi of [false, true]) {
    const context = await browser.newContext();
    const initialPrograms = multi ? ['ohrana-truda', 'ptm'] : ['ptm', 'elektrobezopasnost'];
    await context.addCookies([{ name: 'ot-center-selection-v1', value: encodeURIComponent(JSON.stringify({
      direction: initialPrograms[0], directionIds: initialPrograms, role: '', industry: '', city: 'astana', format: 'online',
    })), url: base }]);
    await context.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== base) return route.abort();
      if (!['GET', 'HEAD'].includes(request.method())) {
        report.blockedWrites.push({ path: url.pathname, method: request.method() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(`${base}${locale}/almaty/ohrana-truda?format=onsite${multi ? '&programs=ohrana-truda,ptm' : ''}`, { waitUntil: 'networkidle' });
    const article = page.locator('#related-guides a[href*="/blog/"]').first();
    await expect(article).toBeVisible();
    const articleHref = await article.getAttribute('href');
    assert.equal(new URL(articleHref, base).search, '', 'informational article URL is clean');
    await article.click();
    await page.waitForURL((url) => url.pathname.startsWith(`${locale}/blog/`) && !url.search);
    const contact = page.locator('.ed-journal-meta a[href*="/contacts"]');
    await expect(contact).toHaveAttribute('href', /city=almaty/);
    const contactHref = new URL(await contact.getAttribute('href'), base);
    assert.equal(contactHref.searchParams.get('program'), 'ohrana-truda');
    assert.equal(contactHref.searchParams.get('city'), 'almaty');
    assert.equal(contactHref.searchParams.get('format'), 'onsite');
    assert.equal(contactHref.searchParams.get('programs'), multi ? 'ohrana-truda,ptm' : null);
    assert.deepEqual((await readSelection(context)).directionIds, initialPrograms, 'clean article viewing preserves existing multi-programme selection before an explicit conversion URL');
    await contact.click();
    await page.waitForURL((url) => url.pathname === `${locale}/contacts`);
    await expect(page.locator('select[name="programId"]')).toHaveValue('ohrana-truda');
    await expect(page.locator('select[name="format"]')).toHaveValue('onsite');
    await expect(page.locator('input[name="city"]')).toHaveValue('Алматы');
    report.checks.push({ locale: locale || 'ru', multi, article: articleHref, contact: contactHref.pathname + contactHref.search, formPrefill: 'program/city/format preserved; no submission', selectionPreserved: initialPrograms });
    await page.screenshot({ path: resolve(output, `journey-${locale ? 'kk' : 'ru'}-${multi ? 'multi' : 'single'}.png`), fullPage: false });
    if (!multi) {
      // Keep the same SPA session so the old viewed programme is still in useState.
      await page.locator(`.civic-footer a[href="${locale}/program-selection"]`).click();
      await page.waitForURL((url) => url.pathname === `${locale}/program-selection`);
      for (const checkbox of await page.locator('input[name="direction"]:checked').all()) await checkbox.uncheck();
      await page.locator('input[name="direction"][value="pervaya-pomoshch"]').check();
      await page.locator('input[name="direction"][value="ptm"]').check();
      await page.locator('.ed-header-city select:visible, .civic-city-switch select:visible').first().selectOption('astana');
      await page.locator('.ed-selection-steps button').nth(2).click();
      await page.getByLabel('Онлайн', { exact: true }).check();
      await page.locator(`.civic-footer a[href="${locale}/blog"]`).click();
      await page.waitForURL((url) => url.pathname === `${locale}/blog` && !url.search);
      await page.locator('main a[href*="/blog/"]').first().click();
      await page.waitForURL((url) => url.pathname.startsWith(`${locale}/blog/`) && !url.search);
      const newContact = page.locator('.ed-journal-meta a[href*="/contacts"]');
      await expect(newContact).toHaveAttribute('href', /city=astana/);
      const newContactHref = new URL(await newContact.getAttribute('href'), base);
      assert.equal(newContactHref.searchParams.get('program'), 'pervaya-pomoshch', 'new selection replaces the old viewed programme');
      assert.equal(newContactHref.searchParams.get('programs'), 'pervaya-pomoshch,ptm');
      assert.equal(newContactHref.searchParams.get('city'), 'astana');
      assert.equal(newContactHref.searchParams.get('format'), 'online');
      assert.deepEqual((await readSelection(context)).directionIds, ['pervaya-pomoshch', 'ptm']);
      await newContact.click();
      await page.waitForURL((url) => url.pathname === `${locale}/contacts`);
      await expect(page.locator('select[name="programId"]')).toHaveValue('pervaya-pomoshch');
      await expect(page.locator('select[name="format"]')).toHaveValue('online');
      await expect(page.locator('input[name="city"]')).toHaveValue('Астана');
      report.checks.push({ locale: locale || 'ru', scenario: 'new preference invalidates old journey', contact: newContactHref.pathname + newContactHref.search, selection: ['pervaya-pomoshch', 'ptm'], city: 'astana', format: 'online', formPrefill: 'updated; no submission' });
      await page.screenshot({ path: resolve(output, `journey-${locale ? 'kk' : 'ru'}-stale-preference.png`), fullPage: false });
    }
    await context.close();
   }
  }
  assert.deepEqual(report.errors, [], 'no browser runtime errors');
  console.log(`Indexation journey accepted in ${report.checks.length} locale/selection cases; no forms submitted.`);
} finally {
  await writeFile(resolve(output, 'indexation-journey-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
