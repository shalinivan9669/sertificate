import { createError, getHeader, getRequestURL, readBody, type H3Event } from 'h3';
import { createHash } from 'node:crypto';

export function fail(statusCode: number, code: string, message: string, fieldErrors?: Record<string, string>): never {
  throw createError({ statusCode, statusMessage: code, message, data: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } });
}

export function record(value: unknown, label = 'body'): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_INPUT', `${label}: expected an object`);
  return value as Record<string, any>;
}

export function strictKeys(value: Record<string, any>, allowed: string[]) {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra) fail(400, 'UNKNOWN_FIELD', `Unsupported field: ${extra}`);
}

export function textValue(value: unknown, label: string, max = 1000, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /\u0000/.test(value)) fail(400, 'INVALID_INPUT', `Invalid ${label}`);
  return value.trim();
}

export function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(400, 'INVALID_INPUT', `Invalid ${label}`);
  return value as number;
}

export function entityId(value: unknown, label = 'id') {
  const result = textValue(value, label, 150);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result)) fail(400, 'INVALID_INPUT', `Invalid ${label}`);
  return result;
}

export function isoDate(value: unknown, label: string) {
  const date = textValue(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date))) fail(400, 'INVALID_INPUT', `Invalid ${label}`);
  return new Date(date).toISOString();
}

export function requestKey(event: H3Event) {
  return textValue(getHeader(event, 'idempotency-key'), 'Idempotency-Key', 128);
}

/** This check complements SameSite cookies; requests are tied to the configured application origin. */
export function assertSameOrigin(event: H3Event) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return;
  const origin = getHeader(event, 'origin');
  const base = process.env.BETTER_AUTH_URL || (process.env.NODE_ENV !== 'production' ? getRequestURL(event).origin : '');
  if (!base || !origin || origin !== new URL(base).origin) fail(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed');
  if (getHeader(event, 'sec-fetch-site') === 'cross-site') fail(403, 'ORIGIN_NOT_ALLOWED', 'Cross-site requests are not allowed');
}

export async function jsonBody(event: H3Event, allowed?: string[], maxBytes = 512_000) {
  const contentType = getHeader(event, 'content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) fail(415, 'JSON_REQUIRED', 'Content-Type application/json is required');
  if (Number(getHeader(event, 'content-length') || 0) > maxBytes) fail(413, 'BODY_TOO_LARGE', 'Request body is too large');
  const body = record(await readBody(event));
  if (JSON.stringify(body).length > maxBytes) fail(413, 'BODY_TOO_LARGE', 'Request body is too large');
  if (allowed) strictKeys(body, allowed);
  return body;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, canonical(val)]));
  return value;
}
export function payloadHash(value: unknown) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
