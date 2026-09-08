/** Focused companion to performance-lab.mjs; existing reports and application data are untouched. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const phase = process.argv[2];
const base = process.argv[3];
const label = process.env.LMS_LAYOUT_LABEL || phase;
const repeats = Number(process.env.LMS_LAYOUT_REPEATS || 1);
assert.ok(['baseline', 'after'].includes(phase), 'Use baseline|after and an already running local server URL');
assert.match(base || '', /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/, 'Explicit local HTTP origin required');
assert.match(label || '', /^[A-Za-z0-9_-]{1,80}$/, 'Safe output label required');
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3, 'Use 1–3 repeats');
const directory = resolve('artifacts/performance/lms-nav', label);
await mkdir(directory, { recursive: true });
const referencePath = resolve(process.env.LMS_LAYOUT_REFERENCE || 'artifacts/performance/lms-nav/baseline/report.json');
const reference = phase === 'after' ? JSON.parse(await readFile(referencePath, 'utf8')) : null;
const profile = { deviceScaleFactor: 1, cpuRate: 4, latencyMs: 150, downloadMbps: 1.6, uploadMbps: .75, coldCache: true };
const widths = [360, 390, 420, 768];
const modes = ['natural', 'held-fonts'];
const round = value => Math.round(value * 100000) / 100000;
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const report = {
  checkedAt: new Date().toISOString(), phase, label, base, profile, widths, modes, repeats,
  scope: 'Local cold-browser navigation lab. GET/HEAD/OPTIONS only; no sign-in, SQL, enrollment, answer or submission mutation. Existing synthetic terminal attempt only. Font withholding is a diagnostic perturbation, not real-user performance.',
  metric: 'Observed shift sum excludes recent user input, matching the preceding local performance report. It is not a full-session field CLS or INP measurement. Nav-related entry values include all sources in that entry and are not an exact per-element CLS contribution.',
  buildId: null, browserVersion: null, terminalPreflight: null, runs: [], comparisons: [], failures: [], qualityObservations: [],
};
const statePath = resolve('.data/e2e-performance-session.json');
const suppliedState = JSON.parse(await readFile(statePath, 'utf8'));
assert.ok(suppliedState.cookies?.some(cookie => cookie.httpOnly && cookie.name.includes('session_token')), 'Prepare an existing synthetic session with tests/prepare-performance-session.mjs');
assert.ok(suppliedState.cookies.every(cookie => cookie.domain.replace(/^\./, '') === new URL(base).hostname), 'Session cookies must belong to the local measurement host');
const terminalUrl = new URL((await readFile(resolve('.data/e2e-performance-url.txt'), 'utf8')).trim(), base);
assert.equal(terminalUrl.origin, base, 'Terminal URL must belong to the measurement origin');
assert.match(terminalUrl.pathname, /^\/learn\/[A-Za-z0-9_-]+\/exam$/);
assert.equal(terminalUrl.searchParams.size, 1); assert.match(terminalUrl.searchParams.get('attempt') || '', /^[A-Za-z0-9_-]+$/);
assert.equal(terminalUrl.hash, '');
const safeUrl = value => {
  try { const url = new URL(value); return url.origin + url.pathname.replace(/(\/learn\/)[^/]+/g, '$1:enrollment').replace(/(\/attempts\/)[^/]+/g, '$1:attempt'); }
  catch { return '[unparseable URL]'; }
};

// This observer records geometry without reading lesson bodies, answers or account fields.
function installObserver() {
  const state = { shifts: [], fontEvents: [], geometry: [], stopped: false };
  window.__otLmsLayout = state;
  const rounded = value => Math.round(value * 100) / 100;
  const rect = element => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return Object.fromEntries(['x', 'y', 'width', 'height', 'top', 'bottom', 'left', 'right'].map(key => [key, rounded(r[key])]));
  };
  const measure = () => {
    const shell = document.querySelector('main .lms');
    const nav = shell?.querySelector(':scope > nav');
    if (!nav) return null;
    const links = [...nav.querySelectorAll('a')].map(link => {
      const bounds = rect(link), style = getComputedStyle(link);
      const range = document.createRange(); range.selectNodeContents(link);
      const textRows = [...new Set([...range.getClientRects()].filter(box => box.width > .5 && box.height > .5).map(box => Math.round(box.top)))];
      return { text: link.textContent.trim().replace(/\s+/g, ' '), rect: bounds, topFromNav: rounded(bounds.top - nav.getBoundingClientRect().top), textRowCount: textRows.length, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, whiteSpace: style.whiteSpace };
    });
    return { nav: rect(nav), shell: rect(shell), h1: rect(shell.querySelector('h1')), links, rows: [...new Set(links.map(link => link.topFromNav))].sort((a, b) => a - b), navDisplay: getComputedStyle(nav).display, navGap: getComputedStyle(nav).gap, overflow: document.documentElement.scrollWidth > innerWidth + 1, fontsStatus: document.fonts.status, loadedFonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => ({ family: font.family, weight: font.weight, style: font.style })) };
  };
  state.measure = measure;
  let last = '';
  const capture = reason => {
    const value = measure(); if (!value) return;
    const signature = JSON.stringify({ nav: value.nav, links: value.links.map(link => link.rect), fontsStatus: value.fontsStatus });
    if (signature !== last || reason !== 'sample') { state.geometry.push({ time: rounded(performance.now()), reason, value }); last = signature; }
  };
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      state.shifts.push({ time: entry.startTime, value: entry.value, sources: (entry.sources || []).map(source => ({
        region: source.node?.closest?.('.lms > nav') ? 'lms-nav' : source.node?.closest?.('.lms > header') ? 'lms-heading' : source.node?.closest?.('.lms') ? 'lms-other' : 'outer-shell',
        tag: source.node?.tagName || null,
        previous: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, rounded(source.previousRect[key])])),
        current: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, rounded(source.currentRect[key])])),
      })) });
      capture('layout-shift');
    }
  });
  observer.observe({ type: 'layout-shift', buffered: true });
  for (const name of ['loading', 'loadingdone', 'loadingerror']) document.fonts.addEventListener(name, event => {
    state.fontEvents.push({ event: name, time: rounded(performance.now()), faces: [...(event.fontfaces || [])].map(font => ({ family: font.family, weight: font.weight, status: font.status })) }); capture(name);
  });
  const interval = setInterval(() => { if (state.stopped) clearInterval(interval); else capture('sample'); }, 80);
  state.finish = () => { capture('finished'); state.stopped = true; clearInterval(interval); observer.disconnect(); };
}

async function readGeometry(page) { return page.evaluate(() => window.__otLmsLayout.measure()); }
async function screenshot(session, filename) {
  // CDP capture does not wait for document.fonts.ready, which is deliberately held in the diagnostic mode.
  const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(filename, Buffer.from(result.data, 'base64'));
}
function compareFontGeometry(before, after) {
  if (!before || !after) return { stable: false, reason: 'missing geometry' };
  const navHeightDelta = round(after.nav.height - before.nav.height);
  const linkTopDeltas = after.links.map((link, i) => before.links[i] ? round(link.topFromNav - before.links[i].topFromNav) : null);
  const rowCountDelta = after.rows.length - before.rows.length;
  return { stable: before.links.length === 3 && after.links.length === 3 && Math.abs(navHeightDelta) <= 1 && rowCountDelta === 0 && linkTopDeltas.every(value => value !== null && Math.abs(value) <= 1), navHeightDelta, rowCountDelta, linkTopDeltas, outerNavTopDelta: round(after.nav.top - before.nav.top), h1TopDelta: round(after.h1.top - before.h1.top) };
}

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  report.browserVersion = browser.version();
  const preflight = await browser.newContext({ storageState: statePath });
  try {
    const latest = await preflight.request.get(base + '/_nuxt/builds/latest.json', { timeout: 15000, maxRedirects: 0 });
    assert.equal(latest.status(), 200, 'Local build identity must be readable'); report.buildId = (await latest.json()).id;
    const session = await preflight.request.get(base + '/api/auth/get-session', { timeout: 15000, maxRedirects: 0 });
    assert.equal(session.status(), 200, 'Session preflight failed; rerun the normal HTTP sign-in helper for this server');
    const user = (await session.json()).user;
    assert.ok(user?.id === 'e2e-learner' && user.emailVerified === true && user.role === 'learner', 'Only the existing verified synthetic learner may be measured');
    const response = await preflight.request.get(base + '/api/v1/attempts/' + terminalUrl.searchParams.get('attempt'), { timeout: 15000, maxRedirects: 0 });
    assert.equal(response.status(), 200, 'Terminal attempt preflight failed');
    const attempt = await response.json();
    assert.ok(['graded', 'expired'].includes(attempt.status) && attempt.result && typeof attempt.result.pass === 'boolean' && terminalUrl.pathname === `/learn/${attempt.enrollmentId}/exam`, 'An existing terminal result is required; an active exam will never be measured');
    report.terminalPreflight = { status: attempt.status, verifiedSyntheticLearner: true, academicWrites: 0 };
  } finally { await preflight.close(); }
  if (reference) {
    assert.deepEqual(reference.profile, profile, 'Compare identical network/CPU settings');
    assert.deepEqual(reference.widths, widths); assert.deepEqual(reference.modes, modes); assert.equal(reference.repeats, repeats);
    assert.equal(reference.browserVersion, report.browserVersion, 'Compare the same installed browser version');
  }
  for (let repeat = 1; repeat <= repeats; repeat++) for (const width of widths) for (const locale of ['ru', 'kk']) for (const routeKind of ['catalog', 'terminal-exam']) for (const mode of modes) {
    const key = `${routeKind}-${locale}-${width}-${mode}-${repeat}`;
    const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : 844 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768, locale: locale === 'kk' ? 'kk-KZ' : 'ru-RU', ...(routeKind === 'terminal-exam' ? { storageState: statePath } : {}) });
    let releaseFonts; const gate = new Promise(resolveGate => { releaseFonts = resolveGate; }); let holding = mode === 'held-fonts';
    const errors = [], failed = [], httpErrors = [], blockedMutations = [], fontRequests = [];
    let heldRequests = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { blockedMutations.push({ method: request.method(), url: safeUrl(request.url()) }); await route.abort('blockedbyclient'); return; }
      if (holding && request.resourceType() === 'font') { heldRequests++; await gate; }
      await route.continue().catch(() => {});
    });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push({ url: safeUrl(request.url()), reason: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: safeUrl(response.url()), status: response.status() }); if (response.request().resourceType() === 'font') fontRequests.push({ url: safeUrl(response.url()), status: response.status() }); });
    const run = { key, repeat, width, locale, routeKind, mode, status: null, errors, failed, httpErrors, blockedMutations, fontRequests, screenshots: [], failure: null };
    report.runs.push(run);
    try {
      await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latencyMs, downloadThroughput: profile.downloadMbps * 1000000 / 8, uploadThroughput: profile.uploadMbps * 1000000 / 8, connectionType: width < 768 ? 'cellular4g' : 'wifi' });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
      await page.addInitScript(installObserver);
      const route = (locale === 'kk' ? '/kk' : '') + (routeKind === 'catalog' ? '/courses' : terminalUrl.pathname + terminalUrl.search);
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      run.status = response.status(); assert.equal(run.status, 200, 'Page must return HTTP 200');
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__) && document.querySelectorAll('main .lms > nav a').length === 3, null, { timeout: 20000 });
      if (routeKind === 'catalog') await expect(page.locator('main article')).toHaveCount(20, { timeout: 20000 });
      else { await expect(page.locator('main .lms')).toContainText(locale === 'kk' ? 'Нәтиже:' : 'Результат:', { timeout: 20000 }); assert.equal(await page.locator('main input[type="checkbox"]').count(), 0, 'Terminal view has no answer controls'); }
      await page.waitForTimeout(300);
      run.beforeFontRelease = await readGeometry(page);
      if (mode === 'held-fonts') {
        run.heldFontRequests = heldRequests;
        assert.ok(heldRequests > 0 && run.beforeFontRelease.fontsStatus === 'loading', 'Diagnostic must actually hold a requested web font');
        const path = resolve(directory, key + '-fallback.png'); await screenshot(cdp, path); run.screenshots.push(path);
      }
      holding = false; releaseFonts();
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }); await page.waitForTimeout(1500);
      run.settled = await readGeometry(page);
      assert.ok(run.settled.loadedFonts.some(font => /Inter/i.test(font.family)), 'Inter web font must load; fallback-only rendering is not a successful font test');
      assert.ok(run.settled.loadedFonts.some(font => /Manrope/i.test(font.family)), 'Manrope web font must load');
      run.fontGeometry = compareFontGeometry(run.beforeFontRelease, run.settled);
      run.observation = await page.evaluate(() => { const data = window.__otLmsLayout; data.finish(); return { shifts: data.shifts, geometry: data.geometry, fontEvents: data.fontEvents, elapsedMs: performance.now() }; });
      run.observedShiftSum = round(run.observation.shifts.reduce((sum, shift) => sum + shift.value, 0));
      run.navRelatedEntrySum = round(run.observation.shifts.filter(shift => shift.sources.some(source => source.region === 'lms-nav')).reduce((sum, shift) => sum + shift.value, 0));
      const path = resolve(directory, key + '-settled.png'); await screenshot(cdp, path); run.screenshots.push(path);
      assert.equal(run.settled.overflow, false, 'No horizontal overflow');
      assert.deepEqual(errors, [], 'No JavaScript errors'); assert.deepEqual(failed, [], 'No failed resources'); assert.deepEqual(httpErrors, [], 'No resource HTTP errors'); assert.deepEqual(blockedMutations, [], 'No attempted mutation');
      if (mode === 'natural' && run.observedShiftSum > .1) report.qualityObservations.push({ key, observedShiftSum: run.observedShiftSum, notice: 'Observed navigation shift sum above 0.1; local measurement, not field CLS.' });
      if (phase === 'after' && mode === 'held-fonts') assert.equal(run.fontGeometry.stable, true, 'Internal nav rows/height must remain stable when fonts are released');
    } catch (error) { run.failure = String(error.message).replaceAll(terminalUrl.searchParams.get('attempt'), ':attempt').replaceAll(terminalUrl.pathname.split('/')[2], ':enrollment'); report.failures.push({ key, reason: run.failure }); }
    finally { holding = false; releaseFonts(); await context.close(); }
    console.log(JSON.stringify({ key, status: run.status, observedShiftSum: run.observedShiftSum, navRelatedEntrySum: run.navRelatedEntrySum, navStable: run.fontGeometry?.stable, failure: run.failure }));
    await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
  }
  if (reference) for (const width of widths) for (const locale of ['ru', 'kk']) for (const routeKind of ['catalog', 'terminal-exam']) for (const mode of modes) {
    const select = data => data.runs.filter(run => run.width === width && run.locale === locale && run.routeKind === routeKind && run.mode === mode && !run.failure);
    const before = select(reference), after = select(report);
    const complete = before.length === repeats && after.length === repeats;
    report.comparisons.push({ width, locale, routeKind, mode, complete, ...(complete ? { baselineMedianShiftSum: round(median(before.map(run => run.observedShiftSum))), afterMedianShiftSum: round(median(after.map(run => run.observedShiftSum))), baselineMedianNavHeightDelta: round(median(before.map(run => run.fontGeometry.navHeightDelta))), afterMedianNavHeightDelta: round(median(after.map(run => run.fontGeometry.navHeightDelta))), baselineStableRuns: before.filter(run => run.fontGeometry.stable).length, afterStableRuns: after.filter(run => run.fontGeometry.stable).length } : {}) });
    if (!complete) report.failures.push({ key: `${routeKind}-${locale}-${width}-${mode}`, reason: 'Comparison has missing or failed runs' });
  }
} catch (error) { report.failures.push({ key: 'preflight', reason: error.message }); }
finally { await browser?.close(); await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ report: resolve(directory, 'report.json'), buildId: report.buildId, runs: report.runs.length, failures: report.failures.length, qualityObservations: report.qualityObservations.length }));
if (report.failures.length) process.exitCode = 1;
