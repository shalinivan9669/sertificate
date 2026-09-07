import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const phase = process.argv[2] || 'before';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const folder = `artifacts/visual/${phase}`;
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pages = ['/', '/ohrana-truda', '/karaganda', '/contacts', '/courses', '/program-selection', '/kk', '/learn/industrial-safety', '/cabinet'];
const sizes = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const results = [];
for (const viewport of sizes) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  for (const path of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const started = Date.now();
    try {
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
      if (response.status() >= 400) throw new Error(`Unexpected HTTP ${response.status()} at ${path}`);
      await page.evaluate(() => document.fonts.ready);
      const filename = `${folder}/${path.replaceAll('/', '_') || 'home'}-${viewport.width}.png`;
      await page.screenshot({ path: filename, fullPage: true });
      const state = await page.evaluate(() => ({ title: document.title, h1: [...document.querySelectorAll('h1')].map(e => e.textContent), canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(e => e.href), overflow: document.documentElement.scrollWidth > innerWidth }));
      results.push({ path, viewport, status: response.status(), url: page.url(), filename, elapsedMs: Date.now() - started, ...state, errors });
    } catch (error) { results.push({ path, viewport, error: error.message, errors }); }
    await page.close();
  }
  await context.close();
}
await browser.close();
await writeFile(`${folder}/report.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ phase, captured: results.filter(r => r.filename).length, failures: results.filter(r => r.error), overflows: results.filter(r => r.overflow).map(r => [r.path, r.viewport.width]) }, null, 2));
