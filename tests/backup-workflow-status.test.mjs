import assert from 'node:assert/strict';
import test from 'node:test';
import { observeBackupWorkflow, observationOutputs } from '../scripts/backup-workflow-status.mjs';

const repository = 'example/ot-center', token = 'synthetic-private-token';
const now = Date.parse('2026-09-08T12:00:00Z');
const iso = hours => new Date(now - hours * 3_600_000).toISOString();
const repo = { id: 42, full_name: repository, default_branch: 'main' };
const definition = { id: 9, path: '.github/workflows/database-backup.yml', state: 'active' };
function run(id, overrides = {}) {
  return { id, run_attempt: 1, workflow_id: 9, path: definition.path, head_branch: 'main', event: 'schedule', repository: repo, head_repository: repo,
    head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'success', updated_at: iso(1), ...overrides };
}
function artifact(runId, overrides = {}) {
  return { id: runId + 1000, name: `ot-center-db-backup-${runId}-1`, expired: false, created_at: iso(2), expires_at: iso(-100), size_in_bytes: 1024,
    digest: `sha256:${'b'.repeat(64)}`, workflow_run: { id: runId, repository_id: 42, head_repository_id: 42, head_branch: 'main', head_sha: 'a'.repeat(40) }, ...overrides };
}
function fixture({ runs = [run(10)], artifacts = {}, jobs = {}, inventory = [], pages, state = 'active', missingWorkflow = false, failPath } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url); calls.push(parsed.pathname + parsed.search);
    assert.equal(parsed.origin, 'https://api.github.com'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${token}`); assert.ok(options.signal);
    if (failPath && parsed.pathname.includes(failPath)) return new Response(`provider leaked ${token}`, { status: 500 });
    let data;
    if (parsed.pathname === `/repos/${repository}`) data = repo;
    else if (parsed.pathname.endsWith('/actions/artifacts')) data = pages?.[Number(parsed.searchParams.get('page')) - 1] ?? { total_count: inventory.length, artifacts: inventory };
    else if (parsed.pathname.endsWith('/workflows/database-backup.yml')) {
      if (missingWorkflow) return new Response('', { status: 404 });
      data = { ...definition, state };
    } else if (parsed.pathname.endsWith('/workflows/database-backup.yml/runs')) data = { total_count: runs.length, workflow_runs: runs };
    else if (/\/runs\/\d+\/attempts\/\d+\/jobs$/.test(parsed.pathname)) {
      const runId = Number(parsed.pathname.match(/\/runs\/(\d+)/)[1]);
      const list = jobs[runId] ?? [{ name: 'backup', run_id: runId, status: 'completed', conclusion: 'success' }];
      data = { total_count: list.length, jobs: list };
    } else if (/\/runs\/\d+\/artifacts$/.test(parsed.pathname)) {
      const runId = Number(parsed.pathname.match(/\/runs\/(\d+)/)[1]); const list = artifacts[runId] ?? [artifact(runId)];
      data = { total_count: list.length, artifacts: list };
    } else assert.fail(`unexpected read ${parsed.pathname}`);
    return new Response(JSON.stringify(data), { status: 200 });
  };
  return { calls, fetchImpl, observe: overrides => observeBackupWorkflow({ repository, token, now, fetchImpl, ...overrides }) };
}

test('backup observer requires explicit valid configuration and never sends credentials to another API host', async () => {
  const network = fixture();
  for (const config of [{ token: '' }, { repository: '../other/repo' }, { repository: 'owner/repo?secret=x' }, { workflow: '../../evil.yml' }, { freshHours: 0 }, { excludeRun: -1 }]) {
    const report = await network.observe(config); assert.equal(report.status, 'unconfigured'); assert.equal(report.storageBudget.budgetAllowed, false);
  }
  assert.equal(network.calls.length, 0);
});

test('fresh backup requires a successful exact job and one retained artifact belonging to that exact run and attempt', async () => {
  const network = fixture(); const report = await network.observe();
  assert.equal(report.status, 'fresh'); assert.equal(report.latestAttempt.jobConclusion, 'success'); assert.equal(report.latestUploadedBackup.runId, 10);
  assert.equal(report.latestUploadedBackup.ageHours, 2); assert.equal(report.storageBudget.budgetAllowed, true);
  assert.match(observationOutputs(report), /^status=fresh\nbudget_allowed=true\n/);
  assert.equal(network.calls.some(path => /\/zip|download/.test(path)), false);
});

test('disabled skipped backup is not a successful backup even when the workflow conclusion is success', async () => {
  const network = fixture({ jobs: { 10: [{ name: 'backup', run_id: 10, status: 'completed', conclusion: 'skipped' }] } });
  const report = await network.observe(); assert.equal(report.status, 'missing'); assert.equal(report.latestUploadedBackup, null);
  assert.equal(report.latestAttempt.jobConclusion, 'skipped'); assert.equal(network.calls.some(path => /\/runs\/10\/artifacts/.test(path)), false);
});

test('missing, duplicate, expired, oversized, wrong-attempt and foreign artifacts never produce a backup success', async () => {
  const invalid = [[], [artifact(10), artifact(10, { id: 9999 })], [artifact(10, { expired: true })], [artifact(10, { expires_at: iso(1) })],
    [artifact(10, { size_in_bytes: 9 * 1024 * 1024 + 1 })], [artifact(10, { size_in_bytes: 0 })], [artifact(10, { name: 'ot-center-db-backup-10-2' })],
    [artifact(10, { workflow_run: { ...artifact(10).workflow_run, repository_id: 99 } })], [artifact(10, { digest: 'untrusted' })]];
  for (const artifacts of invalid) {
    const report = await fixture({ artifacts: { 10: artifacts } }).observe(); assert.equal(report.status, 'missing'); assert.equal(report.latestUploadedBackup, null);
  }
});

test('a failed latest attempt with a retained recent previous upload is degraded and an old upload is stale', async () => {
  const config = { runs: [run(11, { conclusion: 'failure', updated_at: iso(0.5) }), run(10)], jobs: { 11: [{ name: 'backup', run_id: 11, status: 'completed', conclusion: 'failure' }] } };
  const report = await fixture(config).observe(); assert.equal(report.status, 'degraded'); assert.equal(report.latestAttempt.runId, 11); assert.equal(report.latestUploadedBackup.runId, 10);
  const stale = await fixture({ ...config, artifacts: { 10: [artifact(10, { created_at: iso(37) })] } }).observe(); assert.equal(stale.status, 'stale');
  const threshold = await fixture({ artifacts: { 10: [artifact(10, { created_at: iso(37) })] } }).observe({ freshHours: 48 }); assert.equal(threshold.status, 'fresh');
});

test('only this main workflow scheduled or manually dispatched runs count; current run is excluded', async () => {
  const network = fixture({ runs: [run(30), run(29, { event: 'push' }), run(28, { head_branch: 'other' }), run(27, { head_repository: { id: 77, full_name: 'other/fork' } }), run(26, { workflow_id: 90 }), run(10, { event: 'workflow_dispatch' })] });
  const report = await network.observe({ excludeRun: 30 }); assert.equal(report.latestUploadedBackup.runId, 10); assert.equal(report.runsExamined, 1);
  assert.equal(network.calls.some(path => /\/runs\/(30|29|28|27|26)\//.test(path)), false);
});

test('latest success without an eligible artifact is degraded if an earlier retained upload exists', async () => {
  const report = await fixture({ runs: [run(11, { updated_at: iso(0.5) }), run(10)], artifacts: { 11: [] } }).observe();
  assert.equal(report.status, 'degraded'); assert.equal(report.latestUploadedBackup.runId, 10);
});

test('storage budget accounts for manual reruns, byte reserves, all repository artifacts and incomplete pagination', async () => {
  const seven = Array.from({ length: 7 }, (_, index) => artifact(index + 1));
  assert.equal((await fixture({ inventory: seven }).observe()).storageBudget.budgetAllowed, false);
  assert.equal((await fixture({ inventory: [artifact(1, { size_in_bytes: 56 * 1024 * 1024 })] }).observe()).storageBudget.budgetAllowed, false);
  assert.equal((await fixture({ inventory: [artifact(1, { name: 'other-ci-output', size_in_bytes: 392 * 1024 * 1024 })] }).observe()).storageBudget.budgetAllowed, false);
  const boundary = await fixture({ inventory: [artifact(1, { name: 'other-ci-output', size_in_bytes: 391 * 1024 * 1024 })] }).observe(); assert.equal(boundary.storageBudget.budgetAllowed, true);
  for (const pages of [[{ total_count: 501, artifacts: [] }], [{ total_count: 2, artifacts: [artifact(1)] }], [{ total_count: 2, artifacts: [artifact(1), artifact(1)] }]]) {
    const report = await fixture({ pages }).observe(); assert.equal(report.status, 'unknown'); assert.equal(report.storageBudget.status, 'unknown'); assert.equal(report.storageBudget.budgetAllowed, false);
  }
});

test('complete storage pagination is bounded to five pages and successful-run search is bounded to twenty runs', async () => {
  const inventory = Array.from({ length: 500 }, (_, index) => artifact(index + 1, { name: 'other-small-artifact' }));
  const pages = Array.from({ length: 5 }, (_, index) => ({ total_count: 500, artifacts: inventory.slice(index * 100, (index + 1) * 100) }));
  const runs = Array.from({ length: 21 }, (_, index) => run(100 - index, { updated_at: iso(index) }));
  const artifacts = Object.fromEntries(runs.map(item => [item.id, []]));
  const network = fixture({ pages, runs, artifacts }); const report = await network.observe();
  assert.equal(report.storageBudget.status, 'observed'); assert.equal(report.storageBudget.allRepoRetainedBytes, 500 * 1024);
  assert.equal(report.runsTruncated, true); assert.equal(report.runsExamined, 20); assert.equal(report.requests, 48); assert.equal(report.status, 'missing');
  assert.equal(network.calls.some(path => /\/runs\/80\//.test(path)), false);
});

test('provider failures and thrown secret-bearing errors produce only safe unknown codes', async () => {
  const report = await fixture({ failPath: '/actions/artifacts' }).observe();
  assert.equal(report.status, 'unknown'); assert.equal(report.storageBudget.budgetAllowed, false); assert.equal(JSON.stringify(report).includes(token), false);
  const thrown = await observeBackupWorkflow({ repository, token, now, fetchImpl: async () => { throw new Error(`sensitive ${token}`); } });
  assert.equal(thrown.reason, 'api_unavailable'); assert.equal(JSON.stringify(thrown).includes(token), false);
});

test('a missing workflow can still report a complete storage budget for its first authorized run', async () => {
  const report = await fixture({ missingWorkflow: true }).observe(); assert.equal(report.status, 'missing'); assert.equal(report.reason, 'workflow_not_found'); assert.equal(report.storageBudget.budgetAllowed, true);
});
