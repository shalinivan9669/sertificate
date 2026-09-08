import { randomUUID } from 'node:crypto';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { assertRole, type AppUser } from '../utils/auth';
import { fail, integer, payloadHash, textValue } from '../utils/validation';
import { getVersion, type ProgramData } from './catalog';
import { assertProgramIntakeOpen } from './program-intake';

export type EnrollmentRow = { id: string; user_id: string; version_id: string; organization_id: string | null; status: string; access_until: string | null; created_at: string };

export async function enrollmentRow(id: string, db?: Db) {
  const enrollment = await queryOne<EnrollmentRow>('SELECT * FROM enrollments WHERE id=?', [id], db);
  if (!enrollment) fail(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found');
  return enrollment;
}
export async function ownedEnrollment(actor: AppUser, id: string, db?: Db) {
  const row = await enrollmentRow(id, db);
  if (row.user_id !== actor.id) fail(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found');
  return row;
}
export function assertAccess(enrollment: EnrollmentRow, now = Date.now()) {
  if (!['active', 'learning_complete', 'assessment_eligible', 'completed'].includes(enrollment.status)) fail(403, 'ACCESS_UNAVAILABLE', 'Enrollment access is not active');
  if (enrollment.access_until && Date.parse(enrollment.access_until) <= now) fail(403, 'ACCESS_EXPIRED', 'Enrollment access expired');
}

export async function enrollmentSummary(enrollment: EnrollmentRow, db?: Db) {
  const version = await getVersion(enrollment.version_id, db); const data: ProgramData = JSON.parse(version.data_json);
  const progress = await queryAll<{ lesson_id: string; completed: number; revision: number }>('SELECT lesson_id,completed,revision FROM lesson_progress WHERE enrollment_id=?', [enrollment.id], db);
  return summarizeEnrollment(enrollment, version.program_id, data, progress);
}

function summarizeEnrollment(enrollment: EnrollmentRow, programId: string, data: ProgramData, progress: { lesson_id: string; completed: number }[]) {
  const lessons = data.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.required);
  const completed = lessons.filter((lesson) => progress.some((entry) => entry.lesson_id === lesson.id && entry.completed === 1)).length;
  return { id: enrollment.id, status: enrollment.status, versionId: enrollment.version_id, programId, title: data.title, language: data.language, organizationId: enrollment.organization_id, progress: { completed, total: lessons.length, percent: lessons.length ? Math.floor(completed / lessons.length * 100) : 0 }, accessUntil: enrollment.access_until };
}

export async function myEnrollments(actor: AppUser, db?: Db) {
  // Two bounded queries for the entire cabinet, independent of enrollment count. The joined
  // version is the enrollment's immutable edition; the protected bank never enters the DTO.
  const rows = await queryAll<EnrollmentRow & { program_id: string; data_json: string }>('SELECT e.*,v.program_id,v.data_json FROM enrollments e JOIN program_versions v ON v.id=e.version_id WHERE e.user_id=? ORDER BY e.created_at DESC,e.id LIMIT 200', [actor.id], db);
  if (!rows.length) return { enrollments: [] };
  const progress = await queryAll<{ enrollment_id: string; lesson_id: string; completed: number }>(`SELECT enrollment_id,lesson_id,completed FROM lesson_progress WHERE enrollment_id IN (${rows.map(() => '?').join(',')})`, rows.map((row) => row.id), db);
  const byEnrollment = new Map<string, typeof progress>();
  for (const entry of progress) { const items = byEnrollment.get(entry.enrollment_id) || []; items.push(entry); byEnrollment.set(entry.enrollment_id, items); }
  const editions = new Map<string, ProgramData>();
  return { enrollments: rows.map((row) => {
    const data = editions.get(row.version_id) || JSON.parse(row.data_json) as ProgramData; editions.set(row.version_id, data);
    return summarizeEnrollment(row, row.program_id, data, byEnrollment.get(row.id) || []);
  }) };
}

export async function eligibility(enrollment: EnrollmentRow, data: ProgramData, db?: Db, now = Date.now()) {
  const reasons: string[] = [];
  if (!['active', 'learning_complete', 'assessment_eligible'].includes(enrollment.status)) reasons.push(enrollment.status === 'completed' ? 'PROGRAM_COMPLETED' : 'ACCESS_UNAVAILABLE');
  if (enrollment.access_until && Date.parse(enrollment.access_until) <= now) reasons.push('ACCESS_EXPIRED');
  const progress = await queryAll('SELECT lesson_id FROM lesson_progress WHERE enrollment_id=? AND completed=1', [enrollment.id], db);
  if (data.modules.flatMap((module) => module.lessons).some((lesson) => lesson.required && !progress.some((entry) => entry.lesson_id === lesson.id))) reasons.push('REQUIRED_LEARNING_INCOMPLETE');
  const attempts = await queryAll('SELECT id,status,submitted_at,result_json FROM attempts WHERE enrollment_id=? ORDER BY created_at DESC,id DESC', [enrollment.id], db);
  const terminal = attempts.filter((attempt) => attempt.status !== 'voided' && attempt.status !== 'in_progress');
  if (terminal.some((attempt) => attempt.result_json && JSON.parse(attempt.result_json).pass)) reasons.push('PROGRAM_COMPLETED');
  if (attempts.filter((attempt) => attempt.status !== 'voided').length >= data.assessment.maxAttempts && !attempts.some((attempt) => attempt.status === 'in_progress')) reasons.push('ATTEMPT_LIMIT_REACHED');
  const last = terminal[0];
  if (last?.submitted_at && Date.parse(last.submitted_at) + data.assessment.retakeDelayMinutes * 60000 > now) reasons.push('RETAKE_WAIT_REQUIRED');
  return { eligible: !reasons.length, reasons: [...new Set(reasons)] };
}

export async function enrollmentDetails(actor: AppUser, id: string, db?: Db) {
  const enrollment = await ownedEnrollment(actor, id, db); const row = await getVersion(enrollment.version_id, db); const data: ProgramData = JSON.parse(row.data_json);
  const progress = await queryAll('SELECT lesson_id,completed,revision FROM lesson_progress WHERE enrollment_id=?', [id], db);
  const attempts = await queryAll('SELECT id,status FROM attempts WHERE enrollment_id=? ORDER BY created_at DESC,id DESC LIMIT 100', [id], db);
  return {
    ...await enrollmentSummary(enrollment, db),
    modules: data.modules.map((module) => ({ id: module.id, title: module.title, lessons: module.lessons.map(({ id, title, kind, required }) => {
      const entry = progress.find((entry) => entry.lesson_id === id);
      return { id, title, kind, required, completed: Boolean(entry?.completed), revision: Number(entry?.revision || 0) };
    }) })),
    assessment: data.assessment, eligibility: await eligibility(enrollment, data, db),
    activeAttemptId: attempts.find((attempt) => attempt.status === 'in_progress')?.id || null,
    latestAttemptId: attempts[0]?.id || null,
  };
}

export async function getLesson(actor: AppUser, id: string, lessonId: string) {
  const enrollment = await ownedEnrollment(actor, id); assertAccess(enrollment);
  const version = await getVersion(enrollment.version_id); const data: ProgramData = JSON.parse(version.data_json);
  const lesson = data.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === lessonId);
  if (!lesson) fail(404, 'LESSON_NOT_FOUND', 'Lesson does not belong to the assigned version');
  const progress = await queryOne('SELECT completed,revision FROM lesson_progress WHERE enrollment_id=? AND lesson_id=?', [id, lessonId]);
  return { lesson, progress: { completed: Boolean(progress?.completed), revision: Number(progress?.revision || 0) } };
}

export async function completeLesson(actor: AppUser, id: string, lessonId: string, revision: number) {
  integer(revision, 'revision');
  return withTransaction(async (tx) => {
    const enrollment = await ownedEnrollment(actor, id, tx); assertAccess(enrollment);
    const version = await getVersion(enrollment.version_id, tx); const data: ProgramData = JSON.parse(version.data_json);
    const lesson = data.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === lessonId);
    if (!lesson) fail(404, 'LESSON_NOT_FOUND', 'Lesson does not belong to the assigned version');
    if (lesson.kind === 'practice') fail(403, 'INSTRUCTOR_CONFIRMATION_REQUIRED', 'An instructor must confirm practical training');
    const progress = await queryOne('SELECT completed,revision FROM lesson_progress WHERE enrollment_id=? AND lesson_id=?', [id, lessonId], tx);
    if (progress?.completed) return enrollmentDetails(actor, id, tx);
    if (Number(progress?.revision || 0) !== revision) fail(409, 'REVISION_CONFLICT', 'Reload the saved lesson progress');
    await execute('INSERT INTO lesson_progress (enrollment_id,lesson_id,completed,revision,evidence_json,completed_by,completed_at) VALUES (?,?,1,?, ?,?,?) ON CONFLICT(enrollment_id,lesson_id) DO UPDATE SET completed=1,revision=excluded.revision,evidence_json=excluded.evidence_json,completed_by=excluded.completed_by,completed_at=excluded.completed_at', [id, lessonId, revision + 1, JSON.stringify({ kind: 'learner_confirmation', versionId: enrollment.version_id }), actor.id, new Date().toISOString()], tx);
    await audit(actor.id, 'learning.lesson_completed', `${id}/${lessonId}`, '', enrollment.organization_id, tx);
    await updateLearningStatus(enrollment, data, tx);
    return enrollmentDetails(actor, id, tx);
  });
}

async function updateLearningStatus(enrollment: EnrollmentRow, data: ProgramData, db: Db) {
  const completed = await queryAll('SELECT lesson_id FROM lesson_progress WHERE enrollment_id=? AND completed=1', [enrollment.id], db);
  if (data.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.required).every((lesson) => completed.some((entry) => entry.lesson_id === lesson.id))) {
    await execute("UPDATE enrollments SET status='assessment_eligible' WHERE id=? AND status IN ('active','learning_complete')", [enrollment.id], db);
  }
}

export async function confirmPractice(actor: AppUser, id: string, lessonId: string, evidence: string, reason: string) {
  assertRole(actor, ['instructor']); textValue(evidence, 'practice evidence', 4000); textValue(reason, 'reason', 2000);
  return withTransaction(async (tx) => {
    const enrollment = await enrollmentRow(id, tx); assertAccess(enrollment);
    if (enrollment.user_id === actor.id) fail(403, 'SELF_CONFIRMATION_FORBIDDEN', 'An instructor cannot confirm their own practical training');
    const version = await getVersion(enrollment.version_id, tx); const data: ProgramData = JSON.parse(version.data_json);
    const lesson = data.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === lessonId);
    if (!lesson || lesson.kind !== 'practice') fail(404, 'PRACTICE_NOT_FOUND', 'Practical lesson not found');
    const progress = await queryOne('SELECT completed,revision FROM lesson_progress WHERE enrollment_id=? AND lesson_id=?', [id, lessonId], tx);
    if (progress?.completed) return { confirmed: true, revision: progress.revision };
    await execute('INSERT INTO lesson_progress (enrollment_id,lesson_id,completed,revision,evidence_json,completed_by,completed_at) VALUES (?,?,1,1,?,?,?)', [id, lessonId, JSON.stringify({ kind: 'instructor_confirmation', evidence }), actor.id, new Date().toISOString()], tx);
    await audit(actor.id, 'learning.practice_confirmed', `${id}/${lessonId}`, reason, enrollment.organization_id, tx);
    await updateLearningStatus(enrollment, data, tx);
    return { confirmed: true, revision: 1 };
  });
}

export async function createEnrollment(actor: AppUser, input: { userId: string; versionId: string; accessUntil?: string | null; organizationId?: string | null; reason?: string; evidence?: string }, key: string, self = false) {
  textValue(key, 'Idempotency-Key', 128);
  if (self && input.userId !== actor.id) fail(403, 'FORBIDDEN', 'Cannot enroll another learner');
  if (!self) { assertRole(actor, ['instructor']); textValue(input.reason, 'reason', 2000); textValue(input.evidence, 'evidence', 4000); }
  const hash = payloadHash(input); const scope = `enrollment:${actor.id}:${self ? 'self' : 'staff'}`;
  return withTransaction(async (tx) => {
    const existing = await queryOne('SELECT * FROM idempotency_keys WHERE scope=? AND key=?', [scope, key], tx);
    if (existing) {
      if (existing.payload_hash !== hash) fail(409, 'IDEMPOTENCY_CONFLICT', 'This idempotency key was used with different data');
      return { enrollment: await enrollmentSummary(await enrollmentRow(existing.resource_id, tx), tx) };
    }
    const version = await getVersion(input.versionId, tx);
    const data: ProgramData = JSON.parse(version.data_json);
    const program = await queryOne('SELECT status FROM programs WHERE id=?', [version.program_id], tx);
    if (version.status !== 'published' || program?.status !== 'active') fail(409, 'VERSION_NOT_PUBLISHED', 'Enrollment requires a published, available program');
    await assertProgramIntakeOpen(version.id, tx);
    if (self && data.billingBasis === 'organization') fail(403, 'ORGANIZATION_ASSIGNMENT_REQUIRED', 'This program requires an organization assignment');
    if (self && data.accessModel !== 'free') fail(403, 'MANUAL_ENROLLMENT_REQUIRED', 'This program requires an approved enrollment arrangement');
    if (!self && data.accessModel === 'paid') fail(409, 'PAYMENT_REQUIRED', 'Paid access must be granted through a verified order');
    if (!await queryOne('SELECT id FROM "user" WHERE id=? AND emailVerified=1', [input.userId], tx)) fail(400, 'VERIFIED_LEARNER_REQUIRED', 'The learner must verify their email address');
    if (input.accessUntil && Date.parse(input.accessUntil) <= Date.now()) fail(400, 'INVALID_ACCESS_DATE', 'Access expiry must be in the future');
    const prior = self ? await queryOne<EnrollmentRow>("SELECT * FROM enrollments WHERE user_id=? AND version_id=? AND status NOT IN ('expired','cancelled')", [actor.id, input.versionId], tx) : undefined;
    const id = prior?.id || randomUUID(); const now = new Date().toISOString();
    if (!prior) {
      await execute('INSERT INTO enrollments (id,user_id,version_id,organization_id,status,access_until,created_at,reason) VALUES (?,?,?,?,?,?,?,?)', [id, input.userId, input.versionId, input.organizationId || null, 'active', input.accessUntil || null, now, input.reason || 'Free self-enrollment'], tx);
      await audit(actor.id, 'learning.enrollment_created', id, input.reason || 'Free self-enrollment', input.organizationId || null, tx);
      await enqueue('learning.enrolled', id, { enrollmentId: id, userId: input.userId }, tx);
    }
    await execute('INSERT INTO idempotency_keys (scope,key,payload_hash,resource_id,created_at) VALUES (?,?,?,?,?)', [scope, key, hash, id, now], tx);
    return { enrollment: await enrollmentSummary(await enrollmentRow(id, tx), tx) };
  });
}

export async function activateEnrollment(actor: AppUser, id: string, reason: string) {
  assertRole(actor, ['instructor']); textValue(reason, 'reason', 2000);
  return withTransaction(async (tx) => {
    const enrollment = await enrollmentRow(id, tx); const version = await getVersion(enrollment.version_id, tx); const data: ProgramData = JSON.parse(version.data_json);
    if (version.status !== 'published') fail(409, 'VERSION_NOT_PUBLISHED', 'Only a published version can be activated');
    if (data.accessModel === 'paid') fail(409, 'PAYMENT_REQUIRED', 'Paid access requires a verified order');
    if (!await queryOne('SELECT id FROM "user" WHERE id=? AND emailVerified=1', [enrollment.user_id], tx)) fail(409, 'VERIFIED_LEARNER_REQUIRED', 'The learner must verify their email');
    if (enrollment.status !== 'pending_access') fail(409, 'INVALID_STATE', 'Only pending enrollment can be activated');
    await execute("UPDATE enrollments SET status='active' WHERE id=?", [id], tx);
    await audit(actor.id, 'learning.enrollment_activated', id, reason, enrollment.organization_id, tx);
    return { enrollment: await enrollmentSummary(await enrollmentRow(id, tx), tx) };
  });
}
