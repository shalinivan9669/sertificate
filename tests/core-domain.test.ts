import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { closeDb, execute, getDb, migrate, queryOne, withTransaction } from '../server/db';
import { catalogProgram, catalogPrograms, createVersion, getAuthoringGuide, publishVersion, reviewVersion, updateVersion, validateProgramData, type ProgramData } from '../server/services/catalog';
import { completeLesson, confirmPractice, createEnrollment, enrollmentDetails, getLesson, myEnrollments } from '../server/services/learning';
import { expireDueAttempts, getAttempt, saveAnswer, startAttempt, submitAttempt } from '../server/services/assessment';
import { assertRole, type AppUser } from '../server/utils/auth';
import { courseDirections, legacyCourseDirections, resolveCourseDirection, safeReturnTo } from '../shared/course-registry';
import { sourceProducts } from '../shared/source-products';
import { bootstrapAdministrator, changeRole, listUsers } from '../server/services/core-administration';

let directory: string;
const editor: AppUser = { id: 'test-editor', name: 'Test Editor', email: 'editor@example.test', role: 'editor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { ...editor, id: 'test-reviewer', email: 'reviewer@example.test', role: 'reviewer' };
const instructor: AppUser = { ...editor, id: 'test-instructor', email: 'instructor@example.test', role: 'instructor' };
const learner: AppUser = { ...editor, id: 'test-learner', email: 'learner@example.test', role: 'learner', twoFactorEnabled: false, mfaVerifiedAt: null };
const other: AppUser = { ...learner, id: 'test-other', email: 'other@example.test' };

/** Fictional, isolated test fixture; no application seed imports this content. */
function fixture(practice = false): ProgramData {
  return {
    title: 'ISOLATED TEST PROGRAM — NOT TRAINING CONTENT', language: 'ru', audience: 'Test accounts', prerequisites: '', outcomes: 'Test invariant',
    limitations: 'Test only', format: 'Test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free',
    documentDescription: 'No document', support: 'Test support', sourceRefs: ['Isolated test fixture'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'module-one', title: 'Test module', lessons: [{ id: 'lesson-one', title: 'Test lesson', kind: 'text', required: true, body: 'Isolated test text.', media: [] }, ...(practice ? [{ id: 'practice-one', title: 'Test practice', kind: 'practice' as const, required: true, body: 'Instructor confirms test evidence.', media: [] }] : [])] }],
    assessment: { durationMinutes: 1, maxAttempts: 2, passPercent: 100, questionCount: 2, retakeDelayMinutes: 0 },
    questions: [{ id: 'q1', text: 'Test question 1', topic: 'Topic A', options: [{ id: 'a', text: 'Wrong A' }, { id: 'b', text: 'Correct B' }], correctOptionIds: ['b'] }, { id: 'q2', text: 'Test question 2', topic: 'Topic B', options: [{ id: 'a', text: 'Wrong A' }, { id: 'b', text: 'Correct B' }], correctOptionIds: ['b'] }],
  };
}
async function published(practice = false) {
  const created = await createVersion(editor, 'ohrana-truda', fixture(practice));
  const review = await reviewVersion(editor, created.version.id, created.version.revision);
  return (await publishVersion(reviewer, review.version.id, review.version.revision, 'Isolated integration test review')).version;
}
async function assigned(practice = false) { const version = await published(practice); const { enrollment } = await createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true); return { version, enrollment }; }
function rejectsCode(promise: Promise<unknown>, code: string) { return assert.rejects(promise, (error: any) => error?.data?.code === code); }

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-core-test-'));
  process.env.OT_DATABASE_PATH = join(directory, 'test.sqlite'); process.env.NODE_ENV = 'test'; delete process.env.VERCEL; delete process.env.TURSO_DATABASE_URL;
  await getDb();
  for (const actor of [editor, reviewer, instructor, learner, other]) await execute('INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES (?,?,?,1,?,?,?,?)', [actor.id, actor.name, actor.email, Date.now(), Date.now(), actor.role, Number(actor.twoFactorEnabled)]);
});
after(async () => { await closeDb(); await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

test('T031 PDF inventory extends 9 preserved legacy directions to 20 with owner-approved display rates and no invented learning', async () => {
  assert.equal(legacyCourseDirections.length, 9); assert.deepEqual(courseDirections.slice(0, 9), [...legacyCourseDirections]);
  assert.equal(sourceProducts.length, 16); assert.equal(courseDirections.length, 20); assert.equal(new Set(courseDirections.map(direction => direction.id)).size, 20);
  const { programs } = await catalogPrograms(); assert.equal(programs.length, 20); assert.ok(programs.every((entry) => entry.versions.length === 0 && entry.availability === 'consultation'));
  assert.equal(programs.filter(program => program.sourceProduct).length, 16);
  assert.equal(programs.filter(program => program.sourceProduct && program.pricing.basis === 'organization').length, 4);
  assert.ok(programs.filter(program => program.sourceProduct).every(program => program.sourceProduct!.guidance.kind === 'marketing_orientation'));
  const expectedSourceRates: Record<string, number> = {
    'kbpk-01': 30_630_000, 'kbpk-02': 2_500_000, 'kbpk-03': 30_630_000, 'kbpk-04': 30_630_000,
    'kbpk-05': 30_630_000, 'kbpk-06': 2_500_000, 'kbpk-07': 2_500_000, 'kbpk-08': 2_500_000,
    'kbpk-09': 2_500_000, 'kbpk-10': 9_500_000, 'kbpk-11': 9_500_000, 'kbpk-12': 9_500_000,
    'kbpk-13': 9_500_000, 'kbpk-14': 7_000_000, 'kbpk-15': 6_000_000, 'kbpk-16': 10_000_000,
  };
  assert.equal(programs.filter(program => program.pricing.mode === 'published').length, 16);
  assert.equal(programs.filter(program => program.pricing.mode === 'request').length, 4);
  for (const program of programs) {
    assert.equal(program.pricing.currency, 'KZT');
    if (program.sourceProduct) {
      assert.ok(Object.hasOwn(expectedSourceRates, program.sourceProduct.id));
      assert.equal(program.pricing.mode, 'published');
      assert.equal(program.pricing.amountMinor, expectedSourceRates[program.sourceProduct.id], program.sourceProduct.id);
      assert.deepEqual(program.pricing.taxLabel, { ru: 'Без НДС', kk: 'ҚҚС-сыз' });
      const organizationRate = ['kbpk-01', 'kbpk-03', 'kbpk-04', 'kbpk-05'].includes(program.sourceProduct.id);
      assert.equal(program.pricing.basis, organizationRate ? 'organization' : 'learner');
      assert.deepEqual(program.pricing.basisLabel, organizationRate
        ? { ru: 'За организацию', kk: 'Ұйым үшін' }
        : { ru: 'За одного слушателя', kk: 'Бір тыңдаушы үшін' });
    } else {
      assert.equal(program.pricing.mode, 'request'); assert.equal(program.pricing.amountMinor, null);
      assert.equal(program.pricing.basis, null);
      assert.deepEqual(program.pricing.label, { ru: 'Стоимость по запросу', kk: 'Бағасы сұрау бойынша' });
      assert.deepEqual(program.pricing.taxLabel, { ru: '', kk: '' });
    }
  }
  assert.equal(programs.find(program => program.id === 'antiterroristicheskaya-podgotovka')!.pricing.label.ru.replace(/\s/g, ' '), '306 300 ₸');
  assert.equal(programs.find(program => program.id === 'pervaya-pomoshch')!.pricing.label.kk.replace(/\s/g, ' '), '25 000 ₸');
  const publicData = JSON.stringify(programs); for (const field of ['amountKzt', 'rateTextRaw', 'sourceDescriptionRaw', 'standardAsWritten', 'correctOptionIds']) assert.ok(!publicData.includes(field), field);
  for (const source of sourceProducts) assert.equal(source.publicPrice, null);
  assert.equal(programs.find(program => program.id === 'antiterroristicheskaya-podgotovka')!.pricing.basis, 'organization');
  assert.equal(programs.find(program => program.id === 'antiterroristicheskaya-podgotovka')!.publicPath, '/courses/antiterroristicheskaya-podgotovka');
  assert.equal((await catalogProgram('iso-9001')).program.publicPath, '/courses/iso-9001');
  assert.equal((await catalogProgram('ohrana-truda')).program.publicPath, '/ohrana-truda');
  assert.equal(programs.find(program => program.id === 'pervaya-pomoshch')!.pricing.basis, 'learner');
  assert.equal((await catalogProgram('labor-safety')).program.id, 'ohrana-truda');
  assert.equal((await catalogProgram('industrial-safety')).program.id, 'promyshlennaya-bezopasnost');
  assert.equal((await catalogProgram('fire-safety')).program.id, 'ptm');
  assert.equal(resolveCourseDirection('iso-45001'), undefined);
  await rejectsCode(catalogProgram('not-a-real-program'), 'PROGRAM_NOT_FOUND');
});

test('source metadata migration is idempotent and preserves newer program records', async () => {
  const newerTitle = JSON.stringify({ ru: 'Reviewed newer catalog label', kk: 'Жаңартылған атау' });
  await execute('UPDATE programs SET title_json=? WHERE id=?', [newerTitle, 'iso-9001']);
  await migrate(await getDb());
  assert.equal((await queryOne('SELECT COUNT(*) n FROM programs'))!.n, 20);
  assert.equal((await queryOne('SELECT title_json FROM programs WHERE id=?', ['iso-9001']))!.title_json, newerTitle);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM program_versions'))!.n, 0);
});

test('authoring guide uses source provenance and missing-field checklist without creating fake content', async () => {
  await rejectsCode(getAuthoringGuide(learner, 'menedzhment-ohrany-zdorovya'), 'FORBIDDEN');
  await rejectsCode(getAuthoringGuide({ ...editor, mfaVerifiedAt: null }, 'menedzhment-ohrany-zdorovya'), 'MFA_REQUIRED');
  const { guide } = await getAuthoringGuide(editor, 'menedzhment-ohrany-zdorovya');
  assert.equal(guide.readiness.canPublish, false); assert.equal(guide.readiness.reason, 'SOURCE_IS_SERVICE_INVENTORY');
  assert.equal(guide.source?.sourcePage, 2); assert.equal(guide.source?.standardAsWritten, 'ISO 14001');
  assert.ok(guide.source?.clarifications.includes('source_standard_scope_mismatch' as never));
  for (const field of ['modules', 'questions', 'durationHours', 'assessment', 'sourceRefs']) assert.ok(guide.missingFields.includes(field));
  assert.ok(guide.fields.every(field => field.provided === ['title', 'billingBasis'].includes(field.path)));
  assert.equal(guide.fields.find(field => field.path === 'billingBasis')!.value, 'learner');
  assert.equal(guide.pricing.mode, 'published'); assert.equal(guide.pricing.amountMinor, 10_000_000);
  assert.equal(guide.pricing.basis, 'learner'); assert.deepEqual(guide.pricing.taxLabel, { ru: 'Без НДС', kk: 'ҚҚС-сыз' });
  assert.ok(!JSON.stringify(guide).includes('ISO 45001'));
  assert.equal((await queryOne('SELECT COUNT(*) n FROM program_versions'))!.n, 0);
  assert.equal((await catalogProgram('menedzhment-ohrany-zdorovya')).program.versions.length, 0);
});

test('billing basis defaults for legacy content and rejects unknown modes without changing approved versions', () => {
  assert.equal(validateProgramData(fixture()).billingBasis, 'learner');
  assert.equal(validateProgramData({ ...fixture(), billingBasis: 'organization' }).billingBasis, 'organization');
  assert.throws(() => validateProgramData({ ...fixture(), billingBasis: 'organization-per-person' }), (error: any) => error.data.code === 'INVALID_CONTENT');
});

test('organization-billed free versions cannot bypass corporate assignment through self-enrollment', async () => {
  const draft = (await createVersion(editor, 'antiterroristicheskaya-podgotovka', { ...fixture(), billingBasis: 'organization' })).version;
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  const version = (await publishVersion(reviewer, review.id, review.revision, 'Isolated corporate free program approval')).version;
  await rejectsCode(createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true), 'ORGANIZATION_ASSIGNMENT_REQUIRED');
  assert.equal((await queryOne('SELECT COUNT(*) n FROM enrollments WHERE version_id=?', [version.id]))!.n, 0);
});
test('T009 internal return paths cannot become external destinations', () => {
  for (const url of ['https://evil.test', '//evil.test', '/%2f/evil.test', '/%252f%252fevil.test', '/\\evil.test', '/learn/../../evil', '/api/auth/evil', '/learn/%0Aevil']) assert.equal(safeReturnTo(url), '/account', url);
  assert.equal(safeReturnTo('/kk/learn/enrollment-one?lesson=a'), '/kk/learn/enrollment-one?lesson=a');
});
test('T022/T026 role authorization requires a verified second factor for the current session', () => {
  assert.throws(() => assertRole(learner, ['editor']), (error: any) => error.data.code === 'FORBIDDEN');
  assert.throws(() => assertRole({ ...editor, mfaVerifiedAt: null }, ['editor']), (error: any) => error.data.code === 'MFA_REQUIRED');
  assert.throws(() => assertRole({ ...editor, mfaVerifiedAt: Date.now() - 13 * 3600000 }, ['editor']), (error: any) => error.data.code === 'MFA_REQUIRED');
});
test('T030/T074 drafts cannot enroll; authors cannot approve; published version immutable', async () => {
  const draft = (await createVersion(editor, 'ptm', fixture())).version;
  await rejectsCode(createEnrollment(learner, { userId: learner.id, versionId: draft.id }, randomUUID(), true), 'VERSION_NOT_PUBLISHED');
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  await rejectsCode(publishVersion({ ...editor, role: 'admin' }, review.id, review.revision, 'Self review'), 'SEPARATE_REVIEWER_REQUIRED');
  const publication = (await publishVersion(reviewer, review.id, review.revision, 'Independent review')).version;
  await rejectsCode(updateVersion(editor, publication.id, publication.revision, fixture()), 'VERSION_IMMUTABLE');
  await assert.rejects(execute('UPDATE program_versions SET data_json=? WHERE id=?', ['{}', publication.id]), /immutable/);
});
test('T024/T032/T033/T034 new progress is zero; owner isolation; completion persists once', async () => {
  const { enrollment } = await assigned();
  assert.equal(enrollment.progress.percent, 0);
  await rejectsCode(getLesson(other, enrollment.id, 'lesson-one'), 'ENROLLMENT_NOT_FOUND');
  const first = await completeLesson(learner, enrollment.id, 'lesson-one', 0); const retry = await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  assert.equal(first.progress.percent, 100); assert.equal(retry.progress.percent, 100);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM audit_events WHERE action=? AND target=?', ['learning.lesson_completed', `${enrollment.id}/lesson-one`]))!.n, 1);
  assert.equal((await enrollmentDetails(learner, enrollment.id)).modules[0]!.lessons[0]!.completed, true);
});
test('T036/T038 practical training requires another authorized instructor with evidence', async () => {
  const { enrollment } = await assigned(true);
  await rejectsCode(startAttempt(learner, enrollment.id, randomUUID()), 'ASSESSMENT_NOT_ELIGIBLE');
  await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  await rejectsCode(completeLesson(learner, enrollment.id, 'practice-one', 0), 'INSTRUCTOR_CONFIRMATION_REQUIRED');
  await rejectsCode(confirmPractice({ ...learner, role: 'instructor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() }, enrollment.id, 'practice-one', 'Evidence', 'Reason'), 'SELF_CONFIRMATION_FORBIDDEN');
  await confirmPractice(instructor, enrollment.id, 'practice-one', 'Isolated instructor attendance record', 'Test practice completed');
  assert.equal((await enrollmentDetails(learner, enrollment.id)).eligibility.eligible, true);
});
test('T037 assigned material remains pinned when a later edition is published', async () => {
  const { enrollment, version } = await assigned(); await published();
  const detail = await enrollmentDetails(learner, enrollment.id); assert.equal(detail.versionId, version.id);
});
test('T039/T040/T041 question keys never leave server; form stable; concurrent revision conflict explicit', async () => {
  const { enrollment } = await assigned(); await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  const attempt = await startAttempt(learner, enrollment.id, 'stable-key');
  assert.deepEqual(await startAttempt(learner, enrollment.id, 'stable-key', Date.parse(attempt.serverTime)), attempt);
  const refreshed = await getAttempt(learner, attempt.id); assert.deepEqual(refreshed.questions, attempt.questions);
  const serialized = JSON.stringify(attempt); assert.ok(!serialized.includes('correctOptionIds')); assert.ok(!serialized.includes('answerIndex')); assert.ok(!serialized.includes('explanation'));
  const results = await Promise.allSettled([saveAnswer(learner, attempt.id, 'q1', ['b'], 0), saveAnswer(learner, attempt.id, 'q1', ['a'], 0)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1); assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.data.code === 'REVISION_CONFLICT').length, 1);
  await rejectsCode(getAttempt(other, attempt.id), 'ATTEMPT_NOT_FOUND');
});
test('T042/T043 late answers are rejected and server expiry commits without client submission', async () => {
  const { enrollment } = await assigned(); await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  const attempt = await startAttempt(learner, enrollment.id, randomUUID());
  await rejectsCode(saveAnswer(learner, attempt.id, 'q1', ['b'], 0, Date.parse(attempt.deadlineAt) + 1), 'DEADLINE_EXCEEDED');
  assert.equal((await getAttempt(learner, attempt.id)).status, 'expired');
  const next = await startAttempt(learner, enrollment.id, randomUUID(), Date.parse(attempt.deadlineAt) + 1000);
  await expireDueAttempts(100, Date.parse(next.deadlineAt) + 1);
  assert.equal((await getAttempt(learner, next.id)).status, 'expired');
});
test('T044/T045/T046 concurrent submit produces one immutable failed result; A is not forced correct', async () => {
  const { enrollment } = await assigned(); await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  let attempt = await startAttempt(learner, enrollment.id, randomUUID());
  for (const question of attempt.questions) attempt = await saveAnswer(learner, attempt.id, question.id, ['a'], attempt.revision);
  const [first, second] = await Promise.all([submitAttempt(learner, attempt.id), submitAttempt(learner, attempt.id)]);
  assert.deepEqual(first.result, second.result); assert.equal(first.result?.score, 0); assert.equal(first.result?.pass, false);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM outbox WHERE type=? AND aggregate_id=?', ['assessment.graded', attempt.id]))!.n, 1);
  await rejectsCode(saveAnswer(learner, attempt.id, 'q1', ['b'], first.revision), 'ATTEMPT_FINISHED');
  await assert.rejects(execute('UPDATE attempts SET result_json=? WHERE id=?', ['{"pass":true}', attempt.id]), /immutable/);
});
test('T047 attempt limits and passed completion are enforced independently of cookies', async () => {
  const { enrollment } = await assigned(); await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  for (let index = 0; index < 2; index++) { const attempt = await startAttempt(learner, enrollment.id, randomUUID()); await submitAttempt(learner, attempt.id); }
  await rejectsCode(startAttempt(learner, enrollment.id, randomUUID()), 'ASSESSMENT_NOT_ELIGIBLE');
  const otherEnrollment = (await assigned()).enrollment; await completeLesson(learner, otherEnrollment.id, 'lesson-one', 0);
  let attempt = await startAttempt(learner, otherEnrollment.id, randomUUID());
  for (const question of attempt.questions) attempt = await saveAnswer(learner, attempt.id, question.id, ['b'], attempt.revision);
  assert.equal((await submitAttempt(learner, attempt.id)).result?.pass, true);
  assert.equal((await enrollmentDetails(learner, otherEnrollment.id)).status, 'completed');
});
test('draft preserves unknown hours while review and publication require an approved duration', async () => {
  const data = fixture(); data.durationHours = null;
  const created = (await createVersion(editor, 'ohrana-truda', data)).version;
  assert.equal(created.data.durationHours, null);
  assert.equal(JSON.parse((await queryOne('SELECT data_json FROM program_versions WHERE id=?', [created.id]))!.data_json).durationHours, null);
  await rejectsCode(reviewVersion(editor, created.id, created.revision), 'PUBLICATION_INCOMPLETE');
  assert.equal((await queryOne('SELECT status FROM program_versions WHERE id=?', [created.id]))!.status, 'draft');
  data.durationHours = 2;
  const updated = (await updateVersion(editor, created.id, created.revision, data)).version;
  const reviewed = (await reviewVersion(editor, updated.id, updated.revision)).version;
  const published = (await publishVersion(reviewer, reviewed.id, reviewed.revision, 'Synthetic review confirms the explicit test duration')).version;
  assert.equal(published.data.durationHours, 2);
  assert.equal(published.status, 'published');
});

test('T078 content is plain text, and active SVG/HTML media are rejected', () => {
  const data = fixture(); data.modules[0]!.lessons[0]!.body = '<script>alert(1)</script>';
  assert.equal(validateProgramData(data).modules[0]!.lessons[0]!.body, '<script>alert(1)</script>');
  data.modules[0]!.lessons[0]!.media = [{ kind: 'image', url: 'https://evil.test/exploit.svg', alt: 'Image', transcript: '' }];
  assert.throws(() => validateProgramData(data), (error: any) => error.data.code === 'INVALID_CONTENT');
});
test('B27 published media retains accessible alternatives and refuses review without them', async () => {
  const previousHosts = process.env.OT_CONTENT_HOSTS;
  process.env.OT_CONTENT_HOSTS = 'learning-assets.example.test';
  try {
    const data = fixture();
    const media = data.modules[0]!.lessons[0]!.media;
    media.push(
      { kind: 'image', url: 'https://learning-assets.example.test/checklist.png', alt: 'A three-step inspection checklist', transcript: '' },
      { kind: 'video', url: 'https://learning-assets.example.test/inspection.mp4', alt: 'Inspection demonstration', transcript: 'Step one: inspect the area.\nStep two: report the hazard.' },
      { kind: 'attachment', url: 'https://learning-assets.example.test/checklist.pdf', alt: 'Download the inspection checklist', transcript: '' },
    );
    const draft = (await createVersion(editor, 'ohrana-truda', data)).version;
    const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
    const version = (await publishVersion(reviewer, review.id, review.revision, 'Synthetic accessible-media fixture only')).version;
    const { enrollment } = await createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true);
    const lesson = await getLesson(learner, enrollment.id, 'lesson-one');
    assert.deepEqual(lesson.lesson.media, media);
    assert.equal(lesson.progress.completed, false, 'Merely requesting media cannot count as completion');
    assert.equal(JSON.stringify(lesson).includes('correctOptionIds'), false);
    for (const missing of ['alt', 'transcript'] as const) {
      const incomplete = structuredClone(data);
      incomplete.modules[0]!.lessons[0]!.media[missing === 'alt' ? 0 : 1]![missing] = '';
      const pending = (await createVersion(editor, 'ohrana-truda', incomplete)).version;
      await assert.rejects(reviewVersion(editor, pending.id, pending.revision));
      assert.equal((await queryOne('SELECT status FROM program_versions WHERE id=?', [pending.id]))!.status, 'draft');
    }
    const unapprovedHost = structuredClone(data);
    unapprovedHost.modules[0]!.lessons[0]!.media[0]!.url = 'https://unapproved.example.test/checklist.png';
    assert.throws(() => validateProgramData(unapprovedHost), (error: any) => error.data.code === 'INVALID_CONTENT');
  } finally {
    if (previousHosts === undefined) delete process.env.OT_CONTENT_HOSTS;
    else process.env.OT_CONTENT_HOSTS = previousHosts;
  }
});

test('T075 SQL audit is append-only and transactions roll back domain writes together', async () => {
  const count = (await queryOne('SELECT COUNT(*) n FROM audit_events'))!.n;
  await assert.rejects(withTransaction(async (tx) => { await execute('INSERT INTO audit_events (id,action,target,created_at) VALUES (?,?,?,?)', [randomUUID(), 'test.rollback', 'test', new Date().toISOString()], tx); throw new Error('rollback'); }));
  assert.equal((await queryOne('SELECT COUNT(*) n FROM audit_events'))!.n, count);
  await assert.rejects(execute('DELETE FROM audit_events'), /append-only/);
});
test('T017/T075 owner bootstrap is one-time and privileged role changes revoke prior assurance', async () => {
  const first = await bootstrapAdministrator(other.email, 'Owner authorizes isolated test administrator');
  assert.equal(first.userId, other.id);
  await rejectsCode(bootstrapAdministrator(learner.email, 'Second bootstrap must be denied'), 'ADMIN_ALREADY_EXISTS');
  const administrator: AppUser = { ...other, role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
  await rejectsCode(changeRole(administrator, other.id, 'learner', 'Self-demotion must be denied'), 'SELF_ROLE_CHANGE_FORBIDDEN');
  await execute('INSERT INTO session (id,userId,token,expiresAt,createdAt,updatedAt,mfaVerifiedAt) VALUES (?,?,?,?,?,?,?)', ['role-session', editor.id, 'synthetic-role-session-token', Date.now() + 3600000, Date.now(), Date.now(), Date.now()]);
  await changeRole(administrator, editor.id, 'finance', 'Owner authorizes finance test role');
  assert.equal((await queryOne('SELECT role FROM "user" WHERE id=?', [editor.id]))!.role, 'finance');
  assert.equal((await queryOne('SELECT mfaVerifiedAt FROM session WHERE id=?', ['role-session']))!.mfaVerifiedAt, null);
  assert.equal((await listUsers(administrator, 'editor@example.test')).users.length, 1);
  assert.equal((await listUsers(administrator, 'unlikely%wildcard')).users.length, 0);
});
test('cabinet uses two database queries for many assignments and preserves pinned version progress', async () => {
  const { enrollment, version } = await assigned(); await completeLesson(learner, enrollment.id, 'lesson-one', 0);
  const client = await getDb(); let statements = 0;
  const counted = new Proxy(client, { get(target, property, receiver) { if (property === 'execute') return (...args: Parameters<typeof client.execute>) => { statements++; return client.execute(...args); }; return Reflect.get(target, property, receiver); } });
  const cabinet = await myEnrollments(learner, counted);
  assert.ok(cabinet.enrollments.length > 5); assert.equal(statements, 2);
  const item = cabinet.enrollments.find((item) => item.id === enrollment.id)!;
  assert.equal(item.versionId, version.id); assert.equal(item.progress.percent, 100);
  assert.ok(!JSON.stringify(cabinet).includes('correctOptionIds'));
});
