import { defineEventHandler, getHeader, getMethod, getRequestURL, setHeader, createError } from 'h3';
import { enforceBodyLimit } from '../utils/request-body';
import { eventObservation, markDomainError, runWithRequestObservation } from '../utils/observability';
export default defineEventHandler(event => runWithRequestObservation(event, async () => {
  const requestId = eventObservation(event).context.requestId; event.context.requestId = requestId;
  setHeader(event, 'X-Request-Id', requestId); setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); setHeader(event, 'X-Frame-Options', 'SAMEORIGIN');
  setHeader(event, 'Content-Security-Policy-Report-Only', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) return;
  setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  if (!['/api/health', '/api/ready', '/api/amo-lead'].includes(path) && !path.startsWith('/api/v1/') && !path.startsWith('/api/auth/')) {
    throw markDomainError(createError({ statusCode: 404, statusMessage: 'ENDPOINT_NOT_FOUND' }), 'ENDPOINT_NOT_FOUND');
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(getMethod(event))) return;
  const maximum = path.startsWith('/api/auth/') ? 20000 : path.includes('credential-templates') ? 4200000 : path.includes('/import/') ? 170000 : path.includes('program-versions') ? 512000 : 65536;
  if (Number(getHeader(event, 'content-length') || 0) > maximum) throw markDomainError(createError({ statusCode: 413, statusMessage: 'BODY_TOO_LARGE', data: { code: 'BODY_TOO_LARGE', requestId } }), 'BODY_TOO_LARGE');
  await enforceBodyLimit(event, maximum);
  if (path === '/api/v1/payments/webhook' || path.startsWith('/api/auth/')) return;
  const origin = getHeader(event, 'origin'); const expected = process.env.BETTER_AUTH_URL || getRequestURL(event).origin;
  if (origin && origin !== new URL(expected).origin || getHeader(event, 'sec-fetch-site') === 'cross-site') throw markDomainError(createError({ statusCode: 403, statusMessage: 'ORIGIN_NOT_ALLOWED', data: { code: 'ORIGIN_NOT_ALLOWED', requestId } }), 'ORIGIN_NOT_ALLOWED');
  if (!(getHeader(event, 'content-type') || '').startsWith('application/json')) throw markDomainError(createError({ statusCode: 415, statusMessage: 'JSON_REQUIRED', data: { code: 'JSON_REQUIRED', requestId } }), 'JSON_REQUIRED');
}));
