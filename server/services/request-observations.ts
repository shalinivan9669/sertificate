import { databaseConfigured, execute } from '../db';
import { eventObservation, logObservation, safeRoute } from '../utils/observability';
import type { H3Event } from 'h3';

type CounterWriter = (metrics: readonly string[]) => Promise<unknown>;
async function persistCounters(metrics: readonly string[]) {
  if (!databaseConfigured()) return;
  const day = new Date().toISOString().slice(0, 10);
  // At most one statement per failed response; no reads, new per-user records or success-path writes.
  await execute(`INSERT INTO operational_counters(day,metric,count) VALUES ${metrics.map(() => '(?,?,1)').join(',')}
    ON CONFLICT(day,metric) DO UPDATE SET count=MIN(count+1,2147483647)`, metrics.flatMap(metric => [day, metric]));
}
/** Best-effort observation must never turn a committed response into a failure or retry. */
export async function observeApiResponse(event: H3Event, status: number, writer: CounterWriter = persistCounters) {
  if (!event.path.startsWith('/api/') || !Number.isInteger(status) || status < 400 || status > 599) return;
  const observation = eventObservation(event);
  if (observation.failureObserved) return;
  observation.failureObserved = true;
  const route = safeRoute(event.path);
  const method = event.method;
  logObservation({ event: 'api_failure', context: observation.context, route, method, status, elapsedMs: performance.now() - observation.started });
  const metrics = ['api_error'];
  if (route === '/api/v1/attempts/:id/answers' && ['PUT', 'POST', 'PATCH'].includes(method)) metrics.push('autosave_failure');
  try { await writer(metrics); }
  catch { logObservation({ event: 'telemetry_write_failed', context: observation.context, route, method }); }
}
