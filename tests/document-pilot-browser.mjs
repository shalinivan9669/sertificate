import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@libsql/client';
import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(await readFile('.data/document-pilot-fixture.json', 'utf8'));
const base = process.env.TEST_BASE_URL || fixture.baseUrl;
if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.TURSO_DATABASE_URL || !/^http:\/\/127\.0\.0\.1:3103$/.test(base) || fixture.notice !== 'SYNTHETIC LOCAL TEST DATA ONLY' || !fixture.databasePath.includes('ot-document-pilot-') || !fixture.databasePath.endsWith('document-pilot.sqlite')) throw new Error('Isolated local document pilot required');
const output = 'artifacts/document-pilot';
await mkdir(output, { recursive: true });
const artifact = process.env.OT_PILOT_ARTIFACT_ROOT
  ? JSON.parse(await readFile(resolve(process.env.OT_PILOT_ARTIFACT_ROOT, '.output/public/_nuxt/builds/latest.json'), 'utf8')) : null;
const checks = [], errors = [], mutations = [];
const db = createClient({ url: 'file:' + fixture.databasePath.replaceAll('\\', '/') });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const contexts = [];
let currentPage, lastLogin = 0;
const passed = name => { checks.push({ name, status: 'passed' }); console.log('PASS', name); };
const row = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
const get = async (page, path) => { const response = await page.request.get(base + '/api/v1' + path); assert.equal(response.status(), 200, await response.text()); return response.json(); };
async function go(page, path) {
  currentPage = page;
  const response = await page.goto(path.startsWith('http') ? path : base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  return response;
}
function totp(uri) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...new URL(uri).searchParams.get('secret').toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  return String((hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function mutate(page, pathname, click, expected = 200) {
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === 'POST');
  await click(); const response = await responsePromise;
  const body = await response.json(); mutations.push({ pathname, status: response.status(), via: 'browser UI' });
  assert.equal(response.status(), expected, pathname + ' ' + JSON.stringify(body));
  return body;
}
async function session(actor, mfa = true) {
  const wait = Math.max(0, 13000 - (Date.now() - lastLogin)); if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastLogin = Date.now();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); contexts.push(context);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await go(page, '/auth/login?returnTo=%2Fcabinet%2Fsecurity');
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Пароль', { exact: true }).fill(actor.password);
  let responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email');
  await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click();
  let response = await responsePromise;
  if (response.status() === 429) {
    await page.waitForTimeout(Math.min(60000, Math.max(1000, Number(response.headers()['retry-after'] || 60) * 1000)));
    responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email');
    await page.getByRole('button', { name: 'Вход в личный кабинет', exact: true }).click(); response = await responsePromise;
  }
  assert.equal(response.status(), 200, 'Actual login ' + actor.email);
  await page.waitForURL(url => url.pathname === '/cabinet/security');
  if (mfa) {
    await page.getByLabel('Текущий пароль', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: 'Настроить приложение', exact: true }).click();
    await expect(page.locator('code')).toContainText('otpauth://');
    await page.getByLabel('Код из приложения', { exact: true }).fill(totp(await page.locator('code').textContent()));
    await page.getByRole('button', { name: 'Подтвердить и включить', exact: true }).click();
    await page.getByText('Настройки безопасности сохранены.', { exact: true }).waitFor();
  }
  return page;
}
const actionSection = page => page.locator('section').filter({ has: page.getByLabel('Подтверждаю действие и указанное основание.', { exact: true }) }).last();
async function confirmAction(page, title, endpoint, reason, expected = 200) {
  const section = actionSection(page);
  await section.getByLabel(/^Основание и сведения для проверки/).fill(reason);
  await section.getByLabel('Подтверждаю действие и указанное основание.', { exact: true }).check();
  return mutate(page, endpoint, () => section.getByRole('button', { name: title, exact: true }).click(), expected);
}
async function tick(admin) {
  await go(admin, '/admin');
  await admin.getByLabel('Обработать пакет очереди. Настроенные интеграции могут отправить письма и передать заявки.', { exact: true }).check();
  const result = await mutate(admin, '/api/v1/admin/operations/tick', () => admin.getByRole('button', { name: 'Обработать очередь сейчас', exact: true }).click());
  await admin.getByText('Пакет очереди обработан. Проверьте статусы задач.', { exact: true }).waitFor();
  return result;
}
const fields = ['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'];
const labels = ['ФИО слушателя', 'Название программы', 'Номер документа', 'Дата выдачи', 'Ссылка проверки', 'Наименование издателя'];
async function uploadTemplate(issuer, withFont) {
  await go(issuer, '/admin/documents');
  await issuer.locator('summary').filter({ hasText: 'Добавить бланк документа' }).click();
  await issuer.getByLabel(/^Программа/).selectOption(fixture.programId);
  const name = withFont ? 'TEST ONLY repaired Unicode QR template' : 'TEST ONLY intentionally missing Unicode font';
  await issuer.getByLabel('Название шаблона', { exact: true }).fill(name);
  await issuer.getByLabel('Наименование организации, выдающей документ', { exact: true }).fill('TEST ONLY ISSUER - NO VALIDITY');
  const pdf = await PDFDocument.create(); const page = pdf.addPage([720, 900]);
  page.drawText('SYNTHETIC LOCAL TEST - NOT A VALID CREDENTIAL', { x: 28, y: 858, size: 15 });
  for (const [i, key] of fields.entries()) {
    page.drawText(key, { x: 30, y: 806 - i * 80, size: 10 });
    const field = pdf.getForm().createTextField(key);
    field.addToPage(page, { x: 30, y: 755 - i * 80, width: 660, height: 42 }); field.setFontSize(key === 'verificationUrl' ? 9 : 12);
  }
  await issuer.getByLabel('Бланк PDF до 1 МБ', { exact: true }).setInputFiles({ name: 'TEST-ONLY-template.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  if (withFont) await issuer.locator('input[type=file]').nth(1).setInputFiles(process.env.OT_TEST_UNICODE_FONT_PATH || 'C:/Windows/Fonts/arial.ttf');
  for (const [i, label] of labels.entries()) await issuer.getByLabel(label, { exact: true }).fill(fields[i]);
  await issuer.getByLabel('Добавлять QR-код публичной проверки', { exact: true }).check();
  await issuer.getByLabel('X (pt)', { exact: true }).fill('530'); await issuer.getByLabel('Y (pt)', { exact: true }).fill('40');
  const result = await mutate(issuer, '/api/v1/admin/credential-templates', () => issuer.getByRole('button', { name: 'Сохранить шаблон на проверку', exact: true }).click());
  await issuer.getByText('Шаблон сохранён как черновик.', { exact: false }).waitFor();
  return { id: result.template.id, name };
}
async function approveTemplate(reviewer, template) {
  await go(reviewer, '/admin/documents');
  const card = reviewer.locator('article').filter({ hasText: template.name });
  await card.getByRole('button', { name: 'Рассмотреть и утвердить', exact: true }).click();
  await reviewer.getByLabel('Основание и результаты проверки', { exact: true }).fill('TEST ONLY independent AcroForm mapping and recovery pilot');
  await reviewer.getByLabel('Я проверил(-а) бланк и соответствие полей, подтверждаю использование для указанной программы.', { exact: true }).check();
  await mutate(reviewer, '/api/v1/admin/credential-templates/' + template.id + '/approve', () => reviewer.getByRole('button', { name: 'Утвердить шаблон', exact: true }).click());
  await reviewer.getByText('Шаблон утверждён.', { exact: true }).waitFor();
}
let enrollmentId, firstCredential, replacement, verifyUrl;
try {
  const admin = await session(fixture.users.admin);
  await go(admin, '/admin/users');
  await admin.getByLabel('Поиск по имени или email', { exact: true }).fill(fixture.users.instructor.email);
  await admin.getByRole('button', { name: 'Найти пользователя', exact: true }).click();
  const userCard = admin.locator('article').filter({ hasText: fixture.users.instructor.email });
  await userCard.getByRole('button', { name: 'Изменить права', exact: true }).click();
  await admin.getByLabel(/^Новая роль/).selectOption('instructor');
  await admin.getByLabel('Основание изменения прав', { exact: true }).fill('TEST ONLY instructor permission approved for synthetic pilot');
  await admin.getByLabel('Подтверждаю предоставление выбранных прав этому пользователю.', { exact: true }).check();
  await mutate(admin, '/api/v1/admin/users/' + fixture.users.instructor.id + '/role', () => admin.getByRole('button', { name: 'Сохранить права и основание', exact: true }).click());
  await admin.getByText('Права обновлены.', { exact: false }).waitFor();
  passed('Admin completes actual MFA and grants instructor role through UI with reason and confirmation');

  const learner = await session(fixture.users.learner, false);
  await go(learner, '/courses/' + fixture.programId);
  const enroll = learner.getByRole('button', { name: 'Записаться на обучение', exact: true }); const variant = learner.getByLabel(/^Вариант и язык обучения/);
  await variant.or(enroll).first().waitFor(); if (await variant.count()) await variant.selectOption(fixture.versionId);
  await enroll.click(); await learner.waitForURL(/\/learn\/[^/?]+$/);
  enrollmentId = new URL(learner.url()).pathname.split('/').pop();
  await learner.getByRole('button', { name: 'Материал изучен — завершить урок', exact: true }).click();
  await learner.getByText('Урок завершён. Прогресс сохранён на сервере.', { exact: true }).waitFor();
  assert.equal((await get(learner, '/enrollments/' + enrollmentId)).progress.completed, 1);
  passed('Learner enrolls and completes text through UI; required practice remains incomplete');

  await go(admin, '/admin');
  await admin.getByLabel(/^Версия для настройки набора/).selectOption(fixture.versionId);
  await admin.getByLabel(/^Новое состояние набора/).selectOption('false');
  await admin.getByLabel('Основание изменения набора', { exact: true }).fill('TEST ONLY stop new intake while existing learner completes the document pilot');
  await admin.getByLabel('Подтверждаю изменение набора для выбранной версии.', { exact: true }).check();
  await mutate(admin, '/api/v1/admin/program-versions/' + fixture.versionId + '/intake', () => admin.getByRole('button', { name: 'Сохранить состояние набора', exact: true }).click());
  const intakePage = await (await browser.newContext()).newPage(); contexts.push(intakePage.context());
  await go(intakePage, '/courses/' + fixture.programId);
  await intakePage.getByText('Набор на эту версию программы приостановлен.', { exact: false }).waitFor();
  assert.equal(await intakePage.getByRole('button', { name: 'Записаться на обучение', exact: true }).count(), 0);
  passed('Admin stops intake with reason; public page keeps curriculum and consultation while hiding enrollment');

  const issuer = await session(fixture.users.issuer);
  await go(issuer, '/admin');
  assert.equal(await issuer.getByRole('heading', { name: 'Очередь обработки', exact: true }).count(), 0);
  await issuer.getByRole('button', { name: 'Оформить документ', exact: true }).click();
  await issuer.getByLabel('ID назначения ученика', { exact: true }).fill(enrollmentId);
  const refused = await confirmAction(issuer, 'Оформить документ по результатам обучения', '/api/v1/admin/credentials', 'TEST ONLY attempt before practice and exam must be denied', 409);
  assert.match(JSON.stringify(refused), /REQUIRED_LEARNING_INCOMPLETE/);
  await expect(issuer.locator('.lms-error')).toBeVisible();
  assert.equal((await row('SELECT COUNT(*) AS n FROM credentials')).n, 0);
  passed('Issuer cannot issue before required learning; UI shows refusal and reserves no serial');

  const instructor = await session(fixture.users.instructor);
  await go(instructor, '/admin');
  assert.equal(await instructor.getByRole('heading', { name: 'Документы', exact: true }).count(), 0);
  assert.equal(await instructor.getByRole('heading', { name: 'Очередь обработки', exact: true }).count(), 0);
  await instructor.locator('summary').filter({ hasText: 'Назначения и практическая часть' }).click();
  await instructor.getByLabel(/^Назначение слушателя/).selectOption(enrollmentId);
  await instructor.getByLabel(/^Практический урок/).selectOption({ label: 'TEST ONLY instructor practice' });
  await instructor.getByLabel('Основание подтверждения', { exact: true }).fill('TEST ONLY supervised synthetic practice complete');
  await instructor.getByLabel('Сведения о выполненной практике', { exact: true }).fill('TEST ONLY pilot checklist observed locally; no real occupational qualification');
  await mutate(instructor, '/api/v1/admin/enrollments/' + enrollmentId + '/practice/' + fixture.practiceLessonId, () => instructor.getByRole('button', { name: 'Подтвердить практику и сохранить основание', exact: true }).click());
  await instructor.getByText('Практическая часть подтверждена и записана в журнал.', { exact: true }).waitFor();
  passed('New instructor completes MFA, confirms practice with evidence and has no issue or queue controls');

  await go(learner, '/learn/' + enrollmentId);
  await learner.getByRole('link', { name: 'Условия проверки знаний', exact: false }).click();
  await learner.getByLabel('Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.').check();
  await learner.getByRole('button', { name: 'Начать попытку — запустить таймер', exact: true }).click();
  await learner.waitForURL(/\/exam\?attempt=/);
  await learner.getByLabel('TEST CORRECT', { exact: true }).check();
  await learner.getByText('Все ответы сохранены', { exact: true }).waitFor();
  await learner.getByLabel('Завершить попытку сейчас. После отправки ответы изменить нельзя.', { exact: true }).check();
  const attemptId = new URL(learner.url()).searchParams.get('attempt');
  const result = await mutate(learner, '/api/v1/attempts/' + attemptId + '/submit', () => learner.getByRole('button', { name: 'Отправить ответы и завершить попытку', exact: true }).click());
  assert.equal(result.result.pass, true);
  passed('Learner answers and submits through UI; only server grades the synthetic passing result');

  const reviewer = await session(fixture.users.reviewer);
  const originalTemplate = await uploadTemplate(issuer, false);
  await approveTemplate(reviewer, originalTemplate);
  await go(issuer, '/admin'); await issuer.getByRole('button', { name: 'Оформить документ', exact: true }).click();
  await issuer.getByLabel('ID назначения ученика', { exact: true }).fill(enrollmentId);
  const issued = await confirmAction(issuer, 'Оформить документ по результатам обучения', '/api/v1/admin/credentials', 'TEST ONLY approved evidence: server exam and instructor practice');
  firstCredential = issued.credential;
  assert.equal(firstCredential.status, 'pending');
  const reserved = await row('SELECT * FROM credentials WHERE id=?', [firstCredential.id]);
  verifyUrl = JSON.parse(reserved.snapshot_json).verificationUrl;
  await tick(admin);
  const failedJob = await row('SELECT * FROM outbox WHERE type=? AND aggregate_id=?', ['credential.render', firstCredential.id]);
  assert.equal(failedJob.last_error, 'UNICODE_TEMPLATE_FONT_REQUIRED'); assert.equal(failedJob.attempts, 1);
  await expect(admin.getByText('UNICODE_TEMPLATE_FONT_REQUIRED', { exact: true })).toBeVisible();
  await go(learner, '/certificates/' + firstCredential.id);
  assert.equal(await learner.getByRole('link', { name: 'Скачать документ', exact: true }).count(), 0);
  passed('Real render fails for missing Unicode font after reservation; operator sees error and owner gets no fake PDF');

  await go(issuer, '/admin/incidents');
  const pendingIncident = (await get(issuer, '/admin/incidents')).incidents.find(item => item.kind === 'credential_pending' && item.targetId === firstCredential.id);
  assert.ok(pendingIncident, 'Actual failed render creates an issuer incident');
  const incidentCard = issuer.locator('li.lms-card').filter({ hasText: firstCredential.id });
  await expect(incidentCard.getByRole('heading', { name: 'Документ ожидает подготовки', exact: true })).toBeVisible();
  await incidentCard.getByRole('button', { name: 'Принять в работу', exact: true }).click();
  await issuer.getByLabel('Основание и выполненные действия', { exact: true }).fill('TEST ONLY actual Unicode render failure acknowledged; approved font template repair planned');
  await mutate(issuer, '/api/v1/admin/incidents/' + pendingIncident.id, () => issuer.getByRole('button', { name: 'Сохранить решение', exact: true }).click());
  await issuer.getByText('Состояние и основание сохранены в журнале.', { exact: true }).waitFor();
  await expect(incidentCard).toContainText('В работе');

  await go(admin, '/admin');
  const jobCard = admin.locator('article').filter({ hasText: 'credential.render' });
  await jobCard.getByRole('button', { name: 'Повторить с основанием', exact: true }).click();
  await confirmAction(admin, 'Повторить обработку очереди', '/api/v1/admin/outbox/' + failedJob.id + '/retry', 'TEST ONLY retry reproduces missing Unicode font without identity loss');
  await tick(admin);
  assert.equal((await row('SELECT attempts FROM outbox WHERE id=?', [failedJob.id])).attempts, 2);
  assert.equal((await row('SELECT serial FROM credentials WHERE id=?', [firstCredential.id])).serial, reserved.serial);
  passed('Admin retries actual failed job through UI with reason; second failure preserves same serial and job');

  const fixedTemplate = await uploadTemplate(issuer, true); await approveTemplate(reviewer, fixedTemplate);
  await go(issuer, '/admin');
  await issuer.locator('article').filter({ hasText: firstCredential.serial }).getByRole('button', { name: 'Исправить бланк и повторить подготовку PDF', exact: true }).click();
  await issuer.getByLabel(/^Утверждённый бланк для повторной подготовки/).selectOption(fixedTemplate.id);
  await confirmAction(issuer, 'Восстановить подготовку PDF', '/api/v1/admin/credentials/' + firstCredential.id + '/repair', 'TEST ONLY repair using independently approved Unicode font template');
  await issuer.getByText('Подготовка PDF снова поставлена в очередь.', { exact: false }).waitFor();
  await tick(admin);
  const repaired = await row('SELECT * FROM credentials WHERE id=?', [firstCredential.id]);
  assert.equal(repaired.status, 'issued');
  for (const key of ['serial', 'verification_hash', 'attempt_id', 'enrollment_id', 'issued_by', 'created_at']) assert.equal(repaired[key], reserved[key], key + ' unchanged');
  assert.equal(JSON.parse(repaired.snapshot_json).verificationUrl, verifyUrl);
  assert.equal((await row('SELECT id FROM outbox WHERE type=? AND aggregate_id=?', ['credential.render', firstCredential.id])).id, failedJob.id);
  passed('Issuer repairs through approved replacement template; admin renders same credential identity and queue job');

  await go(issuer, '/admin/incidents');
  await issuer.getByLabel(/^Состояние событий/).selectOption('resolved');
  await issuer.getByRole('button', { name: 'Обновить список', exact: true }).click();
  const resolvedIncident = issuer.locator('li.lms-card').filter({ hasText: firstCredential.id });
  await expect(resolvedIncident).toContainText('Закрыт');
  assert.equal((await get(issuer, '/admin/incidents?status=resolved')).incidents.find(item => item.id === pendingIncident.id)?.status, 'resolved');
  passed('Issuer acknowledges actual pending-document incident with reason; successful repair automatically resolves its history');

  await go(learner, '/certificates/' + firstCredential.id);
  const downloaded = learner.waitForEvent('download'); await learner.getByRole('link', { name: 'Скачать документ', exact: true }).click();
  const file = await downloaded; await file.saveAs(output + '/TEST-ONLY-original.pdf');
  assert.equal((await readFile(output + '/TEST-ONLY-original.pdf')).subarray(0, 5).toString(), '%PDF-');
  const inspection = spawnSync(process.env.OT_TEST_PYTHON || 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe', ['tests/document-pilot-pdf.py', resolve(output + '/TEST-ONLY-original.pdf'), resolve(output + '/original-pdf.json')], { encoding: 'utf8' });
  assert.equal(inspection.status, 0, inspection.stdout + inspection.stderr);
  const pdfEvidence = JSON.parse(await readFile(output + '/original-pdf.json', 'utf8'));
  assert.equal(pdfEvidence.qrUrl, verifyUrl); assert.ok(pdfEvidence.text.includes(fixture.users.learner.name)); assert.ok(pdfEvidence.text.includes(firstCredential.serial));
  const publicContext = await browser.newContext(); contexts.push(publicContext); const publicPage = await publicContext.newPage();
  const verification = await go(publicPage, pdfEvidence.qrUrl);
  assert.match(verification.headers()['x-robots-tag'], /noindex/); assert.match(verification.headers()['cache-control'], /no-store/);
  await expect(publicPage.getByText(firstCredential.serial, { exact: true })).toBeVisible();
  assert.equal(await publicPage.getByText(fixture.users.learner.name, { exact: true }).count(), 0);
  const publicDto = await get(publicPage, '/verify/' + new URL(verifyUrl).pathname.split('/').pop());
  assert.equal(publicDto.status, 'issued'); assert.deepEqual(Object.keys(publicDto).sort(), ['issuedAt', 'programTitle', 'registry', 'revokedAt', 'serial', 'status'].sort());
  await publicPage.screenshot({ path: output + '/issued-qr-verification.png', fullPage: true });
  passed('Owner downloads real PDF through UI; rendered PDF contains Cyrillic, immutable serial and decoded working private-minimal QR');

  const other = await session(fixture.users.other, false);
  await go(other, '/certificates/' + firstCredential.id);
  await expect(other.locator('.lms-error')).toBeVisible();
  assert.equal(await other.getByRole('link', { name: 'Скачать документ', exact: true }).count(), 0);
  const unauthorizedDownload = await other.request.get(base + '/api/v1/credentials/' + firstCredential.id + '/download');
  assert.equal(unauthorizedDownload.status(), 404);
  passed('Second authenticated learner cannot view or download another owner document');

  await go(issuer, '/admin');
  await issuer.locator('article').filter({ hasText: firstCredential.serial }).getByRole('button', { name: 'Отозвать с основанием', exact: true }).click();
  await confirmAction(issuer, 'Отозвать документ', '/api/v1/admin/credentials/' + firstCredential.id + '/revoke', 'TEST ONLY withdrawal to exercise immutable reissue history');
  await go(publicPage, verifyUrl); await expect(publicPage.getByRole('heading', { name: 'Отозван', exact: true })).toBeVisible();
  await go(learner, '/certificates/' + firstCredential.id); await expect(learner.getByText('Этот документ отозван или заменён.', { exact: false })).toBeVisible();
  assert.equal(await learner.getByRole('link', { name: 'Скачать документ', exact: true }).count(), 0);
  assert.equal((await row('SELECT document_sha256 FROM credentials WHERE id=?', [firstCredential.id])).document_sha256, repaired.document_sha256);
  passed('Issuer revokes with reason; public verification and owner UI change while stored original PDF remains immutable');

  await go(issuer, '/admin');
  await issuer.locator('article').filter({ hasText: firstCredential.serial }).getByRole('button', { name: 'Оформить замену', exact: true }).click();
  await expect(issuer.getByLabel('ID отозванного документа', { exact: true })).toHaveValue(firstCredential.id);
  const reissued = await confirmAction(issuer, 'Переоформить отозванный документ', '/api/v1/admin/credentials', 'TEST ONLY reissue linked to revoked original with unchanged academic evidence');
  replacement = reissued.credential; assert.notEqual(replacement.id, firstCredential.id); assert.notEqual(replacement.serial, firstCredential.serial);
  await tick(admin);
  const newRow = await row('SELECT * FROM credentials WHERE id=?', [replacement.id]);
  assert.equal(newRow.status, 'issued'); assert.equal(newRow.supersedes_id, firstCredential.id); assert.equal(newRow.attempt_id, reserved.attempt_id);
  assert.equal((await row('SELECT status FROM credentials WHERE id=?', [firstCredential.id])).status, 'superseded');
  await go(publicPage, verifyUrl); await expect(publicPage.getByRole('heading', { name: 'Заменён', exact: true })).toBeVisible();
  await go(learner, '/certificates/' + replacement.id);
  const secondDownload = learner.waitForEvent('download'); await learner.getByRole('link', { name: 'Скачать документ', exact: true }).click(); await (await secondDownload).saveAs(output + '/TEST-ONLY-replacement.pdf');
  const replacementInspection = spawnSync(process.env.OT_TEST_PYTHON || 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe', ['tests/document-pilot-pdf.py', resolve(output + '/TEST-ONLY-replacement.pdf'), resolve(output + '/replacement-pdf.json')], { encoding: 'utf8' });
  assert.equal(replacementInspection.status, 0, replacementInspection.stdout + replacementInspection.stderr);
  const replacementPdf = JSON.parse(await readFile(output + '/replacement-pdf.json', 'utf8'));
  assert.notEqual(replacementPdf.qrUrl, verifyUrl);
  await go(publicPage, replacementPdf.qrUrl); await expect(publicPage.getByText(replacement.serial, { exact: true })).toBeVisible();
  await expect(publicPage.getByRole('heading', { name: 'Выдан', exact: true })).toBeVisible();
  passed('UI reissue creates linked new serial, original becomes superseded, replacement downloads and academic evidence stays unchanged');

  await go(issuer, '/admin/document-batches');
  await issuer.getByLabel(/^Операция/).selectOption('issue');
  await issuer.locator('fieldset label').filter({ hasText: fixture.users.learner.name }).getByRole('checkbox').check();
  await issuer.getByLabel('Основание операции для выбранных записей', { exact: true }).fill('TEST ONLY repeat eligible issue must reuse the existing replacement document');
  const batchPreview = await mutate(issuer, '/api/v1/admin/credential-batches', () => issuer.getByRole('button', { name: 'Проверить и показать результат', exact: true }).click());
  assert.equal(batchPreview.status, 'preview'); assert.equal(batchPreview.items.length, 1); assert.equal(batchPreview.items[0].targetId, enrollmentId);
  await expect(issuer.getByRole('heading', { name: 'Предварительный просмотр', exact: true })).toBeVisible();
  await issuer.getByLabel('Проверил состав, основание и доступные записи. Подтверждаю указанную операцию.', { exact: true }).check();
  const committed = await mutate(issuer, '/api/v1/admin/credential-batches/' + batchPreview.id + '/commit', () => issuer.getByRole('button', { name: 'Подтвердить обработку', exact: true }).click());
  assert.equal(committed.status, 'completed'); assert.equal(committed.items[0].result.duplicate, true); assert.equal(committed.items[0].result.credential.id, replacement.id);
  assert.equal((await row('SELECT COUNT(*) AS n FROM credentials')).n, 2);
  await go(issuer, '/admin/document-batches');
  const batchHistory = issuer.locator('section').filter({ has: issuer.getByRole('heading', { name: 'История операций', exact: true }) }).last();
  await batchHistory.getByRole('button', { name: /Оформление · Операции выполнены/ }).click();
  await expect(issuer.getByRole('heading', { name: 'Операции выполнены', exact: true })).toBeVisible();
  await expect(issuer.getByText(new RegExp(replacement.serial))).toBeVisible();
  passed('Issuer previews and confirms batch issue through UI; duplicate reuses replacement and completed history survives reload');

  async function openLearnerSupport() {
    await go(admin, '/admin/support');
    await admin.getByLabel('Имя или email пользователя', { exact: true }).fill(fixture.users.learner.email);
    await admin.getByRole('button', { name: 'Найти пользователя', exact: true }).click();
    await admin.locator('li.lms-card').filter({ hasText: fixture.users.learner.email }).getByRole('button', { name: 'Открыть историю поддержки', exact: true }).click();
  }
  await openLearnerSupport();
  const originalNoteText = 'TEST ONLY learner reported unavailable PDF; missing template font investigated';
  const correctionText = 'TEST ONLY correction: approved font restored, owner download and replacement QR verified';
  await admin.getByLabel('Новая заметка', { exact: true }).fill(originalNoteText);
  const originalNote = await mutate(admin, '/api/v1/admin/support-notes/' + fixture.users.learner.id, () => admin.getByRole('button', { name: 'Сохранить заметку', exact: true }).click());
  await admin.locator('li.lms-card').filter({ hasText: originalNoteText }).getByRole('button', { name: 'Добавить уточнение', exact: true }).click();
  await admin.getByLabel('Уточнение к выбранной записи', { exact: true }).fill(correctionText);
  const correction = await mutate(admin, '/api/v1/admin/support-notes/' + fixture.users.learner.id, () => admin.getByRole('button', { name: 'Сохранить заметку', exact: true }).click());
  await admin.getByText(correctionText, { exact: true }).waitFor();
  await openLearnerSupport();
  await expect(admin.getByText(originalNoteText, { exact: true })).toBeVisible();
  await expect(admin.getByText(correctionText, { exact: true })).toBeVisible();
  const supportHistory = await get(admin, '/admin/support-notes/' + fixture.users.learner.id);
  assert.equal(supportHistory.pagination.total, 2);
  assert.equal(supportHistory.notes.find(note => note.id === correction.id).supersedesId, originalNote.id);
  passed('Admin searches learner, appends support note and linked correction through UI; both remain after full reload');

  await go(admin, '/admin/users');
  await admin.getByLabel('Поиск по имени или email', { exact: true }).fill(fixture.users.issuer.email);
  await admin.getByRole('button', { name: 'Найти пользователя', exact: true }).click();
  await admin.locator('article').filter({ hasText: fixture.users.issuer.email }).getByRole('button', { name: 'Изменить права', exact: true }).click();
  await admin.getByLabel(/^Новая роль/).selectOption('learner');
  await admin.getByLabel('Основание изменения прав', { exact: true }).fill('TEST ONLY revoke issuer privileges after synthetic pilot');
  await admin.getByLabel('Подтверждаю предоставление выбранных прав этому пользователю.', { exact: true }).check();
  await mutate(admin, '/api/v1/admin/users/' + fixture.users.issuer.id + '/role', () => admin.getByRole('button', { name: 'Сохранить права и основание', exact: true }).click());
  await go(issuer, '/admin'); await expect(issuer.locator('.lms-error')).toBeVisible();
  assert.equal(await issuer.getByRole('button', { name: 'Оформить документ', exact: true }).count(), 0);
  assert.equal((await issuer.request.get(base + '/api/v1/admin/operations')).status(), 403);
  assert.equal((await row('SELECT COUNT(*) AS n FROM session WHERE userId=? AND mfaVerifiedAt IS NOT NULL', [fixture.users.issuer.id])).n, 0);
  passed('Admin revokes issuer role through UI; existing session loses privileged tools and its MFA authorization is invalidated');

  await go(admin, '/admin');
  await admin.getByLabel(/^Версия для настройки набора/).selectOption(fixture.versionId);
  await admin.getByLabel(/^Новое состояние набора/).selectOption('true');
  await admin.getByLabel('Основание изменения набора', { exact: true }).fill('TEST ONLY reopen intake after completing existing learner obligations');
  await admin.getByLabel('Подтверждаю изменение набора для выбранной версии.', { exact: true }).check();
  await mutate(admin, '/api/v1/admin/program-versions/' + fixture.versionId + '/intake', () => admin.getByRole('button', { name: 'Сохранить состояние набора', exact: true }).click());
  await go(intakePage, '/courses/' + fixture.programId);
  await expect(intakePage.getByRole('button', { name: 'Записаться на обучение', exact: true })).toBeVisible();
  passed('Existing learning, exam, repair and reissue finished during closed intake; admin safely reopens new enrollment');

  await instructor.setViewportSize({ width: 360, height: 800 });
  await go(instructor, '/admin');
  await instructor.locator('summary').filter({ hasText: 'Назначения и практическая часть' }).click();
  assert.equal(await instructor.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await instructor.screenshot({ path: output + '/instructor-360.png', fullPage: true });
  await publicPage.setViewportSize({ width: 360, height: 800 });
  await go(publicPage, replacementPdf.qrUrl);
  assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await publicPage.screenshot({ path: output + '/replacement-qr-360.png', fullPage: true });
  passed('Instructor controls and public QR verification fit 360px without horizontal overflow');

  const auditRows = (await db.execute('SELECT actor_id AS actorId,action,target,reason,created_at AS createdAt FROM audit_events ORDER BY created_at')).rows;
  for (const [action, actorId] of [['auth.role_changed', fixture.users.admin.id], ['learning.practice_confirmed', fixture.users.instructor.id], ['outbox_retry', fixture.users.admin.id], ['credential_template_rebound', fixture.users.issuer.id], ['credential_revoked', fixture.users.issuer.id]]) {
    const event = auditRows.find(row => row.action === action && row.actorId === actorId); assert.ok(event, action + ' audited'); assert.ok(event.reason.length >= 10); assert.ok(event.createdAt);
  }
  await writeFile(output + '/audit.json', JSON.stringify(auditRows, null, 2));
  assert.equal((await row('SELECT COUNT(*) AS n FROM credentials')).n, 2);
  assert.equal((await row('SELECT COUNT(*) AS n FROM lesson_progress WHERE lesson_id=? AND completed_by=?', [fixture.practiceLessonId, fixture.users.instructor.id])).n, 1);
  assert.deepEqual(errors, []);
  passed('Read-only audit proves actor, reason, timestamp, practice instructor and two linked credentials; zero JavaScript errors');
} catch (error) {
  checks.push({ name: 'Document UI pilot', status: 'failed', error: error.stack });
  if (currentPage) { checks.push({ name: 'Failure screen', url: currentPage.url(), errors: await currentPage.locator('.lms-error').allTextContents() }); await currentPage.screenshot({ path: output + '/failure.png', fullPage: true }).catch(() => {}); }
  throw error;
} finally {
  await writeFile(output + '/report.json', JSON.stringify({ notice: fixture.notice, base, artifact, databasePath: fixture.databasePath, checkedAt: new Date().toISOString(), checks, errors, mutations, enrollmentId, firstCredential, replacement }, null, 2));
  db.close(); await browser.close();
}
