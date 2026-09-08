import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { runRemoteTransactionDrill } from '../scripts/remote-transaction-drill';

const previewHost = 'dpl-synthetic-preflight.aws-us-east-1.turso.io';
const keys = ['OT_APP_ENV', 'OT_ALLOW_REMOTE_DRILL', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] as const;
const baseline: Record<string, string | undefined> = {
  OT_APP_ENV: 'staging', OT_ALLOW_REMOTE_DRILL: '1', VERCEL: undefined, VERCEL_ENV: undefined,
  TURSO_DATABASE_URL: `libsql://${previewHost}`, TURSO_AUTH_TOKEN: 'SYNTHETIC-NOT-A-CREDENTIAL',
};
async function withEnvironment(values: Record<string, string | undefined>, operation: () => Promise<void>) {
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      const value = { ...baseline, ...values }[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await operation();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}
async function isolatedParent(operation: (parent: string) => Promise<void>) {
  const parent = await mkdtemp(join(tmpdir(), 'ot-drill-preflight-'));
  try { await operation(parent); }
  finally {
    const target = resolve(parent), root = resolve(tmpdir());
    assert.ok(target.startsWith(root + sep) && basename(target).startsWith('ot-drill-preflight-'));
    await rm(target, { recursive: true, force: true });
  }
}

test('remote drill refuses production, missing authorization and deployed environments before output or network', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic network must remain unused'); });
  await isolatedParent(async parent => {
    const cases: Array<[Record<string, string | undefined>, string, RegExp]> = [
      [{ OT_APP_ENV: 'production' }, previewHost, /Explicit staging environment/],
      [{ OT_APP_ENV: undefined }, previewHost, /Explicit staging environment/],
      [{ OT_ALLOW_REMOTE_DRILL: undefined }, previewHost, /Explicit remote drill flag/],
      [{ OT_ALLOW_REMOTE_DRILL: '0' }, previewHost, /Explicit remote drill flag/],
      [{ VERCEL: '1' }, previewHost, /outside a deployed application/],
      [{ VERCEL_ENV: 'preview' }, previewHost, /outside a deployed application/],
      [{ TURSO_DATABASE_URL: 'libsql://synthetic-production.aws-us-east-1.turso.io' }, 'synthetic-production.aws-us-east-1.turso.io', /existing preview host/],
      [{ TURSO_DATABASE_URL: 'libsql://dpl-another-preview.aws-us-east-1.turso.io' }, previewHost, /must match/],
      [{ TURSO_AUTH_TOKEN: undefined }, previewHost, /Preview credential required/],
    ];
    for (const [index, [env, host, message]] of cases.entries()) {
      await withEnvironment(env, async () => { await assert.rejects(runRemoteTransactionDrill(host, join(parent, `case-${index}`)), message); });
    }
    assert.deepEqual(await readdir(parent), []);
  });
  assert.equal(network.mock.callCount(), 0);
});

test('remote drill rejects credentials in the URL, non-root paths, queries, fragments, ports and unsupported schemes before mkdir', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic network must remain unused'); });
  await isolatedParent(async parent => {
    const urls = [`libsql://user:password@${previewHost}`, `libsql://${previewHost}/private`, `libsql://${previewHost}?secret=SYNTHETIC`,
      `libsql://${previewHost}#fragment`, `libsql://${previewHost}:8443`, `http://${previewHost}`, `file://${previewHost}/local.sqlite`];
    for (const [index, url] of urls.entries()) {
      await withEnvironment({ TURSO_DATABASE_URL: url }, async () => { await assert.rejects(runRemoteTransactionDrill(previewHost, join(parent, `case-${index}`)), { code: 'ERR_ASSERTION' }); });
    }
    assert.deepEqual(await readdir(parent), []);
  });
  assert.equal(network.mock.callCount(), 0);
});

test('both declared root URL schemes pass target validation but missing credential still prevents all side effects', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic network must remain unused'); });
  await isolatedParent(async parent => {
    for (const [index, url] of [`libsql://${previewHost}`, `https://${previewHost}/`].entries()) {
      await withEnvironment({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: '' }, async () => {
        await assert.rejects(runRemoteTransactionDrill(previewHost, join(parent, `scheme-${index}`)), /Preview credential required/);
      });
    }
    assert.deepEqual(await readdir(parent), []);
  });
  assert.equal(network.mock.callCount(), 0);
});

test('remote drill CLI sanitizes malformed secret-bearing URLs without creating output', async () => {
  await isolatedParent(async parent => {
    const output = join(parent, 'refused-cli-output');
    const marker = 'SYNTHETIC_PRIVATE_URL_AND_TOKEN_CANARY';
    const env = { ...process.env, OT_APP_ENV: 'staging', OT_ALLOW_REMOTE_DRILL: '1', VERCEL: '', VERCEL_ENV: '', TURSO_DATABASE_URL: marker, TURSO_AUTH_TOKEN: marker };
    const result = spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts/remote-transaction-drill.ts'), previewHost, output], { env, encoding: 'utf8', timeout: 15_000, windowsHide: true });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(`${result.stdout}${result.stderr}`.includes(marker), false);
    const report = JSON.parse(result.stderr.trim());
    assert.deepEqual(report, { passed: false, code: 'ERR_INVALID_URL', scope: 'remote preview drill preflight' });
    await assert.rejects(access(output), { code: 'ENOENT' }); assert.deepEqual(await readdir(parent), []);
  });
});
