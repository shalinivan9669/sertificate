import { defineEventHandler, getCookie, getHeader, getMethod, getRequestIP, getRequestURL, readBody, readRawBody, setHeader, setResponseStatus } from 'h3';
import { requireUser, assertRole } from '../utils/auth';
import { businessFail as fail, limit } from '../utils/business';
import { queryAll, queryOne } from '../db';
import * as commerce from '../services/commerce';
import * as organizations from '../services/organizations';
import * as reminders from '../services/reminders';
import * as credentials from '../services/credentials';
import * as operations from '../services/operations';
import { acceptLead } from '../services/leads';
import * as invoices from '../services/invoices';
import * as incidents from '../services/incidents';
import * as staffWorkflows from '../services/staff-workflows';
import * as analytics from '../services/analytics';
import * as sales from '../services/sales-links';
import { analyticsCookieName } from '../../shared/analytics';
export default defineEventHandler(async event => {
  const path = getRequestURL(event).pathname.replace(/^\/api\/v1\//, ''); const parts = path.split('/'); const method = getMethod(event); const segment = (index: number) => parts[index] || "";
  const ip = process.env.VERCEL ? getHeader(event, 'x-vercel-forwarded-for') || 'unknown' : getRequestIP(event) || 'unknown'; const key = getHeader(event, 'idempotency-key') || '';
  if (method === 'POST' && path === 'payments/webhook') return commerce.processPaymentWebhook((await readRawBody(event)) || '', getHeader(event, 'x-sandbox-signature') || '');
  if (method === 'GET' && segment(0) === 'verify' && parts.length === 2) { await limit(`verify:${ip}`, 30, 60000); return credentials.verifyCredential(segment(1)); }
  if (method === 'POST' && path === 'leads') {
    await limit(`lead:${ip}`, 5, 60000);
    const result = await acceptLead(await readBody(event), key, getCookie(event, analyticsCookieName));
    setResponseStatus(event, 202);
    if ('submissionId' in result && process.env.OT_CRM_DELIVERY_ENABLED === '1') event.waitUntil(operations.processOutbox({ aggregateId: result.submissionId, limit: 1, budgetMs: 30000, allowExternal: true }).catch(() => undefined));
    return result;
  }
  if (method === 'GET' && path === 'analytics/config') return analytics.analyticsConfiguration();
  if (method === 'POST' && path === 'analytics') return analytics.recordClientAnalytics(await readBody(event), getCookie(event, analyticsCookieName), () => limit(`analytics:${ip}`, 60, 60000));
  if (path === 'operations/tick' && method === 'GET') {
    if (!operations.secretEquals((getHeader(event, 'authorization') || '').replace(/^Bearer /, ''), process.env.CRON_SECRET)) fail(401, 'UNAUTHORIZED');
    return operations.runOperationalTick({ allowExternal: true });
  }
  const user = await requireUser(event);
  const requireStaff = (roles: string[]) => { assertRole(user, roles); return user; };
  if (method === 'GET' && path === 'commerce/me') return commerce.commerceOverview(user.id);
  if (method === 'POST' && path === 'orders') return { order: await commerce.createOrder(user.id, await readBody(event), key) };
  if (segment(0) === 'orders' && parts.length === 2 && method === 'GET') return { order: await commerce.getOrder(segment(1), user.id) };
  if (segment(0) === 'orders' && segment(2) === 'checkout' && parts.length === 3 && method === 'POST') return commerce.checkout(segment(1), user.id);
  if (segment(0) === 'credentials' && parts.length === 2 && method === 'GET') return { credential: await credentials.getCredential(segment(1), user.id) };
  if (segment(0) === 'credentials' && segment(2) === 'download' && parts.length === 3 && method === 'GET') { const document = await credentials.downloadCredential(segment(1), user.id); setHeader(event, 'Content-Type', 'application/pdf'); setHeader(event, 'Content-Disposition', `attachment; filename="${document.serial}.pdf"`); return document.bytes; }
  if (path === 'organizations' && method === 'GET') return organizations.listOrganizations(user.id, Object.fromEntries(getRequestURL(event).searchParams));
  if (path === 'me/learning-reminders' && method === 'GET') return reminders.listLearningReminders(user, undefined, Object.fromEntries(getRequestURL(event).searchParams));
  if (path === 'me/learning-reminders/enrollments' && method === 'GET') return reminders.reminderEnrollmentChoices(user, Object.fromEntries(getRequestURL(event).searchParams));
  if (path === 'me/learning-reminders' && method === 'POST') return reminders.createLearningReminder(user, undefined, await readBody(event), key);
  if (path === 'me/reminder-preferences' && method === 'GET') return reminders.getReminderPreferences(user);
  if (path === 'me/reminder-preferences' && method === 'POST') return reminders.updateReminderPreferences(user, await readBody(event));
  if (segment(0) === 'learning-reminders' && segment(2) === 'update' && parts.length === 3 && method === 'POST') return reminders.updateLearningReminder(user, segment(1), await readBody(event));
  if (segment(0) === 'learning-reminders' && segment(2) === 'cancel' && parts.length === 3 && method === 'POST') return reminders.cancelLearningReminder(user, segment(1), await readBody(event));
  if (path === 'invitations/accept' && method === 'POST') return organizations.acceptInvitation(user, (await readBody(event))?.token || '');
  if (segment(0) === 'invoices' && parts.length === 2 && method === 'GET') return invoices.getInvoice(user, segment(1));
  if (segment(0) === 'invoices' && segment(2) === 'cancel' && parts.length === 3 && method === 'POST') return invoices.cancelInvoice(user, segment(1), await readBody(event));
  if (segment(0) === 'invoices' && segment(2) === 'download' && parts.length === 3 && method === 'GET') {
    const document = await invoices.renderInvoice(user, segment(1));
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${document.filename}"`);
    setHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
    return document.html;
  }
  if (segment(0) === 'organizations') {
    const organizationId = segment(1);
    if (parts.length === 2 && method === 'GET') return organizations.organizationOverview(user.id, organizationId, Object.fromEntries(getRequestURL(event).searchParams));
    if (segment(2) === 'learning-reminders' && parts.length === 3 && method === 'GET') return reminders.listLearningReminders(user, organizationId, Object.fromEntries(getRequestURL(event).searchParams));
    if (segment(2) === 'learning-reminders' && parts.length === 3 && method === 'POST') return reminders.createLearningReminder(user, organizationId, await readBody(event), key);
    if (segment(2) === 'invitations' && parts.length === 3 && method === 'POST') return organizations.invite(user.id, organizationId, await readBody(event));
    if (segment(2) === 'invoices' && parts.length === 3 && method === 'GET') return invoices.listInvoices(user, organizationId);
    if (segment(2) === 'invoices' && parts.length === 3 && method === 'POST') return invoices.createInvoice(user, organizationId, await readBody(event), key);
    if (segment(2) === 'assignments' && parts.length === 3 && method === 'POST') return organizations.assignEmployees(user.id, organizationId, await readBody(event), key);
    if (segment(2) === 'import' && segment(3) === 'preview' && parts.length === 4 && method === 'POST') return organizations.previewImport(user.id, organizationId, (await readBody(event))?.csv || '');
    if (segment(2) === 'import' && segment(3) === 'commit' && parts.length === 4 && method === 'POST') return organizations.commitImport(user.id, organizationId, (await readBody(event))?.previewId || '');
    if (segment(2) === 'members' && segment(4) === 'revoke' && parts.length === 5 && method === 'POST') return organizations.revokeMembership(user.id, organizationId, segment(3), (await readBody(event))?.reason || '');
    if (segment(2) === 'report.csv' && parts.length === 3 && method === 'GET') { setHeader(event, 'Content-Type', 'text/csv; charset=utf-8'); setHeader(event, 'Content-Disposition', 'attachment; filename="training-report.csv"'); return '\uFEFF' + await organizations.organizationReport(user.id, organizationId, Object.fromEntries(getRequestURL(event).searchParams)); }
  }
  if (path === 'me/notifications' && method === 'GET') return operations.listNotifications(user.id);
  if (segment(0) === 'me' && segment(1) === 'notifications' && segment(3) === 'read' && parts.length === 4 && method === 'POST') return operations.markNotificationRead(user.id, segment(2));
  if (path === 'me/consents' && method === 'GET') return { marketing: Boolean(await queryOne('SELECT id FROM consent_records WHERE user_id=? AND purpose=? AND withdrawn_at IS NULL LIMIT 1', [user.id, 'marketing'])) };
  if (path === 'me/consents' && method === 'POST') return operations.updateConsent(user.id, await readBody(event));
  if (segment(0) === 'admin') {
    if (path === 'admin/leads' && method === 'GET') return sales.listSalesLeads(user, Object.fromEntries(getRequestURL(event).searchParams));
    if (path === 'admin/leads/targets' && method === 'GET') return sales.salesTargets(user, Object.fromEntries(getRequestURL(event).searchParams));
    if (segment(1) === 'leads' && parts.length === 3 && method === 'GET') return sales.getSalesLead(user, segment(2));
    if (segment(1) === 'leads' && method === 'POST') {
      if (segment(3) === 'qualification' && parts.length === 4) return sales.qualifyLead(user, segment(2), await readBody(event), key);
      if (segment(3) === 'links' && parts.length === 4) return sales.linkLead(user, segment(2), await readBody(event), key);
      if (segment(3) === 'links' && segment(5) === 'revoke' && parts.length === 6) return sales.revokeSalesLink(user, segment(2), segment(4), await readBody(event), key);
      if (segment(3) === 'proposals' && parts.length === 4) return sales.recordSalesProposal(user, segment(2), await readBody(event), key);
      if (segment(3) === 'proposals' && parts.length === 6) {
        if (segment(5) === 'organization') return sales.attachProposalOrganization(user, segment(2), segment(4), await readBody(event), key);
        if (segment(5) === 'assignments') return sales.attachProposalAssignments(user, segment(2), segment(4), await readBody(event), key);
        if (segment(5) === 'withdraw') return sales.withdrawSalesProposal(user, segment(2), segment(4), await readBody(event), key);
      }
    }
    if (path === 'admin/analytics' && method === 'GET') return analytics.analyticsReport(user, Object.fromEntries(getRequestURL(event).searchParams));
    if (segment(1) === 'support-notes' && parts.length === 3 && method === 'GET') return staffWorkflows.listSupportNotes(user, segment(2), Object.fromEntries(getRequestURL(event).searchParams));
    if (segment(1) === 'support-notes' && parts.length === 3 && method === 'POST') return staffWorkflows.appendSupportNote(user, segment(2), await readBody(event));
    if (path === 'admin/credential-batches' && method === 'GET') return staffWorkflows.listCredentialBatches(user, Object.fromEntries(getRequestURL(event).searchParams));
    if (path === 'admin/credential-batches' && method === 'POST') return staffWorkflows.previewCredentialBatch(user, await readBody(event));
    if (segment(1) === 'credential-batches' && parts.length === 3 && method === 'GET') return staffWorkflows.getCredentialBatch(user, segment(2));
    if (segment(1) === 'credential-batches' && segment(3) === 'commit' && parts.length === 4 && method === 'POST') return staffWorkflows.commitCredentialBatch(user, segment(2), await readBody(event));
    if (path === 'admin/incidents' && method === 'GET') { requireStaff(['finance', 'issuer']); return incidents.listIncidents(user, Object.fromEntries(getRequestURL(event).searchParams)); }
    if (segment(1) === 'incidents' && parts.length === 3 && method === 'POST') { requireStaff(['finance', 'issuer']); return incidents.transitionIncident(user, segment(2), await readBody(event)); }
    if (path === 'admin/invoices' && method === 'GET') return invoices.listFinanceInvoices(user);
    if (segment(1) === 'invoices' && segment(3) === 'confirm' && parts.length === 4 && method === 'POST') return invoices.confirmInvoice(user, segment(2), await readBody(event));
    if (path === 'admin/operations' && method === 'GET') { const staff = requireStaff(['editor', 'reviewer', 'instructor', 'issuer', 'finance']); return operations.operationsOverview(staff); }
    if (path === 'admin/organizations' && method === 'POST') { requireStaff(['admin']); return organizations.createOrganization(user.id, await readBody(event)); }
    if (segment(1) === 'outbox' && segment(3) === 'retry' && parts.length === 4 && method === 'POST') { requireStaff(['admin']); return operations.retryJob(user.id, segment(2), (await readBody(event))?.reason || ''); }
    if (path === 'admin/operations/tick' && method === 'POST') { requireStaff(['admin']); return operations.runOperationalTick({ allowExternal: true }); }
    if (segment(1) === 'orders' && segment(3) === 'refund' && parts.length === 4 && method === 'POST') { requireStaff(['finance']); return commerce.refundOrder(segment(2), user.id, (await readBody(event))?.reason || ''); }
    if (path === 'admin/credential-templates' && method === 'GET') { requireStaff(['issuer', 'reviewer']); return { templates: await queryAll('SELECT id,name,program_id AS programId,status,created_by AS createdBy FROM credential_templates ORDER BY created_at DESC LIMIT 100') }; }
    if (path === 'admin/credential-templates' && method === 'POST') { requireStaff(['issuer']); return credentials.createCredentialTemplate(user.id, await readBody(event)); }
    if (segment(1) === 'credential-templates' && segment(3) === 'preview' && parts.length === 4 && method === 'GET') {
      requireStaff(['issuer', 'reviewer']);
      const template = await queryOne('SELECT pdf_base64 FROM credential_templates WHERE id=?', [segment(2)]);
      if (!template) fail(404, 'TEMPLATE_NOT_FOUND');
      setHeader(event, 'Content-Type', 'application/pdf');
      setHeader(event, 'Content-Disposition', 'inline; filename="template-preview.pdf"');
      return Buffer.from(template.pdf_base64, 'base64');
    }
    if (segment(1) === 'credential-templates' && segment(3) === 'approve' && parts.length === 4 && method === 'POST') { requireStaff(['reviewer']); return credentials.approveCredentialTemplate(user.id, segment(2), (await readBody(event))?.reason || ''); }
    if (path === 'admin/credentials' && method === 'POST') { requireStaff(['issuer']); const body = await readBody(event); return credentials.issueCredential(user.id, body?.enrollmentId || '', body?.reason || '', body?.supersedesId || null); }
    if (segment(1) === 'credentials' && segment(3) === 'repair' && parts.length === 4 && method === 'POST') { requireStaff(['issuer']); return credentials.repairPendingCredential(user, segment(2), await readBody(event)); }
    if (segment(1) === 'credentials' && segment(3) === 'revoke' && parts.length === 4 && method === 'POST') { requireStaff(['issuer']); return credentials.revokeCredential(user.id, segment(2), (await readBody(event))?.reason || ''); }
  }
  fail(404, 'ENDPOINT_NOT_FOUND');
});
