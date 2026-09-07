import { getRequestHeaders, setHeader, type H3Event } from 'h3';
import { getAuth } from '../services/auth';
import { queryOne } from '../db';
import { assertSameOrigin, fail } from './validation';

export type Role = 'learner' | 'editor' | 'reviewer' | 'instructor' | 'issuer' | 'finance' | 'admin';
export type AppUser = { id: string; name: string; email: string; role: Role; twoFactorEnabled: boolean; mfaVerifiedAt?: number | null };

export function assertRole(user: AppUser, roles: string[]) {
  if (user.role !== 'admin' && !roles.includes(user.role)) fail(403, 'FORBIDDEN', 'This action requires a permitted role');
  if (!user.twoFactorEnabled || !user.mfaVerifiedAt || Date.now() - user.mfaVerifiedAt > 12 * 60 * 60 * 1000) fail(403, 'MFA_REQUIRED', 'Verify your second factor to perform this action');
}

export async function requireUser(event: H3Event): Promise<AppUser> {
  setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  assertSameOrigin(event);
  const auth = await getAuth();
  const headers = new Headers(getRequestHeaders(event) as HeadersInit);
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session?.user || !session.user.emailVerified) fail(401, 'UNAUTHENTICATED', 'Sign in with a verified email address');
  // Read the role and assurance on every protected request: revocations take effect without re-login.
  const row = await queryOne('SELECT u.id,u.name,u.email,u.role,u.twoFactorEnabled,s.mfaVerifiedAt FROM "user" u JOIN session s ON s.userId=u.id WHERE u.id=? AND s.id=?', [session.user.id, session.session.id]);
  if (!row) fail(401, 'UNAUTHENTICATED', 'Session expired');
  return { id: row.id, name: row.name, email: row.email, role: row.role, twoFactorEnabled: Boolean(row.twoFactorEnabled), mfaVerifiedAt: row.mfaVerifiedAt ? Number(row.mfaVerifiedAt) : null };
}

export async function requireRole(event: H3Event, roles: string[]) { const user = await requireUser(event); assertRole(user, roles); return user; }
