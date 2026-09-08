import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const API = 'https://api.github.com';
const MIB = 1024 * 1024;
const WORKFLOW = 'database-backup.yml';
const BACKUP_NAME = /^ot-center-db-backup-[1-9]\d*-[1-9]\d*$/;
const MAX_UPLOAD_BYTES = 9 * MIB; // 8 MiB encrypted file plus manifest and ZIP overhead.
const id = value => Number.isSafeInteger(value) && value > 0;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const repositoryName = value => typeof value === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(value) && !['.', '..'].includes(value.split('/')[1]);

class ObservationError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Reads metadata only. A retained upload is not proof of decryption or restoration. */
export async function observeBackupWorkflow({ repository, workflow = WORKFLOW, token, excludeRun = null, freshHours = 36, jobName = 'backup', now = Date.now(), fetchImpl = fetch } = {}) {
  const validConfig = repositoryName(repository) && workflow === WORKFLOW && typeof token === 'string' && token.trim().length > 0
    && (excludeRun === null || id(excludeRun)) && Number.isFinite(freshHours) && freshHours > 0 && freshHours <= 168
    && typeof jobName === 'string' && /^[A-Za-z0-9 _-]{1,80}$/.test(jobName) && Number.isFinite(now);
  const report = {
    schemaVersion: 1, repository: repositoryName(repository) ? repository : null, workflow: WORKFLOW,
    observedAt: Number.isFinite(now) ? new Date(now).toISOString() : null, freshHours,
    status: 'unconfigured', reason: 'configuration_missing_or_invalid', latestAttempt: null, latestUploadedBackup: null,
    observationScope: 'GitHub Actions metadata; no archive download, decryption, database read or restore',
    storageBudget: { status: 'unknown', budgetAllowed: false, scope: 'this repository only; not account-wide billing', retainedBackups: null, backupBytes: null, allRepoRetainedBytes: null, reservedUploadBytes: MAX_UPLOAD_BYTES },
    runsExamined: 0, runsTruncated: false, requests: 0,
  };
  if (!validConfig) return report;
  const deadline = Date.now() + 60_000;
  const base = `/repos/${repository}`;
  async function get(path, allowMissing = false) {
    if (++report.requests > 48 || Date.now() >= deadline) throw new ObservationError('observation_limit');
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method: 'GET', redirect: 'error', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
        signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))),
      });
    } catch { throw new ObservationError('api_unavailable'); }
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new ObservationError(response.status === 403 || response.status === 429 ? 'api_access_or_rate_limit' : 'api_unavailable');
    try {
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2 * MIB) { await reader.cancel(); throw new ObservationError('api_response_limit'); }
        chunks.push(Buffer.from(chunk.value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) { throw error instanceof ObservationError ? error : new ObservationError('api_invalid_response'); }
  }
  try {
    const repo = await get(base);
    if (!id(repo.id) || repo.full_name?.toLowerCase() !== repository.toLowerCase() || repo.default_branch !== 'main') throw new ObservationError('repository_mismatch');
    const allArtifacts = []; const seen = new Set(); let total = null;
    for (let page = 1; page <= 5; page++) {
      const batch = await get(`${base}/actions/artifacts?per_page=100&page=${page}`);
      if (!Number.isSafeInteger(batch.total_count) || batch.total_count < 0 || batch.total_count > 500 || !Array.isArray(batch.artifacts)
        || batch.artifacts.length > 100 || (total !== null && total !== batch.total_count)) throw new ObservationError('storage_inventory_incomplete');
      total = batch.total_count;
      for (const artifact of batch.artifacts) {
        if (!id(artifact.id) || seen.has(artifact.id) || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes < 0
          || typeof artifact.expired !== 'boolean' || typeof artifact.name !== 'string' || instant(artifact.expires_at) === null) throw new ObservationError('storage_inventory_invalid');
        seen.add(artifact.id); allArtifacts.push(artifact);
      }
      if (allArtifacts.length === total) break;
      if (batch.artifacts.length !== 100 || allArtifacts.length > total || page === 5) throw new ObservationError('storage_inventory_incomplete');
    }
    // Count expired-at timestamps conservatively until GitHub marks the object expired.
    const retained = allArtifacts.filter(artifact => !artifact.expired);
    const backups = retained.filter(artifact => BACKUP_NAME.test(artifact.name));
    const backupBytes = backups.reduce((sum, artifact) => sum + artifact.size_in_bytes, 0);
    const allRepoRetainedBytes = retained.reduce((sum, artifact) => sum + artifact.size_in_bytes, 0);
    if (!Number.isSafeInteger(backupBytes) || !Number.isSafeInteger(allRepoRetainedBytes)) throw new ObservationError('storage_inventory_invalid');
    Object.assign(report.storageBudget, { status: 'observed', retainedBackups: backups.length, backupBytes, allRepoRetainedBytes,
      budgetAllowed: backups.length < 7 && backupBytes + MAX_UPLOAD_BYTES <= 64 * MIB && allRepoRetainedBytes + MAX_UPLOAD_BYTES <= 400 * MIB });
    const definition = await get(`${base}/actions/workflows/${workflow}`, true);
    if (definition === null) { report.status = 'missing'; report.reason = 'workflow_not_found'; return report; }
    if (!id(definition.id) || definition.path !== `.github/workflows/${workflow}`) throw new ObservationError('workflow_mismatch');
    const listing = await get(`${base}/actions/workflows/${workflow}/runs?branch=main&per_page=20`);
    if (!Array.isArray(listing.workflow_runs) || !Number.isSafeInteger(listing.total_count) || listing.total_count < 0) throw new ObservationError('api_invalid_response');
    report.runsTruncated = listing.total_count > 20 || listing.workflow_runs.length > 20;
    const runs = listing.workflow_runs.slice(0, 20).filter(run => id(run.id) && run.id !== excludeRun && id(run.run_attempt)
      && run.workflow_id === definition.id && run.path === definition.path && run.head_branch === 'main'
      && ['schedule', 'workflow_dispatch'].includes(run.event) && run.repository?.id === repo.id && run.head_repository?.id === repo.id
      && run.repository?.full_name?.toLowerCase() === repository.toLowerCase() && run.head_repository?.full_name?.toLowerCase() === repository.toLowerCase()
      && /^[a-f0-9]{40}$/.test(run.head_sha) && instant(run.updated_at) !== null && instant(run.updated_at) <= now + 60_000)
      .sort((a, b) => instant(b.updated_at) - instant(a.updated_at) || b.id - a.id);
    const statuses = new Set(['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested']);
    const conclusions = new Set(['success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale', 'startup_failure']);
    for (const run of runs) {
      report.runsExamined++;
      if (report.latestAttempt && run.status !== 'completed') continue;
      if (report.latestAttempt && run.conclusion !== 'success') continue;
      const jobs = await get(`${base}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
      if (!Array.isArray(jobs.jobs) || !Number.isSafeInteger(jobs.total_count) || jobs.total_count !== jobs.jobs.length || jobs.jobs.length > 100) throw new ObservationError('job_inventory_incomplete');
      const matchingJobs = jobs.jobs.filter(job => job.name === jobName && job.run_id === run.id);
      const job = matchingJobs.length === 1 ? matchingJobs[0] : null;
      if (!report.latestAttempt) report.latestAttempt = {
        runId: run.id, runAttempt: run.run_attempt, headSha: run.head_sha,
        status: statuses.has(run.status) ? run.status : 'unknown', conclusion: conclusions.has(run.conclusion) ? run.conclusion : null,
        jobStatus: statuses.has(job?.status) ? job.status : job ? 'unknown' : 'missing', jobConclusion: conclusions.has(job?.conclusion) ? job.conclusion : null,
        updatedAt: new Date(instant(run.updated_at)).toISOString(),
      };
      if (run.status !== 'completed' || run.conclusion !== 'success' || job?.status !== 'completed' || job.conclusion !== 'success') continue;
      const artifacts = await get(`${base}/actions/runs/${run.id}/artifacts?per_page=100`);
      if (!Array.isArray(artifacts.artifacts) || !Number.isSafeInteger(artifacts.total_count) || artifacts.total_count !== artifacts.artifacts.length || artifacts.artifacts.length > 100) throw new ObservationError('artifact_inventory_incomplete');
      const expectedName = `ot-center-db-backup-${run.id}-${run.run_attempt}`;
      const matches = artifacts.artifacts.filter(artifact => artifact.name === expectedName);
      if (matches.length !== 1) continue;
      const artifact = matches[0];
      const uploaded = instant(artifact.created_at), expires = instant(artifact.expires_at);
      if (!id(artifact.id) || artifact.expired !== false || uploaded === null || expires === null || expires <= now || uploaded > now + 60_000
        || !id(artifact.size_in_bytes) || artifact.size_in_bytes > MAX_UPLOAD_BYTES || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest)
        || artifact.workflow_run?.id !== run.id || artifact.workflow_run?.repository_id !== repo.id || artifact.workflow_run?.head_repository_id !== repo.id
        || artifact.workflow_run?.head_branch !== 'main' || artifact.workflow_run?.head_sha !== run.head_sha) continue;
      report.latestUploadedBackup = { runId: run.id, runAttempt: run.run_attempt, headSha: run.head_sha, artifactId: artifact.id,
        uploadedAt: new Date(uploaded).toISOString(), expiresAt: new Date(expires).toISOString(), sizeInBytes: artifact.size_in_bytes,
        digest: artifact.digest, ageHours: Math.max(0, (now - uploaded) / 3_600_000) };
      break;
    }
    if (!report.latestUploadedBackup) { report.status = 'missing'; report.reason = 'no_retained_successful_upload_in_observed_runs'; }
    else if (report.latestUploadedBackup.ageHours > freshHours) { report.status = 'stale'; report.reason = 'latest_uploaded_backup_too_old'; }
    else if (report.latestAttempt?.runId !== report.latestUploadedBackup.runId && report.latestAttempt?.status === 'completed') { report.status = 'degraded'; report.reason = 'latest_attempt_has_no_eligible_upload_previous_retained'; }
    else if (definition.state !== 'active' || report.latestAttempt?.jobConclusion === 'skipped' || report.latestAttempt?.jobStatus === 'missing') { report.status = 'degraded'; report.reason = 'workflow_inactive_or_backup_job_not_executed'; }
    else { report.status = 'fresh'; report.reason = 'recent_retained_upload_metadata'; }
  } catch (error) {
    report.status = 'unknown'; report.reason = error instanceof ObservationError ? error.code : 'observation_failed';
  }
  return report;
}

export function observationOutputs(report) {
  return `status=${report.status}\nbudget_allowed=${report.storageBudget.budgetAllowed}\nlatest_uploaded_run_id=${report.latestUploadedBackup?.runId ?? ''}\nretained_backups=${report.storageBudget.retainedBackups ?? ''}\n`;
}

async function main() {
  let options;
  try {
    const { values } = parseArgs({ options: { repository: { type: 'string' }, workflow: { type: 'string' }, 'exclude-run': { type: 'string' }, 'fresh-hours': { type: 'string' }, 'job-name': { type: 'string' } }, strict: true });
    options = { repository: values.repository, workflow: values.workflow ?? WORKFLOW, token: process.env.GH_TOKEN,
      excludeRun: values['exclude-run'] === undefined ? null : Number(values['exclude-run']), freshHours: values['fresh-hours'] === undefined ? 36 : Number(values['fresh-hours']), jobName: values['job-name'] ?? 'backup' };
  } catch { options = {}; }
  const report = await observeBackupWorkflow(options);
  console.log(JSON.stringify(report));
  try {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, observationOutputs(report));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Backup metadata observation: **${report.status}** (${report.reason}).\n\nRepository storage budget permits another upload: **${report.storageBudget.budgetAllowed}**. Scope excludes other repositories and Packages.\n\nLatest uploaded backup run: ${report.latestUploadedBackup?.runId ?? 'none observed'}. No archive was downloaded, decrypted or restored.\n`);
  } catch { console.error('BACKUP_OBSERVATION_OUTPUT_FAILED'); process.exitCode = 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
