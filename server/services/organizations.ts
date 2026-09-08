import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, idempotent, nowIso, parse, safeCsv, sha256 } from '../utils/business';
import { assertProgramIntakeOpen } from './program-intake';

export async function requireMembership(userId: string, organizationId: string, roles = ['owner', 'manager'], db?: Db) {
  const member = await queryOne('SELECT m.*,o.name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.organization_id=? AND m.status=? AND o.status=?', [userId, organizationId, 'active', 'active'], db);
  if (!member || !roles.includes(member.role)) fail(404, 'ORGANIZATION_NOT_FOUND');
  return member;
}
const pageNumber = z.coerce.number().int().min(1).max(1000000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(50);
const overviewQuery = z.object({ page: pageNumber, pageSize, memberPage: pageNumber, invitationPage: pageNumber, programId: z.string().regex(/^[a-z0-9-]{1,100}$/).optional() }).strict();
const exportQuery = z.object({ programId: z.string().regex(/^[a-z0-9-]{1,100}$/).optional() }).strict();
export const MAX_ORGANIZATION_EXPORT_ROWS = 5000;
function pagination(requested: number, size: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / size)); const page = Math.min(requested, totalPages);
  return { page, pageSize: size, total, totalPages, hasPrevious: page > 1, hasMore: page < totalPages, from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) };
}
export async function listOrganizations(userId: string, query: unknown = {}) {
  const options = parse(z.object({ page: pageNumber, pageSize }).strict(), query);
  return withTransaction(async tx => {
    const condition = "m.user_id=? AND m.status='active' AND o.status='active'";
    const total = Number((await queryOne(`SELECT COUNT(*) n FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE ${condition}`, [userId], tx))!.n);
    const paging = pagination(options.page, options.pageSize, total);
    const rows = await queryAll(`SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE ${condition} ORDER BY o.name,o.id LIMIT ? OFFSET ?`, [userId, paging.pageSize, (paging.page - 1) * paging.pageSize], tx);
    return { organizations: rows, pagination: paging };
  }, undefined, 'read');
}
export async function createOrganization(actorId: string, data: unknown) {
  const body = parse(z.object({ name: z.string().trim().min(2).max(200), ownerEmail: z.email().max(254).optional() }).strict(), data);
  return withTransaction(async tx => {
    const owner = body.ownerEmail ? await queryOne('SELECT id FROM "user" WHERE email=? AND emailVerified=1', [body.ownerEmail.toLowerCase()], tx) : { id: actorId };
    if (!owner) fail(409, 'VERIFIED_OWNER_REQUIRED');
    const organizationId = id();
    await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [organizationId, body.name, nowIso()], tx);
    await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [organizationId, owner.id, 'owner', nowIso()], tx);
    await audit(actorId, 'organization_created', organizationId, '', organizationId, tx);
    return { organization: { id: organizationId, name: body.name } };
  });
}
/** Only bounded, organization-owned metadata is selected. No answers, PDF data or verification tokens. */
async function reportRows(organizationId: string, programId: string | undefined, limit: number, offset: number, snapshotAt: string, tx: Db) {
  const completed = "p.completed=1 AND (json_extract(l.value,'$.kind')!='practice' OR (p.completed_by IS NOT NULL AND p.completed_by!=s.user_id))";
  const required = "json_extract(l.value,'$.required')=1";
  const args: any[] = [organizationId]; if (programId) args.push(programId); args.push(limit, offset);
  const rows = await queryAll(`WITH selected AS (
    SELECT e.*,u.name,v.program_id,v.data_json AS program_data,COALESCE(m.status,'absent') AS membership_status
    FROM enrollments e JOIN "user" u ON u.id=e.user_id JOIN program_versions v ON v.id=e.version_id
    LEFT JOIN memberships m ON m.organization_id=e.organization_id AND m.user_id=e.user_id
    WHERE e.organization_id=?${programId ? ' AND v.program_id=?' : ''} ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?
  ), lesson_counts AS (
    SELECT s.id,COUNT(l.value) AS total_lessons,
      SUM(CASE WHEN ${completed} THEN 1 ELSE 0 END) AS completed_lessons,
      SUM(CASE WHEN ${required} THEN 1 ELSE 0 END) AS required_lessons,
      SUM(CASE WHEN ${required} AND ${completed} THEN 1 ELSE 0 END) AS required_completed,
      SUM(CASE WHEN ${required} AND json_extract(l.value,'$.kind')='practice' AND NOT COALESCE(${completed},0) THEN 1 ELSE 0 END) AS pending_practice
    FROM selected s LEFT JOIN json_each(s.program_data,'$.modules') m ON 1=1
    LEFT JOIN json_each(m.value,'$.lessons') l ON 1=1
    LEFT JOIN lesson_progress p ON p.enrollment_id=s.id AND p.lesson_id=json_extract(l.value,'$.id') GROUP BY s.id
  ), ranked_attempts AS (
    SELECT a.id,a.enrollment_id,a.status,a.deadline_at,json_extract(a.result_json,'$.pass') AS passed,json_extract(a.result_json,'$.score') AS score,
      ROW_NUMBER() OVER(PARTITION BY a.enrollment_id ORDER BY a.created_at DESC,a.rowid DESC) AS rank
    FROM attempts a JOIN selected s ON s.id=a.enrollment_id
  ), ranked_documents AS (
    SELECT c.id,c.enrollment_id,c.serial,c.status,c.issued_at,c.revoked_at,
      SUM(CASE WHEN c.status='issued' THEN 1 ELSE 0 END) OVER(PARTITION BY c.enrollment_id) AS issued_count,
      ROW_NUMBER() OVER(PARTITION BY c.enrollment_id ORDER BY CASE WHEN c.status IN ('pending','issued') THEN 0 ELSE 1 END,c.created_at DESC,c.rowid DESC) AS rank
    FROM credentials c JOIN selected s ON s.id=c.enrollment_id
  ) SELECT s.id,s.user_id AS userId,s.name,s.status,s.access_until AS accessUntil,s.version_id AS versionId,s.program_id AS programId,
    json_extract(s.program_data,'$.title') AS programTitle,json_extract(s.program_data,'$.language') AS language,s.membership_status,
    l.total_lessons,l.completed_lessons,l.required_lessons,l.required_completed,l.pending_practice,
    a.id AS attempt_id,a.status AS attempt_status,a.deadline_at,a.passed,a.score,
    c.id AS credential_id,c.serial,c.status AS credential_status,c.issued_at,c.revoked_at,COALESCE(c.issued_count,0) AS documents
    FROM selected s JOIN lesson_counts l ON l.id=s.id LEFT JOIN ranked_attempts a ON a.enrollment_id=s.id AND a.rank=1
    LEFT JOIN ranked_documents c ON c.enrollment_id=s.id AND c.rank=1 ORDER BY s.created_at DESC,s.id DESC`, args, tx);
  return rows.map(row => {
    const total = Number(row.total_lessons); const completedCount = Number(row.completed_lessons); const requiredTotal = Number(row.required_lessons); const requiredCompleted = Number(row.required_completed); const pendingPractice = Number(row.pending_practice);
    const assessmentStatus = !row.attempt_id ? 'not_started' : row.attempt_status === 'in_progress' ? (row.deadline_at <= snapshotAt ? 'awaiting_grading' : 'in_progress') : row.attempt_status === 'voided' ? 'voided' : row.passed === 1 ? 'passed' : row.passed === 0 ? 'failed' : 'awaiting_grading';
    const learningStatus = requiredTotal === requiredCompleted ? 'ready_for_assessment' : requiredTotal - requiredCompleted === pendingPractice && pendingPractice > 0 ? 'waiting_practice' : completedCount > 0 || row.attempt_id ? 'in_progress' : 'not_started';
    const accessStatus = ['cancelled','suspended','expired'].includes(row.status) ? row.status : row.membership_status !== 'active' ? 'organization_access_revoked' : row.accessUntil && row.accessUntil <= snapshotAt ? 'expired' : row.status === 'pending_access' ? 'pending_access' : 'active';
    const documentStatus = row.credential_status || 'none';
    const progressStatus = accessStatus !== 'active' ? accessStatus : documentStatus !== 'none' ? `document_${documentStatus}` : assessmentStatus === 'passed' ? 'completed' : assessmentStatus === 'failed' ? 'assessment_failed' : assessmentStatus === 'in_progress' ? 'assessment_in_progress' : assessmentStatus === 'awaiting_grading' ? 'awaiting_grading' : assessmentStatus === 'voided' ? 'assessment_voided' : learningStatus;
    return { id: row.id, userId: row.userId, name: row.name, status: row.status, accessUntil: row.accessUntil, versionId: row.versionId, programId: row.programId, programTitle: row.programTitle, language: row.language,
      accessStatus, progressStatus, completedLessons: completedCount, documents: Number(row.documents),
      learning: { status: learningStatus, total, completed: completedCount, requiredTotal, requiredCompleted, pendingPractice, percent: requiredTotal ? Math.round(requiredCompleted / requiredTotal * 100) : null },
      assessment: { status: assessmentStatus, attemptId: row.attempt_id || null, deadlineAt: row.deadline_at || null, score: row.score === null ? null : Number(row.score) },
      credential: { status: documentStatus, id: row.credential_id || null, serial: row.serial || null, issuedAt: row.issued_at || null, revokedAt: row.revoked_at || null } };
  });
}
export async function organizationOverview(userId: string, organizationId: string, query: unknown = {}) {
  const options = parse(overviewQuery, query);
  return withTransaction(async tx => {
    const member = await requireMembership(userId, organizationId, ['owner','manager'], tx); const snapshotAt = nowIso();
    const args = options.programId ? [organizationId, options.programId, organizationId, organizationId, organizationId] : [organizationId, organizationId, organizationId, organizationId];
    const counts = (await queryOne(`SELECT
      (SELECT COUNT(*) FROM enrollments e JOIN program_versions v ON v.id=e.version_id WHERE e.organization_id=?${options.programId ? ' AND v.program_id=?' : ''}) AS enrollments,
      (SELECT COUNT(*) FROM memberships WHERE organization_id=?) AS members,
      (SELECT COUNT(*) FROM memberships WHERE organization_id=? AND status='active') AS activeMembers,
      (SELECT COUNT(*) FROM invitations WHERE organization_id=?) AS invitations`, args, tx))!;
    const pages = { enrollments: pagination(options.page, options.pageSize, Number(counts.enrollments)), members: pagination(options.memberPage, options.pageSize, Number(counts.members)), invitations: pagination(options.invitationPage, options.pageSize, Number(counts.invitations)) };
    const members = await queryAll('SELECT u.id,u.name,u.email,m.role,m.status FROM memberships m JOIN "user" u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name,u.id LIMIT ? OFFSET ?', [organizationId, pages.members.pageSize, (pages.members.page - 1) * pages.members.pageSize], tx);
    const enrollments = await reportRows(organizationId, options.programId, pages.enrollments.pageSize, (pages.enrollments.page - 1) * pages.enrollments.pageSize, snapshotAt, tx);
    const invitations = await queryAll('SELECT id,email,role,status,expires_at AS expiresAt FROM invitations WHERE organization_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?', [organizationId, pages.invitations.pageSize, (pages.invitations.page - 1) * pages.invitations.pageSize], tx);
    return { organization: { id: organizationId, name: member.name, role: member.role }, members, enrollments, invitations, pagination: pages, totals: { enrollments: Number(counts.enrollments), members: Number(counts.members), activeMembers: Number(counts.activeMembers), invitations: Number(counts.invitations) }, snapshotAt, filters: { programId: options.programId || null }, export: { maximumRows: MAX_ORGANIZATION_EXPORT_ROWS, totalRows: Number(counts.enrollments), available: Number(counts.enrollments) <= MAX_ORGANIZATION_EXPORT_ROWS } };
  }, undefined, 'read');
}
async function insertInvitation(actorId: string, organizationId: string, email: string, role: string, tx: Db) {
  const existing = await queryOne('SELECT id,expires_at FROM invitations WHERE organization_id=? AND email=? AND status=?', [organizationId, email, 'pending'], tx);
  if (existing && existing.expires_at > nowIso()) return { id: existing.id, status: 'pending', duplicate: true };
  if (existing) await execute('UPDATE invitations SET status=? WHERE id=?', ['expired', existing.id], tx);
  const invitationId = id();
  const token = randomBytes(32).toString('base64url');
  await execute('INSERT INTO invitations(id,organization_id,email,role,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', [invitationId, organizationId, email, role, sha256(token), new Date(Date.now() + 7 * 86400000).toISOString(), actorId, nowIso()], tx);
  // Invitation is available to the authorized creator; email remains a separately gated operation.
  await audit(actorId, 'invitation_created', invitationId, '', organizationId, tx);
  return { id: invitationId, status: 'pending', token, duplicate: false };
}
export async function invite(userId: string, organizationId: string, data: unknown) {
  const body = parse(z.object({ email: z.email().max(254), role: z.enum(['manager', 'member']).default('member') }).strict(), data);
  return withTransaction(async tx => {
    const caller = await requireMembership(userId, organizationId, ['owner', 'manager'], tx);
    if (body.role === 'manager' && caller.role !== 'owner') fail(403, 'OWNER_REQUIRED');
    return insertInvitation(userId, organizationId, body.email.toLowerCase(), body.role, tx);
  });
}
export async function acceptInvitation(user: { id: string; email: string }, token: string) {
  if (!/^[\w-]{43}$/.test(token)) fail(404, 'INVITATION_NOT_FOUND');
  return withTransaction(async tx => {
    const invitation = await queryOne('SELECT * FROM invitations WHERE token_hash=? AND status=? AND expires_at>?', [sha256(token), 'pending', nowIso()], tx);
    if (!invitation || invitation.email.toLowerCase() !== user.email.toLowerCase()) fail(404, 'INVITATION_NOT_FOUND');
    const account = await queryOne('SELECT emailVerified FROM "user" WHERE id=?', [user.id], tx);
    if (!account?.emailVerified) fail(403, 'VERIFIED_CONTACT_REQUIRED');
    const existing = await queryOne('SELECT role,status FROM memberships WHERE organization_id=? AND user_id=?', [invitation.organization_id, user.id], tx);
    if (!existing) await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [invitation.organization_id, user.id, invitation.role, nowIso()], tx);
    else if (existing.status !== 'active') {
      if (existing.role === 'owner') fail(409, 'OWNER_TRANSFER_REQUIRED');
      await execute('UPDATE memberships SET status=?,role=? WHERE organization_id=? AND user_id=?', ['active', invitation.role, invitation.organization_id, user.id], tx);
    }
    await execute('UPDATE invitations SET status=? WHERE id=?', ['accepted', invitation.id], tx);
    await audit(user.id, 'invitation_accepted', invitation.id, '', invitation.organization_id, tx);
    return { organizationId: invitation.organization_id, accepted: true };
  });
}
export async function revokeMembership(actorId: string, organizationId: string, targetUserId: string, reason: string) {
  if (reason.trim().length < 10) fail(400, 'REASON_REQUIRED');
  return withTransaction(async tx => {
    await requireMembership(actorId, organizationId, ['owner'], tx);
    if (actorId === targetUserId) fail(409, 'SELF_REMOVAL_NOT_ALLOWED');
    const member = await queryOne('SELECT role FROM memberships WHERE user_id=? AND organization_id=?', [targetUserId, organizationId], tx);
    if (!member || member.role === 'owner') fail(409, 'OWNER_TRANSFER_REQUIRED');
    await execute('UPDATE memberships SET status=? WHERE organization_id=? AND user_id=?', ['revoked', organizationId, targetUserId], tx);
    await audit(actorId, 'membership_revoked', targetUserId, reason, organizationId, tx);
    return { revoked: true };
  });
}

export function parseImportCsv(csv: string) {
  if (csv.length > 150000) fail(413, 'IMPORT_TOO_LARGE');
  const records: string[][] = []; let record: string[] = []; let cell = ''; let quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === ',' || ch === '\n' || ch === undefined)) {
      record.push(cell.replace(/\r$/, '').trim()); cell = '';
      if (ch !== ',') { if (record.some(Boolean)) records.push(record); record = []; }
    } else if (ch !== undefined) cell += ch;
  }
  if (quoted) fail(400, 'CSV_UNCLOSED_QUOTE');
  if (!records.length || records[0]?.[0]?.toLowerCase() !== 'email') fail(400, 'CSV_HEADER_EMAIL_REQUIRED');
  if (records.length > 501) fail(413, 'IMPORT_MAX_500_ROWS');
  const seen = new Set<string>();
  return records.slice(1).map((row, index) => {
    const email = row[0]?.toLowerCase() || ''; const name = row[1] || ''; const role = row[2] || 'member';
    const errors: string[] = [];
    if (!z.email().safeParse(email).success || email.length > 254) errors.push('INVALID_EMAIL');
    if (seen.has(email)) errors.push('DUPLICATE_EMAIL');
    if (row.some(cell => /^[\s]*[=+@-]/.test(cell))) errors.push('FORMULA_NOT_ALLOWED');
    if (name.length > 120 || row.length > 3) errors.push('INVALID_COLUMNS');
    if (!['member', 'manager'].includes(role)) errors.push('INVALID_ROLE');
    seen.add(email);
    return { row: index + 2, email, name, role, errors };
  });
}
export async function previewImport(userId: string, organizationId: string, csv: string) {
  const member = await requireMembership(userId, organizationId);
  const rows = parseImportCsv(csv);
  if (member.role !== 'owner') for (const row of rows) if (row.role === 'manager') row.errors.push('OWNER_REQUIRED');
  const previewId = id();
  await execute('INSERT INTO import_previews(id,organization_id,created_by,data_json,expires_at,created_at) VALUES(?,?,?,?,?,?)', [previewId, organizationId, userId, JSON.stringify(rows), new Date(Date.now() + 3600000).toISOString(), nowIso()]);
  return { previewId, rows, valid: rows.length > 0 && rows.every(row => !row.errors.length), expiresInSeconds: 3600 };
}
export async function commitImport(userId: string, organizationId: string, previewId: string) {
  return withTransaction(async tx => {
    const member = await requireMembership(userId, organizationId, ['owner', 'manager'], tx);
    const preview = await queryOne('SELECT * FROM import_previews WHERE id=? AND organization_id=? AND created_by=?', [previewId, organizationId, userId], tx);
    if (!preview) fail(404, 'PREVIEW_NOT_FOUND');
    if (preview.status === 'committed') return { committed: true, duplicate: true, invitations: [] };
    if (preview.expires_at < nowIso()) fail(409, 'PREVIEW_EXPIRED');
    const rows = JSON.parse(preview.data_json);
    if (!rows.length || rows.some((row: any) => row.errors.length || row.role === 'manager' && member.role !== 'owner')) fail(409, 'PREVIEW_HAS_ERRORS');
    const invitations = [];
    for (const row of rows) invitations.push(await insertInvitation(userId, organizationId, row.email, row.role, tx));
    await execute('UPDATE import_previews SET status=? WHERE id=?', ['committed', previewId], tx);
    await audit(userId, 'import_committed', previewId, `${rows.length} invitations; no external messages sent`, organizationId, tx);
    return { committed: true, duplicate: false, invitations };
  });
}
export async function assignEmployees(userId: string, organizationId: string, data: unknown, key: string) {
  const body = parse(z.object({ versionId: z.string().max(100), userIds: z.array(z.string().min(1).max(100)).min(1).max(100), accessUntil: z.string().datetime().nullable().optional() }).strict(), data);
  const userIds = [...new Set(body.userIds)].sort();
  return idempotent(`assignment:${organizationId}:${userId}`, key, { ...body, userIds }, async tx => {
    await requireMembership(userId, organizationId, ['owner', 'manager'], tx);
    const version = await queryOne('SELECT * FROM program_versions WHERE id=? AND status=?', [body.versionId, 'published'], tx);
    if (!version) fail(404, 'PUBLISHED_VERSION_NOT_FOUND');
    await assertProgramIntakeOpen(version.id, tx);
    if (body.accessUntil && body.accessUntil <= nowIso()) fail(400, 'FUTURE_DEADLINE_REQUIRED');
    const ids: string[] = [];
    for (const target of userIds) {
      await requireMembership(target, organizationId, ['owner', 'manager', 'member'], tx);
      const old = await queryOne('SELECT id FROM enrollments WHERE user_id=? AND version_id=? AND organization_id=? AND status NOT IN (?,?)', [target, body.versionId, organizationId, 'cancelled', 'expired'], tx);
      if (old) { ids.push(old.id); continue; }
      const enrollmentId = id();
      await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,access_until,created_at,reason) VALUES(?,?,?,?,?,?,?,?)', [enrollmentId, target, body.versionId, organizationId, 'pending_access', body.accessUntil || null, nowIso(), `Organization assignment by ${userId}; staff confirms contractual access`], tx);
      await enqueue('notification.enrollment', enrollmentId, { userId: target, enrollmentId }, tx);
      ids.push(enrollmentId);
    }
    const resourceId = id();
    await audit(userId, 'employees_assigned', resourceId, JSON.stringify(ids), organizationId, tx);
    return { resourceId, value: { enrollmentIds: ids, status: 'pending_access' } };
  }, async (resourceId, tx) => {
    await requireMembership(userId, organizationId, ['owner', 'manager'], tx);
    const event = await queryOne('SELECT reason FROM audit_events WHERE target=? AND action=?', [resourceId, 'employees_assigned'], tx);
    return { enrollmentIds: JSON.parse(event!.reason), status: 'pending_access' };
  });
}
export async function organizationReport(userId: string, organizationId: string, query: unknown = {}) {
  const options = parse(exportQuery, query);
  return withTransaction(async tx => {
    await requireMembership(userId, organizationId, ['owner','manager'], tx);
    const args = options.programId ? [organizationId, options.programId] : [organizationId];
    const total = Number((await queryOne(`SELECT COUNT(*) n FROM enrollments e JOIN program_versions v ON v.id=e.version_id WHERE e.organization_id=?${options.programId ? ' AND v.program_id=?' : ''}`, args, tx))!.n);
    if (total > MAX_ORGANIZATION_EXPORT_ROWS) fail(413, 'REPORT_TOO_LARGE', `Report exceeds ${MAX_ORGANIZATION_EXPORT_ROWS} rows; select one program before exporting`);
    const rows = await reportRows(organizationId, options.programId, MAX_ORGANIZATION_EXPORT_ROWS, 0, nowIso(), tx);
    if (rows.length !== total) fail(409, 'REPORT_INCOMPLETE');
    const headers = ['name','program','program_title','language','version_id','enrollment_status','access_status','progress_status','access_until','completed_lessons','total_lessons','required_completed','required_total','required_percent','pending_practice','assessment_status','assessment_score','document_status','document_serial','document_issued_at','document_revoked_at','documents'];
    return [headers.map(safeCsv).join(','), ...rows.map(row => [row.name,row.programId,row.programTitle,row.language,row.versionId,row.status,row.accessStatus,row.progressStatus,row.accessUntil,row.completedLessons,row.learning.total,row.learning.requiredCompleted,row.learning.requiredTotal,row.learning.percent,row.learning.pendingPractice,row.assessment.status,row.assessment.score,row.credential.status,row.credential.serial,row.credential.issuedAt,row.credential.revokedAt,row.documents].map(safeCsv).join(','))].join('\r\n');
  }, undefined, 'read');
}
