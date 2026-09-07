import { randomBytes } from 'node:crypto';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, nowIso, parse, sha256 } from '../utils/business';
import { assertRole, type AppUser } from '../utils/auth';

const fieldKeys = ['learnerName', 'programTitle', 'serial', 'issuedAt', 'verificationUrl', 'issuerName'] as const;
const fieldMap = z.object(Object.fromEntries(fieldKeys.map(key => [key, z.string().min(1).max(120)])) as Record<typeof fieldKeys[number], z.ZodString>);
const templateSchema = z.object({ programId: z.string().min(1).max(100), name: z.string().min(2).max(120), issuerName: z.string().min(2).max(250), pdfBase64: z.string().max(1400000), fontBase64: z.string().max(2800000).optional(), fieldMap, qr: z.object({ page: z.number().int().nonnegative(), x: z.number().nonnegative(), y: z.number().nonnegative(), size: z.number().min(40).max(180) }).optional() }).strict();

function rejectActivePdf(document: PDFDocument) {
  const forbidden = new Set(['/A', '/AA', '/OpenAction', '/JS', '/JavaScript', '/Launch', '/EmbeddedFiles', '/RichMedia', '/XFA', '/SubmitForm', '/ImportData']);
  const pending: unknown[] = document.context.enumerateIndirectObjects().map(([, value]) => value);
  const visited = new Set();
  while (pending.length) {
    const value = pending.pop(); if (!value || visited.has(value)) continue; visited.add(value);
    if (visited.size > 100000) fail(413, 'PDF_TOO_COMPLEX');
    if (value instanceof PDFDict) for (const [key, child] of value.entries()) { if (forbidden.has(key.asString())) fail(400, 'ACTIVE_PDF_NOT_ALLOWED'); pending.push(child); }
    else if (value instanceof PDFArray) pending.push(...value.asArray());
    else if (value instanceof PDFRawStream) pending.push(value.dict);
  }
}

export async function createCredentialTemplate(actorId: string, data: unknown) {
  const body = parse(templateSchema, data);
  const pdfBytes = Buffer.from(body.pdfBase64, 'base64');
  if (!pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) fail(400, 'PDF_REQUIRED');
  let document: PDFDocument;
  try { document = await PDFDocument.load(pdfBytes, { ignoreEncryption: false }); } catch { fail(400, 'INVALID_PDF'); }
  if (document!.getPageCount() > 4 || document!.catalog.has(PDFName.of('OpenAction')) || document!.catalog.has(PDFName.of('AA'))) fail(400, 'UNSAFE_TEMPLATE');
  rejectActivePdf(document!);
  // Uploaded documents are never executed/served as HTML. Reject active PDF actions and embedded content.
  const decoded = pdfBytes.toString('latin1');
  if (/\/(JavaScript|JS|Launch|EmbeddedFiles|RichMedia|XFA)\b/.test(decoded)) fail(400, 'ACTIVE_PDF_NOT_ALLOWED');
  try { for (const name of Object.values(body.fieldMap)) document!.getForm().getTextField(name); } catch { fail(400, 'TEMPLATE_FIELDS_MISSING'); }
  if (body.qr && body.qr.page >= document!.getPageCount()) fail(400, 'INVALID_QR_PAGE');
  if (!(await queryOne('SELECT id FROM programs WHERE id=?', [body.programId]))) fail(404, 'PROGRAM_NOT_FOUND');
  const templateId = id();
  const meta = { issuerName: body.issuerName, fieldMap: body.fieldMap, qr: body.qr };
  await execute('INSERT INTO credential_templates(id,program_id,name,data_json,pdf_base64,font_base64,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', [templateId, body.programId, body.name, JSON.stringify(meta), body.pdfBase64, body.fontBase64 || null, actorId, nowIso()]);
  await audit(actorId, 'credential_template_created', templateId);
  return { template: { id: templateId, name: body.name, status: 'draft' } };
}
export async function approveCredentialTemplate(actorId: string, templateId: string, reason: string) {
  if (reason.trim().length < 10) fail(400, 'REASON_REQUIRED');
  return withTransaction(async tx => {
    const template = await queryOne('SELECT * FROM credential_templates WHERE id=?', [templateId], tx);
    if (!template) fail(404, 'TEMPLATE_NOT_FOUND');
    if (template.created_by === actorId) fail(403, 'INDEPENDENT_REVIEW_REQUIRED');
    if (template.status === 'approved') return { approved: true };
    await execute('UPDATE credential_templates SET status=?,approved_by=?,approved_at=? WHERE id=?', ['approved', actorId, nowIso(), templateId], tx);
    await audit(actorId, 'credential_template_approved', templateId, reason, null, tx);
    return { approved: true };
  });
}

async function eligibleEnrollment(enrollmentId: string, tx: Db) {
  const enrollment = await queryOne(`SELECT e.*,u.name,u.emailVerified,v.program_id,v.data_json,v.status AS version_status
    FROM enrollments e JOIN "user" u ON u.id=e.user_id JOIN program_versions v ON v.id=e.version_id WHERE e.id=?`, [enrollmentId], tx);
  if (!enrollment) fail(404, 'ENROLLMENT_NOT_FOUND');
  if (!enrollment.emailVerified || enrollment.version_status !== 'published' || ['pending_access', 'cancelled', 'suspended', 'expired'].includes(enrollment.status)) fail(409, 'CREDENTIAL_NOT_ELIGIBLE');
  const program = JSON.parse(enrollment.data_json);
  const progress = await queryAll('SELECT lesson_id,completed,completed_by FROM lesson_progress WHERE enrollment_id=?', [enrollmentId], tx);
  const required = program.modules.flatMap((module: any) => module.lessons).filter((lesson: any) => lesson.required);
  if (required.some((lesson: any) => !progress.some(p => p.lesson_id === lesson.id && p.completed && (lesson.kind !== 'practice' || p.completed_by !== enrollment.user_id)))) fail(409, 'REQUIRED_LEARNING_INCOMPLETE');
  const attempts = await queryAll('SELECT id,result_json FROM attempts WHERE enrollment_id=? AND status IN (?,?) ORDER BY submitted_at DESC', [enrollmentId, 'graded', 'expired'], tx);
  const passed = attempts.find(attempt => JSON.parse(attempt.result_json || '{}').pass === true);
  if (!passed) fail(409, 'ASSESSMENT_NOT_PASSED');
  if (program.accessModel === 'paid' && !(await queryOne('SELECT id FROM orders WHERE enrollment_id=? AND status=?', [enrollmentId, 'succeeded'], tx))) fail(409, 'CONTRACTUAL_CONDITIONS_INCOMPLETE');
  return { enrollment, program, passed };
}
export async function issueCredential(actorId: string, enrollmentId: string, reason: string, supersedesId: string | null = null) {
  if (reason.trim().length < 10 || reason.length > 2000) fail(400, 'ISSUANCE_EVIDENCE_REQUIRED');
  return withTransaction(async tx => {
    const old = await queryOne('SELECT id,serial,status FROM credentials WHERE enrollment_id=? AND status IN (?,?)', [enrollmentId, 'pending', 'issued'], tx);
    if (old) return { credential: old, duplicate: true };
    const { enrollment, program, passed } = await eligibleEnrollment(enrollmentId, tx);
    const template = await queryOne('SELECT id,data_json FROM credential_templates WHERE program_id=? AND status=? ORDER BY approved_at DESC LIMIT 1', [enrollment.program_id, 'approved'], tx);
    if (!template) fail(409, 'APPROVED_DOCUMENT_TEMPLATE_REQUIRED');
    if (supersedesId) {
      const previous = await queryOne('SELECT id FROM credentials WHERE id=? AND enrollment_id=? AND status=?', [supersedesId, enrollmentId, 'revoked'], tx);
      if (!previous) fail(409, 'REPLACEMENT_REQUIRES_REVOKED_ORIGINAL');
    }
    const credentialId = id();
    const token = randomBytes(32).toString('base64url');
    const serial = `OT-${new Date().getUTCFullYear()}-${randomBytes(8).toString('hex').toUpperCase()}`;
    const timestamp = nowIso();
    const baseUrl = process.env.NUXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const snapshot = { learnerName: enrollment.name, programTitle: program.title, serial, issuedAt: timestamp, issuerName: JSON.parse(template.data_json).issuerName, templateId: template.id, versionId: enrollment.version_id, verificationUrl: `${baseUrl.replace(/\/$/, '')}/verify/${token}`, evidence: reason };
    await execute('INSERT INTO credentials(id,enrollment_id,attempt_id,serial,snapshot_json,verification_hash,supersedes_id,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [credentialId, enrollmentId, passed.id, serial, JSON.stringify(snapshot), sha256(token), supersedesId, actorId, timestamp], tx);
    await enqueue('credential.render', credentialId, { credentialId }, tx);
    await audit(actorId, 'credential_reserved', credentialId, reason, enrollment.organization_id, tx);
    return { credential: { id: credentialId, serial, status: 'pending' }, duplicate: false };
  });
}

export async function renderCredential(credentialId: string) {
  const credential = await queryOne('SELECT * FROM credentials WHERE id=?', [credentialId]);
  if (!credential || credential.status !== 'pending') return;
  const snapshot = JSON.parse(credential.snapshot_json);
  const template = await queryOne('SELECT * FROM credential_templates WHERE id=? AND status=?', [snapshot.templateId, 'approved']);
  if (!template) fail(409, 'APPROVED_DOCUMENT_TEMPLATE_REQUIRED');
  const meta = JSON.parse(template.data_json);
  const document = await PDFDocument.load(Buffer.from(template.pdf_base64, 'base64'), { updateMetadata: false });
  document.setCreationDate(new Date(credential.created_at)); document.setModificationDate(new Date(credential.created_at));
  document.setTitle(`${snapshot.programTitle} — ${snapshot.serial}`); document.setAuthor(snapshot.issuerName);
  const form = document.getForm();
  for (const key of fieldKeys) form.getTextField(meta.fieldMap[key]).setText(key === 'issuedAt' ? snapshot[key].slice(0, 10) : snapshot[key]);
  if (template.font_base64) {
    document.registerFontkit(fontkit);
    const font = await document.embedFont(Buffer.from(template.font_base64, 'base64'), { subset: true });
    form.updateFieldAppearances(font);
  } else {
    try { form.updateFieldAppearances(); } catch { fail(409, 'UNICODE_TEMPLATE_FONT_REQUIRED'); }
  }
  form.flatten();
  if (meta.qr) {
    const qr = await document.embedPng(await QRCode.toBuffer(snapshot.verificationUrl, { errorCorrectionLevel: 'M', margin: 1 }));
    const page = document.getPage(meta.qr.page);
    if (meta.qr.x + meta.qr.size > page.getWidth() || meta.qr.y + meta.qr.size > page.getHeight()) fail(409, 'QR_OUTSIDE_PAGE');
    page.drawImage(qr, { x: meta.qr.x, y: meta.qr.y, width: meta.qr.size, height: meta.qr.size });
  }
  const bytes = Buffer.from(await document.save());
  if (bytes.length > 1500000) fail(413, 'DOCUMENT_EXCEEDS_STORAGE_BUDGET');
  await withTransaction(async tx => {
    const current = await queryOne('SELECT status,snapshot_json FROM credentials WHERE id=?', [credentialId], tx);
    if (current?.status !== 'pending') return;
    // Rendering happens outside the write transaction. A repair may have replaced the
    // template while an old direct invocation was rendering without an outbox lease.
    if (current.snapshot_json !== credential.snapshot_json) fail(409, 'CREDENTIAL_RENDER_SNAPSHOT_CHANGED');
    await execute('UPDATE credentials SET status=?,document_base64=?,document_sha256=?,issued_at=? WHERE id=?', ['issued', bytes.toString('base64'), sha256(bytes.toString('base64')), nowIso(), credentialId], tx);
    if (credential.supersedes_id) await execute('UPDATE credentials SET status=? WHERE id=? AND status=?', ['superseded', credential.supersedes_id, 'revoked'], tx);
    await audit(credential.issued_by, 'credential_issued', credentialId, '', null, tx);
    await enqueue('notification.credential', credentialId, { credentialId }, tx);
  });
}

/** Recover a failed pending render; issued documents and academic evidence stay immutable. */
export async function repairPendingCredential(actor: AppUser, credentialId: string, data: unknown) {
  assertRole(actor, ['issuer']);
  const body = parse(z.object({ templateId: z.string().min(1).max(100), reason: z.string().trim().min(10).max(2000) }).strict(), data);
  return withTransaction(async tx => {
    const credential = await queryOne('SELECT * FROM credentials WHERE id=?', [credentialId], tx);
    if (!credential) fail(404, 'CREDENTIAL_NOT_FOUND');
    if (credential.status !== 'pending' || credential.document_base64 || credential.issued_at) fail(409, 'ONLY_PENDING_CREDENTIAL_REPAIRABLE');
    const timestamp = nowIso();
    if (await queryOne('SELECT id FROM outbox WHERE type=? AND aggregate_id=? AND lease_until>? LIMIT 1', ['credential.render', credentialId, timestamp], tx)) fail(409, 'CREDENTIAL_RENDER_IN_PROGRESS');
    const snapshot = JSON.parse(credential.snapshot_json);
    const job = await queryOne('SELECT * FROM outbox WHERE type=? AND aggregate_id=? ORDER BY created_at DESC LIMIT 1', ['credential.render', credentialId], tx);
    if (snapshot.templateId === body.templateId && Number(snapshot.renderRevision) > 0 && job?.status === 'pending' && !job.last_error) {
      return { id: credentialId, serial: credential.serial, status: 'pending', templateId: body.templateId, previousTemplateId: snapshot.previousTemplateId, queued: true, duplicate: true };
    }
    if (!job || !job.last_error || Number(job.attempts) < 1 || !['pending', 'failed', 'processing'].includes(job.status)) fail(409, 'FAILED_RENDER_REQUIRED');
    const { enrollment } = await eligibleEnrollment(credential.enrollment_id, tx);
    const template = await queryOne('SELECT id,program_id,data_json,status FROM credential_templates WHERE id=?', [body.templateId], tx);
    if (!template || template.status !== 'approved') fail(409, 'APPROVED_DOCUMENT_TEMPLATE_REQUIRED');
    if (template.program_id !== enrollment.program_id) fail(409, 'TEMPLATE_PROGRAM_MISMATCH');
    if (JSON.parse(template.data_json).issuerName !== snapshot.issuerName) fail(409, 'TEMPLATE_ISSUER_MISMATCH');
    if (template.id === snapshot.templateId) fail(409, 'DIFFERENT_TEMPLATE_REQUIRED');
    const repaired = { ...snapshot, templateId: template.id, previousTemplateId: snapshot.templateId, renderRevision: Number(snapshot.renderRevision || 0) + 1 };
    await execute('UPDATE credentials SET snapshot_json=? WHERE id=? AND status=?', [JSON.stringify(repaired), credentialId, 'pending'], tx);
    // Preserve the same durable job and its cumulative attempt count; a corrected
    // template gets an immediate attempt even after the automatic retry limit.
    await execute('UPDATE outbox SET status=?,available_at=?,lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?', ['pending', timestamp, timestamp, job.id], tx);
    await audit(actor.id, 'credential_template_rebound', credentialId, JSON.stringify({ reason: body.reason, previousTemplateId: snapshot.templateId, templateId: template.id, previousError: job.last_error, renderAttempts: Number(job.attempts) }), enrollment.organization_id, tx);
    return { id: credentialId, serial: credential.serial, status: 'pending', templateId: template.id, previousTemplateId: snapshot.templateId, queued: true, duplicate: false };
  });
}

export async function getCredential(credentialId: string, userId: string) {
  const credential = await queryOne('SELECT c.* FROM credentials c JOIN enrollments e ON e.id=c.enrollment_id WHERE c.id=? AND e.user_id=?', [credentialId, userId]);
  if (!credential) fail(404, 'CREDENTIAL_NOT_FOUND');
  const snapshot = JSON.parse(credential.snapshot_json);
  return { id: credential.id, serial: credential.serial, status: credential.status, learnerName: snapshot.learnerName, programTitle: snapshot.programTitle, issuedAt: credential.issued_at, revokedAt: credential.revoked_at, revocationReason: credential.revoked_reason, verificationUrl: snapshot.verificationUrl, downloadAvailable: credential.status === 'issued' && Boolean(credential.document_base64) };
}
export async function downloadCredential(credentialId: string, userId: string) {
  const dto = await getCredential(credentialId, userId);
  if (!dto.downloadAvailable) fail(409, 'DOCUMENT_NOT_AVAILABLE');
  const document = await queryOne('SELECT document_base64 FROM credentials WHERE id=? AND status=?', [credentialId, 'issued']);
  if (!document) fail(409, 'DOCUMENT_NOT_AVAILABLE');
  return { bytes: Buffer.from(document.document_base64, 'base64'), serial: dto.serial };
}
export async function verifyCredential(token: string) {
  if (!/^[\w-]{43}$/.test(token)) fail(404, 'CREDENTIAL_NOT_FOUND');
  const credential = await queryOne('SELECT serial,status,issued_at,revoked_at,snapshot_json FROM credentials WHERE verification_hash=?', [sha256(token)]);
  if (!credential || credential.status === 'pending') fail(404, 'CREDENTIAL_NOT_FOUND');
  const snapshot = JSON.parse(credential.snapshot_json);
  return { serial: credential.serial, status: credential.status, programTitle: snapshot.programTitle, issuedAt: credential.issued_at, revokedAt: credential.revoked_at, registry: 'OT Center' };
}
export async function revokeCredential(actorId: string, credentialId: string, reason: string) {
  if (reason.trim().length < 10 || reason.length > 2000) fail(400, 'REASON_REQUIRED');
  return withTransaction(async tx => {
    const credential = await queryOne('SELECT status FROM credentials WHERE id=?', [credentialId], tx);
    if (!credential) fail(404, 'CREDENTIAL_NOT_FOUND');
    if (credential.status === 'revoked') return { revoked: true };
    if (credential.status === 'superseded') fail(409, 'ALREADY_SUPERSEDED');
    await execute('UPDATE credentials SET status=?,revoked_at=?,revoked_reason=? WHERE id=?', ['revoked', nowIso(), reason, credentialId], tx);
    await audit(actorId, 'credential_revoked', credentialId, reason, null, tx);
    return { revoked: true };
  });
}
