import assert from 'node:assert/strict';
import test from 'node:test';

import { createClientHealthRefreshPostHandler } from './route-handler.ts';

const TOKEN = 'dedicated-client-health-secret';
const runner = async (snapshotDate: string) => ({
  refreshRunId: '10000000-0000-4000-8000-000000000001',
  evidenceHash: 'a'.repeat(64),
  snapshotCount: 3,
  snapshotDate,
});

function request(body: string | undefined, token = TOKEN): Request {
  return new Request('http://localhost/api/internal/client-health/refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body }),
  });
}

test('requires the dedicated Bearer secret and rejects malformed credentials', async () => {
  const handler = createClientHealthRefreshPostHandler({ getSecret: () => TOKEN, runRefresh: runner });
  for (const authorization of [null, 'Basic abc', 'Bearer', 'Bearer wrong', `Bearer ${TOKEN} extra`]) {
    const headers = authorization === null ? new Headers() : new Headers({ authorization });
    const response = await handler(new Request('http://localhost', { method: 'POST', headers }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  }
});

test('accepts only an exact optional snapshotDate body and defaults to the last complete Phoenix date', async () => {
  const dates: string[] = [];
  const handler = createClientHealthRefreshPostHandler({
    getSecret: () => TOKEN,
    now: () => new Date('2026-09-03T15:00:00.000Z'),
    runRefresh: async (date) => { dates.push(date); return runner(date); },
  });
  for (const body of [undefined, '', '{}']) {
    const response = await handler(request(body));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(dates, ['2026-09-02', '2026-09-02', '2026-09-02']);

  const explicit = await handler(request('{"snapshotDate":"2026-08-31"}'));
  assert.equal(explicit.status, 200);
  assert.equal((await explicit.json()).snapshotDate, '2026-08-31');

  for (const body of ['null', '[]', '{"snapshotDate":null}', '{"snapshotDate":"bad"}', '{"extra":true}', '{']) {
    const response = await handler(request(body));
    assert.equal(response.status, 400, body);
    assert.deepEqual(await response.json(), { error: 'Invalid request' });
  }
});

test('returns a sanitized receipt and never leaks runner causes', async () => {
  const success = createClientHealthRefreshPostHandler({
    getSecret: () => TOKEN,
    now: () => new Date('2026-09-03T15:00:00.000Z'),
    runRefresh: runner,
  });
  const receipt = await success(request('{}'));
  assert.deepEqual(await receipt.json(), {
    ok: true,
    refreshRunId: '10000000-0000-4000-8000-000000000001',
    evidenceHash: 'a'.repeat(64),
    snapshotCount: 3,
    snapshotDate: '2026-09-02',
  });
  assert.equal(receipt.headers.get('cache-control'), 'no-store');

  const secret = 'provider-secret-that-must-not-leak';
  const failure = createClientHealthRefreshPostHandler({
    getSecret: () => TOKEN,
    runRefresh: async () => { throw new Error(secret); },
  });
  const response = await failure(request('{}'));
  const serialized = await response.clone().text();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Client health refresh failed' });
  assert.equal(serialized.includes(secret), false);
});