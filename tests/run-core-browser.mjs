import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { chromium } from '@playwright/test';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || ['VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].some(key => process.env[key])) throw new Error('Explicit isolated local browser environment required');
const root = resolve('.'); const runId = randomUUID();
const directory = resolve('.data', `core-browser-${runId}`); await mkdir(directory, { recursive: false });
const artifactRoot = resolve(process.env.OT_E2E_ARTIFACT_ROOT || root);
const entry = resolve(artifactRoot, '.output/server/index.mjs');
assert.ok(existsSync(entry), 'A completed Node build is required');
const build = JSON.parse(await readFile(resolve(artifactRoot, '.output/public/_nuxt/builds/latest.json'), 'utf8'));
const output = resolve('artifacts/core-browser', runId); await mkdir(output, { recursive: true });
const suiteFiles = { classic: 'tests/classic-browser.mjs', auth: 'tests/lms-auth-browser.mjs', contact: 'tests/contact-browser.mjs', leadContext: 'tests/lead-context-browser.mjs', learner: 'tests/lms-browser.mjs', staff: 'tests/lms-admin-browser.mjs' };
const suites = process.env.OT_CORE_BROWSER_SUITES ? process.env.OT_CORE_BROWSER_SUITES.split(',') : Object.keys(suiteFiles);
assert.ok(suites.length && new Set(suites).size === suites.length && suites.every(suite => Object.hasOwn(suiteFiles, suite)), 'Choose explicit known browser suites; an empty or unknown scope is not a pass');
const base = 'http://127.0.0.1:3105';
const env = { ...process.env, NODE_ENV: 'test', OT_APP_ENV: 'test', OT_ALLOW_TEST_SEED: '1', HOST: '127.0.0.1', PORT: '3105', TEST_BASE_URL: base, BETTER_AUTH_URL: base, NUXT_PUBLIC_SITE_URL: base,
  BETTER_AUTH_SECRET: 'isolated-core-browser-secret-not-for-production-2026', OT_DATABASE_PATH: resolve(directory, 'e2e.sqlite'), OT_E2E_FIXTURE_PATH: resolve(directory, 'fixture.json'), OT_MIGRATIONS_DIR: resolve(root, 'server/db/migrations'),
  OT_EMAIL_DELIVERY_ENABLED: '0', OT_CRM_DELIVERY_ENABLED: '0', OT_OPERATIONAL_ALERTS_ENABLED: '0', OT_PAYMENT_PROVIDER: 'disabled', OT_INVOICE_ENABLED: '1',
  OT_INVOICE_ISSUER_JSON: JSON.stringify({ name: 'ISOLATED TEST ISSUER - DO NOT PAY', bin: '000000000000', address: 'ISOLATED TEST ADDRESS', bankName: 'ISOLATED TEST BANK', bic: 'TESTKZ00', iban: 'KZ000000000000000000', paymentPurpose: 'ISOLATED TEST ONLY - DO NOT PAY' }),
  BROWSER_PATH: process.env.BROWSER_PATH || chromium.executablePath(),
};
for (const key of Object.keys(env)) if (/^(?:SMTP_|MAIL_FROM$|AMO_|TURSO_|VERCEL|OT_SANDBOX_|CRON_SECRET$|OT_ALERT_EMAIL$)/.test(key)) delete env[key];
function child(args, options = {}) { return spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: 'inherit', ...options }); }
async function run(script, ts = false) {
  const process = child([...(ts ? ['--import', 'tsx'] : []), script]);
  const [code, signal] = await once(process, 'exit');
  if (code !== 0) throw new Error(`${script} failed: ${code ?? signal}`);
}
const probe = createServer(); probe.listen(3105, '127.0.0.1'); await once(probe, 'listening'); await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
await run('tests/e2e-fixtures.ts', true);
const log = createWriteStream(resolve(output, 'server.log'), { flags: 'wx' });
const server = child([entry], { stdio: ['ignore', 'pipe', 'pipe'] }); server.stdout.pipe(log); server.stderr.pipe(log);
const results = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Isolated browser server exited before readiness');
    try { const response = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(1000) }); ready = response.ok && (await response.json()).status === 'ready'; } catch { /* bounded startup polling */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Local server must pass schema readiness before any browser mutation');
  for (const script of suites.map(suite => suiteFiles[suite])) {
    await run(script); results.push({ script, status: 'passed' });
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ status: 'passed', buildId: build.id, base, results, syntheticOnly: true, externalDelivery: false, finishedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ status: 'passed', buildId: build.id, suites: results.length, report: resolve(output, 'report.json') }));
} finally {
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  log.end();
}
