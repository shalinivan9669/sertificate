import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, idempotent, nowIso, parse, sha256 } from '../utils/business';
import { incrementOperationalCounter, recordWebhookRejection } from './incidents';
import { logObservation } from '../utils/observability';
import { assertProgramIntakeOpen } from './program-intake';

export function paymentMode() {
  const mode = process.env.OT_PAYMENT_PROVIDER || 'disabled';
  if (mode !== 'disabled' && mode !== 'sandbox') fail(503, 'PAYMENT_PROVIDER_NOT_IMPLEMENTED');
  const environment = process.env.OT_APP_ENV || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'production' : 'development');
  if (mode === 'sandbox' && !['test', 'development', 'staging'].includes(environment)) fail(503, 'SANDBOX_FORBIDDEN_IN_PRODUCTION');
  if (process.env.VERCEL_ENV === 'production' && mode === 'sandbox') fail(503, 'SANDBOX_FORBIDDEN_IN_PRODUCTION');
  return mode;
}
// Correlated lookups use payments(order_id,provider) and refunds_confirmed_order.
// Callers bound the selected orders before any ledger totals are returned.
const financialColumns = `COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.order_id=o.id AND p.currency=o.currency AND p.status IN ('succeeded','partially_refunded','refunded')),0) AS paid_minor,
  COALESCE((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.order_id=o.id AND r.status='confirmed'),0) AS refunded_minor,
  EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.provider='sandbox' AND p.status IN ('succeeded','partially_refunded') AND p.amount_minor=o.amount_minor AND p.currency=o.currency) AS sandbox_refundable`;
function financialDto(row: any) {
  const paidMinor = Number(row.paid_minor || 0), refundedMinor = Number(row.refunded_minor || 0);
  const refundableMinor = Math.max(0, paidMinor - refundedMinor), refundMode = paymentMode();
  return { paidMinor, refundedMinor, refundableMinor, refundMode,
    refundAllowed: refundMode === 'sandbox' && Boolean(row.sandbox_refundable) && ['succeeded', 'partially_refunded'].includes(row.status) && paidMinor === row.amount_minor && refundableMinor > 0 };
}
export const orderDto = (row: any) => ({ id: row.id, userId: row.user_id, versionId: row.version_id, organizationId: row.organization_id, status: row.status, amountMinor: row.amount_minor, currency: row.currency, snapshot: JSON.parse(row.snapshot_json), enrollmentId: row.enrollment_id, createdAt: row.created_at, updatedAt: row.updated_at, ...financialDto(row) });
export async function financeOrders() {
  const rows = await queryAll(`SELECT o.id,o.status,o.amount_minor,o.currency,o.created_at,${financialColumns} FROM orders o ORDER BY o.created_at DESC LIMIT 100`);
  return rows.map(row => ({ id: row.id, status: row.status, amountMinor: row.amount_minor, currency: row.currency, createdAt: row.created_at, ...financialDto(row) }));
}
export async function getOrder(orderId: string, userId: string, db?: Db) {
  const row = await queryOne(`SELECT o.*,${financialColumns} FROM orders o WHERE o.id=? AND o.user_id=?`, [orderId, userId], db);
  if (!row) fail(404, 'ORDER_NOT_FOUND');
  return orderDto(row);
}
export async function createOrder(userId: string, data: unknown, key: string) {
  const body = parse(z.object({ versionId: z.string().min(1).max(100) }).strict(), data);
  return idempotent(`order:${userId}`, key, body, async tx => {
    const version = await queryOne('SELECT * FROM program_versions WHERE id=? AND status=?', [body.versionId, 'published'], tx);
    if (!version) fail(404, 'PUBLISHED_VERSION_NOT_FOUND');
    await assertProgramIntakeOpen(version.id, tx);
    const program = JSON.parse(version.data_json);
    if (program.billingBasis === 'organization') fail(409, 'CORPORATE_INVOICE_REQUIRED');
    if (program.accessModel !== 'paid' || !Number.isSafeInteger(program.priceMinor) || program.priceMinor < 0 || program.currency !== 'KZT') fail(409, 'PROGRAM_NOT_PURCHASABLE');
    // Business approval config is independent of academic state and of the redirect URL.
    if (process.env.OT_PAYMENT_TERMS_APPROVED !== '1') fail(503, 'PAYMENT_TERMS_NOT_CONFIGURED');
    const orderId = id();
    const snapshot = { title: program.title, versionId: version.id, version: version.version, amountMinor: program.priceMinor, currency: 'KZT', accessModel: program.accessModel, paymentTermsVersion: process.env.OT_PAYMENT_TERMS_VERSION || 'unconfigured' };
    await execute('INSERT INTO orders(id,user_id,version_id,amount_minor,currency,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', [orderId, userId, version.id, program.priceMinor, 'KZT', JSON.stringify(snapshot), nowIso(), nowIso()], tx);
    await audit(userId, 'order_created', orderId, '', null, tx);
    return { resourceId: orderId, value: await getOrder(orderId, userId, tx) };
  }, (orderId, tx) => getOrder(orderId, userId, tx));
}

export async function checkout(orderId: string, userId: string) {
  if (paymentMode() === 'disabled') fail(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  if (!process.env.OT_SANDBOX_WEBHOOK_SECRET || !process.env.OT_SANDBOX_MERCHANT) fail(503, 'SANDBOX_NOT_CONFIGURED');
  return withTransaction(async tx => {
    const order = await getOrder(orderId, userId, tx);
    if (!['created', 'pending'].includes(order.status)) fail(409, 'ORDER_NOT_PAYABLE');
    const existing = await queryOne('SELECT id,status FROM payments WHERE order_id=? AND provider=?', [orderId, 'sandbox'], tx);
    const paymentId = existing?.id || id();
    if (!existing) await execute('INSERT INTO payments(id,order_id,provider,amount_minor,currency,merchant,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', [paymentId, orderId, 'sandbox', order.amountMinor, 'KZT', process.env.OT_SANDBOX_MERCHANT!, nowIso(), nowIso()], tx);
    await execute('UPDATE orders SET status=?,updated_at=? WHERE id=?', ['pending', nowIso(), orderId], tx);
    return { mode: 'sandbox', paymentId, checkoutUrl: null, status: existing?.status || 'pending', message: 'Sandbox: a signed provider event is required. No real payment is collected.' };
  });
}

const eventSchema = z.object({ eventId: z.string().min(8).max(120), paymentId: z.string().uuid(), merchant: z.string().max(100), amountMinor: z.number().int().nonnegative().safe(), currency: z.literal('KZT'), status: z.enum(['pending', 'succeeded', 'failed', 'cancelled']), timestamp: z.number().int() }).strict();
async function verifiedPaymentWebhook(raw: string, signature: string) {
  if (paymentMode() !== 'sandbox') fail(503, 'PAYMENTS_DISABLED');
  const secret = process.env.OT_SANDBOX_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) fail(503, 'SANDBOX_NOT_CONFIGURED');
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) fail(401, 'INVALID_SIGNATURE');
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { fail(400, 'INVALID_JSON'); }
  const event = parse(eventSchema, payload);
  if (Math.abs(Date.now() - event.timestamp) > 300000) fail(401, 'WEBHOOK_EXPIRED');
  return withTransaction(async tx => {
    const old = await queryOne('SELECT payload_hash FROM payment_events WHERE id=?', [event.eventId], tx);
    if (old) {
      if (old.payload_hash !== sha256(raw)) fail(409, 'EVENT_CONFLICT');
      return { received: true, duplicate: true };
    }
    const payment = await queryOne('SELECT p.*,o.user_id,o.version_id,o.enrollment_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=?', [event.paymentId], tx);
    if (!payment || payment.provider !== 'sandbox') fail(404, 'PAYMENT_NOT_FOUND');
    if (event.merchant !== payment.merchant || event.merchant !== process.env.OT_SANDBOX_MERCHANT || event.amountMinor !== payment.amount_minor || event.currency !== payment.currency) fail(409, 'PAYMENT_MISMATCH');
    await execute('INSERT INTO payment_events(id,payment_id,payload_hash,event_type,received_at) VALUES(?,?,?,?,?)', [event.eventId, payment.id, sha256(raw), event.status, nowIso()], tx);
    if (['succeeded', 'partially_refunded', 'refunded'].includes(payment.status)) return { received: true, ignored: true };
    await execute('UPDATE payments SET status=?,updated_at=? WHERE id=?', [event.status, nowIso(), payment.id], tx);
    await execute('UPDATE orders SET status=?,updated_at=? WHERE id=?', [event.status, nowIso(), payment.order_id], tx);
    if (event.status === 'succeeded') {
      const enrollmentId = payment.enrollment_id || id();
      if (!payment.enrollment_id) {
        await execute('INSERT INTO enrollments(id,user_id,version_id,status,created_at,reason) VALUES(?,?,?,?,?,?)', [enrollmentId, payment.user_id, payment.version_id, 'active', nowIso(), `Sandbox payment ${payment.id}`], tx);
        await execute('UPDATE orders SET enrollment_id=? WHERE id=?', [enrollmentId, payment.order_id], tx);
        await enqueue('notification.enrollment', enrollmentId, { userId: payment.user_id, enrollmentId }, tx);
      }
      await audit(null, 'payment_confirmed', payment.order_id, 'sandbox', null, tx);
    }
    return { received: true, duplicate: false };
  });
}

export async function processPaymentWebhook(raw: string, signature: string) {
  try {
    const result = await verifiedPaymentWebhook(raw, signature);
    if ('duplicate' in result && result.duplicate) {
      try { await incrementOperationalCounter('webhook_duplicate'); }
      catch { logObservation({ event: 'telemetry_write_failed' }); }
    }
    return result;
  } catch (error: any) {
    // Logging happens outside the rejected domain transaction. Neither raw body nor signature is retained.
    try { await recordWebhookRejection(error?.data?.code || error?.statusMessage || ''); }
    catch { logObservation({ event: 'telemetry_write_failed' }); }
    throw error;
  }
}

export const refundInputSchema = z.object({ reason: z.string().min(10).max(2000), amountMinor: z.number().int().positive().safe().optional(), currency: z.literal('KZT').optional() }).strict()
  .refine(body => body.amountMinor === undefined || body.currency === 'KZT', { path: ['currency'], message: 'Explicit refund amount requires KZT currency' });
type RefundOptions = { amountMinor?: number; currency?: 'KZT'; idempotencyKey?: string };
async function refundReceipt(refundId: string, db: Db) {
  const row = await queryOne(`SELECT r.*,o.amount_minor AS paid_minor FROM refunds r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND r.status='confirmed'`, [refundId], db);
  if (!row) fail(409, 'REFUND_RECEIPT_NOT_FOUND');
  // Existing full-refund rows have no new receipt snapshot. Their original amount is retained.
  const refundedMinor = Number(row.refunded_total_minor ?? row.amount_minor), paidMinor = Number(row.paid_minor);
  return { id: row.id as string, status: 'confirmed' as const, mode: 'sandbox' as const, orderId: row.order_id as string, amountMinor: Number(row.amount_minor), currency: row.currency as 'KZT',
    paidMinor, refundedMinor, refundableMinor: Math.max(0, paidMinor - refundedMinor), orderStatus: refundedMinor < paidMinor ? 'partially_refunded' as const : 'refunded' as const };
}
export async function refundOrder(orderId: string, actorId: string, reason: string, options: RefundOptions = {}) {
  if (paymentMode() !== 'sandbox') fail(503, 'REFUND_PROVIDER_NOT_CONFIGURED');
  const body = parse(refundInputSchema, { reason, amountMinor: options.amountMinor, currency: options.currency });
  if (reason.trim().length < 10 || reason.length > 2000) fail(400, 'REASON_REQUIRED');
  const operation = async (tx: Db) => {
    const sandboxPayment = await queryOne('SELECT * FROM payments WHERE order_id=? AND provider=?', [orderId, 'sandbox'], tx);
    if (!sandboxPayment) fail(409, 'REFUND_PROVIDER_MISMATCH');
    const order = await queryOne('SELECT * FROM orders WHERE id=?', [orderId], tx);
    if (!order) fail(409, 'ORDER_NOT_REFUNDABLE');
    if (sandboxPayment.amount_minor !== order.amount_minor || sandboxPayment.currency !== order.currency || order.currency !== (body.currency || 'KZT') || !Number.isSafeInteger(sandboxPayment.amount_minor)) fail(409, 'REFUND_PAYMENT_MISMATCH');
    // Preserve the pre-existing full-refund call contract, including replay after a full refund.
    if (body.amountMinor === undefined && order.status === 'refunded') {
      const previous = await queryOne("SELECT id FROM refunds WHERE order_id=? AND status='confirmed' ORDER BY refunded_total_minor DESC,created_at DESC,id DESC LIMIT 1", [orderId], tx);
      if (previous) return { resourceId: previous.id as string, value: await refundReceipt(previous.id, tx) };
    }
    if (!['succeeded', 'partially_refunded'].includes(order.status) || sandboxPayment.status !== order.status) fail(409, 'ORDER_NOT_REFUNDABLE');
    const totals = await queryOne("SELECT COALESCE(SUM(amount_minor),0) AS refunded FROM refunds WHERE order_id=? AND status='confirmed'", [orderId], tx);
    const refunded = Number(totals!.refunded), remaining = Number(sandboxPayment.amount_minor) - refunded;
    if (!Number.isSafeInteger(refunded) || refunded < 0 || remaining <= 0) fail(409, 'ORDER_NOT_REFUNDABLE');
    const amount = body.amountMinor ?? remaining;
    if (amount > remaining) fail(409, 'REFUND_AMOUNT_EXCEEDS_REMAINING');
    const refundId = id();
    await execute('INSERT INTO refunds(id,order_id,status,amount_minor,reason,actor_id,created_at,payment_id,currency,refunded_total_minor) VALUES(?,?,?,?,?,?,?,?,?,?)', [refundId, orderId, 'confirmed', amount, reason, actorId, nowIso(), sandboxPayment.id, 'KZT', refunded + amount], tx);
    const status = refunded + amount === sandboxPayment.amount_minor ? 'refunded' : 'partially_refunded';
    await execute('UPDATE orders SET status=?,updated_at=? WHERE id=?', [status, nowIso(), orderId], tx);
    await execute('UPDATE payments SET status=?,updated_at=? WHERE id=?', [status, nowIso(), sandboxPayment.id], tx);
    // Academic evidence is preserved. Access/credential review is a separate reasoned action.
    await audit(actorId, 'refund_confirmed', orderId, reason, order.organization_id, tx);
    return { resourceId: refundId, value: await refundReceipt(refundId, tx) };
  };
  if (body.amountMinor !== undefined || options.idempotencyKey) {
    return idempotent(`refund:${orderId}`, options.idempotencyKey || '', { actorId, reason, amountMinor: body.amountMinor ?? null, currency: body.currency || 'KZT' }, operation, refundReceipt);
  }
  return withTransaction(async tx => (await operation(tx)).value);
}

export async function commerceOverview(userId: string) {
  const [orders, credentials] = await Promise.all([
    queryAll(`SELECT o.*,${financialColumns} FROM orders o WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 100`, [userId]),
    queryAll('SELECT c.id,c.serial,c.status,c.issued_at,c.snapshot_json FROM credentials c JOIN enrollments e ON e.id=c.enrollment_id WHERE e.user_id=? ORDER BY c.created_at DESC LIMIT 100', [userId]),
  ]);
  return { orders: orders.map(orderDto), credentials: credentials.map(c => ({ id: c.id, serial: c.serial, status: c.status, issuedAt: c.issued_at, programTitle: JSON.parse(c.snapshot_json).programTitle })), paymentProvider: paymentMode() };
}
