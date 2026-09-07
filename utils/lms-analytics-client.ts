import { clientAnalyticsEvents, safeClientAnalyticsDimensions, type ClientAnalyticsDimensions } from '../shared/analytics';

export { analyticsConsentVersion } from '../shared/analytics';
export const analyticsClientEvents = clientAnalyticsEvents;
export type AnalyticsClientEvent = typeof analyticsClientEvents[number];
export type AnalyticsDimensions = Partial<Record<keyof ClientAnalyticsDimensions, string>>;
export interface AnalyticsEnvelope { id: string; name: AnalyticsClientEvent; dimensions: AnalyticsDimensions }

/** Copy known scalar values only. Never copy query strings, forms, identifiers or free text. */
export function analyticsDimensions(input: AnalyticsDimensions): ClientAnalyticsDimensions {
  return safeClientAnalyticsDimensions(input as ClientAnalyticsDimensions);
}

/** One active request and at most 20 events total; memory only and a 60-second lifetime. */
export function createAnalyticsQueue(options: {
  allowed: () => boolean;
  send: (event: AnalyticsEnvelope, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}) {
  const now = options.now || Date.now;
  const schedule = options.schedule || setTimeout;
  const cancel = options.cancel || clearTimeout;
  const items: Array<{ event: AnalyticsEnvelope; expires: number; attempts: number }> = [];
  let active: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  function clear() {
    generation++;
    items.length = 0;
    active?.abort(); active = undefined;
    if (retryTimer) cancel(retryTimer);
    retryTimer = undefined;
  }
  async function flush() {
    if (active || retryTimer) return;
    if (!options.allowed()) { clear(); return; }
    while (items[0] && items[0].expires <= now()) items.shift();
    const item = items[0]; if (!item) return;
    const currentGeneration = generation;
    const controller = new AbortController(); active = controller;
    const deadline = schedule(() => controller.abort(), Math.min(8000, item.expires - now()));
    item.attempts++;
    let failed = false;
    try { await options.send(item.event, controller.signal); } catch { failed = true; }
    finally { cancel(deadline); }
    if (generation !== currentGeneration) return;
    active = undefined;
    if (!options.allowed()) { clear(); return; }
    if (failed && item.attempts < 2 && item.expires > now() + 1000) {
      retryTimer = schedule(() => { retryTimer = undefined; void flush(); }, 1000);
      return;
    }
    items.shift(); void flush();
  }
  return {
    enqueue(event: AnalyticsEnvelope) {
      if (!options.allowed() || !analyticsClientEvents.includes(event.name) || items.length >= 20) return false;
      items.push({ event: { id: event.id, name: event.name, dimensions: analyticsDimensions(event.dimensions) }, expires: now() + 60_000, attempts: 0 });
      void flush(); return true;
    },
    clear,
    size: () => items.length,
  };
}
