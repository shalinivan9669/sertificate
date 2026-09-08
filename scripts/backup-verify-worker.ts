/** Isolated local restore process: stdin only, no source credentials, and no plaintext output. */
import { open, realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { backupSizeLimit, snapshotFingerprint } from './backup-runner';
import { exportDatabase, restoreDatabase } from './db-backup';

export async function verifyBackupWorker(argv = process.argv.slice(2)) {
  if (argv.length !== 4 || argv[0] !== '--target' || argv[2] !== '--max-bytes') throw new Error('BACKUP_WORKER_ARGUMENTS_INVALID');
  const target = resolve(argv[1]!); const parent = await realpath(dirname(target));
  if (basename(target) !== 'restore.sqlite' || !basename(parent).startsWith('ot-backup-verify-') || join(parent, basename(target)) !== target) throw new Error('BACKUP_WORKER_TARGET_INVALID');
  const maxBytes = backupSizeLimit(argv[3]); let bytes = 0; const chunks: Buffer[] = [];
  for await (const part of process.stdin) {
    const chunk = Buffer.from(part); bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('BACKUP_WORKER_SIZE_EXCEEDED');
    chunks.push(chunk);
  }
  const snapshot = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  // Never open an existing target. All native SQLite handles disappear when this process exits,
  // so the parent can then remove its temporary directory reliably on Windows too.
  const reservation = await open(target, 'wx', 0o600); await reservation.close();
  const client = createClient({ url: `file:${target.replaceAll('\\', '/')}`, concurrency: 1, intMode: 'bigint' });
  try {
    await restoreDatabase(client, snapshot);
    return { status: 'verified', fingerprint: snapshotFingerprint(await exportDatabase(client)) };
  } finally { client.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyBackupWorker().then(result => { console.log(JSON.stringify(result)); })
    .catch(() => { console.error(JSON.stringify({ status: 'failed', errorCode: 'BACKUP_RESTORE_WORKER_FAILED' })); process.exitCode = 1; });
}
