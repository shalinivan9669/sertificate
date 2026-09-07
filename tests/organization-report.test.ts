import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryOne, withTransaction } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { listOrganizations, MAX_ORGANIZATION_EXPORT_ROWS, organizationOverview, organizationReport } from '../server/services/organizations';
import type { AppUser } from '../server/utils/auth';

let directory: string;
let versionId: string;
let optionalVersionId: string;
let otherVersionId: string;
let sequence = 0;
const date = '2026-01-01T00:00:00.000Z';
const future = '2099-01-01T00:00:00.000Z';
const owner = 'report-owner';
const member = 'report-member';
const manager = 'report-manager';
const outsider = 'report-outsider';
const instructor = 'report-instructor';
const envKeys = ['OT_DATABASE_PATH', 'NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const actor = (id: string, role: AppUser['role']): AppUser => ({ id, role, name: 'ISOLATED REPORT TEST', email: `${id}@example.test`, twoFactorEnabled: true, mfaVerifiedAt: Date.now() });
const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error.data?.code === code);

function data(optional = false): ProgramData {
  return { title: '=ISOLATED REPORT FIXTURE, NO VALIDITY', language: 'kk', audience: 'Synthetic users only', prerequisites: '', outcomes: 'Report test', limitations: 'Not academic material', format: 'Test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'TEST ONLY', support: 'Test', sourceRefs: ['Synthetic report fixture'], reviewedAt: '2026-09-07',
    modules: [{ id: 'module', title: 'TEST MODULE', lessons: [
      { id: 'theory', title: 'TEST THEORY', kind: 'text', required: !optional, body: 'Synthetic fixture', media: [] },
      { id: 'practice', title: 'TEST PRACTICE', kind: 'practice', required: !optional, body: 'Synthetic practice fixture', media: [] },
      { id: 'extra', title: 'TEST OPTIONAL', kind: 'text', required: false, body: 'Synthetic optional fixture', media: [] },
    ] }], assessment: { durationMinutes: 1, maxAttempts: 5, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'question', text: 'REPORT_PRIVATE_QUESTION_CANARY', topic: 'Test', options: [{ id: 'wrong', text: 'Wrong' }, { id: 'correct', text: 'REPORT_PRIVATE_ANSWER_CANARY' }], correctOptionIds: ['correct'] }] };
}
async function publication(program = 'ohrana-truda', optional = false) {
  const editor = actor('report-editor', 'editor'); const reviewer = actor('report-reviewer', 'reviewer');
  const draft = (await createVersion(editor, program, data(optional))).version;
  // Zero-required content cannot be published. This deliberately malformed historical
  // enrollment fixture checks the report denominator defensively without bypassing publication.
  if (optional) return draft.id;
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  return (await publishVersion(reviewer, review.id, review.revision, 'Independent synthetic report fixture review')).version.id;
}
async function organization(name = 'ISOLATED REPORT ORGANIZATION') {
  const id = `report-org-${++sequence}`;
  await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [id, name, date]);
  for (const [idUser, role] of [[owner, 'owner'], [manager, 'manager'], [member, 'member']]) await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [id, idUser!, role!, date]);
  return id;
}
async function enrollment(orgId: string, status = 'active', version = versionId, access: string | null = null, userId = member) {
  const id = `report-enrollment-${++sequence}`;
  await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,access_until,created_at) VALUES(?,?,?,?,?,?,?)', [id, userId, version, orgId, status, access, date]);
  return id;
}
async function completion(enrollmentId: string, lessonId: string, by = member) {
  await execute('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,completed_by,completed_at) VALUES(?,?,1,?,?)', [enrollmentId, lessonId, by, date]);
}
async function attempt(enrollmentId: string, status: string, pass: boolean | null, createdAt = date, deadline = future) {
  const id = `report-attempt-${++sequence}`;
  await execute('INSERT INTO attempts(id,enrollment_id,status,deadline_at,form_json,answers_json,result_json,created_at) VALUES(?,?,?,?,?,?,?,?)', [id, enrollmentId, status, deadline, '{"question":"REPORT_PRIVATE_QUESTION_CANARY"}', '{"question":["REPORT_PRIVATE_ANSWER_CANARY"]}', pass === null ? null : JSON.stringify({ pass, score: pass ? 100 : 0 }), createdAt]);
  return id;
}
async function document(enrollmentId: string, status: string, createdAt = date) {
  const id = `report-document-${++sequence}`;
  const a = await attempt(enrollmentId, 'graded', true);
  await execute('INSERT INTO credentials(id,enrollment_id,attempt_id,serial,status,snapshot_json,verification_hash,document_base64,issued_at,revoked_at,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [id, enrollmentId, a, `TEST-${id}`, status, '{"private":"REPORT_PRIVATE_SNAPSHOT_CANARY"}', `REPORT_PRIVATE_TOKEN_CANARY_${id}`, 'REPORT_PRIVATE_PDF_CANARY', status === 'pending' ? null : date, status === 'revoked' ? date : null, instructor, createdAt]);
  return id;
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-report-test-'));
  process.env.OT_DATABASE_PATH = join(directory, 'test.sqlite'); process.env.NODE_ENV = 'test';
  for (const key of ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) delete process.env[key];
  await getDb();
  for (const [id, role] of [[owner, 'learner'], [manager, 'learner'], [member, 'learner'], [outsider, 'learner'], [instructor, 'instructor'], ['report-editor', 'editor'], ['report-reviewer', 'reviewer']]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,1)', [id!, id === member ? '=1+1' : id!, `${id}@example.test`, Date.now(), Date.now(), role!]);
  versionId = await publication(); optionalVersionId = await publication('ohrana-truda', true); otherVersionId = await publication('ptm');
});
after(async () => {
  await closeDb();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-report-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
});

test('empty organization reports zero facts and a header-only CSV, with no invented completion percentage', async () => {
  const org = await organization();
  const result = await organizationOverview(owner, org, { page: '999', memberPage: 1 });
  assert.equal(result.totals.enrollments, 0); assert.deepEqual(result.enrollments, []);
  assert.equal(result.pagination.enrollments.page, 1); assert.equal(result.pagination.enrollments.from, 0); assert.equal(result.pagination.enrollments.to, 0); assert.equal(result.pagination.enrollments.hasMore, false);
  assert.equal(result.export.totalRows, 0); assert.equal(result.export.available, true);
  assert.equal((await organizationReport(owner, org)).split('\r\n').length, 1);
});

test('report progress uses pinned required lessons, instructor-confirmed practice and an explicit zero denominator', async () => {
  const org = await organization();
  const waiting = await enrollment(org); await completion(waiting, 'theory'); await completion(waiting, 'practice'); await completion(waiting, 'extra'); await completion(waiting, 'not-in-pinned-version');
  const ready = await enrollment(org); await completion(ready, 'theory'); await completion(ready, 'practice', instructor);
  const optional = await enrollment(org, 'active', optionalVersionId); await completion(optional, 'extra');
  const rows = (await organizationOverview(owner, org)).enrollments;
  const w = rows.find(row => row.id === waiting)!;
  assert.equal(w.progressStatus, 'waiting_practice'); assert.deepEqual(w.learning, { status: 'waiting_practice', total: 3, completed: 2, requiredTotal: 2, requiredCompleted: 1, pendingPractice: 1, percent: 50 });
  assert.equal(w.versionId, versionId, 'a later draft does not alter existing enrollment requirements');
  const r = rows.find(row => row.id === ready)!; assert.equal(r.progressStatus, 'ready_for_assessment'); assert.equal(r.learning.percent, 100); assert.equal(r.learning.pendingPractice, 0);
  const o = rows.find(row => row.id === optional)!; assert.equal(o.learning.requiredTotal, 0); assert.equal(o.learning.percent, null); assert.equal(o.learning.completed, 1);
});

test('report separates real exam, practice, document and access states without grading or leaking protected payloads', async () => {
  const org = await organization(); const expected = new Map<string, string>();
  const fresh = await enrollment(org); expected.set(fresh, 'not_started');
  const pending = await enrollment(org, 'pending_access'); expected.set(pending, 'pending_access');
  const failed = await enrollment(org); await attempt(failed, 'graded', true); const lastFailed = await attempt(failed, 'graded', false); expected.set(failed, 'assessment_failed');
  const passed = await enrollment(org); await attempt(passed, 'graded', true); expected.set(passed, 'completed');
  const active = await enrollment(org); await attempt(active, 'in_progress', null); expected.set(active, 'assessment_in_progress');
  const overdue = await enrollment(org); const overdueAttempt = await attempt(overdue, 'in_progress', null, date, date); expected.set(overdue, 'awaiting_grading');
  const voided = await enrollment(org); await attempt(voided, 'voided', null); expected.set(voided, 'assessment_voided');
  const expiredExam = await enrollment(org); await attempt(expiredExam, 'expired', false); expected.set(expiredExam, 'assessment_failed');
  for (const state of ['pending', 'issued', 'revoked', 'superseded']) { const en = await enrollment(org); await document(en, state); expected.set(en, `document_${state}`); }
  const replacement = await enrollment(org); await document(replacement, 'revoked'); const replacementDoc = await document(replacement, 'pending', '2026-02-01T00:00:00.000Z'); expected.set(replacement, 'document_pending');
  for (const state of ['suspended', 'cancelled', 'expired']) { const en = await enrollment(org, state); expected.set(en, state); }
  const deadline = await enrollment(org, 'active', versionId, date); await document(deadline, 'issued'); expected.set(deadline, 'expired');
  const before = await queryOne('SELECT status,revision,result_json FROM attempts WHERE id=?', [overdueAttempt]);
  const result = await organizationOverview(manager, org);
  assert.equal(result.enrollments.length, expected.size);
  for (const row of result.enrollments) assert.equal(row.progressStatus, expected.get(row.id), row.id);
  const f = result.enrollments.find(row => row.id === failed)!; assert.equal(f.assessment.attemptId, lastFailed); assert.equal(f.assessment.score, 0);
  assert.equal(result.enrollments.find(row => row.id === fresh)!.assessment.score, null);
  assert.equal(result.enrollments.find(row => row.id === replacement)!.credential.id, replacementDoc);
  const old = result.enrollments.find(row => row.id === deadline)!; assert.equal(old.accessStatus, 'expired'); assert.equal(old.credential.status, 'issued'); assert.equal(old.documents, 1);
  assert.deepEqual(await queryOne('SELECT status,revision,result_json FROM attempts WHERE id=?', [overdueAttempt]), before, 'read-only report must not fabricate grading');
  const csv = await organizationReport(owner, org);
  assert.match(csv, /"'=1\+1"/); assert.match(csv, /"'=ISOLATED REPORT FIXTURE, NO VALIDITY"/); assert.match(csv, /"assessment_failed"/); assert.match(csv, /"document_revoked"/);
  assert.doesNotMatch(JSON.stringify(result) + csv, /REPORT_PRIVATE_|correctOptionIds|form_json|answers_json|verification_hash|document_base64/);
});

test('tenant ACL is rechecked for every page and CSV, while revoked employee history remains visible as revoked access', async () => {
  const org = await organization(); const en = await enrollment(org);
  await rejects(organizationOverview(outsider, org), 'ORGANIZATION_NOT_FOUND');
  await rejects(organizationOverview(member, org), 'ORGANIZATION_NOT_FOUND');
  await rejects(organizationReport(outsider, org), 'ORGANIZATION_NOT_FOUND');
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?", [org, member]);
  const historical = (await organizationOverview(owner, org)).enrollments.find(row => row.id === en)!;
  assert.equal(historical.accessStatus, 'organization_access_revoked'); assert.equal(historical.status, 'active');
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?", [org, manager]);
  await rejects(organizationOverview(manager, org, { page: 2 }), 'ORGANIZATION_NOT_FOUND');
  await rejects(organizationReport(manager, org, { programId: 'ohrana-truda' }), 'ORGANIZATION_NOT_FOUND');
  await rejects(organizationOverview(owner, org, { pageSize: 101 }), 'VALIDATION_ERROR');
  await rejects(organizationOverview(owner, org, { page: 0 }), 'VALIDATION_ERROR');
  await rejects(organizationOverview(owner, org, { arbitrary: 'x' }), 'VALIDATION_ERROR');
});

test('stable pagination exposes all 520 assignments and independently pages members and invitations; CSV includes every row', async () => {
  const org = await organization();
  await withTransaction(async tx => {
    await execute(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<520)
      INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) SELECT ? || printf('%04d',n),?,?,?,'active',? FROM seq`, [`${org}-en-`, member, versionId, org, date], tx);
    for (let n = 0; n < 105; n++) {
      const id = `${org}-member-${String(n).padStart(3, '0')}`;
      await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,1,1)', [id, `TEST ${n}`, `${id}@example.test`], tx);
      await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [org, id, 'member', date], tx);
      await execute('INSERT INTO invitations(id,organization_id,email,role,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', [id, org, `${id}@example.test`, 'member', id, future, owner, date], tx);
    }
  });
  const ids: string[] = [];
  for (let page = 1; page <= 6; page++) {
    const result = await organizationOverview(owner, org, { page, pageSize: 100, memberPage: 2, invitationPage: 2 });
    assert.equal(result.totals.enrollments, 520); assert.equal(result.pagination.enrollments.totalPages, 6);
    assert.equal(result.enrollments.length, page === 6 ? 20 : 100); assert.equal(result.pagination.enrollments.hasMore, page < 6);
    assert.equal(result.members.length, 8); assert.equal(result.pagination.members.total, 108); assert.equal(result.invitations.length, 5); assert.equal(result.pagination.invitations.total, 105);
    ids.push(...result.enrollments.map(row => row.id));
  }
  assert.equal(new Set(ids).size, 520); assert.equal(ids[0], `${org}-en-0520`); assert.equal(ids.at(-1), `${org}-en-0001`);
  const repeat = await organizationOverview(owner, org, { page: '2', pageSize: '100' }); assert.deepEqual(repeat.enrollments.map(row => row.id), ids.slice(100, 200));
  const clamped = await organizationOverview(owner, org, { page: 999, pageSize: 100 }); assert.equal(clamped.pagination.enrollments.page, 6); assert.equal(clamped.pagination.enrollments.from, 501); assert.equal(clamped.pagination.enrollments.to, 520);
  const csv = await organizationReport(owner, org); assert.equal(csv.split('\r\n').length, 521);
});

test('oversized CSV fails explicitly instead of truncating and a scoped program filter returns complete data', async () => {
  const org = await organization(); const count = MAX_ORGANIZATION_EXPORT_ROWS + 1;
  await execute(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<?)
    INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) SELECT ? || n,?,?,?,'active',? FROM seq`, [count, `${org}-bulk-`, member, versionId, org, date]);
  await enrollment(org, 'active', otherVersionId); await enrollment(org, 'pending_access', otherVersionId);
  const overview = await organizationOverview(owner, org); assert.equal(overview.totals.enrollments, count + 2); assert.equal(overview.export.available, false);
  await rejects(organizationReport(owner, org), 'REPORT_TOO_LARGE');
  const filtered = await organizationOverview(owner, org, { programId: 'ptm' }); assert.equal(filtered.totals.enrollments, 2); assert.equal(filtered.export.available, true); assert.ok(filtered.enrollments.every(row => row.programId === 'ptm'));
  assert.equal((await organizationReport(owner, org, { programId: 'ptm' })).split('\r\n').length, 3);
  assert.equal((await organizationReport(owner, org, { programId: 'elektrobezopasnost' })).split('\r\n').length, 1);
  await rejects(organizationReport(owner, org, { page: 1 }), 'VALIDATION_ERROR');
});

test('organization selector no longer silently caps membership at 100 and read transactions recover after a failed callback', async () => {
  const isolatedOwner = `${owner}-many`;
  await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,1,1)', [isolatedOwner, 'TEST MANY', `${isolatedOwner}@example.test`]);
  await withTransaction(async tx => {
    for (let n = 0; n < 105; n++) {
      const id = `report-many-${String(n).padStart(3, '0')}`;
      await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [id, 'SAME NAME TEST', date], tx);
      await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [id, isolatedOwner, 'owner', date], tx);
    }
  });
  const first = await listOrganizations(isolatedOwner, { pageSize: 100 }); const second = await listOrganizations(isolatedOwner, { pageSize: 100, page: 2 });
  assert.equal(first.pagination.total, 105); assert.equal(first.organizations.length, 100); assert.equal(second.organizations.length, 5);
  assert.equal(new Set([...first.organizations, ...second.organizations].map(row => row.id)).size, 105);
  const problem = new Error('READ CALLBACK TEST');
  await assert.rejects(withTransaction(async tx => { await queryOne('SELECT COUNT(*) n FROM organizations', [], tx); throw problem; }, undefined, 'read'), error => error === problem);
  const empty = await listOrganizations(outsider); assert.equal(empty.pagination.total, 0);
  await withTransaction(async tx => { await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', ['report-write-after-read', 'TEST RECOVERY', date], tx); });
  assert.ok(await queryOne('SELECT id FROM organizations WHERE id=?', ['report-write-after-read']), 'native read commit/rollback leaves subsequent writes functional');
});
