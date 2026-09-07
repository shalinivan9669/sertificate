import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient as createRemoteClient, type Client } from '@libsql/client/web';
import { assertDefaultForeignKeys } from '../server/db';

import { requiredMigrations } from '../server/db/required-migrations';

/** A deliberately invalid, non-PII enrollment is always rolled back, even if enforcement is broken. */
export async function probeDatabaseForeignKeys(db: Client) {
  const tx = await db.transaction('write');
  let rejected = false;
  try {
    const marker = `readiness-${randomUUID()}`;
    try { await tx.execute({ sql: 'INSERT INTO enrollments(id,user_id,version_id,created_at) VALUES(?,?,?,?)', args: [marker, `missing-user-${marker}`, `missing-version-${marker}`, new Date().toISOString()] }); }
    catch (error: any) {
      if (/SQLITE_CONSTRAINT_FOREIGNKEY/.test(String(error?.code)) || /FOREIGN KEY constraint failed/i.test(String(error?.message))) rejected = true;
      else throw error;
    }
    if (!rejected) throw Object.assign(new Error('Negative foreign-key probe unexpectedly succeeded'), { code: 'DATABASE_FOREIGN_KEY_PROBE_FAILED' });
  } finally { if (!tx.closed) await tx.rollback(); tx.close(); }
  return { negativeForeignKeyProbe: 'passed', writesCommitted: 0 };
}

export async function databaseReadiness(db: Client, probeForeignKeys = false) {
  await assertDefaultForeignKeys(db);
  const migrations = (await db.execute('SELECT name FROM schema_migrations')).rows.map(row => String(row.name));
  if (!requiredMigrations.every(name => migrations.includes(name))) throw new Error('Required schema migrations are missing');
  if ((await db.execute('PRAGMA foreign_key_check')).rows.length) throw new Error('Existing foreign-key violations require repair before release');
  const probe = probeForeignKeys ? await probeDatabaseForeignKeys(db) : { negativeForeignKeyProbe: 'not_run', writesCommitted: 0 };
  return { status: 'ready', migrationCount: requiredMigrations.length, freshConnectionForeignKeys: 'passed', ...probe };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote && !process.argv.includes('--remote')) throw new Error('Remote readiness requires explicit --remote');
  if (remote && (!/^(libsql|https):\/\//.test(remote) || !process.env.TURSO_AUTH_TOKEN)) throw new Error('Valid remote database URL/token are required');
  const local = resolve(process.env.OT_DATABASE_PATH || '.data/ot-center.sqlite');
  if (!remote && !existsSync(local)) throw new Error('Local database does not exist; readiness never creates or migrates it');
  const probe = process.argv.includes('--probe-foreign-keys');
  // Separate fresh clients exercise new HTTP streams rather than reusing a migration connection.
  for (let connection = 1; connection <= (remote ? 3 : 1); connection++) {
    const db = remote ? createRemoteClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN }) : (await import('@libsql/client')).createClient({ url: `file:${local.replaceAll('\\', '/')}`, concurrency: 1 });
    try { console.log(JSON.stringify({ backend: remote ? 'remote-libsql' : 'local-libsql', connection, ...await databaseReadiness(db, probe) })); }
    finally { db.close(); }
  }
}
