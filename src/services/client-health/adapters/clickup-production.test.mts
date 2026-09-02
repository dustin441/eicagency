import assert from 'node:assert/strict';
import test from 'node:test';

import { createApprovedProductionClickUpAdapter } from './clickup-production.ts';
import type { AdapterContext } from './types.ts';

const TOKEN_ENV = 'CLICKUP_CLIENT_HEALTH_TOKEN';
const TEAM_ID = '1229523';
const CONTRACT_VERSION = 'sources-v1';
const TOKEN = 'test-clickup-secret-token';

const APPROVED_LISTS = Object.freeze({
  prepass: '240062401',
  spartaco: '901407399216',
  nsi: '900900564386',
  durodyne: '901415478138',
  goodgame: '901414768821',
  bridgeway: '901413196484',
  arabella: '901414345904',
  kinsey: '901414385622',
  state48: '900500452322',
  cba: '901400944748',
  bloom: '901414401917',
  champagne: '901417128015',
  ihh: '901418534831',
  aurit: '901424611194',
  medibrane: '901424642458',
});

type FetchCall = { input: Parameters<typeof fetch>[0]; init: Parameters<typeof fetch>[1] };

function context(clientKey: string, signal?: AbortSignal): AdapterContext {
  return {
    clientKey,
    timezone: 'America/Phoenix',
    retrievedAt: '2026-08-20T12:00:00.000Z',
    lastCompleteDate: '2026-08-19',
    windows: {
      month: { start: '2026-08-01', end: '2026-08-19' },
      current: { start: '2026-08-06', end: '2026-08-19' },
      previous: { start: '2026-07-23', end: '2026-08-05' },
    },
    sourceContractVersion: CONTRACT_VERSION,
    ...(signal ? { signal } : {}),
  };
}

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

async function withProductionFetch(
  implementation: (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => Promise<Response>,
  run: () => Promise<void>,
): Promise<void> {
  const originalToken = process.env[TOKEN_ENV];
  const originalFetch = globalThis.fetch;
  process.env[TOKEN_ENV] = TOKEN;
  globalThis.fetch = implementation;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env[TOKEN_ENV];
    else process.env[TOKEN_ENV] = originalToken;
  }
}

test('approved static keys use only their exact list ID and exact ClickUp v2 requests', async () => {
  const calls: FetchCall[] = [];
  const controller = new AbortController();
  await withProductionFetch(async (input, init) => {
    calls.push({ input, init });
    const url = new URL(String(input));
    return url.pathname.endsWith('/time_entries')
      ? response({ data: [] })
      : response({ tasks: [], last_page: true });
  }, async () => {
    for (const key of Object.keys(APPROVED_LISTS) as Array<keyof typeof APPROVED_LISTS>) {
      const result = await createApprovedProductionClickUpAdapter(key, CONTRACT_VERSION)(context(key, controller.signal));
      assert.equal(result.source.status, 'succeeded', key);
      assert.equal(result.source.key, 'clickup', key);
      assert.equal(result.evidence.sourceContractVersion, CONTRACT_VERSION, key);
      assert.equal(JSON.stringify(result).includes(TOKEN), false, key);
    }
  });

  assert.equal(calls.length, Object.keys(APPROVED_LISTS).length * 4);
  for (let index = 0; index < calls.length; index += 1) {
    const key = Object.keys(APPROVED_LISTS)[Math.floor(index / 4)] as keyof typeof APPROVED_LISTS;
    const call = calls[index];
    const url = new URL(String(call.input));
    assert.equal(url.origin, 'https://api.clickup.com');
    assert.equal(call.init?.method, 'GET');
    assert.equal(new Headers(call.init?.headers).get('Authorization'), TOKEN);
    assert.equal(call.init?.signal, controller.signal);
    if (url.pathname.endsWith('/time_entries')) {
      assert.equal(url.pathname, `/api/v2/team/${TEAM_ID}/time_entries`);
      assert.deepEqual([...url.searchParams.entries()], [
        ['start_date', String(Date.parse('2026-08-01T07:00:00.000Z'))],
        ['end_date', String(Date.parse('2026-08-20T06:59:59.999Z'))],
        ['include_location_names', 'true'],
      ]);
    } else {
      assert.equal(url.pathname, `/api/v2/team/${TEAM_ID}/task`);
      assert.deepEqual([...url.searchParams.entries()], [
        ['list_ids[]', APPROVED_LISTS[key]],
        ['due_date_lt', String(Date.parse('2026-08-20T07:00:00.000Z'))],
        ['include_closed', 'false'],
        ['subtasks', 'true'],
        ['order_by', 'due_date'],
        ['reverse', 'false'],
        ['page', '0'],
      ]);
    }
  }
});

test('production factory fails closed for missing credentials, excluded keys, and contract mismatch', async () => {
  const originalToken = process.env[TOKEN_ENV];
  delete process.env[TOKEN_ENV];
  try {
    assert.throws(
      () => createApprovedProductionClickUpAdapter('prepass', CONTRACT_VERSION),
      /ClickUp client health credential is not configured/i,
    );
  } finally {
    if (originalToken !== undefined) process.env[TOKEN_ENV] = originalToken;
  }

  await withProductionFetch(async () => response({ data: [] }), async () => {
    for (const key of ['liveworld', 'eic', 'turfli', 'liferep', 'unknown', '240062401']) {
      assert.throws(
        () => createApprovedProductionClickUpAdapter(key, CONTRACT_VERSION),
        /unsupported production ClickUp adapter key/i,
      );
    }
    await assert.rejects(
      createApprovedProductionClickUpAdapter('prepass', CONTRACT_VERSION)({
        ...context('prepass'),
        sourceContractVersion: 'other-version',
      }),
      /source contract version does not match/i,
    );
  });
});

test('HTTP and JSON endpoint failures are fail-closed and never expose token or provider details', async () => {
  const providerSecret = 'provider-body-secret';
  for (const [name, implementation] of [
    ['bad HTTP', async () => response({ message: `${providerSecret} ${TOKEN}` }, false, 401)],
    ['non-JSON', async () => ({ ok: true, status: 200, json: async () => { throw new Error(`${providerSecret} ${TOKEN}`); } }) as unknown as Response],
    ['malformed JSON', async () => response(null)],
  ] as const) {
    await withProductionFetch(implementation, async () => {
      const result = await createApprovedProductionClickUpAdapter('prepass', CONTRACT_VERSION)(context('prepass'));
      assert.equal(result.source.status, 'failed', name);
      assert.ok(result.failure, name);
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes(TOKEN), false, name);
      assert.equal(serialized.includes(providerSecret), false, name);
      assert.equal(serialized.toLowerCase().includes('authorization'), false, name);
    });
  }

  let call = 0;
  await withProductionFetch(async () => {
    call += 1;
    if (call === 1) return response({ data: [] });
    return response({ message: `${providerSecret} ${TOKEN}` }, false, 503);
  }, async () => {
    const result = await createApprovedProductionClickUpAdapter('prepass', CONTRACT_VERSION)(context('prepass'));
    assert.equal(result.failure?.code, 'query_failed');
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
    assert.equal(JSON.stringify(result).includes(providerSecret), false);
  });
});