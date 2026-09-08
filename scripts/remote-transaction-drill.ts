/** Database-contract drill on an explicitly selected preview database; application tables are read only. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client/web';
import { withTransaction } from '../server/db';
import { requiredMigrations } from '../server/db/required-migrations';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const allowedError = (error: unknown) => {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,60}$/.test(code) ? code : 'REMOTE_DRILL_FAILED';
};

export async function runRemoteTransactionDrill(expectedHost: string, outputDirectory: string) {
  assert.equal(process.env.OT_APP_ENV, 'staging', 'Explicit staging environment required');
  assert.equal(process.env.OT_ALLOW_REMOTE_DRILL, '1', 'Explicit remote drill flag required');
  assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV, 'Run outside a deployed application');
  assert.ok(/^dpl-[a-z0-9-]+\.aws-us-east-1\.turso\.io$/.test(expectedHost), 'Explicit existing preview host required');
  const target = new URL(process.env.TURSO_DATABASE_URL || '');
  assert.ok(['libsql:', 'https:'].includes(target.protocol));
  assert.equal(target.hostname, expectedHost, 'Credential target must match the explicitly selected preview');
  assert.ok(!target.username && !target.password && !target.search && !target.hash && !target.port && ['', '/'].includes(target.pathname), 'Unexpected database URL components');
  assert.ok(process.env.TURSO_AUTH_TOKEN, 'Preview credential required');
  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: false });
  const runId = randomUUID();
  const prefix = `otdrill_${runId.replaceAll('-', '')}`;
  const stateTable = `${prefix}_state`, commandTable = `${prefix}_commands`;
  const report = {
    runId, startedAt: new Date().toISOString(), finishedAt: '', passed: false,
    scope: 'Real remote libSQL clients and the application transaction wrapper, using only new run-owned scratch tables in a pre-existing preview branch. No application rows, migrations, accounts, learning records, messages or provider calls are changed. This is a database-contract drill, not a full hosted learning or delivery pilot.',
    connections: 4, checks: [] as { name: string; passed: boolean; detail?: unknown }[],
    cleanup: { attempted: false, removedScratchTables: false, applicationInventoryUnchanged: false },
    failureCode: null as string | null, elapsedMs: 0,
  };
  const clients: Client[] = [];
  const started = performance.now();
  let creationAttempted = false, baseline = '';
  const check = (name: string, detail?: unknown) => report.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
  const inventory = async (db: Client) => {
    const migrationRows = (await db.execute('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
    assert.deepEqual(migrationRows.map(row => String(row.name)), [...requiredMigrations].sort());
    const schema = (await db.execute({ sql: "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT IN (?,?) ORDER BY type,name", args: [stateTable, commandTable] })).rows;
    const counts = [];
    for (const item of schema.filter(row => row.type === 'table')) {
      const name = String(item.name).replaceAll('"', '""');
      counts.push([item.name, Number((await db.execute(`SELECT COUNT(*) AS n FROM "${name}"`)).rows[0]?.n)]);
    }
    return hash({ schema, migrationRows, counts });
  };
  try {
    for (let index = 0; index < report.connections; index++) {
      const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
      clients.push(db);
      assert.equal(Number((await db.execute('PRAGMA foreign_keys')).rows[0]?.foreign_keys), 1);
    }
    check('four_fresh_remote_clients_enforce_foreign_keys');
    baseline = await inventory(clients[0]!);
    // Never create, seed, migrate, delete or update an application table.
    assert.equal((await clients[0]!.execute({ sql: 'SELECT name FROM sqlite_master WHERE name IN (?,?)', args: [stateTable, commandTable] })).rows.length, 0);
    creationAttempted = true;
    await withTransaction(async tx => {
      await tx.execute(`CREATE TABLE "${stateTable}"(id INTEGER PRIMARY KEY,value INTEGER NOT NULL,revision INTEGER NOT NULL)`);
      await tx.execute(`CREATE TABLE "${commandTable}"(id TEXT PRIMARY KEY,state_id INTEGER NOT NULL REFERENCES "${stateTable}"(id))`);
      await tx.execute(`INSERT INTO "${stateTable}" VALUES(1,0,0)`);
    }, clients[0]!);
    check('unique_scratch_schema_created_in_one_transaction');

    let callbacks = 0;
    const results = await Promise.allSettled(clients.map(async db => {
      for (let operation = 0; operation < 4; operation++) {
        await withTransaction(async tx => {
          callbacks++;
          const result = await tx.execute({ sql: `INSERT OR IGNORE INTO "${commandTable}"(id,state_id) VALUES(?,1)`, args: [`command-${operation}`] });
          if (result.rowsAffected === 1) await tx.execute(`UPDATE "${stateTable}" SET value=value+1,revision=revision+1 WHERE id=1`);
        }, db);
      }
    }));
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    assert.equal(callbacks, 16, 'Transaction callback must not be replayed');
    const state = (await clients[0]!.execute(`SELECT value,revision FROM "${stateTable}" WHERE id=1`)).rows[0]!;
    assert.equal(Number(state.value), 4); assert.equal(Number(state.revision), 4);
    assert.equal(Number((await clients[0]!.execute(`SELECT COUNT(*) n FROM "${commandTable}"`)).rows[0]!.n), 4);
    check('sixteen_competing_transactions_produce_four_idempotent_effects', { callbacks, uniqueCommands: 4, finalValue: 4 });

    const revisionResults = await Promise.allSettled(clients.map(db => withTransaction(async tx => {
      const result = await tx.execute(`UPDATE "${stateTable}" SET revision=revision+1 WHERE id=1 AND revision=4`);
      return result.rowsAffected;
    }, db)));
    for (const result of revisionResults) if (result.status === 'rejected') throw result.reason;
    assert.deepEqual(revisionResults.map(result => (result as PromiseFulfilledResult<number>).value).sort(), [0, 0, 0, 1]);
    check('one_of_four_competing_revision_writes_succeeds');

    const intentional = new Error('intentional rollback');
    let rollbackCallbacks = 0;
    await assert.rejects(withTransaction(async tx => {
      rollbackCallbacks++;
      await tx.execute(`INSERT INTO "${commandTable}" VALUES('rolled-back',1)`);
      await tx.execute(`UPDATE "${stateTable}" SET value=99 WHERE id=1`);
      throw intentional;
    }, clients[1]!), error => error === intentional);
    assert.equal(rollbackCallbacks, 1);
    assert.equal(Number((await clients[2]!.execute(`SELECT COUNT(*) n FROM "${commandTable}" WHERE id='rolled-back'`)).rows[0]!.n), 0);
    assert.equal(Number((await clients[2]!.execute(`SELECT value FROM "${stateTable}" WHERE id=1`)).rows[0]!.value), 4);
    check('callback_failure_rolls_back_both_writes_without_replay');

    await assert.rejects(withTransaction(tx => tx.execute(`INSERT INTO "${commandTable}" VALUES('invalid-reference',999)`), clients[3]!), error => /SQLITE_CONSTRAINT_FOREIGNKEY/.test(allowedError(error)) || /FOREIGN KEY constraint failed/i.test(String((error as Error)?.message)));
    assert.equal(Number((await clients[0]!.execute(`SELECT COUNT(*) n FROM "${commandTable}" WHERE id='invalid-reference'`)).rows[0]!.n), 0);
    check('foreign_key_rejection_leaves_no_committed_command');
    assert.equal((await clients[0]!.execute('PRAGMA foreign_key_check')).rows.length, 0);
    check('remote_foreign_key_integrity_after_concurrency');
  } catch (error) {
    report.failureCode = allowedError(error);
  } finally {
    if (creationAttempted) {
      report.cleanup.attempted = true;
      try {
        // Both names were generated here and absent before our CREATE attempt. Even when
        // a COMMIT response is lost, inspect/clean those exact names without replaying work.
        assert.ok(new RegExp(`^otdrill_[a-f0-9]{32}_(state|commands)$`).test(stateTable));
        assert.ok(new RegExp(`^otdrill_[a-f0-9]{32}_(state|commands)$`).test(commandTable));
        await withTransaction(async tx => {
          await tx.execute(`DROP TABLE IF EXISTS "${commandTable}"`);
          await tx.execute(`DROP TABLE IF EXISTS "${stateTable}"`);
        }, clients[0]!);
        assert.equal((await clients[0]!.execute({ sql: 'SELECT name FROM sqlite_master WHERE name IN (?,?)', args: [stateTable, commandTable] })).rows.length, 0);
        report.cleanup.removedScratchTables = true;
      } catch { report.failureCode ||= 'SCRATCH_CLEANUP_FAILED'; }
    }
    if (baseline && clients[0]) {
      try { report.cleanup.applicationInventoryUnchanged = await inventory(clients[0]) === baseline; }
      catch { report.failureCode ||= 'FINAL_INVENTORY_FAILED'; }
      if (!report.cleanup.applicationInventoryUnchanged) report.failureCode ||= 'APPLICATION_INVENTORY_CHANGED';
    }
    for (const db of clients) db.close();
    report.passed = !report.failureCode && report.cleanup.removedScratchTables && report.cleanup.applicationInventoryUnchanged;
    report.finishedAt = new Date().toISOString(); report.elapsedMs = Math.round(performance.now() - started);
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [host, output, ...rest] = process.argv.slice(2);
  if (!host || !output || rest.length) throw new Error('Usage: remote-transaction-drill.ts <explicit-preview-host> <new-report-directory>');
  try {
    const report = await runRemoteTransactionDrill(host, output);
    console.log(JSON.stringify(report)); process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ passed: false, code: allowedError(error), scope: 'remote preview drill preflight' }));
    process.exitCode = 1;
  }
}
