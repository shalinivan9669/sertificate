import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();
await page.goto('http://127.0.0.1:3102/courses',{waitUntil:'networkidle'});
console.log(await page.evaluate(()=>{const app=document.querySelector('#__nuxt').__vue_app__;return { keys:Object.keys(app||{}), instance:app?._instance?.isMounted, nuxt:app?.$nuxt?.isHydrating, text:document.querySelector('h1')?.textContent};}));
await page.locator('input[type=search]').fill('xxxnonexistentprogram');
console.log(await page.locator('.ed-catalog-list article').count());
await page.locator('.ed-menu-trigger').focus(); await page.keyboard.press('Enter'); console.log(await page.locator('#editorial-menu').isVisible());
await browser.close();
