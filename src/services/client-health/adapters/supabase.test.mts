import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { buildClientHealthSnapshot, type EngineMetricConfig } from '../engine.ts';
import { createApprovedProductionSupabaseAdapter } from './supabase-production.ts';
import {
  createDeterministicSupabaseRelationAdapter,
  defineApprovedSupabaseRelationContract,
  type SupabaseLikeClient,
} from './supabase.ts';
import type { AdapterContext, SupabaseAdapterEvidence } from './types.ts';

type Response = { data: unknown; error: { message: string } | null; count: number | null };
type Call = { method: string; args: unknown[] };

function mockClient(responses: Response[]) {
  const calls: Call[] = [];
  class Query implements PromiseLike<Response> {
    select(...args: unknown[]) { calls.push({ method: 'select', args }); return this; }
    gte(...args: unknown[]) { calls.push({ method: 'gte', args }); return this; }
    lte(...args: unknown[]) { calls.push({ method: 'lte', args }); return this; }
    eq(...args: unknown[]) { calls.push({ method: 'eq', args }); return this; }
    order(...args: unknown[]) { calls.push({ method: 'order', args }); return this; }
    range(...args: unknown[]) {
      calls.push({ method: 'range', args });
      const response = responses.shift();
      assert.ok(response, 'missing mocked page');
      return Promise.resolve(response);
    }
    then<TResult1 = Response, TResult2 = never>(
      onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      const response = responses.shift();
      assert.ok(response, 'missing mocked response');
      return Promise.resolve(response).then(onfulfilled, onrejected);
    }
  }
  const client = { from(relation: string) { calls.push({ method: 'from', args: [relation] }); return new Query(); } } as SupabaseLikeClient;
  return { client, calls };
}

const context: AdapterContext = {
  clientKey: 'fixture',
  timezone: 'America/Phoenix',
  retrievedAt: '2026-08-20T12:00:00.000Z',
  lastCompleteDate: '2026-08-19',
  windows: {
    month: { start: '2026-08-01', end: '2026-08-19' },
    current: { start: '2026-08-06', end: '2026-08-19' },
    previous: { start: '2026-07-23', end: '2026-08-05' },
  },
  sourceContractVersion: 'fixture-v1',
};

const ratioContract = (filters: ReadonlyArray<{
  column: string;
  operator: 'eq';
  value: string | number | boolean;
}> = [
  { column: 'client_key', operator: 'eq' as const, value: 'fixture' },
  { column: 'campaign_scope', operator: 'eq' as const, value: 'approved' },
], includeMonthSpend = true) => defineApprovedSupabaseRelationContract({
  sourceKey: 'paid_media',
  clientKey: 'fixture',
  project: 'eic' as const,
  relation: 'approved_daily_facts',
  dateColumn: 'report_date',
  uniqueOrderColumn: 'id',
  filters,
  mapping: { kind: 'ratio' as const, spendColumn: 'spend', resultsColumn: 'results', includeMonthSpend },
});

const ok = (data: unknown, count: number | null): Response => ({ data, count, error: null });
const verified = (...scan: Response[]): Response[] => [...scan, ...scan];
const row = (id: string, report_date: string, spend: unknown, results: unknown) => ({ id, report_date, spend, results });
const emptyValues = {
  budget: null,
  monthSpend: null,
  currentRows: null,
  previousRows: null,
  hoursUsed: null,
  hoursAllotted: null,
  overdueTaskCount: null,
  revenue: null,
  fulfillmentCost: null,
};

test('production service-role routing accepts only private approved adapter keys', async () => {
  for (const key of ['canary:anything', 'prepass:arbitrary', 'eic:arbitrary', 'unknown', '', null]) {
    assert.throws(() => createApprovedProductionSupabaseAdapter(key as never), /unsupported production Supabase adapter key/i);
  }
  assert.deepEqual(Object.keys(await import('./supabase-production.ts')), ['createApprovedProductionSupabaseAdapter']);
  assert.equal('createProjectSupabaseClient' in await import('./supabase.ts'), false);
});

test('default credential-owning Supabase module rejects non-server imports', () => {
  const moduleUrl = new URL('../../../lib/supabase-server.ts', import.meta.url).href;
  const result = spawnSync(process.execPath, [
    '--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval',
    'await import(process.argv[1])', moduleUrl,
  ], { encoding: 'utf8', env: { NODE_ENV: 'test' } });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /cannot be imported from a Client Component module/i);
});

test('default credential-owning Supabase module validates required environment without exposing values', () => {
  const moduleUrl = new URL('../../../lib/supabase-server.ts', import.meta.url).href;
  const evaluate = 'const { createServerSupabaseClient } = await import(process.argv[1]); createServerSupabaseClient()';
  const missing = spawnSync(process.execPath, [
    '--conditions=react-server', '--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval',
    evaluate, moduleUrl,
  ], { encoding: 'utf8', env: { NODE_ENV: 'test' } });
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}\n${missing.stderr}`, /NEXT_PUBLIC_SUPABASE_URL is required/);

  const invalid = spawnSync(process.execPath, [
    '--conditions=react-server', '--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval',
    evaluate, moduleUrl,
  ], {
    encoding: 'utf8',
    env: { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'not-a-secret-but-invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret' },
  });
  assert.notEqual(invalid.status, 0);
  const output = `${invalid.stdout}\n${invalid.stderr}`;
  assert.match(output, /must be a valid HTTP\(S\) URL/);
  assert.equal(output.includes('fixture-secret'), false);
});

test('lane-only ratio contracts can suppress month spend without losing comparison rows', async () => {
  const { client } = mockClient(verified(ok([
    row('a', '2026-08-05', 20, 2), row('b', '2026-08-19', 40, 4),
  ], 2)));
  const result = await createDeterministicSupabaseRelationAdapter(ratioContract([], false), {
    client, pageSize: 100, maxPages: 1,
  })(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.values.monthSpend, null);
  assert.deepEqual(result.values.previousRows, [{ spend: 20, results: 2 }]);
  assert.deepEqual(result.values.currentRows, [{ spend: 40, results: 4 }]);
});

test('paginates by date then stable unique key and accepts identical dates deterministically', async () => {
  const { client, calls } = mockClient(verified(
    ok([row('a', '2026-08-05', 20, 2), row('b', '2026-08-05', 30, 3)], 4),
    ok([row('c', '2026-08-06', 40, 4), row('d', '2026-08-19', 10, 1)], 4),
  ));
  const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client, pageSize: 2, maxPages: 3 })(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.rowCount, 4);
  assert.equal((result.evidence as SupabaseAdapterEvidence).selectedRowCount, 4);
  assert.equal(result.source.dataThrough, '2026-08-19');
  assert.equal(result.source.stale, false);
  assert.deepEqual(result.values.currentRows, [{ spend: 40, results: 4 }, { spend: 10, results: 1 }]);
  assert.deepEqual(result.values.previousRows, [{ spend: 20, results: 2 }, { spend: 30, results: 3 }]);
  assert.equal(result.values.monthSpend, 100);
  assert.deepEqual(calls.filter((call) => call.method === 'order').map((call) => call.args), [
    ['report_date', { ascending: true }], ['id', { ascending: true }],
    ['report_date', { ascending: true }], ['id', { ascending: true }],
    ['report_date', { ascending: true }], ['id', { ascending: true }],
    ['report_date', { ascending: true }], ['id', { ascending: true }],
  ]);
  assert.deepEqual(calls.filter((call) => call.method === 'range').map((call) => call.args), [[0, 1], [2, 3], [0, 1], [2, 3]]);
  assert.ok(calls.some((call) => call.method === 'gte' && call.args[1] === '2026-07-23'));
  assert.ok(calls.some((call) => call.method === 'lte' && call.args[1] === '2026-08-19'));
  assert.deepEqual(calls.filter((call) => call.method === 'eq').slice(0, 2).map((call) => call.args), [
    ['client_key', 'fixture'], ['campaign_scope', 'approved'],
  ]);
});

test('verifies more than 1,000 same-date rows across a stable unique-key page boundary', async () => {
  const rows = Array.from({ length: 1_001 }, (_, index) => (
    row(String(index).padStart(4, '0'), '2026-08-19', 1, 1)
  ));
  const { client, calls } = mockClient(verified(
    ok(rows.slice(0, 1_000), rows.length),
    ok(rows.slice(1_000), rows.length),
  ));
  const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), {
    client, pageSize: 1_000, maxPages: 2,
  })(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.rowCount, 1_001);
  assert.equal(result.values.monthSpend, 1_001);
  assert.deepEqual(calls.filter((call) => call.method === 'range').map((call) => call.args), [
    [0, 999], [1_000, 1_999], [0, 999], [1_000, 1_999],
  ]);
});

test('fails closed on equal-count insert/delete and selected value or date mutations between scans', async () => {
  const initial = [row('a', '2026-08-18', 1, 1), row('b', '2026-08-19', 2, 2)];
  const mutations = [
    [row('b', '2026-08-19', 2, 2), row('c', '2026-08-19', 3, 3)],
    [row('a', '2026-08-18', 99, 1), row('b', '2026-08-19', 2, 2)],
    [row('a', '2026-08-17', 1, 1), row('b', '2026-08-19', 2, 2)],
  ];
  for (const mutated of mutations) {
    const { client } = mockClient([ok(initial, 2), ok(mutated, 2)]);
    const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client })(context);
    assert.equal(result.failure?.code, 'source_changed');
    assert.notEqual(result.source.status, 'succeeded');
    assert.deepEqual(result.values, emptyValues);
  }
});

test('fails closed for duplicates, missing pages, changing totals, page errors, and max-page exhaustion', async () => {
  const cases: Array<[string, Response[], RegExp]> = [
    ['duplicate', [ok([row('a', '2026-08-18', 1, 1), row('a', '2026-08-19', 1, 1)], 2)], /duplicate/i],
    ['invalid count', [ok([row('a', '2026-08-19', 1, 1)], null)], /count/i],
    ['page order', [ok([row('b', '2026-08-19', 1, 1), row('a', '2026-08-19', 1, 1)], 2)], /order/i],
    ['missing page', [ok([row('a', '2026-08-19', 1, 1)], 2)], /count|complete/i],
    ['changing total', [ok([row('a', '2026-08-18', 1, 1), row('b', '2026-08-18', 1, 1)], 3), ok([row('c', '2026-08-19', 1, 1)], 4)], /count.*changed|mismatch/i],
    ['partial page error', [ok([row('a', '2026-08-18', 1, 1), row('b', '2026-08-18', 1, 1)], 3), { data: null, count: 3, error: { message: 'secret raw database error' } }], /page.*failed/i],
    ['max pages', [ok([row('a', '2026-08-18', 1, 1), row('b', '2026-08-18', 1, 1)], 3)], /maximum page/i],
  ];
  for (const [name, responses, expected] of cases) {
    const { client } = mockClient(responses);
    const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), {
      client, pageSize: 2, maxPages: name === 'max pages' ? 1 : 3,
    })(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.match(result.failure?.reason ?? '', expected, name);
    assert.equal(JSON.stringify(result).includes('secret raw database error'), false, name);
    assert.deepEqual(result.values, emptyValues, name);
  }
});

test('fails closed and sanitizes evidence when a source query rejects', async () => {
  const secret = 'secret transport details';
  const client = {
    from() {
      const query = {
        select() { return query; }, gte() { return query; }, lte() { return query; }, eq() { return query; },
        order() { return query; }, range() { return Promise.reject(new Error(secret)); },
      };
      return query;
    },
  } as SupabaseLikeClient;
  const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client })(context);
  assert.equal(result.source.status, 'failed');
  assert.equal(result.failure?.code, 'query_failed');
  assert.equal((result.evidence as SupabaseAdapterEvidence).selectedRowCount, null);
  assert.deepEqual(result.values, emptyValues);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('requires one stable unique-key type across every date and discards accumulated values', async () => {
  const { client } = mockClient([ok([
    { ...row('a', '2026-08-18', 1, 1), id: 1 },
    row('b', '2026-08-19', 2, 2),
  ], 2)]);
  const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client })(context);
  assert.equal(result.source.status, 'partial');
  assert.equal(result.failure?.code, 'page_order');
  assert.deepEqual(result.values, emptyValues);
});

test('rejects missing stable keys, malformed rows, nonfinite/negative values, and null numerics', async () => {
  assert.throws(() => defineApprovedSupabaseRelationContract({
    sourceKey: 'bad', clientKey: 'fixture', project: 'eic', relation: 'facts', dateColumn: 'date', uniqueOrderColumn: '', filters: [],
    mapping: { kind: 'ratio', spendColumn: 'spend', resultsColumn: 'results' },
  }), /stable unique order key/i);

  for (const [name, badRow] of [
    ['missing key', { report_date: '2026-08-19', spend: 1, results: 1 }],
    ['bad date', row('a', 'not-a-date', 1, 1)],
    ['nonfinite', row('a', '2026-08-19', 'Infinity', 1)],
    ['negative', row('a', '2026-08-19', -1, 1)],
    ['null', row('a', '2026-08-19', null, 1)],
  ] as const) {
    const { client } = mockClient([ok([badRow], 1)]);
    const result = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client, pageSize: 2, maxPages: 2 })(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.match(result.failure?.reason ?? '', /malformed|finite|nonnegative|null|unique/i, name);
  }
});

test('preserves verified zero while empty/null data remains unavailable', async () => {
  const zeroClient = mockClient(verified(ok([row('z', '2026-08-19', 0, 0)], 1))).client;
  const zero = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client: zeroClient })(context);
  assert.equal(zero.source.status, 'succeeded');
  assert.deepEqual(zero.values.currentRows, [{ spend: 0, results: 0 }]);
  assert.equal(zero.values.monthSpend, 0);

  const emptyClient = mockClient(verified(ok([], 0))).client;
  const empty = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client: emptyClient })(context);
  assert.equal(empty.source.status, 'succeeded');
  assert.equal(empty.source.rowCount, 0);
  assert.equal((empty.evidence as SupabaseAdapterEvidence).selectedRowCount, 0);
  assert.equal(empty.source.dataThrough, null);
  assert.equal(empty.source.stale, true);
  assert.equal(empty.values.currentRows, null);
  assert.equal(empty.values.monthSpend, null);
});

test('uses exact decimal aggregation and rejects lossy ratio aggregates', async () => {
  const exactClient = mockClient(verified(ok([
    row('a', '2026-08-18', 0.1, 1),
    row('b', '2026-08-19', 0.2, 1),
  ], 2))).client;
  const exact = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client: exactClient })(context);
  assert.equal(exact.source.status, 'succeeded');
  assert.equal(exact.values.monthSpend, 0.3);

  const lossyClient = mockClient([ok([
    row('a', '2026-08-18', 1e-300, 1),
    row('b', '2026-08-19', 1e300, 1),
  ], 2)]).client;
  const lossy = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client: lossyClient })(context);
  assert.notEqual(lossy.source.status, 'succeeded');
  assert.equal(lossy.failure?.code, 'malformed_row');
  assert.deepEqual(lossy.values, emptyValues);
});

test('scalar value mapping preserves verified zero and distinguishes null or absent values', async () => {
  const contract = defineApprovedSupabaseRelationContract({
    sourceKey: 'budget', clientKey: 'fixture', project: 'prepass', relation: 'approved_budget_daily',
    dateColumn: 'report_date', uniqueOrderColumn: 'id', filters: [{ column: 'client', operator: 'eq', value: 'fixture' }],
    mapping: { kind: 'value', valueColumn: 'budget', target: 'budget', aggregation: 'single', window: 'month' },
  });
  for (const [raw, expected] of [[0, 0], [null, null]] as const) {
    const { client } = mockClient(verified(ok([{ id: 'a', report_date: '2026-08-19', budget: raw }], 1)));
    const result = await createDeterministicSupabaseRelationAdapter(contract, { client })(context);
    assert.equal(result.source.status, 'succeeded');
    assert.equal(result.values.budget, expected);
  }
  const { client } = mockClient(verified(ok([], 0)));
  const absent = await createDeterministicSupabaseRelationAdapter(contract, { client })(context);
  assert.equal(absent.values.budget, null);
});

test('scalar sum uses its exact inclusive window and rejects lossy decimal totals', async () => {
  const contract = defineApprovedSupabaseRelationContract({
    sourceKey: 'hours', clientKey: 'fixture', project: 'prepass', relation: 'approved_hours_daily',
    dateColumn: 'report_date', uniqueOrderColumn: 'id', filters: [{ column: 'client', operator: 'eq', value: 'fixture' }],
    mapping: { kind: 'value', valueColumn: 'hours', target: 'hoursUsed', aggregation: 'sum', window: 'current' },
  });
  const exactMock = mockClient(verified(ok([
    { id: 'a', report_date: '2026-08-18', hours: 0.1 },
    { id: 'b', report_date: '2026-08-19', hours: 0.2 },
  ], 2)));
  const exact = await createDeterministicSupabaseRelationAdapter(contract, { client: exactMock.client })(context);
  assert.equal(exact.values.hoursUsed, 0.3);
  assert.ok(exactMock.calls.some((call) => call.method === 'gte' && call.args[1] === context.windows.current.start));
  assert.ok(exactMock.calls.some((call) => call.method === 'lte' && call.args[1] === context.windows.current.end));

  const lossyClient = mockClient([ok([
    { id: 'a', report_date: '2026-08-18', hours: 1e-300 },
    { id: 'b', report_date: '2026-08-19', hours: 1e300 },
  ], 2)]).client;
  const lossy = await createDeterministicSupabaseRelationAdapter(contract, { client: lossyClient })(context);
  assert.notEqual(lossy.source.status, 'succeeded');
  assert.deepEqual(lossy.values, emptyValues);
});

test('approved contracts are client-bound and raw objects cannot bypass contract approval', async () => {
  assert.throws(
    () => createDeterministicSupabaseRelationAdapter({ ...ratioContract() } as never, undefined as never),
    /approved Supabase relation contract/i,
  );
  const arbitraryPrepassContract = defineApprovedSupabaseRelationContract({
    sourceKey: 'arbitrary', clientKey: 'fixture', project: 'prepass', relation: 'arbitrary_relation',
    dateColumn: 'arbitrary_date', uniqueOrderColumn: 'arbitrary_id', filters: [],
    mapping: { kind: 'ratio', spendColumn: 'arbitrary_spend', resultsColumn: 'arbitrary_results' },
  });
  assert.throws(
    () => createDeterministicSupabaseRelationAdapter(arbitraryPrepassContract, undefined as never),
    /explicitly injected Supabase client/i,
  );
  const wrongContext = { ...context, clientKey: 'other-client' };
  await assert.rejects(
    createDeterministicSupabaseRelationAdapter(ratioContract(), { client: mockClient([]).client })(wrongContext),
    /client does not match/i,
  );
});

test('reports data-through freshness and creates a sanitized deterministic fingerprint independent of filter ordering', async () => {
  const firstClient = mockClient(verified(ok([row('a', '2026-08-18', 1, 1)], 1))).client;
  const secondClient = mockClient(verified(ok([row('a', '2026-08-18', 1, 1)], 1))).client;
  const first = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client: firstClient })(context);
  const second = await createDeterministicSupabaseRelationAdapter(ratioContract([...ratioContract().filters].reverse()), { client: secondClient })(context);
  assert.equal(first.source.dataThrough, '2026-08-18');
  assert.equal(first.source.stale, true);
  assert.match(first.evidence.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(first.evidence.requestFingerprint, second.evidence.requestFingerprint);
  const serialized = JSON.stringify(first.evidence);
  for (const forbidden of ['token', 'authorization', 'headers', 'rawResponse', 'sql']) assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
});

test('ratio adapter output feeds the deterministic engine fixture without reshaping', async () => {
  const { client } = mockClient(verified(ok([
    row('p', '2026-08-05', 50, 1),
    row('c', '2026-08-19', 40, 1),
  ], 2)));
  const adapted = await createDeterministicSupabaseRelationAdapter(ratioContract(), { client })(context);
  const metricConfig: EngineMetricConfig[] = [
    { key: 'budget_pacing', required: true, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['paid_media'] },
    { key: 'north_star', required: true, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['paid_media'] },
    { key: 'hours', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 1, yellowThreshold: 2, sourceKeys: ['optional'] },
    { key: 'overdue_tasks', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 1, yellowThreshold: 2, sourceKeys: ['optional'] },
    { key: 'margin', required: false, weight: 1, direction: 'higher_is_better', greenThreshold: 1, yellowThreshold: 0, sourceKeys: ['optional'] },
  ];
  const snapshot = buildClientHealthSnapshot({
    clientKey: context.clientKey, configApproved: true, lastCompleteSourceDate: context.lastCompleteDate,
    calculationVersion: 'fixture', metricConfig, sources: [adapted.source], values: adapted.values,
  });
  assert.equal(snapshot.values.currentCostPerResult, 40);
  assert.equal(snapshot.values.previousCostPerResult, 50);
});
