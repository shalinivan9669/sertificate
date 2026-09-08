/** Isolated backward-data diagnostic. This never authorizes an old application as a live writer. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { createApp, toNodeListener } from 'h3';
import { createClient, type Client } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';
import { assessLegacyRollback, inspectLegacyArtifact } from './rollback-preflight';
import { exportDatabase, restoreDatabase } from './db-backup';
import { requiredMigrations } from '../server/db/required-migrations';

const repository = resolve(fileURLToPath(new URL('../', import.meta.url)));
const operations: { name: string; passed: boolean; detail?: unknown }[] = [];
const report: any = { checkedAt: new Date().toISOString(), scope: 'Fresh synthetic local databases on the current required schema. Current auth over HTTP, snapshot/restore/migration replay and strict refusal of the incompatible preserved legacy artifact. No legacy runtime is started, no live deployment or write rollback approval.', applicationRollbackAllowed: false, legacyRuntime: { started: false, httpRequests: 0, status: 'not_run', reason: 'Current schema must pass the unchanged legacy preflight before any legacy diagnostic; unknown migrations cannot be whitelisted by this harness.' }, operations, blockers: [], failures: [], privateOutputs: 'Raw fixture databases and cookie values remain private; report has no credentials, session IDs, question bank or learner body contents.' };
let directory = '', authServer: Server | undefined;
let closeCurrent: (() => Promise<void>) | undefined;
const privateSecret = randomBytes(48).toString('base64url');
const password = randomBytes(24).toString('base64url') + '!TEST';
function passed(name: string, detail?: unknown) { operations.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(JSON.stringify({ operation: name, passed: true })); }
function within(root: string, path: string) { const rel = relative(root, resolve(path)); assert.ok(rel && !isAbsolute(rel) && !rel.startsWith('..' + sep) && rel !== '..' && !resolve(path).includes('\0'), 'A strict child path is required'); }
async function reserve(path: string) { within(directory, path); const handle = await open(path, 'wx', 0o600); await handle.close(); }
const localClient = (path: string) => { within(directory, path); return createClient({ url: `file:${path.replaceAll('\\', '/')}`, concurrency: 1 }); };
async function listen(server: Server) {
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const address = server.address(); assert.ok(address && typeof address === 'object'); return `http://127.0.0.1:${address.port}`;
}
async function stopServer(server?: Server) { if (server) await new Promise<void>(done => server.close(() => done())); }
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
  const currentMigrations = join(directory, 'current-migrations');
  await mkdir(currentMigrations);
  // Fixture services and migration files must come from the same checkout.
  // This does not change the independently reviewed legacy capability manifest.
  const names = [...requiredMigrations];
  for (const name of names) {
    const content = await readFile(join(repository, 'server/db/migrations', name));
    await writeFile(join(currentMigrations, name), content, { flag: 'wx' });
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
  passed('current-source-seeds-only-new-synthetic-database', { migrations: names, verifiedLearners: 1, publishedSyntheticVersions: 1, existingCompletedLessons: 1 });

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
  passed('copy-restore-and-current-migration-replay-preserves-all-rows', { migrations: names, tables: snapshot.tables.length, rows: snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0) });
  const controlFree = await assessLegacyRollback(artifact.root, copyPath, currentMigrations);
  assert.equal(controlFree.applicationRollbackAllowed, false); assert.equal(controlFree.isolatedReadDiagnosticAllowed, false);
  assert.ok(controlFree.blockers.some(item => item.code === 'UNKNOWN_DATABASE_MIGRATION' && item.migration === '010-observability.sql'), 'Current schema 010 must block legacy diagnostic startup without changing its capabilities');
  report.controlFreePreflight = controlFree;
  passed('current-schema-010-refuses-even-control-free-legacy-diagnostic', { oldRuntimeStarted: false, oldHttpRequests: 0 });
  const afterClient = localClient(copyPath); let afterSnapshot: Awaited<ReturnType<typeof exportDatabase>>;
  try { afterSnapshot = await exportDatabase(afterClient); } finally { afterClient.close(); }
  assert.deepEqual(afterSnapshot.tables, snapshot.tables, 'Refusal must not alter any academic, auth, audit, outbox or migration data');
  passed('refused-legacy-start-preserves-every-table-and-row', { tables: snapshot.tables.length, changedTables: [] });

  async function blockedScenario(name: string, expectedCode: string, mutate: (db: Client) => Promise<unknown>, expectedMigration?: string) {
    const path = await newCopy(snapshot, name); const db = localClient(path);
    try { await mutate(db); } finally { db.close(); }
    const assessment = await assessLegacyRollback(artifact.root, path, currentMigrations);
    assert.equal(assessment.applicationRollbackAllowed, false); assert.equal(assessment.isolatedReadDiagnosticAllowed, false);
    assert.ok(assessment.blockers.some(item => item.code === expectedCode && (!expectedMigration || item.migration === expectedMigration)), 'Each fixture must trigger its own expected blocker, not merely the baseline schema 010 refusal');
    report.blockers.push({ scenario: name, code: expectedCode, ...(expectedMigration ? { migration: expectedMigration } : {}), oldRuntimeStarted: false }); passed(name, { oldRuntimeStarted: false });
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
  await blockedScenario('unknown-future-migration-refuses-old-runtime', 'UNKNOWN_DATABASE_MIGRATION', db => db.execute({ sql: 'INSERT INTO schema_migrations VALUES(?,?,?)', args: ['999-unknown-future.sql', 'SYNTHETIC UNKNOWN CHECKSUM', now] }), '999-unknown-future.sql');
  await blockedScenario('changed-migration-refuses-old-runtime', 'MIGRATION_CHECKSUM_MISMATCH', db => db.execute("UPDATE schema_migrations SET checksum='SYNTHETIC BAD CHECKSUM' WHERE name='008-program-intake.sql'"));
  const finalSource = localClient(sourcePath);
  try { assert.deepEqual((await exportDatabase(finalSource)).tables, initial.tables, 'The seeded source stays unchanged while diagnostics use new copies'); } finally { finalSource.close(); }
  assert.equal((await inspectLegacyArtifact(artifact.root)).serverFingerprint, artifact.serverFingerprint);
  passed('no-root-database-build-or-legacy-artifact-mutated', { createdOnlyExclusivePrivatePaths: true, productionRollbackPermitted: false, originalSyntheticSourceRowsPreserved: true, legacyFingerprintPreserved: true });
} catch (error: any) {
  report.failures.push({ code: 'ROLLBACK_DRILL_FAILED', message: error?.code || error?.name || 'UnknownError' });
  // Full failure detail is retained only inside the new private directory; never print SQL/account material.
  if (directory) await writeFile(join(directory, 'failure-private.log'), String(error?.stack || error), { flag: 'wx', mode: 0o600 });
  process.exitCode = 1;
} finally {
  await stopServer(authServer); await closeCurrent?.().catch(() => {});
  const evidence = join(repository, 'artifacts/rollback'); await mkdir(evidence, { recursive: true });
  const output = join(evidence, `report-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`);
  await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
  if (directory) await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ report: relative(repository, output).replaceAll('\\', '/'), operationsPassed: operations.length, failures: report.failures.length, applicationRollbackAllowed: false }));
}
