import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsDimensions, createAnalyticsQueue, type AnalyticsEnvelope } from '../utils/lms-analytics-client';

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));
const event = (id = 'd3de8df5-56cd-4ec0-b59d-f0cc59448749'): AnalyticsEnvelope => ({ id, name: 'program_view', dimensions: { programId: 'ohrana-truda', locale: 'ru' } });

test('client dimensions retain only known enums and drop PII, free text, academic payload and identifiers', () => {
  const unsafe = { programId: 'ohrana-truda', locale: 'kk', city: 'astana', format: 'online', audience: 'b2b', email: 'synthetic@example.test', userId: 'private-user', lessonId: 'private-lesson', answers: ['private-answer'], query: '?secret=private', name: 'Private Name', comment: 'Private message' };
  assert.deepEqual(analyticsDimensions(unsafe), { programId: 'ohrana-truda', locale: 'kk', city: 'astana', format: 'online', audience: 'b2b' });
  assert.deepEqual(analyticsDimensions({ programId: 'unknown@example.test', locale: 'secret', city: 'Private Address', format: 'private', audience: 'private' }), {});
});

test('without consent queue sends nothing and retains no event', async () => {
  let calls = 0;
  const queue = createAnalyticsQueue({ allowed: () => false, send: async () => { calls++; } });
  assert.equal(queue.enqueue(event()), false);
  await nextTurn(); assert.equal(calls, 0); assert.equal(queue.size(), 0);
});

test('queue retries a transient failure at most once using the same event id and payload', async () => {
  const sent: AnalyticsEnvelope[] = [];
  const queue = createAnalyticsQueue({ allowed: () => true, send: async value => { sent.push(value); throw new Error('Synthetic network failure'); }, schedule: (callback, delay) => setTimeout(callback, delay === 1000 ? 1 : delay) });
  assert.equal(queue.enqueue(event()), true);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(sent.length, 2); assert.deepEqual(sent[0], sent[1]); assert.equal(queue.size(), 0);
});

test('withdrawal aborts the active request, discards the bounded queue and cancels further sends', async () => {
  let permitted = true; let calls = 0; let aborted = false;
  const queue = createAnalyticsQueue({ allowed: () => permitted, send: (_value, signal) => new Promise((_resolve, reject) => {
    calls++; signal.addEventListener('abort', () => { aborted = true; reject(new Error('Aborted')); }, { once: true });
  }) });
  for (let i = 0; i < 20; i++) assert.equal(queue.enqueue(event(String(i))), true);
  assert.equal(queue.enqueue(event('overflow')), false); assert.equal(queue.size(), 20);
  permitted = false; queue.clear(); await nextTurn();
  assert.equal(aborted, true); assert.equal(queue.size(), 0); assert.equal(calls, 1);
  assert.equal(queue.enqueue(event('after-withdrawal')), false);
});

test('expired queued events never send after a slow request finishes', async () => {
  let time = 0; let finish!: () => void; let calls = 0;
  const queue = createAnalyticsQueue({ allowed: () => true, now: () => time, send: () => { calls++; return new Promise<void>(resolve => { finish = resolve; }); } });
  queue.enqueue(event()); queue.enqueue(event('waiting'));
  time = 60_001; finish(); await nextTurn();
  assert.equal(calls, 1); assert.equal(queue.size(), 0);
});

test('withdrawal clears a scheduled retry and does not replay it after a new opt-in', async () => {
  let permitted = true; let calls = 0;
  const queue = createAnalyticsQueue({ allowed: () => permitted, send: async () => { calls++; throw new Error('Synthetic error'); }, schedule: (callback, delay) => setTimeout(callback, delay === 1000 ? 20 : delay) });
  queue.enqueue(event()); await nextTurn();
  permitted = false; queue.clear(); permitted = true;
  await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(calls, 1); assert.equal(queue.size(), 0);
});
