import { createClient as createRemoteClient, type Client, type Transaction, type InArgs, type ResultSet } from '@libsql/client/web';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { courseDirections } from '../../shared/course-registry';

export type Db = Client | Transaction;
let database: Promise<Client> | undefined;

function migrationDirectory() {
  const candidates = [process.env.OT_MIGRATIONS_DIR, resolve(process.cwd(), 'server/db/migrations'), resolve(process.cwd(), 'migrations'), fileURLToPath(new URL('./migrations', import.meta.url))];
  const found = candidates.find((path): path is string => Boolean(path && existsSync(path)));
  if (!found) throw new Error('Database migrations are missing. Set OT_MIGRATIONS_DIR to the packaged migrations directory.');
  return found;
}

export async function queryOne<T = Record<string, any>>(sql: string, args: InArgs = [], db?: Db): Promise<T | undefined> {
  return (await (db || await getDb()).execute({ sql, args })).rows[0] as T | undefined;
}
export async function queryAll<T = Record<string, any>>(sql: string, args: InArgs = [], db?: Db): Promise<T[]> {
  return (await (db || await getDb()).execute({ sql, args })).rows as T[];
}
export async function execute(sql: string, args: InArgs = [], db?: Db): Promise<ResultSet> {
  return (db || await getDb()).execute({ sql, args });
}
export async function withTransaction<T>(callback: (tx: Transaction) => Promise<T>, db?: Client): Promise<T> {
  const client = db || await getDb();
  let tx: Transaction | undefined;
  // libSQL local and remote connections contend for the same writer. Retry acquisition only;
  // never replay a callback whose domain writes or commit outcome could be uncertain.
  for (let attempt = 0; !tx; attempt++) {
    try { tx = await client.transaction('write'); }
    catch (error: any) {
      if (!['SQLITE_BUSY', 'SQLITE_BUSY_TIMEOUT', 'TRANSACTION_ACTIVE'].includes(error?.code) || attempt >= 12) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(20 * 2 ** attempt, 200)));
    }
  }
  try { const result = await callback(tx); await tx.commit(); return result; }
  catch (error) { if (!tx.closed) await tx.rollback(); throw error; }
  finally { tx.close(); }
}

/** Explicit release/CLI migration, also used for isolated local databases. */
export async function migrate(db: Client, directory = migrationDirectory()) {
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const name of readdirSync(directory).filter((name) => /^\d+[-_].*\.sql$/.test(name)).sort()) {
    const sql = readFileSync(resolve(directory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await withTransaction(async (tx) => {
      const applied = await queryOne<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name = ?', [name], tx);
      if (applied) {
        if (applied.checksum !== checksum) throw new Error(`Migration checksum mismatch: ${name}`);
        return;
      }
      await tx.executeMultiple(sql);
      await execute('INSERT INTO schema_migrations VALUES (?, ?, ?)', [name, checksum, new Date().toISOString()], tx);
    }, db);
  }
  await withTransaction(async (tx) => {
    // One metadata insert for the complete inventory; never replace a newer program or create content versions.
    const timestamp = new Date().toISOString();
    await execute(`INSERT OR IGNORE INTO programs (id,direction_id,title_json,created_at) VALUES ${courseDirections.map(() => '(?,?,?,?)').join(',')}`, courseDirections.flatMap(direction => [direction.id, direction.id, JSON.stringify(direction.title), timestamp]), tx);
  }, db);
  return db;
}

export function databaseConfigured() {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) return /^(libsql|https):\/\//.test(remote) && Boolean(process.env.TURSO_AUTH_TOKEN);
  return !process.env.VERCEL;
}

/** Read the fresh connection default; setting PRAGMA on a migration HTTP stream is insufficient. */
export async function assertDefaultForeignKeys(db: Client) {
  const result = await db.execute('PRAGMA foreign_keys');
  if (Number(result.rows[0]?.foreign_keys) !== 1) throw Object.assign(new Error('Database must enforce foreign keys on fresh connections'), { statusCode: 503, code: 'DATABASE_FOREIGN_KEYS_REQUIRED' });
}

export async function getDb(): Promise<Client> {
  if (database) return database;
  database = (async () => {
    const remoteUrl = process.env.TURSO_DATABASE_URL;
    if (process.env.VERCEL && (!remoteUrl || !process.env.TURSO_AUTH_TOKEN || !/^(libsql|https):\/\//.test(remoteUrl))) {
      throw Object.assign(new Error('Persistent database is not configured'), { statusCode: 503, code: 'DATABASE_NOT_CONFIGURED' });
    }
    if (remoteUrl && !/^(libsql|https):\/\//.test(remoteUrl)) throw new Error('TURSO_DATABASE_URL must use libsql:// or https://');
    const localPath = resolve(process.env.OT_DATABASE_PATH || resolve(process.cwd(), '.data/ot-center.sqlite'));
    if (!remoteUrl) mkdirSync(dirname(localPath), { recursive: true });
    // The deployed remote path imports the web client and has no native SQLite dependency.
    // File-backed development/testing loads the native adapter only when explicitly needed.
    const client = remoteUrl
      ? createRemoteClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN, intMode: 'number' })
      : (await import('@libsql/client')).createClient({ url: `file:${localPath.replaceAll('\\', '/')}`, intMode: 'number', concurrency: 1 });
    try {
      // Remote schema changes are an explicit release step, never a cold-start side effect.
      if (remoteUrl) await assertDefaultForeignKeys(client);
      else await migrate(client);
      return client;
    } catch (error) { client.close(); throw error; }
  })();
  try { return await database; } catch (error) { database = undefined; throw error; }
}

export async function closeDb() { const current = database; database = undefined; if (current) (await current).close(); }

export async function audit(actorId: string | null, action: string, target: string, reason = '', organizationId: string | null = null, db?: Db) {
  const id = randomUUID();
  await execute('INSERT INTO audit_events (id,actor_id,organization_id,action,target,reason,created_at) VALUES (?,?,?,?,?,?,?)', [id, actorId, organizationId, action, target, reason, new Date().toISOString()], db);
  return id;
}

export async function enqueue(type: string, aggregateId: string, payload: unknown, db?: Db) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await execute('INSERT INTO outbox (id,type,aggregate_id,payload_json,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [id, type, aggregateId, JSON.stringify(payload), now, now, now], db);
  return id;
}
