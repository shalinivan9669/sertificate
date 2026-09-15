import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3102';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local verification only');
const fixture = JSON.parse(await readFile('.data/editorial/e2e-fixture.json', 'utf8'));
if (fixture.notice !== 'SYNTHETIC LOCAL TEST DATA ONLY') throw Error('Synthetic fixture required');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
const report = { checks:[], errors:[], starts:[] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (r.method()==='POST' && /attempts/.test(r.url())) report.starts.push(r.url()); });
const menu = page.locator('#editorial-menu');
async function openLearning(width) {
  await page.locator('.ed-menu-trigger').click();
  if (width <= 700) await menu.locator('select').selectOption('learning');
  else await menu.locator('#ed-nav-tab-learning').click();
}
try {
  await page.goto(base + '/?city=almaty&format=classroom');
  await openLearning(1440);
  await menu.getByRole('link', { name:/01 \/ Проверка знаний/ }).click();
  await page.locator('main').getByRole('link', {name:/Войти/}).first().click();
  await page.getByLabel('Email', {exact:true}).fill(fixture.other.email);
  await page.getByLabel('Пароль', {exact:true}).fill(fixture.other.password);
  await page.getByRole('button', {name:'Вход в личный кабинет',exact:true}).click();
  await page.waitForURL(/\/cabinet\?.*#assessments/);
  await page.locator('#assessments .ed-assessment-links a').first().waitFor();
  const href = await page.locator('#assessments .ed-assessment-links a').first().getAttribute('href');
  expect(href).toMatch(/^\/learn\/[^/]+\/pre-test$/);
  report.checks.push({name:'menu → sign-in → exact assessment section in cabinet',destination:page.url()});
  await page.locator('#assessments').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/editorial/menu/cabinet-assessments-1440.png'});
  await page.locator('#assessments .ed-assessment-links a').first().click();
  await expect(page).toHaveURL(base + href);
  await expect(page.locator('.lms-heading')).toContainText('Перед проверкой знаний');
  expect(report.starts).toEqual([]);
  report.checks.push({name:'assigned course opens real pre-test conditions without creating an attempt'});
  await openLearning(1440);
  await menu.getByRole('link', {name:/02 \/ Мои документы/}).click();
  await expect(page).toHaveURL(/#documents$/);
  await expect(page.locator('#documents')).toContainText('Мои документы');
  report.checks.push({name:'documents menu opens actual documents section'});
  await page.setViewportSize({width:390,height:844});
  await openLearning(390);
  await menu.getByRole('link', {name:/03 \/ Заказы и оплата/}).click();
  await expect(page).toHaveURL(/#orders$/);
  await expect(page.locator('#orders')).toContainText('Мои заказы');
  report.checks.push({name:'phone menu opens actual orders section'});
  await openLearning(390);
  await menu.getByRole('link', {name:/01 \/ Проверка знаний/}).click();
  await page.locator('#assessments').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/editorial/menu/cabinet-assessments-390.png'});
  expect(report.errors).toEqual([]); expect(report.starts).toEqual([]);
} catch(error) {report.failure=error.stack;process.exitCode=1;await page.screenshot({path:'artifacts/editorial/menu/learning-failure.png'}).catch(()=>{});}
finally {await writeFile('artifacts/editorial/menu/learning-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
