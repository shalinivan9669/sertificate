import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryAll } from '../server/db';
import { appendSupportNote, listSupportNotes } from '../server/services/staff-workflows';
import type { AppUser } from '../server/utils/auth';
let directory: string;
const actor: AppUser = { id: 'support-admin', name: 'TEST SUPPORT', email: 'support@example.test', role: 'admin', twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
const keys = ['OT_DATABASE_PATH', 'NODE_ENV', 'OT_APP_ENV', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-support-notes-'));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_APP_ENV: 'test' });
  await getDb();
  for (const id of [actor.id, 'learner-one', 'learner-two']) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)', [id, 'Synthetic support subject', `${id}@example.test`, Date.now(), Date.now()]);
});
after(async () => {
  await closeDb(); const target = resolve(directory); assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-support-notes-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
});
test('B43 support notes require current admin MFA, preserve corrections and page without leaking text into audit', async () => {
  await assert.rejects(appendSupportNote({ ...actor, role: 'issuer' }, 'learner-one', { text: 'TEST private support context' }), (error: any) => error.data.code === 'FORBIDDEN');
  await assert.rejects(listSupportNotes({ ...actor, mfaVerifiedAt: 1 }, 'learner-one'), (error: any) => error.data.code === 'MFA_REQUIRED');
  const original = await appendSupportNote(actor, 'learner-one', { text: 'TEST private support context' });
  await appendSupportNote(actor, 'learner-one', { text: 'TEST correction replaces the original observation', supersedesId: original.id });
  await assert.rejects(appendSupportNote(actor, 'learner-two', { text: 'Wrong subject correction is forbidden', supersedesId: original.id }), (error: any) => error.data.code === 'NOTE_NOT_FOUND');
  for (let index = 0; index < 25; index++) await appendSupportNote(actor, 'learner-one', { text: `Synthetic followup observation ${index}` });
  const first = await listSupportNotes(actor, 'learner-one'); const second = await listSupportNotes(actor, 'learner-one', { page: 2 });
  assert.equal(first.pagination.total, 27); assert.equal(first.pagination.hasMore, true); assert.equal(second.notes.length, 2);
  assert.equal(new Set([...first.notes, ...second.notes].map(row => row.id)).size, 27);
  assert.equal((await listSupportNotes(actor, 'learner-two')).notes.length, 0);
  assert.equal(JSON.stringify(await queryAll('SELECT * FROM audit_events')).includes('TEST private support context'), false);
  await assert.rejects(execute('UPDATE support_notes SET body=? WHERE id=?', ['Erased original evidence', original.id]), /append-only/);
  await assert.rejects(execute('DELETE FROM support_notes WHERE id=?', [original.id]), /append-only/);
});
