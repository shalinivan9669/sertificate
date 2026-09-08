/** Explicit T017 staging tooling. Never imported by application runtime; never migrates a remote target. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client, type Transaction } from '@libsql/client/web';
import { requiredMigrations } from '../server/db/required-migrations';

export const fixtureFormat = 'ot-staging-cache-fixture-v1';
export const fixtureTables = ['user', 'account', 'program_versions', 'credential_templates', 'enrollments', 'lesson_progress', 'attempts', 'credentials', 'idempotency_keys', 'audit_events', 'outbox', 'notifications', 'operational_counters'] as const;
export type Cell = string | number | null;
export type Snapshot = { schema: { type: string; name: string; sql: string }[]; tables: { name: string; columns: string[]; rows: Cell[][] }[] };
export type Login = { id: string; email: string; name: string; password: string };
export const deploymentBinding = Object.freeze({
  deploymentId: '563KVkpwkXquxLvZpSN8JDdv2pW9',
  origin: 'https://sertificate-git-codex-ot-center-54086f-shalinivan9669s-projects.vercel.app',
  tursoHostname: 'dpl-563kvkpwkxquxlvzpsn8jd-vercel-icfg-sdl6ytmx76nmke0zqmjmkyct.aws-us-east-1.turso.io',
  hostedSourceSha: 'ca56882e15272833cd049d9a982e9e595931ef11',
});
export type PreparationSource = { workspaceHeadSha: string; workingTreeDirty: boolean; files: { path: string; sha256: string }[]; fingerprint: string };
export type Fixture = { format: string; runId: string; origin: string; createdAt: string; migrationGitSourceSha: string; deploymentBinding: typeof deploymentBinding; preparationSource: PreparationSource; baseline: Snapshot; snapshot: Snapshot; learners: [Login, Login]; enrollmentId: string; credentialId: string; pdfSha256: string };
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function previewOrigin(value: string) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.origin, deploymentBinding.origin, 'Only the explicitly reviewed preview origin is allowed');
  assert.ok(!url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/');
  return url.origin;
}
export function assertDeploymentAcknowledgment(env: NodeJS.ProcessEnv) {
  assert.equal(env.OT_STAGING_CACHE_DEPLOYMENT_ID, deploymentBinding.deploymentId, 'Confirm the observed preview deployment');
  assert.equal(env.OT_STAGING_CACHE_HOSTED_SOURCE_SHA, deploymentBinding.hostedSourceSha, 'Confirm its observed hosted commit');
}
export function stagingTarget(expectedHost: string, env: NodeJS.ProcessEnv = process.env) {
  assert.equal(env.OT_APP_ENV, 'staging'); assert.equal(env.OT_ALLOW_STAGING_CACHE_SEED, '1');
  assertDeploymentAcknowledgment(env);
  assert.ok(!env.VERCEL && !env.VERCEL_ENV && !env.TURSO_DATABASE_URL && !env.TURSO_AUTH_TOKEN, 'No deployed/default database context');
  assert.equal(expectedHost, deploymentBinding.tursoHostname, 'Only the reviewed deployment database is allowed');
  const url = new URL(env.OT_STAGING_CACHE_DATABASE_URL || '');
  assert.ok(['https:', 'libsql:'].includes(url.protocol)); assert.equal(url.hostname, expectedHost);
  assert.ok(!url.username && !url.password && !url.port && !url.search && !url.hash && ['', '/'].includes(url.pathname));
  assert.ok(env.OT_STAGING_CACHE_DATABASE_TOKEN, 'Dedicated preview credential required');
  return { url: url.href, authToken: env.OT_STAGING_CACHE_DATABASE_TOKEN };
}
export function gitMigrations(root: string) {
  const migrationGitSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
  assert.match(migrationGitSourceSha, /^[a-f0-9]{40}$/);
  assert.equal(requiredMigrations.length, 13);
  const migrations = requiredMigrations.map(name => {
    const bytes = execFileSync('git', ['show', `${migrationGitSourceSha}:server/db/migrations/${name}`], { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 });
    assert.ok(!bytes.includes(13), 'Migrations must be exact Git LF bytes'); return { name, bytes, checksum: digest(bytes) };
  });
  return { migrationGitSourceSha, migrations };
}
/** Fingerprints the actual local inputs; this is not a claim that dirty helpers ran at hostedSourceSha. */
export async function preparationSource(root: string): Promise<PreparationSource> {
  const workspaceHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
  const workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim());
  const paths = ['scripts/staging-cache-fixture.ts', 'scripts/staging-cache-local-worker.ts', 'scripts/db-backup.ts', 'package.json', 'package-lock.json'];
  for (const directory of ['server', 'shared']) {
    const entries = await readdir(resolve(root, directory), { recursive: true, withFileTypes: true });
    for (const entry of entries) if (entry.isFile() && /\.(?:ts|js|mjs|json)$/.test(entry.name)) {
      const absolute = resolve(entry.parentPath, entry.name);
      paths.push(absolute.slice(root.length + 1).replaceAll('\\', '/'));
    }
  }
  const files = await Promise.all([...new Set(paths)].sort().map(async path => ({ path, sha256: digest(await readFile(resolve(root, path))) })));
  return { workspaceHeadSha, workingTreeDirty, files, fingerprint: digest(JSON.stringify(files)) };
}
export async function ownedFixtureDirectory(directory: string) {
  const path = await realpath(directory); const name = basename(path); const runId = name.replace(/^staging-cache-/, '');
  assert.match(runId, uuid); assert.equal(name, 'staging-cache-' + runId);
  assert.equal(dirname(path), await realpath(resolve('.data'))); assert.equal(path, resolve(directory));
  assert.deepEqual(JSON.parse(await readFile(resolve(path, '.owner.json'), 'utf8')), { format: fixtureFormat, runId });
  return { directory: path, runId };
}
export async function prepareStagingFixture(originInput: string, runId: string = randomUUID()) {
  const origin = previewOrigin(originInput); assert.match(runId, uuid);
  assert.ok(!['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_STAGING_CACHE_DATABASE_TOKEN'].some(key => process.env[key]), 'Local preparation accepts no remote credentials');
  const root = resolve('.'); await mkdir(resolve(root, '.data'), { recursive: true });
  const directory = resolve(root, '.data', 'staging-cache-' + runId); await mkdir(directory, { recursive: false });
  await writeFile(resolve(directory, '.owner.json'), JSON.stringify({ format: fixtureFormat, runId }), { flag: 'wx', mode: 0o600 });
  const { migrationGitSourceSha, migrations } = gitMigrations(root); const inputs = await preparationSource(root);
  await writeFile(resolve(directory, 'preparation-source.json'), JSON.stringify(inputs, null, 2), { flag: 'wx', mode: 0o600 });
  const migrationDirectory = resolve(directory, 'migrations'); await mkdir(migrationDirectory);
  for (const migration of migrations) await writeFile(resolve(migrationDirectory, migration.name), migration.bytes, { flag: 'wx', mode: 0o600 });
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(OT_|BETTER_AUTH_|NUXT_|NITRO_|VERCEL|TURSO_|AMO_|SMTP_|MAIL_FROM$|CRON_|DATABASE_)/.test(key) || /TOKEN|SECRET|PASSWORD|API_KEY/.test(key)) delete env[key];
  Object.assign(env, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_STAGING_CACHE_LOCAL: '1', OT_STAGING_CACHE_DIRECTORY: directory, OT_STAGING_CACHE_MIGRATION_GIT_SOURCE_SHA: migrationGitSourceSha,
    OT_DATABASE_PATH: resolve(directory, 'fixture.sqlite'), OT_MIGRATIONS_DIR: migrationDirectory, NUXT_PUBLIC_SITE_URL: origin,
    OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_ANALYTICS_ENABLED: '0', OT_INVOICE_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled' });
  const log = createWriteStream(resolve(directory, 'prepare-private.log'), { flags: 'wx', mode: 0o600 });
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/staging-cache-local-worker.ts'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); const [code] = await once(child, 'exit'); log.end(); assert.equal(code, 0, 'Local fixture preparation failed; diagnostics private');
  assert.equal((await preparationSource(root)).fingerprint, inputs.fingerprint, 'Preparation inputs changed during execution');
  const fixture = await readFixture(directory); const summary = { format: fixtureFormat, runId, migrationGitSourceSha, deploymentBinding, preparationSource: inputs, origin, createdAt: fixture.createdAt,
    fixtureSha256: digest(await readFile(resolve(directory, 'fixture-private.json'))), users: 5, loginAccounts: 2, seededSessions: 0, syntheticDocuments: 1,
    migrations: migrations.map(({ name, checksum }) => ({ name, checksum })), rows: fixture.snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0), externalDelivery: false };
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(summary, null, 2), { flag: 'wx', mode: 0o600 }); return { directory, ...summary };
}
export function validateFixture(fixture: Fixture) {
  assert.equal(fixture.format, fixtureFormat); assert.match(fixture.runId, uuid); previewOrigin(fixture.origin);
  assert.match(fixture.migrationGitSourceSha, /^[a-f0-9]{40}$/); assert.deepEqual(fixture.deploymentBinding, deploymentBinding);
  assert.equal(fixture.migrationGitSourceSha, fixture.preparationSource.workspaceHeadSha);
  assert.match(fixture.preparationSource.workspaceHeadSha, /^[a-f0-9]{40}$/); assert.equal(typeof fixture.preparationSource.workingTreeDirty, 'boolean');
  assert.ok(fixture.preparationSource.files.length > 5); assert.equal(new Set(fixture.preparationSource.files.map(item => item.path)).size, fixture.preparationSource.files.length);
  for (const item of fixture.preparationSource.files) { assert.match(item.path, /^(?:server\/|shared\/|scripts\/|package(?:-lock)?\.json$)/); assert.ok(!item.path.split('/').includes('..') && !item.path.includes('\\')); assert.match(item.sha256, /^[a-f0-9]{64}$/); }
  assert.equal(fixture.preparationSource.fingerprint, digest(JSON.stringify(fixture.preparationSource.files)));
  assert.ok(Number.isFinite(Date.parse(fixture.createdAt)) && Date.parse(fixture.createdAt) <= Date.now() + 60000);
  assert.ok(Array.isArray(fixture.baseline.tables) && fixture.baseline.tables.length === 49 && Array.isArray(fixture.snapshot.tables));
  assert.deepEqual(fixture.snapshot.schema, fixture.baseline.schema); assert.equal(fixture.snapshot.tables.length, 49);
  const table = (snapshot: Snapshot, name: string) => { const value = snapshot.tables.find(item => item.name === name); assert.ok(value); return value; };
  assert.equal(new Set(fixture.snapshot.tables.map(item => item.name)).size, 49);
  for (const item of fixture.snapshot.tables) {
    const base = table(fixture.baseline, item.name); assert.deepEqual(item.columns, base.columns); assert.ok(item.rows.length <= 200);
    for (const row of item.rows) { assert.equal(row.length, item.columns.length); assert.ok(row.every(value => value === null || typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value))); }
    if (!fixtureTables.includes(item.name as typeof fixtureTables[number])) assert.deepEqual(item.rows, base.rows);
    if (!['programs', 'schema_migrations'].includes(item.name)) assert.equal(base.rows.length, 0);
  }
  assert.equal(table(fixture.baseline, 'programs').rows.length, 20); assert.equal(table(fixture.baseline, 'schema_migrations').rows.length, 13);
  const objects = (name: string) => { const item = table(fixture.snapshot, name); return item.rows.map(row => Object.fromEntries(item.columns.map((key, i) => [key, row[i]]))); };
  const users = objects('user'), accounts = objects('account'); assert.equal(users.length, 5); assert.equal(accounts.length, 2); assert.equal(fixture.learners.length, 2);
  assert.equal(new Set(fixture.learners.map(user => user.id)).size, 2); assert.equal(new Set(fixture.learners.map(user => user.password)).size, 2);
  for (const learner of fixture.learners) {
    assert.match(learner.id, uuid); assert.ok(learner.email.endsWith('@example.test') && learner.email.includes(fixture.runId)); assert.ok(learner.password.length >= 32);
    const user = users.find(user => user.id === learner.id); assert.ok(user); assert.equal(user.role, 'learner'); assert.equal(user.emailVerified, 1); assert.equal(user.name, learner.name); assert.equal(user.email, learner.email);
    assert.ok(accounts.some(account => account.userId === user.id && account.providerId === 'credential' && typeof account.password === 'string'));
  }
  assert.deepEqual(users.filter(user => !fixture.learners.some(learner => learner.id === user.id)).map(user => user.role).sort(), ['editor', 'issuer', 'reviewer']);
  for (const name of ['session', 'verification', 'twoFactor', 'payments', 'orders', 'refunds', 'lead_submissions']) assert.equal(objects(name).length, 0);
  assert.equal(objects('program_versions').length, 1); assert.equal(objects('enrollments').length, 1); assert.equal(objects('attempts').length, 1); assert.equal(objects('credentials').length, 1);
  assert.equal(objects('enrollments')[0]!.id, fixture.enrollmentId); assert.equal(objects('enrollments')[0]!.user_id, fixture.learners[0].id);
  const credential = objects('credentials')[0]!; assert.equal(credential.id, fixture.credentialId); assert.equal(credential.enrollment_id, fixture.enrollmentId); assert.equal(credential.status, 'issued');
  const document = Buffer.from(String(credential.document_base64), 'base64'); assert.equal(document.subarray(0, 5).toString(), '%PDF-'); assert.equal(digest(document), fixture.pdfSha256);
  for (const job of objects('outbox')) assert.ok(['learning.enrolled', 'assessment.graded', 'credential.render', 'notification.credential'].includes(String(job.type)));
  for (const counter of objects('operational_counters')) { assert.equal(counter.metric, 'outbox_delivered'); assert.ok(Number(counter.count) <= 10); }
  for (const user of users) assert.ok(String(user.name).startsWith('SYNTHETIC '));
  return fixture;
}
export async function readFixture(directory: string) {
  const owned = await ownedFixtureDirectory(directory); const bytes = await readFile(resolve(owned.directory, 'fixture-private.json')); assert.ok(bytes.length <= 4 * 1024 * 1024);
  const fixture = validateFixture(JSON.parse(bytes.toString('utf8'))); assert.equal(fixture.runId, owned.runId); return fixture;
}
async function verifyEmptyTarget(tx: Client | Transaction, fixture: Fixture) {
  const schema = (await tx.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name")).rows;
  assert.deepEqual(JSON.parse(JSON.stringify(schema)), fixture.baseline.schema, 'Schema must exactly match prepared Git migrations');
  const counts = (await tx.execute(`SELECT ${fixture.baseline.tables.map(table => `(SELECT COUNT(*) FROM ${quote(table.name)}) AS ${quote(table.name)}`).join(',')}`)).rows[0]!;
  for (const table of fixture.baseline.tables) {
    assert.equal(Number(counts[table.name]), table.rows.length, 'Dedicated target must contain exactly baseline rows');
    if (!['programs', 'schema_migrations'].includes(table.name)) continue;
    const result = await tx.execute(`SELECT * FROM ${quote(table.name)}`);
    assert.deepEqual(result.columns, table.columns);
    const ignored = table.name === 'programs' ? 'created_at' : 'applied_at'; const keep = table.columns.map((name, index) => name === ignored ? -1 : index).filter(index => index >= 0);
    const normalize = (rows: unknown[][]) => rows.map(row => JSON.stringify(keep.map(index => row[index]))).sort();
    assert.deepEqual(normalize(result.rows.map(row => Array.from(row))), normalize(table.rows));
  }
}
/** Exported separately so isolated file-backed tests can exercise the exact remote transaction body. */
export async function insertFixtureTransaction(db: Client, fixture: Fixture) {
  validateFixture(fixture); assert.equal(Number((await db.execute('PRAGMA foreign_keys')).rows[0]![0]), 1);
  const tx = await db.transaction('write'); let commitAttempted = false;
  try {
    await verifyEmptyTarget(tx, fixture);
    for (const name of fixtureTables) {
      const table = fixture.snapshot.tables.find(table => table.name === name)!;
      for (const row of table.rows) await tx.execute({ sql: `INSERT INTO ${quote(name)}(${table.columns.map(quote).join(',')}) VALUES(${table.columns.map(() => '?').join(',')})`, args: row });
    }
    await tx.execute({ sql: 'INSERT INTO audit_events(id,action,target,reason,created_at) VALUES(?,?,?,?,?)', args: [randomUUID(), 'staging.cache_fixture_imported', fixture.runId, 'SYNTHETIC isolated T017 fixture; no production validity', new Date().toISOString()] });
    assert.equal((await tx.execute('PRAGMA foreign_key_check')).rows.length, 0);
    commitAttempted = true; await tx.commit(); return { imported: true, transactionCallbacks: 1, seededSessions: 0 };
  } catch (error) { if (!tx.closed) { try { await tx.rollback(); } catch { /* Commit outcome may be unknown; never replay or clean domain rows automatically. */ } } throw Object.assign(new Error('STAGING_FIXTURE_IMPORT_FAILED'), { cause: error, commitAttempted }); }
  finally { tx.close(); }
}
export async function importStagingFixture(directory: string, expectedHost: string) {
  const target = stagingTarget(expectedHost); const fixture = await readFixture(directory); const { migrations } = gitMigrations(resolve('.'));
  const baseline = fixture.baseline.tables.find(table => table.name === 'schema_migrations')!;
  assert.deepEqual(baseline.rows.map(row => [row[baseline.columns.indexOf('name')], row[baseline.columns.indexOf('checksum')]]).sort(), migrations.map(item => [item.name, item.checksum]).sort());
  const expectedManifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  assert.deepEqual(expectedManifest.deploymentBinding, deploymentBinding); assert.equal(expectedManifest.migrationGitSourceSha, fixture.migrationGitSourceSha);
  assert.deepEqual(expectedManifest.preparationSource, fixture.preparationSource);
  const sourceHash = digest(await readFile(resolve(directory, 'fixture-private.json'))); assert.equal(expectedManifest.fixtureSha256, sourceHash);
  // Exclusive attempt marker prevents blindly replaying a prior/ambiguous import.
  const reportPath = resolve(directory, 'import-report.json'); const startedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify({ status: 'started', startedAt, expectedHost, deploymentBinding }), { flag: 'wx', mode: 0o600 });
  const client = createClient({ ...target, intMode: 'number' });
  try {
    const result = await insertFixtureTransaction(client, fixture); assert.equal(digest(await readFile(resolve(directory, 'fixture-private.json'))), sourceHash);
    const report = { status: 'passed', startedAt, finishedAt: new Date().toISOString(), expectedHost, deploymentBinding, runId: fixture.runId, fixtureSha256: sourceHash, preparationFingerprint: fixture.preparationSource.fingerprint, ...result, remoteMigrationsExecuted: 0, externalDelivery: false };
    await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 }); return report;
  } catch (error) {
    const diagnostic = error instanceof Error ? error.stack || error.message : 'Unknown failure';
    await writeFile(resolve(directory, 'import-failure-private.log'), diagnostic, { flag: 'wx', mode: 0o600 });
    await writeFile(reportPath, JSON.stringify({ status: 'failed', code: 'STAGING_FIXTURE_IMPORT_FAILED', diagnosticSha256: digest(diagnostic), commitOutcome: (error as { commitAttempted?: boolean }).commitAttempted ? 'unknown' : 'not_committed', startedAt, finishedAt: new Date().toISOString() }), { mode: 0o600 }); throw new Error('STAGING_FIXTURE_IMPORT_FAILED');
  } finally { client.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [operation, first, second] = process.argv.slice(2);
    if (operation === 'prepare' && first && !second) { const result = await prepareStagingFixture(first); console.log(JSON.stringify({ status: 'prepared', directory: result.directory, runId: result.runId, loginAccounts: 2, externalDelivery: false })); }
    else if (operation === 'import' && first && second) console.log(JSON.stringify(await importStagingFixture(first, second)));
    else throw new Error('Invalid command');
  } catch { console.error(JSON.stringify({ status: 'failed', code: 'STAGING_CACHE_TOOL_FAILED' })); process.exitCode = 1; }
}
