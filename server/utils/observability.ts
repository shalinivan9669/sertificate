import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setHeader, setResponseStatus, type H3Event } from 'h3';

export type ObservationContext = Readonly<{ requestId: string; correlationId: string; originRequestId: string | null; sourceJobId: string | null }>;
const storage = new AsyncLocalStorage<ObservationContext>();
const trustedDomainErrors = new WeakMap<object, string>();
/** Only our domain constructors call this with static application codes. Never use SDK error strings. */
export function markDomainError<T extends Error>(error: T, code: string): T { trustedDomainErrors.set(error, code); return error; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeId = (value: unknown) => typeof value === 'string' && value.length === 36 && uuid.test(value) ? value.toLowerCase() : null;

/** Caller headers are intentionally not accepted: even a valid external UUID cannot impersonate another request. */
export function newRequestContext(): ObservationContext {
  const requestId = randomUUID();
  return Object.freeze({ requestId, correlationId: requestId, originRequestId: requestId, sourceJobId: null });
}
export function currentObservation() { return storage.getStore(); }
export function runWithObservation<T>(context: ObservationContext, callback: () => T): T {
  const requestId = safeId(context.requestId) || randomUUID();
  return storage.run(Object.freeze({ requestId, correlationId: safeId(context.correlationId) || requestId,
    originRequestId: safeId(context.originRequestId), sourceJobId: safeId(context.sourceJobId) }), callback);
}
export function jobObservation(job: { id?: unknown; correlation_id?: unknown; request_id?: unknown; origin_request_id?: unknown }): ObservationContext {
  return Object.freeze({ requestId: randomUUID(), correlationId: safeId(job.correlation_id) || safeId(job.id) || randomUUID(),
    originRequestId: safeId(job.origin_request_id) || safeId(job.request_id), sourceJobId: safeId(job.id) });
}
export type RequestObservation = { context: ObservationContext; started: number; failureObserved: boolean };
export function eventObservation(event: H3Event): RequestObservation {
  return event.context.observation ||= { context: newRequestContext(), started: performance.now(), failureObserved: false };
}
const publicErrorFields = new Set(['name', 'email', 'phone', 'password', 'newPassword', 'title', 'language', 'programId', 'versionId', 'userId', 'organizationId', 'reason', 'evidence', 'revision', 'selectedOptionIds', 'accessUntil', 'renewalDate', 'timezone', 'offsetDays', 'date', 'amountMinor', 'currency', 'reference', 'pdfBase64', 'fontBase64', 'fieldMap', 'buyer', 'userIds', 'data', 'csv', 'text']);
export function safeApiFailure(event: H3Event, error: unknown) {
  const input = error as { statusCode?: unknown; code?: unknown; data?: { fieldErrors?: unknown } } | null;
  const statusCode = typeof input?.statusCode === 'number' && Number.isInteger(input.statusCode) && input.statusCode >= 400 && input.statusCode <= 599 ? input.statusCode : 500;
  const marked = error && typeof error === 'object' ? trustedDomainErrors.get(error) : undefined;
  const knownConfiguration = typeof input?.code === 'string' && ['DATABASE_NOT_CONFIGURED', 'DATABASE_FOREIGN_KEYS_REQUIRED', 'AUTH_NOT_CONFIGURED'].includes(input.code) ? input.code : undefined;
  const code = marked || knownConfiguration || safeHttpCode(statusCode);
  const supplied = marked ? input?.data?.fieldErrors : undefined;
  const fieldErrors = supplied && typeof supplied === 'object' ? Object.fromEntries(Object.keys(supplied).filter(key => publicErrorFields.has(key)).map(key => [key, ['Invalid value']])) : {};
  return { statusCode, statusMessage: code, message: code, data: { code, message: code, requestId: eventObservation(event).context.requestId, ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}) } };
}
export function applySafeApiFailure(event: H3Event, error: unknown) {
  const payload = safeApiFailure(event, error);
  setResponseStatus(event, payload.statusCode, payload.statusMessage);
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8');
  return payload;
}
export function runWithRequestObservation<T>(event: H3Event, callback: () => T | Promise<T>): Promise<T | Response> {
  return runWithObservation(eventObservation(event).context, async () => {
    try {
      const result = await callback();
      // H3 runs beforeResponse before unwrapping a Web Response. Handled SDK
      // failures (e.g. Better Auth 401) otherwise look like the event default 200
      // to observers. Preserve the exact Response, including body and cookies.
      if (result instanceof Response && result.status >= 200 && result.status <= 599) setResponseStatus(event, result.status);
      return result;
    }
    catch (error) {
      // Do not pass private URLs/messages/stacks into Nitro's generic error page/logger.
      const payload = applySafeApiFailure(event, error);
      return new Response(JSON.stringify(payload), { status: payload.statusCode, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
  });
}

const routePatterns = [
  [/^\/api\/v1\/attempts\/[^/]+\/answers(?:\/[^/]+)?$/, '/api/v1/attempts/:id/answers'],
  [/^\/api\/v1\/attempts(?:\/[^/]+(?:\/submit)?)?$/, '/api/v1/attempts/:id'],
  [/^\/api\/v1\/enrollments(?:\/[^/]+(?:\/lessons\/[^/]+(?:\/complete)?|\/attempts)?)?$/, '/api/v1/enrollments/:id'],
  [/^\/api\/v1\/verify\/[^/]+$/, '/api/v1/verify/:token'],
  [/^\/api\/v1\/orders(?:\/[^/]+(?:\/checkout)?)?$/, '/api/v1/orders/:id'],
  [/^\/api\/v1\/credentials(?:\/[^/]+(?:\/download)?)?$/, '/api/v1/credentials/:id'],
  [/^\/api\/v1\/organizations(?:\/.*)?$/, '/api/v1/organizations/:id'],
  [/^\/api\/v1\/admin(?:\/.*)?$/, '/api/v1/admin/:operation'],
  [/^\/api\/v1\/me(?:\/.*)?$/, '/api/v1/me/:resource'],
  [/^\/api\/auth(?:\/.*)?$/, '/api/auth/:operation'],
  [/^\/api\/(?:v1\/)?leads$|^\/api\/amo-lead$/, '/api/leads'],
  [/^\/api\/v1\/payments\/webhook$/, '/api/v1/payments/webhook'],
  [/^\/api\/v1\/operations\/tick$/, '/api/v1/operations/tick'],
  [/^\/api\/v1\/analytics$/, '/api/v1/analytics'],
  [/^\/api\/v1\/analytics\/journey$/, '/api/v1/analytics/journey'],
  [/^\/api\/v1\/analytics\/journey\/authenticated$/, '/api/v1/analytics/journey/authenticated'],
  [/^\/api\/v1\/catalog\/programs(?:\/[^/]+)?$/, '/api/v1/catalog/programs/:id'],
  [/^\/api\/health$/, '/api/health'], [/^\/api\/ready$/, '/api/ready'],
] as const;
export function safeRoute(path: unknown): string {
  if (typeof path !== 'string' || path.length > 4096) return '/api/:unmatched';
  const pathname = path.split(/[?#]/, 1)[0] || '';
  return routePatterns.find(([pattern]) => pattern.test(pathname))?.[1] || '/api/:unmatched';
}
const deliveryCodes = new Set(['EXTERNAL_DELIVERY_DISABLED', 'EMAIL_DELIVERY_NOT_CONFIGURED', 'OPERATIONAL_ALERT_DELIVERY_DISABLED',
  'OPERATIONAL_ALERT_RECIPIENT_NOT_CONFIGURED', 'JOB_HANDLER_NOT_CONFIGURED', 'CREDENTIAL_NOT_FOUND', 'CREDENTIAL_NOT_PENDING',
  'CREDENTIAL_TEMPLATE_NOT_FOUND', 'CREDENTIAL_TEMPLATE_NOT_APPROVED', 'TEMPLATE_FONT_REQUIRED', 'TEMPLATE_FIELD_MISSING',
  'CREDENTIAL_RENDER_CONFLICT', 'CREDENTIAL_RENDER_FAILED', 'CRM_NOT_CONFIGURED', 'CRM_UNAVAILABLE', 'CRM_TIMEOUT',
  'CRM_REQUEST_FAILED', 'CRM_TOKEN_EXPIRED', 'CRM_RATE_LIMITED', 'INVALID_REQUEST', 'DELIVERY_FAILED', 'UNICODE_TEMPLATE_FONT_REQUIRED',
  'APPROVED_DOCUMENT_TEMPLATE_REQUIRED', 'QR_OUTSIDE_PAGE', 'DOCUMENT_EXCEEDS_STORAGE_BUDGET', 'CREDENTIAL_RENDER_SNAPSHOT_CHANGED',
  'CRM_CONFIG_INVALID', 'CRM_LOOKUP_FAILED', 'CRM_CREATE_FAILED', 'CRM_INVALID_RESPONSE', 'CRM_NOTE_LOOKUP_FAILED', 'CRM_NOTE_FAILED']);
/** Never allow arbitrary messages or uppercase strings to become operational codes. */
export function safeDeliveryCode(error: unknown) {
  const value = (error as { statusMessage?: unknown } | null)?.statusMessage;
  return typeof value === 'string' && deliveryCodes.has(value) ? value : 'DELIVERY_FAILED';
}
const incidentCodes = new Set(['RENDER_FAILED', 'QUEUE_PENDING_TOO_LONG', 'CRM_DELIVERY_OVERDUE', 'CREDENTIAL_PENDING_TOO_LONG',
  'PAYMENT_RECONCILIATION_REQUIRED', 'INVALID_SIGNATURE', 'WEBHOOK_EXPIRED', 'PAYMENT_MISMATCH', 'EVENT_CONFLICT']);
export function safeOperationalCode(value: unknown) {
  return typeof value === 'string' && (incidentCodes.has(value) || deliveryCodes.has(value)) ? value : 'UNCLASSIFIED';
}
export function safeHttpCode(status: number) {
  if (status === 401) return 'AUTHENTICATION_REQUIRED'; if (status === 403) return 'ACCESS_DENIED';
  if (status === 404) return 'RESOURCE_NOT_FOUND'; if (status === 409) return 'STATE_CONFLICT';
  if (status === 413) return 'BODY_TOO_LARGE'; if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_REQUEST_FAILED'; return 'REQUEST_REJECTED';
}
type LogInput = { event: 'api_failure' | 'outbox_delivered' | 'outbox_cancelled' | 'outbox_failed' | 'telemetry_write_failed'; context?: ObservationContext;
  route?: string; method?: string; status?: number; elapsedMs?: number; code?: string };
export function safeLogRecord(input: LogInput) {
  const context = input.context || currentObservation();
  const status = typeof input.status === 'number' && Number.isInteger(input.status) && input.status >= 100 && input.status <= 599 ? input.status : undefined;
  const event = ['api_failure', 'outbox_delivered', 'outbox_cancelled', 'outbox_failed', 'telemetry_write_failed'].includes(input.event) ? input.event : 'telemetry_write_failed';
  const code = event === 'api_failure' ? safeHttpCode(status || 500) : event === 'telemetry_write_failed' ? 'OBSERVATION_UNAVAILABLE'
    : event === 'outbox_delivered' ? 'DELIVERED' : event === 'outbox_cancelled' ? 'CANCELLED' : safeDeliveryCode({ statusMessage: input.code });
  return { schemaVersion: 1, event, requestId: safeId(context?.requestId), correlationId: safeId(context?.correlationId),
    originRequestId: safeId(context?.originRequestId), sourceJobId: safeId(context?.sourceJobId),
    ...(input.route !== undefined ? { route: safeRoute(input.route) } : {}),
    ...(input.method !== undefined ? { method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(input.method) ? input.method : 'OTHER' } : {}),
    ...(status !== undefined ? { status } : {}), errorCode: code,
    ...(typeof input.elapsedMs === 'number' && Number.isFinite(input.elapsedMs) ? { elapsedMs: Math.max(0, Math.min(3600000, Math.round(input.elapsedMs))) } : {}) };
}
export function logObservation(input: LogInput) { try { console.info(JSON.stringify(safeLogRecord(input))); } catch { /* A failing log sink must not change a domain result. */ } }
