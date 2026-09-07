import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { chromium, expect, request } from '@playwright/test';

const fixture = JSON.parse(await readFile('.data/extra-acceptance-fixture.json','utf8'));
const base='http://127.0.0.1:3106';
if(process.env.NODE_ENV!=='test'||process.env.OT_ALLOW_TEST_SEED!=='1'||process.env.VERCEL||process.env.VERCEL_ENV||process.env.TURSO_DATABASE_URL||process.env.TURSO_AUTH_TOKEN||fixture.notice!=='SYNTHETIC LOCAL TEST DATA ONLY'||!fixture.databasePath.includes('ot-extra-acceptance-')||!fixture.databasePath.endsWith('e2e.sqlite')) throw new Error('Isolated extra acceptance database required');
const output='artifacts/acceptance-extra'; await mkdir(output,{recursive:true});
const checks=[]; const errors=[]; const passed=(id,name,evidence={})=>{checks.push({id,name,status:'passed',...evidence});console.log('PASS',id,name);};
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}); const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
const db=createClient({url:'file:'+fixture.databasePath.replaceAll('\\','/'),concurrency:1});
const row=async(sql,args=[])=>(await db.execute({sql,args})).rows[0];
const get=async(path)=>{const response=await page.request.get(base+'/api/v1'+path);assert.equal(response.status(),200);return response.json();};
async function go(path){const r=await page.goto(path.startsWith('http')?path:base+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(document.querySelector('#__nuxt')?.__vue_app__));return r;}
async function post(path,body){const r=await page.request.post(base+'/api/v1'+path,{data:body,headers:{Origin:base,'Idempotency-Key':randomUUID()}});assert.equal(r.status(),200);return r.json();}
async function login(p=page){await p.getByLabel('Email',{exact:true}).fill(fixture.learner.email);await p.getByLabel('Құпиясөз',{exact:true}).fill(fixture.learner.password);const result=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/sign-in/email');await p.getByRole('button',{name:'Жеке кабинетке кіру',exact:true}).click();assert.equal((await result).status(),200);}
async function selectionCookie(){const cookie=(await context.cookies()).find(c=>c.name==='ot-center-selection-v1');assert.ok(cookie);return JSON.parse(decodeURIComponent(cookie.value));}
try{
  await go('/astana/ohrana-truda'); await page.getByRole('link',{name:'KK',exact:true}).click(); await page.waitForURL(base+'/kk/astana/ohrana-truda');
  await expect(page.locator('#city-select')).toHaveValue('astana');
  await page.locator('a[href*="/kk/program-selection?"]').first().click();await page.waitForURL(u=>u.pathname==='/kk/program-selection');
  assert.equal(new URL(page.url()).searchParams.get('city'),'astana');
  await page.locator('input[name="direction"][value="ohrana-truda"]').check();
  await page.getByRole('button',{name:'Келесі қадам',exact:true}).click();
  await page.getByLabel(/^Сіздің рөліңіз/).selectOption('worker');await page.getByLabel(/^Сала/).selectOption('construction');
  await page.getByRole('button',{name:'Келесі қадам',exact:true}).click();await page.getByLabel('Онлайн',{exact:true}).check();
  await page.getByRole('button',{name:'Келесі қадам',exact:true}).click();await page.getByRole('link',{name:'Бағдарламаны көру',exact:true}).click();
  await page.waitForURL(u=>u.pathname==='/kk/courses/ohrana-truda');
  const courseUrl=new URL(page.url());assert.equal(courseUrl.searchParams.get('city'),'astana');
  await page.getByRole('button',{name:'Оқуға жазылу',exact:true}).click();await page.waitForURL(u=>u.pathname==='/kk/auth/login');
  const returnTo=new URL(page.url()).searchParams.get('returnTo');assert.equal(new URL(returnTo,base).pathname,'/kk/courses/ohrana-truda');assert.equal(new URL(returnTo,base).searchParams.get('city'),'astana');
  await login();await page.waitForURL(base+returnTo);
  await page.getByRole('button',{name:'Оқуға жазылу',exact:true}).click();await page.waitForURL(/\/kk\/learn\/[^/?]+$/);
  const enrollmentId=new URL(page.url()).pathname.split('/').at(-1);const enrollment=await get('/enrollments/'+enrollmentId);
  assert.equal(enrollment.versionId,fixture.kkVersionId);assert.equal(enrollment.language,'kk');
  await page.getByRole('link',{name:'Жеке кабинет',exact:true}).first().click();await page.waitForURL(base+'/kk/cabinet');
  const chosen=await selectionCookie();assert.equal(chosen.direction,'ohrana-truda');assert.equal(chosen.city,'astana');assert.equal(chosen.role,'worker');
  passed('T008','KK city-course → selection → auth returnTo → pinned KK learning → KK cabinet preserves program/city selection',{cityScope:'selection cookie and returnTo; enrollment pins KK version'});
  await page.getByRole('link',{name:'Оқуды ашу',exact:true}).click();
  await page.getByRole('button',{name:'Материал оқылды — сабақты аяқтау',exact:true}).click();
  await page.getByRole('link',{name:/Білімді тексеру шарттары/}).click();
  await page.getByLabel('Шарттармен таныстым және білімімді тексеруге дайынмын.',{exact:true}).check();
  await page.getByRole('button',{name:'Әрекетті бастау — таймерді іске қосу',exact:true}).click();await page.waitForURL(/\/exam\?attempt=/);
  const examUrl=page.url();const attemptId=new URL(examUrl).searchParams.get('attempt');
  await page.getByLabel('Correct test option',{exact:true}).check();await page.getByText('Барлық жауаптар сақталды',{exact:true}).waitFor();
  const before=await get('/attempts/'+attemptId);assert.equal(before.status,'in_progress');
  await page.getByRole('link',{name:'Басты бет',exact:true}).first().click();await page.waitForURL(base+'/kk');
  await page.locator('header a[href="/kk/courses"]').click();await page.waitForURL(base+'/kk/courses');
  await page.getByRole('link',{name:'Жеке кабинет',exact:true}).first().click();await page.waitForURL(base+'/kk/cabinet');
  await page.getByRole('link',{name:'Оқуды ашу',exact:true}).click();await page.getByRole('link',{name:/Білімді тексеру шарттары/}).click();
  await page.locator(`a[href="${new URL(examUrl).pathname}${new URL(examUrl).search}"]`).click();await page.waitForURL(examUrl);
  await expect(page.getByLabel('Correct test option',{exact:true})).toBeChecked();const after=await get('/attempts/'+attemptId);
  assert.equal(after.id,before.id);assert.equal(after.deadlineAt,before.deadlineAt);assert.deepEqual(after.questions,before.questions);assert.deepEqual(after.answers,before.answers);
  assert.equal((await get('/enrollments/'+enrollmentId)).progress.percent,100);passed('T010','Home/catalog navigation and real resume link preserve enrollment/progress/active form/deadline and saved answer');
  const firstSession=await (await page.request.get(base+'/api/auth/get-session')).json();
  const independent=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const mobile=await independent.newPage();mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(base+'/kk/auth/login?returnTo='+encodeURIComponent('/kk/learn/'+enrollmentId),{waitUntil:'domcontentloaded'});
    await mobile.waitForFunction(()=>Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await login(mobile);await mobile.waitForURL(base+'/kk/learn/'+enrollmentId);
    const mobileSessionResponse=await mobile.request.get(base+'/api/auth/get-session');assert.equal(mobileSessionResponse.status(),200);const mobileSession=await mobileSessionResponse.json();
    assert.equal(mobileSession.user.id,fixture.learner.id);assert.notEqual(mobileSession.session.id,firstSession.session.id,'independent context must sign in to a new server session');
    const mobileEnrollmentResponse=await mobile.request.get(base+'/api/v1/enrollments/'+enrollmentId);assert.equal(mobileEnrollmentResponse.status(),200);const mobileEnrollment=await mobileEnrollmentResponse.json();
    assert.equal(mobileEnrollment.versionId,enrollment.versionId);assert.equal(mobileEnrollment.progress.percent,100);
    await expect(mobile.getByText('Сабақ аяқталды. Оқу барысы серверде сақталды.',{exact:true})).toBeVisible();
    passed('T033','New independent 390px browser context and fresh sign-in recover the same pinned completed lesson',{deviceScope:'independent Chromium context/new server session; not a physical second device'});
    await mobile.getByRole('link',{name:/Білімді тексеру шарттары/}).click();
    await mobile.locator(`a[href="${new URL(examUrl).pathname}${new URL(examUrl).search}"]`).click();await mobile.waitForURL(examUrl);
    await expect(mobile.getByLabel('Correct test option',{exact:true})).toBeChecked();
    const mobileAttemptResponse=await mobile.request.get(base+'/api/v1/attempts/'+attemptId);assert.equal(mobileAttemptResponse.status(),200);const mobileAttempt=await mobileAttemptResponse.json();
    assert.equal(mobileAttempt.id,before.id);assert.equal(mobileAttempt.deadlineAt,before.deadlineAt);assert.deepEqual(mobileAttempt.questions,before.questions);assert.deepEqual(mobileAttempt.answers,before.answers);
    const retainedFirstResponse=await page.request.get(base+'/api/auth/get-session');assert.equal(retainedFirstResponse.status(),200);assert.equal((await retainedFirstResponse.json()).session.id,firstSession.session.id);
    await expect(page.getByLabel('Correct test option',{exact:true})).toBeChecked();
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await mobile.screenshot({path:output+'/independent-session-390.png',fullPage:true});
    passed('T040','Independent mobile session resumes identical active form/order/deadline/answers while original session remains intact');
  }finally{await independent.close();}
  const sessionResponse=await page.request.get(base+'/api/auth/get-session');assert.equal(sessionResponse.status(),200);const session=await sessionResponse.json();assert.equal(session.user.id,fixture.learner.id);
  const draft=await row('SELECT status,deadline_at,revision,form_json,answers_json FROM attempts WHERE id=?',[attemptId]);
  // Expire the actual HTTP-created test session. No token/session is forged or created through SQL.
  await db.execute({sql:'UPDATE session SET expiresAt=? WHERE id=? AND userId=?',args:[Date.now()-1000,session.session.id,fixture.learner.id]});
  const unauthorized=await page.request.get(base+'/api/v1/attempts/'+attemptId);assert.equal(unauthorized.status(),401);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('link',{name:'Аккаунтқа кіру',exact:true}).first().click();await page.waitForURL(u=>u.pathname==='/kk/auth/login');
  assert.equal(new URL(page.url()).searchParams.get('returnTo'),new URL(examUrl).pathname+new URL(examUrl).search);
  await login();await page.waitForURL(examUrl);await expect(page.getByLabel('Correct test option',{exact:true})).toBeChecked();
  assert.deepEqual(await row('SELECT status,deadline_at,revision,form_json,answers_json FROM attempts WHERE id=?',[attemptId]),draft);
  passed('T020','Expired real session gets HTTP401 and login recovery without losing server draft',{scope:'expiry/invalidation/relogin; separate existing auth suite covers reset/logout'});
  const order=(await post('/orders',{versionId:fixture.paidVersionId})).order;const count=Number((await row('SELECT COUNT(*) n FROM enrollments WHERE user_id=?',[fixture.learner.id])).n);
  const fake=await go(`/success?paid=true&orderId=${encodeURIComponent(order.id)}`);assert.equal(fake.status(),404);
  const stored=await get('/orders/'+order.id);assert.equal(stored.order.status,'created');assert.equal(stored.order.enrollmentId,null);
  assert.equal(Number((await row('SELECT COUNT(*) n FROM enrollments WHERE user_id=?',[fixture.learner.id])).n),count);
  assert.equal((await row('SELECT status FROM attempts WHERE id=?',[attemptId])).status,'in_progress');passed('T051','Fake /success?paid=true URL remains404 and grants neither paid enrollment nor order success');
  const token=new URL(fixture.verificationUrl).pathname.split('/').at(-1);const anon=await request.newContext({baseURL:base});
  try{
    const verified=await anon.get('/api/v1/verify/'+token);assert.equal(verified.status(),200);const body=await verified.json();
    assert.deepEqual(Object.keys(body).sort(),['serial','status','programTitle','issuedAt','revokedAt','registry'].sort());assert.equal(body.serial,fixture.verificationSerial);assert.equal(body.status,'issued');
    assert.match(verified.headers()['cache-control'],/no-store/);assert.match(verified.headers()['x-robots-tag'],/noindex/);
    assert.doesNotMatch(JSON.stringify(body),/@|email|phone|learnerName|userId|verification_hash|document_base64/i);assert.ok(!JSON.stringify(body).includes(fixture.verificationLearner));
    const landing=await go('/verify/'+token);assert.equal(landing.status(),200);assert.match(landing.headers()['cache-control'],/no-store/);assert.match(landing.headers()['x-robots-tag'],/noindex/);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
    await page.screenshot({path:output+'/verification.png',fullPage:true});passed('T062','Actual service-issued synthetic PDF token verifies anonymously with exact minimal DTO/no-store/noindex and no contacts');
    let limited=false;const statuses=[];
    for(let n=0;n<35;n++){const r=await anon.get('/api/v1/verify/'+randomBytes(32).toString('base64url'));statuses.push(r.status());if(r.status()===429){limited=true;break;}assert.equal(r.status(),404);const b=await r.json();assert.equal(b.data.code,'CREDENTIAL_NOT_FOUND');assert.doesNotMatch(JSON.stringify(b),/@|learnerName|document_base64/);}
    assert.ok(limited);passed('T063','Wrong-token HTTP enumeration gets uniform404 then durable429',{requests:statuses.length,statuses});
  }finally{await anon.dispose();}
  assert.deepEqual(errors,[]);passed('browser','No JavaScript errors in the added acceptance flow');
  await writeFile(output+'/report.json',JSON.stringify({status:'passed',time:new Date().toISOString(),build:'c76fd093-af00-4e6b-9b68-b69a40dc2480',checks,errors,scope:'local isolated runtime; no external providers or notifications'},null,2));
}catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(output+'/report.json',JSON.stringify({status:'failed',time:new Date().toISOString(),checks,errors,error:error.message},null,2));throw error;}
finally{db.close();await context.close();await browser.close();}
