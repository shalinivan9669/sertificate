/** New isolated database for browser QA; never imported by application code. */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { closeDb, execute, getDb, withTransaction } from '../server/db';
import { createVersion, reviewVersion, publishVersion, type ProgramData } from '../server/services/catalog';
import type { AppUser } from '../server/utils/auth';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.VERCEL_ENV || process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error('Explicit isolated local test environment required');
const directory = await mkdtemp(join(tmpdir(), 'ot-report-browser-'));
process.env.OT_DATABASE_PATH = join(directory, 'report-browser.sqlite');
const password = randomBytes(24).toString('base64url');
const owner = { id: 'report-browser-owner', name: 'TEST Organization Owner', email: 'report-browser-owner@example.test', password };
const member = { id: 'report-browser-learner', name: 'TEST Report Learner', email: 'report-browser-learner@example.test' };
const editor: AppUser = { id: 'report-browser-editor', name: 'TEST Report Editor', email: 'report-browser-editor@example.test', role: 'editor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { ...editor, id: 'report-browser-reviewer', email: 'report-browser-reviewer@example.test', role: 'reviewer' };
const date = '2026-01-01T00:00:00.000Z'; const future = '2099-01-01T00:00:00.000Z';
const orgId = randomUUID(); const emptyOrgId = randomUUID(); const states: Record<string, string> = {};
const data: ProgramData = { title: '[TEST ONLY] Organization report fixture', language: 'ru', audience: 'Synthetic users only', prerequisites: '', outcomes: 'Report QA', limitations: 'No academic validity', format: 'Test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'TEST ONLY', support: 'Test', sourceRefs: ['tests/organization-report-fixtures.ts synthetic content'], reviewedAt: '2026-09-07',
  modules: [{ id: 'report-module', title: 'TEST MODULE', lessons: [{ id: 'theory', title: 'TEST Theory', kind: 'text', required: true, body: 'Synthetic fixture only', media: [] }, { id: 'practice', title: 'TEST Practice', kind: 'practice', required: true, body: 'Synthetic instructor confirmation', media: [] }] }],
  assessment: { durationMinutes: 1, maxAttempts: 3, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 }, questions: [{ id: 'report-test-question', text: 'SYNTHETIC_REPORT_PRIVATE_QUESTION', topic: 'Test', options: [{ id: 'wrong', text: 'Wrong fixture' }, { id: 'correct', text: 'SYNTHETIC_REPORT_PRIVATE_ANSWER' }], correctOptionIds: ['correct'] }] };
async function publication(programId: string) {
  const draft = (await createVersion(editor, programId, data)).version;
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  return (await publishVersion(reviewer, review.id, review.revision, 'Independent synthetic browser fixture review')).version.id;
}
try {
  await getDb();
  const passwordHash = await hashPassword(password);
  for (const user of [owner, member, editor, reviewer]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,?)', [user.id, user.name, user.email, Date.now(), Date.now(), 'role' in user ? String(user.role) : 'learner', Number('role' in user)]);
  await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [owner.id, owner.id, 'credential', owner.id, passwordHash, Date.now(), Date.now()]);
  const versionId = await publication('ohrana-truda'); const otherVersionId = await publication('ptm');
  await withTransaction(async tx => {
    for (const [id, name] of [[orgId, 'TEST Report Organization'], [emptyOrgId, 'TEST Empty Organization']]) {
      await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [id!, name!, date], tx);
      await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [id!, owner.id, 'owner', date], tx);
    }
    await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [orgId, member.id, 'member', date], tx);
    for (let n = 0; n < 60; n++) {
      const id = `report-browser-member-${String(n).padStart(3, '0')}`;
      await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,1,1)', [id, `TEST Employee ${String(n).padStart(3, '0')}`, `${id}@example.test`], tx);
      await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [orgId, id, 'member', date], tx);
      await execute('INSERT INTO invitations(id,organization_id,email,role,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', [id, orgId, `${id}@example.test`, 'member', id, future, owner.id, date], tx);
      await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) VALUES(?,?,?,?,?,?)', [id, id, versionId, orgId, 'pending_access', date], tx);
    }
    for (const state of ['not_started', 'waiting_practice', 'ready_for_assessment', 'assessment_failed', 'completed', 'document_pending', 'document_issued', 'document_revoked', 'expired', 'other_program', 'owner_renewal']) {
      const id = randomUUID(); states[state] = id;
      await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,access_until,created_at) VALUES(?,?,?,?,?,?,?)', [id, state === 'owner_renewal' ? owner.id : member.id, state === 'other_program' ? otherVersionId : versionId, orgId, 'active', state === 'expired' ? date : null, '2026-02-01T00:00:00.000Z'], tx);
      if (state === 'waiting_practice' || state === 'ready_for_assessment') await execute('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,completed_by) VALUES(?,?,1,?)', [id, 'theory', member.id], tx);
      if (state === 'ready_for_assessment') await execute('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,completed_by) VALUES(?,?,1,?)', [id, 'practice', reviewer.id], tx);
      if (state === 'assessment_failed' || state === 'completed' || state.startsWith('document_')) {
        const attemptId = randomUUID(); const pass = state !== 'assessment_failed';
        await execute('INSERT INTO attempts(id,enrollment_id,status,deadline_at,form_json,result_json,created_at) VALUES(?,?,?,?,?,?,?)', [attemptId, id, 'graded', date, '{"questions":["SYNTHETIC_REPORT_PRIVATE_QUESTION"]}', JSON.stringify({ pass, score: pass ? 100 : 0 }), date], tx);
        if (state.startsWith('document_')) await execute('INSERT INTO credentials(id,enrollment_id,attempt_id,serial,status,snapshot_json,verification_hash,document_base64,issued_at,revoked_at,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [randomUUID(), id, attemptId, 'TEST-' + state.toUpperCase(), state.slice(9), '{}', randomUUID(), 'SYNTHETIC_REPORT_PRIVATE_PDF', state.endsWith('pending') ? null : date, state.endsWith('revoked') ? date : null, reviewer.id, date], tx);
      }
    }
  });
  await writeFile(resolve('.data/organization-report-fixture.json'), JSON.stringify({ notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath: process.env.OT_DATABASE_PATH, baseUrl: 'http://127.0.0.1:3104', owner, orgId, emptyOrgId, states, totals: { enrollments: 71, members: 62, invitations: 60 } }), { mode: 0o600 });
  console.log('Prepared isolated organization report fixture. Credentials remain in ignored local manifest.');
} finally { await closeDb(); }
