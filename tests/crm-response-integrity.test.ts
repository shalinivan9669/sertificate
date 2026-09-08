import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { closeDb, execute, getDb, queryOne, withTransaction } from '../server/db';
import { acceptLead, deliverLead } from '../server/services/leads';
import { processOutbox } from '../server/services/operations';

let directory: string;
const keys = ['OT_DATABASE_PATH', 'OT_MIGRATIONS_DIR', 'NODE_ENV', 'OT_APP_ENV', 'VERCEL', 'VERCEL_ENV', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'AMO_BASE_URL', 'AMO_ACCESS_TOKEN', 'OT_CRM_DELIVERY_ENABLED', 'OT_EMAIL_DELIVERY_ENABLED', 'OT_ANALYTICS_ENABLED', 'OT_ANALYTICS_RETENTION_DAYS'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
type Transport = NonNullable<Parameters<typeof deliverLead>[1]>;
const privateDiagnostic = 'PRIVATE_SYNTHETIC_PROVIDER_DIAGNOSTIC';
const malformedBodies: Array<() => Response> = [
  () => Response.json(null), () => Response.json({ diagnostic: privateDiagnostic }),
  () => Response.json({ _embedded: { notes: [] } }),
  ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '202'].map(id => () => Response.json({ _embedded: { notes: [{ id }] } })),
  () => Response.json({ _embedded: { notes: [{ id: 202 }, { id: 203 }] } }),
  () => new Response(privateDiagnostic, { status: 200 }), () => new Response(null, { status: 204 }),
];
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ot-crm-response-'));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { OT_DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'test', OT_APP_ENV: 'test', AMO_BASE_URL: 'https://crm.example.test', AMO_ACCESS_TOKEN: 'SYNTHETIC-NO-PROVIDER-TOKEN', OT_CRM_DELIVERY_ENABLED: '0', OT_EMAIL_DELIVERY_ENABLED: '0', OT_ANALYTICS_ENABLED: '1', OT_ANALYTICS_RETENTION_DAYS: '14' });
  await getDb();
});
after(async () => {
  await closeDb();
  const target = resolve(directory);
  assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`) && basename(target).startsWith('ot-crm-response-'));
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});
async function submission() {
  const accepted = await acceptLead({ email: 'synthetic-crm@example.test', programId: 'ohrana-truda', organizationName: 'SYNTHETIC COMPANY' }, randomUUID());
  assert.ok('submissionId' in accepted); assert.ok(accepted.submissionId); return accepted.submissionId;
}
function foundLead(id: string) { return Response.json({ _embedded: { leads: [{ id: 101, name: `OT-${id} | SYNTHETIC` }] } }); }
async function invalid(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: any) => {
    assert.equal(error.statusCode, 502); assert.equal(error.data?.code, 'CRM_INVALID_RESPONSE');
    assert.equal(JSON.stringify(error).includes(privateDiagnostic), false); return true;
  });
}
async function deliveryState(id: string, delivered: boolean) {
  const state = await queryOne('SELECT status,crm_lead_id,crm_note_id,payload_json,request_hash FROM lead_submissions WHERE id=?', [id]); assert.ok(state);
  const audit = await queryOne("SELECT COUNT(*) n FROM audit_events WHERE target=? AND action='lead_crm_delivered'", [id]);
  const eventId = 'server:' + createHash('sha256').update(`lead_crm_delivered\0${id}`).digest('hex');
  const events = await queryOne('SELECT COUNT(*) n FROM analytics_events WHERE id=?', [eventId]);
  assert.equal(audit?.n, delivered ? 1 : 0); assert.equal(events?.n, delivered ? 1 : 0);
  assert.equal(state.status === 'delivered', delivered); return state;
}

test('CRM invalid successful note responses remain pending without delivered audit or analytics', async () => {
  for (const response of malformedBodies) {
    const id = await submission(); let posts = 0;
    const transport: Transport = async (url, options) => {
      if (!url.includes('/notes')) return foundLead(id);
      if (options.method === 'GET') return Response.json({ _embedded: { notes: [] } });
      posts++; return response();
    };
    await invalid(deliverLead(id, transport));
    const state = await deliveryState(id, false);
    assert.equal(state.status, 'note_pending'); assert.equal(state.crm_lead_id, 101); assert.equal(state.crm_note_id, null); assert.equal(posts, 1);
  }
});

test('CRM created lead IDs must be positive safe integers before note work', async () => {
  const responses = [() => Response.json({}), () => Response.json([]), () => new Response(privateDiagnostic),
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '101'].map(id => () => Response.json([{ id }])),
    () => Response.json([{ id: 101 }, { id: 102 }])];
  for (const response of responses) {
    const id = await submission(); let calls = 0;
    await invalid(deliverLead(id, async (url, options) => {
      calls++; assert.equal(url.includes('/notes'), false);
      return options.method === 'GET' ? Response.json({ _embedded: { leads: [] } }) : response();
    }));
    const state = await deliveryState(id, false); assert.equal(state.crm_lead_id, null); assert.equal(state.status, 'accepted'); assert.equal(calls, 2);
  }
});

test('CRM malformed lead lookup fails closed instead of creating a duplicate or throwing raw provider data', async () => {
  for (const body of [null, {}, { _embedded: { leads: {} } }, { _embedded: { leads: [null] } },
    { _embedded: { leads: [{ id: 101 }] } }, { _embedded: { leads: [{ id: 101, name: 1 }] } },
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '101'].map(id => ({ _embedded: { leads: [{ id, name: privateDiagnostic }] } }))]) {
    const id = await submission(); let calls = 0;
    await invalid(deliverLead(id, async (_url, options) => { calls++; assert.equal(options.method, 'GET'); return Response.json(body); }));
    await deliveryState(id, false); assert.equal(calls, 1);
  }
});

test('CRM malformed note lookup cannot silently become an empty list and duplicate a note', async () => {
  for (const body of [null, {}, { _embedded: { notes: {} } }, { _embedded: { notes: [null] } },
    { _embedded: { notes: [{ id: 202, params: { text: 1 } }] } }, { _embedded: { notes: [{ id: -1 }] } }]) {
    const id = await submission(); let calls = 0;
    await invalid(deliverLead(id, async (url, options) => { calls++; assert.equal(options.method, 'GET'); return url.includes('/notes') ? Response.json(body) : foundLead(id); }));
    const state = await deliveryState(id, false); assert.equal(state.status, 'note_pending'); assert.equal(calls, 2);
  }
});

test('CRM corrupt persisted external IDs never trigger a new lead creation', async () => {
  // Historical code could persist zero/negative IDs. Unsafe provider integers are
  // covered above; inserting one directly makes the driver's numeric decoder fail before the service.
  for (const badId of [0, -1]) {
    const id = await submission(); await execute('UPDATE lead_submissions SET crm_lead_id=? WHERE id=?', [badId, id]);
    await invalid(deliverLead(id, async () => { assert.fail('Invalid persisted ID must fail before transport'); }));
    await deliveryState(id, false);
  }
});

test('CRM retries recover ambiguous successful creates by exact markers without recreating lead or note', async () => {
  const id = await submission(); const original = await deliveryState(id, false);
  let leadPosts = 0, notePosts = 0, calls = 0;
  const transport: Transport = async (url, options) => {
    calls++;
    if (!url.includes('/notes')) {
      if (options.method === 'POST') { leadPosts++; return Response.json({ diagnostic: privateDiagnostic }); }
      return Response.json({ _embedded: { leads: [
        { id: 6011, name: `prefix OT-${id}` }, { id: 6012, name: `OT-${id}-other | SYNTHETIC` },
        ...(leadPosts ? [{ id: 601, name: `OT-${id} | SYNTHETIC` }] : []),
      ] } });
    }
    assert.equal(new URL(url).pathname, '/api/v4/leads/601/notes');
    if (options.method === 'POST') { notePosts++; return Response.json({ _embedded: { notes: [] } }); }
    return Response.json({ _embedded: { notes: [
      { id: 7011, params: { text: `prefix [OT-NOTE:${id}]` } }, { id: 7012, params: { text: `[OT-NOTE:${id}] trailing text` } },
      ...(notePosts ? [{ id: 701, params: { text: `[OT-NOTE:${id}]\r\nSYNTHETIC` } }] : []),
    ] } });
  };
  await invalid(deliverLead(id, transport)); await deliveryState(id, false);
  await invalid(deliverLead(id, transport)); assert.equal((await deliveryState(id, false)).status, 'note_pending');
  await deliverLead(id, transport); const state = await deliveryState(id, true);
  assert.equal(state.crm_lead_id, 601); assert.equal(state.crm_note_id, 701);
  assert.equal(state.payload_json, original.payload_json); assert.equal(state.request_hash, original.request_hash);
  const finishedCalls = calls; await deliverLead(id, transport); assert.equal(calls, finishedCalls);
  assert.equal(leadPosts, 1); assert.equal(notePosts, 1);
});

test('CRM multiple exact marker matches require reconciliation rather than picking the first record', async () => {
  for (const stage of ['lead', 'note']) {
    const id = await submission();
    await invalid(deliverLead(id, async (url, options) => {
      assert.equal(options.method, 'GET');
      if (!url.includes('/notes')) return stage === 'lead' ? Response.json({ _embedded: { leads: [101, 102].map(idValue => ({ id: idValue, name: `OT-${id}` })) } }) : foundLead(id);
      return Response.json({ _embedded: { notes: [201, 202].map(idValue => ({ id: idValue, params: { text: `[OT-NOTE:${id}]` } })) } });
    }));
    await deliveryState(id, false);
  }
});

test('CRM invalid 2xx is retryable through the real worker and marker recovery completes it once', async context => {
  const id = await submission(); let noteExists = false, notePosts = 0;
  const transport: Transport = async (url, options) => {
    if (!url.includes('/notes')) return foundLead(id);
    if (options.method === 'GET') return Response.json({ _embedded: { notes: noteExists ? [{ id: 202, params: { text: `[OT-NOTE:${id}]` } }] : [] } });
    noteExists = true; notePosts++; return Response.json({ diagnostic: privateDiagnostic });
  };
  const spy = context.mock.method(globalThis, 'fetch', (input: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => transport(String(input), options as Parameters<Transport>[1]));
  process.env.OT_CRM_DELIVERY_ENABLED = '1';
  try {
    const failed = await processOutbox({ aggregateId: id, limit: 1, allowExternal: true });
    assert.equal(failed.results[0]?.code, 'CRM_INVALID_RESPONSE'); await deliveryState(id, false);
    const job = await queryOne('SELECT status,attempts,available_at FROM outbox WHERE aggregate_id=?', [id]);
    assert.ok(job); assert.equal(job.status, 'pending'); assert.equal(job.attempts, 1); assert.ok(Date.parse(job.available_at) > Date.now());
    await execute('UPDATE outbox SET available_at=? WHERE aggregate_id=?', [new Date(Date.now() - 1000).toISOString(), id]);
    await processOutbox({ aggregateId: id, limit: 1, allowExternal: true });
    await deliveryState(id, true); assert.equal(notePosts, 1);
    assert.equal((await queryOne('SELECT status FROM outbox WHERE aggregate_id=?', [id]))?.status, 'delivered');
  } finally { spy.mock.restore(); process.env.OT_CRM_DELIVERY_ENABLED = '0'; }
});

test('CRM marker recovery searches later lead and note pages without any create', async () => {
  const id = await submission(); let leadGets = 0, noteGets = 0;
  await deliverLead(id, async (url, options) => {
    assert.equal(options.method, 'GET'); const current = new URL(url); const page = Number(current.searchParams.get('page'));
    assert.equal(current.searchParams.get('limit'), '250');
    const notes = current.pathname.includes('/notes'); if (notes) noteGets++; else leadGets++;
    const next = new URL(current); next.searchParams.set('page', '2');
    if (page === 1) return Response.json({ _page: page, _links: { next: { href: next.href } }, _embedded: notes ? { notes: [] } : { leads: [] } });
    assert.equal(page, 2);
    return Response.json({ _page: page, _embedded: notes ? { notes: [{ id: 402, params: { text: `[OT-NOTE:${id}]` } }] } : { leads: [{ id: 401, name: `OT-${id}` }] } });
  });
  const state = await deliveryState(id, true); assert.equal(state.crm_lead_id, 401); assert.equal(state.crm_note_id, 402);
  assert.equal(leadGets, 2); assert.equal(noteGets, 2);
});

test('CRM rejects unsafe or changed pagination URLs before forwarding credentials or creating entities', async () => {
  const changes = [(url: URL) => { url.host = 'other.example.test'; }, (url: URL) => { url.pathname = '/api/v4/contacts'; },
    (url: URL) => { url.searchParams.set('query', 'different-query'); }, (url: URL) => { url.searchParams.set('page', '1'); },
    (url: URL) => { url.searchParams.set('limit', '1'); }, (url: URL) => { url.searchParams.append('page', '2'); },
    (url: URL) => { url.username = 'unexpected'; }, (url: URL) => { url.hash = 'private-fragment'; }];
  for (const stage of ['lead', 'note']) for (const change of changes) {
    const id = await submission(); let calls = 0;
    await invalid(deliverLead(id, async (url, options) => {
      calls++; assert.equal(options.method, 'GET'); assert.equal(new URL(url).origin, 'https://crm.example.test');
      const notes = new URL(url).pathname.includes('/notes'); if (stage === 'note' && !notes) return foundLead(id);
      const next = new URL(url); next.searchParams.set('page', '2'); change(next);
      return Response.json({ _links: { next: { href: next.href } }, _embedded: notes ? { notes: [] } : { leads: [] } });
    }));
    await deliveryState(id, false); assert.equal(calls, stage === 'lead' ? 1 : 2);
  }
});

test('CRM incomplete lookup at the three-page budget never permits a create or delivered event', async () => {
  for (const stage of ['lead', 'note']) {
    const id = await submission(); let searched = 0;
    await invalid(deliverLead(id, async (url, options) => {
      assert.equal(options.method, 'GET'); const current = new URL(url); const notes = current.pathname.includes('/notes');
      if (stage === 'note' && !notes) return foundLead(id);
      searched++; const next = new URL(current); next.searchParams.set('page', String(Number(current.searchParams.get('page')) + 1));
      return Response.json({ _page: searched, _links: { next: { href: next.href } }, _embedded: notes ? { notes: [] } : { leads: [] } });
    }));
    await deliveryState(id, false); assert.equal(searched, 3);
  }
});

test('CRM full pages without next links are not mistaken for completed searches', async () => {
  const id = await submission(); let pages = 0;
  await deliverLead(id, async (url, options) => {
    assert.equal(options.method, 'GET'); const current = new URL(url); const notes = current.pathname.includes('/notes');
    if (!notes) return foundLead(id);
    pages++; assert.equal(Number(current.searchParams.get('page')), pages);
    if (pages === 1) return Response.json({ _embedded: { notes: Array.from({ length: 250 }, (_, index) => ({ id: 1000 + index, params: { text: 'UNRELATED SYNTHETIC NOTE' } })) } });
    return Response.json({ _embedded: { notes: [{ id: 402, params: { text: `[OT-NOTE:${id}]` } }] } });
  });
  await deliveryState(id, true); assert.equal(pages, 2);
});

test('CRM audit SQL failure rolls back delivered status and retry recovers the confirmed note once', async () => {
  for (const explicitClient of [false, true]) {
    const id = await submission(); let leadPosts = 0, notePosts = 0;
    const client = await getDb();
    const transport: Transport = async (url, options) => {
      // A real writer can be acquired during transport: the service must not
      // hold its final database transaction across any remote operation.
      const probe = await client.transaction('write'); await probe.rollback(); probe.close();
      if (!url.includes('/notes')) {
        if (options.method === 'GET') return Response.json({ _embedded: { leads: [] } });
        leadPosts++; return Response.json([{ id: 101 }]);
      }
      if (options.method === 'GET') return Response.json({ _embedded: { notes: notePosts ? [{ id: 202, params: { text: `[OT-NOTE:${id}]` } }] : [] } });
      notePosts++; return Response.json({ _embedded: { notes: [{ id: 202 }] } });
    };
    await execute("CREATE TRIGGER synthetic_delivery_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action='lead_crm_delivered' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_DELIVERY_AUDIT_FAILURE'); END");
    try {
      await assert.rejects(deliverLead(id, transport, explicitClient ? client : undefined), /SYNTHETIC_DELIVERY_AUDIT_FAILURE/);
      const pending = await deliveryState(id, false);
      assert.equal(pending.status, 'note_pending'); assert.equal(pending.crm_lead_id, 101); assert.equal(pending.crm_note_id, null);
    } finally { await execute('DROP TRIGGER synthetic_delivery_audit_failure'); }
    await deliverLead(id, transport, explicitClient ? client : undefined);
    await deliveryState(id, true); assert.equal(leadPosts, 1); assert.equal(notePosts, 1);
    await deliverLead(id, async () => { assert.fail('Delivered retry must not call provider'); });
    await deliveryState(id, true);
  }
});

test('CRM confirmation participates in an existing transaction without committing its caller', async () => {
  const id = await submission();
  const transport: Transport = async (url, options) => {
    assert.equal(options.method, 'GET');
    return url.includes('/notes') ? Response.json({ _embedded: { notes: [{ id: 202, params: { text: `[OT-NOTE:${id}]` } }] } }) : foundLead(id);
  };
  await assert.rejects(withTransaction(async tx => {
    await deliverLead(id, transport, tx);
    assert.equal((await queryOne('SELECT status FROM lead_submissions WHERE id=?', [id], tx))?.status, 'delivered');
    throw new Error('SYNTHETIC_CALLER_ROLLBACK');
  }), /SYNTHETIC_CALLER_ROLLBACK/);
  const unchanged = await deliveryState(id, false); assert.equal(unchanged.status, 'accepted'); assert.equal(unchanged.crm_lead_id, null);
  await withTransaction(tx => deliverLead(id, transport, tx)); await deliveryState(id, true);
});
