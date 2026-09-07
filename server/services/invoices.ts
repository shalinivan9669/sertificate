import { z } from 'zod';
import { audit, enqueue, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { assertRole, type AppUser } from '../utils/auth';
import { assertProgramIntakeOpen } from './program-intake';
import { businessFail as fail, id, idempotent, nowIso, parse } from '../utils/business';
import { requireMembership } from './organizations';
import { getVersion, type ProgramData } from './catalog';
import { currentObservation } from '../utils/observability';

const label = z.string().trim().min(2).max(250);
const buyerSchema = z.object({ name: label, bin: z.string().regex(/^\d{12}$/), address: z.string().trim().min(5).max(500) }).strict();
const issuerSchema = buyerSchema.extend({ bankName: label, bic: z.string().regex(/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/), iban: z.string().regex(/^KZ\d{2}[A-Z0-9]{16}$/), paymentPurpose: z.string().trim().min(10).max(1000) }).strict();
const createSchema = z.object({ versionId: z.string().min(1).max(100), userIds: z.array(z.string().min(1).max(100)).min(1).max(100), buyer: buyerSchema }).strict();
const confirmationSchema = z.object({ amountMinor: z.number().int().positive().max(100_000_000_000), currency: z.literal('KZT'), reference: z.string().trim().min(3).max(120).regex(/^[\p{L}\p{N} ._/-]+$/u), reason: z.string().trim().min(10).max(2000) }).strict();
const reasonSchema = z.object({ reason: z.string().trim().min(10).max(2000) }).strict();
type Issuer = z.infer<typeof issuerSchema>;
type InvoiceRow = { id: string; number: string; organization_id: string; version_id: string; status: 'issued' | 'confirmed' | 'cancelled'; amount_minor: number; currency: 'KZT'; snapshot_json: string; created_by: string; created_at: string; confirmed_at: string | null; confirmation_json: string | null; cancelled_at: string | null; cancellation_reason: string | null };
type Line = { id: string; user_id: string; amount_minor: number; allocated_amount_minor?: number | null; snapshot_json: string; order_id?: string; enrollment_id?: string };
type Snapshot = { issuer: Issuer; buyer: z.infer<typeof buyerSchema>; programTitle: string; versionId: string; quantity: number; unitAmountMinor: number; billingBasis?: 'learner' | 'organization'; paymentPurpose: string };
const placeholders = (count: number) => Array(count).fill('?').join(',');
const lineAmount = (line: Line) => line.allocated_amount_minor ?? line.amount_minor;

function configuredIssuer(): Issuer | null {
  if (process.env.OT_INVOICE_ENABLED !== '1') return null;
  try { const result = issuerSchema.safeParse(JSON.parse(process.env.OT_INVOICE_ISSUER_JSON || '')); return result.success ? result.data : null; } catch { return null; }
}
export function invoiceConfiguration() { return { enabled: Boolean(configuredIssuer()), currency: 'KZT', employeeLimit: 100, documentFormat: 'html', confirmationMode: 'finance_manual_evidence' }; }
function requireConfiguredIssuer() { const issuer = configuredIssuer(); if (!issuer) fail(503, 'INVOICES_NOT_CONFIGURED'); return issuer; }

async function finance(actor: AppUser, db?: Db) {
  assertRole(actor, ['finance']);
  const current = await queryOne('SELECT role,twoFactorEnabled,emailVerified FROM "user" WHERE id=?', [actor.id], db);
  if (!current?.emailVerified) fail(403, 'FORBIDDEN');
  assertRole({ ...actor, role: current.role, twoFactorEnabled: Boolean(current.twoFactorEnabled) }, ['finance']);
}
async function invoiceRow(actor: AppUser, invoiceId: string, db?: Db) {
  const invoice = await queryOne<InvoiceRow>('SELECT * FROM corporate_invoices WHERE id=?', [invoiceId], db);
  if (!invoice) fail(404, 'INVOICE_NOT_FOUND');
  if (actor.role === 'finance' || actor.role === 'admin') await finance(actor, db);
  else await requireMembership(actor.id, invoice.organization_id, ['owner', 'manager'], db);
  return invoice;
}
function dto(invoice: InvoiceRow, lines: Line[] = []) {
  return { id: invoice.id, number: invoice.number, organizationId: invoice.organization_id, versionId: invoice.version_id, status: invoice.status, amountMinor: invoice.amount_minor, currency: invoice.currency,
    snapshot: JSON.parse(invoice.snapshot_json) as Snapshot, createdAt: invoice.created_at, confirmedAt: invoice.confirmed_at, confirmation: invoice.confirmation_json ? JSON.parse(invoice.confirmation_json) : null,
    cancelledAt: invoice.cancelled_at, cancellationReason: invoice.cancellation_reason,
    lines: lines.map(line => ({ id: line.id, userId: line.user_id, amountMinor: lineAmount(line), ...JSON.parse(line.snapshot_json), orderId: line.order_id || null, enrollmentId: line.enrollment_id || null })) };
}
async function details(actor: AppUser, invoiceId: string, db?: Db) {
  const invoice = await invoiceRow(actor, invoiceId, db);
  const lines = await queryAll<Line>('SELECT l.*,f.order_id,f.enrollment_id FROM corporate_invoice_lines l LEFT JOIN corporate_invoice_fulfillments f ON f.line_id=l.id WHERE l.invoice_id=? ORDER BY l.user_id', [invoiceId], db);
  return { invoice: dto(invoice, lines) };
}
export async function getInvoice(actor: AppUser, invoiceId: string) { return details(actor, invoiceId); }
export async function listInvoices(actor: AppUser, organizationId: string) {
  await requireMembership(actor.id, organizationId);
  return { ...invoiceConfiguration(), invoices: (await queryAll<InvoiceRow>('SELECT * FROM corporate_invoices WHERE organization_id=? ORDER BY created_at DESC LIMIT 100', [organizationId])).map(row => dto(row)) };
}
export async function listFinanceInvoices(actor: AppUser) {
  await finance(actor);
  return { ...invoiceConfiguration(), invoices: (await queryAll<InvoiceRow>('SELECT * FROM corporate_invoices ORDER BY created_at DESC LIMIT 100')).map(row => dto(row)) };
}

async function eligibleSeats(organizationId: string, userIds: string[], versionId: string, tx: Db) {
  const members = await queryAll(`SELECT u.id,u.name,u.email FROM memberships m JOIN "user" u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id
    WHERE m.organization_id=? AND m.status='active' AND o.status='active' AND u.emailVerified=1 AND u.id IN (${placeholders(userIds.length)}) ORDER BY u.id`, [organizationId, ...userIds], tx);
  if (members.length !== userIds.length) fail(409, 'ACTIVE_VERIFIED_EMPLOYEES_REQUIRED');
  const enrollments = await queryAll(`SELECT id,user_id,status,access_until FROM enrollments WHERE organization_id=? AND version_id=? AND user_id IN (${placeholders(userIds.length)}) AND status NOT IN ('cancelled','expired')`, [organizationId, versionId, ...userIds], tx);
  if (enrollments.some(row => row.status !== 'pending_access' || (row.access_until && row.access_until <= nowIso()))) fail(409, 'EMPLOYEE_ALREADY_ASSIGNED');
  if (new Set(enrollments.map(row => row.user_id)).size !== enrollments.length) fail(409, 'DUPLICATE_PENDING_ASSIGNMENTS');
  const paid = await queryOne(`SELECT id FROM orders WHERE organization_id=? AND version_id=? AND status='succeeded' AND user_id IN (${placeholders(userIds.length)}) LIMIT 1`, [organizationId, versionId, ...userIds], tx);
  if (paid) fail(409, 'EMPLOYEE_ALREADY_PAID');
  return { members, enrollments };
}
export async function createInvoice(actor: AppUser, organizationId: string, data: unknown, key: string) {
  const issuer = requireConfiguredIssuer(); const body = parse(createSchema, data);
  if (new Set(body.userIds).size !== body.userIds.length) fail(400, 'DUPLICATE_EMPLOYEES');
  body.userIds.sort();
  return idempotent(`invoice:${actor.id}:${organizationId}`, key, body, async tx => {
    await requireMembership(actor.id, organizationId, ['owner', 'manager'], tx);
    const version = await getVersion(body.versionId, tx); const program: ProgramData = JSON.parse(version.data_json);
    await assertProgramIntakeOpen(version.id, tx);
    if (version.status !== 'published' || program.accessModel !== 'paid' || !Number.isSafeInteger(program.priceMinor) || program.priceMinor! <= 0 || program.currency !== 'KZT') fail(409, 'PAID_PUBLISHED_VERSION_REQUIRED');
    const { members } = await eligibleSeats(organizationId, body.userIds, version.id, tx);
    const reservation = await queryOne(`SELECT invoice_id FROM corporate_invoice_reservations WHERE organization_id=? AND version_id=? AND user_id IN (${placeholders(body.userIds.length)}) LIMIT 1`, [organizationId, version.id, ...body.userIds], tx);
    if (reservation) fail(409, 'EMPLOYEE_IN_OPEN_INVOICE');
    const invoiceId = id(), timestamp = nowIso(), number = `OT-${timestamp.slice(0, 10).replaceAll('-', '')}-${invoiceId.slice(0, 8).toUpperCase()}`;
    const billingBasis = program.billingBasis ?? 'learner';
    const total = program.priceMinor! * (billingBasis === 'organization' ? 1 : members.length);
    const snapshot: Snapshot = { issuer, buyer: body.buyer, programTitle: program.title, versionId: version.id, quantity: members.length, unitAmountMinor: program.priceMinor!, billingBasis, paymentPurpose: `${issuer.paymentPurpose} / ${number}` };
    await execute('INSERT INTO corporate_invoices(id,number,organization_id,version_id,amount_minor,currency,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [invoiceId, number, organizationId, version.id, total, 'KZT', JSON.stringify(snapshot), actor.id, timestamp], tx);
    await execute(`INSERT INTO corporate_invoice_lines(id,invoice_id,user_id,amount_minor,allocated_amount_minor,snapshot_json) VALUES ${members.map(() => '(?,?,?,?,?,?)').join(',')}`, members.flatMap((member, index) => [id(), invoiceId, member.id, program.priceMinor!, Math.floor(total / members.length) + (index < total % members.length ? 1 : 0), JSON.stringify({ learnerName: member.name, email: member.email, programTitle: program.title, versionId: version.id })]), tx);
    await execute(`INSERT INTO corporate_invoice_reservations(organization_id,user_id,version_id,invoice_id) VALUES ${members.map(() => '(?,?,?,?)').join(',')}`, members.flatMap(member => [organizationId, member.id, version.id, invoiceId]), tx);
    await execute("UPDATE corporate_invoices SET status='issued' WHERE id=?", [invoiceId], tx);
    await audit(actor.id, 'invoice.created', invoiceId, '', organizationId, tx);
    return { resourceId: invoiceId, value: await details(actor, invoiceId, tx) };
  }, (invoiceId, tx) => details(actor, invoiceId, tx));
}

export async function cancelInvoice(actor: AppUser, invoiceId: string, data: unknown) {
  const body = parse(reasonSchema, data);
  return withTransaction(async tx => {
    const invoice = await invoiceRow(actor, invoiceId, tx);
    if (actor.role === 'finance') fail(403, 'ORGANIZATION_MANAGER_OR_ADMIN_REQUIRED');
    if (invoice.status === 'cancelled') return details(actor, invoiceId, tx);
    if (invoice.status !== 'issued') fail(409, 'INVOICE_ALREADY_CONFIRMED');
    await execute('UPDATE corporate_invoices SET status=?,cancelled_by=?,cancelled_at=?,cancellation_reason=? WHERE id=?', ['cancelled', actor.id, nowIso(), body.reason, invoiceId], tx);
    await execute('DELETE FROM corporate_invoice_reservations WHERE invoice_id=?', [invoiceId], tx);
    await audit(actor.id, 'invoice.cancelled', invoiceId, body.reason, invoice.organization_id, tx);
    return details(actor, invoiceId, tx);
  });
}

export async function confirmInvoice(actor: AppUser, invoiceId: string, data: unknown) {
  requireConfiguredIssuer(); const body = parse(confirmationSchema, data);
  body.reference = body.reference.toUpperCase().replace(/\s+/g, ' ');
  return withTransaction(async tx => {
    await finance(actor, tx); const invoice = await invoiceRow(actor, invoiceId, tx);
    if (invoice.status === 'confirmed') {
      if (invoice.confirmation_json !== JSON.stringify(body)) fail(409, 'INVOICE_CONFIRMATION_CONFLICT');
      return details(actor, invoiceId, tx);
    }
    if (invoice.status !== 'issued') fail(409, 'INVOICE_CANCELLED');
    if (body.amountMinor !== invoice.amount_minor) fail(409, 'INVOICE_AMOUNT_MISMATCH');
    if (await queryOne('SELECT id FROM corporate_invoices WHERE payment_reference=?', [body.reference], tx)) fail(409, 'PAYMENT_REFERENCE_ALREADY_USED');
    const lines = await queryAll<Line>('SELECT * FROM corporate_invoice_lines WHERE invoice_id=? ORDER BY user_id', [invoiceId], tx);
    if (!lines.length || lines.length > 100 || lines.reduce((sum, line) => sum + lineAmount(line), 0) !== invoice.amount_minor) fail(409, 'INVOICE_INTEGRITY_ERROR');
    const { enrollments } = await eligibleSeats(invoice.organization_id, lines.map(line => line.user_id), invoice.version_id, tx);
    const timestamp = nowIso();
    const fulfilled = lines.map(line => ({ line, enrollmentId: enrollments.find(row => row.user_id === line.user_id)?.id || id(), orderId: id(), paymentId: id() }));
    const newSeats = fulfilled.filter(item => !enrollments.some(row => row.id === item.enrollmentId));
    if (newSeats.length) await execute(`INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) VALUES ${newSeats.map(() => '(?,?,?,?,?,?)').join(',')}`, newSeats.flatMap(item => [item.enrollmentId, item.line.user_id, invoice.version_id, invoice.organization_id, 'active', timestamp]), tx);
    if (enrollments.length) await execute(`UPDATE enrollments SET status='active' WHERE id IN (${placeholders(enrollments.length)}) AND status='pending_access'`, enrollments.map(row => row.id), tx);
    const snapshot: Snapshot = JSON.parse(invoice.snapshot_json);
    await execute(`INSERT INTO orders(id,user_id,organization_id,version_id,status,amount_minor,currency,snapshot_json,enrollment_id,created_at,updated_at) VALUES ${fulfilled.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`, fulfilled.flatMap(item => [item.orderId, item.line.user_id, invoice.organization_id, invoice.version_id, 'succeeded', lineAmount(item.line), 'KZT', JSON.stringify({ programTitle: snapshot.programTitle, invoiceId, invoiceNumber: invoice.number, priceMinor: lineAmount(item.line), billingBasis: snapshot.billingBasis ?? 'learner', currency: 'KZT', paymentMode: 'finance_manual_evidence' }), item.enrollmentId, timestamp, timestamp]), tx);
    await execute(`INSERT INTO payments(id,order_id,provider,status,amount_minor,currency,merchant,created_at,updated_at) VALUES ${fulfilled.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`, fulfilled.flatMap(item => [item.paymentId, item.orderId, 'manual_invoice', 'succeeded', lineAmount(item.line), 'KZT', snapshot.issuer.bin, timestamp, timestamp]), tx);
    await execute(`INSERT INTO corporate_invoice_fulfillments(line_id,order_id,enrollment_id,created_at) VALUES ${fulfilled.map(() => '(?,?,?,?)').join(',')}`, fulfilled.flatMap(item => [item.line.id, item.orderId, item.enrollmentId, timestamp]), tx);
    await execute('UPDATE corporate_invoices SET status=?,confirmed_by=?,confirmed_at=?,confirmation_json=?,payment_reference=? WHERE id=?', ['confirmed', actor.id, timestamp, JSON.stringify(body), body.reference, invoiceId], tx);
    await execute('DELETE FROM corporate_invoice_reservations WHERE invoice_id=?', [invoiceId], tx);
    // One SQL statement queues bounded per-seat internal notifications; external delivery stays separately gated.
    const observation = currentObservation();
    await execute(`INSERT INTO outbox(id,type,aggregate_id,payload_json,available_at,created_at,updated_at,request_id,correlation_id,origin_request_id,source_job_id) VALUES ${fulfilled.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`, fulfilled.flatMap(item => [id(), 'learning.enrolled', item.enrollmentId, JSON.stringify({ userId: item.line.user_id, enrollmentId: item.enrollmentId, invoiceId }), timestamp, timestamp, timestamp, observation?.requestId || null, observation?.correlationId || null, observation?.originRequestId || null, observation?.sourceJobId || null]), tx);
    await enqueue('notification.invoice_confirmed', invoiceId, { userId: invoice.created_by, invoiceId }, tx);
    await audit(actor.id, 'invoice.payment_confirmed_manually', invoiceId, `${body.reference}: ${body.reason}`, invoice.organization_id, tx);
    return details(actor, invoiceId, tx);
  });
}

function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
const money = (amount: number) => new Intl.NumberFormat('ru-KZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100);
export async function renderInvoice(actor: AppUser, invoiceId: string) {
  const { invoice } = await getInvoice(actor, invoiceId); const s = invoice.snapshot;
  const billingQuantity = s.billingBasis === 'organization' ? 1 : s.quantity;
  const participantNote = s.billingBasis === 'organization' ? ` (Организация: ${s.quantity} слушателей)` : '';
  const status = invoice.status === 'confirmed' ? 'Поступление оплаты подтверждено финансовым сотрудником вручную' : invoice.status === 'cancelled' ? 'СЧЁТ ОТМЕНЁН — НЕ ОПЛАЧИВАТЬ' : 'Ожидает оплаты';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Счёт ${escapeHtml(invoice.number)}</title><style>body{font:15px/1.5 Arial,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#14283f}h1{font-size:26px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #aaa;padding:8px;text-align:left}dt{font-weight:bold}dd{margin:0 0 12px;white-space:pre-wrap}.muted{font-size:13px;color:#555}@media print{body{margin:0;padding:0}tr{break-inside:avoid}}</style></head><body><h1>Счёт на оплату № ${escapeHtml(invoice.number)}</h1><p>От ${escapeHtml(invoice.createdAt.slice(0, 10))}. ${escapeHtml(status)}.</p><dl><dt>Получатель</dt><dd>${escapeHtml(s.issuer.name)}\nБИН ${escapeHtml(s.issuer.bin)}\n${escapeHtml(s.issuer.address)}</dd><dt>Банковские реквизиты</dt><dd>${escapeHtml(s.issuer.bankName)}\nБИК ${escapeHtml(s.issuer.bic)}\nИИК ${escapeHtml(s.issuer.iban)}</dd><dt>Плательщик</dt><dd>${escapeHtml(s.buyer.name)}\nБИН ${escapeHtml(s.buyer.bin)}\n${escapeHtml(s.buyer.address)}</dd><dt>Назначение платежа</dt><dd>${escapeHtml(s.paymentPurpose)}</dd></dl><table><thead><tr><th>Услуга</th><th>Количество</th><th>Цена, KZT</th><th>Сумма, KZT</th></tr></thead><tbody><tr><td>${escapeHtml(s.programTitle)}${escapeHtml(participantNote)}</td><td>${billingQuantity}</td><td>${money(s.unitAmountMinor)}</td><td>${money(invoice.amountMinor)}</td></tr></tbody></table><p><strong>Итого к оплате: ${money(invoice.amountMinor)} KZT.</strong></p><p class="muted">Счёт содержит зафиксированную стоимость выбранной версии программы. Этот документ не является кассовым чеком, налоговым документом или документом об обучении. Подтверждение оплаты не заменяет прохождение обучения и экзамена. Сохранить PDF можно через печать браузера.</p></body></html>`;
  return { html, filename: `invoice-${invoice.number}.html` };
}
