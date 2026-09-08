import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, open, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { exportDatabase, restoreDatabase } from '../scripts/db-backup';
import { prepareStagingFixture, readFixture, stagingTarget, previewOrigin, insertFixtureTransaction, validateFixture, deploymentBinding, digest, gitMigrations, type Fixture } from '../scripts/staging-cache-fixture';

const origin = deploymentBinding.origin;
const host = deploymentBinding.tursoHostname;
const environment = { OT_APP_ENV: 'staging', OT_ALLOW_STAGING_CACHE_SEED: '1', OT_STAGING_CACHE_DEPLOYMENT_ID: deploymentBinding.deploymentId, OT_STAGING_CACHE_HOSTED_SOURCE_SHA: deploymentBinding.hostedSourceSha, OT_STAGING_CACHE_DATABASE_URL: 'libsql://' + host, OT_STAGING_CACHE_DATABASE_TOKEN: 'SYNTHETIC-token-never-used-for-network' };
let directory: string; let fixture: Fixture; let sourceHash: string; let sequence = 0;
const clients: Client[] = [];
before(async () => { directory = (await prepareStagingFixture(origin)).directory; fixture = await readFixture(directory); sourceHash = createHash('sha256').update(await readFile(resolve(directory, 'fixture-private.json'))).digest('hex'); });
after(() => { for (const client of clients) client.close(); });
async function target() {
  const path = resolve(directory, `local-import-test-${++sequence}.sqlite`); const reserved = await open(path, 'wx'); await reserved.close();
  const db = createClient({ url: 'file:' + path.replaceAll('\\', '/'), intMode: 'number', concurrency: 1 }); clients.push(db);
  await restoreDatabase(db, { ...fixture.baseline, format: 'ot-center-backup-v1' }); return db;
}
const rows = async (db: Client, name: string) => Number((await db.execute(`SELECT COUNT(*) FROM "${name}"`)).rows[0]![0]);

test('T017 explicit dedicated preview validation accepts only its exact scoped host', () => {
  assert.equal(stagingTarget(host, environment).url, 'libsql://' + host); assert.equal(previewOrigin(origin), origin);
});
test('T017 preflight rejects production/default/deployed contexts before connecting', () => {
  for (const override of [{ OT_APP_ENV: 'production' }, { OT_ALLOW_STAGING_CACHE_SEED: '0' }, { OT_STAGING_CACHE_DEPLOYMENT_ID: 'wrong-deployment' }, { OT_STAGING_CACHE_HOSTED_SOURCE_SHA: '0'.repeat(40) }, { VERCEL: '1' }, { VERCEL_ENV: 'preview' }, { TURSO_DATABASE_URL: 'libsql://existing.invalid' }, { TURSO_AUTH_TOKEN: 'SYNTHETIC forbidden inherited credential' }]) assert.throws(() => stagingTarget(host, { ...environment, ...override }));
  assert.throws(() => stagingTarget('database-sky-village.aws-us-east-1.turso.io', environment));
});
test('T017 target rejects wrong host, userinfo, path, query, insecure protocol and missing credential', () => {
  for (const value of [`libsql://dpl-other.aws-us-east-1.turso.io`, `libsql://user:pass@${host}`, `libsql://${host}/table`, `libsql://${host}?token=synthetic`, `http://${host}`, `file:/tmp/test.sqlite`]) assert.throws(() => stagingTarget(host, { ...environment, OT_STAGING_CACHE_DATABASE_URL: value }));
  assert.throws(() => stagingTarget(host, { ...environment, OT_STAGING_CACHE_DATABASE_TOKEN: '' }));
  for (const value of ['https://www.otcenter.kz', 'https://sertificate.vercel.app', 'https://example.com', origin + '/api', origin + '?test=1', origin.replace('https:', 'http:')]) assert.throws(() => previewOrigin(value));
});
test('T017 local fixture has two distinct random credentials, no sessions/payments and a server-issued TEST document', () => {
  assert.notEqual(fixture.learners[0].password, fixture.learners[1].password); assert.equal(validateFixture(fixture), fixture);
  assert.ok(fixture.snapshot.tables.find(table => table.name === 'attempts')!.rows.length === 1);
  assert.ok(fixture.snapshot.tables.find(table => table.name === 'credentials')!.rows.length === 1);
});

test('T017 records local migration commit separately from hosted source and actual preparation bytes', async () => {
  assert.equal(fixture.migrationGitSourceSha, fixture.preparationSource.workspaceHeadSha);
  assert.deepEqual(fixture.deploymentBinding, deploymentBinding);
  assert.equal(fixture.preparationSource.fingerprint, digest(JSON.stringify(fixture.preparationSource.files)));
  for (const path of ['scripts/staging-cache-local-worker.ts', 'scripts/staging-cache-fixture.ts', 'server/services/catalog.ts', 'package-lock.json']) {
    const input = fixture.preparationSource.files.find(item => item.path === path); assert.ok(input);
    assert.equal(input.sha256, digest(await readFile(resolve(path))));
  }
  const copy = structuredClone(fixture); copy.preparationSource.files[0]!.sha256 = '0'.repeat(64);
  assert.throws(() => validateFixture(copy));
});
test('T017 migration preparation works from a single-commit CI checkout without historical hosted commit', async () => {
  const repo = resolve(directory, 'single-commit-repo');
  const sqlDirectory = resolve(repo, 'server/db/migrations'); await mkdir(sqlDirectory, { recursive: true });
  const original = gitMigrations(resolve('.'));
  for (const migration of original.migrations) await writeFile(resolve(sqlDirectory, migration.name), migration.bytes, { flag: 'wx' });
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['add', 'server/db/migrations']);
  git(['-c', 'user.name=Synthetic CI fixture', '-c', 'user.email=ci@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic one-commit migration fixture']);
  assert.throws(() => git(['cat-file', '-e', deploymentBinding.hostedSourceSha]));
  const result = gitMigrations(repo);
  assert.equal(result.migrationGitSourceSha, git(['rev-parse', 'HEAD']));
  assert.deepEqual(result.migrations.map(item => [item.name, item.checksum]), original.migrations.map(item => [item.name, item.checksum]));
});

test('T017 fixture rejects extra identity, forged session, changed role and document hash', () => {
  for (const mutation of [
    (copy: Fixture) => copy.learners.push(copy.learners[0]),
    (copy: Fixture) => { const table = copy.snapshot.tables.find(table => table.name === 'session')!; table.rows.push(table.columns.map(() => null)); },
    (copy: Fixture) => { const table = copy.snapshot.tables.find(table => table.name === 'user')!; table.rows[0]![table.columns.indexOf('role')] = 'admin'; },
    (copy: Fixture) => { copy.pdfSha256 = '0'.repeat(64); },
  ]) { const copy = structuredClone(fixture); mutation(copy); assert.throws(() => validateFixture(copy)); }
});
test('T017 exact transaction imports populated fixture once and refuses replay without overwrite', async () => {
  const db = await target(); assert.equal((await insertFixtureTransaction(db, fixture)).imported, true);
  assert.equal(await rows(db, 'user'), 5); assert.equal(await rows(db, 'account'), 2); assert.equal(await rows(db, 'session'), 0); assert.equal(await rows(db, 'credentials'), 1);
  const before = await exportDatabase(db); await assert.rejects(insertFixtureTransaction(db, fixture)); const after = await exportDatabase(db);
  assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.schema, before.schema);
  assert.equal(createHash('sha256').update(await readFile(resolve(directory, 'fixture-private.json'))).digest('hex'), sourceHash);
});
test('T017 populated remote-equivalent target refuses before any fixture insertion', async () => {
  const db = await target(); await db.execute("INSERT INTO rate_limits(key,count,reset_at) VALUES('existing-row',1,1)");
  await assert.rejects(insertFixtureTransaction(db, fixture)); assert.equal(await rows(db, 'user'), 0); assert.equal(await rows(db, 'rate_limits'), 1);
});
test('T017 changed migration checksum, registry and unexpected schema independently refuse import', async () => {
  for (const sql of ["UPDATE schema_migrations SET checksum='wrong' WHERE name='013-partial-refunds.sql'", "UPDATE programs SET status='suspended' WHERE id='ohrana-truda'", 'CREATE TABLE unexpected_owner_data(id INTEGER)']) {
    const db = await target(); await db.execute(sql); await assert.rejects(insertFixtureTransaction(db, fixture)); assert.equal(await rows(db, 'user'), 0);
  }
});
test('T017 mid-insert failure rolls all fixture rows back without replaying writes', async () => {
  const db = await target(); let userInsertCalls = 0; let transactionCalls = 0;
  const wrapped = { execute: db.execute.bind(db), transaction: async () => {
    transactionCalls++; const tx = await db.transaction('write');
    return { get closed() { return tx.closed; }, commit: tx.commit.bind(tx), rollback: tx.rollback.bind(tx), close: tx.close.bind(tx), execute: async (statement: any) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.startsWith('INSERT INTO "user"')) userInsertCalls++;
      if (sql.startsWith('INSERT INTO "credentials"')) throw new Error('Synthetic mid-import failure'); return tx.execute(statement);
    } };
  } } as unknown as Client;
  await assert.rejects(insertFixtureTransaction(wrapped, fixture)); assert.equal(transactionCalls, 1); assert.equal(userInsertCalls, 5);
  for (const table of ['user', 'account', 'program_versions', 'enrollments', 'credentials', 'audit_events']) assert.equal(await rows(db, table), 0);
});
test('T017 a second local preparation cannot overwrite an existing owned UUID directory', async () => {
  await assert.rejects(prepareStagingFixture(origin, fixture.runId));
  assert.equal(createHash('sha256').update(await readFile(resolve(directory, 'fixture-private.json'))).digest('hex'), sourceHash);
});
