/** Isolated backward-data diagnostic. This never authorizes an old application as a live writer. */
import assert from 'node:assert/strict';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { createApp, toNodeListener } from 'h3';
import { createClient, type Client } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';
import { assessLegacyRollback, inspectLegacyArtifact, legacyBuildId } from './rollback-preflight';
import { exportDatabase, restoreDatabase } from './db-backup';

const repository = resolve(fileURLToPath(new URL('../', import.meta.url)));
const operations: { name: string; passed: boolean; detail?: unknown }[] = [];
const report: any = { checkedAt: new Date().toISOString(), scope: 'Fresh synthetic local databases only. Current auth handler over HTTP, snapshot copy, additive migrations, preserved old LMS runtime through GET requests. No live deployment or write rollback approval.', applicationRollbackAllowed: false, operations, blockers: [], failures: [], privateOutputs: 'Raw fixture databases and cookie values remain private; report has no credentials, session IDs, question bank or learner body contents.' };
let directory = '', authServer: Server | undefined, oldProcess: ChildProcess | undefined;
let childLog = '';
let closeCurrent: (() => Promise<void>) | undefined;
const privateSecret = randomBytes(48).toString('base64url');
const password = randomBytes(24).toString('base64url') + '!TEST';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function passed(name: string, detail?: unknown) { operations.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(JSON.stringify({ operation: name, passed: true })); }
function within(root: string, path: string) { const rel = relative(root, resolve(path)); assert.ok(rel && !isAbsolute(rel) && !rel.startsWith('..' + sep) && rel !== '..' && !resolve(path).includes('\0'), 'A strict child path is required'); }
async function reserve(path: string) { within(directory, path); const handle = await open(path, 'wx', 0o600); await handle.close(); }
const localClient = (path: string) => { within(directory, path); return createClient({ url: `file:${path.replaceAll('\\', '/')}`, concurrency: 1 }); };
async function listen(server: Server) {
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const address = server.address(); assert.ok(address && typeof address === 'object'); return `http://127.0.0.1:${address.port}`;
}
async function stopServer(server?: Server) { if (server) await new Promise<void>(done => server.close(() => done())); }
async function stopOld() {
  if (!oldProcess || oldProcess.exitCode !== null) return;
  const child = oldProcess; child.kill();
  await Promise.race([new Promise<void>(done => child.once('exit', () => done())), new Promise<void>(done => setTimeout(done, 5000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
async function getJson(base: string, path: string, cookie: string) {
  const response = await fetch(base + path, { headers: { Cookie: cookie, Origin: base }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, 'Expected protected GET to return HTTP 200'); return response.json();
}
async function newCopy(snapshot: Awaited<ReturnType<typeof exportDatabase>>, name: string) {
  const path = join(directory, name + '.sqlite'); await reserve(path); const client = localClient(path);
  try { await restoreDatabase(client, snapshot); } finally { client.close(); }
  return path;
}

try {
  assert.equal(process.env.NODE_ENV, 'test', 'Explicit NODE_ENV=test required');
  assert.equal(process.env.OT_ALLOW_ROLLBACK_DRILL, '1', 'Explicit OT_ALLOW_ROLLBACK_DRILL=1 required');
  assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN, 'Remote and Vercel environments are forbidden');
  assert.equal(process.argv.length, 3, 'Supply only the preserved artifact-output directory; database paths are never accepted');
  const artifact = await inspectLegacyArtifact(process.argv[2]!); assert.equal(artifact.recognized, true, 'Preserved application artifact must match reviewed ID and fingerprint');
  report.oldArtifact = { buildId: artifact.buildId, serverFingerprint: artifact.serverFingerprint, files: artifact.ownedRuntimeFiles };
  const parent = join(repository, '.data'); await mkdir(parent, { recursive: true });
  assert.equal((await realpath(parent)).toLowerCase(), parent.toLowerCase(), 'Linked private output root is forbidden');
  directory = await mkdtemp(join(parent, 'rollback-drill-')); within(parent, directory);
  await writeFile(join(directory, 'SYNTHETIC-ROLLBACK-DRILL.json'), JSON.stringify({ notice: 'SYNTHETIC LOCAL ROLLBACK DIAGNOSTIC ONLY', createdAt: report.checkedAt }), { flag: 'wx', mode: 0o600 });
  report.privateDirectory = relative(repository, directory).replaceAll('\\', '/');
  const currentMigrations = join(directory, 'current-migrations'), oldMigrations = join(directory, 'old-migrations');
  await mkdir(currentMigrations); await mkdir(oldMigrations);
  const names = ['001-core.sql', '002-business.sql', '003-credential-templates.sql', '004-corporate-invoices.sql', '005-invoice-allocations.sql', '006-operational-incidents.sql', '007-learning-reminders.sql', '008-program-intake.sql', '009-staff-workflows.sql'];
  for (const [i, name] of names.entries()) {
    const content = await readFile(join(repository, 'server/db/migrations', name));
    await writeFile(join(currentMigrations, name), content, { flag: 'wx' }); if (i < 5) await writeFile(join(oldMigrations, name), content, { flag: 'wx' });
  }
  // Neither root DB nor .output is accepted as a mutable target.
  const sourcePath = join(directory, 'synthetic-current.sqlite'); await reserve(sourcePath);
  process.env.OT_DATABASE_PATH = sourcePath; process.env.OT_MIGRATIONS_DIR = currentMigrations;
  process.env.BETTER_AUTH_SECRET = privateSecret; process.env.OT_EMAIL_DELIVERY_ENABLED = '0'; process.env.OT_CRM_DELIVERY_ENABLED = '0'; process.env.OT_OPERATIONAL_ALERTS_ENABLED = '0'; process.env.OT_PAYMENT_PROVIDER = 'disabled'; process.env.OT_APP_ENV = 'test';
  delete process.env.OT_BUILD_MODE;
  const coreDb = await import('../server/db'); closeCurrent = coreDb.closeDb;
  const { createVersion, reviewVersion, publishVersion } = await import('../server/services/catalog');
  const { createEnrollment, completeLesson } = await import('../server/services/learning');
  const learner = { id: 'rollback-test-learner', name: 'SYNTHETIC ROLLBACK LEARNER', email: 'rollback-learner@example.test', role: 'learner' as const, twoFactorEnabled: false };
  const editor = { id: 'rollback-test-editor', name: 'SYNTHETIC ROLLBACK EDITOR', email: 'rollback-editor@example.test', role: 'editor' as const, twoFactorEnabled: true, mfaVerifiedAt: Date.now() };
  const reviewer = { ...editor, id: 'rollback-test-reviewer', email: 'rollback-reviewer@example.test', role: 'reviewer' as const };
  await coreDb.getDb();
  for (const actor of [learner, editor, reviewer]) await coreDb.execute('INSERT INTO "user" (id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES (?,?,?,1,?,?,?,?)', [actor.id, actor.name, actor.email, actor.role, Number(actor.twoFactorEnabled), Date.now(), Date.now()]);
  await coreDb.execute('INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', ['rollback-test-account', learner.id, 'credential', learner.id, await hashPassword(password), Date.now(), Date.now()]);
  const content = {
    title: 'SYNTHETIC ROLLBACK TEST — NOT APPROVED TRAINING', language: 'ru', audience: 'Synthetic test accounts', prerequisites: '', outcomes: 'Test backward data compatibility only', limitations: 'No occupational competence or document validity', format: 'Isolated integration fixture', durationHours: 1, priceMinor: 0, currency: 'KZT', accessModel: 'free', documentDescription: 'NO DOCUMENT IS ISSUED', support: 'Test only', sourceRefs: ['scripts/rollback-drill.ts synthetic data only'], reviewedAt: new Date().toISOString().slice(0, 10),
    modules: [{ id: 'rollback-module', title: 'SYNTHETIC MODULE', lessons: [1, 2].map(i => ({ id: `rollback-lesson-${i}`, title: `SYNTHETIC LESSON ${i}`, kind: 'text', required: true, body: `SYNTHETIC ROLLBACK BODY ${i} — NO TRAINING VALIDITY`, media: [] })) }],
    assessment: { durationMinutes: 10, maxAttempts: 2, passPercent: 100, questionCount: 1, retakeDelayMinutes: 0 },
    questions: [{ id: 'rollback-question', text: 'SYNTHETIC TEST QUESTION ONLY', topic: 'Synthetic', options: [{ id: 'test-no', text: 'TEST WRONG' }, { id: 'test-yes', text: 'TEST CORRECT' }], correctOptionIds: ['test-yes'] }],
  };
  const draft = (await createVersion(editor, 'ohrana-truda', content)).version;
  const review = (await reviewVersion(editor, draft.id, draft.revision)).version;
  const version = (await publishVersion(reviewer, review.id, review.revision, 'SYNTHETIC ROLLBACK DRILL REVIEW ONLY')).version;
  const enrollment = (await createEnrollment(learner, { userId: learner.id, versionId: version.id }, randomUUID(), true)).enrollment;
  await completeLesson(learner, enrollment.id, 'rollback-lesson-1', 0);
  const inertCreatedAt = new Date().toISOString();
  await coreDb.execute('INSERT INTO program_intake_controls VALUES(?,1,?,?,?)', [version.id, editor.id, 'SYNTHETIC OPEN INTAKE HISTORY', inertCreatedAt]);
  await coreDb.execute('INSERT INTO learning_reminder_preferences VALUES(?,0,0,?)', [learner.id, inertCreatedAt]);
  await coreDb.execute('INSERT INTO support_notes(id,user_id,author_id,body,created_at) VALUES(?,?,?,?,?)', ['synthetic-support-note', learner.id, editor.id, 'SYNTHETIC SUPPORT HISTORY ONLY', inertCreatedAt]);
  passed('current-source-seeds-only-new-synthetic-database', { migratedThrough: '009', verifiedLearners: 1, publishedSyntheticVersions: 1, existingCompletedLessons: 1 });

  const authHandler = (await import('../server/api/auth/[...all]')).default;
  const app = createApp(); app.use(authHandler);
  authServer = createServer(toNodeListener(app)); const currentBase = await listen(authServer); process.env.BETTER_AUTH_URL = currentBase;
  const signIn = await fetch(currentBase + '/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: currentBase }, body: JSON.stringify({ email: learner.email, password, rememberMe: false }), redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(signIn.status, 200, 'Current real HTTP auth handler must sign in the existing verified synthetic learner');
  const cookie = signIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); assert.ok(cookie.includes('session_token='));
  const currentSession = await getJson(currentBase, '/api/auth/get-session', cookie); assert.equal(currentSession.user.id, learner.id); assert.equal(currentSession.user.emailVerified, true);
  await stopServer(authServer); authServer = undefined;
  passed('current-auth-http-session-established', { credentialsPrinted: false });
  const initial = await exportDatabase(await coreDb.getDb()); await coreDb.closeDb();
  const copyPath = await newCopy(initial, 'migrated-diagnostic-copy');
  const copied = localClient(copyPath);
  try { await coreDb.migrate(copied, currentMigrations); } finally { copied.close(); }
  const baselineCopy = localClient(copyPath); let snapshot: Awaited<ReturnType<typeof exportDatabase>>;
  try { snapshot = await exportDatabase(baselineCopy); } finally { baselineCopy.close(); }
  assert.deepEqual(snapshot.tables, initial.tables, 'Reapplying additive migrations must preserve every row');
  report.migrations = initial.tables.find(table => table.name === 'schema_migrations')!.rows.map(row => row[0]);
  assert.deepEqual([...report.migrations].sort(), names);
  passed('copy-and-migrate-001-through-009-preserves-rows', { tables: snapshot.tables.length, rows: snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0) });
  const controlFree = await assessLegacyRollback(artifact.root, copyPath, currentMigrations);
  assert.equal(controlFree.applicationRollbackAllowed, false); assert.equal(controlFree.isolatedReadDiagnosticAllowed, true);
  report.controlFreePreflight = controlFree;
  passed('control-free-copy-is-diagnostic-only-not-live-rollback');

  const portReservation = createServer(); const oldBase = await listen(portReservation); await stopServer(portReservation);
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) if (/^(?:VERCEL|TURSO_|AMO_|SMTP_|MAIL_FROM$)/.test(key)) delete childEnv[key];
  delete childEnv.NITRO_UNIX_SOCKET; delete childEnv.NITRO_SSL_CERT; delete childEnv.NITRO_SSL_KEY;
  Object.assign(childEnv, { HOST: '127.0.0.1', PORT: new URL(oldBase).port, NITRO_HOST: '127.0.0.1', NITRO_PORT: new URL(oldBase).port, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_DATABASE_PATH: copyPath, OT_MIGRATIONS_DIR: oldMigrations, BETTER_AUTH_URL: oldBase, BETTER_AUTH_SECRET: privateSecret, OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled' });
  oldProcess = spawn(process.execPath, [join(artifact.root, 'server/index.mjs')], { cwd: directory, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // Bounded private diagnostics; no child stdout, request bodies or cookies are printed.
  oldProcess.stdout?.on('data', data => { childLog = (childLog + data.toString()).slice(-16000); }); oldProcess.stderr?.on('data', data => { childLog = (childLog + data.toString()).slice(-16000); });
  let ready = false;
  const startupDeadline = Date.now() + 30000;
  while (Date.now() < startupDeadline && !ready) {
    if (oldProcess.exitCode !== null) throw new Error('OLD_RUNTIME_EXITED_DURING_START');
    try { const result = await fetch(oldBase + '/_nuxt/builds/latest.json', { signal: AbortSignal.timeout(1000) }); report.startupProbe = { status: result.status }; ready = result.ok && (await result.json()).id === legacyBuildId; } catch { /* wait for the owned child only */ }
    if (!ready) await new Promise(done => setTimeout(done, 100));
  }
  assert.equal(ready, true, 'Preserved old LMS must start on its fresh loopback port');
  const oldSession = await getJson(oldBase, '/api/auth/get-session', cookie); assert.equal(oldSession.user.id, learner.id); assert.equal(oldSession.user.emailVerified, true); assert.equal(oldSession.session.id, currentSession.session.id);
  const me = await getJson(oldBase, '/api/v1/me', cookie); assert.equal(me.user.id, learner.id);
  const cabinet = await getJson(oldBase, '/api/v1/me/enrollments', cookie); assert.equal(cabinet.enrollments[0].id, enrollment.id); assert.equal(cabinet.enrollments[0].progress.completed, 1);
  const detail = await getJson(oldBase, '/api/v1/enrollments/' + enrollment.id, cookie); assert.equal(detail.versionId, version.id); assert.equal(detail.progress.completed, 1); assert.equal(detail.progress.total, 2);
  const lesson = await getJson(oldBase, `/api/v1/enrollments/${enrollment.id}/lessons/rollback-lesson-1`, cookie); assert.equal(lesson.progress.completed, true); assert.equal(lesson.lesson.body, content.modules[0]!.lessons[0]!.body);
  const catalog = await getJson(oldBase, '/api/v1/catalog/programs/ohrana-truda', cookie); assert.ok(catalog.program.versions.some((item: any) => item.id === version.id)); assert.ok(!JSON.stringify(catalog).includes('correctOptionIds'));
  passed('actual-old-lms-http-reads-preserve-current-session-course-and-progress', { protectedReads: 6, oldBuildId: legacyBuildId, oldAcademicWrites: 0 });
  await stopOld(); oldProcess = undefined;
  // Keep startup diagnostics private even if native runtime warnings are present.
  const afterClient = localClient(copyPath); let afterSnapshot: Awaited<ReturnType<typeof exportDatabase>>;
  try { afterSnapshot = await exportDatabase(afterClient); } finally { afterClient.close(); }
  const tableChanges = snapshot.tables.filter(table => digest(table) !== digest(afterSnapshot.tables.find(item => item.name === table.name))).map(table => table.name);
  assert.deepEqual(afterSnapshot.tables.map(table => table.name), snapshot.tables.map(table => table.name), 'Old runtime must not add or remove migrated tables');
  assert.deepEqual(tableChanges.filter(name => name !== 'rateLimit'), [], 'GET diagnostic must preserve academic, session and feature rows; only the auth request counter may change');
  passed('old-get-diagnostic-preserves-academic-session-and-feature-rows', { tables: snapshot.tables.length, changedOperationalTables: tableChanges, allowedOperationalChange: 'Better Auth GET requests update the rateLimit counter. GET-only requests do not make the runtime a read-only database process.', preservedNonemptyNewFeatureTables: ['program_intake_controls', 'learning_reminder_preferences', 'support_notes'] });

  async function blockedScenario(name: string, expectedCode: string, mutate: (db: Client) => Promise<unknown>) {
    const path = await newCopy(snapshot, name); const db = localClient(path);
    try { await mutate(db); } finally { db.close(); }
    const assessment = await assessLegacyRollback(artifact.root, path, currentMigrations);
    assert.equal(assessment.applicationRollbackAllowed, false); assert.equal(assessment.isolatedReadDiagnosticAllowed, false); assert.ok(assessment.blockers.some(item => item.code === expectedCode));
    report.blockers.push({ scenario: name, code: expectedCode, oldRuntimeStarted: false }); passed(name, { oldRuntimeStarted: false });
  }
  const now = new Date().toISOString();
  await blockedScenario('closed-intake-refuses-old-runtime', 'CLOSED_INTAKE_UNSUPPORTED', db => db.execute({ sql: 'UPDATE program_intake_controls SET is_open=0,reason=?,updated_at=? WHERE version_id=?', args: ['SYNTHETIC CLOSED INTAKE GUARD', now, version.id] }));
  for (const type of ['operations.alert', 'learning.reminder']) await blockedScenario('unknown-work-' + type.replace('.', '-'), 'UNSUPPORTED_OUTBOX_WORK', db => db.execute({ sql: 'INSERT INTO outbox(id,type,aggregate_id,payload_json,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', args: [randomUUID(), type, 'synthetic-only', '{}', now, now, now] }));
  await blockedScenario('active-reminder-refuses-old-runtime', 'ACTIVE_REMINDERS_UNSUPPORTED', async db => {
    await db.execute({ sql: 'INSERT INTO learning_reminders(id,user_id,enrollment_id,kind,due_at,timezone,lead_days_json,created_by,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', args: ['synthetic-reminder', learner.id, enrollment.id, 'renewal', now, 'Asia/Qyzylorda', '[0]', editor.id, 'SYNTHETIC REMINDER GUARD', now, now] });
    await db.execute({ sql: 'INSERT INTO learning_reminder_deliveries(id,reminder_id,revision,offset_days,scheduled_at,expires_at,created_at) VALUES(?,?,0,0,?,?,?)', args: ['synthetic-delivery', 'synthetic-reminder', now, new Date(Date.now() + 3600000).toISOString(), now] });
  });
  await blockedScenario('active-incident-refuses-old-runtime', 'ACTIVE_INCIDENTS_UNSUPPORTED', db => db.execute({ sql: 'INSERT INTO operational_incidents(id,fingerprint,kind,severity,target_type,target_id,owner_role,details_json,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?)', args: ['synthetic-incident', 'synthetic-incident', 'credential_pending', 'warning', 'credential', 'synthetic-only', 'issuer', '{}', now, now] }));
  await blockedScenario('credential-batch-refuses-old-runtime', 'UNFINISHED_CREDENTIAL_BATCHES', async db => {
    await db.execute({ sql: 'INSERT INTO credential_batches(id,created_by,action,reason,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', args: ['synthetic-batch', editor.id, 'issue', 'SYNTHETIC BATCH GUARD', now, now, now] });
    await db.execute("INSERT INTO credential_batch_items(batch_id,target_id,preview_json,fingerprint) VALUES('synthetic-batch','synthetic-target','{}','synthetic-fingerprint')");
  });
  await blockedScenario('unknown-future-migration-refuses-old-runtime', 'UNKNOWN_DATABASE_MIGRATION', db => db.execute({ sql: 'INSERT INTO schema_migrations VALUES(?,?,?)', args: ['010-unknown-future.sql', 'SYNTHETIC UNKNOWN CHECKSUM', now] }));
  await blockedScenario('changed-migration-refuses-old-runtime', 'MIGRATION_CHECKSUM_MISMATCH', db => db.execute("UPDATE schema_migrations SET checksum='SYNTHETIC BAD CHECKSUM' WHERE name='008-program-intake.sql'"));
  passed('no-root-database-build-or-legacy-artifact-mutated', { createdOnlyExclusivePrivatePaths: true, productionRollbackPermitted: false });
} catch (error: any) {
  report.failures.push({ code: 'ROLLBACK_DRILL_FAILED', message: error?.code || error?.name || 'UnknownError' });
  // Full failure detail is retained only inside the new private directory; never print SQL/account material.
  if (directory) await writeFile(join(directory, 'failure-private.log'), String(error?.stack || error), { flag: 'wx', mode: 0o600 });
  process.exitCode = 1;
} finally {
  await stopServer(authServer); await stopOld(); await closeCurrent?.().catch(() => {});
  if (directory && childLog) await writeFile(join(directory, 'old-runtime-private.log'), childLog, { flag: 'wx', mode: 0o600 });
  const evidence = join(repository, 'artifacts/rollback'); await mkdir(evidence, { recursive: true });
  const output = join(evidence, `report-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`);
  await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
  if (directory) await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ report: relative(repository, output).replaceAll('\\', '/'), operationsPassed: operations.length, failures: report.failures.length, applicationRollbackAllowed: false }));
}
