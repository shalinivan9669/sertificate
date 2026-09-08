import assert from 'node:assert/strict';
import test from 'node:test';
import { LibsqlError } from '@libsql/client';
import { readBrowserRows } from './helpers/browser-read-observer.mjs';

test('browser observer retries only transient lock reads and preserves the exact query and returned rows', async () => {
  const rows = [{ n: 2 }], calls = [], args = ['synthetic-journey'];
  const db = { async execute(statement) {
    calls.push(statement);
    if (calls.length === 1) throw new LibsqlError('database is locked', 'SQLITE_BUSY', 5);
    if (calls.length === 2) throw new LibsqlError('database table is locked', 'SQLITE_LOCKED', 6);
    return { rows };
  } };
  assert.equal(await readBrowserRows(db, 'SELECT COUNT(*) n FROM public_journeys WHERE id=?', args), rows);
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.equal(call.sql, 'SELECT COUNT(*) n FROM public_journeys WHERE id=?'); assert.equal(call.args, args); }
});

test('browser observer fails with the original persistent lock after the bounded eight attempts', async () => {
  let calls = 0;
  const failure = new LibsqlError('database is locked', 'SQLITE_BUSY', 5);
  await assert.rejects(readBrowserRows({ async execute() { calls++; throw failure; } }, 'SELECT COUNT(*) n FROM public_journeys'), error => error === failure);
  assert.equal(calls, 8);
});

test('browser observer never retries a non-lock failure or a write and never replaces failure with empty rows', async () => {
  let calls = 0;
  const failure = new LibsqlError('synthetic SQL failure', 'SQLITE_ERROR', 1);
  const db = { async execute() { calls++; throw failure; } };
  await assert.rejects(readBrowserRows(db, 'SELECT missing_column FROM public_journeys'), error => error === failure);
  assert.equal(calls, 1);
  await assert.rejects(readBrowserRows(db, 'UPDATE public_journeys SET id=?', ['forbidden']), /one SELECT/);
  await assert.rejects(readBrowserRows(db, 'SELECT 1; DELETE FROM public_journeys'), /one SELECT/);
  assert.equal(calls, 1);
});
