import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, idempotent, nowIso, parse, safeCsv, sha256 } from '../utils/business';

export async function requireMembership(userId: string, organizationId: string, roles = ['owner', 'manager'], db?: Db) {
  const member = await queryOne('SELECT m.*,o.name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.organization_id=? AND m.status=? AND o.status=?', [userId, organizationId, 'active', 'active'], db);
  if (!member || !roles.includes(member.role)) fail(404, 'ORGANIZATION_NOT_FOUND');
  return member;
}
export async function listOrganizations(userId: string) {
  const rows = await queryAll('SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=? AND m.status=? AND o.status=? ORDER BY o.name LIMIT 100', [userId, 'active', 'active']);
  return { organizations: rows };
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
export async function organizationOverview(userId: string, organizationId: string) {
  const member = await requireMembership(userId, organizationId);
  const [members, enrollments, invitations] = await Promise.all([
    queryAll('SELECT u.id,u.name,u.email,m.role,m.status FROM memberships m JOIN "user" u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name LIMIT 500', [organizationId]),
    queryAll(`SELECT e.id,e.user_id AS userId,u.name,e.status,e.access_until AS accessUntil,v.program_id AS programId,
      (SELECT COUNT(*) FROM lesson_progress p WHERE p.enrollment_id=e.id AND p.completed=1) AS completedLessons,
      (SELECT COUNT(*) FROM credentials c WHERE c.enrollment_id=e.id AND c.status='issued') AS documents
      FROM enrollments e JOIN "user" u ON u.id=e.user_id JOIN program_versions v ON v.id=e.version_id WHERE e.organization_id=? ORDER BY e.created_at DESC LIMIT 500`, [organizationId]),
    queryAll('SELECT id,email,role,status,expires_at AS expiresAt FROM invitations WHERE organization_id=? ORDER BY created_at DESC LIMIT 100', [organizationId]),
  ]);
  return { organization: { id: organizationId, name: member.name, role: member.role }, members, enrollments, invitations };
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
export async function organizationReport(userId: string, organizationId: string) {
  const overview = await organizationOverview(userId, organizationId);
  return ['"name","program","status","access_until","completed_lessons","documents"', ...overview.enrollments.map(row => [row.name, row.programId, row.status, row.accessUntil, row.completedLessons, row.documents].map(safeCsv).join(','))].join('\r\n');
}
