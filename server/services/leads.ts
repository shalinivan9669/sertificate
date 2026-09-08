import { z } from 'zod';
import { audit, enqueue, execute, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, nowIso, parse, sha256 } from '../utils/business';
import { attachLeadAttribution, leadAttributionNote } from './lead-attribution';

const field = (max: number) => z.string().trim().max(max).optional().default('');
const leadSchema = z.object({
  name: field(120), phone: field(30), email: field(254), city: field(80), comment: field(3000), message: field(3000),
  company: field(150), website: field(150), organizationName: field(200), programId: field(100), format: field(80),
  locale: z.enum(['ru', 'kk']).default('ru'), participants: z.number().int().min(1).max(10000).optional(),
  sourcePath: field(300), consentVersion: z.string().max(50).default('legacy-service-v1'), marketingConsent: z.boolean().default(false),
}).strict().refine(v => Boolean(v.phone || v.email), { path: ['phone'], message: 'Phone or email required' })
  .refine(v => !v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email), { path: ['email'], message: 'Invalid email' })
  .refine(v => !v.phone || /^\+?[\d ()-]{7,30}$/.test(v.phone), { path: ['phone'], message: 'Invalid phone' });

export async function acceptLead(body: unknown, suppliedKey = '', analyticsConsent?: string) {
  // Optional context never participates in the existing business hash or validates contact fields.
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : undefined;
  const { attribution, ...business } = source || {};
  const payload = parse(leadSchema, source ? business : body);
  if (payload.company || payload.website) return { ok: true, status: 'accepted' as const };
  if (payload.sourcePath && (!payload.sourcePath.startsWith('/') || payload.sourcePath.startsWith('//'))) fail(400, 'INVALID_SOURCE');
  payload.sourcePath = payload.sourcePath.split('?')[0] || '';
  const hash = sha256(JSON.stringify(payload));
  // Old forms had no idempotency header. Keep their contract with a short bounded retry window.
  const key = suppliedKey ? `client:${suppliedKey}` : `legacy:${Math.floor(Date.now() / 300000)}:${hash}`;
  if (key.length > 180) fail(400, 'INVALID_IDEMPOTENCY_KEY');
  let firstAcceptance = false;
  const result = await withTransaction(async tx => {
    const old = await queryOne<{ id: string; request_hash: string }>('SELECT id,request_hash FROM lead_submissions WHERE idempotency_key=?', [key], tx);
    if (old) {
      if (old.request_hash !== hash) fail(409, 'IDEMPOTENCY_CONFLICT');
      return { ok: true, status: 'accepted' as const, submissionId: old.id };
    }
    const submissionId = id();
    await execute('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?)', [submissionId, JSON.stringify(payload), hash, key, nowIso(), nowIso()], tx);
    await execute('INSERT INTO consent_records(id,lead_id,purpose,version,granted_at) VALUES(?,?,?,?,?)', [id(), submissionId, 'service', payload.consentVersion, nowIso()], tx);
    if (payload.marketingConsent) await execute('INSERT INTO consent_records(id,lead_id,purpose,version,granted_at) VALUES(?,?,?,?,?)', [id(), submissionId, 'marketing', payload.consentVersion, nowIso()], tx);
    await enqueue('crm.lead', submissionId, { submissionId }, tx);
    await audit(null, 'lead_accepted', submissionId, '', null, tx);
    firstAcceptance = true;
    return { ok: true, status: 'accepted' as const, submissionId };
  });
  // A failed optional write cannot roll back the durable lead, consent, audit or CRM outbox.
  // A replay never retries attribution: new context cannot replace the first accepted snapshot.
  if (firstAcceptance) await attachLeadAttribution(result.submissionId, attribution, analyticsConsent);
  return result;
}

type CrmTransport = (url: string, options: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<Response>;
const crmId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const crmEntity = z.object({ id: crmId });
const crmPagination = { _page: crmId.optional(), _links: z.object({ next: z.object({ href: z.string().min(1).max(2048) }).nullable().optional() }).optional() };
const leadLookup = z.object({ ...crmPagination, _embedded: z.object({ leads: z.array(crmEntity.extend({ name: z.string() })).max(250) }) });
const leadCreated = z.union([z.array(crmEntity).length(1), z.object({ _embedded: z.object({ leads: z.array(crmEntity).length(1) }) })]);
const noteLookup = z.object({ ...crmPagination, _embedded: z.object({ notes: z.array(crmEntity.extend({ params: z.object({ text: z.string().optional() }).optional() })).max(250) }) });
const noteCreated = z.object({ _embedded: z.object({ notes: z.array(crmEntity).length(1) }) });

/** Provider bodies are untrusted; neither JSON diagnostics nor rejected values become public errors. */
async function readCrm<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await response.json(); } catch { fail(502, 'CRM_INVALID_RESPONSE'); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) fail(502, 'CRM_INVALID_RESPONSE');
  return parsed.data;
}
function matchingId<T extends { id: number }>(items: T[], matches: (item: T) => boolean) {
  const ids = [...new Set(items.filter(matches).map(item => item.id))];
  // More than one exact marker needs operator reconciliation, not an arbitrary first match.
  if (ids.length > 1) fail(502, 'CRM_INVALID_RESPONSE');
  return ids[0] ?? null;
}
type CrmPage<T> = { items: T[]; next?: string | null; page?: number };
/** Complete bounded lookup before any create. Never forward credentials to an untrusted next URL. */
async function lookupPages<T>(first: URL, transport: CrmTransport, headers: Record<string, string>, signal: () => AbortSignal, read: (response: Response) => Promise<CrmPage<T>>, errorCode: string): Promise<T[]> {
  const items: T[] = []; let current = first;
  for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
    const response = await transport(current.href, { method: 'GET', headers, signal: signal() });
    if (response.status === 204) return items;
    if (!response.ok) fail(502, errorCode);
    const page = await read(response);
    if (page.page !== undefined && page.page !== pageNumber) fail(502, 'CRM_INVALID_RESPONSE');
    items.push(...page.items);
    if (!page.next && page.items.length < 250) return items;
    // A full page without next cannot prove absence; probe the next documented page.
    const next = new URL(current); next.searchParams.set('page', String(pageNumber + 1));
    if (page.next) {
      let supplied: URL;
      try { supplied = new URL(page.next, current); } catch { fail(502, 'CRM_INVALID_RESPONSE'); }
      if (supplied.origin !== first.origin || supplied.pathname !== first.pathname || supplied.username || supplied.password || supplied.hash) fail(502, 'CRM_INVALID_RESPONSE');
      const actual = [...supplied.searchParams.entries()].sort(), expected = [...next.searchParams.entries()].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(502, 'CRM_INVALID_RESPONSE');
    }
    current = next;
  }
  // The remaining search is unknown, so a retry must not blindly create another entity.
  fail(502, 'CRM_INVALID_RESPONSE');
}
export async function deliverLead(submissionId: string, transport: CrmTransport = fetch, db?: Db, budgetMs = 30000) {
  const row = await queryOne<{ payload_json: string; crm_lead_id: number | null; status: string }>('SELECT payload_json,crm_lead_id,status FROM lead_submissions WHERE id=?', [submissionId], db);
  if (!row || row.status === 'delivered') return;
  const host = process.env.AMO_BASE_URL || (process.env.AMO_SUBDOMAIN ? `https://${process.env.AMO_SUBDOMAIN}.amocrm.ru` : '');
  const token = process.env.AMO_ACCESS_TOKEN || process.env.AMO_LONG_TOKEN;
  if (!host || !token) fail(503, 'CRM_NOT_CONFIGURED');
  const url = new URL(host);
  if (url.protocol !== 'https:' || url.username || url.password) fail(503, 'CRM_CONFIG_INVALID');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  // The whole CRM sequence shares the worker's remaining budget. Per-request
  // timeouts alone could let paginated lookups overrun a serverless invocation.
  const deadline = AbortSignal.timeout(Math.max(1, Math.min(30000, Math.floor(budgetMs))));
  const signal = () => AbortSignal.any([deadline, AbortSignal.timeout(8000)]);
  const payload = JSON.parse(row.payload_json);
  let leadId = row.crm_lead_id;
  if (leadId !== null && !crmId.safeParse(leadId).success) fail(502, 'CRM_INVALID_RESPONSE');
  if (leadId === null) {
    const marker = `OT-${submissionId}`;
    // Recover an ambiguous previous create before retrying. Correlation is stable and contains no PII.
    const lookup = new URL('/api/v4/leads', url.origin);
    lookup.searchParams.set('query', marker); lookup.searchParams.set('limit', '250'); lookup.searchParams.set('page', '1');
    const found = await lookupPages(lookup, transport, headers, signal, async response => {
      const page = await readCrm(response, leadLookup); return { items: page._embedded.leads, next: page._links?.next?.href, page: page._page };
    }, 'CRM_LOOKUP_FAILED');
    leadId = matchingId(found, lead => lead.name === marker || lead.name.startsWith(`${marker} | `));
    if (leadId === null) {
      const fields = [['PHONE', payload.phone], ['EMAIL', payload.email]].filter(([, value]) => value).map(([code, value]) => ({ field_code: code, values: [{ value }] }));
      const custom = [[process.env.AMO_LEAD_CITY_FIELD_ID, payload.city], [process.env.AMO_LEAD_COMMENT_FIELD_ID, payload.comment]].filter(([key, value]) => /^\d+$/.test(key || '') && value).map(([key, value]) => ({ field_id: Number(key), values: [{ value }] }));
      const response = await transport(`${url.origin}/api/v4/leads/complex`, { method: 'POST', headers, body: JSON.stringify([{ name: `${marker} | ${payload.name || 'Заявка OT Center'}`, custom_fields_values: custom, _embedded: { contacts: [{ name: payload.name || 'Контакт OT Center', custom_fields_values: fields }] } }]), signal: signal() });
      if (!response.ok) fail(502, 'CRM_CREATE_FAILED');
      const created = await readCrm(response, leadCreated);
      leadId = (Array.isArray(created) ? created[0] : created._embedded.leads[0])!.id;
    }
    // Persist the external ID BEFORE adding the note. A note failure never retries creation.
    await execute('UPDATE lead_submissions SET crm_lead_id=?,status=?,updated_at=? WHERE id=?', [leadId!, 'note_pending', nowIso(), submissionId], db);
  }
  const marker = `[OT-NOTE:${submissionId}]`;
  const lookup = new URL(`/api/v4/leads/${leadId}/notes`, url.origin); lookup.searchParams.set('limit', '250'); lookup.searchParams.set('page', '1');
  const noteList = await lookupPages(lookup, transport, headers, signal, async response => {
    const page = await readCrm(response, noteLookup); return { items: page._embedded.notes, next: page._links?.next?.href, page: page._page };
  }, 'CRM_NOTE_LOOKUP_FAILED');
  let noteId = matchingId(noteList, note => note.params?.text?.split(/\r?\n/, 1)[0] === marker);
  if (noteId === null) {
    const attribution = await leadAttributionNote(submissionId, db);
    const text = [marker, payload.organizationName && `Организация: ${payload.organizationName}`, payload.city && `Город: ${payload.city}`, payload.programId && `Программа: ${payload.programId}`, payload.format && `Формат: ${payload.format}`, `Язык: ${payload.locale}`, payload.participants && `Участников: ${payload.participants}`, payload.comment, payload.message, payload.sourcePath && `Страница: ${payload.sourcePath}`, attribution].filter(Boolean).join('\n');
    const response = await transport(`${url.origin}/api/v4/leads/${leadId}/notes`, { method: 'POST', headers, body: JSON.stringify([{ note_type: 'common', params: { text } }]), signal: signal() });
    if (!response.ok) fail(502, 'CRM_NOTE_FAILED');
    const created = await readCrm(response, noteCreated);
    noteId = created._embedded.notes[0]!.id;
  }
  // Remote work has finished. Commit status and mandatory audit together so a
  // failed audit never leaves a delivered row that bypasses all future retries.
  const confirm = async (tx: Db) => {
    const changed = await execute('UPDATE lead_submissions SET crm_note_id=?,status=?,updated_at=? WHERE id=? AND status<>?', [noteId, 'delivered', nowIso(), submissionId, 'delivered'], tx);
    if (Number(changed.rowsAffected) > 0) await audit(null, 'lead_crm_delivered', submissionId, '', null, tx);
  };
  if (db && !('transaction' in db)) await confirm(db); // Existing transaction remains caller-owned.
  else await withTransaction(confirm, db);
}
