import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, request } from 'node:http';
import { createApp, defineEventHandler, readBody, toNodeListener } from 'h3';
import security from '../server/middleware/security';

let base: string;
const server = createServer(toNodeListener(createApp().use(security).use(defineEventHandler(async event => ({ body: await readBody(event) })))));
before(async () => { await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as { port: number }).port}`; });
after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

test('streamed request without Content-Length is bounded and returns 413', async () => {
  const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(`${base}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject); req.write('{"text":"'); req.write('a'.repeat(70000)); req.end('"}');
  });
  assert.equal(result.status, 413); assert.match(result.body, /BODY_TOO_LARGE/);
});

test('bounded request is reusable by h3 handlers and response stays private', async () => {
  const response = await fetch(`${base}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Проверка қазақша' }) });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { body: { text: 'Проверка қазақша' } });
  assert.match(response.headers.get('cache-control')!, /no-store/); assert.match(response.headers.get('x-robots-tag')!, /noindex/); assert.ok(response.headers.get('x-request-id'));
});

test('cross-site mutations and oversized authentication bodies are rejected', async () => {
  const hostile = await fetch(`${base}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://hostile.example', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
  assert.equal(hostile.status, 403);
  const auth = await fetch(`${base}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(21000) }) });
  assert.equal(auth.status, 413);
});
