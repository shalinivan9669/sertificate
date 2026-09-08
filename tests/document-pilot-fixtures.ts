/** Local-only document operations pilot: no academic state is precompleted. */
import { resolve, basename } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { closeDb, execute, getDb } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import type { AppUser } from '../server/utils/auth';

const databasePath = resolve(process.env.OT_DATABASE_PATH || '');
if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.TURSO_DATABASE_URL || basename(databasePath) !== 'document-pilot.sqlite' || !databasePath.includes('ot-document-pilot-')) {
  throw new Error('Explicit isolated local document pilot database required; remote and ordinary databases forbidden.');
}
const password = 'Synthetic-document-pilot-2026!';
const users = Object.fromEntries(['admin', 'issuer', 'reviewer', 'instructor', 'learner', 'other'].map(role => [role, {
  id: `document-pilot-${role}`, name: role === 'learner' ? 'ТЕСТОВЫЙ СЛУШАТЕЛЬ - НЕДЕЙСТВИТЕЛЬНО' : `TEST ONLY ${role}`,
  email: `document-pilot-${role}@example.test`, role: ['instructor', 'other'].includes(role) ? 'learner' : role, password,
}]));
const actor = (role: string): AppUser => ({ ...users[role]!, role: role as AppUser['role'], twoFactorEnabled: true, mfaVerifiedAt: Date.now() });
const data: ProgramData = {
  title: 'ТЕСТ ДОКУМЕНТОВ - НЕ УЧЕБНАЯ ПРОГРАММА', language: 'ru', audience: 'Synthetic local users only', prerequisites: '', outcomes: 'Exercise document workflow only', limitations: 'NO ACADEMIC OR LEGAL VALIDITY',
  format: 'Synthetic test', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'TEST PDF - NO VALIDITY', support: 'Test support', sourceRefs: ['tests/document-pilot-fixtures.ts'], reviewedAt: new Date().toISOString().slice(0, 10),
  modules: [{ id: 'pilot-module', title: 'TEST ONLY material and practice', lessons: [
    { id: 'pilot-text', title: 'TEST ONLY text lesson', kind: 'text', required: true, body: 'Synthetic local pilot. Choose the answer TEST CORRECT. This material proves no competence.', media: [] },
    { id: 'pilot-practice', title: 'TEST ONLY instructor practice', kind: 'practice', required: true, body: 'A real instructor UI action is required for this synthetic exercise.', media: [] },
  ] }],
  assessment: { durationMinutes: 15, maxAttempts: 3, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
  questions: [{ id: 'pilot-question', text: 'TEST ONLY synthetic question', topic: 'TEST topic', options: [{ id: 'wrong', text: 'TEST WRONG' }, { id: 'right', text: 'TEST CORRECT' }], correctOptionIds: ['right'] }],
};
try {
  await getDb();
  const hash = await hashPassword(password);
  for (const user of Object.values(users)) {
    await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [user.id, user.name, user.email, user.role, Date.now(), Date.now()]);
    await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [user.id + '-account', user.id, 'credential', user.id, hash, Date.now(), Date.now()]);
  }
  const draft = (await createVersion(actor('admin'), 'ohrana-truda', data)).version;
  const review = (await reviewVersion(actor('admin'), draft.id, draft.revision)).version;
  const version = (await publishVersion(actor('reviewer'), review.id, review.revision, 'SYNTHETIC LOCAL PILOT ONLY - no approved training')).version;
  await mkdir('.data', { recursive: true });
  const output = resolve('.data/document-pilot-fixture.json');
  await writeFile(output, JSON.stringify({ notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath, users, programId: 'ohrana-truda', versionId: version.id, practiceLessonId: 'pilot-practice', baseUrl: 'http://127.0.0.1:3103' }, null, 2));
  console.log('Pilot fixture created; users and published synthetic version only. No enrollment, progress, attempt, template or credential exists.');
} finally { await closeDb(); }
