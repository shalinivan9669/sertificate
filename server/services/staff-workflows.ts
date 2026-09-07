import { z } from 'zod';
import { audit, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, nowIso, parse, sha256 } from '../utils/business';
import { assertRole, type AppUser } from '../utils/auth';
import { credentialIssuancePreview, issueCredential, revokeCredential } from './credentials';

const reasonSchema = z.string().trim().min(10).max(2000);
const paging = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
const codeOf = (error: any) => /^[A-Z0-9_]{1,80}$/.test(error?.data?.code || error?.statusMessage || '') ? error?.data?.code || error.statusMessage : 'REQUEST_FAILED';
const isDomainFailure = (error: any) => Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500;
export async function listSupportNotes(actor: AppUser, userId: string, input: unknown = {}) {
  assertRole(actor, []); const { page } = parse(paging, input);
  if (!await queryOne('SELECT id FROM "user" WHERE id=?', [userId])) fail(404, 'USER_NOT_FOUND');
  return withTransaction(async tx => {
    const total = Number((await queryOne('SELECT COUNT(*) total FROM support_notes WHERE user_id=?', [userId], tx))!.total);
    const notes = await queryAll('SELECT n.id,n.body,n.supersedes_id AS supersedesId,n.created_at AS createdAt,u.name AS authorName FROM support_notes n JOIN "user" u ON u.id=n.author_id WHERE n.user_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 25 OFFSET ?', [userId, (page - 1) * 25], tx);
    return { notes, pagination: { page, total, pageSize: 25, hasMore: page * 25 < total } };
  }, undefined, 'read');
}
export async function appendSupportNote(actor: AppUser, userId: string, input: unknown) {
  assertRole(actor, []);
  const body = parse(z.object({ text: reasonSchema, supersedesId: z.string().max(100).nullable().default(null) }).strict(), input);
  return withTransaction(async tx => {
    if (!await queryOne('SELECT id FROM "user" WHERE id=?', [userId], tx)) fail(404, 'USER_NOT_FOUND');
    if (body.supersedesId && !await queryOne('SELECT id FROM support_notes WHERE id=? AND user_id=?', [body.supersedesId, userId], tx)) fail(404, 'NOTE_NOT_FOUND');
    const noteId = id();
    await execute('INSERT INTO support_notes(id,user_id,author_id,body,supersedes_id,created_at) VALUES(?,?,?,?,?,?)', [noteId, userId, actor.id, body.text, body.supersedesId, nowIso()], tx);
    // Note content stays in the protected note store; audit records only its identity and operation.
    await audit(actor.id, body.supersedesId ? 'support_note_corrected' : 'support_note_added', noteId, body.supersedesId || '', null, tx);
    return { id: noteId };
  });
}
async function inspect(action: 'issue' | 'revoke', targetId: string, tx: Db) {
  if (action === 'issue') return credentialIssuancePreview(targetId, tx);
  const row = await queryOne('SELECT c.id,c.serial,c.status,c.snapshot_json,u.name FROM credentials c JOIN enrollments e ON e.id=c.enrollment_id JOIN "user" u ON u.id=e.user_id WHERE c.id=?', [targetId], tx);
  if (!row) fail(404, 'CREDENTIAL_NOT_FOUND');
  if (!['issued', 'pending'].includes(row.status)) fail(409, 'CREDENTIAL_NOT_REVOCABLE');
  return { credentialId: row.id, serial: row.serial, status: row.status, learnerName: row.name, programTitle: JSON.parse(row.snapshot_json).programTitle };
}
function batchScope(actor: AppUser, row: any) {
  assertRole(actor, ['issuer']);
  if (!row || actor.role !== 'admin' && row.created_by !== actor.id) fail(404, 'BATCH_NOT_FOUND');
}
export async function getCredentialBatch(actor: AppUser, batchId: string, db?: Db) {
  assertRole(actor, ['issuer']);
  const batch = await queryOne('SELECT * FROM credential_batches WHERE id=?', [batchId], db); batchScope(actor, batch);
  const rows = await queryAll('SELECT target_id,preview_json,status,result_json,error_code FROM credential_batch_items WHERE batch_id=? ORDER BY target_id', [batchId], db);
  return { id: batch!.id, action: batch!.action, reason: batch!.reason, status: batch!.status, expiresAt: batch!.expires_at, createdAt: batch!.created_at,
    items: rows.map(row => ({ targetId: row.target_id, preview: JSON.parse(row.preview_json), status: row.status, result: row.result_json ? JSON.parse(row.result_json) : null, errorCode: row.error_code })) };
}
export async function listCredentialBatches(actor: AppUser, input: unknown = {}) {
  assertRole(actor, ['issuer']); const { page } = parse(paging, input);
  const where = actor.role === 'admin' ? '1=1' : 'created_by=?'; const args = actor.role === 'admin' ? [] : [actor.id];
  const rows = await queryAll(`SELECT id,action,status,created_at AS createdAt FROM credential_batches WHERE ${where} ORDER BY created_at DESC,id LIMIT 25 OFFSET ?`, [...args, (page - 1) * 25]);
  const total = Number((await queryOne(`SELECT COUNT(*) total FROM credential_batches WHERE ${where}`, args))!.total);
  return { batches: rows, pagination: { page, total, pageSize: 25, hasMore: page * 25 < total } };
}
export async function previewCredentialBatch(actor: AppUser, input: unknown) {
  assertRole(actor, ['issuer']);
  const body = parse(z.object({ action: z.enum(['issue', 'revoke']), targetIds: z.array(z.string().min(1).max(100)).min(1).max(10), reason: reasonSchema }).strict(), input);
  if (new Set(body.targetIds).size !== body.targetIds.length) fail(400, 'DUPLICATE_BATCH_TARGET');
  return withTransaction(async tx => {
    const batchId = id(); const now = nowIso();
    await execute('INSERT INTO credential_batches(id,created_by,action,reason,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', [batchId, actor.id, body.action, body.reason, new Date(Date.now() + 15 * 60000).toISOString(), now, now], tx);
    for (const targetId of body.targetIds) {
      let preview: any; let failure: string | null = null;
      try { preview = await inspect(body.action, targetId, tx); }
      catch (error) { if (!isDomainFailure(error)) throw error; failure = codeOf(error); preview = { targetId, eligible: false, code: failure }; }
      await execute('INSERT INTO credential_batch_items(batch_id,target_id,preview_json,fingerprint,status,error_code) VALUES(?,?,?,?,?,?)', [batchId, targetId, JSON.stringify(preview), sha256(JSON.stringify(preview)), failure ? 'failed' : 'pending', failure], tx);
    }
    await audit(actor.id, 'credential_batch_previewed', batchId, body.action, null, tx);
    return getCredentialBatch(actor, batchId, tx);
  });
}
/** Each item commits atomically with its domain action. Resume never repeats an already committed item. */
export async function commitCredentialBatch(actor: AppUser, batchId: string, input: unknown) {
  assertRole(actor, ['issuer']); parse(z.object({ confirmed: z.literal(true) }).strict(), input);
  const lease = id(); const started = Date.now();
  const claimed = await withTransaction(async tx => {
    const batch = await queryOne('SELECT * FROM credential_batches WHERE id=?', [batchId], tx); batchScope(actor, batch);
    if (['completed', 'partial'].includes(batch!.status)) return false;
    if (batch!.status === 'preview' && batch!.expires_at < nowIso()) fail(409, 'BATCH_PREVIEW_EXPIRED');
    if (batch!.lease_until && batch!.lease_until > nowIso()) fail(409, 'BATCH_IN_PROGRESS');
    await execute("UPDATE credential_batches SET status='processing',lease_token=?,lease_until=?,updated_at=? WHERE id=?", [lease, new Date(Date.now() + 120000).toISOString(), nowIso(), batchId], tx);
    await audit(actor.id, 'credential_batch_confirmed', batchId, batch!.reason, null, tx); return true;
  });
  if (!claimed) return getCredentialBatch(actor, batchId);
  try {
    const items = await queryAll("SELECT target_id FROM credential_batch_items WHERE batch_id=? AND status='pending' ORDER BY target_id", [batchId]);
    for (const item of items) {
      if (Date.now() - started > 25000) break;
      try {
        await withTransaction(async tx => {
          const batch = await queryOne('SELECT * FROM credential_batches WHERE id=? AND lease_token=?', [batchId, lease], tx);
          if (!batch || batch.lease_until < nowIso()) fail(409, 'BATCH_LEASE_LOST');
          const stored = await queryOne("SELECT * FROM credential_batch_items WHERE batch_id=? AND target_id=? AND status='pending'", [batchId, item.target_id], tx);
          if (!stored) return;
          const current = await inspect(batch.action, item.target_id, tx);
          if (sha256(JSON.stringify(current)) !== stored.fingerprint) fail(409, 'BATCH_PREVIEW_CHANGED');
          const result = batch.action === 'issue' ? await issueCredential(actor.id, item.target_id, batch.reason, null, tx) : await revokeCredential(actor.id, item.target_id, batch.reason, tx);
          await execute("UPDATE credential_batch_items SET status='completed',result_json=?,error_code=NULL WHERE batch_id=? AND target_id=?", [JSON.stringify(result), batchId, item.target_id], tx);
        });
      } catch (error: any) {
        if (!isDomainFailure(error) || codeOf(error) === 'BATCH_LEASE_LOST') throw error;
        await execute("UPDATE credential_batch_items SET status='failed',error_code=? WHERE batch_id=? AND target_id=? AND status='pending'", [codeOf(error), batchId, item.target_id]);
        await audit(actor.id, 'credential_batch_item_rejected', batchId, `${item.target_id}:${codeOf(error)}`);
      }
    }
  } finally {
    await withTransaction(async tx => {
      const counts = (await queryOne("SELECT SUM(status='pending') pending,SUM(status='failed') failed FROM credential_batch_items WHERE batch_id=?", [batchId], tx))!;
      const status = counts.pending ? 'processing' : counts.failed ? 'partial' : 'completed';
      await execute('UPDATE credential_batches SET status=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?', [status, nowIso(), batchId, lease], tx);
    });
  }
  return getCredentialBatch(actor, batchId);
}
