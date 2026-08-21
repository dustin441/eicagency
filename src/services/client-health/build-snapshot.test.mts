import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleClientHealthSnapshot,
  type CompletedSourceAdapterResult,
  type SnapshotAssemblyInput,
} from './build-snapshot.ts';
import type { ClientHealthValueInputs, EngineMetricConfig } from './engine.ts';

const HASH = 'a'.repeat(64);
const retrievedAt = '2026-08-20T12:00:00.000Z';
const emptyValues = (): ClientHealthValueInputs => ({
  budget: null, monthSpend: null, currentRows: null, previousRows: null,
  hoursUsed: null, hoursAllotted: null, overdueTaskCount: null, revenue: null, fulfillmentCost: null,
});
const configs: EngineMetricConfig[] = [
  { key: 'budget_pacing', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['paid'] },
  { key: 'north_star', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
  { key: 'hours', required: true, weight: 20, direction: 'lower_is_better', greenThreshold: 90, yellowThreshold: 110, sourceKeys: ['click'] },
  { key: 'overdue_tasks', required: true, weight: 15, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 2, sourceKeys: ['click'] },
  { key: 'margin', required: true, weight: 15, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['margin'] },
];

function evidence(sourceKey: string, extra: Record<string, unknown> = {}) {
  return {
    sourceKey,
    project: 'eic' as const,
    relation: `${sourceKey}_facts`,
    retrievedAt,
    sourceContractVersion: 'sources-v1',
    requestFingerprint: HASH,
    ...extra,
  };
}

function result(sourceKey: string, values: Partial<ClientHealthValueInputs>, extra: Record<string, unknown> = {}): CompletedSourceAdapterResult {
  const sourceEvidence = 'tasks' in extra ? {
    sourceKey,
    provider: 'clickup' as const,
    endpointFamily: 'team-time-entries-and-overdue-tasks' as const,
    retrievedAt,
    sourceContractVersion: 'sources-v1',
    requestFingerprint: HASH,
    totalDurationMs: '0',
    overdueTaskCount: Array.isArray(extra.tasks) ? extra.tasks.length : null,
  } : evidence(sourceKey);
  return {
    source: { key: sourceKey, status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 1 },
    values: { ...emptyValues(), ...values },
    evidence: sourceEvidence,
    failure: null,
    ...extra,
  } as CompletedSourceAdapterResult;
}

const clickTask = (id: string, dueAt = '2026-08-10T12:00:00.000Z') => ({
  id,
  name: `Task ${id}`,
  url: `https://app.clickup.com/t/${id}`,
  dueAt,
});

function clickUpAdapterFixture(
  totalDurationMs = '3600000',
  overdueTaskCount = 1,
  tasks = [clickTask('task-1')],
): CompletedSourceAdapterResult {
  return {
    source: { key: 'click', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 2 },
    values: { ...emptyValues(), hoursUsed: Number(totalDurationMs) / 3_600_000, overdueTaskCount },
    tasks,
    evidence: {
      sourceKey: 'click',
      provider: 'clickup',
      endpointFamily: 'team-time-entries-and-overdue-tasks',
      retrievedAt,
      sourceContractVersion: 'sources-v1',
      requestFingerprint: HASH,
      totalDurationMs,
      overdueTaskCount,
    },
    failure: null,
  };
}

function baseInput(): SnapshotAssemblyInput {
  return {
    clientId: 'client-1',
    clientKey: 'example',
    configApproved: true,
    calculationVersion: 'health-v1',
    sourceContractVersion: 'sources-v1',
    snapshotDate: '2026-08-19',
    retrievedAt,
    phoenix: {
      month: { start: '2026-08-01', end: '2026-08-19' },
      current: { start: '2026-08-06', end: '2026-08-19' },
      previous: { start: '2026-07-23', end: '2026-08-05' },
      elapsedMonthDays: 19,
      daysInMonth: 31,
      comparisonDays: 14,
    },
    metricConfig: configs.map((config) => ({ ...config, sourceKeys: [...config.sourceKeys] })),
    requiredSourceKeys: ['paid', 'click', 'margin'],
    optionalSourceKeys: [],
    ratioSourceKeys: ['paid'],
    fixedValues: { monthlyBudget: 3_100, monthlyHoursAllotment: 20 },
    sourceResults: [
      result('paid', { monthSpend: 1_900, currentRows: [{ spend: 100, results: 0 }], previousRows: [{ spend: 100, results: 2 }] }),
      result('click', { hoursUsed: 0, overdueTaskCount: 0 }, { tasks: [] }),
      result('margin', { revenue: 0, fulfillmentCost: 0 }),
    ],
  };
}

function failed(sourceKey: string, status: 'partial' | 'failed' = 'failed'): CompletedSourceAdapterResult {
  return {
    source: { key: sourceKey, status, dataThrough: null, stale: true, rowCount: status === 'partial' ? 1 : null },
    values: emptyValues(),
    evidence: evidence(sourceKey),
    failure: { code: 'query_failed', reason: 'The approved source query failed.' },
  };
}

test('assembles approved success and preserves verified zeros and engine compatibility', () => {
  const assembled = assembleClientHealthSnapshot(baseInput());
  assert.equal(assembled.clientId, 'client-1');
  assert.equal(assembled.snapshot.values.budget, 3_100);
  assert.equal(assembled.snapshot.values.hoursUsed, 0);
  assert.equal(assembled.snapshot.values.overdueTaskCount, 0);
  assert.equal(assembled.snapshot.values.currentResultCount, 0);
  assert.equal(assembled.snapshot.status, 'at_risk');
  assert.match(assembled.evidenceHash, /^[a-f0-9]{64}$/);
});

test('adds missing required sources and partial/stale required sources remain incomplete', () => {
  for (const mutate of [
    (input: SnapshotAssemblyInput) => { input.sourceResults = input.sourceResults.filter((item) => item.source.key !== 'paid'); },
    (input: SnapshotAssemblyInput) => { input.sourceResults = input.sourceResults.map((item) => item.source.key === 'paid' ? failed('paid', 'partial') : item); },
    (input: SnapshotAssemblyInput) => { input.sourceResults[0].source.stale = true; },
  ]) {
    const input = baseInput();
    mutate(input);
    const assembled = assembleClientHealthSnapshot(input);
    assert.equal(assembled.snapshot.status, 'incomplete');
    assert.equal(assembled.snapshot.score, null);
  }
  const missing = baseInput();
  missing.sourceResults = missing.sourceResults.filter((item) => item.source.key !== 'paid');
  assert.equal(assembleClientHealthSnapshot(missing).sources.paid.status, 'missing');
});

test('accepts the approved Supabase adapter empty-success fixture and lets the engine mark it incomplete', () => {
  const input = baseInput();
  const approvedSupabaseEmptyFixture: CompletedSourceAdapterResult = {
    source: { key: 'paid', status: 'succeeded', dataThrough: null, stale: true, rowCount: 0 },
    values: emptyValues(),
    evidence: evidence('paid'),
    failure: null,
  };
  input.sourceResults = input.sourceResults.map((item) => item.source.key === 'paid' ? approvedSupabaseEmptyFixture : item);
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.sources.paid.status, 'succeeded');
  assert.equal(assembled.sources.paid.dataThrough, null);
  assert.equal(assembled.sources.paid.stale, true);
  assert.equal(assembled.sources.paid.rowCount, 0);
  assert.equal(assembled.snapshot.status, 'incomplete');
  assert.equal(assembled.snapshot.score, null);
});

test('unapproved early gate ignores malicious malformed configuration and adapter payloads', () => {
  const first = baseInput() as unknown as Record<string, unknown>;
  first.configApproved = false;
  first.metricConfig = { secret: 'metric-secret' };
  first.requiredSourceKeys = 'bad';
  first.sourceResults = [{ rawError: new Error('token=secret'), values: { monthSpend: Number.NaN } }];
  const second = baseInput() as unknown as Record<string, unknown>;
  second.configApproved = false;
  second.metricConfig = null;
  second.sourceResults = null;
  const a = assembleClientHealthSnapshot(first as unknown as SnapshotAssemblyInput);
  const b = assembleClientHealthSnapshot(second as unknown as SnapshotAssemblyInput);
  assert.equal(a.snapshot.status, 'configuration_required');
  assert.deepEqual(a.tasks, []);
  assert.deepEqual(a.sources, {});
  assert.equal(a.evidenceHash, b.evidenceHash);
});

test('rejects duplicate and unknown source results', () => {
  const duplicate = baseInput();
  duplicate.sourceResults.push(result('paid', {}));
  assert.throws(() => assembleClientHealthSnapshot(duplicate), /duplicate source adapter result/i);
  const unknown = baseInput();
  unknown.sourceResults.push(result('rogue', {}));
  assert.throws(() => assembleClientHealthSnapshot(unknown), /unknown source key/i);
});

test('rejects scalar collisions while preserving null as unavailable', () => {
  const input = baseInput();
  input.optionalSourceKeys = ['paid-2'];
  input.sourceResults.push(result('paid-2', { monthSpend: 0 }));
  assert.throws(() => assembleClientHealthSnapshot(input), /monthSpend has multiple providers/i);

  const noCollision = baseInput();
  noCollision.optionalSourceKeys = ['null-only'];
  noCollision.sourceResults.push(result('null-only', {}));
  assert.equal(assembleClientHealthSnapshot(noCollision).snapshot.values.monthSpend, 1_900);
});

test('concatenates ratio rows only from explicitly approved sources in canonical order', () => {
  const first = baseInput();
  first.optionalSourceKeys = ['paid-2'];
  first.ratioSourceKeys = ['paid-2', 'paid'];
  first.sourceResults.push(result('paid-2', {
    currentRows: [{ spend: 5, results: 1 }, { spend: 1, results: 1 }],
    previousRows: [],
  }));
  const second = structuredClone(first);
  second.sourceResults.reverse();
  second.sourceResults[1].values.currentRows?.reverse();
  const a = assembleClientHealthSnapshot(first);
  const b = assembleClientHealthSnapshot(second);
  assert.equal(a.snapshot.values.currentSpend, 106);
  assert.equal(a.evidenceHash, b.evidenceHash);

  const forbidden = baseInput();
  forbidden.optionalSourceKeys = ['other'];
  forbidden.sourceResults.push(result('other', { currentRows: [] }));
  assert.throws(() => assembleClientHealthSnapshot(forbidden), /not approved to provide ratio rows/i);
});

test('discards failed-source value and task leakage and returns only sanitized failure metadata', () => {
  const input = baseInput();
  const leaking = clickUpAdapterFixture() as CompletedSourceAdapterResult & { tasks: unknown[]; rawError: unknown };
  leaking.source = { key: 'click', status: 'failed', dataThrough: null, stale: true, rowCount: null };
  leaking.failure = { code: 'query_failed', reason: 'The approved ClickUp query failed.' };
  leaking.values.hoursUsed = 999;
  leaking.values.overdueTaskCount = 999;
  leaking.tasks = [{ id: 'leaked', name: 'secret', url: 'not-valid', dueAt: 'bad' }];
  leaking.rawError = new Error('credential');
  input.sourceResults = input.sourceResults.map((item) => item.source.key === 'click' ? leaking : item);
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.snapshot.values.hoursUsed, null);
  assert.equal(assembled.snapshot.values.overdueTaskCount, null);
  assert.deepEqual(assembled.tasks, []);
  assert.deepEqual(assembled.sources.click.failure, leaking.failure);
  assert.equal(assembled.sources.click.evidence?.totalDurationMs, null);
  assert.equal(assembled.sources.click.evidence?.overdueTaskCount, null);
  assert.equal('rawError' in assembled.sources.click, false);
});

test('validates task fields, rejects duplicate IDs, and deterministically ranks the ClickUp top five', () => {
  const input = baseInput();
  const tasks = Array.from({ length: 5 }, (_, index) => ({
    id: `task-${5 - index}`,
    name: `Task ${index}`,
    url: `https://app.clickup.com/t/task-${5 - index}`,
    dueAt: `2026-08-${String(10 + (index % 3)).padStart(2, '0')}T12:00:00.000Z`,
  }));
  input.sourceResults[1] = clickUpAdapterFixture('3600000', 7, tasks);
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.tasks.length, 5);
  assert.deepEqual(assembled.tasks.map((task) => task.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(assembled.tasks.map((task) => task.id), ['task-2', 'task-5', 'task-1', 'task-4', 'task-3']);

  const duplicate = baseInput();
  const task = { id: 'same', name: 'Same', url: 'https://app.clickup.com/t/same', dueAt: '2026-08-01T00:00:00.000Z' };
  duplicate.sourceResults[1] = clickUpAdapterFixture('0', 2, [task, task]);
  assert.throws(() => assembleClientHealthSnapshot(duplicate), /duplicate task ID/i);
});

test('accepts a valid ClickUp adapter output fixture with exact cross-field evidence', () => {
  const input = baseInput();
  input.sourceResults[1] = clickUpAdapterFixture('3600001', 1, [clickTask('exact')]);
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.snapshot.values.hoursUsed, 3600001 / 3_600_000);
  assert.equal(assembled.snapshot.values.overdueTaskCount, 1);
  assert.deepEqual(assembled.tasks.map((task) => task.id), ['exact']);
});

test('rejects forged succeeded ClickUp payloads with missing or mismatched cross-fields', () => {
  const cases: Array<[string, (fixture: CompletedSourceAdapterResult & Record<string, unknown>) => void, RegExp]> = [
    ['missing tasks', (fixture) => { delete fixture.tasks; }, /tasks must be an array/i],
    ['missing duration evidence', (fixture) => { (fixture.evidence as unknown as Record<string, unknown>).totalDurationMs = null; }, /totalDurationMs evidence/i],
    ['missing count evidence', (fixture) => { (fixture.evidence as unknown as Record<string, unknown>).overdueTaskCount = null; }, /overdueTaskCount evidence/i],
    ['missing hours value', (fixture) => { fixture.values.hoursUsed = null; }, /hoursUsed must be non-null/i],
    ['missing count value', (fixture) => { fixture.values.overdueTaskCount = null; }, /overdueTaskCount must be non-null/i],
    ['hours mismatch', (fixture) => { fixture.values.hoursUsed = 2; }, /hoursUsed does not match/i],
    ['count mismatch', (fixture) => { fixture.values.overdueTaskCount = 2; }, /overdueTaskCount does not match/i],
    ['task length mismatch', (fixture) => { fixture.tasks = []; }, /tasks length does not match/i],
    ['zero count with task', (fixture) => {
      fixture.values.overdueTaskCount = 0;
      (fixture.evidence as unknown as Record<string, unknown>).overdueTaskCount = 0;
    }, /tasks length does not match/i],
  ];
  for (const [name, forge, expected] of cases) {
    const input = baseInput();
    const fixture = clickUpAdapterFixture() as CompletedSourceAdapterResult & Record<string, unknown>;
    forge(fixture);
    input.sourceResults[1] = fixture;
    assert.throws(() => assembleClientHealthSnapshot(input), expected, name);
  }

  const nonClickUp = baseInput();
  (nonClickUp.sourceResults[0] as CompletedSourceAdapterResult & { tasks?: unknown[] }).tasks = [];
  assert.throws(() => assembleClientHealthSnapshot(nonClickUp), /not an approved task-list source/i);
});

test('rejects nonfinite and negative scalar and ratio values before the engine', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const scalar = baseInput();
    scalar.sourceResults[0].values.monthSpend = bad;
    assert.throws(() => assembleClientHealthSnapshot(scalar), /finite|nonnegative/i);
    const row = baseInput();
    row.sourceResults[0].values.currentRows = [{ spend: bad, results: 1 }];
    assert.throws(() => assembleClientHealthSnapshot(row), /finite|nonnegative/i);
  }
});

test('source result order does not affect assembly evidence hash', () => {
  const first = baseInput();
  const second = baseInput();
  second.sourceResults.reverse();
  assert.equal(assembleClientHealthSnapshot(first).evidenceHash, assembleClientHealthSnapshot(second).evidenceHash);
});

test('uses explicit UTF-16 code-unit ordering without consulting localeCompare', () => {
  const first = baseInput();
  first.optionalSourceKeys = ['\uE000', '😀', 'ä', 'Z'];
  for (const key of first.optionalSourceKeys) first.sourceResults.push(result(key, {}));
  const second = structuredClone(first);
  second.optionalSourceKeys.reverse();
  second.sourceResults.reverse();
  const originalLocaleCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = function forbiddenLocaleCompare(): never {
    throw new Error('localeCompare must not shape canonical assembly');
  };
  try {
    const a = assembleClientHealthSnapshot(first);
    const b = assembleClientHealthSnapshot(second);
    assert.deepEqual(Object.keys(a.sources), ['Z', 'click', 'margin', 'paid', 'ä', '😀', '\uE000']);
    assert.equal(a.evidenceHash, b.evidenceHash);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
});

test('adapter evidence is allowlisted and arbitrary secrets do not enter metadata or hash', () => {
  const first = baseInput();
  (first.sourceResults[0].evidence as unknown as Record<string, unknown>).accessToken = 'secret-one';
  (first.sourceResults[0] as unknown as Record<string, unknown>).rawResponse = { body: 'private' };
  const second = baseInput();
  (second.sourceResults[0].evidence as unknown as Record<string, unknown>).accessToken = 'secret-two';
  const a = assembleClientHealthSnapshot(first);
  const b = assembleClientHealthSnapshot(second);
  assert.equal(a.evidenceHash, b.evidenceHash);
  assert.equal('accessToken' in a.sources.paid.evidence!, false);
});

test('enforces succeeded/failure/data-through invariants and fixed configuration ownership', () => {
  const succeededFailure = baseInput();
  succeededFailure.sourceResults[0].failure = { code: 'query_failed', reason: 'Failed.' };
  assert.throws(() => assembleClientHealthSnapshot(succeededFailure), /succeeded with a failure/i);

  const noDate = baseInput();
  noDate.sourceResults[0].source.dataThrough = null;
  assert.throws(() => assembleClientHealthSnapshot(noDate), /succeeded without dataThrough must be stale/i);

  const noDateWithRows = baseInput();
  noDateWithRows.sourceResults[0].source.dataThrough = null;
  noDateWithRows.sourceResults[0].source.stale = true;
  assert.throws(() => assembleClientHealthSnapshot(noDateWithRows), /rowCount 0/i);

  const fixedCollision = baseInput();
  fixedCollision.sourceResults[0].values.budget = 1;
  assert.throws(() => assembleClientHealthSnapshot(fixedCollision), /fixed field budget/i);
});
