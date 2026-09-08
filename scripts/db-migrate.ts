import { createClient } from '@libsql/client';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { assertDefaultForeignKeys, migrate } from '../server/db';

const remote = process.env.TURSO_DATABASE_URL;
if (remote && !process.argv.includes('--remote')) throw new Error('Remote migration requires the explicit --remote flag. Verify the intended environment first.');
if (remote && !process.env.TURSO_AUTH_TOKEN) throw new Error('TURSO_AUTH_TOKEN is required');
const local = resolve(process.env.OT_DATABASE_PATH || '.data/ot-center.sqlite');
if (!remote) await mkdir(resolve(local, '..'), { recursive: true });
const db = createClient({ url: remote || `file:${local.replaceAll('\\', '/')}`, authToken: process.env.TURSO_AUTH_TOKEN });
try { if (remote) await assertDefaultForeignKeys(db); await migrate(db); console.log(JSON.stringify({ status: 'migrated', backend: remote ? 'remote-libsql' : 'local-libsql' })); }
finally { db.close(); }
