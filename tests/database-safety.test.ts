import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { assertDefaultForeignKeys, migrate } from '../server/db';
import { databaseReadiness, probeDatabaseForeignKeys } from '../scripts/db-readiness';

async function isolated(operation: (db: Client) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'ot-database-safety-'));
  const db = createClient({ url: `file:${join(directory, 'test.sqlite').replaceAll('\\', '/')}`, concurrency: 1 });
  try { await operation(db); }
  finally {
    db.close(); const target = resolve(directory);
    assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-database-safety-'));
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test('fresh-default FK guard fails closed when enforcement is disabled and readiness probes real migrated constraints', async () => {
  await isolated(async db => {
    await migrate(db); await db.execute('PRAGMA foreign_keys=OFF');
    await assert.rejects(assertDefaultForeignKeys(db), (error: any) => error.code === 'DATABASE_FOREIGN_KEYS_REQUIRED' && error.statusCode === 503);
    await db.execute('PRAGMA foreign_keys=ON'); await assertDefaultForeignKeys(db);
    const before = (await db.execute('SELECT COUNT(*) n FROM enrollments')).rows[0]?.n;
    const result = await databaseReadiness(db, true);
    assert.equal(result.negativeForeignKeyProbe, 'passed'); assert.equal(result.writesCommitted, 0); assert.equal(result.migrationCount, 5);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM enrollments')).rows[0]?.n, before);
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  });
});

test('negative FK probe detects a broken schema and rolls back its otherwise accepted sentinel row', async () => {
  await isolated(async db => {
    await db.execute('CREATE TABLE enrollments(id TEXT PRIMARY KEY,user_id TEXT,version_id TEXT,created_at TEXT)');
    await db.execute('PRAGMA foreign_keys=ON');
    await assert.rejects(probeDatabaseForeignKeys(db), (error: any) => error.code === 'DATABASE_FOREIGN_KEY_PROBE_FAILED');
    assert.equal((await db.execute('SELECT COUNT(*) n FROM enrollments')).rows[0]?.n, 0);
  });
});
