import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/, 'Use an explicitly local completed artifact');
assert.ok(!process.env.VERCEL && !process.env.TURSO_DATABASE_URL, 'No hosted service tests');
const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || (process.platform === 'win32' && existsSync(windowsChrome) ? windowsChrome : chromium.executablePath()) });
const output = 'artifacts/lead-context-browser'; await mkdir(output, { recursive: true });
const checks = []; const errors = [];
const report = { status: 'running', base, scope: 'Real local rendered navigation and forms; lead responses intercepted in browser, no lead/CRM created', checks, errors };
try {
  for (const locale of ['ru', 'kk']) {
    const prefix = locale === 'kk' ? '/kk' : '';
    const tr = (ru, kk) => locale === 'kk' ? kk : ru;
    const context = await browser.newContext({ viewport: { width: 360, height: 900 } });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const submissions = []; let responseMode = 'lost';
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort('blockedbyclient');
      if (url.pathname !== '/api/amo-lead') return route.continue();
      submissions.push({ key: route.request().headers()['idempotency-key'], payload: route.request().postDataJSON() });
      return responseMode === 'lost' ? route.abort('failed') : route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'accepted', submissionId: 'SYNTHETIC-CONTEXT-ONLY' }) });
    });
    async function go(path) {
      const response = await page.goto(base + prefix + path, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    }
    const assertQuery = (href, destination, expected) => {
      const url = new URL(href, base);
      assert.equal(url.pathname, prefix + destination);
      assert.deepEqual(Object.fromEntries(url.searchParams), expected);
    };
    const contactValues = async (program, city, format) => {
      await expect(page.locator('[name="programId"]')).toHaveValue(program);
      await expect(page.locator('[name="city"]')).toHaveValue(city);
      await expect(page.locator('[name="format"]')).toHaveValue(format);
    };

    await go('/astana/ohrana-truda?format=classroom&returnTo=%2Fadmin%2Foperations&email=PRIVATE-QUERY');
    const consultation = page.getByRole('link', { name: tr('Заявка на консультацию', 'Кеңеске өтінім'), exact: true }).first();
    assertQuery(await consultation.getAttribute('href'), '/contacts', { program: 'ohrana-truda', city: 'astana', format: 'classroom' });
    await consultation.click();
    await contactValues('ohrana-truda', 'Астана', 'classroom');
    await page.locator('[name="email"]').fill('synthetic-context@example.test');
    await page.locator('[name="comment"]').fill('SYNTHETIC CONTEXT BROWSER ONLY');
    await page.locator('[name="consent"]').check();
    const contactSubmit = page.locator('form button[type="submit"]');
    const beforeContact = submissions.length;
    await contactSubmit.click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(contactSubmit).toBeEnabled();
    await contactSubmit.click(); await expect(contactSubmit).toBeEnabled();
    await expect.poll(() => submissions.length).toBe(beforeContact + 2);
    assert.deepEqual(submissions[beforeContact], submissions[beforeContact + 1], 'Unchanged failed contact retry preserves key and payload');
    assert.deepEqual({ programId: submissions[beforeContact].payload.programId, city: submissions[beforeContact].payload.city, format: submissions[beforeContact].payload.format, locale: submissions[beforeContact].payload.locale }, { programId: 'ohrana-truda', city: 'astana', format: 'classroom', locale });
    assert.equal(submissions[beforeContact].payload.sourcePath, prefix + '/contacts');
    assert.equal(JSON.stringify(submissions[beforeContact]).includes('PRIVATE-QUERY'), false);
    await page.locator('[name="programId"]').selectOption('ptm');
    await page.locator('[name="city"]').fill('Темиртау');
    await page.locator('[name="format"]').selectOption('onsite');
    responseMode = 'accepted';
    await contactSubmit.click(); await expect(page.getByRole('status')).toBeVisible();
    const editedContact = submissions.at(-1);
    assert.notEqual(editedContact.key, submissions[beforeContact].key);
    assert.equal(editedContact.payload.programId, 'ptm'); assert.equal(editedContact.payload.city, 'Темиртау'); assert.equal(editedContact.payload.format, 'onsite');
    await contactValues('', '', ''); await expect(page.locator('[name="email"]')).toHaveValue('');
    await page.screenshot({ path: `${output}/${locale}-contact-360.png`, fullPage: true });
    checks.push({ locale, name: 'city course CTA → visible contact context → unchanged retry → edited context → accepted reset', status: 'passed' });

    await go('/courses/iso-9001?city=kostanay&format=online&program=ptm&private=PRIVATE-QUERY');
    const lmsConsultation = page.getByRole('link', { name: tr('Обсудить обучение', 'Оқуды талқылау'), exact: true });
    await expect(lmsConsultation).toBeVisible();
    assertQuery(await lmsConsultation.getAttribute('href'), '/contacts', { program: 'iso-9001', city: 'kostanay', format: 'online' });
    await lmsConsultation.click();
    await contactValues('iso-9001', tr('Костанай', 'Қостанай'), 'online');
    checks.push({ locale, name: 'LMS course identity overrides query program and retains known city/format/locale', status: 'passed' });

    await go('/program-selection?direction=ptm&city=karaganda&format=classroom');
    await page.getByRole('button', { name: /^2\./ }).click();
    await page.getByRole('combobox', { name: tr('Ваша роль', 'Сіздің рөліңіз'), exact: true }).selectOption('hr');
    await page.getByRole('button', { name: /^4\./ }).click();
    const help = page.getByRole('link', { name: tr('Помощь специалиста', 'Маманның көмегі'), exact: true });
    assertQuery(await help.getAttribute('href'), '/b2b', { program: 'ptm', city: 'karaganda', format: 'classroom' });
    await help.click();
    const honeypot = page.locator('form input[aria-hidden="true"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('combobox', { name: tr('Направление', 'Бағыт'), exact: true })).toHaveValue('ptm');
    await expect(page.locator('form').getByLabel(tr('Город', 'Қала'), { exact: true })).toHaveValue(tr('Караганда', 'Қарағанды'));
    await expect(page.getByRole('combobox', { name: tr('Предпочтительный формат', 'Қалаулы формат'), exact: true })).toHaveValue('classroom');
    await page.getByRole('textbox', { name: tr('Ваше имя', 'Атыңыз'), exact: true }).fill('SYNTHETIC CONTEXT USER');
    await page.getByRole('textbox', { name: tr('Организация', 'Ұйым'), exact: true }).fill('SYNTHETIC CONTEXT ORGANIZATION');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('synthetic-context@example.test');
    await page.locator('form input[type="checkbox"]').check();
    const b2bSubmit = page.locator('form button'); const beforeB2b = submissions.length; responseMode = 'lost';
    await b2bSubmit.click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(b2bSubmit).toBeEnabled();
    await b2bSubmit.click(); await expect(b2bSubmit).toBeEnabled();
    await expect.poll(() => submissions.length).toBe(beforeB2b + 2);
    assert.deepEqual(submissions[beforeB2b], submissions[beforeB2b + 1], 'Unchanged failed B2B retry preserves key and payload');
    assert.deepEqual({ programId: submissions[beforeB2b].payload.programId, city: submissions[beforeB2b].payload.city, format: submissions[beforeB2b].payload.format, locale: submissions[beforeB2b].payload.locale }, { programId: 'ptm', city: 'karaganda', format: 'classroom', locale });
    await page.getByRole('combobox', { name: tr('Предпочтительный формат', 'Қалаулы формат'), exact: true }).selectOption('onsite');
    responseMode = 'accepted'; await b2bSubmit.click(); await expect(page.getByRole('status')).toBeVisible();
    assert.notEqual(submissions.at(-1).key, submissions[beforeB2b].key);
    assert.equal(submissions.at(-1).payload.format, 'onsite');
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('synthetic-context@example.test');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `${output}/${locale}-b2b-360.png`, fullPage: true });
    checks.push({ locale, name: 'actual wizard HR selection → B2B visible values → stable retry and edited payload', status: 'passed' });

    await go('/contacts?program=%2Flearn%2Fprivate&city=PRIVATE-CITY&format=PRIVATE-FORMAT&locale=invalid');
    await contactValues('', '', '');
    await go('/b2b');
    await expect(page.getByRole('combobox', { name: tr('Направление', 'Бағыт'), exact: true })).toHaveValue('');
    await expect(page.locator('form').getByLabel(tr('Город', 'Қала'), { exact: true })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: tr('Предпочтительный формат', 'Қалаулы формат'), exact: true })).toHaveValue('');
    assert.ok((await context.cookies()).some(cookie => cookie.name === 'ot-center-selection-v1'), 'The wizard choice exists but is not silently applied to a direct form');
    checks.push({ locale, name: 'unknown/private queries ignored and direct form does not infer stale cookie selection', status: 'passed' });
    await context.close();
  }
  assert.deepEqual(errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; throw error;
} finally {
  report.finishedAt = new Date().toISOString(); await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, checks: checks.length, errors: errors.length, report: `${output}/report.json` }));
