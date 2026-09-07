import { audit, execute, queryAll, queryOne, withTransaction } from '../db';
import { assertRole, type AppUser, type Role } from '../utils/auth';
import { entityId, fail, textValue } from '../utils/validation';

const roles: Role[] = ['learner', 'editor', 'reviewer', 'instructor', 'issuer', 'finance', 'admin'];

export async function listUsers(actor: AppUser, query: string) {
  assertRole(actor, ['admin']);
  const search = textValue(query, 'query', 150, false).replace(/[\\%_]/g, '\\$&');
  return { users: await queryAll('SELECT id,name,email,emailVerified,role,twoFactorEnabled FROM "user" WHERE email LIKE ? ESCAPE \'\\\' OR name LIKE ? ESCAPE \'\\\' ORDER BY createdAt DESC LIMIT 100', [`%${search}%`, `%${search}%`]) };
}

export async function changeRole(actor: AppUser, userId: string, role: string, reason: string) {
  assertRole(actor, ['admin']); entityId(userId); textValue(reason, 'reason', 2000);
  if (reason.length < 10) fail(400, 'REASON_REQUIRED', 'Provide a meaningful reason for changing access');
  if (!roles.includes(role as Role)) fail(400, 'INVALID_ROLE', 'Unknown role');
  if (actor.id === userId) fail(403, 'SELF_ROLE_CHANGE_FORBIDDEN', 'An administrator cannot change their own role');
  return withTransaction(async (tx) => {
    const user = await queryOne('SELECT id,role,emailVerified FROM "user" WHERE id=?', [userId], tx);
    if (!user) fail(404, 'USER_NOT_FOUND', 'User not found');
    if (!user.emailVerified) fail(409, 'VERIFIED_USER_REQUIRED', 'The user must verify their email before receiving a role');
    if (user.role === role) return { userId, role };
    if (user.role === 'admin' && role !== 'admin' && Number((await queryOne('SELECT COUNT(*) n FROM "user" WHERE role=?', ['admin'], tx))!.n) < 2) fail(409, 'LAST_ADMIN_REQUIRED', 'The last administrator cannot be removed');
    await execute('UPDATE "user" SET role=?,updatedAt=? WHERE id=?', [role, Date.now(), userId], tx);
    await execute('UPDATE session SET mfaVerifiedAt=NULL WHERE userId=?', [userId], tx);
    await audit(actor.id, 'auth.role_changed', userId, `${user.role} -> ${role}: ${reason}`, null, tx);
    return { userId, role };
  });
}

/** Owner-only CLI operation, deliberately absent from all HTTP routes. */
export async function bootstrapAdministrator(email: string, reason: string) {
  textValue(email, 'email', 254); textValue(reason, 'reason', 2000);
  if (reason.length < 10) fail(400, 'REASON_REQUIRED', 'Provide a meaningful owner bootstrap reason');
  return withTransaction(async (tx) => {
    if (Number((await queryOne('SELECT COUNT(*) n FROM "user" WHERE role=?', ['admin'], tx))!.n)) fail(409, 'ADMIN_ALREADY_EXISTS', 'Use the authenticated administrator workflow to manage roles');
    const user = await queryOne('SELECT id,emailVerified FROM "user" WHERE email=?', [email.toLowerCase().trim()], tx);
    if (!user?.emailVerified) fail(409, 'VERIFIED_USER_REQUIRED', 'Register and verify the owner account first');
    await execute('UPDATE "user" SET role=?,updatedAt=? WHERE id=?', ['admin', Date.now(), user.id], tx);
    await execute('UPDATE session SET mfaVerifiedAt=NULL WHERE userId=?', [user.id], tx);
    await audit(null, 'auth.owner_bootstrap', user.id, reason, null, tx);
    return { userId: user.id, role: 'admin', nextStep: 'Sign in and verify your second factor before using administrator endpoints.' };
  });
}
