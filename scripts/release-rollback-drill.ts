/** Executable isolated rollback of a rebuilt prior release; never a production deployment. */
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile, readdir, realpath, stat, open } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createClient } from '@libsql/client';
import { exportDatabase, encryptBackup, decryptBackup, restoreDatabase } from './db-backup';
import { seedReleaseRollback } from '../tests/release-rollback-fixture';

const repository = resolve(fileURLToPath(new URL('../', import.meta.url)));
const releases = { old: 'a304ae5b28b61cb7b2c2a6f5fbef566f4451a7cb', current: 'f07438557a46649a5360ea99cc419d06f764fc5f' } as const;
const run = promisify(execFile);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const report: any = { startedAt: new Date().toISOString(), scope: 'Isolated synthetic local staging. Rebuild exact previous/current release commits; populated 010→012 expansion; encrypted backup and new-file restore; previous compiled HTTP writer then current compiled runtime. Not Vercel rollback, hosted artifact-byte recovery or production RTO/RPO.', releases, externalDelivery: false, productionMutations: false, checks: [], http: [], timings: {}, failures: [] };
let directory = '', attemptDirectory = '', server: ChildProcess | undefined, currentPhase = 'setup';
const environment: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(environment)) if (/^(?:OT_|BETTER_AUTH_|NUXT_|NITRO_|VERCEL|TURSO_|AMO_|SMTP_|MAIL_FROM$|CRON_|DATABASE_|HOST$|PORT$)/.test(key) || /TOKEN|SECRET|PASSWORD|API_KEY/.test(key)) delete environment[key];
Object.assign(environment, { NODE_ENV: 'test', OT_APP_ENV: 'test', OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled', OT_INVOICE_ENABLED: '0', OT_ANALYTICS_ENABLED: '0', CI: 'true' });
function childPath(root: string, target: string) { const path = relative(root, resolve(target)); assert.ok(path && !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep), 'Strict private child path required'); }
function passed(name: string, detail?: unknown) { report.checks.push({ name, passed: true, detail }); console.log(JSON.stringify({ phase: currentPhase, check: name, passed: true })); }
async function command(command: string, args: string[], cwd: string, name: string, env = environment) {
  const output = join(directory, `${name}-${randomUUID()}.log`); const log = createWriteStream(output, { flags: 'wx' });
  const started = performance.now(); const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout!.pipe(log, { end: false }); child.stderr!.pipe(log, { end: false });
  const timeout = setTimeout(() => child.kill(), 900000);
  try { const [code] = await once(child, 'exit'); assert.equal(code, 0, `${name} must succeed; private log ${output}`); }
  finally { clearTimeout(timeout); log.end(); }
  return { elapsedMs: Math.round(performance.now() - started), log: relative(repository, output).replaceAll('\\', '/') };
}
async function git(...args: string[]) { return (await run('git', args, { cwd: repository, windowsHide: true, maxBuffer: 16 * 1024 * 1024 })).stdout.trim(); }
async function sourceManifest(source: string, commit: string) {
  const entries = (await git('ls-tree', '-r', '-z', '--format=%(objectname) %(path)', commit)).split('\0').filter(Boolean);
  const checked: { path: string; gitBlob: string }[] = [];
  for (const entry of entries) {
    const split = entry.indexOf(' '); const blob = entry.slice(0, split), path = entry.slice(split + 1); const data = await readFile(join(source, path));
    assert.equal(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex'), blob, 'Tracked source differs from exact release: ' + path);
    checked.push({ path, gitBlob: blob });
  }
  return { commit, tree: await git('rev-parse', `${commit}^{tree}`), trackedFiles: checked.length, manifestSha256: sha(JSON.stringify(checked)), lockfileSha256: sha(await readFile(join(source, 'package-lock.json'))) };
}
async function artifactManifest(source: string) {
  const base = join(source, '.output'); const files: { path: string; sha256: string; bytes: number }[] = [];
  async function walk(path: string) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isSymbolicLink()) {
        const target = await realpath(file); childPath(base, target);
        files.push({ path: relative(base, file).replaceAll('\\', '/'), sha256: sha('internal-link:' + relative(base, target).replaceAll('\\', '/')), bytes: 0 });
      }
      else if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) { const bytes = await readFile(file); files.push({ path: relative(base, file).replaceAll('\\', '/'), sha256: sha(bytes), bytes: bytes.length }); }
    }
  }
  await walk(base);
  const build = JSON.parse(await readFile(join(base, 'public/_nuxt/builds/latest.json'), 'utf8'));
  return { buildId: build.id, files: files.length, bytes: files.reduce((sum, value) => sum + value.bytes, 0), manifestSha256: sha(JSON.stringify(files)) };
}
async function build(label: keyof typeof releases) {
  const source = join(directory, label); const manifestPath = join(directory, `${label}-build.json`);
  try {
    const saved = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.deepEqual(await sourceManifest(source, releases[label]), saved.source);
    assert.deepEqual(await artifactManifest(source), saved.artifact);
    passed(label + '-reuse-verified-completed-build', saved); return { sourceDirectory: source, ...saved };
  } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  try { await stat(source); await sourceManifest(source, releases[label]); }
  catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
    await mkdir(source);
    const archive = join(directory, `${label}.tar`);
    await git('-c', 'core.autocrlf=false', 'archive', '--format=tar', `--output=${archive}`, releases[label]);
    await command('tar', ['-xf', archive, '-C', source], directory, label + '-extract');
  }
  const provenance = await sourceManifest(source, releases[label]);
  const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  currentPhase = label + '-install'; console.log(JSON.stringify({ phase: currentPhase }));
  const install = await command(process.execPath, [npm, 'ci', '--include=dev', '--no-audit', '--no-fund'], source, label + '-install');
  currentPhase = label + '-build'; console.log(JSON.stringify({ phase: currentPhase }));
  const buildTime = await command(process.execPath, [npm, 'run', 'build'], source, label + '-build', { ...environment, NODE_ENV: 'production', OT_BUILD_MODE: '1', NITRO_PRESET: 'node-server' });
  assert.deepEqual(await sourceManifest(source, releases[label]), provenance);
  const artifact = await artifactManifest(source);
  const saved = { source: provenance, artifact, install, build: buildTime };
  await writeFile(manifestPath, JSON.stringify(saved, null, 2), { flag: 'wx' });
  passed(label + '-exact-commit-rebuild', saved); return { sourceDirectory: source, ...saved };
}
async function stop() {
  if (!server) return;
  const child = server; server = undefined;
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
}
async function start(source: string, database: string, origin: string, secret: string, label: string) {
  assert.ok(!server); childPath(attemptDirectory, database);
  const log = createWriteStream(join(attemptDirectory, label + '.log'), { flags: 'wx' });
  server = spawn(process.execPath, [join(source, '.output/server/index.mjs')], { cwd: source, env: { ...environment, HOST: '127.0.0.1', PORT: new URL(origin).port, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, NUXT_PUBLIC_SITE_URL: origin, OT_DATABASE_PATH: database, OT_MIGRATIONS_DIR: join(source, 'server/db/migrations') }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout!.pipe(log, { end: false }); server.stderr!.pipe(log, { end: false }); server.once('exit', () => log.end());
  for (let index = 0; index < 120; index++) {
    assert.equal(server.exitCode, null, label + ' must remain running');
    try { const response = await fetch(origin + '/api/ready', { signal: AbortSignal.timeout(1000) }); if (response.ok && (await response.json()).status === 'ready') return; } catch { /* bounded startup */ }
    await sleep(250);
  }
  throw new Error(label + ' readiness deadline exceeded');
}
type Snapshot = Awaited<ReturnType<typeof exportDatabase>>;
async function snapshot(path: string) { const db = createClient({ url: 'file:' + path.replaceAll('\\', '/'), concurrency: 1 }); try { return await exportDatabase(db); } finally { db.close(); } }
function objects(table: Snapshot['tables'][number]) { return table.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column, row[index]]))); }
function summary(value: Snapshot) { return { tables: value.tables.length, rows: value.tables.reduce((sum, table) => sum + table.rows.length, 0), schemaSha256: sha(JSON.stringify(value.schema)), tablesSha256: sha(JSON.stringify(value.tables)), counts: Object.fromEntries(value.tables.map(table => [table.name, table.rows.length])) }; }

try {
  assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.OT_ALLOW_RELEASE_ROLLBACK_DRILL, '1');
  report.harnessSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
  report.fixtureSha256 = sha(await readFile(join(repository, 'tests/release-rollback-fixture.ts')));
  assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN, 'Refuse remote/production environment');
  const args = process.argv.slice(2); assert.ok(args.length === 0 || args.length === 2 && args[0] === '--resume', 'Only an existing owned build directory may be resumed');
  const privateRoot = join(repository, '.data'); await mkdir(privateRoot, { recursive: true }); assert.equal((await realpath(privateRoot)).toLowerCase(), privateRoot.toLowerCase());
  if (args.length) {
    directory = await realpath(resolve(args[1]!)); childPath(privateRoot, directory);
    const marker = JSON.parse(await readFile(join(directory, 'RELEASE-ROLLBACK-RUN.json'), 'utf8')); assert.deepEqual(marker.releases, releases); assert.equal(marker.kind, 'SYNTHETIC_RELEASE_ROLLBACK');
  } else {
    directory = await mkdtemp(join(privateRoot, 'release-rollback-'));
    await writeFile(join(directory, 'RELEASE-ROLLBACK-RUN.json'), JSON.stringify({ kind: 'SYNTHETIC_RELEASE_ROLLBACK', releases }), { flag: 'wx' });
  }
  console.log(JSON.stringify({ privateDirectory: relative(repository, directory).replaceAll('\\', '/') }));
  const old = await build('old'); const current = await build('current'); report.artifacts = { old, current };
  assert.equal(old.source.lockfileSha256, current.source.lockfileSha256);
  assert.equal(await git('rev-parse', `${releases.old}:server/db/required-migrations.ts`), await git('rev-parse', `${releases.current}:server/db/required-migrations.ts`));
  for (const name of (await readdir(join(current.sourceDirectory, 'server/db/migrations'))).filter(name => name.endsWith('.sql'))) assert.deepEqual(await readFile(join(old.sourceDirectory, 'server/db/migrations', name)), await readFile(join(current.sourceDirectory, 'server/db/migrations', name)));
  currentPhase = 'fixture'; attemptDirectory = await mkdtemp(join(directory, 'attempt-'));
  const sourceDb = join(attemptDirectory, 'source.sqlite'), restoredDb = join(attemptDirectory, 'restored.sqlite');
  await (await open(sourceDb, 'wx')).close();
  const secret = randomBytes(48).toString('base64url'), password = randomBytes(24).toString('base64url') + '!';
  const fixture = await seedReleaseRollback(current.sourceDirectory, attemptDirectory, sourceDb, password);
  passed('populated-010-to-012-preserves-all-historical-values', { baseline: fixture.baseline, target: fixture.target, historicalRows: fixture.historicalRows, oldTables: fixture.oldTableCount, expandedTables: fixture.expandedTableCount });
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = (probe.address() as { port: number }).port; await new Promise<void>(done => probe.close(() => done()));
  const origin = `http://127.0.0.1:${port}`; const jars = { learner: new Map<string, string>(), outsider: new Map<string, string>() };
  async function request(label: string, path: string, options: { method?: string; body?: unknown; user?: keyof typeof jars; status?: number; key?: string; bytes?: boolean } = {}) {
    const user = options.user || 'learner', method = options.method || 'GET';
    const headers: Record<string, string> = { Origin: origin, Cookie: [...jars[user]].map(([key, value]) => `${key}=${value}`).join('; ') };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.key) headers['Idempotency-Key'] = options.key;
    const response = await fetch(origin + path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'manual', signal: AbortSignal.timeout(12000) });
    for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0]!, index = pair.indexOf('='); jars[user].set(pair.slice(0, index), pair.slice(index + 1)); }
    report.http.push({ phase: currentPhase, label, method, status: response.status });
    assert.equal(response.status, options.status || 200, label);
    assert.match(response.headers.get('cache-control') || '', /no-store/, label + ' private response');
    return options.bytes ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  currentPhase = 'current-before-rollback'; await start(current.sourceDirectory, sourceDb, origin, secret, 'current-before');
  for (const user of ['learner', 'outsider'] as const) await request('real-sign-in-' + user, '/api/auth/sign-in/email', { user, method: 'POST', body: { email: `${user}@rollback.example.test`, password } });
  const session = await request('current-session', '/api/auth/get-session'); assert.equal(session.user.id, fixture.ids.learner);
  const enrollmentPath = `/api/v1/enrollments/${fixture.activeEnrollment}`;
  await request('current-complete-lesson', enrollmentPath + '/progress/rollback-lesson', { method: 'PUT', body: { completed: true, revision: 0 } });
  let attempt = await request('current-start-attempt', enrollmentPath + '/attempts', { method: 'POST', body: {}, key: randomUUID() });
  attempt = await request('current-save-first-answer', `/api/v1/attempts/${attempt.id}/answers/${attempt.questions[0].id}`, { method: 'PUT', body: { revision: attempt.revision, selectedOptionIds: ['right'] } });
  const leadKey = randomUUID(), leadBody = { email: 'accepted@rollback.example.test', organizationName: 'SYNTHETIC continuity lead' };
  const lead = await request('current-accept-lead', '/api/amo-lead', { method: 'POST', body: leadBody, key: leadKey, status: 202 });
  assert.equal(sha(await request('current-download-historical-document', `/api/v1/credentials/${fixture.ids.credential}/download`, { bytes: true })), fixture.documentHash);
  const originalOrder = await request('current-reads-historical-money-record', `/api/v1/orders/${fixture.ids.order}`); assert.equal(originalOrder.order.amountMinor, 125000);
  await stop(); passed('current-compiled-http-created-session-progress-draft-and-durable-lead');
  currentPhase = 'backup-restore';
  const recoveryStarted = performance.now(), backupStarted = performance.now(), archive = join(attemptDirectory, 'backup.otb'), backupPassword = randomBytes(32).toString('base64url');
  const before = await snapshot(sourceDb); await writeFile(archive, encryptBackup(before, backupPassword), { flag: 'wx', mode: 0o600 });
  report.timings.backupMs = Math.round(performance.now() - backupStarted);
  const restoreStarted = performance.now(); const decoded = decryptBackup(await readFile(archive), backupPassword); await (await open(restoredDb, 'wx')).close();
  const restoredClient = createClient({ url: 'file:' + restoredDb.replaceAll('\\', '/'), concurrency: 1 }); try { await restoreDatabase(restoredClient, decoded); } finally { restoredClient.close(); }
  report.timings.restoreMs = Math.round(performance.now() - restoreStarted);
  const verified = await snapshot(restoredDb); assert.deepEqual(verified.schema, before.schema); assert.deepEqual(verified.tables, before.tables);
  report.snapshot = summary(before); report.encryptedBackup = { bytes: (await stat(archive)).size, sha256: sha(await readFile(archive)) };
  passed('encrypted-backup-new-file-restore-exact-all-tables', report.snapshot);
  currentPhase = 'old-compiled-writer'; const startOld = performance.now(); await start(old.sourceDirectory, restoredDb, origin, secret, 'old-writer'); report.timings.oldStartupReadyMs = Math.round(performance.now() - startOld);
  const oldSession = await request('old-preserves-real-session', '/api/auth/get-session'); assert.equal(oldSession.session.id, session.session.id); assert.equal(oldSession.user.id, fixture.ids.learner);
  report.timings.backupToAuthenticatedOldReadyMs = Math.round(performance.now() - recoveryStarted);
  const details = await request('old-preserves-progress-and-version', enrollmentPath); assert.equal(details.versionId, fixture.ids.version); assert.equal(details.progress.completed, 1);
  const oldAttempt = await request('old-preserves-draft-form-deadline', `/api/v1/attempts/${attempt.id}`);
  for (const key of ['id', 'enrollmentId', 'deadlineAt', 'revision', 'questions', 'answers', 'status']) assert.deepEqual(oldAttempt[key], attempt[key], key);
  await request('old-rejects-new-intake-while-existing-access-survives', '/api/v1/enrollments', { user: 'outsider', method: 'POST', body: { versionId: fixture.ids.version }, key: randomUUID(), status: 409 });
  await request('old-denies-learner-admin-access', '/api/v1/admin/users', { status: 403 });
  await request('old-rejects-stale-answer', `/api/v1/attempts/${attempt.id}/answers/${attempt.questions[1].id}`, { method: 'PUT', body: { revision: 0, selectedOptionIds: ['right'] }, status: 409 });
  const saved = await request('old-writes-next-answer', `/api/v1/attempts/${attempt.id}/answers/${attempt.questions[1].id}`, { method: 'PUT', body: { revision: attempt.revision, selectedOptionIds: ['right'] } }); assert.equal(saved.revision, attempt.revision + 1);
  const graded = await request('old-submits-server-exam', `/api/v1/attempts/${attempt.id}/submit`, { method: 'POST', body: {} }); assert.equal(graded.status, 'graded'); assert.equal(graded.result.pass, true); assert.equal(graded.result.score, 100);
  assert.deepEqual((await request('old-repeated-submit-same-result', `/api/v1/attempts/${attempt.id}/submit`, { method: 'POST', body: {} })).result, graded.result);
  assert.deepEqual(await request('old-replays-original-lead-key', '/api/amo-lead', { method: 'POST', body: leadBody, key: leadKey, status: 202 }), lead);
  assert.equal(sha(await request('old-download-preserves-document-bytes', `/api/v1/credentials/${fixture.ids.credential}/download`, { bytes: true })), fixture.documentHash);
  assert.deepEqual(await request('old-reads-unchanged-money-record', `/api/v1/orders/${fixture.ids.order}`), originalOrder);
  await stop(); passed('previous-release-performed-live-http-reads-writes-and-guards');
  const afterOld = await snapshot(restoredDb); assert.deepEqual(afterOld.schema, before.schema);
  const keyColumns: Record<string, string[]> = { lesson_progress: ['enrollment_id', 'lesson_id'], idempotency_keys: ['scope', 'key'], memberships: ['organization_id', 'user_id'], schema_migrations: ['name'], programs: ['id'], program_intake_controls: ['version_id'], learning_reminder_preferences: ['user_id'], lead_qualifications: ['lead_id'], lead_attributions: ['lead_id'], operational_counters: ['day', 'metric'], rate_limits: ['key'] };
  const delta: any[] = [];
  for (const original of before.tables) {
    const changed = afterOld.tables.find(table => table.name === original.name)!; assert.deepEqual(changed.columns, original.columns);
    const keys = keyColumns[original.name] || ['id']; const key = (row: any) => JSON.stringify(keys.map(column => row[column]));
    const originals = objects(original), actual = objects(changed); const known = new Set(originals.map(key));
    for (const row of originals) {
      const found = actual.find(value => key(value) === key(row)); assert.ok(found, 'No deleted row in ' + original.name);
      const allowed = original.name === 'attempts' && row.id === attempt.id ? ['answers_json', 'revision', 'status', 'result_json', 'submitted_at'] : original.name === 'enrollments' && row.id === fixture.activeEnrollment ? ['status'] : original.name === 'rateLimit' ? ['count', 'lastRequest'] : original.name === 'rate_limits' ? ['count', 'reset_at'] : original.name === 'operational_counters' ? ['count'] : [];
      for (const column of original.columns) if (!allowed.includes(column)) assert.deepEqual(found[column], row[column], original.name + '.' + column + ' unchanged');
      if (['rateLimit', 'rate_limits', 'operational_counters'].includes(original.name)) {
        assert.ok(Number.isInteger(found.count) && Number(found.count) >= Number(row.count) && Number(found.count) <= Number(row.count) + 20, original.name + ': only bounded request-counter increases');
        for (const time of ['lastRequest', 'reset_at']) if (original.columns.includes(time)) assert.ok(Number(found[time]) >= Number(row[time]), 'Counter clock does not regress');
      }
      if (JSON.stringify(found) !== JSON.stringify(row)) { assert.ok(allowed.length, 'Unexpected mutable row'); delta.push({ table: original.name, operation: 'update', columns: original.columns.filter(column => JSON.stringify(row[column]) !== JSON.stringify(found[column])) }); }
    }
    for (const row of actual.filter(row => !known.has(key(row)))) {
      if (original.name === 'audit_events') { assert.equal(row.action, 'assessment.submitted'); assert.equal(row.actor_id, fixture.ids.learner); assert.equal(row.target, attempt.id); }
      else if (original.name === 'outbox') { assert.equal(row.type, 'assessment.graded'); assert.equal(row.aggregate_id, attempt.id); assert.equal(row.status, 'pending'); assert.equal(row.attempts, 0); }
      else if (original.name === 'operational_counters') { assert.ok(['api_error', 'autosave_failure'].includes(String(row.metric))); assert.ok(Number(row.count) > 0 && Number(row.count) <= 3); }
      else if (original.name === 'rateLimit') { assert.equal(typeof row.key, 'string'); assert.ok(Number(row.count) > 0 && Number(row.count) < 20); }
      else assert.fail('Unexpected inserted row in ' + original.name);
      delta.push({ table: original.name, operation: 'insert' });
    }
  }
  const rows = (name: string) => objects(afterOld.tables.find(table => table.name === name)!);
  assert.equal(rows('audit_events').filter(row => row.action === 'assessment.submitted' && row.target === attempt.id).length, 1);
  assert.equal(rows('outbox').filter(row => row.type === 'assessment.graded' && row.aggregate_id === attempt.id).length, 1);
  assert.equal(rows('attempts').filter(row => row.enrollment_id === fixture.activeEnrollment).length, 1);
  assert.equal(rows('lead_submissions').filter(row => row.idempotency_key === 'client:' + leadKey).length, 1);
  report.allowedRowDeltas = delta; passed('every-table-original-row-and-column-checked-no-wholesale-exclusions', { tables: before.tables.length, deltas: delta });
  const check = createClient({ url: 'file:' + restoredDb.replaceAll('\\', '/'), concurrency: 1 });
  try {
    for (const [text, args] of [
      ['UPDATE attempts SET result_json=? WHERE id=?', ['{}', fixture.ids.historicalAttempt]],
      ['UPDATE program_versions SET data_json=? WHERE id=?', ['{}', fixture.ids.version]],
      ['UPDATE audit_events SET reason=? WHERE action=?', ['changed', 'SYNTHETIC_HISTORICAL_EVIDENCE']],
      ['DELETE FROM sales_links WHERE id=?', ['synthetic-sales-link']],
    ] as const) await assert.rejects(check.execute({ sql: text, args: [...args] }), /immutable|append-only/i);
    assert.deepEqual((await check.execute('PRAGMA foreign_key_check')).rows, []); assert.deepEqual((await check.execute('PRAGMA integrity_check')).rows.map(row => row[0]), ['ok']);
  } finally { check.close(); }
  assert.deepEqual((await snapshot(restoredDb)).tables, afterOld.tables); passed('expanded-feature-immutable-triggers-and-integrity-remain-enforced');
  currentPhase = 'current-after-rollback'; const resumeStarted = performance.now(); await start(current.sourceDirectory, restoredDb, origin, secret, 'current-after');
  const returned = await request('current-reads-old-result', `/api/v1/attempts/${attempt.id}`); assert.deepEqual(returned.result, graded.result); assert.deepEqual(returned.answers, graded.answers); assert.equal(returned.revision, graded.revision);
  const returnedEnrollment = await request('current-reads-old-completed-enrollment', enrollmentPath); assert.equal(returnedEnrollment.status, 'completed');
  assert.equal(sha(await request('current-after-reads-unchanged-document', `/api/v1/credentials/${fixture.ids.credential}/download`, { bytes: true })), fixture.documentHash);
  assert.deepEqual(await request('current-after-reads-unchanged-money-record', `/api/v1/orders/${fixture.ids.order}`), originalOrder);
  assert.deepEqual(await request('current-after-lead-replay-no-duplicate', '/api/amo-lead', { method: 'POST', body: leadBody, key: leadKey, status: 202 }), lead);
  report.timings.currentReturnToVerifiedReadsMs = Math.round(performance.now() - resumeStarted); await stop();
  const afterReturn = await snapshot(restoredDb);
  for (const table of afterOld.tables) {
    const now = afterReturn.tables.find(value => value.name === table.name)!;
    if (!['rateLimit', 'rate_limits'].includes(table.name)) assert.deepEqual(now, table, 'Return to current changes no other row: ' + table.name);
    else {
      assert.deepEqual(now.columns, table.columns); const oldRows = objects(table), newRows = objects(now); assert.equal(newRows.length, oldRows.length);
      for (const row of oldRows) {
        const changed = newRows.find(value => value.key === row.key)!; assert.ok(changed);
        for (const column of table.columns.filter(column => !['count', 'lastRequest', 'reset_at'].includes(column))) assert.deepEqual(changed[column], row[column]);
        assert.ok(Number.isInteger(changed.count) && Number(changed.count) >= Number(row.count) && Number(changed.count) <= Number(row.count) + 10);
        for (const time of ['lastRequest', 'reset_at']) if (table.columns.includes(time)) assert.ok(Number(changed[time]) >= Number(row[time]));
      }
    }
  }
  assert.deepEqual((await snapshot(sourceDb)).tables, before.tables); assert.deepEqual(await artifactManifest(old.sourceDirectory), old.artifact); assert.deepEqual(await artifactManifest(current.sourceDirectory), current.artifact);
  passed('current-compiled-runtime-reads-old-writes-source-snapshot-and-both-builds-unchanged');
  report.status = 'passed'; report.finalSnapshot = summary(afterReturn);
} catch (error: any) {
  report.status = 'failed'; report.failures.push({ phase: currentPhase, code: error?.code || error?.name || 'Error' }); process.exitCode = 1;
  if (directory) await writeFile(join(directory, `failure-private-${randomUUID()}.log`), String(error?.stack || error), { flag: 'wx', mode: 0o600 });
} finally {
  await stop(); report.finishedAt = new Date().toISOString();
  const output = join(repository, 'artifacts/release-rollback'); await mkdir(output, { recursive: true });
  const path = join(output, `report-${randomUUID()}.json`); await writeFile(path, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, httpRequests: report.http.length, report: relative(repository, path).replaceAll('\\', '/'), privateDirectory: directory && relative(repository, directory).replaceAll('\\', '/') }));
}
