import { z } from 'zod';
import { journeyContextSchema, journeyEventSchema, journeyLifetimeMs, journeyStep, journeyStorageKey, journeySteps, validJourneyStep, type JourneyContext, type JourneyEvent, type JourneyStep } from '../shared/lead-attribution';

const stateSchema = z.object({
  version: z.literal(1), journeyId: z.string().uuid({ version: 'v4' }), startedAt: z.number().int(), sequence: z.number().int().min(0).max(64),
  last: journeyContextSchema.optional(), lastStep: z.enum(journeySteps).optional(), pending: z.array(journeyEventSchema).max(20),
}).strict();
type State = z.infer<typeof stateSchema>;

/** Per-tab state only, after consent. Network errors retry the exact event once; bounded loss is explicit. */
export function createPublicJourneyTracker(options: {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  allowed: () => boolean; send: (event: JourneyEvent, signal: AbortSignal) => Promise<{ accepted: boolean }>;
  uuid?: () => string; now?: () => number;
}) {
  const now = options.now || Date.now, uuid = options.uuid || (() => crypto.randomUUID());
  let state: State | undefined, active: Promise<void> | undefined, controller: AbortController | undefined;
  let generation = 0;
  function save() { try { if (state && options.allowed()) options.storage.setItem(journeyStorageKey, JSON.stringify(state)); } catch { /* Storage denial keeps the optional journey in memory. */ } }
  function clear() {
    generation++; controller?.abort(); controller = undefined; state = undefined; active = undefined;
    try { options.storage.removeItem(journeyStorageKey); } catch { /* No storage is a supported privacy choice. */ }
  }
  function current() {
    if (!options.allowed()) return undefined;
    if (!state) {
      try {
        const parsed = stateSchema.safeParse(JSON.parse(options.storage.getItem(journeyStorageKey) || 'null'));
        if (parsed.success && parsed.data.startedAt <= now() && now() - parsed.data.startedAt < journeyLifetimeMs
          && parsed.data.pending.every(event => event.journeyId === parsed.data.journeyId && event.sequence <= parsed.data.sequence)) state = parsed.data;
      } catch { /* Malformed/expired local state never enters a request. */ }
      state ||= { version: 1, journeyId: uuid(), startedAt: now(), sequence: 0, pending: [] };
    }
    if (now() - state.startedAt >= journeyLifetimeMs) { clear(); return current(); }
    return state;
  }
  async function drain() {
    const ownGeneration = generation;
    while (state?.pending.length && options.allowed() && generation === ownGeneration) {
      const event = state.pending[0]!;
      let accepted = false;
      for (let attempt = 0; attempt < 2 && options.allowed() && generation === ownGeneration; attempt++) {
        controller = new AbortController();
        const timer = setTimeout(() => controller?.abort(), 3000);
        try { accepted = (await options.send(event, controller.signal)).accepted; if (!accepted) { clear(); return; } break; }
        catch { /* A retry carries the same UUID and sequence. No client success stage is invented. */ }
        finally { clearTimeout(timer); }
      }
      if (generation !== ownGeneration || !state) return;
      // Exhausted best-effort events are dropped; the report can only count server-received stages.
      state.pending.shift(); save();
      if (!accepted) break;
    }
    if (!options.allowed()) clear();
  }
  function flush() {
    if (!options.allowed()) { clear(); return Promise.resolve(); }
    if (!active) {
      const ownGeneration = generation;
      active = drain().finally(() => { if (generation === ownGeneration) { active = undefined; controller = undefined; } });
    }
    return active;
  }
  return {
    observe(input: JourneyContext, explicitStep?: JourneyStep) {
      const parsed = journeyContextSchema.safeParse(input); if (!parsed.success) return false;
      const step = explicitStep || journeyStep(parsed.data);
      if (!validJourneyStep(step, parsed.data)) return false;
      const value = current(); if (!value || value.sequence >= 64 || value.pending.length >= 20) return false;
      // Reactive route/query normalization may observe the same page again with source=internal.
      // Keep its first source; only a changed allowed page context or explicit step adds a touch.
      const last = value.last, next = parsed.data;
      if (last && value.lastStep === step && last.routeId === next.routeId && last.locale === next.locale
        && last.programId === next.programId && last.city === next.city && last.format === next.format) { void flush(); return false; }
      value.sequence++; value.last = parsed.data; value.lastStep = step;
      value.pending.push({ id: uuid(), journeyId: value.journeyId, sequence: value.sequence, step, context: parsed.data });
      save(); void flush(); return true;
    },
    // Merely opening a form never creates a journey. A reference exists only after an observed public route.
    reference() {
      if (state && now() - state.startedAt >= journeyLifetimeMs) clear();
      return options.allowed() && state?.sequence ? { journeyId: state.journeyId } : undefined;
    },
    restore() { const value = current(); return value?.sequence ? { journeyId: value.journeyId } : undefined; },
    flush, clear,
  };
}
