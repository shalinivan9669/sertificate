import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryOne } from '../server/db';
import { acceptLead, deliverLead } from '../server/services/leads';
import { confirmPublicJourneyAuth, expireLeadAttribution, leadAttributionNote, recordPublicJourney } from '../server/services/lead-attribution';
import type { AppUser } from '../server/utils/auth';
import { analyticsConsentVersion } from '../shared/analytics';
import { publicJourneyContext, journeySource, type JourneyEvent } from '../shared/lead-attribution';

let directory: string;
const keys = ['OT_DATABASE_PATH', 'OT_MIGRATIONS_DIR', 'NODE_ENV', 'VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OT_ANALYTICS_ENABLED', 'OT_ANALYTICS_RETENTION_DAYS', 'AMO_BASE_URL', 'AMO_ACCESS_TOKEN'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const body = { email: 'PRIVATE_CONTACT_CANARY@example.test', name: 'PRIVATE_NAME_CANARY', organizationName: '' };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-lead-attribution-'));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_ANALYTICS_ENABLED: '1', OT_ANALYTICS_RETENTION_DAYS: '14', AMO_BASE_URL: 'https://crm.example.test', AMO_ACCESS_TOKEN: 'SYNTHETIC_NO_NETWORK' });
  await getDb();
});
after(async () => {
  await closeDb(); const target = resolve(directory);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ot-lead-attribution-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});
function event(journeyId: string = randomUUID(), sequence = 1, path = '/'): JourneyEvent {
  const context = publicJourneyContext(path, {}, sequence === 1 ? 'search' : 'internal')!;
  return { id: randomUUID(), journeyId, sequence, context, step: context.routeId === 'program' ? 'program' : context.routeId === 'contacts' ? 'consultation' : 'landing' };
}
async function journey() {
  const first = event(); const program = event(first.journeyId, 2, '/courses/ohrana-truda'); const consultation = event(first.journeyId, 3, '/contacts');
  for (const item of [first, program, consultation]) await recordPublicJourney(item, analyticsConsentVersion);
  return { first, program, consultation };
}
async function counts() {
  return queryOne('SELECT (SELECT COUNT(*) FROM public_journeys) journeys,(SELECT COUNT(*) FROM public_journey_steps) steps,(SELECT COUNT(*) FROM lead_attributions) sidecars,(SELECT COUNT(*) FROM rate_limits) limits');
}

test('disabled and old/absent consent do not write any journey or limiter record; schema still rejects private fields', async () => {
  const before = await counts(); let calls = 0; const limiter = async () => { calls++; };
  process.env.OT_ANALYTICS_ENABLED = '0';
  assert.deepEqual(await recordPublicJourney(event(), analyticsConsentVersion, limiter), { accepted: false, reason: 'disabled' });
  await assert.rejects(recordPublicJourney({ ...event(), email: body.email }, analyticsConsentVersion, limiter));
  process.env.OT_ANALYTICS_ENABLED = '1';
  for (const consent of [undefined, 'analytics-v1']) assert.deepEqual(await recordPublicJourney(event(), consent, limiter), { accepted: false, reason: 'consent_required' });
  process.env.OT_ANALYTICS_RETENTION_DAYS = '0';
  assert.equal((await recordPublicJourney(event(), analyticsConsentVersion, limiter)).accepted, false);
  process.env.OT_ANALYTICS_RETENTION_DAYS = '14';
  assert.equal(calls, 0); assert.deepEqual(await counts(), before);
});

test('server receipt timestamps, exact event retry, conflict and sequence bound are enforced atomically', async () => {
  const item = event(), now = Date.now();
  await recordPublicJourney(item, analyticsConsentVersion, undefined, now);
  await Promise.all([recordPublicJourney(item, analyticsConsentVersion), recordPublicJourney(item, analyticsConsentVersion)]);
  assert.equal((await queryOne('SELECT COUNT(*) n FROM public_journey_steps WHERE journey_id=?', [item.journeyId]))?.n, 1);
  assert.equal((await queryOne('SELECT created_at FROM public_journey_steps WHERE id=?', [item.id]))?.created_at, new Date(now).toISOString());
  await assert.rejects(recordPublicJourney({ ...item, context: { ...item.context, locale: 'kk' } }, analyticsConsentVersion), (error: any) => error.data.code === 'JOURNEY_EVENT_CONFLICT');
  for (const invalid of [{ ...item, sequence: 65 }, { ...item, journeyId: '550e8400-e29b-11d4-a716-446655440000' }, { ...item, createdAt: '2000-01-01' }, { ...item, step: 'program' }, { ...item, context: { ...item.context, source: body.email } }]) await assert.rejects(recordPublicJourney(invalid, analyticsConsentVersion));
});

test('public route/source mapping excludes private URLs, raw query/referrer and array values', () => {
  for (const path of ['/learn/private/lesson', '/account', '/auth/reset-password', '/verify/token', '/admin', '/not-known']) assert.equal(publicJourneyContext(path, {}, 'direct'), undefined);
  const context = publicJourneyContext('/kk/astana/ohrana-truda', { email: body.email, program: 'ptm', format: ['online'], utm_campaign: body.name }, 'social');
  assert.deepEqual(context, { routeId: 'city_program', locale: 'kk', source: 'social', programId: 'ohrana-truda', city: 'astana' });
  assert.equal(journeySource('https://google.com/search?q=' + body.email, undefined, 'https://ot.example.test'), 'search');
  assert.equal(journeySource('https://evil.google.com/?token=private', undefined, 'https://ot.example.test'), 'other');
  assert.equal(journeySource('', body.email, 'https://ot.example.test'), 'direct');
  assert.equal(journeySource('https://ot.example.test/learn/private', undefined, 'https://ot.example.test'), 'internal');
});

test('first acceptance freezes server-known first/last context outside the business hash; replay and withdrawal cannot overwrite it', async () => {
  const source = await journey(), key = randomUUID();
  const accepted = await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, key, analyticsConsentVersion);
  assert.ok('submissionId' in accepted);
  const stored = await queryOne('SELECT * FROM lead_attributions WHERE lead_id=?', [accepted.submissionId]); assert.ok(stored);
  assert.equal(stored.last_sequence, 3); assert.equal(JSON.parse(String(stored.first_touch_json)).source, 'search'); assert.equal(JSON.parse(String(stored.last_touch_json)).routeId, 'contacts');
  await recordPublicJourney(event(source.first.journeyId, 4, '/courses/ptm'), analyticsConsentVersion);
  const other = await journey();
  assert.deepEqual(await acceptLead({ ...body, attribution: { journeyId: other.first.journeyId } }, key, analyticsConsentVersion), accepted);
  assert.deepEqual(await acceptLead(body, key), accepted);
  assert.deepEqual(await queryOne('SELECT * FROM lead_attributions WHERE lead_id=?', [accepted.submissionId]), stored);
  assert.ok(!JSON.stringify(stored).includes('PRIVATE_'));
  const business = await queryOne('SELECT payload_json FROM lead_submissions WHERE id=?', [accepted.submissionId]);
  assert.ok(!String(business?.payload_json).includes('journeyId'));
});

test('initial no-consent acceptance, malformed optional metadata and unknown journey keep service acceptance without later backfill', async () => {
  const source = await journey();
  for (const attribution of [{ journeyId: source.first.journeyId }, { journeyId: source.first.journeyId, email: body.email }, { journeyId: randomUUID() }]) {
    const key = randomUUID(), accepted = await acceptLead({ ...body, attribution }, key);
    assert.ok('submissionId' in accepted);
    await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, key, analyticsConsentVersion);
    assert.equal(await queryOne('SELECT 1 found FROM lead_attributions WHERE lead_id=?', [accepted.submissionId]), undefined);
  }
});

test('snapshot cutoff is the durable acceptance timestamp, excluding a step received after acceptance even if visible to the later sidecar transaction', async () => {
  const source = await journey();
  await recordPublicJourney(event(source.first.journeyId, 4, '/courses/ptm'), analyticsConsentVersion, undefined, Date.now() + 60000);
  const accepted = await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, randomUUID(), analyticsConsentVersion); assert.ok('submissionId' in accepted);
  const snapshot = await queryOne('SELECT last_sequence,last_touch_json,created_at FROM lead_attributions WHERE lead_id=?', [accepted.submissionId]); assert.ok(snapshot);
  assert.equal(snapshot.last_sequence, 3); assert.equal(JSON.parse(String(snapshot.last_touch_json)).routeId, 'contacts');
  assert.equal(snapshot.created_at, (await queryOne('SELECT created_at FROM lead_submissions WHERE id=?', [accepted.submissionId]))?.created_at);
});

test('actual sidecar SQL failure leaves accepted lead, service consent, mandatory audit and outbox committed', async () => {
  const source = await journey(), key = randomUUID();
  await execute("CREATE TRIGGER reject_optional_attribution BEFORE INSERT ON lead_attributions BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL_CANARY'); END");
  const saved: string[] = []; const original = console.info; console.info = value => saved.push(String(value));
  let result: Awaited<ReturnType<typeof acceptLead>>;
  try { result = await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, key, analyticsConsentVersion); }
  finally { console.info = original; await execute('DROP TRIGGER reject_optional_attribution'); }
  assert.ok('submissionId' in result);
  for (const [table, where] of [['lead_submissions', 'id'], ['consent_records', 'lead_id'], ['audit_events', 'target'], ['outbox', 'aggregate_id']]) {
    assert.ok(await queryOne(`SELECT 1 found FROM ${table} WHERE ${where}=?`, [result.submissionId]));
  }
  assert.equal(await queryOne('SELECT 1 found FROM lead_attributions WHERE lead_id=?', [result.submissionId]), undefined);
  await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, key, analyticsConsentVersion);
  assert.equal(await queryOne('SELECT 1 found FROM lead_attributions WHERE lead_id=?', [result.submissionId]), undefined);
  assert.equal(saved.length, 1); assert.match(saved[0]!, /telemetry_write_failed/); assert.ok(!saved.join('').includes('PRIVATE_'));
});

test('CRM note contains only approved context, not the journey UUID; existing note retry stays idempotent', async () => {
  const source = await journey();
  const accepted = await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, randomUUID(), analyticsConsentVersion); assert.ok('submissionId' in accepted);
  const appendix = await leadAttributionNote(accepted.submissionId); assert.match(appendix, /Первый публичный источник/); assert.ok(!appendix.includes(source.first.journeyId)); assert.ok(!appendix.includes('PRIVATE_'));
  let notes = 0, noteText = '';
  const transport: NonNullable<Parameters<typeof deliverLead>[1]> = async (url, options) => {
    assert.equal(new URL(url).origin, 'https://crm.example.test');
    if (!url.includes('/notes')) return Response.json({ _embedded: { leads: [{ id: 101, name: `OT-${accepted.submissionId}` }] } });
    if (options.method === 'GET') return Response.json({ _embedded: { notes: notes ? [{ id: 202, params: { text: noteText } }] : [] } });
    notes++; noteText = JSON.parse(options.body!)[0].params.text;
    throw new Error('SYNTHETIC_LOST_RESPONSE');
  };
  await assert.rejects(deliverLead(accepted.submissionId, transport));
  await deliverLead(accepted.submissionId, transport);
  assert.equal(notes, 1); assert.ok(noteText.includes(appendix)); assert.ok(!noteText.includes(source.first.journeyId));
});

test('expiry still runs with feature disabled; expired context is omitted from CRM and durable business records survive', async () => {
  const source = await journey(), accepted = await acceptLead({ ...body, attribution: { journeyId: source.first.journeyId } }, randomUUID(), analyticsConsentVersion); assert.ok('submissionId' in accepted);
  const future = Date.now() + 15 * 86400000;
  assert.equal(await leadAttributionNote(accepted.submissionId, undefined, future), '');
  assert.equal((await recordPublicJourney(event(source.first.journeyId, 4), analyticsConsentVersion, undefined, future)).accepted, false);
  process.env.OT_ANALYTICS_ENABLED = '0';
  await expireLeadAttribution(future);
  assert.equal(await queryOne('SELECT 1 found FROM public_journeys WHERE id=?', [source.first.journeyId]), undefined);
  assert.equal(await queryOne('SELECT 1 found FROM lead_attributions WHERE lead_id=?', [accepted.submissionId]), undefined);
  assert.ok(await queryOne('SELECT 1 found FROM lead_submissions WHERE id=?', [accepted.submissionId]));
  assert.ok(await queryOne('SELECT 1 found FROM consent_records WHERE lead_id=?', [accepted.submissionId]));
  process.env.OT_ANALYTICS_ENABLED = '1';
});

test('selection results are separate ordered action steps; unmatched is not inferred from query and auth confirmation cannot be a client event', async () => {
  const journeyId = randomUUID();
  const context = { routeId: 'selection', locale: 'ru', source: 'internal', programId: 'ohrana-truda', format: 'online' };
  for (const [index, step] of ['selection_start', 'selection_matched', 'selection_unmatched'].entries()) {
    assert.equal((await recordPublicJourney({ id: randomUUID(), journeyId, sequence: index + 1, step, context }, analyticsConsentVersion)).accepted, true);
  }
  for (const invalid of [
    { ...event(), step: 'auth_confirmed' },
    { id: randomUUID(), journeyId, sequence: 4, step: 'auth_start', context: { routeId: 'auth_login', locale: 'ru', source: 'internal', programId: 'ohrana-truda' } },
    { id: randomUUID(), journeyId, sequence: 4, step: 'selection_matched', context: { routeId: 'selection', locale: 'ru', source: 'internal' } },
  ]) await assert.rejects(recordPublicJourney(invalid, analyticsConsentVersion));
});

test('auth confirmation requires enabled consent, verified-session resolver, existing start and current MFA; stores no identity and replay keeps first time', async () => {
  const item = { ...event(), step: 'auth_start', context: { routeId: 'auth_login', locale: 'ru', source: 'internal' } };
  await recordPublicJourney(item, analyticsConsentVersion);
  const reference = { journeyId: item.journeyId };
  const user: AppUser = { id: 'PRIVATE_USER_CANARY', email: body.email, name: body.name, role: 'learner', twoFactorEnabled: false };
  let resolutions = 0, limits = 0;
  const authenticate = async () => { resolutions++; return user; }, limiter = async () => { limits++; };
  process.env.OT_ANALYTICS_ENABLED = '0';
  assert.equal((await confirmPublicJourneyAuth(reference, analyticsConsentVersion, authenticate, limiter)).accepted, false);
  process.env.OT_ANALYTICS_ENABLED = '1';
  assert.equal((await confirmPublicJourneyAuth(reference, 'analytics-v1', authenticate, limiter)).accepted, false);
  assert.equal(resolutions, 0); assert.equal(limits, 0);
  await assert.rejects(confirmPublicJourneyAuth(reference, analyticsConsentVersion, async () => { throw new Error('SYNTHETIC_UNAUTHENTICATED'); }));
  await assert.rejects(confirmPublicJourneyAuth(reference, analyticsConsentVersion, async () => ({ ...user, twoFactorEnabled: true })), (error: any) => error.data.code === 'MFA_REQUIRED');
  await assert.rejects(confirmPublicJourneyAuth(reference, analyticsConsentVersion, async () => ({ ...user, twoFactorEnabled: true, mfaVerifiedAt: Date.now() - 13 * 3600000 })));
  assert.equal((await queryOne('SELECT auth_confirmed_at FROM public_journeys WHERE id=?', [item.journeyId]))?.auth_confirmed_at, null);
  const timestamp = Date.now(); assert.equal((await confirmPublicJourneyAuth(reference, analyticsConsentVersion, authenticate, limiter, timestamp)).accepted, true);
  await confirmPublicJourneyAuth(reference, analyticsConsentVersion, authenticate, limiter, timestamp + 1000);
  const row = await queryOne('SELECT * FROM public_journeys WHERE id=?', [item.journeyId]); assert.ok(row);
  assert.equal(row.auth_confirmed_at, new Date(timestamp).toISOString()); assert.ok(!JSON.stringify(row).includes('PRIVATE_'));
  const notStarted = await journey();
  assert.deepEqual(await confirmPublicJourneyAuth({ journeyId: notStarted.first.journeyId }, analyticsConsentVersion, authenticate), { accepted: false, reason: 'no_started_journey' });
});
