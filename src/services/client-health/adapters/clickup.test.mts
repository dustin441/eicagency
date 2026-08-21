import assert from 'node:assert/strict';
import test from 'node:test';

import { buildClientHealthSnapshot, type EngineMetricConfig } from '../engine.ts';
import { canonicalEvidenceHash } from '../evidence.ts';
import { createApprovedProductionClickUpAdapter } from './clickup-production.ts';
import {
  createDeterministicClickUpAdapter,
  defineInjectedClickUpContract,
  type ClickUpFilteredTeamTasksRequest,
  type ClickUpFilteredTeamTasksResponse,
  type ClickUpHttpClient,
  type ClickUpTimeEntriesRequest,
  type ClickUpTimeEntriesResponse,
} from './clickup.ts';
import type { AdapterContext } from './types.ts';

type Call = { endpoint: 'time' | 'tasks'; request: ClickUpTimeEntriesRequest | ClickUpFilteredTeamTasksRequest };

function mockClient(
  timeResponses: Array<ClickUpTimeEntriesResponse | Error>,
  taskResponses: Array<ClickUpFilteredTeamTasksResponse | Error>,
  teamId = '123',
) {
  const calls: Call[] = [];
  const take = <T,>(responses: Array<T | Error>) => {
    const response = responses.shift();
    assert.ok(response, 'missing mocked ClickUp response');
    if (response instanceof Error) throw response;
    return Promise.resolve(response);
  };
  const client: ClickUpHttpClient = {
    teamId,
    getTeamTimeEntries(request) { calls.push({ endpoint: 'time', request }); return take(timeResponses); },
    getFilteredTeamTasks(request) { calls.push({ endpoint: 'tasks', request }); return take(taskResponses); },
  };
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
  sourceContractVersion: 'clickup-fixture-v1',
};

const contract = () => defineInjectedClickUpContract({
  sourceKey: 'clickup',
  clientKey: 'fixture',
  teamId: '123',
  approvedListIds: ['456', '789'],
  timezone: 'America/Phoenix',
  contractVersion: 'clickup-fixture-v1',
});

const ms = (iso: string) => String(Date.parse(iso));
const data = (items: unknown[]): ClickUpTimeEntriesResponse => ({ data: items });
const page = (tasks: unknown[], lastPage = true): ClickUpFilteredTeamTasksResponse => ({
  tasks,
  last_page: lastPage,
});
const time = (id: string, start: string, duration: string | number, listId: string | number = '456') => {
  const startMs = Date.parse(start);
  const durationNumber = typeof duration === 'number' ? duration : Number(duration);
  return {
    id,
    start: String(startMs),
    end: String(startMs + durationNumber),
    duration,
    task_location: { list_id: listId },
    user: { email: 'private@example.test' },
    description: 'private time entry description',
  };
};
const task = (
  id: string,
  due: string,
  listId: string | number = '456',
  status: { status: unknown; type: unknown } = { status: 'open', type: 'open' },
) => ({
  id,
  name: `Task ${id}`,
  url: `https://app.clickup.com/t/${id}`,
  due_date: ms(due),
  list: { id: listId, name: 'private list name' },
  status,
  description: 'private task description',
  comments: [{ comment_text: 'private comment' }],
  assignees: [{ email: 'private@example.test' }],
});
const verified = <T,>(responses: T[]): T[] => [...responses, ...responses];
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

function adapter(
  timeResponses: Array<ClickUpTimeEntriesResponse | Error>,
  taskResponses: Array<ClickUpFilteredTeamTasksResponse | Error>,
  options: { maxPages?: number } = {},
) {
  const mocked = mockClient(timeResponses, taskResponses);
  return {
    ...mocked,
    run: createDeterministicClickUpAdapter(contract(), { client: mocked.client, ...options }),
  };
}

test('stable complete empty scans preserve verified zero using fixed Phoenix windows', async () => {
  const { run, calls } = adapter(verified([data([])]), verified([page([])]));
  const result = await run(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.dataThrough, context.lastCompleteDate);
  assert.equal(result.source.stale, false);
  assert.equal(result.source.rowCount, 0);
  assert.equal(result.values.hoursUsed, 0);
  assert.equal(result.values.overdueTaskCount, 0);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.evidence.timeEntryCount, 0);
  assert.equal(result.evidence.totalDurationMs, '0');
  assert.equal(result.evidence.overdueTaskCount, 0);
  assert.equal(result.failure, null);
  assert.equal(result.evidence.requestFingerprint, canonicalEvidenceHash({
    endpointFamily: 'team-time-entries-and-overdue-tasks',
    teamId: '123',
    approvedListIds: ['456', '789'],
    timeEntries: {
      endpoint: '/team/{team_Id}/time_entries',
      inclusiveWindowMs: {
        start: ms('2026-08-01T07:00:00.000Z'),
        end: ms('2026-08-20T06:59:59.999Z'),
      },
      includeLocationNames: true,
      continuation: 'complete-data-array-no-page-or-cursor',
      listScope: 'local-task_location-list_id-filter',
    },
    filteredTeamTasks: {
      endpoint: '/team/{team_Id}/task',
      dueDateLtMs: ms('2026-08-20T07:00:00.000Z'),
      includeClosed: false,
      subtasks: true,
      orderBy: 'due_date',
      reverse: false,
      listIds: ['456', '789'],
      pagination: { semantics: 'zero-based-page-with-explicit-last_page', fixedPageLimit: 100, maxPages: 100 },
    },
    contractVersion: 'clickup-fixture-v1',
    timezone: 'America/Phoenix',
    clientKey: 'fixture',
  }));

  const timeRequest = calls.find((call) => call.endpoint === 'time')?.request as ClickUpTimeEntriesRequest;
  assert.equal(timeRequest.startDateMs, ms('2026-08-01T07:00:00.000Z'));
  assert.equal(timeRequest.endDateMs, ms('2026-08-20T06:59:59.999Z'));
  assert.equal(timeRequest.includeLocationNames, true);
  assert.equal('page' in timeRequest, false);
  assert.equal('cursor' in timeRequest, false);
  assert.equal('approvedListIds' in timeRequest, false);
  const taskRequest = calls.find((call) => call.endpoint === 'tasks')?.request as ClickUpFilteredTeamTasksRequest;
  assert.deepEqual(taskRequest.listIds, ['456', '789']);
  assert.equal(taskRequest.dueDateLtMs, ms('2026-08-20T07:00:00.000Z'));
  assert.equal(taskRequest.includeClosed, false);
  assert.equal(taskRequest.orderBy, 'due_date');
  assert.equal(JSON.stringify(calls).includes(context.retrievedAt), false, 'retrieval clock must not shape source windows');
});

test('rejects a month window that starts in the prior month and year', async () => {
  const januaryContext: AdapterContext = {
    ...context,
    lastCompleteDate: '2026-01-19',
    windows: {
      ...context.windows,
      month: { start: '2025-12-01', end: '2026-01-19' },
      current: { start: '2026-01-06', end: '2026-01-19' },
      previous: { start: '2025-12-23', end: '2026-01-05' },
    },
  };
  const mocked = mockClient([], []);

  await assert.rejects(
    createDeterministicClickUpAdapter(contract(), { client: mocked.client })(januaryContext),
    /month window must start on the first day of lastCompleteDate's month/i,
  );
  assert.deepEqual(mocked.calls, []);
});

test('concurrent adapter calls are request-scoped and share no time-entry cursor state', async () => {
  const calls: Call[] = [];
  const client: ClickUpHttpClient = {
    teamId: '123',
    async getTeamTimeEntries(request) {
      calls.push({ endpoint: 'time', request });
      await Promise.resolve();
      return data([time('stable', '2026-08-10T07:00:00.000Z', '1')]);
    },
    async getFilteredTeamTasks(request) {
      calls.push({ endpoint: 'tasks', request });
      await Promise.resolve();
      return page([]);
    },
  };
  const run = createDeterministicClickUpAdapter(contract(), { client });
  const [left, right] = await Promise.all([run(context), run(context)]);
  assert.equal(left.source.status, 'succeeded');
  assert.deepEqual(right, left);
  assert.equal(calls.filter((call) => call.endpoint === 'time').length, 4);
  assert.equal(calls.filter((call) => call.endpoint === 'time').some((call) => 'page' in call.request || 'cursor' in call.request), false);
  assert.deepEqual(calls.filter((call) => call.endpoint === 'tasks').map((call) => (call.request as ClickUpFilteredTeamTasksRequest).page), [0, 0, 0, 0]);
});

test('collects a complete >100 time array and paginates tasks at the fixed 100-row boundary', async () => {
  const entries = Array.from({ length: 101 }, (_, index) => time(
    `time-${String(index).padStart(3, '0')}`,
    new Date(Date.parse('2026-08-10T07:00:00.000Z') + (index * 10)).toISOString(),
    '1',
    index % 2 === 0 ? '456' : '789',
  ));
  const leadingTasks = Array.from({ length: 100 }, (_, index) => task(
    `later-${String(index).padStart(3, '0')}`,
    '2026-08-18T07:00:00.000Z',
  ));
  const tasks = [...leadingTasks,
    task('z', '2026-08-11T07:00:00.000Z'),
    task('b', '2026-08-09T07:00:00.000Z'),
    task('a', '2026-08-09T07:00:00.000Z'),
    task('d', '2026-08-10T07:00:00.000Z', '789'),
    task('c', '2026-08-10T07:00:00.000Z'),
    task('e', '2026-08-10T07:00:00.000Z'),
  ];
  const taskPages = [page(tasks.slice(0, 100), false), page(tasks.slice(100), true)];
  const { run, calls } = adapter(verified([data(entries)]), verified(taskPages), { maxPages: 3 });
  const result = await run(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.rowCount, 207);
  assert.equal(result.evidence.timeEntryCount, 101);
  assert.equal(result.evidence.totalDurationMs, '101');
  assert.equal(result.values.hoursUsed, 101 / 3_600_000);
  assert.equal(result.values.overdueTaskCount, 106);
  assert.deepEqual(result.tasks.map((item) => item.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(Object.keys(result.tasks[0]).sort(), ['dueAt', 'id', 'listId', 'name', 'url']);
  assert.equal(calls.filter((call) => call.endpoint === 'time').length, 2);
  assert.equal(calls.filter((call) => call.endpoint === 'time').some((call) => 'page' in call.request), false);
  assert.deepEqual(calls.filter((call) => call.endpoint === 'tasks').map((call) => (call.request as ClickUpFilteredTeamTasksRequest).page), [0, 1, 0, 1]);
});

test('sums integer durations exactly in milliseconds and rejects fractional, negative, nonfinite, unsafe, or inconsistent values', async () => {
  const exactEntries = [
    time('a', '2026-08-10T07:00:00.000Z', '1'),
    time('b', '2026-08-10T08:00:00.000Z', '3599999'),
  ];
  const exact = await adapter(verified([data(exactEntries)]), verified([page([])])).run(context);
  assert.equal(exact.evidence.totalDurationMs, '3600000');
  assert.equal(exact.values.hoursUsed, 1);

  for (const [name, duration] of [
    ['fractional string', '1.5'],
    ['negative', '-1'],
    ['nonfinite', Number.POSITIVE_INFINITY],
    ['unsafe number', Number.MAX_SAFE_INTEGER + 1],
    ['unsafe string', '9007199254740992'],
    ['noncanonical', '01'],
  ] as const) {
    const bad = time('bad', '2026-08-10T07:00:00.000Z', duration);
    const result = await adapter([data([bad])], []).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.deepEqual(result.tasks, [], name);
    assert.equal(result.evidence.totalDurationMs, null, name);
  }

  const inconsistent = time('bad', '2026-08-10T07:00:00.000Z', '2');
  inconsistent.end = String(Number(inconsistent.start) + 1);
  const result = await adapter([data([inconsistent])], []).run(context);
  assert.equal(result.failure?.code, 'malformed_row');
  assert.deepEqual(result.values, emptyValues);
});

test('locally scopes team time entries before strict normalization and ignores unrelated digest changes', async () => {
  const approved = time('approved', '2026-08-10T07:00:00.000Z', '1000', 456);
  const first = data([
    approved,
    time('outside-a', 'not-a-date', 'not-a-duration', 999),
    { id: 'non-task', duration: 'private unrelated payload' },
    null,
  ]);
  const second = data([
    { id: 'non-task-changed', task_location: null },
    time('outside-b', 'also-not-a-date', -1, '999'),
    approved,
  ]);
  const result = await adapter(
    [first, second],
    verified([page([task('integer-list-task', '2026-08-10T07:00:00.000Z', 456)])]),
  ).run(context);

  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.rowCount, 2);
  assert.equal(result.evidence.totalDurationMs, '1000');
  assert.equal(result.values.hoursUsed, 1000 / 3_600_000);
  assert.equal(result.values.overdueTaskCount, 1);

  const malformedApproved = { ...approved, id: undefined };
  const failed = await adapter([data([malformedApproved])], []).run(context);
  assert.equal(failed.failure?.code, 'malformed_row');
  assert.deepEqual(failed.values, emptyValues);
});

test('fails closed on duplicate, malformed, closed, scoped, and out-of-window source rows', async () => {
  const timeCases: Array<[string, unknown[]]> = [
    ['duplicate IDs', [time('x', '2026-08-10T07:00:00.000Z', '1'), time('x', '2026-08-10T08:00:00.000Z', '1')]],
    ['missing ID', [{ ...time('x', '2026-08-10T07:00:00.000Z', '1'), id: undefined }]],
    ['before month', [time('x', '2026-07-31T07:00:00.000Z', '1')]],
    ['noncanonical timestamp', [{ ...time('x', '2026-08-10T07:00:00.000Z', '1'), start: '01' }]],
  ];
  for (const [name, rows] of timeCases) {
    const result = await adapter([data(rows)], []).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
  }

  const taskCases: Array<[string, unknown[]]> = [
    ['duplicate task IDs', [task('x', '2026-08-10T07:00:00.000Z'), task('x', '2026-08-11T07:00:00.000Z')]],
    ['missing due', [{ ...task('x', '2026-08-10T07:00:00.000Z'), due_date: undefined }]],
    ['missing list', [{ ...task('x', '2026-08-10T07:00:00.000Z'), list: undefined }]],
    ['missing status', [{ ...task('x', '2026-08-10T07:00:00.000Z'), status: undefined }]],
    ['empty status text', [task('x', '2026-08-10T07:00:00.000Z', '456', { status: ' ', type: 'open' })]],
    ['closed', [task('x', '2026-08-10T07:00:00.000Z', '456', { status: 'complete', type: 'closed' })]],
    ['wrong list', [task('x', '2026-08-10T07:00:00.000Z', '999')]],
    ['after cutoff', [task('x', '2026-08-20T07:00:00.000Z')]],
  ];
  for (const [name, rows] of taskCases) {
    const result = await adapter([data([])], [page(rows)]).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.deepEqual(result.tasks, [], name);
  }
});

test('accepts only ClickUp open and custom task status types', async () => {
  const acceptedTasks = [
    task('open', '2026-08-10T07:00:00.000Z', '456', { status: 'to do', type: 'open' }),
    task('custom', '2026-08-11T07:00:00.000Z', '789', { status: 'in progress', type: 'custom' }),
  ];
  const accepted = await adapter(verified([data([])]), verified([page(acceptedTasks)])).run(context);
  assert.equal(accepted.source.status, 'succeeded');
  assert.equal(accepted.values.overdueTaskCount, 2);
  assert.deepEqual(accepted.tasks.map((item) => item.id), ['open', 'custom']);

  for (const type of ['closed', 'done', 'nonsense', 'OPEN', ' custom ', '', null, {}]) {
    const rejected = await adapter(
      [data([])],
      [page([task('bad', '2026-08-10T07:00:00.000Z', '456', { status: 'open', type })])],
    ).run(context);
    assert.equal(rejected.failure?.code, 'malformed_row', String(type));
    assert.deepEqual(rejected.values, emptyValues, String(type));
    assert.deepEqual(rejected.tasks, [], String(type));
  }
});

test('requires identical complete time arrays and complete task scans, not equal counts alone', async () => {
  const first = data([time('a', '2026-08-10T07:00:00.000Z', '1')]);
  const mutated = data([time('b', '2026-08-10T07:00:00.000Z', '1')]);
  const result = await adapter([first, mutated], verified([page([])])).run(context);
  assert.equal(result.failure?.code, 'source_changed');
  assert.deepEqual(result.values, emptyValues);

  const a = task('a', '2026-08-10T07:00:00.000Z');
  const b = task('b', '2026-08-11T07:00:00.000Z');
  const changingPages = await adapter(verified([data([])]), [
    page([a], false), page([b], true),
    page([b], false), page([a], true),
  ], { maxPages: 2 }).run(context);
  assert.equal(changingPages.failure?.code, 'source_changed');
});

test('fails closed on time envelope errors and malformed task endpoint metadata', async () => {
  const secret = 'private token-bearing transport error';
  for (const [name, responses, code] of [
    ['transport', [new Error(secret)], 'query_failed'],
    ['payload error', [{ data: [], error: { message: secret } }], 'query_failed'],
    ['missing data', [{}], 'incomplete_page'],
  ] as const) {
    const result = await adapter([...responses] as Array<ClickUpTimeEntriesResponse | Error>, []).run(context);
    assert.equal(result.failure?.code, code, name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.equal(result.evidence.timeEntryCount, null, name);
    assert.equal(result.evidence.overdueTaskCount, null, name);
    assert.equal(JSON.stringify(result).includes(secret), false, name);
  }

  const overLimit = Array.from({ length: 101 }, (_, index) => task(String(index), '2026-08-10T07:00:00.000Z'));
  for (const [name, responses, options, code] of [
    ['transport', [new Error(secret)], {}, 'query_failed'],
    ['payload error', [{ ...page([]), error: { message: secret } }], {}, 'query_failed'],
    ['nonboolean last_page', [{ ...page([]), last_page: 'true' }], {}, 'incomplete_page'],
    ['missing tasks', [{ last_page: true }], {}, 'incomplete_page'],
    ['over 100 rows', [page(overLimit)], {}, 'incomplete_page'],
    ['premature empty', [page([], false)], {}, 'incomplete_page'],
    ['max pages', [page([task('a', '2026-08-10T07:00:00.000Z')], false)], { maxPages: 1 }, 'max_pages'],
  ] as const) {
    const result = await adapter([data([])], [...responses] as Array<ClickUpFilteredTeamTasksResponse | Error>, options).run(context);
    assert.equal(result.failure?.code, code, name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.equal(result.evidence.timeEntryCount, null, name);
    assert.equal(result.evidence.overdueTaskCount, null, name);
    assert.equal(JSON.stringify(result).includes(secret), false, name);
  }

  const partial = await adapter([data([])], [
    page([task('a', '2026-08-10T07:00:00.000Z')], false),
    new Error(secret),
  ]).run(context);
  assert.equal(partial.source.status, 'partial');
  assert.equal(partial.failure?.code, 'partial_query');
  assert.deepEqual(partial.values, emptyValues);
});

test('contract, context, and injected client scopes cannot be bypassed', async () => {
  assert.throws(() => defineInjectedClickUpContract({
    sourceKey: 'bad', clientKey: 'fixture', teamId: '123', approvedListIds: [],
    timezone: 'America/Phoenix', contractVersion: 'v1',
  }), /one static/i);
  assert.throws(
    () => createDeterministicClickUpAdapter({ ...contract() } as never, { client: mockClient([], []).client }),
    /injected ClickUp contract/i,
  );
  assert.throws(() => createDeterministicClickUpAdapter(contract(), {} as never), /explicitly injected/i);
  assert.throws(
    () => createDeterministicClickUpAdapter(contract(), { client: mockClient([], [], '999').client }),
    /client team does not match/i,
  );
  for (const changed of [
    { ...context, clientKey: 'other' },
    { ...context, timezone: 'UTC' },
    { ...context, sourceContractVersion: 'other' },
  ]) {
    await assert.rejects(
      createDeterministicClickUpAdapter(contract(), { client: mockClient([], []).client })(changed),
      /does not match/i,
    );
  }
});

test('production ClickUp allowlist is empty and rejects unknown, arbitrary, and Canary keys', async () => {
  for (const key of ['unknown', 'fixture', 'canary:anything', '123:456', '', null]) {
    assert.throws(() => createApprovedProductionClickUpAdapter(key as never), /unsupported production ClickUp adapter key/i);
  }
  assert.deepEqual(Object.keys(await import('./clickup-production.ts')), ['createApprovedProductionClickUpAdapter']);
  const genericModule = await import('./clickup.ts');
  assert.equal('CLICKUP_LIST_CLIENTS' in genericModule, false);
  assert.equal('defineApprovedClickUpContract' in genericModule, false);
  assert.equal('ApprovedClickUpContract' in genericModule, false);
});

test('evidence and top-task output are deterministic, allowlisted, and privacy-sanitized', async () => {
  const entries = [time('a', '2026-08-10T07:00:00.000Z', '1000')];
  const tasks = [task('a', '2026-08-10T07:00:00.000Z')];
  const result = await adapter(verified([data(entries)]), verified([page(tasks)])).run(context);
  assert.match(result.evidence.requestFingerprint, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    'token', 'authorization', 'headers', 'rawresponse', 'private time entry description',
    'private task description', 'private comment', 'private@example.test', 'private list name',
  ]) assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  assert.deepEqual(result.tasks, [{
    id: 'a',
    listId: '456',
    name: 'Task a',
    url: 'https://app.clickup.com/t/a',
    dueAt: '2026-08-10T07:00:00.000Z',
  }]);
});

test('ClickUp adapter values feed the engine without reshaping', async () => {
  const adapted = await adapter(
    verified([data([time('a', '2026-08-10T07:00:00.000Z', '3600000')])]),
    verified([page([task('a', '2026-08-10T07:00:00.000Z')])]),
  ).run(context);
  const metricConfig: EngineMetricConfig[] = [
    { key: 'budget_pacing', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['optional'] },
    { key: 'north_star', required: false, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['optional'] },
    { key: 'hours', required: true, weight: 1, direction: 'lower_is_better', greenThreshold: 100, yellowThreshold: 200, sourceKeys: ['clickup'] },
    { key: 'overdue_tasks', required: true, weight: 1, direction: 'lower_is_better', greenThreshold: 1, yellowThreshold: 2, sourceKeys: ['clickup'] },
    { key: 'margin', required: false, weight: 1, direction: 'higher_is_better', greenThreshold: 1, yellowThreshold: 0, sourceKeys: ['optional'] },
  ];
  const snapshot = buildClientHealthSnapshot({
    clientKey: context.clientKey,
    configApproved: true,
    lastCompleteSourceDate: context.lastCompleteDate,
    calculationVersion: 'fixture',
    metricConfig,
    sources: [adapted.source],
    values: { ...adapted.values, hoursAllotted: 10 },
  });
  assert.equal(snapshot.values.hoursUsed, 1);
  assert.equal(snapshot.values.overdueTaskCount, 1);
  assert.notEqual(snapshot.dimensions.hours.status, 'unavailable');
  assert.notEqual(snapshot.dimensions.overdue_tasks.status, 'unavailable');
});
