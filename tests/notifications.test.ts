import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { closeDb, enqueue, execute, getDb } from '../server/db';
import { listNotifications, markNotificationRead, processOutbox } from '../server/services/operations';
let directory: string;
const prior = { OT_DATABASE_PATH: process.env.OT_DATABASE_PATH, TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL, VERCEL: process.env.VERCEL };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-notifications-'));
  process.env.OT_DATABASE_PATH = join(directory, 'test.sqlite'); delete process.env.TURSO_DATABASE_URL; delete process.env.VERCEL;
  await getDb();
  for (const id of ['recipient', 'other']) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)', [id, id, `${id}@example.test`, Date.now(), Date.now()]);
});
after(async () => {
  await closeDb(); for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  if (basename(directory).startsWith('ot-notifications-')) await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
test('durable notifications deduplicate and expose no raw payload', async () => {
  await enqueue('notification.enrollment', 'test-enrollment', { userId: 'recipient', enrollmentId: 'test-enrollment' });
  await enqueue('notification.enrollment', 'test-enrollment', { userId: 'recipient', enrollmentId: 'test-enrollment' });
  await processOutbox({ aggregateId: 'test-enrollment', allowExternal: false });
  const { notifications } = await listNotifications('recipient');
  assert.equal(notifications.length, 1); assert.equal(notifications[0]!.status, 'unread');
  assert.equal('payload' in notifications[0]!, false); assert.equal('payload_json' in notifications[0]!, false);
  assert.equal((await listNotifications('other')).notifications.length, 0);
});
test('notification read is owned, idempotent and survives refresh', async () => {
  const notice = (await listNotifications('recipient')).notifications[0]!;
  await assert.rejects(markNotificationRead('other', notice.id), (error: any) => error.statusCode === 404);
  await markNotificationRead('recipient', notice.id); await markNotificationRead('recipient', notice.id);
  assert.equal((await listNotifications('recipient')).notifications[0]!.status, 'read');
});
