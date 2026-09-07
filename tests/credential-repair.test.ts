import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { closeDb, execute, getDb, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { completeLesson, createEnrollment } from '../server/services/learning';
import { saveAnswer, startAttempt, submitAttempt } from '../server/services/assessment';
import { approveCredentialTemplate, createCredentialTemplate, downloadCredential, issueCredential, renderCredential, repairPendingCredential, revokeCredential, verifyCredential } from '../server/services/credentials';
import { processOutbox } from '../server/services/operations';
import type { AppUser } from '../server/utils/auth';

let directory: string;
let fontBase64: string;
const actor: AppUser = { id: 'repair-issuer', name: 'TEST ISSUER', email: 'issuer@example.test', role: 'issuer', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const editor: AppUser = { ...actor, id: 'repair-editor', email: 'editor@example.test', role: 'editor' };
const reviewer: AppUser = { ...actor, id: 'repair-reviewer', email: 'reviewer@example.test', role: 'reviewer' };
const learner: AppUser = { ...actor, id: 'repair-learner', name: 'ТЕСТОВЫЙ УЧЕНИК', email: 'learner@example.test', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const envKeys = ['OT_DATABASE_PATH', 'NODE_ENV', 'OT_APP_ENV', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'NUXT_PUBLIC_SITE_URL', 'OT_EMAIL_DELIVERY_ENABLED', 'OT_CRM_DELIVERY_ENABLED'];
const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error?.data?.code === code);
const reason = 'ISOLATED TEST repair evidence, no production document';

function data(): ProgramData {
  return { title: 'ТЕСТОВАЯ ПРОГРАММА — НЕДЕЙСТВИТЕЛЬНО', language: 'ru', audience: 'Test only', prerequisites: '', outcomes: 'Test invariant', limitations: 'No academic validity', format: 'Test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'TEST PDF - NO VALIDITY', support: 'Test only', sourceRefs: ['Isolated synthetic fixture'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'module', title: 'Test', lessons: [{ id: 'lesson', title: 'Test', kind: 'text', required: true, body: 'Synthetic test only.', media: [] }] }],
    assessment: { durationMinutes: 1, maxAttempts: 2, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'question', text: 'Synthetic test?', topic: 'Test', options: [{ id: 'wrong', text: 'Wrong' }, { id: 'right', text: 'Correct' }], correctOptionIds: ['right'] }] };
}
async function template(options: { font?: boolean; programId?: string; issuerName?: string; approved?: boolean } = {}) {
  const document = await PDFDocument.create(); const page = document.addPage([620, 800]);
  page.drawText('ISOLATED TEST PDF - NO VALIDITY', { x: 30, y: 760, size: 14 });
  const fieldMap = Object.fromEntries(['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'].map((key, index) => {
    document.getForm().createTextField(key).addToPage(page, { x: 30, y: 700 - index * 65, width: 560, height: 45 }); return [key, key];
  }));
  const result = await createCredentialTemplate(actor.id, { programId: options.programId || 'ohrana-truda', issuerName: options.issuerName || 'TEST ISSUER - NO VALIDITY', name: 'ISOLATED TEST TEMPLATE', pdfBase64: Buffer.from(await document.save()).toString('base64'), ...(options.font ? { fontBase64 } : {}), fieldMap });
  if (options.approved !== false) await approveCredentialTemplate(reviewer.id, result.template.id, reason);
  return result.template.id;
}
async function reservation(withFont = false) {
  const originalTemplateId = await template({ font: withFont });
  const created = (await createVersion(editor, 'ohrana-truda', data())).version;
  const review = (await reviewVersion(editor, created.id, created.revision)).version;
  const version = (await publishVersion(reviewer, review.id, review.revision, reason)).version;
  const { enrollment } = await createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true);
  await completeLesson(learner, enrollment.id, 'lesson', 0);
  let attempt = await startAttempt(learner, enrollment.id, randomUUID());
  attempt = await saveAnswer(learner, attempt.id, 'question', ['right'], attempt.revision);
  await submitAttempt(learner, attempt.id);
  const credential = (await issueCredential(actor.id, enrollment.id, reason)).credential;
  const before = (await queryOne('SELECT * FROM credentials WHERE id=?', [credential.id]))!;
  assert.equal(JSON.parse(before.snapshot_json).templateId, originalTemplateId);
  return { id: String(credential.id), originalTemplateId, before };
}
async function failed() {
  const pending = await reservation();
  const result = await processOutbox({ limit: 1, aggregateId: pending.id });
  assert.equal(result.results[0]?.code, 'UNICODE_TEMPLATE_FONT_REQUIRED');
  assert.equal((await queryOne('SELECT status FROM credentials WHERE id=?', [pending.id]))!.status, 'pending');
  return pending;
}

before(async () => {
  // Use an installed font, without redistributing proprietary font files or requiring network access.
  // Ubuntu CI has DejaVu; other environments can explicitly set OT_TEST_UNICODE_FONT_PATH.
  const fontPath = [process.env.OT_TEST_UNICODE_FONT_PATH, 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'].find((path): path is string => Boolean(path && existsSync(path)));
  assert.ok(fontPath, 'Install a Unicode font or set OT_TEST_UNICODE_FONT_PATH; this Unicode render test must not be skipped');
  fontBase64 = (await readFile(fontPath)).toString('base64');
  directory = await mkdtemp(join(tmpdir(), 'ot-credential-repair-'));
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_APP_ENV: 'test', NUXT_PUBLIC_SITE_URL: 'https://example.test', OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0' });
  for (const key of ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) delete process.env[key];
  await getDb();
  for (const user of [actor, editor, reviewer, learner]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,?)', [user.id, user.name, user.email, Date.now(), Date.now(), user.role, Number(user.twoFactorEnabled)]);
});
after(async () => {
  mock.restoreAll(); await closeDb();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-credential-repair-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
});

test('T060 Unicode render failure repairs to approved font template and issues one genuine test PDF with unchanged identity', async () => {
  const pending = await failed(); const replacement = await template({ font: true });
  const oldJob = (await queryOne('SELECT * FROM outbox WHERE type=? AND aggregate_id=?', ['credential.render', pending.id]))!;
  const repaired = await repairPendingCredential(actor, pending.id, { templateId: replacement, reason });
  assert.equal(repaired.duplicate, false); assert.equal(repaired.previousTemplateId, pending.originalTemplateId);
  assert.equal((await repairPendingCredential(actor, pending.id, { templateId: replacement, reason })).duplicate, true);
  const updated = (await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]))!;
  const previousSnapshot = JSON.parse(pending.before.snapshot_json); const nextSnapshot = JSON.parse(updated.snapshot_json);
  for (const key of ['learnerName', 'programTitle', 'serial', 'issuedAt', 'issuerName', 'versionId', 'verificationUrl', 'evidence']) assert.deepEqual(nextSnapshot[key], previousSnapshot[key]);
  for (const key of ['serial', 'verification_hash', 'attempt_id', 'enrollment_id', 'issued_by', 'created_at']) assert.deepEqual(updated[key], pending.before[key]);
  assert.equal(nextSnapshot.templateId, replacement); assert.equal(nextSnapshot.renderRevision, 1);
  const job = (await queryOne('SELECT * FROM outbox WHERE type=? AND aggregate_id=?', ['credential.render', pending.id]))!;
  assert.equal(job.id, oldJob.id); assert.equal(job.attempts, oldJob.attempts); assert.equal(job.status, 'pending'); assert.equal(job.last_error, null);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM audit_events WHERE action=? AND target=?', ['credential_template_rebound', pending.id]))!.n, 1);
  const outcome = await processOutbox({ limit: 1, aggregateId: pending.id }); assert.equal(outcome.results[0]?.status, 'delivered');
  const document = await downloadCredential(pending.id, learner.id); assert.equal(document.bytes.subarray(0, 5).toString(), '%PDF-');
  const pdf = await PDFDocument.load(document.bytes); assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getForm().getFields().length, 0);
  const token = new URL(previousSnapshot.verificationUrl).pathname.split('/').at(-1)!;
  const verified = await verifyCredential(token); assert.equal(verified.status, 'issued'); assert.equal(verified.serial, pending.before.serial);
  const issued = (await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]))!;
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: pending.originalTemplateId, reason }), 'ONLY_PENDING_CREDENTIAL_REPAIRABLE');
  assert.deepEqual(await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]), issued);
});

test('repair rejects unauthorized staff, missing MFA, forged snapshot fields and short reasons without writes', async () => {
  const pending = await failed(); const replacement = await template({ font: true });
  await rejectsCode(repairPendingCredential(learner, pending.id, { templateId: replacement, reason }), 'FORBIDDEN');
  await rejectsCode(repairPendingCredential(editor, pending.id, { templateId: replacement, reason }), 'FORBIDDEN');
  await rejectsCode(repairPendingCredential({ ...actor, mfaVerifiedAt: null }, pending.id, { templateId: replacement, reason }), 'MFA_REQUIRED');
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: replacement, reason: 'short' }), 'VALIDATION_ERROR');
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: replacement, reason, serial: 'FORGED' }), 'VALIDATION_ERROR');
  assert.deepEqual(await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]), pending.before);
});

test('repair requires failed job, approved distinct template from the same program and unchanged issuer', async () => {
  const pending = await reservation(); const replacement = await template({ font: true });
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: replacement, reason }), 'FAILED_RENDER_REQUIRED');
  await processOutbox({ limit: 1, aggregateId: pending.id });
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: pending.originalTemplateId, reason }), 'DIFFERENT_TEMPLATE_REQUIRED');
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: await template({ font: true, approved: false }), reason }), 'APPROVED_DOCUMENT_TEMPLATE_REQUIRED');
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: await template({ font: true, programId: 'ptm' }), reason }), 'TEMPLATE_PROGRAM_MISMATCH');
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: await template({ font: true, issuerName: 'OTHER TEST ISSUER' }), reason }), 'TEMPLATE_ISSUER_MISMATCH');
  await execute('UPDATE outbox SET status=?,lease_token=?,lease_until=? WHERE type=? AND aggregate_id=?', ['processing', 'isolated-lease', new Date(Date.now() + 60000).toISOString(), 'credential.render', pending.id]);
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: replacement, reason }), 'CREDENTIAL_RENDER_IN_PROGRESS');
  assert.deepEqual(await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]), pending.before);
});

test('revoked pending credential cannot be repaired or silently returned to issuance', async () => {
  const pending = await failed(); await revokeCredential(actor.id, pending.id, reason);
  await rejectsCode(repairPendingCredential(actor, pending.id, { templateId: await template({ font: true }), reason }), 'ONLY_PENDING_CREDENTIAL_REPAIRABLE');
  assert.equal((await queryOne('SELECT status FROM credentials WHERE id=?', [pending.id]))!.status, 'revoked');
});

test('repair rolls back snapshot and durable job together if the mandatory audit cannot commit', async () => {
  const pending = await failed(); const replacement = await template({ font: true });
  const oldJob = (await queryOne('SELECT * FROM outbox WHERE type=? AND aggregate_id=?', ['credential.render', pending.id]))!;
  await execute("CREATE TRIGGER test_repair_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action='credential_template_rebound' BEGIN SELECT RAISE(ABORT,'ISOLATED AUDIT FAILURE'); END");
  try { await assert.rejects(repairPendingCredential(actor, pending.id, { templateId: replacement, reason }), /ISOLATED AUDIT FAILURE/); }
  finally { await execute('DROP TRIGGER test_repair_audit_failure'); }
  assert.deepEqual(await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]), pending.before);
  assert.deepEqual(await queryOne('SELECT * FROM outbox WHERE id=?', [oldJob.id]), oldJob);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM audit_events WHERE action=? AND target=?', ['credential_template_rebound', pending.id]))!.n, 0);
});

test('render that started without a lease cannot commit stale PDF after atomic template repair', { timeout: 15000 }, async () => {
  const pending = await reservation(true);
  const saveFailure = mock.method(PDFDocument.prototype, 'save', async () => { throw new Error('ISOLATED TRANSIENT RENDER FAILURE'); });
  try { assert.equal((await processOutbox({ limit: 1, aggregateId: pending.id })).results[0]?.code, 'DELIVERY_FAILED'); }
  finally { saveFailure.mock.restore(); }
  const replacement = await template({ font: true });
  let entered!: () => void; let release!: () => void;
  const reachedSave = new Promise<void>(resolve => { entered = resolve; }); const continueSave = new Promise<void>(resolve => { release = resolve; });
  const originalSave = PDFDocument.prototype.save;
  const paused = mock.method(PDFDocument.prototype, 'save', async function (this: PDFDocument, ...args: Parameters<typeof originalSave>) { entered(); await continueSave; return originalSave.apply(this, args); });
  const stale = renderCredential(pending.id);
  try {
    await reachedSave; paused.mock.restore();
    await repairPendingCredential(actor, pending.id, { templateId: replacement, reason });
    release(); await rejectsCode(stale, 'CREDENTIAL_RENDER_SNAPSHOT_CHANGED');
    const row = (await queryOne('SELECT * FROM credentials WHERE id=?', [pending.id]))!;
    assert.equal(row.status, 'pending'); assert.equal(row.document_base64, null); assert.equal(JSON.parse(row.snapshot_json).templateId, replacement);
    assert.equal((await processOutbox({ limit: 1, aggregateId: pending.id })).results[0]?.status, 'delivered');
  } finally { paused.mock.restore(); release(); }
});
