import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createPublicJourneyTracker } from '../utils/public-journey-client';
import { publicJourneyContext, journeyStorageKey, journeyLifetimeMs, type JourneyEvent } from '../shared/lead-attribution';

function fixture() {
  const data = new Map<string, string>(); let reads = 0, writes = 0;
  const storage = { getItem(key: string) { reads++; return data.get(key) || null; }, setItem(key: string, value: string) { writes++; data.set(key, value); }, removeItem(key: string) { data.delete(key); } };
  return { data, storage, reads: () => reads, writes: () => writes };
}
const context = (path = '/') => publicJourneyContext(path, {}, 'direct')!;

test('no consent means no storage read/write, UUID creation, request or lead reference', async () => {
  const store = fixture(); let requests = 0, ids = 0;
  const tracker = createPublicJourneyTracker({ storage: store.storage, allowed: () => false, uuid: () => { ids++; return randomUUID(); }, send: async () => { requests++; return { accepted: true }; } });
  assert.equal(tracker.observe(context()), false); assert.equal(tracker.reference(), undefined); await tracker.flush();
  assert.equal(requests, 0); assert.equal(ids, 0); assert.equal(store.reads(), 0); assert.equal(store.writes(), 0);
});

test('landing → program → consultation uses one per-tab ID, increasing sequences and exact event retry after ambiguous response', async () => {
  const store = fixture(), sent: JourneyEvent[] = [];
  const tracker = createPublicJourneyTracker({ storage: store.storage, allowed: () => true, send: async event => {
    sent.push(structuredClone(event)); if (sent.length === 1) throw new Error('SYNTHETIC_LOST_RESPONSE'); return { accepted: true };
  } });
  tracker.observe(context()); await tracker.flush();
  tracker.observe(context('/courses/ohrana-truda')); await tracker.flush();
  tracker.observe(context('/contacts')); await tracker.flush();
  assert.equal(sent.length, 4); assert.deepEqual(sent[0], sent[1]);
  assert.deepEqual(sent.slice(1).map(item => item.step), ['landing', 'program', 'consultation']);
  assert.deepEqual(sent.slice(1).map(item => item.sequence), [1, 2, 3]);
  assert.equal(new Set(sent.map(item => item.journeyId)).size, 1);
  assert.deepEqual(tracker.reference(), { journeyId: sent[0]!.journeyId });
  assert.ok(!store.data.get(journeyStorageKey)?.includes('email'));
});

test('withdrawal aborts an in-flight send, clears persisted/pending state, and a later opt-in has a fresh ID', async () => {
  const store = fixture(); let allowed = true, aborted = false; const sent: JourneyEvent[] = [];
  const tracker = createPublicJourneyTracker({ storage: store.storage, allowed: () => allowed, send: (event, signal) => {
    sent.push(event);
    if (sent.length > 1) return Promise.resolve({ accepted: true });
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true }));
  } });
  tracker.observe(context()); const pending = tracker.flush();
  allowed = false; tracker.clear(); await pending;
  assert.equal(aborted, true); assert.equal(tracker.reference(), undefined); assert.equal(store.data.size, 0);
  allowed = true; tracker.observe(context('/contacts')); await tracker.flush();
  assert.notEqual(sent[0]!.journeyId, sent[1]!.journeyId); assert.equal(sent[1]!.sequence, 1);
});

test('ordinary reload restores the tab context, a new tab has another ID, and 24-hour expiry starts a new bounded path', async () => {
  const store = fixture(); let now = Date.now();
  const options = { storage: store.storage, allowed: () => true, now: () => now, send: async () => ({ accepted: true }) };
  const first = createPublicJourneyTracker(options); first.observe(context()); await first.flush();
  const id = first.reference()!.journeyId;
  const reloaded = createPublicJourneyTracker(options); assert.equal(reloaded.restore()!.journeyId, id);
  reloaded.observe(context('/contacts')); await reloaded.flush();
  assert.equal(JSON.parse(store.data.get(journeyStorageKey)!).sequence, 2);
  const other = createPublicJourneyTracker({ ...options, storage: fixture().storage }); other.observe(context()); await other.flush();
  assert.notEqual(other.reference()!.journeyId, id);
  now += journeyLifetimeMs;
  reloaded.observe(context('/courses/ohrana-truda')); await reloaded.flush();
  assert.notEqual(reloaded.reference()!.journeyId, id);
});

test('malformed/private storage state and rejected raw context never reach the transport', async () => {
  const store = fixture(); store.data.set(journeyStorageKey, JSON.stringify({ version: 1, journeyId: randomUUID(), startedAt: Date.now(), sequence: 1, pending: [], email: 'PRIVATE@example.test' }));
  const sent: JourneyEvent[] = [];
  const tracker = createPublicJourneyTracker({ storage: store.storage, allowed: () => true, send: async event => { sent.push(event); return { accepted: true }; } });
  assert.equal(tracker.observe({ ...context(), email: 'PRIVATE@example.test' } as ReturnType<typeof context>), false);
  tracker.observe(context()); await tracker.flush();
  assert.equal(sent.length, 1); assert.ok(!JSON.stringify(sent).includes('PRIVATE')); assert.ok(!store.data.get(journeyStorageKey)?.includes('PRIVATE'));
});

test('64-step bound stops collection; storage denial and a disabled server degrade without unbounded retry', async () => {
  let calls = 0;
  const tracker = createPublicJourneyTracker({ storage: fixture().storage, allowed: () => true, send: async () => { calls++; return { accepted: true }; } });
  for (let index = 0; index < 70; index++) { tracker.observe(context(index % 2 ? '/contacts' : '/')); await tracker.flush(); }
  assert.equal(calls, 64);
  const denied = createPublicJourneyTracker({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } }, allowed: () => true, send: async () => ({ accepted: false }) });
  assert.doesNotThrow(() => denied.observe(context())); await denied.flush(); assert.equal(denied.reference(), undefined);
});

test('a stalled request retains at most 20 pending events and flushes those exact accepted entries', async () => {
  const store = fixture(); let release: (() => void) | undefined; let calls = 0;
  const tracker = createPublicJourneyTracker({ storage: store.storage, allowed: () => true, send: async () => {
    calls++; if (calls === 1) await new Promise<void>(resolve => { release = resolve; }); return { accepted: true };
  } });
  for (let index = 0; index < 25; index++) tracker.observe(context(index % 2 ? '/contacts' : '/'));
  assert.equal(JSON.parse(store.data.get(journeyStorageKey)!).pending.length, 20);
  release!(); await tracker.flush(); assert.equal(calls, 20);
});

test('different selection outcomes with identical context remain separate steps, while exact repeated outcomes deduplicate', async () => {
  const sent: JourneyEvent[] = [];
  const tracker = createPublicJourneyTracker({ storage: fixture().storage, allowed: () => true, send: async event => { sent.push(event); return { accepted: true }; } });
  const selection = { routeId: 'selection' as const, locale: 'ru' as const, source: 'internal' as const, programId: 'ohrana-truda' };
  for (const step of ['selection_start', 'selection_matched', 'selection_unmatched', 'selection_unmatched'] as const) { tracker.observe(selection, step); await tracker.flush(); }
  assert.deepEqual(sent.map(item => item.step), ['selection_start', 'selection_matched', 'selection_unmatched']);
});

test('reactive source-only re-observation preserves the first touch; real context changes and a return visit still count', async () => {
  const sent: JourneyEvent[] = [];
  const tracker = createPublicJourneyTracker({ storage: fixture().storage, allowed: () => true, send: async event => { sent.push(event); return { accepted: true }; } });
  assert.equal(tracker.observe(context()), true); await tracker.flush();
  assert.equal(tracker.observe({ ...context(), source: 'internal' }), false); await tracker.flush();
  assert.equal(sent.length, 1); assert.equal(sent[0]!.context.source, 'direct');
  assert.equal(tracker.observe({ ...context('/courses/ohrana-truda'), source: 'internal' }), true); await tracker.flush();
  assert.equal(tracker.observe({ ...context(), source: 'internal' }), true); await tracker.flush();
  assert.deepEqual(sent.map(item => item.sequence), [1, 2, 3]);
  assert.deepEqual(sent.map(item => item.context.routeId), ['home', 'program', 'home']);
  assert.deepEqual(sent.map(item => item.context.source), ['direct', 'internal', 'internal']);
});
