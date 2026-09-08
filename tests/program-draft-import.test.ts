import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProgramDraftFile, PROGRAM_DRAFT_MAX_BYTES } from '../shared/program-draft-import';

function pack() {
  return { format: 'ot-center-program-draft-v1', programId: 'ohrana-truda', data: {
    title: 'SYNTHETIC IMPORT — NOT TRAINING CONTENT', language: 'ru', audience: 'Test accounts', prerequisites: '', outcomes: 'Test import integrity',
    limitations: 'Synthetic authoring fixture', format: 'Test', durationHours: null, priceMinor: null, currency: 'KZT', accessModel: 'manual',
    documentDescription: 'No document', support: 'Test', sourceRefs: ['https://example.test/source'], reviewedAt: '2026-09-08',
    modules: [{ id: 'module-one', title: 'Test module', lessons: [{ id: 'lesson-one', title: 'Test lesson', kind: 'text', required: true, body: 'Synthetic content', media: [] }] }],
    assessment: { durationMinutes: 10, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'question-one', text: 'Synthetic question', topic: 'Test', options: [{ id: 'first', text: 'Test option' }, { id: 'second', text: 'Other test option' }], correctOptionIds: ['second'] }],
  } };
}

test('draft import preserves lessons and server-only keys but discards inherited review approval', () => {
  const source = pack(); const before = JSON.stringify(source);
  const result = parseProgramDraftFile('\uFEFF' + before);
  assert.equal(result.data.durationHours, null); assert.equal(result.data.priceMinor, null);
  assert.equal(result.data.billingBasis, 'learner');
  assert.equal(result.data.reviewedAt, ''); assert.equal(result.lessonCount, 1); assert.equal(result.questionCount, 1);
  assert.deepEqual(result.data.questions, source.data.questions); assert.equal(JSON.stringify(source), before);
  source.programId = 'labor-safety'; assert.equal(parseProgramDraftFile(JSON.stringify(source)).programId, 'ohrana-truda');
});

test('draft import rejects version, approval, actor and unknown direction injection', () => {
  for (const field of ['id', 'status', 'createdBy', 'approvedBy', '__proto__']) {
    const source = JSON.stringify(pack());
    assert.throws(() => parseProgramDraftFile(source.slice(0, -1) + ',"' + field + '":"forged"}'), /PROGRAM_DRAFT_INVALID/);
  }
  const source = pack(); source.programId = 'unknown-direction';
  assert.throws(() => parseProgramDraftFile(JSON.stringify(source)), /PROGRAM_DRAFT_DIRECTION_UNKNOWN/);
});

test('draft import bounds UTF-8 size and rejects malformed nested data before opening editor', () => {
  assert.throws(() => parseProgramDraftFile('я'.repeat(PROGRAM_DRAFT_MAX_BYTES / 2 + 1)), /PROGRAM_DRAFT_TOO_LARGE/);
  assert.throws(() => parseProgramDraftFile('{'), /PROGRAM_DRAFT_INVALID/);
  const source = pack();
  for (const invalid of [null, [{ id: 'module', title: 'Bad', lessons: [null] }], [{ id: 'module', title: 'Bad', lessons: [{ id: 'x' }] }]]) {
    assert.throws(() => parseProgramDraftFile(JSON.stringify({ ...source, data: { ...source.data, modules: invalid } })), /PROGRAM_DRAFT_INVALID/);
  }
});

test('draft import rejects duplicate learning IDs and invalid answer references', () => {
  const duplicateLesson = pack(); duplicateLesson.data.modules[0]!.lessons.push({ ...duplicateLesson.data.modules[0]!.lessons[0]! });
  assert.throws(() => parseProgramDraftFile(JSON.stringify(duplicateLesson)), /PROGRAM_DRAFT_INVALID/);
  const invalidKey = pack(); invalidKey.data.questions[0]!.correctOptionIds = ['absent'];
  assert.throws(() => parseProgramDraftFile(JSON.stringify(invalidKey)), /PROGRAM_DRAFT_INVALID/);
  const duplicateOption = pack(); duplicateOption.data.questions[0]!.options[1]!.id = 'first';
  assert.throws(() => parseProgramDraftFile(JSON.stringify(duplicateOption)), /PROGRAM_DRAFT_INVALID/);
});
