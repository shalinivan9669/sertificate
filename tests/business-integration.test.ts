import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import nodemailer from 'nodemailer';
import { closeDb, enqueue, execute, getDb, queryOne, withTransaction } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { createEnrollment, completeLesson } from '../server/services/learning';
import { startAttempt, saveAnswer, submitAttempt } from '../server/services/assessment';
import { checkout, commerceOverview, createOrder, getOrder, paymentMode, processPaymentWebhook, refundOrder } from '../server/services/commerce';
import { acceptInvitation, assignEmployees, commitImport, createOrganization, invite, organizationOverview, organizationReport, parseImportCsv, previewImport, revokeMembership } from '../server/services/organizations';
import { approveCredentialTemplate, createCredentialTemplate, downloadCredential, getCredential, issueCredential, renderCredential, revokeCredential, verifyCredential } from '../server/services/credentials';
import { acceptLead, deliverLead } from '../server/services/leads';
import { operationsOverview, processOutbox, recordAnalytics, retryJob, secretEquals, updateConsent } from '../server/services/operations';
import type { AppUser } from '../server/utils/auth';

let directory: string;
const envKeys = ['OT_DATABASE_PATH', 'NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_PAYMENT_PROVIDER', 'OT_APP_ENV', 'OT_PAYMENT_TERMS_APPROVED', 'OT_PAYMENT_TERMS_VERSION', 'OT_SANDBOX_WEBHOOK_SECRET', 'OT_SANDBOX_MERCHANT', 'AMO_BASE_URL', 'AMO_ACCESS_TOKEN', 'NUXT_PUBLIC_SITE_URL', 'OT_CRM_DELIVERY_ENABLED', 'OT_EMAIL_DELIVERY_ENABLED', 'SMTP_URL', 'MAIL_FROM'];
const previousEnvironment = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const admin: AppUser = { id: 'business-admin', name: 'TEST ADMIN', email: 'admin@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const editor: AppUser = { ...admin, id: 'business-editor', email: 'editor@example.test', role: 'editor' };
const reviewer: AppUser = { ...admin, id: 'business-reviewer', email: 'reviewer@example.test', role: 'reviewer' };
const learner: AppUser = { ...admin, id: 'business-learner', name: 'TEST LEARNER', email: 'learner@example.test', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const outsider: AppUser = { ...learner, id: 'business-outsider', email: 'outsider@example.test' };
const manager: AppUser = { ...learner, id: 'business-manager', email: 'manager@example.test' };
const signature = (raw: string) => createHmac('sha256', process.env.OT_SANDBOX_WEBHOOK_SECRET!).update(raw).digest('hex');
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error?.data?.code === code);

/** Deliberately fictional fixtures live only in an isolated temporary database. */
function fixture(paid = false): ProgramData {
  return { title: 'ISOLATED BUSINESS TEST - NOT TRAINING CONTENT', language: 'ru', audience: 'Test users only', prerequisites: '', outcomes: 'Test integrity', limitations: 'Not a training program', format: 'Test', durationHours: 1,
    priceMinor: paid ? 125000 : 0, currency: 'KZT', accessModel: paid ? 'paid' : 'free', documentDescription: 'TEST PDF - NO VALIDITY', support: 'Test only', sourceRefs: ['Isolated integration fixture'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'test-module', title: 'TEST MODULE', lessons: [{ id: 'test-lesson', title: 'TEST LESSON', kind: 'text', required: true, body: 'Fictional test fixture.', media: [] }] }],
    assessment: { durationMinutes: 1, maxAttempts: 2, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'test-question', text: 'Fictional test only?', topic: 'Test', options: [{ id: 'wrong', text: 'Not this one' }, { id: 'right', text: 'Test answer' }], correctOptionIds: ['right'] }] };
}
async function publication(data = fixture()) {
  const draft = (await createVersion(editor, 'ohrana-truda', data)).version;
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  return (await publishVersion(reviewer, review.id, review.revision, 'ISOLATED TEST review, no production content')).version;
}
async function completed(data = fixture()) {
  const version = await publication(data);
  const { enrollment } = await createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true);
  await completeLesson(learner, enrollment.id, 'test-lesson', 0);
  let attempt = await startAttempt(learner, enrollment.id, randomUUID());
  attempt = await saveAnswer(learner, attempt.id, 'test-question', ['right'], attempt.revision);
  await submitAttempt(learner, attempt.id);
  return { version, enrollment };
}
async function paidOrder() {
  const version = await publication(fixture(true));
  const order = await createOrder(learner.id, { versionId: version.id }, randomUUID());
  const payment = await checkout(order.id, learner.id);
  const event = { eventId: randomUUID(), paymentId: payment.paymentId, merchant: process.env.OT_SANDBOX_MERCHANT!, amountMinor: order.amountMinor, currency: 'KZT', status: 'succeeded', timestamp: Date.now() };
  return { version, order, payment, event };
}
async function approvedTestTemplate(activeAction = false) {
  const document = await PDFDocument.create();
  const page = document.addPage([620, 800]);
  page.drawText('ISOLATED TEST PDF - NO VALIDITY', { x: 30, y: 760, size: 14, font: await document.embedFont(StandardFonts.Helvetica) });
  const fieldMap = Object.fromEntries(['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'].map((key, index) => {
    document.getForm().createTextField(key).addToPage(page, { x: 30, y: 700 - index * 65, width: 560, height: 45 }); return [key, key];
  }));
  if (activeAction) page.node.set(PDFName.of('AA'), document.context.obj({ O: { S: PDFName.of('JavaScript'), JS: PDFString.of('void(0)') } }));
  const created = await createCredentialTemplate(admin.id, { programId: 'ohrana-truda', name: 'ISOLATED TEST FORM', issuerName: 'TEST ISSUER - NO VALIDITY', pdfBase64: Buffer.from(await document.save({ useObjectStreams: true })).toString('base64'), fieldMap });
  if (!activeAction) await approveCredentialTemplate(reviewer.id, created.template.id, 'Independent isolated TEST form review');
  return created.template;
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-business-test-'));
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_APP_ENV: 'test', OT_PAYMENT_PROVIDER: 'sandbox', OT_PAYMENT_TERMS_APPROVED: '1', OT_PAYMENT_TERMS_VERSION: 'isolated-test-v1', OT_SANDBOX_WEBHOOK_SECRET: 'isolated-test-secret-not-production-1234567890', OT_SANDBOX_MERCHANT: 'isolated-test-merchant', AMO_BASE_URL: 'https://crm.example.test', AMO_ACCESS_TOKEN: 'isolated-test-token', NUXT_PUBLIC_SITE_URL: 'https://example.test' });
  delete process.env.VERCEL; delete process.env.VERCEL_ENV; delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN;
  process.env.OT_CRM_DELIVERY_ENABLED = '0'; process.env.OT_EMAIL_DELIVERY_ENABLED = '0';
  await getDb();
  for (const actor of [admin, editor, reviewer, learner, outsider, manager]) await execute('INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES (?,?,?,1,?,?,?,?)', [actor.id, actor.name, actor.email, Date.now(), Date.now(), actor.role, Number(actor.twoFactorEnabled)]);
});
after(async () => {
  await closeDb();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-business-test-'), 'delete only the isolated test directory');
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (previousEnvironment[key] === undefined) delete process.env[key]; else process.env[key] = previousEnvironment[key]; }
});

test('orders use approved server price, bind idempotency to owner/payload and reject forged fields', async () => {
  const version = await publication(fixture(true)); const key = randomUUID();
  await rejectsCode(createOrder(learner.id, { versionId: version.id, amountMinor: 1, status: 'succeeded' }, key), 'VALIDATION_ERROR');
  const [first, second] = await Promise.all([createOrder(learner.id, { versionId: version.id }, key), createOrder(learner.id, { versionId: version.id }, key)]);
  assert.equal(first.id, second.id); assert.equal(first.amountMinor, 125000); assert.equal(first.currency, 'KZT'); assert.equal(first.snapshot.paymentTermsVersion, 'isolated-test-v1');
  const otherVersion = await publication(fixture(true));
  await rejectsCode(createOrder(learner.id, { versionId: otherVersion.id }, key), 'IDEMPOTENCY_CONFLICT');
  await rejectsCode(getOrder(first.id, outsider.id), 'ORDER_NOT_FOUND');
  assert.equal((await commerceOverview(outsider.id)).orders.length, 0);
  // Regression: parallel overview reads must release their native statements before the next commit.
  await withTransaction(async tx => { await execute('SELECT 1', [], tx); });
});

test('checkout cannot confirm payment and repeated checkout creates one provider transaction', async () => {
  const { order, payment } = await paidOrder(); const repeated = await checkout(order.id, learner.id);
  assert.equal(repeated.paymentId, payment.paymentId); assert.equal(repeated.checkoutUrl, null); assert.equal(repeated.mode, 'sandbox');
  assert.equal((await getOrder(order.id, learner.id)).status, 'pending');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM payments WHERE order_id=?', [order.id]))!.n, 1);
  await rejectsCode(checkout(order.id, outsider.id), 'ORDER_NOT_FOUND');
});

test('webhooks verify raw signatures, freshness, merchant/amount and event identity before state mutation', async () => {
  const { order, event } = await paidOrder(); const raw = JSON.stringify(event);
  await rejectsCode(processPaymentWebhook(raw, '0'.repeat(64)), 'INVALID_SIGNATURE');
  for (const altered of [{ ...event, amountMinor: 1 }, { ...event, merchant: 'other-merchant' }]) {
    const payload = JSON.stringify(altered); await rejectsCode(processPaymentWebhook(payload, signature(payload)), 'PAYMENT_MISMATCH');
  }
  const expired = JSON.stringify({ ...event, timestamp: Date.now() - 301000 }); await rejectsCode(processPaymentWebhook(expired, signature(expired)), 'WEBHOOK_EXPIRED');
  assert.equal((await getOrder(order.id, learner.id)).status, 'pending');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM payment_events WHERE id=?', [event.eventId]))!.n, 0);
  await processPaymentWebhook(raw, signature(raw));
  const conflict = JSON.stringify({ ...event, status: 'failed' }); await rejectsCode(processPaymentWebhook(conflict, signature(conflict)), 'EVENT_CONFLICT');
});

test('concurrent duplicate payment creates one enrollment; late events and refund preserve academic history', async () => {
  const { order, event } = await paidOrder(); const raw = JSON.stringify(event);
  const results = await Promise.all([processPaymentWebhook(raw, signature(raw)), processPaymentWebhook(raw, signature(raw))]);
  assert.equal(results.filter((result: any) => result.duplicate).length, 1);
  // One hundred deliveries of the identical signed payload, including the first concurrent pair.
  for (let delivery = 2; delivery < 100; delivery++) assert.equal((await processPaymentWebhook(raw, signature(raw))).duplicate, true);
  const paid = await getOrder(order.id, learner.id); assert.equal(paid.status, 'succeeded'); assert.ok(paid.enrollmentId);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE user_id=? AND version_id=?', [learner.id, paid.versionId]))!.n, 1);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM outbox WHERE type=? AND aggregate_id=?', ['notification.enrollment', paid.enrollmentId]))!.n, 1);
  for (const status of ['pending', 'failed']) {
    const late = JSON.stringify({ ...event, eventId: randomUUID(), status }); await processPaymentWebhook(late, signature(late));
  }
  assert.equal((await getOrder(order.id, learner.id)).status, 'succeeded');
  const first = await refundOrder(order.id, admin.id, 'ISOLATED TEST requested refund'); const second = await refundOrder(order.id, admin.id, 'ISOLATED TEST requested refund'); assert.equal(first.id, second.id);
  assert.equal((await getOrder(order.id, learner.id)).status, 'refunded');
  assert.ok(await queryOne('SELECT id FROM enrollments WHERE id=?', [paid.enrollmentId]));
  assert.equal((await queryOne('SELECT COUNT(*) n FROM refunds WHERE order_id=?', [order.id]))!.n, 1);
});

test('sandbox is blocked in production even when an application environment flag is absent', () => {
  const beforeNode = process.env.NODE_ENV; const beforeApp = process.env.OT_APP_ENV;
  try {
    process.env.NODE_ENV = 'production'; delete process.env.OT_APP_ENV;
    assert.throws(() => paymentMode(), (error: any) => error?.data?.code === 'SANDBOX_FORBIDDEN_IN_PRODUCTION');
    process.env.NODE_ENV = 'test'; process.env.OT_APP_ENV = 'test'; process.env.VERCEL_ENV = 'production';
    assert.throws(() => paymentMode(), (error: any) => error?.data?.code === 'SANDBOX_FORBIDDEN_IN_PRODUCTION');
  }
  finally { process.env.NODE_ENV = beforeNode; process.env.OT_APP_ENV = beforeApp; delete process.env.VERCEL_ENV; }
});

test('organization invitations bind verified email, cannot escalate manager role, and are single-use', async () => {
  const { organization } = await createOrganization(admin.id, { name: 'ISOLATED TEST ORG' });
  const invitation = await invite(admin.id, organization.id, { email: manager.email, role: 'manager' });
  await rejectsCode(acceptInvitation(outsider, invitation.token!), 'INVITATION_NOT_FOUND');
  await acceptInvitation(manager, invitation.token!); await rejectsCode(acceptInvitation(manager, invitation.token!), 'INVITATION_NOT_FOUND');
  await rejectsCode(invite(manager.id, organization.id, { email: learner.email, role: 'manager' }), 'OWNER_REQUIRED');
  await rejectsCode(organizationOverview(outsider.id, organization.id), 'ORGANIZATION_NOT_FOUND');
  await revokeMembership(admin.id, organization.id, manager.id, 'ISOLATED TEST membership revoked');
  await rejectsCode(organizationOverview(manager.id, organization.id), 'ORGANIZATION_NOT_FOUND');
  await rejectsCode(revokeMembership(admin.id, organization.id, admin.id, 'ISOLATED TEST self removal'), 'SELF_REMOVAL_NOT_ALLOWED');
});

test('reinviting a revoked manager as a member never restores the revoked manager role', async () => {
  const { organization } = await createOrganization(admin.id, { name: 'ISOLATED ROLE REGRESSION' });
  const original = await invite(admin.id, organization.id, { email: manager.email, role: 'manager' });
  await acceptInvitation(manager, original.token!);
  await revokeMembership(admin.id, organization.id, manager.id, 'ISOLATED TEST revoke manager authority');
  const replacement = await invite(admin.id, organization.id, { email: manager.email, role: 'member' });
  await execute('UPDATE "user" SET emailVerified=0 WHERE id=?', [manager.id]);
  try { await rejectsCode(acceptInvitation(manager, replacement.token!), 'VERIFIED_CONTACT_REQUIRED'); }
  finally { await execute('UPDATE "user" SET emailVerified=1 WHERE id=?', [manager.id]); }
  await acceptInvitation(manager, replacement.token!);
  assert.equal((await queryOne('SELECT role FROM memberships WHERE organization_id=? AND user_id=?', [organization.id, manager.id]))!.role, 'member');
  await rejectsCode(organizationOverview(manager.id, organization.id), 'ORGANIZATION_NOT_FOUND');
});

test('expired invitations fail and import preview never sends or commits before review', async () => {
  const { organization } = await createOrganization(admin.id, { name: 'ISOLATED IMPORT ORG' });
  const invited = await invite(admin.id, organization.id, { email: outsider.email });
  await execute('UPDATE invitations SET expires_at=? WHERE id=?', ['2000-01-01T00:00:00.000Z', invited.id]);
  await rejectsCode(acceptInvitation(outsider, invited.token!), 'INVITATION_NOT_FOUND');
  const preview = await previewImport(admin.id, organization.id, 'email,name,role\nlearner@example.test,Test Learner,member\nmanager@example.test,Test Manager,member');
  assert.equal(preview.valid, true); assert.equal((await queryOne('SELECT COUNT(*) n FROM invitations WHERE organization_id=?', [organization.id]))!.n, 1);
  const committed = await commitImport(admin.id, organization.id, preview.previewId); assert.equal(committed.invitations.length, 2);
  assert.equal((await commitImport(admin.id, organization.id, preview.previewId)).duplicate, true);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM outbox WHERE type=?', ['notification.invitation']))!.n, 0);
  const another = (await createOrganization(outsider.id, { name: 'OTHER ISOLATED ORG' })).organization;
  await rejectsCode(commitImport(outsider.id, another.id, preview.previewId), 'PREVIEW_NOT_FOUND');
});

test('CSV rejects formulas, duplicate emails, excess rows and malformed quoting', async () => {
  const rows = parseImportCsv('email,name,role\nUser@example.test,"=HYPERLINK(""https://example.test"")",member\nuser@example.test,Again,member');
  assert.ok(rows[0]); assert.ok(rows[1]);
  assert.ok(rows[0].errors.includes('FORMULA_NOT_ALLOWED')); assert.ok(rows[1].errors.includes('DUPLICATE_EMAIL'));
  assert.throws(() => parseImportCsv('email,name\na@example.test,"unclosed'), (error: any) => error.data.code === 'CSV_UNCLOSED_QUOTE');
  assert.throws(() => parseImportCsv('email\n' + Array.from({ length: 501 }, (_, index) => `u${index}@example.test`).join('\n')), (error: any) => error.data.code === 'IMPORT_MAX_500_ROWS');
  const { organization } = await createOrganization(admin.id, { name: 'INVALID IMPORT TEST' });
  const preview = await previewImport(admin.id, organization.id, 'email,name\nbad-email,Example');
  assert.equal(preview.valid, false); await rejectsCode(commitImport(admin.id, organization.id, preview.previewId), 'PREVIEW_HAS_ERRORS');
});

test('bulk assignment is atomic, tenant-scoped, deduplicated and remains pending contractual access', async () => {
  const version = await publication(); const { organization } = await createOrganization(admin.id, { name: 'ISOLATED ASSIGNMENTS' });
  const invitation = await invite(admin.id, organization.id, { email: learner.email }); await acceptInvitation(learner, invitation.token!);
  await rejectsCode(assignEmployees(admin.id, organization.id, { versionId: version.id, userIds: [learner.id, outsider.id] }, randomUUID()), 'ORGANIZATION_NOT_FOUND');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE organization_id=?', [organization.id]))!.n, 0);
  const key = randomUUID(); const result = await assignEmployees(admin.id, organization.id, { versionId: version.id, userIds: [learner.id, learner.id] }, key);
  assert.equal(result.enrollmentIds.length, 1); assert.equal(result.status, 'pending_access');
  assert.deepEqual(await assignEmployees(admin.id, organization.id, { versionId: version.id, userIds: [learner.id] }, key), result);
  await execute('UPDATE "user" SET name=? WHERE id=?', ['=1+1', learner.id]);
  try { assert.match(await organizationReport(admin.id, organization.id), /"'=1\+1"/); }
  finally { await execute('UPDATE "user" SET name=? WHERE id=?', [learner.name, learner.id]); }
  await rejectsCode(organizationReport(outsider.id, organization.id), 'ORGANIZATION_NOT_FOUND');
});

test('lead acceptance is durable during CRM outage and organizationName is not the legacy honeypot', async () => {
  const key = randomUUID(); const payload = { name: 'TEST LEAD', email: 'lead@example.test', organizationName: 'TEST COMPANY', locale: 'kk', marketingConsent: true, sourcePath: '/kk/contacts?private=query' };
  const [first, second] = await Promise.all([acceptLead(payload, key), acceptLead(payload, key)]);
  assert.ok('submissionId' in first); assert.ok('submissionId' in second); assert.equal(first.submissionId, second.submissionId);
  const row = await queryOne('SELECT payload_json,status FROM lead_submissions WHERE id=?', [first.submissionId!]); assert.equal(row!.status, 'accepted'); assert.equal(JSON.parse(row!.payload_json).organizationName, 'TEST COMPANY'); assert.equal(JSON.parse(row!.payload_json).sourcePath, '/kk/contacts');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM consent_records WHERE lead_id=?', [first.submissionId!]))!.n, 2);
  await rejectsCode(acceptLead({ ...payload, name: 'Different' }, key), 'IDEMPOTENCY_CONFLICT');
  const outcome = await processOutbox({ aggregateId: first.submissionId, allowExternal: false }); assert.ok(outcome.results[0]); assert.equal(outcome.results[0].code, 'EXTERNAL_DELIVERY_DISABLED');
  assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [first.submissionId!]))!.status, 'accepted');
});

test('CRM note failure persists external ID and retry never duplicates a lead', async () => {
  const lead = await acceptLead({ name: 'TEST CRM', email: 'crm@example.test', organizationName: 'TEST COMPANY' }, randomUUID());
  assert.ok('submissionId' in lead);
  let creates = 0; let notePosts = 0; const calls: string[] = [];
  const transport = async (url: string, options: any) => {
    calls.push(`${options.method} ${new URL(url).pathname}`);
    if (url.includes('/notes')) {
      if (options.method === 'GET') return Response.json({ _embedded: { notes: [] } });
      notePosts++; return notePosts === 1 ? new Response('', { status: 503 }) : Response.json({ _embedded: { notes: [{ id: 202 }] } });
    }
    if (options.method === 'GET') return Response.json({ _embedded: { leads: [] } });
    creates++; return Response.json([{ id: 101 }]);
  };
  await rejectsCode(deliverLead(lead.submissionId!, transport), 'CRM_NOTE_FAILED');
  const pending = await queryOne('SELECT crm_lead_id,status FROM lead_submissions WHERE id=?', [lead.submissionId!]); assert.equal(pending!.crm_lead_id, 101); assert.equal(pending!.status, 'note_pending');
  await deliverLead(lead.submissionId!, transport); const count = calls.length; await deliverLead(lead.submissionId!, transport);
  assert.equal(calls.length, count); assert.equal(creates, 1); assert.equal(notePosts, 2);
  assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [lead.submissionId!]))!.status, 'delivered');
});

test('external delivery flags block CRM fetch and SMTP even when the worker is explicitly allowed to process external jobs', async (context) => {
  const lead = await acceptLead({ email: 'guard@example.test' }, randomUUID()); assert.ok('submissionId' in lead);
  const mailAggregate = randomUUID();
  await enqueue('auth.email', mailAggregate, { to: 'mail-guard@example.test', subject: 'ISOLATED TEST', text: 'DO NOT SEND - ISOLATED TEST' });
  const beforeSmtp = process.env.SMTP_URL; const beforeFrom = process.env.MAIL_FROM;
  process.env.SMTP_URL = 'smtp://smtp.example.test:2525'; process.env.MAIL_FROM = 'test@example.test';
  const fetchSpy = context.mock.method(globalThis, 'fetch', async () => { throw new Error('External fetch must not run'); });
  const smtpSpy = context.mock.method(nodemailer, 'createTransport', () => { throw new Error('SMTP transport must not be created'); });
  try {
    const crm = await processOutbox({ aggregateId: lead.submissionId, allowExternal: true });
    const email = await processOutbox({ aggregateId: mailAggregate, allowExternal: true });
    assert.ok(crm.results[0]); assert.equal(crm.results[0].code, 'EXTERNAL_DELIVERY_DISABLED');
    assert.ok(email.results[0]); assert.equal(email.results[0].code, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    assert.equal(fetchSpy.mock.callCount(), 0); assert.equal(smtpSpy.mock.callCount(), 0);
    assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [lead.submissionId]))!.status, 'accepted');
  } finally {
    if (beforeSmtp === undefined) delete process.env.SMTP_URL; else process.env.SMTP_URL = beforeSmtp;
    if (beforeFrom === undefined) delete process.env.MAIL_FROM; else process.env.MAIL_FROM = beforeFrom;
  }
});

test('CRM recovers a lost create response using the stable correlation marker', async () => {
  const lead = await acceptLead({ email: 'ambiguous@example.test' }, randomUUID()); let created = false; let creates = 0;
  assert.ok('submissionId' in lead);
  const transport = async (url: string, options: any) => {
    if (url.includes('/notes')) return options.method === 'GET' ? Response.json({ _embedded: { notes: [] } }) : Response.json({ _embedded: { notes: [{ id: 404 }] } });
    if (options.method === 'GET') return Response.json({ _embedded: { leads: created ? [{ id: 303, name: `OT-${lead.submissionId}` }] : [] } });
    creates++; created = true; throw new Error('ISOLATED lost provider response');
  };
  await assert.rejects(deliverLead(lead.submissionId!, transport), /lost provider response/);
  await deliverLead(lead.submissionId!, transport); assert.equal(creates, 1);
});

test('payment alone and incomplete learning cannot reserve a credential', async () => {
  const { order, event } = await paidOrder(); const raw = JSON.stringify(event); await processPaymentWebhook(raw, signature(raw));
  const enrollmentId = (await getOrder(order.id, learner.id)).enrollmentId;
  await rejectsCode(issueCredential(admin.id, enrollmentId, 'ISOLATED TEST attempted early issue'), 'REQUIRED_LEARNING_INCOMPLETE');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM credentials WHERE enrollment_id=?', [enrollmentId]))!.n, 0);
});

test('PDF template validation rejects active actions hidden in compressed page dictionaries', async () => {
  await assert.rejects(approvedTestTemplate(true), (error: any) => ['ACTIVE_PDF_NOT_ALLOWED', 'UNSAFE_TEMPLATE'].includes(error?.data?.code));
});

test('credential reservation is idempotent, rendered PDF stays owner-only and revocation is public/minimal', async () => {
  await approvedTestTemplate(); const { enrollment } = await completed();
  const [first, duplicate] = await Promise.all([issueCredential(admin.id, enrollment.id, 'ISOLATED TEST issue evidence'), issueCredential(admin.id, enrollment.id, 'ISOLATED TEST issue evidence')]);
  assert.equal(first.credential.id, duplicate.credential.id); assert.equal(first.credential.status, 'pending');
  await rejectsCode(downloadCredential(first.credential.id, learner.id), 'DOCUMENT_NOT_AVAILABLE');
  const before = await getCredential(first.credential.id, learner.id); const token = before.verificationUrl.split('/').pop()!;
  await rejectsCode(verifyCredential(token), 'CREDENTIAL_NOT_FOUND');
  await renderCredential(first.credential.id); const download = await downloadCredential(first.credential.id, learner.id);
  assert.equal(download.bytes.subarray(0, 5).toString(), '%PDF-'); assert.equal((await PDFDocument.load(download.bytes)).getForm().getFields().length, 0);
  await rejectsCode(downloadCredential(first.credential.id, outsider.id), 'CREDENTIAL_NOT_FOUND');
  const verified = await verifyCredential(token); assert.equal(verified.status, 'issued'); assert.ok(!JSON.stringify(verified).includes(learner.email)); assert.ok(!('learnerName' in verified));
  await revokeCredential(admin.id, first.credential.id, 'ISOLATED TEST document revoked');
  assert.equal((await verifyCredential(token)).status, 'revoked'); await rejectsCode(downloadCredential(first.credential.id, learner.id), 'DOCUMENT_NOT_AVAILABLE');
  const replacement = await issueCredential(admin.id, enrollment.id, 'ISOLATED TEST approved replacement', first.credential.id); await renderCredential(replacement.credential.id);
  assert.notEqual(replacement.credential.serial, first.credential.serial); assert.equal((await verifyCredential(token)).status, 'superseded');
});

test('Unicode render failure keeps document pending; revocation before retry prevents later issuance', async () => {
  await approvedTestTemplate(); const data = fixture(); data.title = 'ИЗОЛИРОВАННЫЙ ТЕСТ - НЕ УЧЕБНАЯ ПРОГРАММА'; const { enrollment } = await completed(data);
  const { credential } = await issueCredential(admin.id, enrollment.id, 'ISOLATED TEST unicode issue');
  await rejectsCode(renderCredential(credential.id), 'UNICODE_TEMPLATE_FONT_REQUIRED');
  assert.equal((await getCredential(credential.id, learner.id)).status, 'pending');
  await revokeCredential(admin.id, credential.id, 'ISOLATED TEST cancelled before render'); await renderCredential(credential.id);
  assert.equal((await getCredential(credential.id, learner.id)).status, 'revoked');
});

test('outbox leases prevent simultaneous handlers, retries retain failure state, and delivered jobs cannot replay', async () => {
  const aggregate = randomUUID(); const job = await enqueue('notification.test', aggregate, { userId: learner.id });
  const results = await Promise.all([processOutbox({ aggregateId: aggregate, allowExternal: false }), processOutbox({ aggregateId: aggregate, allowExternal: false })]);
  assert.equal(results.reduce((count, result) => count + result.processed, 0), 1);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM notifications WHERE dedupe_key=?', [`notification.test:${aggregate}`]))!.n, 1);
  await rejectsCode(retryJob(admin.id, job, 'ISOLATED TEST forbidden replay'), 'JOB_NOT_RETRYABLE');
  const unknown = randomUUID(); const failedJob = await enqueue('unimplemented.test', unknown, {});
  const outcome = await processOutbox({ aggregateId: unknown }); assert.ok(outcome.results[0]); assert.equal(outcome.results[0].code, 'JOB_HANDLER_NOT_CONFIGURED');
  assert.equal((await queryOne('SELECT status FROM outbox WHERE id=?', [failedJob]))!.status, 'pending');
});

test('analytics cannot accept browser purchase/grade truth or PII; consent withdrawal cancels queued marketing', async () => {
  const event = { id: randomUUID(), name: 'program_view', dimensions: { programId: 'ohrana-truda', locale: 'kk' } };
  await recordAnalytics(event); await recordAnalytics(event); assert.equal((await queryOne('SELECT COUNT(*) n FROM analytics_events WHERE id=?', [event.id]))!.n, 1);
  await rejectsCode(recordAnalytics({ ...event, name: 'purchase' }), 'VALIDATION_ERROR');
  await rejectsCode(recordAnalytics({ ...event, dimensions: { email: learner.email } }), 'VALIDATION_ERROR');
  await updateConsent(learner.id, { marketing: true, version: 'isolated-test-v1' });
  await execute('INSERT INTO notifications(id,user_id,purpose,template,payload_json,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?)', [randomUUID(), learner.id, 'marketing', 'test', '{}', randomUUID(), new Date().toISOString()]);
  await updateConsent(learner.id, { marketing: false, version: 'isolated-test-v1' });
  assert.equal((await queryOne('SELECT COUNT(*) n FROM consent_records WHERE user_id=? AND purpose=? AND withdrawn_at IS NULL', [learner.id, 'marketing']))!.n, 0);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND purpose=? AND status=?', [learner.id, 'marketing', 'queued']))!.n, 0);
});

test('operations overview enforces staff MFA and exposes only the arrays authorized for each staff role', async () => {
  await paidOrder(); await acceptLead({ email: 'acl-test@example.test' }, randomUUID());
  await approvedTestTemplate(); const { enrollment } = await completed();
  await issueCredential(admin.id, enrollment.id, 'ISOLATED TEST ACL issuance');
  await rejectsCode(operationsOverview(learner), 'FORBIDDEN');
  await rejectsCode(operationsOverview({ ...admin, mfaVerifiedAt: null }), 'MFA_REQUIRED');
  const finance = await operationsOverview({ ...admin, role: 'finance' });
  assert.ok(finance.orders.length > 0); assert.equal(finance.metrics, null);
  for (const key of ['leads', 'outbox', 'credentials', 'templates', 'auditEvents', 'enrollments'] as const) assert.deepEqual(finance[key], []);
  const instructor = await operationsOverview({ ...admin, role: 'instructor' });
  assert.ok(instructor.enrollments.length > 0); assert.deepEqual(instructor.orders, []); assert.deepEqual(instructor.leads, []);
  const issuer = await operationsOverview({ ...admin, role: 'issuer' });
  assert.ok(issuer.credentials.length > 0); assert.ok(issuer.templates.length > 0); assert.deepEqual(issuer.orders, []);
  const reviewed = await operationsOverview(reviewer); assert.ok(reviewed.templates.length > 0); assert.deepEqual(reviewed.credentials, []);
  const edited = await operationsOverview(editor);
  for (const key of ['leads', 'outbox', 'orders', 'credentials', 'templates', 'auditEvents', 'enrollments'] as const) assert.deepEqual(edited[key], []);
  const all = await operationsOverview(admin); assert.ok(all.metrics);
  for (const key of ['leads', 'outbox', 'orders', 'credentials', 'templates', 'auditEvents', 'enrollments'] as const) assert.ok(all[key].length > 0, key);
});

test('cron secret comparison rejects Unicode without throwing or treating absent secrets as configured', () => {
  assert.equal(secretEquals('', undefined), false); assert.equal(secretEquals('a'.repeat(32), 'a'.repeat(32)), true);
  assert.equal(secretEquals('é'.repeat(32), 'a'.repeat(32)), false);
});

test('CRM calls share one total deadline and retain the durable lead when delivery times out', async () => {
  const lead = await acceptLead({ email: 'deadline-only@example.test' }, randomUUID());
  assert.ok('submissionId' in lead);
  let calls = 0;
  const transport = async (_url: string, options: { signal?: AbortSignal }) => {
    calls++;
    await new Promise<void>((resolve, reject) => {
      const signal = options.signal!;
      if (signal.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 60);
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      signal.addEventListener('abort', abort, { once: true });
    });
    return Response.json({ _embedded: { leads: [] } });
  };
  await assert.rejects(deliverLead(lead.submissionId!, transport, undefined, 100), (error: any) => error.name === 'TimeoutError');
  assert.equal(calls, 2, 'The second call must be aborted by the shared deadline');
  const stored = await queryOne('SELECT status,crm_lead_id FROM lead_submissions WHERE id=?', [lead.submissionId!]);
  assert.equal(stored!.status, 'accepted');
  assert.equal(stored!.crm_lead_id, null);
});
