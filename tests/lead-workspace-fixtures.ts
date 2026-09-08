/** Synthetic target records only. Leads, qualification, proposals and links are created through actual browser HTTP. */
import { basename, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { closeDb, execute, getDb, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { createEnrollment } from '../server/services/learning';
import { createOrganization, assignEmployees } from '../server/services/organizations';
import { createOrder } from '../server/services/commerce';
import type { AppUser } from '../server/utils/auth';

const databasePath = resolve(process.env.OT_DATABASE_PATH || '');
if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.TURSO_DATABASE_URL || basename(databasePath) !== 'e2e.sqlite' || !databasePath.includes('lead-workspace-browser-') || process.env.OT_ANALYTICS_ENABLED !== '0') throw new Error('New guarded isolated lead-workspace DB required');
const password = 'Synthetic-lead-workspace-2026!';
const users = {
  admin: { id: 'lead-test-admin', role: 'admin', name: 'TEST ONLY LEAD ADMIN', email: 'lead-admin@example.test', password },
  learner: { id: 'lead-test-learner', role: 'learner', name: 'TEST ONLY LEAD LEARNER', email: 'lead-learner@example.test', password },
  outside: { id: 'lead-test-outside', role: 'learner', name: 'TEST ONLY OTHER ORGANIZATION', email: 'lead-outside@example.test', password },
  editor: { id: 'lead-test-editor', role: 'editor', name: 'TEST ONLY LEAD EDITOR', email: 'lead-editor@example.test', password },
  reviewer: { id: 'lead-test-reviewer', role: 'reviewer', name: 'TEST ONLY LEAD REVIEWER', email: 'lead-reviewer@example.test', password },
};
const author: AppUser = { ...users.editor, role: 'editor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { ...users.reviewer, role: 'reviewer', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const learner: AppUser = { ...users.learner, role: 'learner', twoFactorEnabled: false };
const content: ProgramData = { title: 'TEST ONLY sales report target; no academic validity', language: 'ru', audience: 'Synthetic test user', prerequisites: '', outcomes: 'Exercise sales linkage only', limitations: 'Not an approved curriculum', format: 'online', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', billingBasis: 'learner', documentDescription: 'No document issued by this fixture', support: 'Synthetic support', sourceRefs: ['tests/lead-workspace-fixtures.ts'], reviewedAt: new Date().toISOString().slice(0, 10), modules: [{ id: 'lead-test-module', title: 'TEST ONLY module', lessons: [{ id: 'lead-test-lesson', title: 'TEST ONLY lesson', kind: 'text', required: true, body: 'Synthetic sales attribution target. No occupational competence is certified.', media: [] }] }], assessment: { durationMinutes: 15, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 }, questions: [{ id: 'lead-test-question', text: 'TEST ONLY question', topic: 'Synthetic topic', options: [{ id: 'wrong', text: 'TEST WRONG' }, { id: 'right', text: 'TEST RIGHT' }], correctOptionIds: ['right'] }] };
try {
  await getDb(); const hash = await hashPassword(password);
  for (const user of Object.values(users)) {
    await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [user.id, user.name, user.email, user.role, Date.now(), Date.now()]);
    await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [user.id + '-account', user.id, 'credential', user.id, hash, Date.now(), Date.now()]);
  }
  async function publish(data: ProgramData) { const draft = (await createVersion(author, 'ohrana-truda', data)).version; const review = (await reviewVersion(author, draft.id, draft.revision)).version; return (await publishVersion(reviewer, review.id, review.revision, 'TEST ONLY synthetic target fixture reviewed')).version.id; }
  const freeVersionId = await publish(content); const paidVersionId = await publish({ ...content, title: 'TEST ONLY order target DO NOT PAY', accessModel: 'paid', priceMinor: 100000 });
  const personalEnrollment = (await createEnrollment(learner, { userId: learner.id, versionId: freeVersionId }, 'fixture-personal', true)).enrollment;
  const organization = (await createOrganization(users.admin.id, { name: 'TEST ONLY LINKED ORGANIZATION', ownerEmail: users.learner.email })).organization;
  const outsideOrganization = (await createOrganization(users.admin.id, { name: 'TEST ONLY UNRELATED ORGANIZATION', ownerEmail: users.outside.email })).organization;
  const assignments = await assignEmployees(users.learner.id, organization.id, { versionId: freeVersionId, userIds: [users.learner.id] }, 'fixture-target-assignment');
  const outsideAssignments = await assignEmployees(users.outside.id, outsideOrganization.id, { versionId: freeVersionId, userIds: [users.outside.id] }, 'fixture-outside-assignment');
  const order = await createOrder(users.learner.id, { versionId: paidVersionId }, 'fixture-unpaid-order');
  for (const table of ['lead_submissions', 'lead_qualifications', 'sales_proposals', 'sales_links']) if (Number((await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n)) throw new Error('Unexpected prior data in ' + table);
  await writeFile(resolve(process.env.OT_LEAD_WORKSPACE_FIXTURE_PATH!), JSON.stringify({ notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath, users, freeVersionId, paidVersionId, personalEnrollmentId: personalEnrollment.id, organization, outsideOrganization, assignmentId: assignments.enrollmentIds[0], outsideAssignmentId: outsideAssignments.enrollmentIds[0], orderId: order.id }, null, 2));
  console.log('Synthetic target records ready; no lead, qualification, proposal, link or completed academic outcome seeded.');
} finally { await closeDb(); }
