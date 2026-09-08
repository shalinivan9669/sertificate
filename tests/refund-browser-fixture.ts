/** Synthetic local prerequisites for the actual refund browser scenario. Never application seed data. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { open, readFile, realpath, writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { closeDb, execute, getDb } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { checkout, createOrder, getOrder, processPaymentWebhook } from '../server/services/commerce';
import { completeLesson } from '../server/services/learning';
import { startAttempt, saveAnswer, submitAttempt } from '../server/services/assessment';
import { approveCredentialTemplate, createCredentialTemplate, issueCredential, renderCredential } from '../server/services/credentials';
import type { AppUser } from '../server/utils/auth';

assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.OT_ALLOW_TEST_SEED, '1');
assert.equal(process.env.OT_PAYMENT_PROVIDER, 'sandbox'); assert.equal(basename(process.env.OT_DATABASE_PATH || ''), 'e2e.sqlite');
assert.ok(!['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key]));
const databasePath = resolve(process.env.OT_DATABASE_PATH!); const fixturePath = resolve(process.env.OT_E2E_FIXTURE_PATH || '');
const ownedParent = await realpath(dirname(databasePath)); const dataRoot = await realpath(resolve('.data'));
const runId = process.env.OT_E2E_RUN_ID || '';
assert.match(runId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
assert.equal(dirname(ownedParent), dataRoot); assert.equal(basename(ownedParent), 'refund-browser-' + runId);
assert.equal(databasePath, resolve(ownedParent, 'e2e.sqlite')); assert.equal(fixturePath, resolve(ownedParent, 'fixture.json'));
const owner = JSON.parse(await readFile(resolve(ownedParent, '.fixture-owner.json'), 'utf8'));
assert.deepEqual(owner, { format: 'ot-refund-browser-fixture-v1', runId });
// Fail before getDb/migrations if a previous database exists, even in an owned test directory.
const reservation = await open(databasePath, 'wx', 0o600); await reservation.close();
const password = 'SYNTHETIC-refund-browser-password-2026!';
const actors = Object.fromEntries(['finance', 'learner', 'editor', 'reviewer', 'issuer'].map(role => [role, {
  id: `refund-browser-${role}`, role, name: `SYNTHETIC ${role}`, email: `refund-browser-${role}@example.test`, password,
}]));
const assured = (role: 'editor' | 'reviewer') => ({ ...actors[role], twoFactorEnabled: true, mfaVerifiedAt: Date.now() }) as AppUser;
function program(language: 'ru' | 'kk', label: string): ProgramData {
  return { title: `SYNTHETIC REFUND ${label} - NOT TRAINING CONTENT`, language, audience: 'Synthetic local users only', prerequisites: '', outcomes: 'Test financial integrity', limitations: 'Not an approved training program', format: 'Isolated test', durationHours: 1,
    priceMinor: 125000, currency: 'KZT', accessModel: 'paid', documentDescription: 'No credential is issued by this browser fixture', support: 'Synthetic test only', sourceRefs: ['tests/refund-browser-fixture.ts synthetic data'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'refund-module', title: 'Synthetic module', lessons: [{ id: 'refund-lesson', title: 'Synthetic lesson', kind: 'text', required: true, body: 'This is fictional test material, not occupational training.', media: [] }] }],
    assessment: { durationMinutes: 1, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'refund-question', text: 'Synthetic test?', topic: 'Test', options: [{ id: 'right', text: 'Synthetic option' }, { id: 'wrong', text: 'Other synthetic option' }], correctOptionIds: ['right'] }] };
}
try {
  await getDb(); const passwordHash = await hashPassword(password);
  for (const actor of Object.values(actors)) {
    await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [actor.id, actor.name, actor.email, actor.role, Date.now(), Date.now()]);
    await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [`${actor.id}-account`, actor.id, 'credential', actor.id, passwordHash, Date.now(), Date.now()]);
  }
  const orders: Record<string, { id: string; amountMinor: number; enrollmentId?: string; credentialId?: string }> = {};
  for (const label of ['ru', 'kk', 'refresh', 'manual']) {
    const draft = (await createVersion(assured('editor'), 'ohrana-truda', program(label === 'kk' ? 'kk' : 'ru', label))).version;
    const review = (await reviewVersion(assured('editor'), draft.id, draft.revision)).version;
    const version = (await publishVersion(assured('reviewer'), review.id, review.revision, 'SYNTHETIC independent fixture review; no production content')).version;
    const order = await createOrder(actors.learner!.id, { versionId: version.id }, randomUUID());
    if (label === 'manual') {
      // A pre-existing manual-bank ledger is a fixture for the exclusion check, not a claimed transfer.
      await execute("UPDATE orders SET status='succeeded' WHERE id=?", [order.id]);
      await execute("INSERT INTO payments(id,order_id,provider,status,amount_minor,currency,merchant,created_at,updated_at) VALUES(?,?,'manual_invoice','succeeded',?,'KZT','SYNTHETIC-NO-TRANSFER',?,?)", [randomUUID(), order.id, order.amountMinor, new Date().toISOString(), new Date().toISOString()]);
    } else {
      const payment = await checkout(order.id, actors.learner!.id);
      const body = JSON.stringify({ eventId: randomUUID(), paymentId: payment.paymentId, merchant: process.env.OT_SANDBOX_MERCHANT, amountMinor: order.amountMinor, currency: 'KZT', status: 'succeeded', timestamp: Date.now() });
      await processPaymentWebhook(body, createHmac('sha256', process.env.OT_SANDBOX_WEBHOOK_SECRET!).update(body).digest('hex'));
      const paid = await getOrder(order.id, actors.learner!.id);
      orders[label] = { id: order.id, amountMinor: order.amountMinor, enrollmentId: paid.enrollmentId };
      if (label === 'ru') {
        const learner = { ...actors.learner, twoFactorEnabled: false } as AppUser;
        await completeLesson(learner, paid.enrollmentId, 'refund-lesson', 0);
        let attempt = await startAttempt(learner, paid.enrollmentId, randomUUID());
        attempt = await saveAnswer(learner, attempt.id, 'refund-question', ['right'], attempt.revision);
        await submitAttempt(learner, attempt.id);
        const document = await PDFDocument.create(); const page = document.addPage([620, 800]);
        page.drawText('SYNTHETIC LOCAL TEST PDF - NO VALIDITY', { x: 30, y: 760, size: 14, font: await document.embedFont(StandardFonts.Helvetica) });
        const fieldMap = Object.fromEntries(['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'].map((key, index) => {
          document.getForm().createTextField(key).addToPage(page, { x: 30, y: 700 - index * 65, width: 560, height: 45 }); return [key, key];
        }));
        const template = await createCredentialTemplate(actors.issuer!.id, { programId: 'ohrana-truda', name: 'SYNTHETIC LOCAL TEST FORM', issuerName: 'SYNTHETIC TEST ISSUER - NO VALIDITY', pdfBase64: Buffer.from(await document.save()).toString('base64'), fieldMap });
        await approveCredentialTemplate(actors.reviewer!.id, template.template.id, 'SYNTHETIC independent local template check');
        const issued = await issueCredential(actors.issuer!.id, paid.enrollmentId, 'SYNTHETIC local test document; no legal validity');
        await renderCredential(issued.credential.id); orders[label]!.credentialId = issued.credential.id;
      }
    }
    orders[label] ||= { id: order.id, amountMinor: order.amountMinor };
  }
  await writeFile(fixturePath, JSON.stringify({ notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath, actors, orders }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'prepared', synthetic: true, orders: 4, externalDelivery: false }));
} finally { await closeDb(); }
