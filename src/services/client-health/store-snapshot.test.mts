import assert from 'node:assert/strict';
import test from 'node:test';

import { assembleClientHealthSnapshot, type SnapshotAssemblyInput } from './build-snapshot.ts';
import {
  buildSnapshotPersistenceBundle,
  storeSnapshot,
  type AtomicSnapshotPersistencePort,
  type SnapshotPersistenceBundle,
} from './store-snapshot.ts';
import type { ClientHealthValueInputs, EngineMetricConfig } from './engine.ts';

const REFRESH_RUN_ID = '11111111-1111-4111-8111-111111111111';
const CONFIG_REVISION_ID = '99999999-9999-8999-8999-999999999999';
const CONFIG_REVISION_HASH = '9'.repeat(64);
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const SNAPSHOT_DATE = '2026-08-19';
const CALCULATED_AT = '2026-08-20T12:00:00.000Z';
const RETRIEVED_AT = '2026-08-20T11:00:00.000Z';
const OWNERSHIP = {
  signal: new AbortController().signal,
  invocationId: '88888888-8888-4888-8888-888888888888',
  claimAttemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  fencingToken: 1,
};
const HASHES = { paid: 'a'.repeat(64), click: 'b'.repeat(64), margin: 'c'.repeat(64), alias: 'd'.repeat(64) };

const emptyValues = (): ClientHealthValueInputs => ({
  budget: null, monthSpend: null, currentRows: null, previousRows: null,
  hoursUsed: null, hoursAllotted: null, overdueTaskCount: null, revenue: null, fulfillmentCost: null,
});

const metricConfig: EngineMetricConfig[] = [
  { key: 'budget_pacing', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['paid'] },
  { key: 'north_star', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
  { key: 'hours', required: true, weight: 20, direction: 'lower_is_better', greenThreshold: 90, yellowThreshold: 110, sourceKeys: ['click'] },
  { key: 'overdue_tasks', required: true, weight: 15, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 2, sourceKeys: ['click'] },
  { key: 'margin', required: true, weight: 15, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['margin'] },
];

function assemblyInput(overdueTaskCount = 0): SnapshotAssemblyInput {
  const tasks = Array.from({ length: Math.min(overdueTaskCount, 5) }, (_, index) => {
    const id = `T${index + 1}`;
    return {
      id,
      listId: index % 2 ? '789' : '456',
      name: `Task ${id}`,
      url: `https://app.clickup.com/t/${id}`,
      dueAt: `2026-08-${String(10 + index).padStart(2, '0')}T12:00:00.000Z`,
    };
  });
  return {
    clientId: CLIENT_ID,
    clientKey: 'example',
    configApproved: true,
    calculationVersion: 'health-v1',
    sourceContractVersion: 'sources-v1',
    snapshotDate: SNAPSHOT_DATE,
    retrievedAt: RETRIEVED_AT,
    phoenix: {
      month: { start: '2026-08-01', end: SNAPSHOT_DATE },
      current: { start: '2026-08-06', end: SNAPSHOT_DATE },
      previous: { start: '2026-07-23', end: '2026-08-05' },
      elapsedMonthDays: 19,
      daysInMonth: 31,
      comparisonDays: 14,
    },
    metricConfig: structuredClone(metricConfig),
    requiredSourceKeys: ['paid', 'click', 'margin'],
    optionalSourceKeys: [],
    sourceBindings: {
      paid: {
        sourceKey: 'paid', provider: 'supabase', project: 'eic', relation: 'approved_daily_facts',
        requestFingerprint: HASHES.paid, permittedValueFields: ['monthSpend', 'currentRows', 'previousRows'],
        permitsTasks: false, expectedDataThrough: SNAPSHOT_DATE,
      },
      click: {
        sourceKey: 'click', provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks',
        requestFingerprint: HASHES.click, permittedValueFields: ['hoursUsed', 'overdueTaskCount'],
        permitsTasks: true, expectedDataThrough: SNAPSHOT_DATE,
      },
      margin: {
        sourceKey: 'margin', provider: 'google-sheets', spreadsheetId: 'approved-sheet', range: "'Margin'!A1:E100",
        approvedClientAliasHash: HASHES.alias, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
        requestFingerprint: HASHES.margin, permittedValueFields: ['revenue', 'fulfillmentCost'], permitsTasks: false,
        expectedDataThrough: SNAPSHOT_DATE,
      },
    },
    fixedValues: { monthlyBudget: 3_100, monthlyHoursAllotment: 20 },
    sourceResults: [
      {
        source: { key: 'paid', status: 'succeeded', dataThrough: SNAPSHOT_DATE, stale: false, rowCount: 2 },
        values: {
          ...emptyValues(), monthSpend: 1_900,
          currentRows: [{ spend: 100, results: 2 }], previousRows: [{ spend: 100, results: 1 }],
        },
        evidence: {
          sourceKey: 'paid', provider: 'supabase', project: 'eic', relation: 'approved_daily_facts',
          retrievedAt: RETRIEVED_AT, sourceContractVersion: 'sources-v1', requestFingerprint: HASHES.paid,
          selectedRowCount: 2,
        },
        failure: null,
      },
      {
        source: { key: 'click', status: 'succeeded', dataThrough: SNAPSHOT_DATE, stale: false, rowCount: 1 + overdueTaskCount },
        values: { ...emptyValues(), hoursUsed: 1, overdueTaskCount },
        tasks,
        evidence: {
          sourceKey: 'click', provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks',
          retrievedAt: RETRIEVED_AT, sourceContractVersion: 'sources-v1', requestFingerprint: HASHES.click,
          timeEntryCount: 1, totalDurationMs: '3600000', overdueTaskCount,
        },
        failure: null,
      },
      {
        source: { key: 'margin', status: 'succeeded', dataThrough: SNAPSHOT_DATE, stale: false, rowCount: 1 },
        values: { ...emptyValues(), revenue: 10_000, fulfillmentCost: 3_000 },
        evidence: {
          sourceKey: 'margin', provider: 'google-sheets', spreadsheetId: 'approved-sheet', range: "'Margin'!A1:E100",
          approvedClientAliasHash: HASHES.alias, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
          sourceContractVersion: 'sources-v1', requestFingerprint: HASHES.margin, matchedRowCount: 1,
        },
        failure: null,
      },
    ],
  };
}

function input(overdueTaskCount = 0) {
  return {
    refreshRunId: REFRESH_RUN_ID,
    configRevisionId: CONFIG_REVISION_ID,
    configRevisionHash: CONFIG_REVISION_HASH,
    assembly: assembleClientHealthSnapshot(assemblyInput(overdueTaskCount)),
    snapshotDate: SNAPSHOT_DATE,
    calculatedAt: CALCULATED_AT,
  };
}

function receipt(bundle: SnapshotPersistenceBundle) {
  return {
    refreshRunId: bundle.snapshot.refreshRunId,
    configRevisionId: bundle.configRevisionId,
    configRevisionHash: bundle.configRevisionHash,
    clientId: bundle.snapshot.clientId,
    snapshotId: bundle.snapshotId,
    taskCount: bundle.tasks.length,
    evidenceHash: bundle.evidenceHash,
    idempotencyKey: bundle.idempotencyKey,
  };
}

function mockPort(respond: (bundle: SnapshotPersistenceBundle) => unknown | Promise<unknown>) {
  const calls: SnapshotPersistenceBundle[] = [];
  const port: AtomicSnapshotPersistencePort = {
    async persistSnapshotBundle(bundle) {
      calls.push(structuredClone(bundle));
      return respond(bundle);
    },
  };
  return { port, calls };
}

test('projects a full healthy assembly into the exact allowlisted snapshot repository input', () => {
  const assembly = input();
  assert.equal(assembly.assembly.snapshot.status, 'healthy');
  const bundle = buildSnapshotPersistenceBundle(assembly);
  assert.match(bundle.snapshotId, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.match(bundle.idempotencyKey, /^[a-f0-9]{64}$/);
  assert.equal(bundle.evidenceHash, assembly.assembly.evidenceHash);
  assert.equal(bundle.snapshot.refreshRunId, REFRESH_RUN_ID);
  assert.equal(bundle.snapshot.clientId, CLIENT_ID);
  assert.equal(bundle.snapshot.snapshotDate, SNAPSHOT_DATE);
  assert.equal(bundle.snapshot.currentWindowEnd, SNAPSHOT_DATE);
  assert.equal(bundle.snapshot.budget, 3_100);
  assert.equal(bundle.snapshot.monthSpend, 1_900);
  assert.equal(bundle.snapshot.currentResultCount, 2);
  assert.equal(bundle.snapshot.previousResultCount, 1);
  assert.equal(bundle.snapshot.marginPercent, 70);
  assert.equal(bundle.snapshot.calculatedAt, CALCULATED_AT);
  assert.deepEqual(Object.keys(bundle.snapshot).sort(), [
    'budget', 'calculatedAt', 'clientId', 'currentCostPerResult', 'currentResultCount', 'currentSpend',
    'currentWindowEnd', 'currentWindowStart', 'dataThrough', 'dimensionStatuses', 'evidenceHash', 'expectedSpend', 'fulfillmentCost',
    'hoursAllotted', 'hoursUsed', 'marginPercent', 'monthSpend', 'overallScore', 'overallStatus', 'overdueTaskCount',
    'previousCostPerResult', 'previousResultCount', 'previousSpend', 'previousWindowEnd', 'previousWindowStart',
    'projectedHours', 'reasons', 'refreshRunId', 'revenue', 'snapshotDate', 'sourceStatuses',
  ].sort());
  assert.equal('calculationHash' in bundle.snapshot, false);
});

test('persists bounded North Star lane facts and rejects tampering that disagrees with the parent', () => {
  const source = assemblyInput();
  source.northStarLanes = [{
    key: 'cpl', label: 'Cost per lead target', formula: 'cost_per_result', evaluation: 'absolute_target',
    required: true, weight: 100, direction: 'lower_is_better', greenThreshold: 25, yellowThreshold: 35, sourceKeys: ['paid'],
  }];
  const storeInput = {
    refreshRunId: REFRESH_RUN_ID,
    configRevisionId: CONFIG_REVISION_ID,
    configRevisionHash: CONFIG_REVISION_HASH,
    assembly: assembleClientHealthSnapshot(source),
    snapshotDate: SNAPSHOT_DATE,
    calculatedAt: CALCULATED_AT,
  };
  const bundle = buildSnapshotPersistenceBundle(storeInput);
  const northStar = bundle.snapshot.dimensionStatuses.north_star as { facts: { lanes: Array<Record<string, unknown>> } };
  assert.deepEqual(northStar.facts.lanes.map(({ key, formula, evaluation }) => ({ key, formula, evaluation })), [
    { key: 'cpl', formula: 'cost_per_result', evaluation: 'absolute_target' },
  ]);
  assert.equal('sourceKeys' in northStar.facts.lanes[0], false);
  assert.equal('greenThreshold' in northStar.facts.lanes[0], false);

  const tampered = structuredClone(storeInput);
  const dimension = tampered.assembly.snapshot.dimensions.north_star;
  dimension.facts!.lanes[0].evaluationValue = 999;
  assert.throws(() => buildSnapshotPersistenceBundle(tampered), /do not match their parent dimension/i);

  const changed = structuredClone(source);
  changed.sourceResults[0].values.currentRows = [{ spend: 90, results: 2 }];
  const changedBundle = buildSnapshotPersistenceBundle({ ...storeInput, assembly: assembleClientHealthSnapshot(changed) });
  assert.notEqual(changedBundle.idempotencyKey, bundle.idempotencyKey);
  assert.notEqual(changedBundle.evidenceHash, bundle.evidenceHash);
});

test('preserves valid fractional attribution result totals', () => {
  const source = assemblyInput();
  source.sourceResults[0].values.currentRows = [{ spend: 100, results: 1.25 }];
  source.sourceResults[0].values.previousRows = [{ spend: 100, results: 0.5 }];
  const bundle = buildSnapshotPersistenceBundle({
    refreshRunId: REFRESH_RUN_ID,
    configRevisionId: CONFIG_REVISION_ID,
    configRevisionHash: CONFIG_REVISION_HASH,
    assembly: assembleClientHealthSnapshot(source),
    snapshotDate: SNAPSHOT_DATE,
    calculatedAt: CALCULATED_AT,
  });
  assert.equal(bundle.snapshot.currentResultCount, 1.25);
  assert.equal(bundle.snapshot.previousResultCount, 0.5);
});

test('preserves incomplete, verified zero, and unavailable null values exactly', () => {
  const value = input();
  value.assembly.snapshot.status = 'incomplete';
  value.assembly.snapshot.score = null;
  value.assembly.snapshot.values.monthSpend = 0;
  value.assembly.snapshot.values.currentSpend = 0;
  value.assembly.snapshot.values.currentResultCount = 0;
  value.assembly.snapshot.values.currentCostPerResult = null;
  value.assembly.snapshot.values.revenue = null;
  value.assembly.snapshot.values.marginPercent = null;
  const snapshot = buildSnapshotPersistenceBundle(value).snapshot;
  assert.equal(snapshot.overallStatus, 'incomplete');
  assert.equal(snapshot.overallScore, null);
  assert.equal(snapshot.monthSpend, 0);
  assert.equal(snapshot.currentSpend, 0);
  assert.equal(snapshot.currentResultCount, 0);
  assert.equal(snapshot.currentCostPerResult, null);
  assert.equal(snapshot.revenue, null);
  assert.equal(snapshot.marginPercent, null);
});

test('maps ordered top tasks including canonical listId and display rank', () => {
  const bundle = buildSnapshotPersistenceBundle(input(2));
  assert.deepEqual(bundle.tasks, [
    {
      refreshRunId: REFRESH_RUN_ID, snapshotId: bundle.snapshotId, clickupTaskId: 'T1', listId: '456',
      taskName: 'Task T1', taskUrl: 'https://app.clickup.com/t/T1', dueAt: '2026-08-10T12:00:00.000Z', displayRank: 1,
    },
    {
      refreshRunId: REFRESH_RUN_ID, snapshotId: bundle.snapshotId, clickupTaskId: 'T2', listId: '789',
      taskName: 'Task T2', taskUrl: 'https://app.clickup.com/t/T2', dueAt: '2026-08-11T12:00:00.000Z', displayRank: 2,
    },
  ]);
});

test('identical retries and source object order produce byte-identical bundle payloads and keys', () => {
  const first = input(2);
  const second = structuredClone(first);
  second.assembly.sources = Object.fromEntries(Object.entries(second.assembly.sources).reverse());
  second.assembly.snapshot.sources = Object.fromEntries(Object.entries(second.assembly.snapshot.sources).reverse());
  const a = buildSnapshotPersistenceBundle(first);
  const b = buildSnapshotPersistenceBundle(second);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.idempotencyKey, b.idempotencyKey);
});

test('changed authoritative assembly hash or projected data changes bundle identity', () => {
  const original = input();
  const hashChanged = structuredClone(original);
  hashChanged.assembly.evidenceHash = 'e'.repeat(64);
  const dataChanged = structuredClone(original);
  dataChanged.assembly.snapshot.values.monthSpend = 1_901;
  const a = buildSnapshotPersistenceBundle(original);
  const b = buildSnapshotPersistenceBundle(hashChanged);
  const c = buildSnapshotPersistenceBundle(dataChanged);
  assert.notEqual(a.snapshotId, b.snapshotId);
  assert.notEqual(a.idempotencyKey, b.idempotencyKey);
  assert.equal(a.snapshotId, c.snapshotId);
  assert.notEqual(a.idempotencyKey, c.idempotencyKey);
});

test('authoritative assembly evidenceHash, never inner calculationHash, drives bundle identity', () => {
  const first = input();
  const second = structuredClone(first);
  second.assembly.snapshot.calculationHash = 'f'.repeat(64);
  assert.notEqual(first.assembly.evidenceHash, first.assembly.snapshot.calculationHash);
  assert.deepEqual(buildSnapshotPersistenceBundle(first), buildSnapshotPersistenceBundle(second));
});

test('unknown fields and secret-bearing metadata are excluded from payload and idempotency key', () => {
  const first = input(2);
  const second = structuredClone(first);
  (first.assembly as unknown as Record<string, unknown>).credential = 'secret-one';
  (second.assembly as unknown as Record<string, unknown>).credential = 'secret-two';
  (first.assembly.snapshot as unknown as Record<string, unknown>).rawPayload = { token: 'private-one' };
  (second.assembly.snapshot as unknown as Record<string, unknown>).rawPayload = { token: 'private-two' };
  (first.assembly.sources.paid as unknown as Record<string, unknown>).authorization = 'Bearer one';
  (second.assembly.sources.paid as unknown as Record<string, unknown>).authorization = 'Bearer two';
  (first.assembly.tasks[0] as unknown as Record<string, unknown>).description = 'secret body one';
  (second.assembly.tasks[0] as unknown as Record<string, unknown>).description = 'secret body two';
  const a = buildSnapshotPersistenceBundle(first);
  const b = buildSnapshotPersistenceBundle(second);
  assert.deepEqual(a, b);
  assert.equal(/secret|private|Bearer|credential|rawPayload|description/.test(JSON.stringify(a)), false);
});

test('rejects noncanonical UUIDs, timestamps, dates, hashes, and mismatched window dates before persistence', () => {
  const cases: Array<[string, (value: ReturnType<typeof input>) => void, RegExp]> = [
    ['uuid', (value) => { value.refreshRunId = '11111111-1111-4111-8111-11111111111A'; }, /canonical UUID/i],
    ['client uuid', (value) => { value.assembly.clientId = 'client-1'; }, /canonical UUID/i],
    ['timestamp', (value) => { value.calculatedAt = '2026-08-20T12:00:00Z'; }, /canonical ISO timestamp/i],
    ['date', (value) => { value.snapshotDate = '2026-8-19'; }, /YYYY-MM-DD/i],
    ['hash', (value) => { value.assembly.evidenceHash = 'A'.repeat(64); }, /lowercase SHA-256/i],
    ['window', (value) => { value.snapshotDate = '2026-08-18'; }, /exceeds snapshotDate|window end date/i],
  ];
  for (const [name, mutate, expected] of cases) {
    const value = input();
    mutate(value);
    assert.throws(() => buildSnapshotPersistenceBundle(value), expected, name);
  }
});

test('rejects assembly client, source, task, and rank consistency violations', () => {
  const cases: Array<[string, (value: ReturnType<typeof input>) => void, RegExp]> = [
    ['source keys', (value) => { delete value.assembly.sources.paid; }, /source key sets/i],
    ['source status', (value) => { value.assembly.sources.paid.stale = true; }, /metadata does not match/i],
    ['task count', (value) => { value.assembly.tasks = []; }, /task count/i],
    ['rank', (value) => { value.assembly.tasks[0].rank = 2; }, /contiguous rank/i],
    ['task source', (value) => { value.assembly.sources.click.status = 'failed'; value.assembly.snapshot.sources.click.status = 'failed'; }, /succeeded ClickUp/i],
  ];
  for (const [name, mutate, expected] of cases) {
    const value = input(2);
    mutate(value);
    assert.throws(() => buildSnapshotPersistenceBundle(value), expected, name);
  }
});

test('rejects non-JSON and nonfinite projected values', () => {
  const nonfinite = input();
  nonfinite.assembly.snapshot.dimensions.margin.value = Number.POSITIVE_INFINITY;
  assert.throws(() => buildSnapshotPersistenceBundle(nonfinite), /finite number/i);
  const nonJson = input();
  (nonJson.assembly.snapshot.dimensions.margin as unknown as Record<string, unknown>).reason = Symbol('non-json');
  assert.throws(() => buildSnapshotPersistenceBundle(nonJson), /reason must be a nonempty string/i);
});

test('performs exactly one atomic port call and returns the database-authoritative receipt', async () => {
  const { port, calls } = mockPort((bundle) => receipt(bundle));
  const result = await storeSnapshot(port, input(2), OWNERSHIP);
  assert.equal(calls.length, 1);
  assert.deepEqual(result, receipt(calls[0]));
});

test('accepts database-derived snapshot identity and proof receipt fields', async () => {
  const { port } = mockPort((bundle) => ({
    ...receipt(bundle),
    snapshotId: '33333333-3333-4333-8333-333333333333',
    evidenceHash: 'f'.repeat(64),
    idempotencyKey: 'e'.repeat(64),
  }));
  const result = await storeSnapshot(port, input(2), OWNERSHIP);
  assert.equal(result.snapshotId, '33333333-3333-4333-8333-333333333333');
  assert.equal(result.evidenceHash, 'f'.repeat(64));
  assert.equal(result.idempotencyKey, 'e'.repeat(64));
});

test('rejects malformed, extra-field, and caller-bound receipt mismatches without a second call', async () => {
  const mutations: Array<(expected: ReturnType<typeof receipt>) => unknown> = [
    () => null,
    (expected) => ({ ...expected, extra: true }),
    (expected) => ({ ...expected, refreshRunId: '33333333-3333-4333-8333-333333333333' }),
    (expected) => ({ ...expected, clientId: '33333333-3333-4333-8333-333333333333' }),
    (expected) => ({ ...expected, taskCount: expected.taskCount + 1 }),
    (expected) => ({ ...expected, evidenceHash: 'not-a-hash' }),
    (expected) => ({ ...expected, idempotencyKey: 'not-a-hash' }),
  ];
  for (const mutate of mutations) {
    const { port, calls } = mockPort((bundle) => mutate(receipt(bundle)));
    await assert.rejects(storeSnapshot(port, input(2), OWNERSHIP), /receipt/i);
    assert.equal(calls.length, 1);
  }
});

test('transactional failure propagates unchanged with one call and no compensation', async () => {
  const failure = new Error('transaction rolled back');
  const { port, calls } = mockPort(() => { throw failure; });
  await assert.rejects(storeSnapshot(port, input(), OWNERSHIP), (error) => error === failure);
  assert.equal(calls.length, 1);
});

test('focused production persistence file contains no Canary strings, routes, or credential access', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => (
    readFile(new URL('./store-snapshot.ts', import.meta.url), 'utf8')
  ));
  assert.equal(/canary|createEicSupabaseClient|process\.env|service[_-]?role|\/api\//i.test(source), false);
});
