/** Explicit local browser-test fixture. Never imported by application or production migration code. */
import { resolve, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { closeDb, execute, getDb, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { type AppUser } from '../server/utils/auth';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.TURSO_DATABASE_URL || basename(process.env.OT_DATABASE_PATH || '') !== 'e2e.sqlite') {
  throw new Error('Fixture requires NODE_ENV=test OT_ALLOW_TEST_SEED=1 and an explicit local OT_DATABASE_PATH ending in e2e.sqlite; remote databases are forbidden.');
}

const password = 'Isolated-browser-test-2026!';
const learner = { id: 'e2e-learner', email: 'browser-learner@example.test', name: 'Isolated Browser Learner', role: 'learner' };
const other = { id: 'e2e-other', email: 'browser-other@example.test', name: 'Isolated Other Learner', role: 'learner' };
const editor: AppUser = { id: 'e2e-editor', email: 'browser-editor@example.test', name: 'Isolated Editor', role: 'editor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { id: 'e2e-reviewer', email: 'browser-reviewer@example.test', name: 'Isolated Reviewer', role: 'reviewer', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const data: ProgramData = {
  title: '[TEST ONLY] Browser learning workflow', language: 'ru', audience: 'Synthetic test accounts', prerequisites: '', outcomes: 'Exercise application behavior only', limitations: 'Not approved learning content',
  format: 'Isolated test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'No document is issued for this test', support: 'Test support',
  sourceRefs: ['tests/e2e-fixtures.ts synthetic content'], reviewedAt: new Date().toISOString().slice(0, 10),
  modules: [{ id: 'e2e-module', title: 'Test module', lessons: [{ id: 'e2e-lesson', title: 'Test lesson', kind: 'text', required: true, body: 'This is synthetic browser-test material. It does not certify any occupational competence. For this test, choose the option with the text Correct test option.', media: [] }] }],
  assessment: { durationMinutes: 15, maxAttempts: 5, passPercent: 100, questionCount: 2, retakeDelayMinutes: 0 },
  questions: [1, 2].map((number) => ({ id: `e2e-q${number}`, text: `Synthetic test question ${number}`, topic: 'Test topic', options: [{ id: 'wrong', text: 'Incorrect test option' }, { id: 'correct', text: 'Correct test option' }], correctOptionIds: ['correct'] })),
};
try {
  await getDb();
  const hash = await hashPassword(password);
  for (const actor of [learner, other, editor, reviewer]) {
    await execute('INSERT OR IGNORE INTO "user" (id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES (?,?,?,1,?,0,?,?)', [actor.id, actor.name, actor.email, actor.role, Date.now(), Date.now()]);
    await execute('INSERT OR IGNORE INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', [`${actor.id}-account`, actor.id, 'credential', actor.id, hash, Date.now(), Date.now()]);
  }
  let versionId = (await queryOne("SELECT id FROM program_versions WHERE created_by=? AND status='published' ORDER BY version DESC LIMIT 1", [editor.id]))?.id;
  if (!versionId) {
    const draft = (await createVersion(editor, 'ohrana-truda', data)).version;
    const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
    versionId = (await publishVersion(reviewer, review.id, review.revision, 'Isolated browser test fixture')).version.id;
  }
  const output = { notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath: resolve(process.env.OT_DATABASE_PATH!), learner: { ...learner, password }, other: { ...other, password }, editor: { ...editor, password }, reviewer: { ...reviewer, password }, programId: 'ohrana-truda', versionId, lessonId: 'e2e-lesson' };
  const outputPath = resolve(process.cwd(), '.data/e2e-fixture.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2)); console.log(`Synthetic local fixture written: ${outputPath}`);
} finally { await closeDb(); }
