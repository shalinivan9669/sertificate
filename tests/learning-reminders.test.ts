import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryAll, queryOne } from '../server/db';
import { calendarDate, calendarDayStart, cancelLearningReminder, createLearningReminder, deliverLearningReminder, getReminderPreferences, listLearningReminders, reminderEnrollmentChoices, scheduleLearningReminders, updateLearningReminder, updateReminderPreferences } from '../server/services/reminders';
import type { AppUser } from '../server/utils/auth';

let directory: string; let sequence = 0;
const owner: AppUser = { id: 'reminder-test-owner', email: 'reminder-owner@example.test', name: 'TEST OWNER', role: 'learner', twoFactorEnabled: false };
const learner: AppUser = { ...owner, id: 'reminder-test-learner', email: 'reminder-learner@example.test' };
const other: AppUser = { ...owner, id: 'reminder-test-other', email: 'reminder-other@example.test' };
const clock = new Date('2030-01-01T12:00:00.000Z'); const reason = 'Explicit synthetic training planning only';
const envKeys = ['OT_DATABASE_PATH','NODE_ENV','VERCEL','VERCEL_ENV','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN'];
const oldEnv = Object.fromEntries(envKeys.map(key => [key,process.env[key]]));
const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: any) => error.data?.code === code);
async function source(org = false, access = '2030-02-01T12:00:00.000Z') {
  const enrollmentId = `reminder-enrollment-${++sequence}`; const organizationId = org ? `reminder-org-${sequence}` : undefined;
  if (organizationId) {
    await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [organizationId,'SYNTHETIC REMINDER ORG',clock.toISOString()]);
    for (const [user,role] of [[owner,'owner'],[learner,'member']] as const) await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [organizationId,user.id,role,clock.toISOString()]);
  }
  await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,access_until,created_at) VALUES(?,?,?,?,?,?,?)', [enrollmentId,learner.id,'reminder-version',organizationId || null,'active',access,clock.toISOString()]);
  return { enrollmentId, organizationId };
}
const input = (enrollmentId: string, extra: Record<string, unknown> = {}) => ({ enrollmentId,kind:'renewal',dueDate:'2030-02-01',timezone:'Asia/Qyzylorda',leadDays:[0],reason,...extra });
async function create(enrollmentId: string, extra: Record<string, unknown> = {}) { return (await createLearningReminder(learner,undefined,input(enrollmentId,extra),randomUUID(),clock)).reminder; }
async function jobs(reminderId: string) { return queryAll('SELECT o.* FROM outbox o JOIN learning_reminder_deliveries d ON d.outbox_id=o.id WHERE d.reminder_id=?', [reminderId]); }
before(async () => {
  directory = await mkdtemp(join(tmpdir(),'ot-reminder-test-')); process.env.OT_DATABASE_PATH = join(directory,'test.sqlite'); process.env.NODE_ENV='test';
  for (const key of ['VERCEL','VERCEL_ENV','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN']) delete process.env[key];
  await getDb();
  for (const user of [owner,learner,other]) await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,1,1)', [user.id,user.name,user.email]);
  // Historical enrollment metadata fixture; no questions, results, payments or credentials are manufactured.
  await execute('INSERT INTO program_versions(id,program_id,version,data_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', ['reminder-version','ohrana-truda',1,'{"title":"SYNTHETIC REMINDER METADATA"}',owner.id,clock.toISOString(),clock.toISOString()]);
});
after(async () => {
  await closeDb(); const path = resolve(directory); assert.ok(path.startsWith(`${resolve(tmpdir())}${sep}`) && basename(path).startsWith('ot-reminder-test-'));
  await rm(path,{ recursive:true,force:true,maxRetries:10,retryDelay:100 });
  for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key]=oldEnv[key]; }
});

test('calendar reminders use actual local days across UTC offsets and DST, and reject nonexistent dates', () => {
  assert.equal(calendarDayStart('2030-02-01','Asia/Qyzylorda'),'2030-01-31T19:00:00.000Z');
  assert.equal(calendarDate(new Date('2030-01-31T20:00:00.000Z'),'Asia/Qyzylorda'),'2030-02-01');
  assert.equal(Date.parse(calendarDayStart('2030-03-11','America/New_York'))-Date.parse(calendarDayStart('2030-03-10','America/New_York')),23*3600000);
  assert.equal(Date.parse(calendarDayStart('2030-11-04','America/New_York'))-Date.parse(calendarDayStart('2030-11-03','America/New_York')),25*3600000);
  assert.throws(() => calendarDayStart('2030-02-30','UTC'));
  assert.throws(() => calendarDayStart('2011-12-30','Pacific/Apia'), (e: any) => e.data.code === 'NONEXISTENT_LOCAL_DATE');
});

test('renewal requires an explicit future date; access reminders bind exact server deadline and cannot invent document validity', async () => {
  const en = await source();
  await rejects(create(en.enrollmentId,{ dueDate:undefined }), 'FUTURE_RENEWAL_DATE_REQUIRED');
  await rejects(create(en.enrollmentId,{ dueDate:'2029-12-31' }), 'FUTURE_RENEWAL_DATE_REQUIRED');
  await rejects(create(en.enrollmentId,{ timezone:'Invalid/Zone' }), 'VALIDATION_ERROR');
  await rejects(create(en.enrollmentId,{ leadDays:[1,1] }), 'VALIDATION_ERROR');
  await rejects(create(en.enrollmentId,{ validityYears:1 }), 'VALIDATION_ERROR');
  await rejects(create(en.enrollmentId,{ kind:'access_deadline' }), 'ACCESS_DEADLINE_FROM_ENROLLMENT');
  const reminder = await create(en.enrollmentId,{ kind:'access_deadline',dueDate:undefined }); assert.equal(reminder.dueAt,'2030-02-01T12:00:00.000Z');
  assert.equal(Number((await queryOne('SELECT COUNT(*) n FROM credentials'))!.n),0); assert.equal(Number((await queryOne('SELECT COUNT(*) n FROM orders'))!.n),0);
  const missing = await source(false,'2029-01-01T00:00:00.000Z'); await rejects(create(missing.enrollmentId,{ kind:'access_deadline',dueDate:undefined }), 'FUTURE_ACCESS_DEADLINE_REQUIRED');
});

test('create is idempotent, tenant scoped and respects current verified membership', async () => {
  const en = await source(true); const key = randomUUID(); const body=input(en.enrollmentId);
  const a = await createLearningReminder(owner,en.organizationId,body,key,clock); const b = await createLearningReminder(owner,en.organizationId,body,key,clock); assert.equal(a.reminder.id,b.reminder.id);
  await rejects(createLearningReminder(owner,en.organizationId,{ ...body,dueDate:'2030-02-02' },key,clock),'IDEMPOTENCY_CONFLICT');
  await rejects(createLearningReminder(other,undefined,body,randomUUID(),clock),'REMINDER_ENROLLMENT_NOT_FOUND');
  await rejects(listLearningReminders(other,en.organizationId),'ORGANIZATION_NOT_FOUND');
  await rejects(createLearningReminder(learner,en.organizationId,body,randomUUID(),clock),'ORGANIZATION_NOT_FOUND');
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?", [en.organizationId!,owner.id]);
  await rejects(createLearningReminder(owner,en.organizationId,body,key,clock),'ORGANIZATION_NOT_FOUND');
  assert.equal((await listLearningReminders(learner,undefined)).reminders.some(r=>r.id===a.reminder.id),true);
});

test('bounded concurrent scheduler and duplicate delivery create exactly one in-app notice per calendar offset', async () => {
  const en = await source(); const row = await create(en.enrollmentId); const before = await scheduleLearningReminders({ now:new Date('2030-01-31T18:59:59.999Z') });
  assert.equal((await jobs(row.id)).length,0); assert.ok(before.selected>=0);
  const at = new Date('2030-01-31T19:00:00.000Z');
  await Promise.all([scheduleLearningReminders({ now:at,limit:50 }),scheduleLearningReminders({ now:at,limit:50 })]);
  const list=await jobs(row.id); assert.equal(list.length,1);
  assert.deepEqual(await Promise.all([deliverLearningReminder(list[0] as any,at),deliverLearningReminder(list[0] as any,at)]),['delivered','delivered']);
  const notifications=await queryAll("SELECT * FROM notifications WHERE dedupe_key LIKE 'learning.reminder:%' AND payload_json LIKE ?", [`%${row.id}%`]);
  assert.equal(notifications.length,1); assert.equal(notifications[0]!.template,'learning.reminder'); assert.equal(notifications[0]!.purpose,'optional_service');
  assert.equal((await queryOne('SELECT status FROM learning_reminders WHERE id=?',[row.id]))!.status,'completed');
});

test('cancel and reschedule reject stale revision and old queued jobs cannot publish an obsolete date', async () => {
  const en=await source(); const row=await create(en.enrollmentId); const at=new Date('2030-01-31T20:00:00.000Z');
  await scheduleLearningReminders({ now:at }); const old=(await jobs(row.id))[0]!;
  const changed=await updateLearningReminder(learner,row.id,{ revision:0,timezone:'Asia/Qyzylorda',leadDays:[0],dueDate:'2030-03-01',reason },clock);
  assert.equal(changed.reminder.revision,1); assert.equal(await deliverLearningReminder(old as any,at),'cancelled');
  await rejects(updateLearningReminder(learner,row.id,{ revision:0,timezone:'UTC',leadDays:[0],dueDate:'2030-04-01',reason },clock),'REMINDER_REVISION_CONFLICT');
  await rejects(cancelLearningReminder(other,row.id,{ revision:1,reason }),'REMINDER_NOT_FOUND');
  await cancelLearningReminder(learner,row.id,{ revision:1,reason });
  await scheduleLearningReminders({ now:new Date('2030-02-28T20:00:00.000Z') });
  assert.equal(Number((await queryOne('SELECT COUNT(*) n FROM notifications WHERE payload_json LIKE ?',[`%${row.id}%`]))!.n),0);
  assert.equal((await queryOne('SELECT status FROM learning_reminders WHERE id=?',[row.id]))!.status,'cancelled');
});

test('membership revoked between enqueue and delivery suppresses notice; changed access deadline cancels old source', async () => {
  const en=await source(true); const row=(await createLearningReminder(owner,en.organizationId,input(en.enrollmentId),randomUUID(),clock)).reminder; const at=new Date('2030-01-31T20:00:00.000Z');
  await scheduleLearningReminders({ now:at }); const job=(await jobs(row.id))[0]!;
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=? AND user_id=?",[en.organizationId!,learner.id]);
  assert.equal(await deliverLearningReminder(job as any,at),'cancelled');
  const second=await source(); const access=await create(second.enrollmentId,{ kind:'access_deadline',dueDate:undefined,leadDays:[7,0] });
  await execute('UPDATE enrollments SET access_until=? WHERE id=?',['2030-04-01T12:00:00.000Z',second.enrollmentId]);
  await scheduleLearningReminders({ now:new Date('2030-01-25T08:00:00.000Z') });
  assert.equal((await queryOne('SELECT status FROM learning_reminders WHERE id=?',[access.id]))!.status,'cancelled');
  assert.equal((await jobs(access.id)).length,0);
});

test('late jobs are marked missed and never backfill a burst of historical notifications', async () => {
  const en=await source(); const row=await create(en.enrollmentId,{ leadDays:[30,7,0] });
  const result=await scheduleLearningReminders({ now:new Date('2030-04-01T00:00:00.000Z'),limit:2 });
  assert.ok(result.selected<=2); assert.ok(result.processed<=2);
  for(let n=0;n<10;n++) await scheduleLearningReminders({ now:new Date('2030-04-01T00:00:00.000Z') });
  assert.equal((await jobs(row.id)).length,0);
  assert.equal(Number((await queryOne("SELECT COUNT(*) n FROM learning_reminder_deliveries WHERE reminder_id=? AND status='missed'",[row.id]))!.n),3);
});

test('learner opt-out cancels queued and already created unread notices, preserves read history and prevents organization override', async () => {
  assert.deepEqual(await getReminderPreferences(learner),{ accessDeadline:true,renewal:true,channel:'in_app' });
  const a=await source(); const unread=await create(a.enrollmentId); const b=await source(); const read=await create(b.enrollmentId); const c=await source(); const queued=await create(c.enrollmentId); const at=new Date('2030-01-31T20:00:00.000Z');
  await scheduleLearningReminders({ now:at });
  await deliverLearningReminder((await jobs(unread.id))[0] as any,at); await deliverLearningReminder((await jobs(read.id))[0] as any,at);
  await execute("UPDATE notifications SET status='read' WHERE payload_json LIKE ?",[`%${read.id}%`]);
  await updateReminderPreferences(learner,{ accessDeadline:true,renewal:false });
  assert.equal((await queryOne('SELECT status FROM notifications WHERE payload_json LIKE ?',[`%${unread.id}%`]))!.status,'cancelled');
  assert.equal((await queryOne('SELECT status FROM notifications WHERE payload_json LIKE ?',[`%${read.id}%`]))!.status,'read');
  assert.equal(await deliverLearningReminder((await jobs(queued.id))[0] as any,at),'cancelled');
  const org=await source(true); await rejects(createLearningReminder(owner,org.organizationId,input(org.enrollmentId),randomUUID(),clock),'REMINDER_PREFERENCE_DISABLED');
  await updateReminderPreferences(learner,{ accessDeadline:true,renewal:true });
  assert.equal((await queryOne('SELECT status FROM learning_reminders WHERE id=?',[queued.id]))!.status,'cancelled');
});

test('paginated learner/organization views expose exact totals and enrollment choice pages without secret payloads', async () => {
  const first=await listLearningReminders(learner,undefined,{ pageSize:2 }); assert.ok(first.pagination.total>2); assert.equal(first.reminders.length,2);
  const second=await listLearningReminders(learner,undefined,{ pageSize:2,page:2 }); assert.equal(new Set([...first.reminders,...second.reminders].map(r=>r.id)).size,4);
  const own=await reminderEnrollmentChoices(learner,{ pageSize:2 }); assert.ok(own.pagination.total>2); assert.equal(own.enrollments.length,2);
  assert.equal((await reminderEnrollmentChoices(other)).pagination.total,0);
  assert.doesNotMatch(JSON.stringify(first),/answers_json|document_base64|verification_hash|secret/);
});
