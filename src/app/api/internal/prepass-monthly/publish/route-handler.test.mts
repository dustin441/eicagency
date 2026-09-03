import assert from 'node:assert/strict';
import test from 'node:test';

import { createPrepassMonthlyPublishPostHandler } from './route-handler.ts';
import type { MonthlyPublicationReceipt } from '../../../../../services/prepass-monthly-publication.ts';

const TOKEN = 'monthly-publication-secret';
const receipt: MonthlyPublicationReceipt = {
  publicationId: '10000000-0000-4000-8000-000000000001', revision: 2,
  sourceHash: 'a'.repeat(64), payloadHash: 'b'.repeat(64), sourceRowCount: 321,
  idempotent: false, monthStart: '2026-08-01', monthEnd: '2026-08-31',
};

function request(body: string, authorization = `Bearer ${TOKEN}`) {
  return new Request('http://localhost/api/internal/prepass-monthly/publish', {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body,
  });
}

test('requires the existing transform bridge Bearer token pattern', async () => {
  const handler = createPrepassMonthlyPublishPostHandler({ getSecret: () => TOKEN, publish: async () => receipt });
  for (const authorization of ['', 'Basic abc', 'Bearer', 'Bearer wrong', `Bearer ${TOKEN} extra`]) {
    const response = await handler(request('{}', authorization));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  }
});

test('accepts only a completed monthStart and optional bounded correction reason', async () => {
  const calls: unknown[] = [];
  const handler = createPrepassMonthlyPublishPostHandler({
    getSecret: () => TOKEN, now: () => new Date('2026-09-03T12:00:00Z'),
    publish: async (monthStart, correctionReason) => { calls.push([monthStart, correctionReason]); return receipt; },
  });
  const success = await handler(request('{"monthStart":"2026-08-01","correctionReason":"Late CRM correction"}'));
  assert.equal(success.status, 200);
  assert.deepEqual(calls, [['2026-08-01', 'Late CRM correction']]);

  for (const body of [
    '{}', 'null', '[]', '{', '{"monthStart":"2026-08-02"}', '{"monthStart":"2026-09-01"}',
    '{"monthStart":"2026-08-01","extra":true}', '{"monthStart":"2026-08-01","correctionReason":""}',
    JSON.stringify({ monthStart: '2026-08-01', correctionReason: 'x'.repeat(1001) }),
  ]) {
    const response = await handler(request(body));
    assert.equal(response.status, 400, body);
    assert.deepEqual(await response.json(), { error: 'Invalid request' });
  }
});

test('returns publication evidence without caching and sanitizes failures', async () => {
  const success = createPrepassMonthlyPublishPostHandler({ getSecret: () => TOKEN, publish: async () => receipt });
  const response = await success(request('{"monthStart":"2026-08-01"}'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, ...receipt });

  const failure = createPrepassMonthlyPublishPostHandler({
    getSecret: () => TOKEN, publish: async () => { throw new Error('provider secret'); },
  });
  const failed = await failure(request('{"monthStart":"2026-08-01"}'));
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: 'Monthly publication failed' });
});
