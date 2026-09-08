/** Validate downloaded encrypted artifacts and report the last authenticated success separately from newer failures. */
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupArchiveName, backupCounts, backupFailureCodes, backupManifestFormat, backupSizeLimit, backupStages, type BackupManifest } from './backup-runner';
import { decryptBackup, type exportDatabase } from './db-backup';

type Snapshot = Awaited<ReturnType<typeof exportDatabase>>;
type Attempt = { candidate: number; runId: string; status: 'verified' | 'failed'; startedAt: string; finishedAt: string; snapshotCreatedAt?: string; verifiedAt?: string; errorCode?: string };
type InvalidAttempt = { candidate: number; status: 'invalid'; errorCode: 'BACKUP_ARTIFACT_INVALID' };
const keysEqual = (value: unknown, expected: string[]): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0'));
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function iso(value: unknown, now: number) {
  if (typeof value !== 'string') throw new Error('Invalid timestamp');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || parsed > now) throw new Error('Invalid or future timestamp');
  return parsed;
}
function validateManifest(value: unknown, now: number): BackupManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid manifest');
  const manifest = value as Record<string, any>;
  const base = ['format', 'runId', 'startedAt', 'finishedAt', 'maxBytes', 'status'];
  if (manifest.format !== backupManifestFormat || typeof manifest.runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(manifest.runId)) throw new Error('Invalid manifest identity');
  const started = iso(manifest.startedAt, now), finished = iso(manifest.finishedAt, now);
  if (finished < started) throw new Error('Invalid manifest order');
  if (typeof manifest.maxBytes !== 'number') throw new Error('Invalid byte budget');
  backupSizeLimit(manifest.maxBytes);
  if (manifest.status === 'failed') {
    if (!keysEqual(manifest, [...base, 'stage', 'errorCode']) || !backupStages.includes(manifest.stage) || typeof manifest.errorCode !== 'string' || !backupFailureCodes.includes(manifest.errorCode)) throw new Error('Invalid failure manifest');
    return manifest as BackupManifest;
  }
  if (manifest.status !== 'verified' || !keysEqual(manifest, [...base, 'archive', 'verification'])) throw new Error('Invalid status');
  const archive = manifest.archive, verification = manifest.verification;
  if (!keysEqual(archive, ['fileName','bytes','sha256']) || archive.fileName !== backupArchiveName || !integer(archive.bytes) || archive.bytes < 49 || archive.bytes > manifest.maxBytes || typeof archive.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(archive.sha256)) throw new Error('Invalid archive record');
  if (!keysEqual(verification, ['method','snapshotCreatedAt','verifiedAt','sourceSnapshotBytes','counts','durationsMs']) || verification.method !== 'isolated-restore-all-data-v1') throw new Error('Invalid verification');
  const snapshot = iso(verification.snapshotCreatedAt,now), verified = iso(verification.verifiedAt,now);
  if (snapshot < started || verified < snapshot || finished < verified || !integer(verification.sourceSnapshotBytes) || verification.sourceSnapshotBytes > manifest.maxBytes) throw new Error('Invalid verification time or size');
  if (!keysEqual(verification.counts,['tables','rows','documents','documentBytes']) || Object.values(verification.counts).some(value=>!integer(value))) throw new Error('Invalid counts');
  if (!keysEqual(verification.durationsMs,['export','restore','cleanup']) || Object.values(verification.durationsMs).some(value=>!integer(value))) throw new Error('Invalid durations');
  return manifest as BackupManifest;
}

async function inspectArtifact(directory: string, password: string, now: number, candidate: number): Promise<Attempt | InvalidAttempt> {
  try {
    const path = resolve(directory);
    if ((await lstat(path)).isSymbolicLink() || !(await lstat(path)).isDirectory()) throw new Error('Linked artifact directory');
    const root = await realpath(path); const manifestPath = join(root, 'manifest.json');
    const manifestStat = await lstat(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 16384) throw new Error('Invalid manifest file');
    const manifest = validateManifest(JSON.parse(await readFile(manifestPath,'utf8')),now);
    const common = { candidate, runId: manifest.runId, startedAt: manifest.startedAt, finishedAt: manifest.finishedAt };
    if (manifest.status === 'failed') return { ...common, status: 'failed', errorCode: manifest.errorCode };
    if (password.length < 24) throw new Error('Password required');
    const archivePath = join(root,backupArchiveName); const archiveStat = await lstat(archivePath);
    if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size !== manifest.archive.bytes || archiveStat.size > manifest.maxBytes) throw new Error('Archive file invalid');
    const archive = await readFile(archivePath);
    if (createHash('sha256').update(archive).digest('hex') !== manifest.archive.sha256) throw new Error('Archive hash mismatch');
    const snapshot = decryptBackup(archive,password) as Snapshot & { backupRun?: unknown };
    const authenticated = { runId: manifest.runId, startedAt: manifest.startedAt, maxBytes: manifest.maxBytes, verification: manifest.verification };
    if (snapshot.format !== 'ot-center-backup-v1' || !Array.isArray(snapshot.schema) || !Array.isArray(snapshot.tables) || JSON.stringify(snapshot.backupRun) !== JSON.stringify(authenticated) || snapshot.createdAt !== manifest.verification.snapshotCreatedAt || JSON.stringify(backupCounts(snapshot)) !== JSON.stringify(manifest.verification.counts)) throw new Error('Authenticated manifest mismatch');
    return { ...common, status: 'verified', snapshotCreatedAt: manifest.verification.snapshotCreatedAt, verifiedAt: manifest.verification.verifiedAt };
  } catch { return { candidate, status: 'invalid', errorCode: 'BACKUP_ARTIFACT_INVALID' }; }
}

export async function checkBackups(options: { directories: string[]; password: string; maxAgeMs: number; now?: number }) {
  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime()) || !Number.isSafeInteger(options.maxAgeMs) || options.maxAgeMs < 1 || options.directories.length < 1 || options.directories.length > 100) throw new Error('BACKUP_CHECK_CONFIGURATION_INVALID');
  const attempts: (Attempt | InvalidAttempt)[] = [];
  for (const [index,directory] of options.directories.entries()) attempts.push(await inspectArtifact(directory,options.password,now,index));
  const valid = attempts.filter((attempt): attempt is Attempt=>attempt.status !== 'invalid').sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||b.finishedAt.localeCompare(a.finishedAt));
  const verified = valid.filter(attempt=>attempt.status==='verified').sort((a,b)=>b.snapshotCreatedAt!.localeCompare(a.snapshotCreatedAt!));
  const latestAttempt = valid[0] || null; const latestVerifiedSuccess = verified[0] || null;
  const ageMs = latestVerifiedSuccess ? now-Date.parse(latestVerifiedSuccess.snapshotCreatedAt!) : null;
  const fresh = ageMs !== null && ageMs <= options.maxAgeMs;
  const invalidArtifacts = attempts.filter(attempt=>attempt.status==='invalid').length;
  const healthy = fresh && latestAttempt?.status==='verified' && invalidArtifacts===0;
  return { checkedAt: new Date(now).toISOString(), status: healthy ? 'healthy' as const : 'attention_required' as const, fresh, maxAgeMs: options.maxAgeMs, ageMs, latestAttempt, latestVerifiedSuccess, invalidArtifacts, attempts };
}

export async function backupCheckMain(argv=process.argv.slice(2)) {
  const directories:string[]=[];let hours:number|undefined;
  for(let index=0;index<argv.length;index+=2) {
    const flag=argv[index],value=argv[index+1];if(!value)throw new Error('BACKUP_CHECK_ARGUMENTS_INVALID');
    if(flag==='--directory')directories.push(value);
    else if(flag==='--max-age-hours'&&/^\d+$/.test(value))hours=Number(value);
    else throw new Error('BACKUP_CHECK_ARGUMENTS_INVALID');
  }
  if(!hours||hours>8760)throw new Error('BACKUP_CHECK_ARGUMENTS_INVALID');
  return checkBackups({directories,password:process.env.OT_BACKUP_PASSWORD||'',maxAgeMs:hours*3600000});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  backupCheckMain().then(result=>{console.log(JSON.stringify(result));process.exitCode=result.status==='healthy'?0:1;})
    .catch(()=>{console.error(JSON.stringify({status:'attention_required',errorCode:'BACKUP_CHECK_INPUT_FAILED'}));process.exitCode=1;});
}
