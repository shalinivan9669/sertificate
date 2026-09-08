/** Unattended encrypted backups. Source is read-only; plaintext verification stays in owned temporary storage. */
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Client } from '@libsql/client';
import { createClient as createRemoteClient } from '@libsql/client/web';
import { decryptBackup, encryptBackup, exportDatabase } from './db-backup';

export const backupManifestFormat = 'ot-center-backup-manifest-v1';
export const backupArchiveName = 'database.otb';
export const maximumBackupBytes = 128 * 1024 * 1024;
export const backupStages = ['configuration', 'export', 'size', 'restore', 'encrypt', 'persist'] as const;
const specificFailureCodes = ['BACKUP_SIZE_EXCEEDED', 'BACKUP_CLEANUP_FAILED', 'BACKUP_PASSWORD_INVALID', 'BACKUP_RESTORE_MISMATCH', 'BACKUP_ARCHIVE_VERIFICATION_FAILED'];
export const backupFailureCodes = [...specificFailureCodes, ...backupStages.map(stage => `BACKUP_${stage.toUpperCase()}_FAILED`)];
const defaultBackupBytes = 32 * 1024 * 1024;
const verificationMethod = 'isolated-restore-all-data-v1';
type Snapshot = Awaited<ReturnType<typeof exportDatabase>>;
export type BackupCounts = { tables: number; rows: number; documents: number; documentBytes: number };
export type BackupVerification = {
  method: typeof verificationMethod; snapshotCreatedAt: string; verifiedAt: string;
  sourceSnapshotBytes: number; counts: BackupCounts;
  durationsMs: { export: number; restore: number; cleanup: number };
};
type ManifestBase = { format: typeof backupManifestFormat; runId: string; startedAt: string; finishedAt: string; maxBytes: number };
export type BackupManifest = ManifestBase & (
  { status: 'verified'; archive: { fileName: typeof backupArchiveName; bytes: number; sha256: string }; verification: BackupVerification }
  | { status: 'failed'; stage: string; errorCode: string }
);
export type BackupRunOptions = { source: Client; outputDirectory: string; password: string; maxBytes?: number; temporaryParent?: string };

export function backupSizeLimit(value: unknown = defaultBackupBytes) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 1024 || Number(parsed) > maximumBackupBytes) throw new Error('BACKUP_SIZE_CONFIGURATION_INVALID');
  return Number(parsed);
}
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const milliseconds = (since: number) => Math.max(0, Date.now() - since);
const timestamp = () => new Date().toISOString();

/** Aggregate counts only. Table names, row values, document IDs and source addresses are never manifest fields. */
export function backupCounts(snapshot: Snapshot): BackupCounts {
  const result = { tables: snapshot.tables.length, rows: 0, documents: 0, documentBytes: 0 };
  for (const table of snapshot.tables) {
    result.rows += table.rows.length;
    if (table.name !== 'credentials') continue;
    const column = table.columns.indexOf('document_base64');
    if (column < 0) continue;
    for (const row of table.rows) {
      const value = row[column];
      if (typeof value === 'string' && value.length) { result.documents++; result.documentBytes += Buffer.from(value, 'base64').length; }
    }
  }
  if (Object.values(result).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('BACKUP_COUNTS_INVALID');
  return result;
}

export function snapshotFingerprint(snapshot: Snapshot) {
  // SQL row order is not part of the backup contract; compare every complete encoded row.
  const schema = snapshot.schema.map(row => [row.type, row.name, row.tbl_name, row.sql]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const normalizeInteger = (value: unknown) => {
    if (value && typeof value === 'object' && '__ot_bigint' in value) {
      const number = Number(value.__ot_bigint);
      if (Number.isSafeInteger(number) && String(number) === String(value.__ot_bigint)) return number;
    }
    return value;
  };
  const tables = snapshot.tables.map(table => ({ name: table.name, columns: table.columns, rows: table.rows.map(row => JSON.stringify(row.map(normalizeInteger))).sort() })).sort((a, b) => a.name.localeCompare(b.name));
  return digest(JSON.stringify({ schema, tables }));
}

async function cleanupOwnedTemporary(directory: string, parent: string) {
  const target = await realpath(directory);
  const child = relative(parent, target);
  if (!child || isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`) || !basename(target).startsWith('ot-backup-verify-')) throw new Error('BACKUP_CLEANUP_TARGET_INVALID');
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function restoreInWorker(snapshot: Snapshot, path: string, maxBytes: number) {
  // The child never needs production URLs, tokens, the encryption password or inherited NODE_OPTIONS.
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA']) if (process.env[key]) env[key] = process.env[key];
  const workerPath = fileURLToPath(new URL('./backup-verify-worker.ts', import.meta.url));
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), workerPath, '--target', path, '--max-bytes', String(maxBytes)], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let rejected = false;
    const fail = () => { rejected = true; child.kill(); };
    const timeout = setTimeout(fail, 300000); timeout.unref();
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); if (Buffer.byteLength(output) > 4096) fail(); });
    child.stderr.on('data', () => {}); // Never forward upstream SQL, rows or native error messages.
    child.stdin.on('error', () => {});
    child.once('error', () => { clearTimeout(timeout); reject(new Error('BACKUP_RESTORE_WORKER_FAILED')); });
    child.once('close', code => {
      clearTimeout(timeout);
      if (rejected || code !== 0) { reject(new Error('BACKUP_RESTORE_WORKER_FAILED')); return; }
      try {
        const result = JSON.parse(output);
        if (Object.keys(result).sort().join(',') !== 'fingerprint,status' || result.status !== 'verified' || typeof result.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(result.fingerprint)) throw new Error('Invalid result');
        resolveResult(result.fingerprint);
      } catch { reject(new Error('BACKUP_RESTORE_WORKER_FAILED')); }
    });
    child.stdin.end(JSON.stringify(snapshot));
  });
}

async function verifyInTemporaryDatabase(snapshot: Snapshot, maxBytes: number, temporaryParent?: string) {
  const parent = await realpath(resolve(temporaryParent || tmpdir()));
  if (!(await stat(parent)).isDirectory()) throw new Error('BACKUP_TEMP_DIRECTORY_INVALID');
  const directory = await mkdtemp(join(parent, 'ot-backup-verify-'));
  const path = join(directory, 'restore.sqlite');
  let restoreMs = 0; let cleanupMs = 0;
  let failed = false; let failure: unknown;
  try {
    const started = Date.now();
    const restoredFingerprint = await restoreInWorker(snapshot, path, maxBytes);
    if (restoredFingerprint !== snapshotFingerprint(snapshot)) throw new Error('BACKUP_RESTORE_MISMATCH');
    restoreMs = milliseconds(started);
  } catch (error) { failed = true; failure = error; }
  finally {
    const started = Date.now();
    try { await cleanupOwnedTemporary(directory, parent); }
    catch { failed = true; failure = new Error('BACKUP_CLEANUP_FAILED'); }
    cleanupMs = milliseconds(started);
  }
  if (failed) throw failure;
  return { restoreMs, cleanupMs };
}

async function writeNewFile(path: string, data: Buffer | string, created?: () => void) {
  const handle = await open(path, 'wx', 0o600);
  created?.();
  try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
}

/** The caller owns source.close(). This function never calls getDb(), migrations, DDL or DML on the source. */
export async function runBackup(options: BackupRunOptions): Promise<BackupManifest> {
  const maxBytes = backupSizeLimit(options.maxBytes);
  const outputDirectory = resolve(options.outputDirectory);
  const outputParent = await realpath(dirname(outputDirectory));
  if (!(await stat(outputParent)).isDirectory()) throw new Error('BACKUP_OUTPUT_PARENT_INVALID');
  // mkdir without recursive is exclusive even when the existing directory is empty.
  await mkdir(outputDirectory, { mode: 0o700 });
  const ownedOutput = await realpath(outputDirectory);
  if (dirname(ownedOutput) !== outputParent) throw new Error('BACKUP_OUTPUT_TARGET_INVALID');
  const runId = randomUUID(); const startedAt = timestamp(); let stage = 'configuration'; let archiveCreated = false;
  let result: BackupManifest;
  try {
    if (options.password.length < 24) throw new Error('BACKUP_PASSWORD_INVALID');
    stage = 'export'; const exportStarted = Date.now();
    const snapshot = await exportDatabase(options.source);
    const exportMs = milliseconds(exportStarted);
    stage = 'size'; const sourceSnapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));
    if (sourceSnapshotBytes > maxBytes) throw new Error('BACKUP_SIZE_EXCEEDED');
    const counts = backupCounts(snapshot);
    stage = 'restore'; const { restoreMs, cleanupMs } = await verifyInTemporaryDatabase(snapshot, maxBytes, options.temporaryParent);
    const verification: BackupVerification = { method: verificationMethod, snapshotCreatedAt: snapshot.createdAt, verifiedAt: timestamp(), sourceSnapshotBytes, counts, durationsMs: { export: exportMs, restore: restoreMs, cleanup: cleanupMs } };
    // This authenticated extra field remains compatible with the existing v1 restore CLI.
    // It prevents an edited plaintext manifest from relabelling an old archive as a fresh verified backup.
    const payload = { ...snapshot, backupRun: { runId, startedAt, maxBytes, verification } };
    stage = 'size';
    if (Buffer.byteLength(JSON.stringify(payload)) + 48 > maxBytes) throw new Error('BACKUP_SIZE_EXCEEDED');
    stage = 'encrypt'; const encrypted = encryptBackup(payload, options.password);
    if (encrypted.length > maxBytes) throw new Error('BACKUP_SIZE_EXCEEDED');
    stage = 'persist'; const archivePath = join(ownedOutput, backupArchiveName);
    await writeNewFile(archivePath, encrypted, () => { archiveCreated = true; });
    const saved = await readFile(archivePath);
    if (digest(saved) !== digest(encrypted) || JSON.stringify(decryptBackup(saved, options.password)) !== JSON.stringify(payload)) throw new Error('BACKUP_ARCHIVE_VERIFICATION_FAILED');
    result = { format: backupManifestFormat, runId, startedAt, finishedAt: timestamp(), maxBytes, status: 'verified', archive: { fileName: backupArchiveName, bytes: saved.length, sha256: digest(saved) }, verification };
  } catch (error: unknown) {
    if (archiveCreated) await rm(join(ownedOutput, backupArchiveName), { force: true });
    const controlled = error instanceof Error ? error.message : '';
    const errorCode = specificFailureCodes.includes(controlled) ? controlled : `BACKUP_${stage.toUpperCase()}_FAILED`;
    result = { format: backupManifestFormat, runId, startedAt, finishedAt: timestamp(), maxBytes, status: 'failed', stage, errorCode };
  }
  await writeNewFile(join(ownedOutput, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

export async function backupRunnerMain(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--output-dir' || !argv[1]) throw new Error('BACKUP_ARGUMENTS_INVALID');
  const url = process.env.TURSO_DATABASE_URL || ''; const token = process.env.TURSO_AUTH_TOKEN || '';
  if (!/^(libsql|https):\/\//.test(url) || !token) throw new Error('BACKUP_SOURCE_CONFIGURATION_INVALID');
  const source = createRemoteClient({ url, authToken: token, intMode: 'bigint' });
  try { return await runBackup({ source, password: process.env.OT_BACKUP_PASSWORD || '', outputDirectory: argv[1], maxBytes: backupSizeLimit(process.env.OT_BACKUP_MAX_BYTES || defaultBackupBytes) }); }
  finally { source.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backupRunnerMain().then(result => { console.log(JSON.stringify(result)); process.exitCode = result.status === 'verified' ? 0 : 1; })
    .catch(() => { console.error(JSON.stringify({ status: 'failed', errorCode: 'BACKUP_RUNNER_INPUT_OR_OUTPUT_FAILED' })); process.exitCode = 1; });
}
