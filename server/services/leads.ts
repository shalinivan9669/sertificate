import { z } from 'zod';
import { audit, enqueue, execute, queryOne, withTransaction, type Db } from '../db';
import { businessFail as fail, id, nowIso, parse, sha256 } from '../utils/business';

const field = (max: number) => z.string().trim().max(max).optional().default('');
const leadSchema = z.object({
  name: field(120), phone: field(30), email: field(254), city: field(80), comment: field(3000), message: field(3000),
  company: field(150), website: field(150), organizationName: field(200), programId: field(100), format: field(80),
  locale: z.enum(['ru', 'kk']).default('ru'), participants: z.number().int().min(1).max(10000).optional(),
  sourcePath: field(300), consentVersion: z.string().max(50).default('legacy-service-v1'), marketingConsent: z.boolean().default(false),
}).strict().refine(v => Boolean(v.phone || v.email), { path: ['phone'], message: 'Phone or email required' })
  .refine(v => !v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email), { path: ['email'], message: 'Invalid email' })
  .refine(v => !v.phone || /^\+?[\d ()-]{7,30}$/.test(v.phone), { path: ['phone'], message: 'Invalid phone' });

export async function acceptLead(body: unknown, suppliedKey = '') {
  const payload = parse(leadSchema, body);
  if (payload.company || payload.website) return { ok: true, status: 'accepted' as const };
  if (payload.sourcePath && (!payload.sourcePath.startsWith('/') || payload.sourcePath.startsWith('//'))) fail(400, 'INVALID_SOURCE');
  payload.sourcePath = payload.sourcePath.split('?')[0] || '';
  const hash = sha256(JSON.stringify(payload));
  // Old forms had no idempotency header. Keep their contract with a short bounded retry window.
  const key = suppliedKey ? `client:${suppliedKey}` : `legacy:${Math.floor(Date.now() / 300000)}:${hash}`;
  if (key.length > 180) fail(400, 'INVALID_IDEMPOTENCY_KEY');
  return withTransaction(async tx => {
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
    return { ok: true, status: 'accepted' as const, submissionId };
  });
}

type CrmTransport = (url: string, options: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<Response>;
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
  // timeouts alone could let five remote calls overrun a serverless invocation.
  const deadline = AbortSignal.timeout(Math.max(1, Math.min(30000, Math.floor(budgetMs))));
  const signal = () => AbortSignal.any([deadline, AbortSignal.timeout(8000)]);
  const payload = JSON.parse(row.payload_json);
  let leadId = row.crm_lead_id;
  if (!leadId) {
    const marker = `OT-${submissionId}`;
    // Recover an ambiguous previous create before retrying. Correlation is stable and contains no PII.
    const lookup = await transport(`${url.origin}/api/v4/leads?query=${encodeURIComponent(marker)}`, { method: 'GET', headers, signal: signal() });
    if (!lookup.ok && lookup.status !== 204) fail(502, 'CRM_LOOKUP_FAILED');
    if (lookup.status !== 204) {
      const found = await lookup.json() as { _embedded?: { leads?: { id: number; name: string }[] } };
      leadId = found._embedded?.leads?.find(lead => lead.name.includes(marker))?.id || null;
    }
    if (!leadId) {
      const fields = [['PHONE', payload.phone], ['EMAIL', payload.email]].filter(([, value]) => value).map(([code, value]) => ({ field_code: code, values: [{ value }] }));
      const custom = [[process.env.AMO_LEAD_CITY_FIELD_ID, payload.city], [process.env.AMO_LEAD_COMMENT_FIELD_ID, payload.comment]].filter(([key, value]) => /^\d+$/.test(key || '') && value).map(([key, value]) => ({ field_id: Number(key), values: [{ value }] }));
      const response = await transport(`${url.origin}/api/v4/leads/complex`, { method: 'POST', headers, body: JSON.stringify([{ name: `${marker} | ${payload.name || 'Заявка OT Center'}`, custom_fields_values: custom, _embedded: { contacts: [{ name: payload.name || 'Контакт OT Center', custom_fields_values: fields }] } }]), signal: signal() });
      if (!response.ok) fail(502, 'CRM_CREATE_FAILED');
      const created = await response.json() as any;
      leadId = Array.isArray(created) ? created[0]?.id : created._embedded?.leads?.[0]?.id;
      if (!Number.isSafeInteger(leadId)) fail(502, 'CRM_INVALID_RESPONSE');
    }
    // Persist the external ID BEFORE adding the note. A note failure never retries creation.
    await execute('UPDATE lead_submissions SET crm_lead_id=?,status=?,updated_at=? WHERE id=?', [leadId!, 'note_pending', nowIso(), submissionId], db);
  }
  const marker = `[OT-NOTE:${submissionId}]`;
  const notes = await transport(`${url.origin}/api/v4/leads/${leadId}/notes`, { method: 'GET', headers, signal: signal() });
  if (!notes.ok && notes.status !== 204) fail(502, 'CRM_NOTE_LOOKUP_FAILED');
  const noteList = notes.status === 204 ? [] : ((await notes.json()) as any)._embedded?.notes || [];
  let noteId = noteList.find((note: any) => note.params?.text?.includes(marker))?.id;
  if (!noteId) {
    const text = [marker, payload.organizationName && `Организация: ${payload.organizationName}`, payload.city && `Город: ${payload.city}`, payload.programId && `Программа: ${payload.programId}`, payload.format && `Формат: ${payload.format}`, `Язык: ${payload.locale}`, payload.participants && `Участников: ${payload.participants}`, payload.comment, payload.message, payload.sourcePath && `Страница: ${payload.sourcePath}`].filter(Boolean).join('\n');
    const response = await transport(`${url.origin}/api/v4/leads/${leadId}/notes`, { method: 'POST', headers, body: JSON.stringify([{ note_type: 'common', params: { text } }]), signal: signal() });
    if (!response.ok) fail(502, 'CRM_NOTE_FAILED');
    noteId = ((await response.json()) as any)._embedded?.notes?.[0]?.id || null;
  }
  await execute('UPDATE lead_submissions SET crm_note_id=?,status=?,updated_at=? WHERE id=?', [noteId, 'delivered', nowIso(), submissionId], db);
  await audit(null, 'lead_crm_delivered', submissionId, '', null, db);
}
