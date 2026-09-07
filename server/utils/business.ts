import { createHash, randomUUID } from 'node:crypto';
import { createError } from 'h3';
import { z } from 'zod';
import { execute, queryOne, withTransaction, type Db } from '../db';

export const nowIso = () => new Date().toISOString();
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const id = () => randomUUID();
export function businessFail(statusCode: number, code: string, message = code): never { throw createError({ statusCode, statusMessage: code, data: { code, message } }); }
const fail: typeof businessFail = businessFail;
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'VALIDATION_ERROR', data: { code: 'VALIDATION_ERROR', fieldErrors: result.error.flatten().fieldErrors } });
  return result.data;
}
export async function limit(key: string, max: number, windowMs: number) {
  await withTransaction(async (tx) => {
    const current = await queryOne<{ count: number; reset_at: number }>('SELECT count,reset_at FROM rate_limits WHERE key=?', [sha256(key)], tx);
    if (current && current.reset_at > Date.now() && current.count >= max) fail(429, 'RATE_LIMITED');
    await execute('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at', [sha256(key), current && current.reset_at > Date.now() ? current.count + 1 : 1, current && current.reset_at > Date.now() ? current.reset_at : Date.now() + windowMs], tx);
  });
}
export async function idempotent<T>(scope: string, key: string, payload: unknown, operation: (tx: Db) => Promise<{ resourceId: string; value: T }>, replay: (resourceId: string, tx: Db) => Promise<T>) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key || '')) fail(400, 'IDEMPOTENCY_KEY_REQUIRED');
  const hash = sha256(JSON.stringify(payload));
  return withTransaction(async (tx) => {
    const previous = await queryOne<{ payload_hash: string; resource_id: string }>('SELECT payload_hash,resource_id FROM idempotency_keys WHERE scope=? AND key=?', [scope, key], tx);
    if (previous) {
      if (previous.payload_hash !== hash) fail(409, 'IDEMPOTENCY_CONFLICT');
      return replay(previous.resource_id, tx);
    }
    const result = await operation(tx);
    await execute('INSERT INTO idempotency_keys(scope,key,payload_hash,resource_id,created_at) VALUES(?,?,?,?,?)', [scope, key, hash, result.resourceId, nowIso()], tx);
    return result.value;
  });
}
export function safeCsv(value: unknown) {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
