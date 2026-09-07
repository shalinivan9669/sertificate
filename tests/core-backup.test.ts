import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { migrate } from '../server/db';
import { decryptBackup, encryptBackup, exportDatabase, restoreDatabase } from '../scripts/db-backup';

let directory: string; let source: Client; let snapshot: Awaited<ReturnType<typeof exportDatabase>>;
const clients: Client[] = []; const password = 'Isolated-backup-test-passphrase-2026!';
const document = Buffer.from('PRIVATE SYNTHETIC DOCUMENT — NOT A CERTIFICATE').toString('base64');
function database(name: string) { const db = createClient({ url: `file:${join(directory, name).replaceAll('\\', '/')}`, concurrency: 1 }); clients.push(db); return db; }

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-backup-test-')); source = database('source.sqlite'); await migrate(source);
  const now = new Date().toISOString();
  for (const id of ['source-author', 'source-reviewer']) await source.execute({ sql: 'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)', args: [id, 'Synthetic backup account', `${id}@example.test`, Date.now(), Date.now()] });
  await source.execute({ sql: "INSERT INTO program_versions (id,program_id,version,status,data_json,created_by,approved_by,published_at,created_at,updated_at) VALUES (?, ?, 1, 'published', ?, ?, ?, ?, ?, ?)", args: ['restore-version', 'ohrana-truda', '{"title":"Synthetic restore test"}', 'source-author', 'source-reviewer', now, now, now] });
  await source.execute({ sql: "INSERT INTO enrollments (id,user_id,version_id,status,created_at) VALUES (?,?,?,'completed',?)", args: ['restore-enrollment', 'source-author', 'restore-version', now] });
  await source.execute({ sql: "INSERT INTO attempts (id,enrollment_id,status,deadline_at,form_json,result_json,created_at,submitted_at) VALUES (?,?,'graded',?,'{}',?, ?,?)", args: ['restore-attempt', 'restore-enrollment', now, '{"pass":false,"score":0}', now, now] });
  await source.execute({ sql: 'INSERT INTO audit_events (id,actor_id,action,target,reason,created_at) VALUES (?,?,?,?,?,?)', args: ['restore-audit', 'source-reviewer', 'synthetic.backup_fixture', 'restore-version', 'Isolated test evidence', now] });
  await source.execute({ sql: "INSERT INTO credentials (id,enrollment_id,attempt_id,serial,status,snapshot_json,verification_hash,document_base64,issued_by,created_at) VALUES (?,?,?,?,'revoked','{}',?,?,?,?)", args: ['synthetic-credential', 'restore-enrollment', 'restore-attempt', 'TEST-ONLY-BACKUP', 'test-only-hash', document, 'source-reviewer', now] });
  await source.execute('CREATE TABLE backup_binary_fixture (id TEXT PRIMARY KEY, payload BLOB NOT NULL)');
  await source.execute({ sql: 'INSERT INTO backup_binary_fixture VALUES (?,?)', args: ['binary', Buffer.from([0, 1, 2, 127, 128, 255])] });
  await source.execute({ sql: 'INSERT INTO support_notes(id,user_id,author_id,body,created_at) VALUES(?,?,?,?,?)', args: ['restore-note', 'source-author', 'source-reviewer', 'SYNTHETIC private support observation', now] });
  await source.execute({ sql: 'INSERT INTO program_intake_controls(version_id,is_open,actor_id,reason,updated_at) VALUES(?,0,?,?,?)', args: ['restore-version', 'source-reviewer', 'SYNTHETIC preserve stopped intake after restore', now] });
  await source.execute({ sql: 'INSERT INTO learning_reminders(id,user_id,enrollment_id,kind,due_at,timezone,lead_days_json,created_by,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', args: ['restore-reminder', 'source-author', 'restore-enrollment', 'renewal', '2030-01-01T00:00:00.000Z', 'Asia/Qyzylorda', '[7]', 'source-author', 'SYNTHETIC explicit planned date', now, now] });
  await source.execute({ sql: 'INSERT INTO learning_reminder_deliveries(id,reminder_id,revision,offset_days,scheduled_at,expires_at,created_at) VALUES(?,?,0,7,?,?,?)', args: ['restore-reminder-slot', 'restore-reminder', '2029-12-25T00:00:00.000Z', '2029-12-26T00:00:00.000Z', now] });
  await source.execute({ sql: 'INSERT INTO credential_batches(id,created_by,action,reason,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', args: ['restore-batch', 'source-reviewer', 'issue', 'SYNTHETIC preserve pending batch', '2030-01-01T00:00:00.000Z', now, now] });
  await source.execute({ sql: 'INSERT INTO credential_batch_items(batch_id,target_id,preview_json,fingerprint) VALUES(?,?,?,?)', args: ['restore-batch', 'restore-enrollment', '{"notice":"SYNTHETIC private preview"}', 'synthetic-preview-hash'] });
  snapshot = await exportDatabase(source);
});
after(async () => {
  for (const client of clients) client.close();
  const target = resolve(directory); assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-backup-test-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('encrypted backup protects private content and rejects wrong password or byte tampering', () => {
  const encrypted = encryptBackup(snapshot, password);
  assert.equal(encrypted.subarray(0, 4).toString(), 'OTB1'); assert.equal(encrypted.includes(Buffer.from('source-author@example.test')), false); assert.equal(encrypted.includes(Buffer.from(document)), false);
  assert.deepEqual(decryptBackup(encrypted, password), JSON.parse(JSON.stringify(snapshot)));
  assert.throws(() => decryptBackup(encrypted, 'Wrong-isolated-backup-password!'));
  for (const position of [10, 22, 38, encrypted.length - 1]) { const tampered = Buffer.from(encrypted); tampered[position] = tampered[position]! ^ 1; assert.throws(() => decryptBackup(tampered, password)); }
  assert.throws(() => encryptBackup(snapshot, 'short'), /24 characters/);
  assert.throws(() => decryptBackup(Buffer.from('OTB0'), password), /format/);
});
test('restore preserves data, private document bytes, binary values, migration checksums and immutable triggers', async () => {
  const target = database('restored.sqlite'); await restoreDatabase(target, decryptBackup(encryptBackup(snapshot, password), password));
  assert.deepEqual((await target.execute('SELECT * FROM schema_migrations ORDER BY name')).rows, (await source.execute('SELECT * FROM schema_migrations ORDER BY name')).rows);
  assert.equal((await target.execute('SELECT document_base64 FROM credentials WHERE id=\'synthetic-credential\'')).rows[0]!.document_base64, document);
  assert.deepEqual(Buffer.from((await target.execute('SELECT payload FROM backup_binary_fixture')).rows[0]!.payload as ArrayBuffer), Buffer.from([0, 1, 2, 127, 128, 255]));
  const restoredSchema = (await target.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows;
  const sourceSchema = (await source.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows;
  assert.deepEqual(restoredSchema, sourceSchema);
  assert.deepEqual((await exportDatabase(target)).tables, snapshot.tables, 'Every table row, including reminders, stopped intake, support notes and pending batches, survives encrypted restore');
  await assert.rejects(target.execute("UPDATE program_versions SET data_json='{}' WHERE id='restore-version'"), /immutable/);
  await assert.rejects(target.execute("UPDATE attempts SET result_json='{}' WHERE id='restore-attempt'"), /immutable/);
  await assert.rejects(target.execute('DELETE FROM audit_events'), /append-only/);
  await assert.rejects(target.execute({ sql: 'INSERT INTO enrollments (id,user_id,version_id,created_at) VALUES (?,?,?,?)', args: ['bad-fk', 'missing-user', 'restore-version', new Date().toISOString()] }), /FOREIGN KEY/);
  assert.equal((await target.execute('PRAGMA foreign_key_check')).rows.length, 0); assert.equal((await target.execute('PRAGMA integrity_check')).rows[0]![0], 'ok');
});
test('restore refuses an existing database and preserves its existing records', async () => {
  const target = database('nonempty.sqlite'); await target.execute('CREATE TABLE marker(value TEXT)'); await target.execute("INSERT INTO marker VALUES ('preserve-me')");
  await assert.rejects(restoreDatabase(target, snapshot), /empty.*overwrite/);
  assert.equal((await target.execute('SELECT value FROM marker')).rows[0]!.value, 'preserve-me');
});
test('a broken foreign key rolls back the complete restore, leaving no partial schema', async () => {
  const broken = JSON.parse(JSON.stringify(snapshot)); const table = broken.tables.find((table: any) => table.name === 'enrollments');
  table.rows[0][table.columns.indexOf('user_id')] = 'missing-user';
  const target = database('broken.sqlite'); await assert.rejects(restoreDatabase(target, broken), /foreign keys/);
  assert.equal((await target.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.length, 0);
  assert.equal((await target.execute('PRAGMA foreign_keys')).rows[0]![0], 1);
});
test('malformed backup row inventory and non-schema SQL are refused before writes', async () => {
  const target = database('invalid.sqlite');
  const malformed = JSON.parse(JSON.stringify(snapshot)); malformed.tables[0].rows.push([]);
  await assert.rejects(restoreDatabase(target, malformed), /row width/);
  const badSql = JSON.parse(JSON.stringify(snapshot)); badSql.schema[0].sql = "ATTACH DATABASE 'outside.sqlite' AS outside";
  await assert.rejects(restoreDatabase(target, badSql), /schema statement/);
  assert.equal((await target.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.length, 0);
});
