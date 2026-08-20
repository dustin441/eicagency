import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClientHealthRepository,
  createEicClientHealthRepository,
  type ClientHealthDbClient,
} from './repository.ts';

type DbResponse = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; method: string; args: unknown[] };

function mockDb(responses: Record<string, DbResponse[]>) {
  const calls: Call[] = [];

  class Query implements PromiseLike<DbResponse> {
    private operation = 'select';
    private readonly table: string;

    constructor(table: string) {
      this.table = table;
    }

    select(...args: unknown[]) {
      calls.push({ table: this.table, method: 'select', args });
      return this;
    }

    insert(...args: unknown[]) {
      this.operation = 'insert';
      calls.push({ table: this.table, method: 'insert', args });
      return this;
    }

    update(...args: unknown[]) {
      this.operation = 'update';
      calls.push({ table: this.table, method: 'update', args });
      return this;
    }

    eq(...args: unknown[]) {
      calls.push({ table: this.table, method: 'eq', args });
      return this;
    }

    in(...args: unknown[]) {
      calls.push({ table: this.table, method: 'in', args });
      return this;
    }

    order(...args: unknown[]) {
      calls.push({ table: this.table, method: 'order', args });
      return this;
    }

    single() {
      calls.push({ table: this.table, method: 'single', args: [] });
      return this.result();
    }

    then<TResult1 = DbResponse, TResult2 = never>(
      onfulfilled?: ((value: DbResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.result().then(onfulfilled, onrejected);
    }

    private result(): Promise<DbResponse> {
      const key = `${this.table}:${this.operation}`;
      const response = responses[key]?.shift();
      assert.ok(response, `Missing mock response for ${key}`);
      return Promise.resolve(response);
    }
  }

  const client = {
    from(table: string) {
      calls.push({ table, method: 'from', args: [] });
      return new Query(table);
    },
  } as unknown as ClientHealthDbClient;

  return { client, calls };
}

const ok = (data: unknown): DbResponse => ({ data, error: null });

test('EIC repository routing uses the supplied generalized EIC client factory', () => {
  const { client } = mockDb({});
  let factoryCalls = 0;

  const repository = createEicClientHealthRepository(() => {
    factoryCalls += 1;
    return client;
  });

  assert.equal(factoryCalls, 1);
  assert.ok(repository);
});

test('latest reads map published snapshots with versions, freshness, config, tasks, zeroes, and missing values intact', async () => {
  const latestRows = [
    {
      id: 'snapshot-1', refresh_run_id: 'run-1', client_id: 'client-1', snapshot_date: '2026-08-19',
      data_through: '2026-08-19T06:00:00Z', budget: 1000, month_spend: 0, expected_spend: 600,
      current_window_start: '2026-08-06', current_window_end: '2026-08-19', current_spend: 0,
      current_result_count: 0, current_cost_per_result: null, previous_window_start: '2026-07-23',
      previous_window_end: '2026-08-05', previous_spend: 500, previous_result_count: 10,
      previous_cost_per_result: 50, hours_used: 0, hours_allotted: 20, projected_hours: 0,
      overdue_task_count: 0, revenue: null, fulfillment_cost: null, margin_percent: null,
      dimension_statuses: { budget_pacing: 'healthy', margin: 'incomplete' },
      source_statuses: { paid_media: { status: 'succeeded', dataThrough: '2026-08-19T06:00:00Z', stale: false } },
      overall_status: 'incomplete', overall_score: null, reasons: ['Margin source unavailable'],
      calculated_at: '2026-08-20T01:00:00Z', created_at: '2026-08-20T01:00:00Z',
      updated_at: '2026-08-20T01:00:00Z', calculation_version: 'calc-v2',
      source_contract_version: 'sources-v3', evidence_hash: 'a'.repeat(64),
    },
    {
      id: 'snapshot-2', refresh_run_id: 'run-1', client_id: 'client-2', snapshot_date: '2026-08-19',
      data_through: null, budget: null, month_spend: null, expected_spend: null,
      current_window_start: null, current_window_end: null, current_spend: null,
      current_result_count: null, current_cost_per_result: null, previous_window_start: null,
      previous_window_end: null, previous_spend: null, previous_result_count: null,
      previous_cost_per_result: null, hours_used: null, hours_allotted: null, projected_hours: null,
      overdue_task_count: null, revenue: null, fulfillment_cost: null, margin_percent: null,
      dimension_statuses: {}, source_statuses: {}, overall_status: 'configuration_required',
      overall_score: null, reasons: ['Metric contract awaiting approval'], calculated_at: '2026-08-20T01:00:00Z',
      created_at: '2026-08-20T01:00:00Z', updated_at: '2026-08-20T01:00:00Z',
      calculation_version: 'calc-v2', source_contract_version: 'sources-v3', evidence_hash: 'a'.repeat(64),
    },
  ];
  const { client, calls } = mockDb({
    'client_health_latest:select': [ok(latestRows)],
    'client_health_clients:select': [ok([
      { id: 'client-1', client_key: 'goodgame', display_name: 'Good Game', dashboard_href: '/dashboard/goodgame', active: true, config_status: 'approved', reporting_timezone: 'America/Phoenix', monthly_hours_allotment: 20, clickup_list_ids: ['list-1'], margin_aliases: ['Nappy Boy'], metadata: {} },
      { id: 'client-2', client_key: 'bridgeway', display_name: 'Bridgeway', dashboard_href: '/dashboard/bridgeway', active: true, config_status: 'configuration_required', reporting_timezone: 'America/Phoenix', monthly_hours_allotment: null, clickup_list_ids: [], margin_aliases: [], metadata: {} },
    ])],
    'client_health_snapshot_tasks:select': [ok([
      { refresh_run_id: 'run-1', snapshot_id: 'snapshot-1', clickup_task_id: 'task-1', list_id: 'list-1', task_name: 'Fix tracking', task_url: 'https://app.clickup.com/t/task-1', due_at: '2026-08-18T00:00:00Z', display_rank: 1 },
    ])],
    'client_health_metric_config:select': [ok([
      { id: 'metric-1', client_id: 'client-1', metric_key: 'budget_pacing', label: 'Budget pacing', adapter_key: 'eic.goodgame', required: true, weight: 25, direction: 'lower_is_better', green_threshold: 10, yellow_threshold: 20, source_config: {}, approved_at: '2026-08-01T00:00:00Z', approved_by: 'reviewer' },
    ])],
  });

  const rows = await createClientHealthRepository(client).readLatest();

  assert.equal(rows.length, 2);
  assert.equal(rows[0].client.key, 'goodgame');
  assert.equal(rows[0].status, 'incomplete');
  assert.equal(rows[0].metrics.monthSpend, 0);
  assert.equal(rows[0].metrics.currentResultCount, 0);
  assert.equal(rows[0].metrics.currentCostPerResult, null);
  assert.deepEqual(rows[0].versions, { calculation: 'calc-v2', sourceContract: 'sources-v3' });
  assert.deepEqual(rows[0].freshness.sources.paid_media, {
    status: 'succeeded', dataThrough: '2026-08-19T06:00:00Z', stale: false,
  });
  assert.equal(rows[0].tasks[0].id, 'task-1');
  assert.equal(rows[0].metricConfig[0].key, 'budget_pacing');
  assert.equal(rows[0].metricConfig[0].required, true);
  assert.equal(rows[1].status, 'configuration_required');
  assert.equal(rows[1].metrics.monthSpend, null);
  assert.deepEqual(
    calls.filter((call) => call.method === 'from').map((call) => call.table),
    ['client_health_latest', 'client_health_clients', 'client_health_snapshot_tasks', 'client_health_metric_config'],
  );
});

test('latest reads fail closed when a required boolean is malformed', async () => {
  const { client } = mockDb({
    'client_health_latest:select': [ok([{
      id: 'snapshot-1', refresh_run_id: 'run-1', client_id: 'client-1', snapshot_date: '2026-08-19',
      data_through: null, budget: null, month_spend: null, expected_spend: null,
      current_window_start: null, current_window_end: null, current_spend: null, current_result_count: null,
      current_cost_per_result: null, previous_window_start: null, previous_window_end: null, previous_spend: null,
      previous_result_count: null, previous_cost_per_result: null, hours_used: null, hours_allotted: null,
      projected_hours: null, overdue_task_count: null, revenue: null, fulfillment_cost: null, margin_percent: null,
      dimension_statuses: {}, source_statuses: {}, overall_status: 'incomplete', overall_score: null, reasons: [],
      calculated_at: '2026-08-20T01:00:00Z', calculation_version: 'calc-v2',
      source_contract_version: 'sources-v3', evidence_hash: 'a'.repeat(64),
    }])],
    'client_health_clients:select': [ok([{
      id: 'client-1', client_key: 'goodgame', display_name: 'Good Game', dashboard_href: null,
      active: true, config_status: 'approved', reporting_timezone: 'America/Phoenix',
      monthly_hours_allotment: null, clickup_list_ids: [], margin_aliases: [], metadata: {},
    }])],
    'client_health_snapshot_tasks:select': [ok([])],
    'client_health_metric_config:select': [ok([{
      id: 'metric-1', client_id: 'client-1', metric_key: 'budget_pacing', label: 'Budget pacing',
      adapter_key: 'eic.goodgame', required: 'false', weight: 25, direction: 'lower_is_better',
      green_threshold: 10, yellow_threshold: 20, source_config: {}, approved_at: null, approved_by: null,
    }])],
  });

  await assert.rejects(createClientHealthRepository(client).readLatest(), /invalid required/i);
});

test('database read errors propagate and fail closed without returning partial health data', async () => {
  const { client, calls } = mockDb({
    'client_health_latest:select': [{ data: null, error: { code: '42501', message: 'permission denied' } }],
  });

  await assert.rejects(
    createClientHealthRepository(client).readLatest(),
    /client_health_latest.*permission denied/i,
  );
  assert.deepEqual(calls.filter((call) => call.method === 'from').map((call) => call.table), ['client_health_latest']);
});

test('validation, publication, and failure perform scoped status updates and propagate publication errors', async () => {
  const { client, calls } = mockDb({
    'client_health_refresh_runs:update': [
      ok({ id: 'run-1', run_status: 'validated' }),
      ok({ id: 'run-1', run_status: 'published' }),
      { data: null, error: { code: '23514', message: 'publish gate failed' } },
      ok({ id: 'run-3', run_status: 'failed' }),
    ],
  });
  const repository = createClientHealthRepository(client);

  await repository.validateRefreshRun({
    refreshRunId: 'run-1',
    validatedAt: '2026-08-20T02:00:00Z',
    evidenceHash: 'b'.repeat(64),
  });
  await repository.publishRefreshRun({
    refreshRunId: 'run-1',
    publishedAt: '2026-08-20T02:05:00Z',
  });
  await assert.rejects(
    repository.publishRefreshRun({ refreshRunId: 'run-2', publishedAt: '2026-08-20T02:10:00Z' }),
    /publish gate failed/i,
  );
  await repository.failRefreshRun({
    refreshRunId: 'run-3', finishedAt: '2026-08-20T02:15:00Z',
    errorCode: 'SOURCE_FAILED', errorMessage: 'Source collection failed',
  });

  const updates = calls.filter((call) => call.method === 'update');
  assert.deepEqual(updates[0].args[0], {
    run_status: 'validated',
    validated_at: '2026-08-20T02:00:00Z',
    evidence_hash: 'b'.repeat(64),
  });
  assert.deepEqual(updates[1].args[0], {
    run_status: 'published',
    published_at: '2026-08-20T02:05:00Z',
    finished_at: '2026-08-20T02:05:00Z',
  });
  assert.deepEqual(updates[3].args[0], {
    run_status: 'failed',
    finished_at: '2026-08-20T02:15:00Z',
    error_code: 'SOURCE_FAILED',
    error_message: 'Source collection failed',
  });
  assert.deepEqual(
    calls.filter((call) => call.method === 'eq').map((call) => call.args),
    [
      ['id', 'run-1'], ['run_status', 'collecting'],
      ['id', 'run-1'], ['run_status', 'validated'],
      ['id', 'run-2'], ['run_status', 'validated'],
      ['id', 'run-3'],
    ],
  );
  assert.deepEqual(
    calls.filter((call) => call.method === 'in').map((call) => call.args),
    [['run_status', ['collecting', 'validated']]],
  );
});

test('refresh lifecycle mutations fail closed on missing, malformed, or mismatched returned run identities', async () => {
  const lifecycleCases = [
    {
      responseStatus: 'validated',
      invoke: (repository: ReturnType<typeof createClientHealthRepository>) => repository.validateRefreshRun({
        refreshRunId: 'run-1', validatedAt: '2026-08-20T02:00:00Z', evidenceHash: 'b'.repeat(64),
      }),
    },
    {
      responseStatus: 'published',
      invoke: (repository: ReturnType<typeof createClientHealthRepository>) => repository.publishRefreshRun({
        refreshRunId: 'run-1', publishedAt: '2026-08-20T02:05:00Z',
      }),
    },
    {
      responseStatus: 'failed',
      invoke: (repository: ReturnType<typeof createClientHealthRepository>) => repository.failRefreshRun({
        refreshRunId: 'run-1', finishedAt: '2026-08-20T02:10:00Z',
        errorCode: 'SOURCE_FAILED', errorMessage: 'Source collection failed',
      }),
    },
  ] as const;

  for (const lifecycleCase of lifecycleCases) {
    for (const identityFields of [{}, { id: '' }, { id: 123 }, { id: 'run-2' }]) {
      const { client } = mockDb({
        'client_health_refresh_runs:update': [ok({
          ...identityFields,
          run_status: lifecycleCase.responseStatus,
        })],
      });
      await assert.rejects(
        lifecycleCase.invoke(createClientHealthRepository(client)),
        /invalid refresh_run\.id|unexpected refresh run/i,
      );
    }
  }
});

test('source completion is scoped to its refresh and running state', async () => {
  const { client, calls } = mockDb({
    'client_health_source_runs:update': [ok({ id: 'source-1' })],
  });

  await createClientHealthRepository(client).completeSourceRun({
    id: 'source-1', refreshRunId: 'run-1', status: 'succeeded',
    finishedAt: '2026-08-20T02:00:00Z', dataThrough: '2026-08-20T01:55:00Z', rowCount: 12,
    requestFingerprint: 'request-1', evidence: {},
  });

  assert.deepEqual(
    calls.filter((call) => call.method === 'eq').map((call) => call.args),
    [['id', 'source-1'], ['refresh_run_id', 'run-1'], ['run_status', 'running']],
  );
});

test('source completion fails closed on malformed, missing, or mismatched returned identities', async () => {
  const responses = [
    ok('source-1'),
    ok([{ id: 'source-1' }]),
    ok({}),
    ok({ id: 'source-2' }),
  ];

  for (const response of responses) {
    const { client } = mockDb({ 'client_health_source_runs:update': [response] });
    await assert.rejects(
      createClientHealthRepository(client).completeSourceRun({
        id: 'source-1', refreshRunId: 'run-1', status: 'succeeded',
        finishedAt: '2026-08-20T02:00:00Z', dataThrough: null, rowCount: 0,
        requestFingerprint: null, evidence: {},
      }),
      /malformed row|invalid source_run\.id|unexpected source run/i,
    );
  }
});

test('snapshot task insertion validates returned identities as an order-independent multiset', async () => {
  const task = {
    refreshRunId: 'run-1', snapshotId: 'snapshot-1', clickupTaskId: 'task-1', listId: 'list-1',
    taskName: 'Fix tracking', taskUrl: 'https://app.clickup.com/t/task-1', dueAt: null, displayRank: 1,
  };
  const inputs = [
    task,
    { ...task },
    { ...task, snapshotId: 'snapshot-2', clickupTaskId: 'task-2', displayRank: 2 },
  ];
  const { client, calls } = mockDb({
    'client_health_snapshot_tasks:insert': [ok([
      { snapshot_id: 'snapshot-2', clickup_task_id: 'task-2' },
      { snapshot_id: 'snapshot-1', clickup_task_id: 'task-1' },
      { snapshot_id: 'snapshot-1', clickup_task_id: 'task-1' },
    ])],
  });

  await createClientHealthRepository(client).insertSnapshotTasks(inputs);

  assert.deepEqual(
    calls.find((call) => call.table === 'client_health_snapshot_tasks' && call.method === 'select')?.args,
    ['snapshot_id,clickup_task_id'],
  );
});

test('snapshot task insertion fails closed on scalar, malformed, missing, or mismatched returned identities', async () => {
  const input = {
    refreshRunId: 'run-1', snapshotId: 'snapshot-1', clickupTaskId: 'task-1', listId: 'list-1',
    taskName: 'Fix tracking', taskUrl: 'https://app.clickup.com/t/task-1', dueAt: null, displayRank: 1,
  };
  const responses = [
    ok('snapshot-1'),
    ok([null]),
    ok([]),
    ok([{ snapshot_id: 'snapshot-1' }]),
    ok([{ snapshot_id: 'snapshot-2', clickup_task_id: 'task-1' }]),
  ];

  for (const response of responses) {
    const { client } = mockDb({ 'client_health_snapshot_tasks:insert': [response] });
    await assert.rejects(
      createClientHealthRepository(client).insertSnapshotTasks([input]),
      /malformed rows|invalid snapshot_task\.|did not return all inserted tasks|unexpected task identity/i,
    );
  }
});
