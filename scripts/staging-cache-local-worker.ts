/** Child-only isolated local construction of the T017 fixture through existing domain services. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { deploymentBinding, digest, fixtureFormat, ownedFixtureDirectory, previewOrigin, type Login } from './staging-cache-fixture';
import { exportDatabase } from './db-backup';
import { closeDb, execute, getDb } from '../server/db';
import { createVersion, reviewVersion, publishVersion, type ProgramData } from '../server/services/catalog';
import { createEnrollment, completeLesson } from '../server/services/learning';
import { startAttempt, saveAnswer, submitAttempt } from '../server/services/assessment';
import { createCredentialTemplate, approveCredentialTemplate, issueCredential, renderCredential, downloadCredential } from '../server/services/credentials';
import { processOutbox } from '../server/services/operations';
import type { AppUser, Role } from '../server/utils/auth';

assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.OT_APP_ENV, 'test'); assert.equal(process.env.OT_ALLOW_STAGING_CACHE_LOCAL, '1');
assert.ok(!['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_STAGING_CACHE_DATABASE_TOKEN'].some(key => process.env[key]));
for (const name of ['OT_EMAIL_DELIVERY_ENABLED', 'OT_CRM_DELIVERY_ENABLED', 'OT_OPERATIONAL_ALERTS_ENABLED', 'OT_ANALYTICS_ENABLED', 'OT_INVOICE_ENABLED']) assert.equal(process.env[name], '0');
assert.equal(process.env.OT_PAYMENT_PROVIDER, 'disabled');
const { directory, runId } = await ownedFixtureDirectory(process.env.OT_STAGING_CACHE_DIRECTORY || '');
assert.equal(resolve(process.env.OT_DATABASE_PATH || ''), resolve(directory, 'fixture.sqlite')); assert.equal(process.env.OT_MIGRATIONS_DIR, resolve(directory, 'migrations'));
const origin = previewOrigin(process.env.NUXT_PUBLIC_SITE_URL || ''); const reservation = await open(resolve(directory, 'fixture.sqlite'), 'wx', 0o600); await reservation.close();
try {
  const db = await getDb(); const baseline = await exportDatabase(db);
  const actors = Object.fromEntries(['first', 'second', 'editor', 'reviewer', 'issuer'].map(label => [label, { id: randomUUID(), name: 'SYNTHETIC ' + label + ' ' + randomUUID(), email: `${label}-${runId}@example.test`, role: (['first', 'second'].includes(label) ? 'learner' : label) as Role, twoFactorEnabled: true, mfaVerifiedAt: Date.now() }])) as Record<string, AppUser>;
  const learners: Login[] = [];
  for (const [label, actor] of Object.entries(actors)) {
    await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [actor.id, actor.name, actor.email, actor.role, Date.now(), Date.now()]);
    if (['first', 'second'].includes(label)) {
      const password = randomBytes(32).toString('base64url'); const hash = await hashPassword(password);
      await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [randomUUID(), actor.id, 'credential', actor.id, hash, Date.now(), Date.now()]); learners.push({ id: actor.id, name: actor.name, email: actor.email, password });
    }
  }
  const program: ProgramData = { title: 'SYNTHETIC T017 FIXTURE - NOT APPROVED TRAINING', language: 'ru', audience: 'Synthetic CDN test only', prerequisites: '', outcomes: 'Exercise private response isolation', limitations: 'No academic or legal validity', format: 'Isolated staging', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'SYNTHETIC TEST PDF - NO VALIDITY', support: 'Synthetic only', sourceRefs: ['scripts/staging-cache-local-worker.ts'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'test-module', title: 'Synthetic test', lessons: [{ id: 'test-lesson', title: 'SYNTHETIC content', body: 'Synthetic isolation fixture only.', required: true, kind: 'text', media: [] }] }], assessment: { durationMinutes: 5, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 }, questions: [{ id: 'test-question', text: 'Synthetic fixture?', topic: 'Synthetic', options: [{ id: 'right', text: 'Synthetic correct option' }, { id: 'wrong', text: 'Synthetic other option' }], correctOptionIds: ['right'] }] };
  const draft = (await createVersion(actors.editor!, 'ohrana-truda', program)).version; const review = (await reviewVersion(actors.editor!, draft.id, draft.revision)).version;
  const version = (await publishVersion(actors.reviewer!, review.id, review.revision, 'SYNTHETIC isolated test review; not approved training')).version;
  const { enrollment } = await createEnrollment(actors.first!, { userId: actors.first!.id, versionId: version.id }, randomUUID(), true);
  await completeLesson(actors.first!, enrollment.id, 'test-lesson', 0); let attempt = await startAttempt(actors.first!, enrollment.id, randomUUID());
  attempt = await saveAnswer(actors.first!, attempt.id, 'test-question', ['right'], attempt.revision); await submitAttempt(actors.first!, attempt.id);
  const pdf = await PDFDocument.create(); const page = pdf.addPage([620, 800]); page.drawText('SYNTHETIC STAGING TEST PDF - NO VALIDITY', { x: 30, y: 760, size: 14, font: await pdf.embedFont(StandardFonts.Helvetica) });
  const fieldMap = Object.fromEntries(['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'].map((key, index) => { pdf.getForm().createTextField(key).addToPage(page, { x: 30, y: 700 - index * 65, width: 560, height: 45 }); return [key, key]; }));
  const template = await createCredentialTemplate(actors.issuer!.id, { programId: 'ohrana-truda', name: 'SYNTHETIC TEST TEMPLATE', issuerName: 'SYNTHETIC TEST ISSUER - NO VALIDITY', pdfBase64: Buffer.from(await pdf.save()).toString('base64'), fieldMap });
  await approveCredentialTemplate(actors.reviewer!.id, template.template.id, 'SYNTHETIC local test template review');
  const issued = await issueCredential(actors.issuer!.id, enrollment.id, 'SYNTHETIC isolation fixture; no actual qualification'); await renderCredential(issued.credential.id);
  await processOutbox({ limit: 10, allowExternal: false }); await processOutbox({ limit: 10, allowExternal: false });
  const document = await downloadCredential(issued.credential.id, actors.first!.id); const snapshot = await exportDatabase(db);
  const preparationSource = JSON.parse(await readFile(resolve(directory, 'preparation-source.json'), 'utf8'));
  await writeFile(resolve(directory, 'fixture-private.json'), JSON.stringify({ format: fixtureFormat, runId, origin, createdAt: new Date().toISOString(), migrationGitSourceSha: process.env.OT_STAGING_CACHE_MIGRATION_GIT_SOURCE_SHA, deploymentBinding, preparationSource, baseline, snapshot, learners, enrollmentId: enrollment.id, credentialId: issued.credential.id, pdfSha256: digest(document.bytes) }), { flag: 'wx', mode: 0o600 });
} finally { await closeDb(); }
