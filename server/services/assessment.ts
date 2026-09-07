import { randomInt, randomUUID } from 'node:crypto';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { type AppUser } from '../utils/auth';
import { entityId, fail, integer, payloadHash, textValue } from '../utils/validation';
import { getVersion, type ProgramData, type Question } from './catalog';
import { assertAccess, eligibility, enrollmentRow, ownedEnrollment } from './learning';

type AttemptRow = { id: string; enrollment_id: string; status: 'in_progress' | 'graded' | 'expired' | 'voided'; deadline_at: string; revision: number; form_json: string; answers_json: string; result_json: string | null; created_at: string; submitted_at: string | null };
type Form = { versionId: string; questions: Question[]; rules: ProgramData['assessment'] };
export type AssessmentResult = { score: number; pass: boolean; correct: number; total: number; gradedAt: string; topics: { topic: string; correct: number; total: number }[] };

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index--) { const other = randomInt(index + 1); [result[index], result[other]] = [result[other]!, result[index]!]; }
  return result;
}
function sameSelections(a: string[], b: string[]) { return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]); }

export function grade(form: Form, answers: Record<string, string[]>, now: number): AssessmentResult {
  let correct = 0; const topics = new Map<string, { topic: string; correct: number; total: number }>();
  for (const question of form.questions) {
    const passed = sameSelections(answers[question.id] || [], question.correctOptionIds);
    if (passed) correct++;
    const topic = topics.get(question.topic) || { topic: question.topic, correct: 0, total: 0 };
    topic.total++; if (passed) topic.correct++; topics.set(question.topic, topic);
  }
  const total = form.questions.length; const exactScore = total ? correct / total * 100 : 0;
  return { score: Math.round(exactScore * 100) / 100, pass: total > 0 && exactScore >= form.rules.passPercent, correct, total, gradedAt: new Date(now).toISOString(), topics: [...topics.values()] };
}

async function attemptRow(id: string, db?: Db): Promise<AttemptRow> {
  const row = await queryOne<AttemptRow>('SELECT * FROM attempts WHERE id=?', [id], db);
  if (!row) fail(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found'); return row;
}
async function ownedAttempt(actor: AppUser, id: string, db?: Db) {
  const row = await attemptRow(id, db);
  const enrollment = await enrollmentRow(row.enrollment_id, db);
  if (enrollment.user_id !== actor.id) fail(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found');
  return { row, enrollment };
}

function attemptDto(row: AttemptRow, now = Date.now()) {
  const form: Form = JSON.parse(row.form_json);
  return {
    id: row.id, enrollmentId: row.enrollment_id, status: row.status, startedAt: row.created_at,
    deadlineAt: row.deadline_at, serverTime: new Date(now).toISOString(), revision: row.revision,
    questions: form.questions.map((question) => ({ id: question.id, text: question.text, options: question.options.map((option) => ({ id: option.id, text: option.text })) })),
    answers: JSON.parse(row.answers_json) as Record<string, string[]>, result: row.result_json ? JSON.parse(row.result_json) as AssessmentResult : null,
  };
}

async function finalize(row: AttemptRow, db: Db, now = Date.now()) {
  if (row.status !== 'in_progress') return row;
  const result = grade(JSON.parse(row.form_json), JSON.parse(row.answers_json), now);
  const expired = Date.parse(row.deadline_at) <= now;
  const submittedAt = expired ? row.deadline_at : new Date(now).toISOString();
  const changed = await execute("UPDATE attempts SET status=?,result_json=?,submitted_at=?,revision=revision+1 WHERE id=? AND status='in_progress'", [expired ? 'expired' : 'graded', JSON.stringify(result), submittedAt, row.id], db);
  if (changed.rowsAffected) {
    const enrollment = await enrollmentRow(row.enrollment_id, db);
    if (result.pass) await execute("UPDATE enrollments SET status='completed' WHERE id=? AND status IN ('active','learning_complete','assessment_eligible')", [row.enrollment_id], db);
    await audit(enrollment.user_id, expired ? 'assessment.expired' : 'assessment.submitted', row.id, '', enrollment.organization_id, db);
    await enqueue('assessment.graded', row.id, { attemptId: row.id, enrollmentId: row.enrollment_id, pass: result.pass }, db);
  }
  return attemptRow(row.id, db);
}

/** Runs from a scheduled/manual worker and lazily at reads; browser execution is never required. */
export async function expireDueAttempts(limit = 100, now = Date.now()) {
  integer(limit, 'limit', 1, 500);
  const due = await queryAll<{ id: string }>("SELECT id FROM attempts WHERE status='in_progress' AND deadline_at<=? ORDER BY deadline_at LIMIT ?", [new Date(now).toISOString(), limit]);
  let expired = 0;
  for (const candidate of due) {
    await withTransaction(async (tx) => {
      const row = await attemptRow(candidate.id, tx);
      if (row.status === 'in_progress' && Date.parse(row.deadline_at) <= now) { await finalize(row, tx, now); expired++; }
    });
  }
  return { expired };
}

export async function getAttempt(actor: AppUser, id: string, now = Date.now()) {
  return withTransaction(async (tx) => {
    const { row } = await ownedAttempt(actor, id, tx);
    return attemptDto(row.status === 'in_progress' && Date.parse(row.deadline_at) <= now ? await finalize(row, tx, now) : row, now);
  });
}

export async function startAttempt(actor: AppUser, enrollmentId: string, key: string, now = Date.now()) {
  textValue(key, 'Idempotency-Key', 128);
  const scope = `attempt:${actor.id}:${enrollmentId}`; const hash = payloadHash({ enrollmentId });
  await ownedEnrollment(actor, enrollmentId);
  // Expiry commits before an eligibility error so denial cannot roll back a server deadline.
  const active = await queryOne<{ id: string; deadline_at: string }>("SELECT id,deadline_at FROM attempts WHERE enrollment_id=? AND status='in_progress'", [enrollmentId]);
  if (active && Date.parse(active.deadline_at) <= now) await getAttempt(actor, active.id, now);
  return withTransaction(async (tx) => {
    const enrollment = await ownedEnrollment(actor, enrollmentId, tx);
    const idempotent = await queryOne('SELECT resource_id FROM idempotency_keys WHERE scope=? AND key=?', [scope, key], tx);
    if (idempotent) return attemptDto(await attemptRow(idempotent.resource_id, tx), now);
    assertAccess(enrollment, now);
    const existing = await queryOne<AttemptRow>("SELECT * FROM attempts WHERE enrollment_id=? AND status='in_progress'", [enrollmentId], tx);
    if (existing) {
      await execute('INSERT INTO idempotency_keys VALUES (?,?,?,?,?)', [scope, key, hash, existing.id, new Date(now).toISOString()], tx);
      return attemptDto(existing, now);
    }
    const version = await getVersion(enrollment.version_id, tx); const data: ProgramData = JSON.parse(version.data_json);
    if (version.status !== 'published') fail(409, 'VERSION_NOT_PUBLISHED', 'Attempt requires a published version');
    const permission = await eligibility(enrollment, data, tx, now);
    if (!permission.eligible) fail(403, 'ASSESSMENT_NOT_ELIGIBLE', permission.reasons.join(', '));
    const questions = shuffle(data.questions).slice(0, data.assessment.questionCount).map((question) => ({ ...question, options: shuffle(question.options) }));
    if (questions.length !== data.assessment.questionCount) fail(409, 'ASSESSMENT_UNAVAILABLE', 'Approved question bank is incomplete');
    const form: Form = { versionId: version.id, questions, rules: data.assessment };
    const id = randomUUID(); const deadline = new Date(now + data.assessment.durationMinutes * 60000).toISOString();
    await execute('INSERT INTO attempts (id,enrollment_id,deadline_at,form_json,created_at) VALUES (?,?,?,?,?)', [id, enrollmentId, deadline, JSON.stringify(form), new Date(now).toISOString()], tx);
    await execute('INSERT INTO idempotency_keys VALUES (?,?,?,?,?)', [scope, key, hash, id, new Date(now).toISOString()], tx);
    await audit(actor.id, 'assessment.started', id, '', enrollment.organization_id, tx);
    return attemptDto(await attemptRow(id, tx), now);
  });
}

export async function saveAnswer(actor: AppUser, id: string, questionId: string, selectedOptionIds: unknown, revision: number, now = Date.now()) {
  integer(revision, 'revision'); entityId(questionId, 'questionId');
  if (!Array.isArray(selectedOptionIds) || selectedOptionIds.length > 10) fail(400, 'INVALID_ANSWER', 'Selected options must be an array');
  const selected = selectedOptionIds.map((option) => entityId(option, 'optionId'));
  if (new Set(selected).size !== selected.length) fail(400, 'INVALID_ANSWER', 'Duplicate selected options');
  const response = await withTransaction(async (tx) => {
    const { row, enrollment } = await ownedAttempt(actor, id, tx);
    if (row.status !== 'in_progress') return { error: 'ATTEMPT_FINISHED' } as const;
    if (Date.parse(row.deadline_at) <= now) { await finalize(row, tx, now); return { error: 'DEADLINE_EXCEEDED' } as const; }
    assertAccess(enrollment, now);
    if (row.revision !== revision) fail(409, 'REVISION_CONFLICT', 'A newer answer revision exists; reload before changing your answer');
    const form: Form = JSON.parse(row.form_json); const question = form.questions.find((question) => question.id === questionId);
    if (!question || selected.some((optionId) => !question.options.some((option) => option.id === optionId))) fail(400, 'INVALID_ANSWER', 'Question or selected option does not belong to this attempt');
    const answers: Record<string, string[]> = JSON.parse(row.answers_json);
    if (!sameSelections(answers[questionId] || [], selected)) {
      answers[questionId] = selected;
      await execute("UPDATE attempts SET answers_json=?,revision=revision+1 WHERE id=? AND status='in_progress' AND revision=?", [JSON.stringify(answers), id, revision], tx);
    }
    return { data: attemptDto(await attemptRow(id, tx), now) } as const;
  });
  if ('error' in response) fail(409, response.error!, response.error === 'DEADLINE_EXCEEDED' ? 'Server deadline exceeded' : 'The submitted attempt is immutable');
  return response.data;
}

export async function submitAttempt(actor: AppUser, id: string, now = Date.now()) {
  return withTransaction(async (tx) => {
    const { row } = await ownedAttempt(actor, id, tx);
    return attemptDto(await finalize(row, tx, now), now);
  });
}
