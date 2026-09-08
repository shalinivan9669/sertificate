import { defineEventHandler, setHeader, toWebRequest, getHeader } from 'h3';
import { authConfiguration, getAuth, withAuthMailContext } from '../../services/auth';
import { fail } from '../../utils/validation';
import { runWithRequestObservation } from '../../utils/observability';

export default defineEventHandler(event => runWithRequestObservation(event, async () => {
  setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  if (Number(getHeader(event, 'content-length') || 0) > 20_000) fail(413, 'BODY_TOO_LARGE', 'Authentication request is too large');
  const { result, userIds } = await withAuthMailContext(async () => (await getAuth()).handler(toWebRequest(event)));
  if (result.ok && authConfiguration().emailDeliveryConfigured && userIds.length) {
    // One request-scoped delivery attempt; durable outbox remains available for safe retries.
    const delivery = import('../../services/operations').then(async ({ processOutbox }) => {
      for (const aggregateId of userIds) await processOutbox({ limit: 1, budgetMs: 15_000, aggregateId, allowExternal: true });
    }).catch(() => {});
    const lifecycle = event as typeof event & { waitUntil?: (promise: Promise<unknown>) => void };
    if (lifecycle.waitUntil) lifecycle.waitUntil(delivery);
    else await delivery;
  }
  return result;
}));
