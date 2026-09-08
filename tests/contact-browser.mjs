import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || process.env.VERCEL || process.env.TURSO_DATABASE_URL) throw new Error('Contact browser checks only allow an isolated local server');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = []; const errors = [];
try {
  for (const locale of ['ru', 'kk']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const requests = []; let responseMode = 'lost';
    // Only the browser's response/retry behavior is simulated; no lead or CRM data is sent.
    await page.route('**/api/amo-lead', async route => {
      requests.push({ key: route.request().headers()['idempotency-key'], payload: route.request().postDataJSON() });
      if (responseMode === 'lost') await route.abort('failed');
      else await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'accepted', submissionId: 'SYNTHETIC-BROWSER-ONLY' }) });
    });
    await page.goto(base + (locale === 'kk' ? '/kk' : '') + '/contacts', { waitUntil: 'networkidle' });
    for (const name of ['name', 'phone', 'email', 'city', 'comment']) assert.ok(await page.locator(`[name="${name}"]`).getAttribute('aria-label'), `${name} needs an accessible name`);
    const button = page.locator('form button[type="submit"]');
    await button.click();
    assert.equal(requests.length, 0, 'Missing consent must prevent submission');
    await page.locator('[name="consent"]').check();
    await button.click();
    await page.getByRole('alert').waitFor();
    assert.equal(requests.length, 0, 'Missing contact method must prevent submission');
    await page.locator('[name="email"]').fill('isolated-contact@example.test');
    await page.locator('[name="comment"]').fill('SYNTHETIC UI TEST ONLY');
    await button.click();
    await page.waitForFunction(() => !document.querySelector('form button[type="submit"]').disabled);
    assert.equal(requests.length, 1);
    assert.equal(await page.locator('[name="email"]').inputValue(), 'isolated-contact@example.test');
    assert.match(requests[0].key, /^[a-f\d-]{36}$/i);
    assert.equal(requests[0].payload.locale, locale);
    assert.equal(requests[0].payload.marketingConsent, false);
    responseMode = 'accepted';
    await button.click();
    await page.getByRole('status').waitFor();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].key, requests[1].key, 'Uncertain response retry retains the same server idempotency key');
    assert.equal(await page.locator('[name="email"]').inputValue(), '');
    assert.match(await page.getByRole('status').innerText(), locale === 'kk' ? /Өтінім қабылданды/ : /Заявка принята/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    checks.push({ locale, status: 'passed', details: '360px labels, consent/contact validation, response loss retains data, stable retry key, localized accepted state, no external delivery' });
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await mkdir('artifacts/contact-browser', { recursive: true });
  await writeFile('artifacts/contact-browser/report.json', JSON.stringify({ base, notice: 'Browser-only mocked responses; no real CRM delivery', checks, errors }, null, 2));
}
console.log(`Contact browser checks passed: ${checks.length} locales; no real lead submitted.`);
