import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { getCurrentAdapter, getCurrentAuthEndpointContext, queueAfterTransactionHook } from '@better-auth/core/context';
import { twoFactor } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/libsql/web';
import { randomBytes, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { databaseConfigured, execute, getDb, audit } from '../db';
import * as schema from '../db/auth-schema';
import { currentObservation } from '../utils/observability';

let instance: ReturnType<typeof betterAuth> | undefined;
const developmentSecret = randomBytes(48).toString('base64url');
const mailContext = new AsyncLocalStorage<Set<string>>();

/** Locale affects message text only; the provider still validates callback destinations. */
export function authEmailLocale(url: string, baseURL: string): 'ru' | 'kk' {
  try {
    const origin = new URL(baseURL).origin; let candidate = new URL(url, baseURL);
    for (let depth = 0; depth < 3; depth++) {
      if (candidate.origin !== origin) return 'ru';
      if (/^\/kk(?:\/|$)/.test(candidate.pathname)) return 'kk';
      const callback = candidate.searchParams.get('callbackURL') || candidate.searchParams.get('redirectTo');
      if (!callback) break; candidate = new URL(callback, baseURL);
    }
  } catch { /* Malformed or untrusted destinations never change the default language. */ }
  return 'ru';
}

export async function withAuthMailContext<T>(callback: () => Promise<T>) {
  const userIds = new Set<string>();
  const result = await mailContext.run(userIds, callback);
  return { result, userIds: [...userIds] };
}

async function queueAuthEmail(userId: string, payload: unknown) {
  const ctx = getCurrentAuthEndpointContext();
  try {
    // Better Auth holds a transaction during sign-up. Its context adapter ensures that
    // identity, credential account, and email outbox insertion commit together.
    const adapter = await getCurrentAdapter(ctx.context.adapter);
    const now = new Date().toISOString();
    const observation = currentObservation();
    await adapter.create({ model: 'outbox', forceAllowId: true, data: { id: randomUUID(), type: 'auth.email', aggregate_id: userId, payload_json: JSON.stringify(payload), status: 'pending', attempts: 0, available_at: now, created_at: now, updated_at: now,
      request_id: observation?.requestId || null, correlation_id: observation?.correlationId || null, origin_request_id: observation?.originRequestId || null, source_job_id: observation?.sourceJobId || null } });
    mailContext.getStore()?.add(userId);
  } catch (error) {
    (ctx.context as any).emailQueueFailed = true;
    throw error;
  }
}

export function authConfiguration() {
  const secretConfigured = Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32);
  const production = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  return {
    available: databaseConfigured() && (!production || (secretConfigured && Boolean(process.env.BETTER_AUTH_URL))),
    emailDeliveryConfigured: Boolean(process.env.SMTP_URL && process.env.MAIL_FROM && process.env.OT_EMAIL_DELIVERY_ENABLED === '1'),
  };
}

export async function getAuth() {
  if (instance) return instance;
  if (!authConfiguration().available) throw Object.assign(new Error('Authentication is not configured'), { statusCode: 503, code: 'AUTH_NOT_CONFIGURED' });
  const db = await getDb();
  const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  instance = betterAuth<BetterAuthOptions>({
    appName: 'OT Center', baseURL, basePath: '/api/auth', secret: process.env.BETTER_AUTH_SECRET || developmentSecret,
    trustedOrigins: [new URL(baseURL).origin],
    database: drizzleAdapter(drizzle(db, { schema }), { provider: 'sqlite', schema, transaction: true }),
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true, autoSignIn: false,
      async sendResetPassword({ user, url }) {
        const locale = authEmailLocale(url, baseURL);
        await queueAuthEmail(user.id, { to: user.email, subject: locale === 'kk' ? 'OT Center: қолжетімділікті қалпына келтіру' : 'OT Center: восстановление доступа', text: locale === 'kk' ? `Жаңа құпиясөз орнату үшін сілтемені ашыңыз: ${url}` : `Для установки нового пароля откройте ссылку: ${url}`, purpose: 'password_reset', locale });
      },
      async onPasswordReset({ user }) { await queueAfterTransactionHook(() => audit(user.id, 'auth.password_reset', user.id).then(() => {})); },
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
      async sendVerificationEmail({ user, url }) {
        const locale = authEmailLocale(url, baseURL);
        await queueAuthEmail(user.id, { to: user.email, subject: locale === 'kk' ? 'OT Center: электрондық поштаны растау' : 'OT Center: подтверждение почты', text: locale === 'kk' ? `Электрондық пошта мекенжайын растаңыз: ${url}` : `Подтвердите адрес электронной почты: ${url}`, purpose: 'email_verification', locale });
      },
    },
    user: { additionalFields: { role: { type: 'string', required: false, defaultValue: 'learner', input: false } } },
    session: {
      expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 60 * 15,
      cookieCache: { enabled: false },
      additionalFields: { mfaVerifiedAt: { type: 'number', required: false, input: false, returned: false } },
    },
    plugins: [twoFactor({ issuer: 'OT Center', skipVerificationOnEnable: false, accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 } }), {
      id: 'ot-transactional-outbox', schema: { outbox: { fields: {
        type: { type: 'string', required: true }, aggregate_id: { type: 'string', required: true }, payload_json: { type: 'string', required: true, returned: false },
        status: { type: 'string', required: true, defaultValue: 'pending' }, attempts: { type: 'number', required: true, defaultValue: 0 },
        available_at: { type: 'string', required: true }, last_error: { type: 'string', required: false }, created_at: { type: 'string', required: true }, updated_at: { type: 'string', required: true },
        request_id: { type: 'string', required: false, input: false, returned: false }, correlation_id: { type: 'string', required: false, input: false, returned: false },
        origin_request_id: { type: 'string', required: false, input: false, returned: false }, source_job_id: { type: 'string', required: false, input: false, returned: false },
      } } },
    }],
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30, customRules: {
      '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 }, '/two-factor/*': { window: 60, max: 5 },
    } },
    advanced: {
      disableOriginCheck: false, disableCSRFCheck: false,
      useSecureCookies: new URL(baseURL).protocol === 'https:',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: new URL(baseURL).protocol === 'https:' },
      // Vercel overwrites this header. Local untrusted X-Forwarded-For must not control rate-limit keys.
      ipAddress: { ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : [] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = ctx.body as Record<string, unknown> | undefined;
        if (ctx.path === '/sign-up/email' && body?.role) throw new APIError('BAD_REQUEST', { code: 'ROLE_NOT_ASSIGNABLE', message: 'Role cannot be selected at registration' });
        if (body?.trustDevice) throw new APIError('BAD_REQUEST', { code: 'TRUSTED_DEVICE_DISABLED', message: 'Use a fresh second factor for this session' });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if ((ctx.context as any).emailQueueFailed) throw new APIError('SERVICE_UNAVAILABLE', { code: 'EMAIL_QUEUE_UNAVAILABLE', message: 'Verification delivery could not be queued. Retry sending the verification email.' });
        if (!['/two-factor/verify-totp', '/two-factor/verify-backup-code'].includes(ctx.path)) return;
        const returned = ctx.context.returned as any;
        if (!returned || returned instanceof APIError || !returned.user?.id || typeof returned.token !== 'string') return;
        // Mark only the session whose successful TOTP/backup-code verification Better Auth returned.
        // Enrollment rotates a session; prefer newSession over the old token returned by the plugin.
        const token = ctx.context.newSession?.session.token || returned.token;
        await execute('UPDATE session SET mfaVerifiedAt=? WHERE token=? AND userId=?', [Date.now(), token, returned.user.id]);
        await audit(returned.user.id, 'auth.second_factor_verified', returned.user.id);
      }),
    },
    logger: { disabled: true },
  });
  return instance!;
}

export function resetAuthInstance() { instance = undefined; }
