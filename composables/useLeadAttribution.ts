import { analyticsConsentVersion, analyticsCookieName } from '~/shared/analytics';
import { createPublicJourneyTracker } from '~/utils/public-journey-client';
import { publicJourneyContext, journeySource, journeyStorageKey, journeyContextSchema, type JourneyContext, type JourneyStep } from '~/shared/lead-attribution';

let tracker: ReturnType<typeof createPublicJourneyTracker> | undefined;
let ready: Promise<void> | undefined;
let tabChannel: BroadcastChannel | undefined;
let pendingAction: Promise<void> | undefined;
let confirmationAbort: AbortController | undefined;
let observedPath: string | undefined;
export function useLeadAttribution() {
  const analytics = useLmsAnalytics();
  const allowed = () => import.meta.client && analytics.consented.value && analytics.enabled.value
    && document.cookie.split(';').some(value => value.trim() === `${analyticsCookieName}=${analyticsConsentVersion}`);
  function clear() {
    tracker?.clear(); observedPath = undefined;
    confirmationAbort?.abort(); confirmationAbort = undefined;
    // Withdrawal on a newly loaded private/privacy page must also clear state from an earlier page.
    if (import.meta.client) { try { window.sessionStorage.removeItem(journeyStorageKey); } catch { /* Storage may be unavailable. */ } }
  }
  async function getTracker() {
    if (!import.meta.client) return undefined;
    if (tracker) { await ready; return tracker; }
    tracker = createPublicJourneyTracker({
      // Lazy access avoids touching storage at all before the explicit opt-in.
      storage: {
        getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: key => window.sessionStorage.removeItem(key),
      }, allowed,
      send: (body, signal) => $fetch('/api/v1/analytics/journey', { method: 'POST', credentials: 'same-origin', body, signal, retry: 0 }),
    });
    const restored = tracker.restore();
    // A newly duplicated tab may inherit sessionStorage. Active tabs negotiate locally,
    // after consent only, so the duplicate starts a fresh journey instead of merging paths.
    try {
      const tab = crypto.randomUUID();
      tabChannel = new BroadcastChannel('ot-public-journey-v1');
      tabChannel.onmessage = ({ data }) => {
        if (!allowed() || !data || typeof data !== 'object') return;
        const current = tracker?.reference();
        if (data.kind === 'claim' && typeof data.tab === 'string' && current && data.journey === current.journeyId) {
          tabChannel?.postMessage({ kind: 'occupied', tab: data.tab, journey: current.journeyId });
        } else if (data.kind === 'occupied' && data.tab === tab && restored && data.journey === restored.journeyId) tracker?.clear();
      };
      if (restored) {
        tabChannel.postMessage({ kind: 'claim', tab, journey: restored.journeyId });
        ready = new Promise(resolve => setTimeout(resolve, 100));
        await ready;
      }
    } catch {
      // Without local coordination, start fresh after reload rather than merge a copied tab.
      if (restored) tracker.clear();
    }
    return tracker;
  }
  async function observe(path: string, query: Record<string, unknown>) {
    if (!import.meta.client || !analytics.consented.value) { clear(); return; }
    const source: JourneyContext['source'] = observedPath ? 'internal' : journeySource(document.referrer, query.utm_medium, window.location.origin);
    const context = publicJourneyContext(path, query, source);
    if (!context) return;
    await analytics.loadConfig();
    if (!allowed()) { clear(); return; }
    const current = await getTracker();
    if (!allowed()) return;
    current?.observe(context); observedPath = path;
  }
  async function snapshot() {
    if (!allowed()) return undefined;
    // Give queued route receipt a short opportunity; optional telemetry never holds a form indefinitely.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([tracker?.flush(), new Promise<void>(resolve => { timer = setTimeout(resolve, 1500); })]); }
    finally { if (timer) clearTimeout(timer); }
    return allowed() ? tracker?.reference() : undefined;
  }
  function action(step: JourneyStep, input: JourneyContext): Promise<void> {
    pendingAction = (async () => {
      if (!import.meta.client || !analytics.consented.value) return;
      const parsed = journeyContextSchema.safeParse(input); if (!parsed.success) return;
      await analytics.loadConfig(); if (!allowed()) return;
      const current = await getTracker(); if (allowed()) current?.observe(parsed.data, step);
    })();
    return pendingAction;
  }
  async function authenticated() {
    try {
      await pendingAction;
      const reference = await snapshot(); if (!reference || !allowed()) return;
      confirmationAbort = new AbortController();
      await $fetch('/api/v1/analytics/journey/authenticated', { method: 'POST', credentials: 'same-origin', body: reference, signal: confirmationAbort.signal, retry: 0, timeout: 3000 });
    } catch { /* Optional auth telemetry must not change SDK success or navigation. */ }
  }
  return { observe, snapshot, clear, action, authenticated };
}
