import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.REDESIGN_REFERENCE_URL || 'http://127.0.0.1:3001';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/);
const output = resolve('artifacts/redesign/2026-09-14/references');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.abort('blockedbyclient') : route.continue());
try {
  const response = await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const metadata = await page.evaluate(() => ({ title: document.title, h1: [...document.querySelectorAll('h1')].map(el => el.textContent), width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }));
  await page.screenshot({ path: resolve(output, 'tikkurila-current.png'), fullPage: true });
  await page.screenshot({ path: resolve(output, 'tikkurila-current-viewport.png') });
  await writeFile(resolve(output, 'tikkurila-current.json'), JSON.stringify({ base, status: response?.status(), generatedAt: new Date().toISOString(), ...metadata, errors }, null, 2));
  console.log(JSON.stringify({ ...metadata, status: response?.status(), errors }, null, 2));
} finally { await browser.close(); }
