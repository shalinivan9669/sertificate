import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { closeDb, getDb, execute, queryOne } from '../server/db';
import { createVersion, reviewVersion, publishVersion, catalogProgram, type ProgramData } from '../server/services/catalog';
import { setProgramIntake } from '../server/services/program-intake';
import { createEnrollment, completeLesson, enrollmentDetails } from '../server/services/learning';
import { assignEmployees, createOrganization } from '../server/services/organizations';
import { createOrder } from '../server/services/commerce';
import { createInvoice, confirmInvoice } from '../server/services/invoices';
import type { AppUser } from '../server/utils/auth';

let directory: string;
const environmentKeys = ['OT_DATABASE_PATH', 'NODE_ENV', 'OT_APP_ENV', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_PAYMENT_TERMS_APPROVED', 'OT_INVOICE_ENABLED', 'OT_INVOICE_ISSUER_JSON'];
const previous = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
const admin: AppUser = { id: 'intake-admin', name: 'TEST ADMIN', email: 'intake-admin@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { ...admin, id: 'intake-reviewer', email: 'intake-reviewer@example.test', role: 'reviewer' };
const learner: AppUser = { ...admin, id: 'intake-learner', email: 'intake-learner@example.test', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const other: AppUser = { ...learner, id: 'intake-other', email: 'intake-other@example.test' };
const reason = 'ISOLATED TEST stop new intake without changing existing obligations';
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error?.data?.code === code);
const buyer = { name: 'TEST BUYER - DO NOT PAY', bin: '000000000000', address: 'ISOLATED TEST' };
function data(accessModel: 'free' | 'paid'): ProgramData { return { title: 'TEST ONLY INTAKE CONTROL', language: 'ru', audience: 'Test', prerequisites: '', outcomes: 'Test', limitations: 'NO VALIDITY', format: 'Test', durationHours: 1, priceMinor: accessModel === 'paid' ? 120000 : 0, currency: 'KZT', accessModel, documentDescription: 'No valid document', support: 'Test', sourceRefs: ['Isolated test fixture'], reviewedAt: new Date().toISOString().slice(0, 10), modules: [{ id: 'module', title: 'Test', lessons: [{ id: 'lesson', title: 'Test', kind: 'text', required: true, body: 'Synthetic content only', media: [] }] }], assessment: { durationMinutes: 10, maxAttempts: 2, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 }, questions: [{ id: 'q', text: 'Test?', topic: 'Test', options: [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }], correctOptionIds: ['yes'] }] }; }
async function version(accessModel: 'free' | 'paid' = 'free') { const draft = (await createVersion(admin, 'ohrana-truda', data(accessModel))).version; const review = (await reviewVersion(admin, draft.id, draft.revision)).version; return (await publishVersion(reviewer, review.id, review.revision, reason)).version; }
async function organization() {
  const result = await createOrganization(admin.id, { name: 'TEST ONLY intake ' + randomUUID() });
  for (const user of [learner, other]) await execute('INSERT INTO memberships(organization_id,user_id,role,status,created_at) VALUES(?,?,?,?,?)', [result.organization.id, user.id, 'member', 'active', new Date().toISOString()]);
  return result.organization;
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-intake-test-'));
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_APP_ENV: 'test', OT_PAYMENT_TERMS_APPROVED: '1', OT_INVOICE_ENABLED: '1', OT_INVOICE_ISSUER_JSON: JSON.stringify({ name: 'TEST ONLY ISSUER - DO NOT PAY', bin: '000000000000', address: 'ISOLATED TEST', bankName: 'TEST BANK', bic: 'TESTKZ00', iban: 'KZ000000000000000000', paymentPurpose: 'TEST ONLY - DO NOT PAY' }) });
  for (const key of ['VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) delete process.env[key];
  await getDb();
  for (const user of [admin, reviewer, learner, other]) await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,?,?,?)', [user.id, user.name, user.email, user.role, Number(user.twoFactorEnabled), Date.now(), Date.now()]);
});
after(async () => {
  await closeDb(); const target = resolve(directory);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ot-intake-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 5 });
  for (const key of environmentKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

test('intake stop requires current administrator MFA/reason and preserves immutable publication while remaining visible', async () => {
  const published = await version(); const before = await queryOne('SELECT * FROM program_versions WHERE id=?', [published.id]);
  await rejectsCode(setProgramIntake(learner, published.id, { open: false, reason }), 'FORBIDDEN');
  await rejectsCode(setProgramIntake(reviewer, published.id, { open: false, reason }), 'FORBIDDEN');
  await rejectsCode(setProgramIntake({ ...admin, mfaVerifiedAt: null }, published.id, { open: false, reason }), 'MFA_REQUIRED');
  await rejectsCode(setProgramIntake(admin, published.id, { open: false, reason: 'short' }), 'VALIDATION_ERROR');
  await setProgramIntake(admin, published.id, { open: false, reason });
  assert.deepEqual(await queryOne('SELECT * FROM program_versions WHERE id=?', [published.id]), before);
  const card = await catalogProgram('ohrana-truda');
  assert.equal(card.program.versions.find(item => item.id === published.id)?.intakeOpen, false);
  assert.equal(card.program.availability, 'published');
  assert.equal(JSON.stringify(card).includes(reason), false, 'private operation reason never enters public DTO');
  assert.equal((await setProgramIntake(admin, published.id, { open: false, reason })).duplicate, true);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM audit_events WHERE action=? AND target=?', ['program.intake_closed', published.id]))!.n, 1);
});

test('fresh stop rejects free/staff/org creation but exact replays and existing lesson completion continue', async () => {
  const published = await version(); const org = await organization();
  const selfKey = randomUUID(), orgKey = randomUUID();
  const selfBody = { userId: learner.id, versionId: published.id };
  const enrollment = (await createEnrollment(learner, selfBody, selfKey, true)).enrollment;
  const orgBody = { versionId: published.id, userIds: [other.id] };
  const assignment = await assignEmployees(admin.id, org.id, orgBody, orgKey);
  // Represents a client that already read a formerly open catalog page.
  await setProgramIntake(admin, published.id, { open: false, reason });
  await rejectsCode(createEnrollment(other, { userId: other.id, versionId: published.id }, randomUUID(), true), 'PROGRAM_INTAKE_CLOSED');
  await rejectsCode(createEnrollment(admin, { userId: other.id, versionId: published.id, reason, evidence: reason }, randomUUID()), 'PROGRAM_INTAKE_CLOSED');
  await rejectsCode(assignEmployees(admin.id, org.id, { versionId: published.id, userIds: [learner.id] }, randomUUID()), 'PROGRAM_INTAKE_CLOSED');
  assert.equal((await createEnrollment(learner, selfBody, selfKey, true)).enrollment.id, enrollment.id);
  assert.deepEqual(await assignEmployees(admin.id, org.id, orgBody, orgKey), assignment);
  await completeLesson(learner, enrollment.id, 'lesson', 0);
  assert.equal((await enrollmentDetails(learner, enrollment.id)).progress.completed, 1);
  await setProgramIntake(admin, published.id, { open: true, reason });
  assert.ok((await createEnrollment(other, { userId: other.id, versionId: published.id }, randomUUID(), true)).enrollment.id);
});

test('stopped intake blocks new orders and invoices while replay and previously issued invoice confirmation remain valid', async () => {
  const published = await version('paid'); const org = await organization();
  const orderKey = randomUUID(), invoiceKey = randomUUID();
  const order = await createOrder(other.id, { versionId: published.id }, orderKey);
  const invoiceBody = { versionId: published.id, userIds: [learner.id], buyer };
  const { invoice } = await createInvoice(admin, org.id, invoiceBody, invoiceKey);
  await setProgramIntake(admin, published.id, { open: false, reason });
  await rejectsCode(createOrder(learner.id, { versionId: published.id }, randomUUID()), 'PROGRAM_INTAKE_CLOSED');
  await rejectsCode(createInvoice(admin, org.id, { ...invoiceBody, userIds: [other.id] }, randomUUID()), 'PROGRAM_INTAKE_CLOSED');
  assert.equal((await createOrder(other.id, { versionId: published.id }, orderKey)).id, order.id);
  assert.equal((await createInvoice(admin, org.id, invoiceBody, invoiceKey)).invoice.id, invoice.id);
  await confirmInvoice(admin, invoice.id, { amountMinor: invoice.amountMinor, currency: 'KZT', reference: 'TEST-ONLY-' + randomUUID(), reason });
  assert.equal((await queryOne('SELECT status FROM enrollments WHERE organization_id=? AND user_id=? AND version_id=?', [org.id, learner.id, published.id]))!.status, 'active');
  assert.equal((await queryOne('SELECT status FROM program_versions WHERE id=?', [published.id]))!.status, 'published');
});
