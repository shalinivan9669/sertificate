import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const baseline = process.env.PERF_BASELINE_BASE || 'http://localhost:3100';
const current = process.env.PERF_CURRENT_BASE || 'http://localhost:3101';
for (const url of [baseline, current]) if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(url)) throw new Error('This read-only performance harness runs on explicitly local servers only');
const output = resolve('artifacts/performance'); await mkdir(output, { recursive: true });
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, isMobile: false, cpuRate: 1, latencyMs: 40, downloadMbps: 10, uploadMbps: 2 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, cpuRate: 4, latencyMs: 150, downloadMbps: 1.6, uploadMbps: 0.75 },
];
const report = { recordedAt: new Date().toISOString(), baseline, current, scope: 'Local lab only; no field INP or Vercel/Turso capacity claim. Shared developer host; cold browser caches and identical per-profile throttling. GET requests only; no login, enrollment, progress, answer or submission writes.', profiles, browserVersion: '', navigationRuns: [], navigationSummary: [], apiLoads: [], exam: { status: 'not_run', reason: 'No existing synthetic session and terminal-attempt URL provided; no login or data mutation will be performed for measurement.' } };
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const rounded = (value) => value === null || value === undefined ? null : Math.round(value * 100) / 100;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
report.browserVersion = browser.version();

async function navigation(url, profile, label, run, storageState) {
  const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.isMobile, hasTouch: profile.isMobile, deviceScaleFactor: 1, ...(storageState ? { storageState } : {}) });
  const blockedMutations = [];
  await context.route('**/*', async route => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) await route.continue();
    else { blockedMutations.push({ method: request.method(), url: request.url() }); await route.abort('blockedbyclient'); }
  });
  const page = await context.newPage(); const session = await context.newCDPSession(page); const errors = []; const failed = []; const requests = new Map();
  page.on('pageerror', (error) => errors.push(error.message)); page.on('requestfailed', (request) => failed.push({ url: request.url(), reason: request.failure()?.errorText }));
  await session.send('Network.enable'); await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latencyMs, downloadThroughput: profile.downloadMbps * 1000000 / 8, uploadThroughput: profile.uploadMbps * 1000000 / 8, connectionType: profile.isMobile ? 'cellular4g' : 'ethernet' });
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
  session.on('Network.responseReceived', (event) => requests.set(event.requestId, { url: event.response.url, mime: event.response.mimeType, type: event.type, status: event.response.status, transferred: 0 }));
  session.on('Network.loadingFinished', (event) => { const item = requests.get(event.requestId); if (item) item.transferred = event.encodedDataLength; });
  await page.addInitScript(() => {
    window.__otPerf = { lcp: null, cls: 0, longTaskMs: 0, largestLongTaskMs: 0 };
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__otPerf.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__otPerf.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) { window.__otPerf.longTaskMs += entry.duration; window.__otPerf.largestLongTaskMs = Math.max(window.__otPerf.largestLongTaskMs, entry.duration); } }).observe({ type: 'longtask', buffered: true });
  });
  const start = performance.now();
  let response; let failure = null;
  try { response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1500); }
  catch (error) { failure = error.message; }
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]; const resources = performance.getEntriesByType('resource');
    return { ...window.__otPerf, ttfb: navigation?.responseStart, domContentLoaded: navigation?.domContentLoadedEventEnd, load: navigation?.loadEventEnd, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null, jsDecodedBytes: resources.filter((resource) => /\.(?:m?js)(?:[?#]|$)/.test(resource.name)).reduce((sum, resource) => sum + resource.decodedBodySize, 0), jsResourceCount: resources.filter((resource) => /\.(?:m?js)(?:[?#]|$)/.test(resource.name)).length, hydrated: Boolean(document.querySelector('#__nuxt')?.__vue_app__), h1: document.querySelector('h1')?.textContent?.trim() || null, overflow: document.documentElement.scrollWidth > innerWidth };
  }).catch(() => null);
  const transfers = [...requests.values()];
  const result = { label, profile: profile.name, run, url: new URL(url).pathname, status: response?.status() || null, elapsedMs: rounded(performance.now() - start), ...timing, totalTransferredBytes: transfers.reduce((sum, resource) => sum + resource.transferred, 0), jsTransferredBytes: transfers.filter((resource) => resource.type === 'Script' || /javascript/.test(resource.mime)).reduce((sum, resource) => sum + resource.transferred, 0), externalResourceCount: transfers.filter((resource) => !resource.url.startsWith(new URL(url).origin)).length, httpErrors: transfers.filter((resource) => resource.status >= 400).map(({ status, url }) => ({ status, url })), pageErrors: errors, failedRequests: failed, failure };
  for (const field of ['lcp', 'cls', 'longTaskMs', 'largestLongTaskMs', 'ttfb', 'domContentLoaded', 'load', 'fcp']) result[field] = rounded(result[field]);
  result.blockedMutations = blockedMutations;
  await context.close(); console.log(JSON.stringify({ navigation: label, profile: profile.name, run, status: result.status, lcp: result.lcp, cls: result.cls, jsBytes: result.jsTransferredBytes, failure }));
  return result;
}

async function load(url) {
  await fetch(url).then((response) => response.arrayBuffer());
  const durations = [], statuses = {}, errors = []; let count = 0; let bytes = 0; const started = performance.now();
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (count < 50) {
      const index = count++; const begin = performance.now();
      try { const response = await fetch(url, { signal: AbortSignal.timeout(15000) }); const body = await response.arrayBuffer(); bytes += body.byteLength; statuses[response.status] = (statuses[response.status] || 0) + 1; if (!response.ok) errors.push({ index, status: response.status }); }
      catch (error) { errors.push({ index, error: error.message }); }
      durations.push(performance.now() - begin);
    }
  }));
  const sorted = durations.sort((a, b) => a - b); const elapsedMs = performance.now() - started;
  return { endpoint: new URL(url).pathname, requests: 50, concurrency: 10, elapsedMs: rounded(elapsedMs), requestsPerSecond: rounded(50 / elapsedMs * 1000), p50Ms: rounded(median(sorted)), p95Ms: rounded(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: rounded(sorted.at(-1)), statuses, errors, responseBodyBytes: bytes, caveat: 'Local loopback, local libSQL, short read-only burst, no browser throttling; not production capacity.' };
}

try {
  for (const profile of profiles) for (let run = 1; run <= 3; run++) for (const [label, base] of [['baseline', baseline], ['after', current]]) report.navigationRuns.push(await navigation(base + '/', profile, label, run));
  for (const profile of profiles) for (const label of ['baseline', 'after']) {
    const runs = report.navigationRuns.filter((run) => run.profile === profile.name && run.label === label);
    report.navigationSummary.push({ profile: profile.name, label, runs: runs.length, status: runs.every((run) => run.status === 200 && !run.failure) ? 'measured' : 'incomplete', medianLcpMs: rounded(median(runs.map((run) => run.lcp).filter((value) => value !== null))), medianCls: rounded(median(runs.map((run) => run.cls))), medianTtfbMs: rounded(median(runs.map((run) => run.ttfb))), medianFcpMs: rounded(median(runs.map((run) => run.fcp))), medianJsTransferredBytes: rounded(median(runs.map((run) => run.jsTransferredBytes))), medianJsDecodedBytes: rounded(median(runs.map((run) => run.jsDecodedBytes))), pageErrorCount: runs.reduce((sum, run) => sum + run.pageErrors.length, 0), overflowRuns: runs.filter((run) => run.overflow).length });
  }
  report.apiLoads.push(await load(current + '/api/health')); report.apiLoads.push(await load(current + '/api/v1/catalog/programs'));
  const state = resolve('.data/e2e-performance-session.json'), urlFile = resolve('.data/e2e-performance-url.txt');
  try {
    await access(state); await access(urlFile);
    const suppliedUrl = new URL((await readFile(urlFile, 'utf8')).trim(), current);
    if (suppliedUrl.origin !== new URL(current).origin || !/^\/learn\/[a-zA-Z0-9_-]+\/exam$/.test(suppliedUrl.pathname) || suppliedUrl.searchParams.size !== 1 || !/^[a-zA-Z0-9_-]+$/.test(suppliedUrl.searchParams.get('attempt') || '') || suppliedUrl.hash) throw new Error('Expected current-server terminal exam URL');
    const url = suppliedUrl.href;
    // The supplying test must mark the attempt terminal; this harness creates no attempt/session.
    const supplied = JSON.parse(await readFile(state, 'utf8')); if (!supplied.cookies?.length) throw new Error('No existing test session available');
    report.exam = { status: 'measured_terminal_view', scope: 'Existing submitted synthetic attempt; GET-only result/exam view, not an in-progress interaction benchmark', run: await navigation(url, profiles[1], 'terminal-exam', 1, state) };
  } catch (error) { report.exam.reason = error.code === 'ENOENT' ? report.exam.reason : error.message; }
} finally {
  await browser.close(); await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ summary: report.navigationSummary, apiLoads: report.apiLoads, exam: report.exam.status }, null, 2));
