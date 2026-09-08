import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
for (const baseline of [5, 10]) {
  test(`populated schema ${baseline} upgrade to 012 preserves every old value without inventing attribution or sales facts`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ot-migration-upgrade-'));
    const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', OT_ALLOW_MIGRATION_FIXTURE: '1' };
    for (const key of Object.keys(environment)) if (/^(?:VERCEL|TURSO_|AMO_|SMTP_|MAIL_FROM$)/.test(key)) delete environment[key];
    try {
      // Native SQLite handles are released by the child process before Windows cleanup.
      // The fixture retains the complete data, checksum, FK, replay and immutability assertions.
      const result = await run(process.execPath, ['--import', 'tsx', resolve('tests/migration-upgrade-fixture.ts'), String(baseline), directory], {
        env: environment, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024,
      });
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), { baseline, target: 12, assertions: 'passed' });
    } finally {
      const target = resolve(directory);
      assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-migration-upgrade-'));
      await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
}
