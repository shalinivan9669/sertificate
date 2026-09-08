import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createClient } from '@libsql/client/web';
import { audit, assertDefaultForeignKeys, execute, queryOne, withTransaction } from '../server/db';
import { validateProgramData } from '../server/services/catalog';
import { parseProgramDraftFile, PROGRAM_DRAFT_MAX_BYTES } from '../shared/program-draft-import';

// Trusted operator CLI only: never imported by an HTTP route. The operator must
// first obtain the owner's explicit confirmation of the exact existing account.
class SetupError extends Error {}
function options(args: string[]) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!;
    if (['--apply', '--activate-owner'].includes(key)) {
      if (flags.has(key)) throw new SetupError('Duplicate option');
      flags.add(key);
    } else if (['--email', '--reason', '--draft'].includes(key)) {
      const value = args[++index];
      if (!value || value.startsWith('--') || values[key] !== undefined) throw new SetupError('Missing or duplicate option');
      values[key] = value;
    } else throw new SetupError('Unknown option');
  }
  const email = (values['--email'] || '').trim().toLowerCase();
  const reason = (values['--reason'] || '').trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SetupError('An exact registered owner email is required');
  if (reason.length < 20 || reason.length > 1500 || /[\u0000-\u001f]/.test(reason)) throw new SetupError('A meaningful single-line owner attestation reason is required (20–1500 characters)');
  if (flags.has('--apply') && !flags.has('--activate-owner')) throw new SetupError('Applying requires both --apply and --activate-owner');
  return { email, reason, apply: flags.has('--apply'), draftPath: values['--draft'] };
}

async function main() {
  const input = options(process.argv.slice(2));
  let draft: { programId: string; dataJson: string; sourceSha256: string; lessons: number; questions: number } | undefined;
  if (input.draftPath) {
    const file = await stat(input.draftPath);
    if (!file.isFile() || file.size > PROGRAM_DRAFT_MAX_BYTES) throw new SetupError('The private draft must be a file of at most 500 KB');
    const bytes = await readFile(input.draftPath);
    const parsed = parseProgramDraftFile(bytes.toString('utf8'));
    const data = validateProgramData({ ...parsed.data, reviewedAt: '' });
    draft = { programId: parsed.programId, dataJson: JSON.stringify(data), sourceSha256: createHash('sha256').update(bytes).digest('hex'), lessons: parsed.lessonCount, questions: parsed.questionCount };
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !/^(?:libsql|https):\/\//.test(url) || !authToken) throw new SetupError('Explicit Turso connection settings are required; no local fallback');
  // getDb() intentionally is not used: its local path runs migrations. This CLI
  // opens only the configured remote database and never migrates or seeds it.
  const db = createClient({ url, authToken, intMode: 'number' });
  try {
    await assertDefaultForeignKeys(db);
    const result = await withTransaction(async (tx) => {
      const admins = Number((await queryOne('SELECT COUNT(*) n FROM "user" WHERE role=?', ['admin'], tx))!.n);
      if (admins) throw new SetupError('An administrator already exists; use the authenticated administrator workflow');
      const owner = await queryOne('SELECT id,emailVerified,twoFactorEnabled FROM "user" WHERE email=?', [input.email], tx);
      if (!owner) throw new SetupError('The exact owner account must already be registered');
      const credentials = Number((await queryOne('SELECT COUNT(*) n FROM account WHERE userId=? AND providerId=? AND password IS NOT NULL AND LENGTH(password)>0', [owner.id, 'credential'], tx))!.n);
      if (credentials !== 1) throw new SetupError('Exactly one existing password credential is required');
      if (draft) {
        const program = await queryOne('SELECT status FROM programs WHERE id=?', [draft.programId], tx);
        if (program?.status !== 'active') throw new SetupError('The selected program must already be active');
        const versions = Number((await queryOne('SELECT COUNT(*) n FROM program_versions WHERE program_id=?', [draft.programId], tx))!.n);
        if (versions) throw new SetupError('The program already has versions; import later through its editor');
      }
      const sessions = Number((await queryOne('SELECT COUNT(*) n FROM session WHERE userId=?', [owner.id], tx))!.n);
      const summary = {
        mode: input.apply ? 'applied' : 'preview', userId: owner.id,
        activationBasis: 'trusted_operator_owner_attestation', emailDeliveryPerformed: false,
        emailWasAlreadyVerified: Boolean(owner.emailVerified), existingSecondFactorPreserved: Boolean(owner.twoFactorEnabled),
        sessionsToRevoke: sessions, sessionsRevoked: 0, administratorAssigned: false,
        draft: draft ? { programId: draft.programId, sourceSha256: draft.sourceSha256, lessons: draft.lessons, questions: draft.questions, status: 'draft', created: false, versionId: null as string | null } : null,
        nextStep: 'Owner signs in with their existing password and completes real TOTP before using staff endpoints.',
      };
      if (!input.apply) return summary;

      // This is manual activation attested by the trusted operator, not proof of
      // mailbox delivery. Record that distinction in the durable audit trail.
      await execute('UPDATE "user" SET emailVerified=1,role=?,updatedAt=? WHERE id=?', ['admin', Date.now(), owner.id], tx);
      await execute('DELETE FROM session WHERE userId=?', [owner.id], tx);
      await audit(null, 'auth.owner_manually_activated', owner.id, `Trusted operator owner attestation; no email delivery or mailbox challenge. ${input.reason}`, null, tx);
      await audit(null, 'auth.owner_bootstrap', owner.id, `First administrator; previous sessions revoked: ${sessions}. ${input.reason}`, null, tx);
      summary.sessionsRevoked = sessions;
      summary.administratorAssigned = true;
      if (draft && summary.draft) {
        const versionId = randomUUID();
        const timestamp = new Date().toISOString();
        await execute("INSERT INTO program_versions (id,program_id,version,status,data_json,created_by,approved_by,published_at,created_at,updated_at) VALUES (?,?,1,'draft',?,?,NULL,NULL,?,?)", [versionId, draft.programId, draft.dataJson, owner.id, timestamp, timestamp], tx);
        await audit(owner.id, 'program.draft_created', versionId, `Trusted operator initial private import; source SHA256 ${draft.sourceSha256}; not reviewed or published.`, null, tx);
        summary.draft.created = true;
        summary.draft.versionId = versionId;
      }
      return summary;
    }, db, input.apply ? 'write' : 'read');
    console.log(JSON.stringify(result, null, 2));
  } finally { db.close(); }
}

try { await main(); }
catch (error) {
  // Never log raw database errors, credentials, account data, or question banks.
  console.error(error instanceof SetupError ? error.message : 'Owner setup failed; no raw database or private content details are printed.');
  process.exitCode = 1;
}
