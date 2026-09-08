import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { additionalSourceDirections } from '../shared/source-products.ts';

const phase = process.argv[2];
const base = process.argv[3];
assert.ok(['baseline', 'after'].includes(phase), 'Use baseline|after and the already running local build URL');
assert.match(base || '', /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/, 'Only an explicitly local test server is permitted');
const folder = `artifacts/visual/design-${phase}`;
await mkdir(folder, { recursive: true });
const referencePath = 'artifacts/visual/design-baseline/report.json';
const reference = phase === 'after' ? JSON.parse(await readFile(referencePath, 'utf8')) : null;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { phase, base, checkedAt: new Date().toISOString(), browser: browser.version(), notice: 'Local Chrome lab checks. CSS zoom is explicitly used. No screen reader, field INP or real message delivery was tested.', pages: [], comparisons: [], zoom: [], keyboard: [], failures: [] };
const viewports = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const homeRoutes = ['/', '/kk'];
const routes = phase === 'baseline' ? homeRoutes : ['/', '/kk', '/ohrana-truda', '/karaganda', '/contacts', '/courses', '/program-selection', '/kk/courses', '/kk/program-selection', '/auth/login', '/kk/auth/login', '/courses/iso-9001', '/kk/courses/menedzhment-ohrany-zdorovya'];
const selectors = {
  hero: 'main section:first-of-type', h1: 'main h1', heroDescription: 'main section:first-of-type p.text-lg',
  primaryCta: 'main section:first-of-type a[href="#contact"]', coursesTitle: 'main #courses h2', courseGrid: 'main #courses > .grid',
  courseCard: 'main #courses > .grid > a', formatGrid: 'main #formats > .grid', formatCard: 'main #formats > .grid > a',
};
const styleKeys = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'borderColor', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'display', 'gridTemplateColumns', 'gap'];

async function openPage(page, route) {
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(response.status(), 200, `${route}: HTTP 200`);
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__), { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('main h1')).toHaveCount(1);
  if (phase === 'after' && ['/courses', '/kk/courses'].includes(route)) {
    // Wait for mounted catalog refresh before screenshots; a loading placeholder
    // must never be accepted as evidence for the expanded catalog.
    const cards = page.locator('main article');
    await expect(cards).toHaveCount(20);
    const isKk = route.startsWith('/kk/');
    await expect(cards.filter({ hasText: isKk ? 'Кім үшін:' : 'Для кого:' })).toHaveCount(16);
    for (const direction of additionalSourceDirections) {
      const card = cards.filter({ has: page.locator(`a[href="${isKk ? '/kk' : ''}/courses/${direction.id}"]`) });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(isKk ? 'Бағасы сұрау бойынша' : 'Стоимость по запросу');
    }
  }
  return response.status();
}
async function metrics(page, isHome) {
  return page.evaluate(({ selectors, styleKeys, isHome }) => {
    const rounded = number => Math.round(number * 100) / 100;
    const main = document.querySelector('main').getBoundingClientRect();
    const elements = {};
    if (isHome) for (const [key, selector] of Object.entries(selectors)) {
      const found = [...document.querySelectorAll(selector)];
      elements[key] = found.map(element => {
        const bounds = element.getBoundingClientRect(); const css = getComputedStyle(element);
        return { text: element.textContent.trim().replace(/\s+/g, ' '), rect: { x: rounded(bounds.x), yFromMain: rounded(bounds.y - main.y), width: rounded(bounds.width), height: rounded(bounds.height) }, styles: Object.fromEntries(styleKeys.map(key => [key, css[key]])) };
      });
    }
    const logo = document.querySelector('header img[alt="OT Center"]');
    const logoRect = logo?.getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth > innerWidth + 1;
    const overflowElements = overflow ? [...document.querySelectorAll('body *')].filter(element => {
      const box = element.getBoundingClientRect(); return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1) && getComputedStyle(element).position !== 'fixed';
    }).slice(0, 12).map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 90), className: element.className })) : [];
    const footer = document.querySelector('footer');
    const footerLinks = footer ? [...footer.querySelectorAll('a')].map(link => ({ text: link.textContent.trim(), color: getComputedStyle(link).color, background: getComputedStyle(footer).backgroundColor })) : [];
    return { title: document.title, h1: document.querySelector('main h1').textContent, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, mainTop: rounded(main.y), pageHeight: document.documentElement.scrollHeight, overflow, overflowElements, logo: logoRect ? { width: rounded(logoRect.width), height: rounded(logoRect.height), loaded: logo.complete && logo.naturalWidth > 0 } : null, elements, footerLinks };
  }, { selectors, styleKeys, isHome });
}
function compareHome(current, prior) {
  assert.ok(prior, 'Captured baseline must exist for the same route and width');
  const differences = [];
  for (const key of Object.keys(selectors)) {
    const before = prior.metrics.elements[key]; const after = current.metrics.elements[key];
    if (before.length !== after.length) differences.push(`${key}: element count ${before.length} → ${after.length}`);
    for (let index = 0; index < Math.min(before.length, after.length); index++) {
      const a = before[index]; const b = after[index];
      if (a.text !== b.text) differences.push(`${key}[${index}]: visible text changed`);
      for (const style of styleKeys) if (a.styles[style] !== b.styles[style]) differences.push(`${key}[${index}].${style}: ${a.styles[style]} → ${b.styles[style]}`);
      for (const dimension of ['x', 'yFromMain', 'width', 'height']) if (Math.abs(a.rect[dimension] - b.rect[dimension]) > 1) differences.push(`${key}[${index}].${dimension}: ${a.rect[dimension]} → ${b.rect[dimension]}`);
    }
  }
  return { route: current.route, width: current.width, differences, headerMainTopDelta: current.metrics.mainTop - prior.metrics.mainTop, pageHeightDelta: current.metrics.pageHeight - prior.metrics.pageHeight };
}
function fail(name, error) { report.failures.push({ name, error: error.stack || String(error) }); console.error(`FAIL ${name}: ${error.message || error}`); }
function contrast(color, background) {
  const luminance = value => {
    const [r, g, b] = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const foreground = luminance(color); const behind = luminance(background);
  return (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'ru-RU' });
    for (const route of routes) {
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        const status = await openPage(page, route);
        const filename = `${folder}/${route.replaceAll('/', '_')}-${viewport.width}.png`;
        const measured = await metrics(page, homeRoutes.includes(route));
        await page.screenshot({ path: filename, fullPage: true });
        const result = { route, width: viewport.width, status, filename, metrics: measured, errors }; report.pages.push(result);
        assert.deepEqual(errors, [], 'No browser JavaScript errors');
        if (phase === 'after') {
          assert.equal(measured.overflow, false, `${route} at ${viewport.width}px horizontal overflow`);
          assert.ok(measured.logo?.loaded && measured.logo.width >= 80 && measured.logo.height >= 40, 'Brand logo remains visible');
          for (const link of measured.footerLinks) assert.ok(contrast(link.color, link.background) >= 4.5, `Footer text contrast: ${link.text}`);
          if (homeRoutes.includes(route)) {
            const comparison = compareHome(result, reference.pages.find(item => item.route === route && item.width === viewport.width));
            report.comparisons.push(comparison); assert.deepEqual(comparison.differences, [], 'HomePageClassic geometry, typography, colors and card layout preserved');
          }
        }
        console.log(`PASS ${phase} ${route} ${viewport.width}px`);
      } catch (error) { fail(`${route} ${viewport.width}px`, error); }
      await page.close();
    }
    await context.close();
  }
  if (phase === 'after') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'ru-RU' });
    for (const route of ['/', '/kk', '/courses', '/kk/courses', '/auth/login', '/kk/auth/login']) {
      const page = await context.newPage();
      try {
        await openPage(page, route); await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
        const measured = await metrics(page, false); const filename = `${folder}/zoom200-${route.replaceAll('/', '_')}.png`;
        await page.screenshot({ path: filename, fullPage: true }); report.zoom.push({ route, cssZoom: 2, physicalViewport: 1440, filename, metrics: measured });
        assert.equal(measured.overflow, false, `${route}: CSS zoom 200% has no horizontal overflow`);
        console.log(`PASS zoom 200% ${route}`);
      } catch (error) { fail(`zoom ${route}`, error); }
      await page.close();
    }
    await context.close();
    for (const locale of ['ru', 'kk']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); const route = `${locale === 'kk' ? '/kk' : ''}/auth/login`;
      let intercepted = 0;
      await page.route('**/api/auth/sign-in/email', handler => { intercepted++; return handler.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Synthetic local presentation check' }) }); });
      try {
        await openPage(page, route);
        const email = page.getByLabel('Email', { exact: true }); const password = page.getByLabel(locale === 'kk' ? 'Құпиясөз' : 'Пароль', { exact: true });
        const submit = page.getByRole('button', { name: locale === 'kk' ? 'Жеке кабинетке кіру' : 'Вход в личный кабинет', exact: true });
        await expect(email).toHaveAccessibleName('Email'); await expect(password).toHaveAccessibleName(locale === 'kk' ? 'Құпиясөз' : 'Пароль');
        await submit.click(); assert.equal(intercepted, 0, 'Empty required controls never send a request');
        assert.equal(await email.evaluate(element => element.validity.valueMissing), true);
        await email.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await expect(email).toBeFocused();
        const focus = await email.evaluate(element => { const css = getComputedStyle(element); return { matchesFocusVisible: element.matches(':focus-visible'), outlineWidth: css.outlineWidth, outlineStyle: css.outlineStyle, outlineColor: css.outlineColor }; });
        assert.ok(focus.matchesFocusVisible && parseFloat(focus.outlineWidth) >= 2 && focus.outlineStyle !== 'none', 'Keyboard focus has a visible outline');
        const focusScreenshot = `${folder}/keyboard-focus-${locale}-390.png`; await page.screenshot({ path: focusScreenshot, fullPage: true });
        await email.fill('isolated-visual-check@example.test'); await page.keyboard.press('Tab'); await expect(password).toBeFocused();
        await password.fill('ISOLATED TEST - NOT AN ACCOUNT'); await page.keyboard.press('Tab'); await expect(submit).toBeFocused(); await page.keyboard.press('Enter');
        const alert = page.getByRole('alert'); await expect(alert).toBeVisible(); await expect(alert).toContainText(locale === 'kk' ? 'Кіру мүмкін болмады' : 'Не удалось войти');
        await expect(email).toHaveAttribute('aria-describedby', 'auth-error'); await expect(password).toHaveAttribute('aria-describedby', 'auth-error');
        assert.equal(intercepted, 1); const errorScreenshot = `${folder}/keyboard-error-${locale}-390.png`; await page.screenshot({ path: errorScreenshot, fullPage: true });
        report.keyboard.push({ locale, requiredValidation: true, inputNames: true, tabOrder: ['email', 'password', 'submit'], focus, focusScreenshot, errorScreenshot, errorRole: 'alert', errorAssociated: true, response: 'Synthetic intercepted 401; no account operation or external message' });
        console.log(`PASS keyboard/name/error ${locale}`);
      } catch (error) { fail(`keyboard ${locale}`, error); }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ phase, screenshots: report.pages.length, comparedHomes: report.comparisons.length, zoom: report.zoom.length, keyboard: report.keyboard.length, failures: report.failures.length }));
if (report.failures.length) process.exitCode = 1;
