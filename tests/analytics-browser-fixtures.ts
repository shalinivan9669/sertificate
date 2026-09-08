/** Only accounts and synthetic published content. No analytics, enrollment or academic state is seeded. */
import { basename, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { closeDb, execute, getDb, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import type { AppUser } from '../server/utils/auth';

const databasePath = resolve(process.env.OT_DATABASE_PATH || '');
if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.TURSO_DATABASE_URL || basename(databasePath) !== 'e2e.sqlite' || !databasePath.includes('analytics-browser-') || process.env.OT_ANALYTICS_ENABLED !== '0') throw new Error('New isolated analytics-browser DB with collection disabled during fixture setup required');
const password = 'Synthetic-analytics-browser-2026!';
const users = {
  learner: { id: 'analytics-test-learner', role: 'learner', name: 'TEST ONLY ANALYTICS LEARNER', email: 'analytics-learner@example.test', password },
  admin: { id: 'analytics-test-admin', role: 'admin', name: 'TEST ONLY ANALYTICS ADMIN', email: 'analytics-admin@example.test', password },
  editor: { id: 'analytics-test-editor', role: 'editor', name: 'TEST ONLY ANALYTICS EDITOR', email: 'analytics-editor@example.test', password },
  reviewer: { id: 'analytics-test-reviewer', role: 'reviewer', name: 'TEST ONLY ANALYTICS REVIEWER', email: 'analytics-reviewer@example.test', password },
};
const author: AppUser = { ...users.editor, role: 'editor', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const reviewer: AppUser = { ...users.reviewer, role: 'reviewer', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const content: ProgramData = {
  title: 'TEST ONLY analytics lesson; no academic validity', language: 'ru', audience: 'Synthetic test users', prerequisites: '', outcomes: 'Exercise interface telemetry only', limitations: 'Not an approved curriculum',
  format: 'online', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', billingBasis: 'learner', documentDescription: 'No document will be issued', support: 'Synthetic support', sourceRefs: ['tests/analytics-browser-fixtures.ts'], reviewedAt: new Date().toISOString().slice(0, 10),
  modules: [{ id: 'analytics-module', title: 'TEST ONLY module', lessons: [{ id: 'analytics-lesson', title: 'TEST ONLY lesson', kind: 'text', required: true, body: 'Synthetic local test material. This text confirms no occupational competence.', media: [] }] }],
  assessment: { durationMinutes: 15, maxAttempts: 1, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
  questions: [{ id: 'analytics-question', text: 'TEST ONLY question', topic: 'Synthetic topic', options: [{ id: 'wrong', text: 'TEST WRONG' }, { id: 'right', text: 'TEST RIGHT' }], correctOptionIds: ['right'] }],
};
try {
  await getDb(); const hash = await hashPassword(password);
  for (const user of Object.values(users)) {
    await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [user.id, user.name, user.email, user.role, Date.now(), Date.now()]);
    await execute('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [user.id + '-account', user.id, 'credential', user.id, hash, Date.now(), Date.now()]);
  }
  async function publish(data: ProgramData) {
    const draft = (await createVersion(author, 'ohrana-truda', data)).version;
    const review = (await reviewVersion(author, draft.id, draft.revision)).version;
    return (await publishVersion(reviewer, review.id, review.revision, 'TEST ONLY synthetic analytics browser fixture')).version.id;
  }
  const freeVersionId = await publish(content);
  const paidVersionId = await publish({ ...content, title: 'TEST ONLY paid-version view; DO NOT PAY', accessModel: 'paid', priceMinor: 120000 });
  for (const table of ['analytics_events', 'enrollments', 'lesson_progress', 'attempts', 'orders']) {
    const count = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`); if (Number(count?.n)) throw new Error('Unexpected fixture data in ' + table);
  }
  await writeFile(resolve(process.env.OT_ANALYTICS_FIXTURE_PATH!), JSON.stringify({ notice: 'SYNTHETIC LOCAL TEST DATA ONLY', databasePath, users, programId: 'ohrana-truda', lessonId: 'analytics-lesson', freeVersionId, paidVersionId }, null, 2));
  console.log('New synthetic accounts/free+paid versions ready; no browser events, enrollment, progress, attempts or orders seeded.');
} finally { await closeDb(); }
