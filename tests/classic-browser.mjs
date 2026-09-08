import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { assertClassicSource, classicBase, classicBlobs } from './classic-design-contract.mjs';

const base = process.env.TEST_BASE_URL;
assert.match(base || '', /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/, 'An explicitly local completed Node build is required');
await assertClassicSource();
const output = 'artifacts/classic-browser'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || chromium.executablePath(), headless: true });
const report = { status: 'running', scope: 'Preserved Git source and current rendered structural/style/responsive contracts; screenshots are review artifacts, not pixel-diff evidence', classicBase, classicBlobs, browser: browser.version(), pages: [], failures: [] };
const viewports = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const copy = { '/': 'Обучение по охране труда и промышленной безопасности в Казахстане', '/kk': 'Еңбекті қорғау және өнеркәсіптік қауіпсіздік оқыту Қазақстанда' };
const directions = ['ohrana-truda', 'promyshlennaya-bezopasnost', 'ptm', 'elektrobezopasnost', 'raboty-na-vysote', 'gpm-stropalschiki', 'gazoopasnye-raboty', 'ekologicheskaya-bezopasnost', 'pervaya-pomoshch'];
const selectors = { hero: 'main section:first-of-type', h1: 'main h1', cta: 'main section:first-of-type a[href="#contact"]', courses: 'main #courses > .grid', formats: 'main #formats > .grid' };
// Stable computed values reviewed from the 413ad4a local baseline. Font glyph
// metrics, absolute page heights, header/footer positions and antialiasing are
// deliberately outside this cross-platform contract, not silently tolerated.
function expectedStyles(width) {
  const desktop = width >= 768;
  return {
    hero: { backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(226, 232, 240)', borderRadius: '16px', paddingTop: desktop ? '40px' : '32px', paddingRight: desktop ? '40px' : '32px' },
    h1: { fontSize: desktop ? '36px' : '30px', fontWeight: '700', color: 'rgb(15, 23, 42)' },
    cta: { color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(43, 122, 120)', borderRadius: '8px', paddingTop: '12px', paddingRight: '20px' },
    courses: { display: 'grid', gap: '16px' }, formats: { display: 'grid', gap: '16px' },
  };
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'ru-RU' });
    // No network dependency or external contact/analytics. Fonts may use the OS
    // fallback; none of the assertions compares glyph positions or raster bytes.
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    for (const [path, heading] of Object.entries(copy)) {
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        assert.equal(response?.status(), 200, `${path} HTTP status`);
        await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('main h1')).toHaveText(heading);
        await expect(page.locator('main #courses > .grid > a')).toHaveCount(9);
        await expect(page.locator('main #formats > .grid > a')).toHaveCount(6);
        await expect(page.locator(selectors.cta)).toBeVisible();
        await expect(page.locator('main section:first-of-type a[href="#courses"]')).toBeVisible();
        const measured = await page.evaluate(({ selectors, styleContract }) => {
          const result = {};
          for (const [name, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector); const css = getComputedStyle(element); const box = element.getBoundingClientRect();
            result[name] = { styles: Object.fromEntries(Object.keys(styleContract[name]).map(key => [key, css[key]])), rect: { x: box.x, width: box.width, right: box.right, height: box.height }, columns: name === 'courses' || name === 'formats' ? css.gridTemplateColumns.split(/\s+/).length : null };
          }
          const logo = document.querySelector('header img[alt="OT Center"]');
          return { elements: result, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, links: [...document.querySelectorAll('main #courses > .grid > a')].map(link => link.getAttribute('href')), logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0) };
        }, { selectors, styleContract: expectedStyles(viewport.width) });
        assert.ok(measured.scrollWidth <= viewport.width + 1, `${path} horizontal overflow at ${viewport.width}`);
        assert.ok(measured.logoLoaded, 'Existing OT Center brand asset loads');
        assert.deepEqual(measured.links, directions.map(id => `${path === '/kk' ? '/kk' : ''}/${id}`));
        for (const [name, styles] of Object.entries(expectedStyles(viewport.width))) {
          assert.deepEqual(measured.elements[name].styles, styles, `${path} ${name} classic style contract at ${viewport.width}`);
          const rect = measured.elements[name].rect;
          assert.ok(rect.width > 0 && rect.height > 0 && rect.x >= -1 && rect.right <= viewport.width + 1, `${name} visible inside viewport`);
        }
        for (const name of ['courses', 'formats']) assert.equal(measured.elements[name].columns, viewport.width >= 768 ? 3 : 1, `${name} classic responsive grid`);
        assert.deepEqual(errors, [], 'No uncaught client JavaScript errors');
        report.pages.push({ path, viewport, status: 'passed', measured });
      } catch (error) {
        report.failures.push({ path, viewport, error: error.message });
      } finally {
        await page.screenshot({ path: `${output}/${path === '/kk' ? 'kk' : 'ru'}-${viewport.width}.png`, fullPage: true });
        await page.close();
      }
    }
    await context.close();
  }
  report.status = report.failures.length ? 'failed' : 'passed';
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
} finally {
  report.finishedAt = new Date().toISOString();
  if (report.status === 'running') report.status = 'failed';
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, classicChecks: report.pages.length, report: `${output}/report.json`, pixelComparison: false }));
