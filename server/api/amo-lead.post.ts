import { defineEventHandler, getHeader, getRequestIP, readBody, setResponseStatus } from 'h3';
import { acceptLead } from '../services/leads';
import { limit } from '../utils/business';
import { processOutbox } from '../services/operations';
export default defineEventHandler(async event => {
  const ip = process.env.VERCEL ? getHeader(event, 'x-vercel-forwarded-for') || 'unknown' : getRequestIP(event) || 'unknown';
  await limit(`lead:${ip}`, 5, 60000);
  const result = await acceptLead(await readBody(event), getHeader(event, 'idempotency-key') || '');
  setResponseStatus(event, 202);
  if ('submissionId' in result && process.env.OT_CRM_DELIVERY_ENABLED === '1') event.waitUntil(processOutbox({ aggregateId: result.submissionId, limit: 1, budgetMs: 30000, allowExternal: true }).catch(() => undefined));
  return result;
});
