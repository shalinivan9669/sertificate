import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3102';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local only');
const out='artifacts/redesign/2026-09-14/admin-navigation';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={checks:[],errors:[],boundary:'Synthetic read-only API responses exercise the administrative navigation component and an empty organization page only. Selected organization version, server staff authorization and working administrative data are not tested here.'};
const catalog=await (await fetch(base+'/api/v1/catalog/programs')).json();
const fixtureVersion={id:'qa-organization-version',title:'Изолированный вариант для проверки интерфейса',language:'ru',durationHours:16,priceMinor:0,currency:'KZT',modules:[],format:'online',intakeOpen:true,accessModel:'free',billingBasis:'organization'};
const fixtureCatalog={...catalog,programs:catalog.programs.map((program,index)=>index?program:{...program,availability:'published',versions:[fixtureVersion]})};
async function json(route,body,status=200){await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
try {
 for (const role of ['admin','editor','issuer','learner']) {
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/api/v1/me',route=>json(route,{user:{id:'qa-user',name:'Проверка интерфейса',email:'qa-ui@example.invalid',role,twoFactorEnabled:true,mfaVerified:true}}));
  await page.route('**/api/v1/me/enrollments',route=>json(route,{enrollments:[]}));
  await page.route('**/api/v1/commerce/me',route=>json(route,{orders:[],credentials:[],paymentProvider:'disabled'}));
  await page.route('**/api/v1/me/notifications',route=>json(route,{notifications:[]}));
  await page.route('**/api/v1/organizations*',route=>json(route,{organizations:[],pagination:{page:1,total:0,totalPages:1}}));
  await page.route('**/api/v1/catalog/programs',route=>json(route,fixtureCatalog));
  await page.route('**/api/v1/admin/**',route=>json(route,{statusCode:403,message:'Synthetic denied operation'},403));
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating===false);
  await page.locator('a[href^="/cabinet"]').first().click();
  await expect(page.locator('.ed-cabinet-profile')).toBeVisible();
  if (role==='learner') {await expect(page.locator('a[href="/admin"]')).toHaveCount(0);report.checks.push({role,managementEntry:false});await page.close();continue;}
  await page.locator('a[href="/admin"]').click();
  await expect(page.locator('.ed-admin-nav')).toBeVisible();
  const expected={admin:9,editor:2,issuer:4}[role];
  await expect(page.locator('#admin-sections li')).toHaveCount(expected);
  await expect(page.locator('#admin-sections a[aria-current="page"]')).toHaveAttribute('href','/admin');
  if(role==='admin'){
   await page.locator('#admin-sections a[href="/admin/analytics"]').click();
   await expect(page.locator('#admin-sections a[aria-current="page"]')).toHaveAttribute('href','/admin/analytics');
   await page.screenshot({path:out+'/admin-nav-desktop-synthetic.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('.ed-admin-nav-toggle')).toBeVisible();
   await expect(page.locator('#admin-sections')).not.toBeVisible();
   await page.locator('.ed-admin-nav-toggle').click();
   await expect(page.locator('#admin-sections')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
   await page.screenshot({path:out+'/admin-nav-mobile-synthetic.png',fullPage:true});
   await page.locator('#admin-sections a[href="/admin/programs"]').click();
   await expect(page.locator('.ed-admin-nav-toggle')).toHaveAttribute('aria-expanded','false');
   report.checks.push({name:'Mobile menu expands, labels active section, closes on route change',passed:true});
  }
  report.checks.push({role,sections:expected});
  await page.locator('.lms-nav a[href="/cabinet"]').last().click();
  await expect(page.locator('.ed-cabinet-profile')).toBeVisible();
  // Only the ordinary cabinet-to-organization link and empty organization heading are checked here.
  await page.locator('a[href="/cabinet/organization"]').first().click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Кабинет организации');
  await page.close();
 }
 expect(report.errors).toHaveLength(0);
} catch(error){report.failure=error.stack;process.exitCode=1}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2))}
