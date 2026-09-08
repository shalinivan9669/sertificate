/** Read-only local release guard. A successful data read is not permission to downgrade feature enforcement. */
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
type Row = Record<string, any>;
type ReadDatabase = { prepare(sql: string): { all(...args: unknown[]): Row[] }; transaction<T>(fn: () => T): { deferred(): T }; close(): void };
const Sqlite = require('better-sqlite3') as new (path: string, options: { readonly: true; fileMustExist: true }) => ReadDatabase;
export const legacyBuildId = '6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9';
// Reviewed application-owned server files + package metadata from the preserved local artifact.
// Dependency binary contents are outside this fingerprint; this is not an artifact-signing system.
const legacyServerFingerprint = 'bb111d849aceac33f5e46fe6773987624b0c533a8b0217927699772aa7aac979';
const repository = resolve(fileURLToPath(new URL('../', import.meta.url)));
const migrationFeatures: Record<string, string> = {
  '006-operational-incidents.sql': 'operational-incidents-v1',
  '007-learning-reminders.sql': 'learning-reminders-v1',
  '008-program-intake.sql': 'program-intake-enforcement-v1',
  '009-staff-workflows.sql': 'staff-support-and-credential-batches-v1',
};
const legacyMigrations = ['001-core.sql', '002-business.sql', '003-credential-templates.sql', '004-corporate-invoices.sql', '005-invoice-allocations.sql'];
const expectedMigrations = [...legacyMigrations, ...Object.keys(migrationFeatures)];
const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

async function ownedRuntimeFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Linked application runtime file is not a verified artifact');
    if (entry.isDirectory()) output.push(...await ownedRuntimeFiles(path));
    else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name === 'package.json')) output.push(path);
  }
  return output.sort();
}

export async function inspectLegacyArtifact(directory: string) {
  const root = await realpath(resolve(directory));
  const metadata = JSON.parse(await readFile(join(root, 'public/_nuxt/builds/latest.json'), 'utf8'));
  const server = join(root, 'server');
  const manifest = [];
  for (const path of await ownedRuntimeFiles(server)) manifest.push({ path: relative(server, path).replaceAll('\\', '/'), sha256: sha256(await readFile(path)) });
  const fingerprint = sha256(JSON.stringify(manifest));
  const recognized = metadata.id === legacyBuildId && fingerprint === legacyServerFingerprint;
  return { root, buildId: typeof metadata.id === 'string' ? metadata.id : null, serverFingerprint: fingerprint, ownedRuntimeFiles: manifest.length, recognized, supportedMigrations: recognized ? legacyMigrations : [], supportedFeatureCapabilities: [] as string[] };
}

export type RollbackAssessment = {
  checkedAt: string; targetBuildId: string | null; targetRecognized: boolean;
  applicationRollbackAllowed: boolean; isolatedReadDiagnosticAllowed: boolean;
  migrations: string[]; requiredFeatureCapabilities: string[];
  blockers: { code: string; count?: number; migration?: string }[];
  observations: { code: string; count: number }[];
  limitations: string[];
};

export async function assessLegacyRollback(artifactDirectory: string, databasePath: string, migrationDirectory = join(repository, 'server/db/migrations')): Promise<RollbackAssessment> {
  const target = await inspectLegacyArtifact(artifactDirectory);
  const path = await realpath(resolve(databasePath));
  if (!(await stat(path)).isFile()) throw new Error('An existing local database file is required');
  const expectedChecksums = new Map(await Promise.all(expectedMigrations.map(async name => [name, sha256(await readFile(join(migrationDirectory, name)))] as const)));
  const report: RollbackAssessment = {
    checkedAt: new Date().toISOString(), targetBuildId: target.buildId, targetRecognized: target.recognized,
    applicationRollbackAllowed: false, isolatedReadDiagnosticAllowed: false, migrations: [], requiredFeatureCapabilities: [], blockers: [], observations: [],
    limitations: [
      'Local SQLite file, consistent read transaction and readonly/fileMustExist connection; no migration or setting change is performed.',
      'Only the reviewed preserved LMS artifact is recognized. A caller cannot assert support through a flag or force override.',
      'A control-free isolated GET diagnostic is not a production read-only mode: the old application still contains write handlers.',
      'Application-owned server files and package metadata are fingerprinted; dependency binaries and release provenance require the separate trusted-artifact process.',
      'A read snapshot cannot authorize a later live deployment. Use an artifact enforcing all required feature capabilities or a forward fix; do not reopen intake or erase newer data to make this guard pass.',
    ],
  };
  if (!target.recognized) report.blockers.push({ code: 'UNRECOGNIZED_TARGET_ARTIFACT' });
  const db = new Sqlite(path, { readonly: true, fileMustExist: true });
  try {
    db.transaction(() => {
      const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => String(row.name)));
      if (!tables.has('schema_migrations')) { report.blockers.push({ code: 'MIGRATION_LEDGER_MISSING' }); return; }
      const applied = db.prepare('SELECT name,checksum FROM schema_migrations ORDER BY name').all();
      report.migrations = applied.map(row => String(row.name));
      for (const row of applied) {
        const name = String(row.name), expected = expectedChecksums.get(name);
        if (!expected) report.blockers.push({ code: 'UNKNOWN_DATABASE_MIGRATION', migration: name });
        else if (row.checksum !== expected) report.blockers.push({ code: 'MIGRATION_CHECKSUM_MISMATCH', migration: name });
        if (migrationFeatures[name]) report.requiredFeatureCapabilities.push(migrationFeatures[name]!);
      }
      for (const name of legacyMigrations) if (!report.migrations.includes(name)) report.blockers.push({ code: 'BASE_SCHEMA_INCOMPLETE', migration: name });
      const requiredTables: Record<string, string[]> = {
        '006-operational-incidents.sql': ['operational_incidents', 'operational_counters'],
        '007-learning-reminders.sql': ['learning_reminder_preferences', 'learning_reminders', 'learning_reminder_deliveries'],
        '008-program-intake.sql': ['program_intake_controls'],
        '009-staff-workflows.sql': ['support_notes', 'credential_batches', 'credential_batch_items'],
      };
      for (const [migration, names] of Object.entries(requiredTables)) {
        if (report.migrations.includes(migration) && names.some(name => !tables.has(name))) report.blockers.push({ code: 'MIGRATION_TABLE_MISMATCH', migration });
        if (!report.migrations.includes(migration) && names.some(name => tables.has(name))) report.blockers.push({ code: 'UNTRACKED_FEATURE_TABLE', migration });
      }
      const count = (sql: string) => Number(db.prepare(sql).all()[0]?.n || 0);
      const blocker = (code: string, sql: string) => { const n = count(sql); if (n) report.blockers.push({ code, count: n }); };
      if (tables.has('program_intake_controls')) blocker('CLOSED_INTAKE_UNSUPPORTED', 'SELECT COUNT(*) n FROM program_intake_controls WHERE is_open=0');
      if (tables.has('operational_incidents')) blocker('ACTIVE_INCIDENTS_UNSUPPORTED', "SELECT COUNT(*) n FROM operational_incidents WHERE status IN ('open','acknowledged')");
      if (tables.has('learning_reminder_deliveries')) blocker('SCHEDULED_REMINDERS_UNSUPPORTED', "SELECT COUNT(*) n FROM learning_reminder_deliveries WHERE status IN ('scheduled','queued')");
      if (tables.has('learning_reminders')) blocker('ACTIVE_REMINDERS_UNSUPPORTED', "SELECT COUNT(*) n FROM learning_reminders WHERE status='active'");
      if (tables.has('outbox')) blocker('UNSUPPORTED_OUTBOX_WORK', "SELECT COUNT(*) n FROM outbox WHERE type IN ('learning.reminder','operations.alert') AND status NOT IN ('delivered','cancelled')");
      if (tables.has('credential_batches')) blocker('UNFINISHED_CREDENTIAL_BATCHES', "SELECT COUNT(*) n FROM credential_batches WHERE status IN ('preview','processing','partial')");
      if (tables.has('credential_batch_items')) blocker('UNFINISHED_CREDENTIAL_BATCH_ITEMS', "SELECT COUNT(*) n FROM credential_batch_items WHERE status IN ('pending','failed')");
      if (tables.has('support_notes')) report.observations.push({ code: 'SUPPORT_NOTES_HISTORY_RETAINED_BUT_NOT_VISIBLE_IN_OLD_UI', count: count('SELECT COUNT(*) n FROM support_notes') });
      if (db.prepare('PRAGMA foreign_key_check').all().length) report.blockers.push({ code: 'FOREIGN_KEY_INTEGRITY_FAILED' });
      if (db.prepare('PRAGMA integrity_check').all().some(row => Object.values(row)[0] !== 'ok')) report.blockers.push({ code: 'DATABASE_INTEGRITY_FAILED' });
    }).deferred();
  } catch {
    // Neither SQL diagnostics nor row data should leak from a release preflight report.
    report.blockers.push({ code: 'COMPATIBILITY_QUERY_FAILED' });
  } finally { db.close(); }
  report.isolatedReadDiagnosticAllowed = target.recognized && report.blockers.length === 0;
  if (report.requiredFeatureCapabilities.length) report.blockers.push({ code: 'TARGET_LACKS_REQUIRED_FEATURE_CAPABILITIES', count: report.requiredFeatureCapabilities.length });
  // Deliberately no branch grants production rollback approval from this diagnostic helper.
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: rollback-preflight.ts <artifact-output-directory> <existing-local-database>');
    const result = await assessLegacyRollback(process.argv[2]!, process.argv[3]!);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.applicationRollbackAllowed ? 0 : 2;
  } catch {
    console.error(JSON.stringify({ applicationRollbackAllowed: false, isolatedReadDiagnosticAllowed: false, blockers: [{ code: 'PREFLIGHT_INPUT_OR_ARTIFACT_FAILED' }] }));
    process.exitCode = 1;
  }
}
