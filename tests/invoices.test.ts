import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryAll, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { completeLesson, enrollmentDetails } from '../server/services/learning';
import { saveAnswer, startAttempt, submitAttempt } from '../server/services/assessment';
import { issueCredential } from '../server/services/credentials';
import { createOrganization } from '../server/services/organizations';
import { cancelInvoice, confirmInvoice, createInvoice, getInvoice, invoiceConfiguration, listFinanceInvoices, listInvoices, renderInvoice } from '../server/services/invoices';
import type { AppUser } from '../server/utils/auth';
import { expireAnalytics } from '../server/services/analytics';

let directory: string;
const envKeys = ['OT_DATABASE_PATH', 'NODE_ENV', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_INVOICE_ENABLED', 'OT_INVOICE_ISSUER_JSON'];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const admin: AppUser = { id: 'invoice-admin', name: 'ISOLATED ADMIN', email: 'invoice-admin@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const editor: AppUser = { ...admin, id: 'invoice-editor', email: 'invoice-editor@example.test', role: 'editor' };
const reviewer: AppUser = { ...admin, id: 'invoice-reviewer', email: 'invoice-reviewer@example.test', role: 'reviewer' };
const finance: AppUser = { ...admin, id: 'invoice-finance', email: 'invoice-finance@example.test', role: 'finance' };
const manager: AppUser = { ...admin, id: 'invoice-manager', email: 'invoice-manager@example.test', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const learner: AppUser = { ...manager, id: 'invoice-learner', email: 'invoice-learner@example.test' };
const outsider: AppUser = { ...manager, id: 'invoice-outsider', email: 'invoice-outsider@example.test' };
// Explicit synthetic bank-shaped fixture only in temporary DB; never a production default or payment instruction.
const issuer = { name: 'ISOLATED TEST ISSUER - DO NOT PAY', bin: '000000000000', address: 'ISOLATED TEST ADDRESS', bankName: 'ISOLATED TEST BANK', bic: 'TESTKZ00', iban: 'KZ000000000000000000', paymentPurpose: 'ISOLATED TEST ONLY - DO NOT PAY' };
const buyer = { name: 'ISOLATED TEST BUYER <script>alert(1)</script>', bin: '111111111111', address: 'ISOLATED TEST ADDRESS' };
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error?.data?.code === code);
const confirmation = (amountMinor: number, reference: string = randomUUID()) => ({ amountMinor, currency: 'KZT', reference, reason: 'ISOLATED TEST manual evidence, no real transfer' });
function fixture(): ProgramData { return { title: 'ISOLATED INVOICE TEST - NOT TRAINING', language: 'ru', audience: 'Test', prerequisites: '', outcomes: 'Test', limitations: 'Not training', format: 'Test', durationHours: 1, priceMinor: 125000, currency: 'KZT', accessModel: 'paid', documentDescription: 'No document', support: 'Test', sourceRefs: ['Isolated fixture'], reviewedAt: new Date().toISOString().slice(0, 10), modules: [{ id: 'm1', title: 'Test', lessons: [{ id: 'l1', title: 'Test', kind: 'text', required: true, body: 'Isolated test lesson', media: [] }] }], assessment: { durationMinutes: 10, maxAttempts: 2, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 }, questions: [{ id: 'q1', text: 'Test?', topic: 'Test', options: [{ id: 'a', text: 'Wrong' }, { id: 'b', text: 'Correct' }], correctOptionIds: ['b'] }] }; }
async function publication(data = fixture()) { const draft = (await createVersion(editor, 'ohrana-truda', data)).version; const review = (await reviewVersion(editor, draft.id, draft.revision)).version; return (await publishVersion(reviewer, review.id, review.revision, 'Isolated independent review')).version; }
async function setup(userIds = [learner.id], data = fixture()) {
  const organization = (await createOrganization(manager.id, { name: 'ISOLATED TEST ORG' })).organization;
  for (const userId of userIds) if (userId !== manager.id) await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [organization.id, userId, 'member', new Date().toISOString()]);
  const version = await publication(data); return { organization, version, body: { versionId: version.id, userIds, buyer } };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-invoices-test-'));
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_INVOICE_ENABLED: '1', OT_INVOICE_ISSUER_JSON: JSON.stringify(issuer) });
  delete process.env.VERCEL; delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN;
  await getDb();
  for (const user of [admin, editor, reviewer, finance, manager, learner, outsider]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,?)', [user.id, user.name, user.email, Date.now(), Date.now(), user.role, Number(user.twoFactorEnabled)]);
});
after(async () => {
  await closeDb(); const target = resolve(directory); assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ot-invoices-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});

test('invoices fail closed without explicitly enabled complete issuer configuration', async () => {
  const setupData = await setup(); delete process.env.OT_INVOICE_ENABLED; assert.equal(invoiceConfiguration().enabled, false);
  await rejectsCode(createInvoice(manager, setupData.organization.id, setupData.body, randomUUID()), 'INVOICES_NOT_CONFIGURED');
  process.env.OT_INVOICE_ENABLED = '1'; process.env.OT_INVOICE_ISSUER_JSON = '{"name":"Missing bank"}';
  assert.equal(invoiceConfiguration().enabled, false); await rejectsCode(createInvoice(manager, setupData.organization.id, setupData.body, randomUUID()), 'INVOICES_NOT_CONFIGURED');
  process.env.OT_INVOICE_ISSUER_JSON = JSON.stringify(issuer); assert.equal(invoiceConfiguration().enabled, true);
});
test('invoice scope denies outsiders, ordinary employees and stale-manager replays', async () => {
  const { organization, body } = await setup(); const key = randomUUID();
  await rejectsCode(createInvoice(outsider, organization.id, body, key), 'ORGANIZATION_NOT_FOUND');
  const { invoice } = await createInvoice(manager, organization.id, body, key);
  await rejectsCode(getInvoice(outsider, invoice.id), 'ORGANIZATION_NOT_FOUND');
  await rejectsCode(getInvoice(learner, invoice.id), 'ORGANIZATION_NOT_FOUND');
  await rejectsCode(listInvoices(outsider, organization.id), 'ORGANIZATION_NOT_FOUND');
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?", [organization.id, manager.id]);
  await rejectsCode(createInvoice(manager, organization.id, body, key), 'ORGANIZATION_NOT_FOUND');
  await rejectsCode(renderInvoice(manager, invoice.id), 'ORGANIZATION_NOT_FOUND');
});
test('amount is published server price times unique verified seats; snapshots cannot be edited', async () => {
  const { organization, body } = await setup([learner.id, manager.id]);
  await rejectsCode(createInvoice(manager, organization.id, { ...body, amountMinor: 1 }, randomUUID()), 'VALIDATION_ERROR');
  await rejectsCode(createInvoice(manager, organization.id, { ...body, userIds: [learner.id, learner.id] }, randomUUID()), 'DUPLICATE_EMPLOYEES');
  await rejectsCode(createInvoice(manager, organization.id, { ...body, userIds: Array(101).fill(learner.id) }, randomUUID()), 'VALIDATION_ERROR');
  const { invoice } = await createInvoice(manager, organization.id, body, randomUUID());
  assert.equal(invoice.amountMinor, 250000); assert.equal(invoice.snapshot.quantity, 2); assert.equal(invoice.lines.length, 2);
  assert.ok(!JSON.stringify(invoice).includes('correctOptionIds'));
  await assert.rejects(execute('UPDATE corporate_invoices SET amount_minor=1 WHERE id=?', [invoice.id]), /immutable/);
  await assert.rejects(execute('UPDATE corporate_invoice_lines SET amount_minor=1 WHERE invoice_id=?', [invoice.id]), /immutable/);
  await assert.rejects(execute('INSERT INTO corporate_invoice_lines(id,invoice_id,user_id,amount_minor,snapshot_json) VALUES(?,?,?,?,?)', [randomUUID(), invoice.id, outsider.id, 1, '{}']), /immutable/);
  await assert.rejects(execute('DELETE FROM corporate_invoices WHERE id=?', [invoice.id]), /immutable/);
  process.env.OT_INVOICE_ISSUER_JSON = JSON.stringify({ ...issuer, name: 'CHANGED TEST CONFIG' });
  const printed = await renderInvoice(manager, invoice.id); assert.ok(printed.html.includes(issuer.name)); assert.ok(!printed.html.includes('CHANGED TEST CONFIG'));
  assert.ok(printed.html.includes('&lt;script&gt;')); assert.ok(!printed.html.includes('<script>'));
  assert.ok(printed.html.includes('Счёт на оплату')); assert.ok(printed.html.includes('не является кассовым чеком'));
  assert.ok(printed.filename.endsWith('.html')); process.env.OT_INVOICE_ISSUER_JSON = JSON.stringify(issuer);
});
test('invoice create is atomic/idempotent and prevents overlapping invoices until cancellation', async () => {
  const { organization, body } = await setup(); const key = randomUUID();
  const [one, retry] = await Promise.all([createInvoice(manager, organization.id, body, key), createInvoice(manager, organization.id, body, key)]);
  assert.equal(one.invoice.id, retry.invoice.id);
  await rejectsCode(createInvoice(manager, organization.id, { ...body, buyer: { ...buyer, name: 'Different buyer' } }, key), 'IDEMPOTENCY_CONFLICT');
  await rejectsCode(createInvoice(manager, organization.id, body, randomUUID()), 'EMPLOYEE_IN_OPEN_INVOICE');
  await rejectsCode(cancelInvoice(outsider, one.invoice.id, { reason: 'Isolated cancellation' }), 'ORGANIZATION_NOT_FOUND');
  const cancelled = await cancelInvoice(manager, one.invoice.id, { reason: 'Isolated cancellation' }); assert.equal(cancelled.invoice.status, 'cancelled');
  assert.equal((await cancelInvoice(manager, one.invoice.id, { reason: 'Isolated cancellation' })).invoice.id, one.invoice.id);
  await rejectsCode(confirmInvoice(finance, one.invoice.id, confirmation(one.invoice.amountMinor)), 'INVOICE_CANCELLED');
  assert.notEqual((await createInvoice(manager, organization.id, body, randomUUID())).invoice.id, one.invoice.id);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE organization_id=?', [organization.id]))!.n, 0);
});
test('only current finance/admin with session MFA can record exact-amount payment evidence', async () => {
  const { organization, body } = await setup(); const { invoice } = await createInvoice(manager, organization.id, body, randomUUID());
  await rejectsCode(confirmInvoice(manager, invoice.id, confirmation(invoice.amountMinor)), 'FORBIDDEN');
  await rejectsCode(confirmInvoice({ ...finance, mfaVerifiedAt: null }, invoice.id, confirmation(invoice.amountMinor)), 'MFA_REQUIRED');
  await rejectsCode(confirmInvoice({ ...manager, role: 'finance', twoFactorEnabled: true, mfaVerifiedAt: Date.now() }, invoice.id, confirmation(invoice.amountMinor)), 'FORBIDDEN');
  await rejectsCode(confirmInvoice(finance, invoice.id, confirmation(1)), 'INVOICE_AMOUNT_MISMATCH');
  await rejectsCode(confirmInvoice(finance, invoice.id, { ...confirmation(invoice.amountMinor), currency: 'USD' }), 'VALIDATION_ERROR');
  await rejectsCode(confirmInvoice(finance, invoice.id, { ...confirmation(invoice.amountMinor), reason: '' }), 'VALIDATION_ERROR');
  await rejectsCode(listFinanceInvoices(manager), 'FORBIDDEN');
  assert.ok((await listFinanceInvoices(finance)).invoices.some(row => row.id === invoice.id));
  assert.equal((await getInvoice(manager, invoice.id)).invoice.status, 'issued');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM orders WHERE organization_id=?', [organization.id]))!.n, 0);
});
test('revoked employee blocks whole confirmation; no partial access or paid orders escape rollback', async () => {
  const { organization, body } = await setup([learner.id, manager.id]); const { invoice } = await createInvoice(manager, organization.id, body, randomUUID());
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?", [organization.id, learner.id]);
  await rejectsCode(confirmInvoice(finance, invoice.id, confirmation(invoice.amountMinor)), 'ACTIVE_VERIFIED_EMPLOYEES_REQUIRED');
  assert.equal((await getInvoice(manager, invoice.id)).invoice.status, 'issued');
  for (const table of ['orders', 'enrollments']) assert.equal((await queryOne(`SELECT COUNT(*) n FROM ${table} WHERE organization_id=?`, [organization.id]))!.n, 0);
});
test('manual confirmation reuses pending access, is atomic on replay and preserves academic conditions', async () => {
  const { organization, version, body } = await setup(); const pendingId = randomUUID();
  await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) VALUES(?,?,?,?,?,?)', [pendingId, learner.id, version.id, organization.id, 'pending_access', new Date().toISOString()]);
  const { invoice } = await createInvoice(manager, organization.id, body, randomUUID()); const evidence = confirmation(invoice.amountMinor);
  const [one, retry] = await Promise.all([confirmInvoice(finance, invoice.id, evidence), confirmInvoice(finance, invoice.id, evidence)]);
  assert.equal(one.invoice.status, 'confirmed'); assert.deepEqual(one, retry); assert.equal(one.invoice.lines[0]!.enrollmentId, pendingId);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE organization_id=?', [organization.id]))!.n, 1);
  const orders = await queryAll('SELECT * FROM orders WHERE organization_id=?', [organization.id]); assert.equal(orders.length, 1); assert.equal(orders[0]!.status, 'succeeded'); assert.equal(orders[0]!.enrollment_id, pendingId);
  assert.equal((await queryOne('SELECT provider FROM payments WHERE order_id=?', [orders[0]!.id]))!.provider, 'manual_invoice');
  assert.equal((await queryOne("SELECT COUNT(*) n FROM audit_events WHERE action='invoice.payment_confirmed_manually' AND target=?", [invoice.id]))!.n, 1);
  assert.equal((await queryOne("SELECT COUNT(*) n FROM outbox WHERE type='learning.enrolled' AND aggregate_id=?", [pendingId]))!.n, 1);
  await rejectsCode(confirmInvoice(finance, invoice.id, { ...evidence, reference: randomUUID() }), 'INVOICE_CONFIRMATION_CONFLICT');
  await rejectsCode(cancelInvoice(manager, invoice.id, { reason: 'Cannot cancel confirmed invoice' }), 'INVOICE_ALREADY_CONFIRMED');
  await assert.rejects(execute('UPDATE corporate_invoices SET confirmation_json=? WHERE id=?', ['{}', invoice.id]), /immutable/);
  assert.equal((await enrollmentDetails(learner, pendingId)).status, 'active');
  await rejectsCode(startAttempt(learner, pendingId, randomUUID()), 'ASSESSMENT_NOT_ELIGIBLE');
  await rejectsCode(issueCredential(admin.id, pendingId, 'No automatic academic bypass'), 'REQUIRED_LEARNING_INCOMPLETE');
  await completeLesson(learner, pendingId, 'l1', 0); const attempt = await startAttempt(learner, pendingId, randomUUID());
  await saveAnswer(learner, attempt.id, 'q1', ['b'], attempt.revision); await submitAttempt(learner, attempt.id);
  await rejectsCode(issueCredential(admin.id, pendingId, 'Paid condition passes but document still requires actual approved template'), 'APPROVED_DOCUMENT_TEMPLATE_REQUIRED');
  await rejectsCode(createInvoice(manager, organization.id, body, randomUUID()), 'EMPLOYEE_ALREADY_ASSIGNED');
});
test('one bank reference cannot confirm two different invoices', async () => {
  const first = await setup(); const second = await setup(); const a = (await createInvoice(manager, first.organization.id, first.body, randomUUID())).invoice; const b = (await createInvoice(manager, second.organization.id, second.body, randomUUID())).invoice;
  const data = confirmation(a.amountMinor, 'ISOLATED transfer-ref-repeat'); await confirmInvoice(finance, a.id, data);
  await rejectsCode(confirmInvoice(finance, b.id, { ...data, reference: data.reference.toLowerCase() }), 'PAYMENT_REFERENCE_ALREADY_USED');
  assert.equal((await getInvoice(manager, b.id)).invoice.status, 'issued');
});
test('draft, free, unverified and active duplicate assignments cannot enter paid invoices', async () => {
  const { organization, body, version } = await setup();
  const draft = (await createVersion(editor, 'ptm', fixture())).version;
  await rejectsCode(createInvoice(manager, organization.id, { ...body, versionId: draft.id }, randomUUID()), 'PAID_PUBLISHED_VERSION_REQUIRED');
  const free = await publication({ ...fixture(), accessModel: 'free', priceMinor: 0 });
  await rejectsCode(createInvoice(manager, organization.id, { ...body, versionId: free.id }, randomUUID()), 'PAID_PUBLISHED_VERSION_REQUIRED');
  await execute('UPDATE "user" SET emailVerified=0 WHERE id=?', [learner.id]);
  await rejectsCode(createInvoice(manager, organization.id, body, randomUUID()), 'ACTIVE_VERIFIED_EMPLOYEES_REQUIRED');
  await execute('UPDATE "user" SET emailVerified=1 WHERE id=?', [learner.id]);
  await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) VALUES(?,?,?,?,?,?)', [randomUUID(), learner.id, version.id, organization.id, 'active', new Date().toISOString()]);
  await rejectsCode(createInvoice(manager, organization.id, body, randomUUID()), 'EMPLOYEE_ALREADY_ASSIGNED');
});
test('100-seat invoices batch SQL and keep organization fees fixed instead of multiplying by employees', async () => {
  const userIds = Array.from({ length: 100 }, (_, index) => `invoice-budget-${index}`);
  await execute(`INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role) VALUES ${userIds.map(() => '(?,?,?,1,?,?,?)').join(',')}`, userIds.flatMap(userId => [userId, 'ISOLATED TEST USER', `${userId}@example.test`, Date.now(), Date.now(), 'learner']));
  const { organization, body } = await setup(userIds); const db = await getDb();
  const originalTransaction = db.transaction.bind(db); let queries = 0;
  db.transaction = async (mode?: 'write' | 'read' | 'deferred') => { const tx = await originalTransaction(mode); const original = tx.execute.bind(tx); tx.execute = async (...parameters) => { queries++; return original(...parameters); }; return tx; };
  try {
    const { invoice } = await createInvoice(manager, organization.id, body, randomUUID()); const createQueries = queries; queries = 0;
    assert.equal(invoice.amountMinor, 12500000); assert.equal(invoice.lines.length, 100);
    const paid = await confirmInvoice(finance, invoice.id, confirmation(invoice.amountMinor)); assert.equal(paid.invoice.lines.length, 100);
    assert.ok(createQueries <= 20, `create SQL queries ${createQueries}`); assert.ok(queries <= 30, `confirm SQL queries ${queries}`);
    assert.equal((await queryOne('SELECT COUNT(*) n FROM orders WHERE organization_id=? AND status=?', [organization.id, 'succeeded']))!.n, 100);
    const corporateVersion = await publication({ ...fixture(), billingBasis: 'organization', priceMinor: 125003 }); queries = 0;
    const corporate = (await createInvoice(manager, organization.id, { ...body, versionId: corporateVersion.id }, randomUUID())).invoice;
    assert.equal(corporate.snapshot.billingBasis, 'organization'); assert.equal(corporate.amountMinor, 125003); assert.equal(corporate.snapshot.quantity, 100);
    assert.equal(corporate.lines.reduce((sum, line) => sum + line.amountMinor, 0), 125003);
    assert.equal(corporate.lines.filter(line => line.amountMinor === 1251).length, 3); assert.equal(corporate.lines.filter(line => line.amountMinor === 1250).length, 97);
    assert.ok(queries <= 20, `corporate create SQL queries ${queries}`); queries = 0;
    await confirmInvoice(finance, corporate.id, confirmation(corporate.amountMinor)); assert.ok(queries <= 30, `corporate confirm SQL queries ${queries}`);
    const totals = await queryOne('SELECT COUNT(*) n,SUM(amount_minor) amount FROM orders WHERE organization_id=? AND version_id=?', [organization.id, corporateVersion.id]);
    assert.equal(totals!.n, 100); assert.equal(totals!.amount, 125003);
    const printed = await renderInvoice(manager, corporate.id); assert.ok(printed.html.includes('Организация: 100 слушателей')); assert.ok(printed.html.includes('</td><td>1</td>'));
  } finally { db.transaction = originalTransaction; }
});

test('one-minor-unit organization fee allocates exact totals including zero-cost covered seats', async () => {
  const { organization, body, version } = await setup([manager.id, learner.id, outsider.id], { ...fixture(), billingBasis: 'organization', priceMinor: 1 });
  const { invoice } = await createInvoice(manager, organization.id, body, randomUUID());
  assert.equal(invoice.amountMinor, 1); assert.deepEqual(invoice.lines.map(line => line.amountMinor).sort(), [0, 0, 1]);
  await assert.rejects(execute('UPDATE corporate_invoice_lines SET allocated_amount_minor=99 WHERE invoice_id=?', [invoice.id]), /immutable/);
  const result = await confirmInvoice(finance, invoice.id, confirmation(1)); assert.equal(result.invoice.status, 'confirmed');
  const totals = await queryOne('SELECT COUNT(*) n,SUM(amount_minor) amount FROM orders WHERE organization_id=? AND version_id=? AND status=?', [organization.id, version.id, 'succeeded']);
  assert.equal(totals!.n, 3); assert.equal(totals!.amount, 1);
  assert.equal((await queryOne('SELECT SUM(p.amount_minor) amount FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.organization_id=?', [organization.id]))!.amount, 1);
});

test('opted-in aggregate invoice analytics records one confirmed payment and exact activated seats; rejects/replays/retention never invent transitions', async () => {
  const settings = { OT_ANALYTICS_ENABLED: process.env.OT_ANALYTICS_ENABLED, OT_ANALYTICS_RETENTION_DAYS: process.env.OT_ANALYTICS_RETENTION_DAYS };
  process.env.OT_ANALYTICS_ENABLED = '1'; process.env.OT_ANALYTICS_RETENTION_DAYS = '14';
  const baselineIds = new Set((await queryAll('SELECT id FROM analytics_events')).map(row => row.id));
  const currentEvents = async () => (await queryAll<{ id: string; name: string; dimensions_json: string }>('SELECT id,name,dimensions_json FROM analytics_events')).filter(row => !baselineIds.has(row.id));
  const confirmed: { invoiceId: string; evidence: ReturnType<typeof confirmation>; version: number; seats: number }[] = [];
  try {
    const declined = await setup([manager.id, learner.id]);
    const declinedInvoice = (await createInvoice(manager, declined.organization.id, declined.body, randomUUID())).invoice;
    await cancelInvoice(manager, declinedInvoice.id, { reason: 'Synthetic declined invoice, no transfer' });
    await rejectsCode(confirmInvoice(finance, declinedInvoice.id, confirmation(declinedInvoice.amountMinor)), 'INVOICE_CANCELLED');
    assert.deepEqual(await currentEvents(), [], 'Creation, cancellation and rejected confirmation are not payments or activations');

    for (const seats of [2, 100]) {
      let userIds = [manager.id, learner.id];
      if (seats === 100) {
        userIds = Array.from({ length: seats }, () => randomUUID());
        // Synthetic identity fixtures only; orders, access and their events use the real invoice services.
        await execute(`INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role) VALUES ${userIds.map(() => '(?,?,?,1,1,1,?)').join(',')}`,
          userIds.flatMap(id => [id, 'PRIVATE_ANALYTICS_INVOICE_LEARNER', `${id}@example.test`, 'learner']));
      }
      const data = await setup(userIds, { ...fixture(), billingBasis: seats === 100 ? 'organization' : 'learner', priceMinor: 125003 });
      const before = await currentEvents();
      const invoice = (await createInvoice(manager, data.organization.id, data.body, randomUUID())).invoice;
      const evidence = confirmation(invoice.amountMinor, `PRIVATE_ANALYTICS_BANK_REFERENCE_${seats}`);
      await rejectsCode(confirmInvoice(manager, invoice.id, evidence), 'FORBIDDEN');
      await rejectsCode(confirmInvoice({ ...finance, mfaVerifiedAt: null }, invoice.id, evidence), 'MFA_REQUIRED');
      await rejectsCode(confirmInvoice(finance, invoice.id, { ...evidence, amountMinor: invoice.amountMinor + 1 }), 'INVOICE_AMOUNT_MISMATCH');
      assert.deepEqual(await currentEvents(), before, 'Wrong amount/authorization must not write metrics');
      const [first, replay] = await Promise.all([confirmInvoice(finance, invoice.id, evidence), confirmInvoice(finance, invoice.id, evidence)]);
      assert.equal(first.invoice.status, 'confirmed'); assert.deepEqual(replay, first);
      const events = (await currentEvents()).filter(row => !before.some(old => old.id === row.id));
      assert.equal(events.filter(row => row.name === 'payment_confirmed').length, 1, 'A corporate transfer is one payment event, not one per seat');
      assert.equal(events.filter(row => row.name === 'enrollment_activated').length, seats);
      assert.equal(events.length, seats + 1);
      assert.equal((await queryOne('SELECT COUNT(*) count FROM enrollments WHERE organization_id=? AND status=?', [data.organization.id, 'active']))!.count, seats);
      for (const row of events) assert.deepEqual(JSON.parse(row.dimensions_json), { programId: 'ohrana-truda', locale: 'ru', audience: 'b2b', version: data.version.version, channel: 'manual_invoice' });
      const serialized = JSON.stringify(events);
      for (const privateValue of ['PRIVATE_ANALYTICS_INVOICE_LEARNER', 'PRIVATE_ANALYTICS_BANK_REFERENCE', '@example.test', issuer.name, issuer.bin, issuer.iban, issuer.address, buyer.name, buyer.bin, buyer.address, invoice.id, data.organization.id, ...userIds]) assert.equal(serialized.includes(privateValue), false);
      await confirmInvoice(finance, invoice.id, evidence); assert.deepEqual(await currentEvents(), [...before, ...events]);
      confirmed.push({ invoiceId: invoice.id, evidence, version: data.version.version, seats });
    }
    const events = await currentEvents(); assert.equal(events.length, 104);
    const historical = new Date(Date.now() - 15 * 86400000).toISOString();
    await execute(`UPDATE analytics_events SET created_at=? WHERE id IN (${events.map(() => '?').join(',')})`, [historical, ...events.map(row => row.id)]);
    assert.equal((await expireAnalytics()).deleted, events.length);
    const factsBeforeReplay = await queryOne("SELECT COUNT(*) n FROM audit_events WHERE action='invoice.payment_confirmed_manually'");
    for (const result of confirmed) await confirmInvoice(finance, result.invoiceId, result.evidence);
    assert.deepEqual(await currentEvents(), [], 'Replay after optional analytics expiry must not backfill an old transition as a new payment');
    assert.deepEqual(await queryOne("SELECT COUNT(*) n FROM audit_events WHERE action='invoice.payment_confirmed_manually'"), factsBeforeReplay);
  } finally {
    for (const [key, value] of Object.entries(settings)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
