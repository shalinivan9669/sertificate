import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { createClient, type Client, type Transaction } from '@libsql/client';
import { backupArchiveName, backupSizeLimit, maximumBackupBytes, runBackup } from '../scripts/backup-runner';
import { checkBackups } from '../scripts/backup-check';
import { decryptBackup, exportDatabase, restoreDatabase } from '../scripts/db-backup';

const password = 'SYNTHETIC isolated runner passphrase 2026!';
const privateMarker = 'SYNTHETIC-PRIVATE-ROW@example.test';
const document = Buffer.from('SYNTHETIC PRIVATE DOCUMENT BYTES, NOT A CERTIFICATE');
const clients: Client[] = [];
let root: string; let temporaryParent: string; let source: Client; let successDirectory: string;
let success: Awaited<ReturnType<typeof runBackup>>;

function database(name: string, intMode: 'number' | 'bigint' = 'bigint') {
  const client = createClient({ url: `file:${join(root, name).replaceAll('\\', '/')}`, concurrency: 1, intMode });
  clients.push(client); return client;
}

function observedReadSource(client: Client, observations: string[]) {
  return new Proxy(client, { get(target, property) {
    if (property !== 'transaction') throw new Error(`Unexpected source API: ${String(property)}`);
    return async (mode: string) => {
      assert.equal(mode, 'read', 'The source must use only a read transaction'); observations.push(mode);
      const transaction = await target.transaction('read');
      return new Proxy(transaction, { get(tx, name) {
        if (name === 'execute') return async (query: Parameters<Transaction['execute']>[0]) => {
          const sql = typeof query === 'string' ? query : query.sql;
          assert.match(sql, /^SELECT\s/i, 'Backup must not run source migrations, PRAGMA or mutations');
          observations.push(sql); return tx.execute(query);
        };
        const value = Reflect.get(tx, name, tx); return typeof value === 'function' ? value.bind(tx) : value;
      } });
    };
  } });
}

const failedSource = () => ({ transaction: async () => { throw new Error(`SYNTHETIC secret URL/token ${privateMarker}`); } }) as unknown as Client;
const check = (directories: string[], extra: Partial<Parameters<typeof checkBackups>[0]> = {}) => checkBackups({ directories, password, maxAgeMs: 3600000, ...extra });
async function copySuccess(name: string) { const destination = join(root, name); await cp(successDirectory, destination, { recursive: true, errorOnExist: true, force: false }); return destination; }
async function editManifest(directory: string, mutate: (manifest: any) => void) {
  const path = join(directory, 'manifest.json'); const manifest = JSON.parse(await readFile(path, 'utf8'));
  mutate(manifest); await writeFile(path, JSON.stringify(manifest));
}

before(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'ot-backup-runner-test-')));
  temporaryParent = join(root, 'verification'); await mkdir(temporaryParent);
  source = database('source.sqlite');
  await source.execute('PRAGMA foreign_keys=ON');
  await source.execute('CREATE TABLE people(id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, balance INTEGER NOT NULL)');
  await source.execute('CREATE TABLE credentials(id TEXT PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES people(id), document_base64 TEXT NOT NULL, payload BLOB NOT NULL)');
  await source.execute('CREATE INDEX credential_person ON credentials(person_id)');
  await source.execute('CREATE VIEW credential_owners AS SELECT people.id, credentials.id AS credential_id FROM people JOIN credentials ON credentials.person_id=people.id');
  await source.execute("CREATE TRIGGER immutable_credentials BEFORE DELETE ON credentials BEGIN SELECT RAISE(ABORT, 'SYNTHETIC immutable document'); END");
  await source.execute({ sql: 'INSERT INTO people VALUES(1, ?, ?)', args: [privateMarker, 9007199254740993n] });
  await source.execute({ sql: 'INSERT INTO credentials VALUES(?, 1, ?, ?)', args: ['SYNTHETIC-DOCUMENT-ID', document.toString('base64'), Buffer.from([0, 1, 2, 128, 255])] });
  successDirectory = join(root, 'verified');
});

after(async () => {
  for (const client of clients) client.close();
  const target = resolve(root); const parent = await realpath(tmpdir());
  assert.ok(target.startsWith(`${parent}${sep}`) && basename(target).startsWith('ot-backup-runner-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('runner reads the source, verifies every restored row and emits only encrypted archive plus safe manifest', async () => {
  const before = await exportDatabase(source); const changes = (await source.execute('SELECT total_changes() AS total')).rows[0]!.total;
  const observations: string[] = [];
  success = await runBackup({ source: observedReadSource(source, observations), outputDirectory: successDirectory, password, temporaryParent });
  assert.equal(success.status, 'verified'); if (success.status !== 'verified') assert.fail(JSON.stringify(success));
  assert.deepEqual(await readdir(successDirectory), ['database.otb', 'manifest.json']);
  assert.deepEqual(await readdir(temporaryParent), [], 'Plaintext verification database and sidecars must be removed before success');
  assert.equal(observations[0], 'read'); assert.equal(observations.length, 4);
  assert.deepEqual((await exportDatabase(source)).tables, before.tables);
  assert.deepEqual((await exportDatabase(source)).schema, before.schema);
  assert.equal((await source.execute('SELECT total_changes() AS total')).rows[0]!.total, changes);
  assert.equal((await source.execute('PRAGMA foreign_keys')).rows[0]![0], 1n);
  assert.deepEqual(success.verification.counts, { tables: 2, rows: 2, documents: 1, documentBytes: document.length });
  assert.equal(success.verification.method, 'isolated-restore-all-data-v1');
  for (const duration of Object.values(success.verification.durationsMs)) assert.ok(Number.isSafeInteger(duration) && duration >= 0);
  assert.ok(Date.parse(success.startedAt) <= Date.parse(success.verification.snapshotCreatedAt));
  assert.ok(Date.parse(success.verification.snapshotCreatedAt) <= Date.parse(success.verification.verifiedAt));
  assert.ok(Date.parse(success.verification.verifiedAt) <= Date.parse(success.finishedAt));
  const archive = await readFile(join(successDirectory, backupArchiveName)); const manifest = await readFile(join(successDirectory, 'manifest.json'), 'utf8');
  assert.equal(archive.subarray(0, 4).toString(), 'OTB1');
  for (const secret of [privateMarker, password, 'SYNTHETIC-DOCUMENT-ID', document.toString('base64'), 'CREATE TABLE', 'people']) {
    assert.equal(manifest.includes(secret), false); assert.equal(archive.includes(Buffer.from(secret)), false);
  }
  assert.equal(archive.length, success.archive.bytes); assert.ok(archive.length <= success.maxBytes);
  assert.equal(createHash('sha256').update(archive).digest('hex'), success.archive.sha256);
  const payload = decryptBackup(archive, password);
  assert.deepEqual(payload.backupRun, { runId: success.runId, startedAt: success.startedAt, maxBytes: success.maxBytes, verification: success.verification });
  const restored = database('compatibility.sqlite'); await restoreDatabase(restored, payload);
  assert.deepEqual((await exportDatabase(restored)).tables, before.tables, 'Authenticated metadata keeps existing v1 restore compatibility, including large integers and BLOBs');
  await assert.rejects(restored.execute('DELETE FROM credentials'), /immutable/);
  const result = await check([successDirectory]); assert.equal(result.status, 'healthy'); assert.equal(result.latestVerifiedSuccess?.runId, success.runId);
});

test('number-mode source and bigint-mode isolated restore compare equivalent safe SQLite integers', async () => {
  const numeric = database('numeric.sqlite', 'number'); await numeric.execute('CREATE TABLE fixture(id INTEGER PRIMARY KEY, value TEXT)');
  await numeric.execute("INSERT INTO fixture VALUES(42, 'SYNTHETIC')");
  const result = await runBackup({ source: numeric, outputDirectory: join(root, 'numeric-backup'), password, temporaryParent });
  assert.equal(result.status, 'verified', JSON.stringify(result)); assert.deepEqual(await readdir(temporaryParent), []);
});

test('existing empty and populated output directories are refused without source reads or overwrite', async () => {
  for (const populated of [false, true]) {
    const directory = join(root, populated ? 'existing-populated' : 'existing-empty'); await mkdir(directory);
    if (populated) await writeFile(join(directory, 'marker'), privateMarker);
    await assert.rejects(runBackup({ source: failedSource(), outputDirectory: directory, password, temporaryParent }), /EEXIST/);
    assert.deepEqual(await readdir(directory), populated ? ['marker'] : []);
    if (populated) assert.equal(await readFile(join(directory, 'marker'), 'utf8'), privateMarker);
  }
});

test('source failure returns a sanitized failed manifest and never publishes archive or plaintext', async () => {
  const directory = join(root, 'source-failure');
  const result = await runBackup({ source: failedSource(), outputDirectory: directory, password, temporaryParent });
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') assert.fail();
  assert.equal(result.stage, 'export'); assert.equal(result.errorCode, 'BACKUP_EXPORT_FAILED');
  assert.deepEqual(await readdir(directory), ['manifest.json']); assert.deepEqual(await readdir(temporaryParent), []);
  assert.equal(JSON.stringify(result).includes(privateMarker), false);
  const inspected = await check([directory]); assert.equal(inspected.status, 'attention_required'); assert.equal(inspected.latestAttempt?.status, 'failed'); assert.equal(inspected.latestVerifiedSuccess, null);
});

test('broken reference fails isolated restore, removes temporary database and leaves source intact', async () => {
  const broken = database('broken-source.sqlite'); await broken.execute('PRAGMA foreign_keys=OFF');
  await broken.execute('CREATE TABLE parent(id INTEGER PRIMARY KEY)');
  await broken.execute('CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id))');
  await broken.execute('INSERT INTO child VALUES(1, 999)');
  const directory = join(root, 'restore-failure');
  const result = await runBackup({ source: broken, outputDirectory: directory, password, temporaryParent });
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') assert.fail();
  assert.equal(result.stage, 'restore'); assert.equal(result.errorCode, 'BACKUP_RESTORE_FAILED');
  assert.deepEqual(await readdir(directory), ['manifest.json']); assert.deepEqual(await readdir(temporaryParent), []);
  assert.equal((await broken.execute('SELECT parent_id FROM child')).rows[0]!.parent_id, 999n);
});

test('size ceiling rejects snapshot or metadata overhead before publishing any ciphertext', async () => {
  const large = database('oversized.sqlite'); await large.execute('CREATE TABLE fixture(value TEXT)');
  await large.execute({ sql: 'INSERT INTO fixture VALUES(?)', args: ['SYNTHETIC'.repeat(2048)] });
  const directory = join(root, 'size-failure');
  const result = await runBackup({ source: large, outputDirectory: directory, password, temporaryParent, maxBytes: 1024 });
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') assert.fail();
  assert.equal(result.errorCode, 'BACKUP_SIZE_EXCEEDED');
  assert.deepEqual(await readdir(directory), ['manifest.json']); assert.deepEqual(await readdir(temporaryParent), []);
  assert.equal((await large.execute('SELECT length(value) AS size FROM fixture')).rows[0]!.size, 18432n);
  const metadataDirectory = join(root, 'metadata-size-failure');
  const sourceBytes = Buffer.byteLength(JSON.stringify(await exportDatabase(source)));
  const metadataResult = await runBackup({ source, outputDirectory: metadataDirectory, password, temporaryParent, maxBytes: Math.max(1024, sourceBytes + 1) });
  assert.equal(metadataResult.status, 'failed'); if (metadataResult.status !== 'failed') assert.fail();
  assert.equal(metadataResult.errorCode, 'BACKUP_SIZE_EXCEEDED', 'Encrypted metadata and GCM envelope also count against the artifact budget');
  assert.deepEqual(await readdir(metadataDirectory), ['manifest.json']); assert.deepEqual(await readdir(temporaryParent), []);
  assert.equal(backupSizeLimit('8388608'), 8 * 1024 * 1024);
  for (const value of [1023, maximumBackupBytes + 1, 3.5, '8MiB', NaN, Infinity, null]) assert.throws(() => backupSizeLimit(value), /CONFIGURATION_INVALID/);
  assert.equal(backupSizeLimit(), 32 * 1024 * 1024);
  assert.equal(backupSizeLimit(maximumBackupBytes), maximumBackupBytes);
});

test('short password fails before source reads and yields a safe failed manifest', async () => {
  const directory = join(root, 'password-failure');
  const result = await runBackup({ source: failedSource(), outputDirectory: directory, password: 'short', temporaryParent });
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') assert.fail();
  assert.equal(result.stage, 'configuration'); assert.equal(result.errorCode, 'BACKUP_PASSWORD_INVALID');
  assert.deepEqual(await readdir(directory), ['manifest.json']);
});

test('checker requires the actual authenticated archive, correct password and unchanged encrypted bytes', async () => {
  const wrongPassword = await check([successDirectory], { password: 'SYNTHETIC definitely incorrect password' });
  assert.equal(wrongPassword.latestVerifiedSuccess, null); assert.equal(wrongPassword.invalidArtifacts, 1);
  const tampered = await copySuccess('tampered'); const path = join(tampered, backupArchiveName); const bytes = await readFile(path);
  bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1; await writeFile(path, bytes);
  assert.equal((await check([tampered])).latestVerifiedSuccess, null);
  await editManifest(tampered, manifest => { manifest.archive.sha256 = createHash('sha256').update(bytes).digest('hex'); });
  const editedHash = await check([tampered]); assert.equal(editedHash.latestVerifiedSuccess, null); assert.equal(editedHash.invalidArtifacts, 1, 'Recalculating the public SHA cannot bypass AES-GCM authentication');
  const missing = await copySuccess('missing-archive'); await rm(join(missing, backupArchiveName));
  assert.equal((await check([missing])).latestVerifiedSuccess, null);
});

test('plaintext manifest cannot promote an old artifact or accept future timestamps, path traversal or extra private fields', async () => {
  if (success.status !== 'verified') assert.fail();
  const mutations: Array<(manifest: any) => void> = [
    manifest => { manifest.verification.snapshotCreatedAt = new Date(Date.parse(manifest.verification.snapshotCreatedAt) + 1).toISOString(); manifest.verification.verifiedAt = manifest.verification.snapshotCreatedAt; manifest.finishedAt = manifest.verification.snapshotCreatedAt; },
    manifest => { manifest.finishedAt = '2099-01-01T00:00:00.000Z'; },
    manifest => { manifest.startedAt = 'not a timestamp'; },
    manifest => { manifest.format = 'pretend-backup-v1'; },
    manifest => { manifest.verification.counts.documents++; },
    manifest => { manifest.archive.fileName = '../source.sqlite'; },
    manifest => { manifest.sourceUrl = `libsql://${privateMarker}`; },
    manifest => { manifest.status = 'passed'; },
    manifest => { manifest.maxBytes = String(manifest.maxBytes); },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const directory = await copySuccess(`manifest-edit-${index}`); await editManifest(directory, mutate);
    const result = await check([directory], { now: Date.parse(success.finishedAt) + 60000 });
    assert.equal(result.latestVerifiedSuccess, null, `Unsafe manifest mutation ${index} must not promote success`);
    assert.equal(result.status, 'attention_required'); assert.equal(result.invalidArtifacts, 1);
    assert.equal(JSON.stringify(result).includes(privateMarker), false);
  }
});

test('checker rejects invalid age configuration and safe-looking JSON without a valid backup schema', async () => {
  for (const options of [{ maxAgeMs: 0 }, { maxAgeMs: 1.5 }, { now: 1e20 }, { now: NaN }, { directories: [] }]) {
    await assert.rejects(check([successDirectory], options), /CONFIGURATION_INVALID/);
  }
  const directory = join(root, 'arbitrary-json'); await mkdir(directory);
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ status: 'verified', finishedAt: new Date().toISOString() }));
  const result = await check([directory]); assert.equal(result.latestVerifiedSuccess, null); assert.equal(result.invalidArtifacts, 1);
});

test('untrusted failed manifest cannot leak arbitrary private text through a diagnostic-looking error code', async () => {
  const directory = join(root, 'untrusted-failure');
  await runBackup({ source: failedSource(), outputDirectory: directory, password, temporaryParent });
  const canary = 'BACKUP_SYNTHETIC_PRIVATE_CUSTOMER_CANARY';
  await editManifest(directory, manifest => { manifest.errorCode = canary; });
  const result = await check([directory]); assert.equal(result.invalidArtifacts, 1); assert.equal(result.latestAttempt, null);
  assert.equal(JSON.stringify(result).includes(canary), false);
});

test('new failure is visible while last verified backup is preserved, and snapshot age controls staleness', async () => {
  if (success.status !== 'verified') assert.fail();
  const failed = join(root, 'latest-failed');
  const failure = await runBackup({ source: failedSource(), outputDirectory: failed, password, temporaryParent });
  const result = await check([successDirectory, failed]);
  assert.equal(result.latestAttempt?.runId, failure.runId); assert.equal(result.latestAttempt?.status, 'failed');
  assert.equal(result.latestVerifiedSuccess?.runId, success.runId); assert.equal(result.fresh, true); assert.equal(result.status, 'attention_required');
  const stale = await check([successDirectory], { now: Date.parse(success.verification.snapshotCreatedAt) + 3600001 });
  assert.equal(stale.ageMs, 3600001); assert.equal(stale.fresh, false); assert.equal(stale.status, 'attention_required');
  const withInvalid = await check([successDirectory, join(root, 'absent')]);
  assert.equal(withInvalid.latestVerifiedSuccess?.runId, success.runId); assert.equal(withInvalid.status, 'attention_required'); assert.equal(withInvalid.invalidArtifacts, 1);
});

test('importing both CLI modules does not execute either CLI or read source configuration', () => {
  const imported = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./scripts/backup-runner.ts'); await import('./scripts/backup-check.ts'); await import('./scripts/backup-verify-worker.ts');"], {
    cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, TURSO_DATABASE_URL: 'invalid-SYNTHETIC-url', TURSO_AUTH_TOKEN: 'SYNTHETIC-invalid-token', OT_BACKUP_PASSWORD: '' },
  });
  assert.equal(imported.status, 0, imported.stderr); assert.equal(imported.stdout, ''); assert.equal(imported.stderr, '');
});
