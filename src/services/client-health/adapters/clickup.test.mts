import assert from 'node:assert/strict';
import test from 'node:test';

import { buildClientHealthSnapshot, type EngineMetricConfig } from '../engine.ts';
import { createApprovedProductionClickUpAdapter } from './clickup-production.ts';
import {
  createDeterministicClickUpAdapter,
  defineApprovedClickUpContract,
  type ClickUpHttpClient,
  type ClickUpOverdueTasksRequest,
  type ClickUpPageResponse,
  type ClickUpTimeEntriesRequest,
} from './clickup.ts';
import type { AdapterContext } from './types.ts';

type Call = { endpoint: 'time' | 'tasks'; request: ClickUpTimeEntriesRequest | ClickUpOverdueTasksRequest };

function mockClient(timeResponses: Array<ClickUpPageResponse | Error>, taskResponses: Array<ClickUpPageResponse | Error>, teamId = '123') {
  const calls: Call[] = [];
  const take = (responses: Array<ClickUpPageResponse | Error>) => {
    const response = responses.shift();
    assert.ok(response, 'missing mocked ClickUp page');
    if (response instanceof Error) throw response;
    return Promise.resolve(response);
  };
  const client: ClickUpHttpClient = {
    teamId,
    getTeamTimeEntries(request) { calls.push({ endpoint: 'time', request }); return take(timeResponses); },
    getTeamOverdueTasks(request) { calls.push({ endpoint: 'tasks', request }); return take(taskResponses); },
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

const contract = () => defineApprovedClickUpContract({
  sourceKey: 'clickup',
  clientKey: 'fixture',
  teamId: '123',
  approvedListIds: ['456', '789'],
  timezone: 'America/Phoenix',
  contractVersion: 'clickup-fixture-v1',
});

const ms = (iso: string) => String(Date.parse(iso));
const page = (items: unknown[], lastPage = true, pageNumber = 0): ClickUpPageResponse => ({
  page: pageNumber,
  items,
  lastPage,
});
const time = (id: string, start: string, duration: string | number, listId = '456') => {
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
  listId = '456',
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

function adapter(timeResponses: Array<ClickUpPageResponse | Error>, taskResponses: Array<ClickUpPageResponse | Error>, options: { pageSize?: number; maxPages?: number } = {}) {
  const mocked = mockClient(timeResponses, taskResponses);
  return {
    ...mocked,
    run: createDeterministicClickUpAdapter(contract(), { client: mocked.client, ...options }),
  };
}

test('stable complete empty scans preserve verified zero using fixed Phoenix windows', async () => {
  const { run, calls } = adapter(verified([page([])]), verified([page([])]));
  const result = await run(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.dataThrough, context.lastCompleteDate);
  assert.equal(result.source.stale, false);
  assert.equal(result.source.rowCount, 0);
  assert.equal(result.values.hoursUsed, 0);
  assert.equal(result.values.overdueTaskCount, 0);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.evidence.totalDurationMs, '0');
  assert.equal(result.evidence.overdueTaskCount, 0);
  assert.equal(result.failure, null);

  const timeRequest = calls.find((call) => call.endpoint === 'time')?.request as ClickUpTimeEntriesRequest;
  assert.equal(timeRequest.startDateMs, ms('2026-08-01T07:00:00.000Z'));
  assert.equal(timeRequest.endDateMs, ms('2026-08-20T06:59:59.999Z'));
  assert.deepEqual(timeRequest.approvedListIds, ['456', '789']);
  const taskRequest = calls.find((call) => call.endpoint === 'tasks')?.request as ClickUpOverdueTasksRequest;
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

test('collects multi-page >100-boundary entries and deterministically returns the top five overdue tasks', async () => {
  const entries = Array.from({ length: 101 }, (_, index) => time(
    `time-${String(index).padStart(3, '0')}`,
    new Date(Date.parse('2026-08-10T07:00:00.000Z') + (index * 10)).toISOString(),
    '1',
    index % 2 === 0 ? '456' : '789',
  ));
  const tasks = [
    task('z', '2026-08-11T07:00:00.000Z'),
    task('b', '2026-08-09T07:00:00.000Z'),
    task('a', '2026-08-09T07:00:00.000Z'),
    task('d', '2026-08-10T07:00:00.000Z', '789'),
    task('c', '2026-08-10T07:00:00.000Z'),
    task('e', '2026-08-10T07:00:00.000Z'),
  ];
  const timePages = [page(entries.slice(0, 100), false, 0), page(entries.slice(100), true, 1)];
  const taskPages = [page(tasks.slice(0, 4), false, 0), page(tasks.slice(4), true, 1)];
  const { run, calls } = adapter(verified(timePages), verified(taskPages), { pageSize: 100, maxPages: 3 });
  const result = await run(context);
  assert.equal(result.source.status, 'succeeded');
  assert.equal(result.source.rowCount, 107);
  assert.equal(result.evidence.totalDurationMs, '101');
  assert.equal(result.values.hoursUsed, 101 / 3_600_000);
  assert.equal(result.values.overdueTaskCount, 6);
  assert.deepEqual(result.tasks.map((item) => item.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(Object.keys(result.tasks[0]).sort(), ['dueAt', 'id', 'name', 'url']);
  assert.deepEqual(calls.filter((call) => call.endpoint === 'time').map((call) => call.request.page), [0, 1, 0, 1]);
  assert.deepEqual(calls.filter((call) => call.endpoint === 'tasks').map((call) => call.request.page), [0, 1, 0, 1]);
});

test('sums integer durations exactly in milliseconds and rejects fractional, negative, nonfinite, unsafe, or inconsistent values', async () => {
  const exactEntries = [
    time('a', '2026-08-10T07:00:00.000Z', '1'),
    time('b', '2026-08-10T08:00:00.000Z', '3599999'),
  ];
  const exact = await adapter(verified([page(exactEntries)]), verified([page([])])).run(context);
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
    const result = await adapter([page([bad])], []).run(context);
    assert.notEqual(result.source.status, 'succeeded', name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.deepEqual(result.tasks, [], name);
    assert.equal(result.evidence.totalDurationMs, null, name);
  }

  const inconsistent = time('bad', '2026-08-10T07:00:00.000Z', '2');
  inconsistent.end = String(Number(inconsistent.start) + 1);
  const result = await adapter([page([inconsistent])], []).run(context);
  assert.equal(result.failure?.code, 'malformed_row');
  assert.deepEqual(result.values, emptyValues);
});

test('fails closed on duplicate, malformed, closed, unmapped, and out-of-window source rows', async () => {
  const timeCases: Array<[string, unknown[]]> = [
    ['duplicate IDs', [time('x', '2026-08-10T07:00:00.000Z', '1'), time('x', '2026-08-10T08:00:00.000Z', '1')]],
    ['missing ID', [{ ...time('x', '2026-08-10T07:00:00.000Z', '1'), id: undefined }]],
    ['wrong list', [time('x', '2026-08-10T07:00:00.000Z', '1', '999')]],
    ['before month', [time('x', '2026-07-31T07:00:00.000Z', '1')]],
    ['noncanonical timestamp', [{ ...time('x', '2026-08-10T07:00:00.000Z', '1'), start: '01' }]],
  ];
  for (const [name, rows] of timeCases) {
    const result = await adapter([page(rows)], []).run(context);
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
    const result = await adapter([page([])], [page(rows)]).run(context);
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
  const accepted = await adapter(verified([page([])]), verified([page(acceptedTasks)])).run(context);
  assert.equal(accepted.source.status, 'succeeded');
  assert.equal(accepted.values.overdueTaskCount, 2);
  assert.deepEqual(accepted.tasks.map((item) => item.id), ['open', 'custom']);

  for (const type of ['closed', 'done', 'nonsense', 'OPEN', ' custom ', '', null, {}]) {
    const rejected = await adapter(
      [page([])],
      [page([task('bad', '2026-08-10T07:00:00.000Z', '456', { status: 'open', type })])],
    ).run(context);
    assert.equal(rejected.failure?.code, 'malformed_row', String(type));
    assert.deepEqual(rejected.values, emptyValues, String(type));
    assert.deepEqual(rejected.tasks, [], String(type));
  }
});

test('requires identical complete scan digests, not equal counts alone, and detects changing pages', async () => {
  const first = page([time('a', '2026-08-10T07:00:00.000Z', '1')]);
  const mutated = page([time('b', '2026-08-10T07:00:00.000Z', '1')]);
  const result = await adapter([first, mutated], verified([page([])])).run(context);
  assert.equal(result.failure?.code, 'source_changed');
  assert.deepEqual(result.values, emptyValues);

  const a = time('a', '2026-08-10T07:00:00.000Z', '1');
  const b = time('b', '2026-08-10T08:00:00.000Z', '1');
  const changingPages = await adapter([
    page([a], false, 0), page([b], true, 1),
    page([b], false, 0), page([a], true, 1),
  ], verified([page([])]), { pageSize: 1, maxPages: 2 }).run(context);
  assert.equal(changingPages.failure?.code, 'source_changed');
});

test('fails closed on page transport/errors, malformed metadata, premature empty pages, and max exhaustion', async () => {
  const secret = 'private token-bearing transport error';
  const cases: Array<[string, Array<ClickUpPageResponse | Error>, { pageSize?: number; maxPages?: number }, string]> = [
    ['transport', [new Error(secret)], {}, 'query_failed'],
    ['payload error', [{ ...page([]), error: { message: secret } }], {}, 'query_failed'],
    ['wrong page', [page([], true, 1)], {}, 'incomplete_page'],
    ['premature empty', [page([], false, 0)], {}, 'incomplete_page'],
    ['max pages', [page([time('a', '2026-08-10T07:00:00.000Z', '1')], false, 0)], { pageSize: 1, maxPages: 1 }, 'max_pages'],
  ];
  for (const [name, responses, options, code] of cases) {
    const result = await adapter(responses, [], options).run(context);
    assert.equal(result.failure?.code, code, name);
    assert.deepEqual(result.values, emptyValues, name);
    assert.equal(JSON.stringify(result).includes(secret), false, name);
  }

  const partial = await adapter([
    page([time('a', '2026-08-10T07:00:00.000Z', '1')], false, 0),
    new Error(secret),
  ], [], { pageSize: 1 }).run(context);
  assert.equal(partial.source.status, 'partial');
  assert.equal(partial.failure?.code, 'partial_query');
  assert.deepEqual(partial.values, emptyValues);
});

test('contract, context, and injected client scopes cannot be bypassed', async () => {
  assert.throws(() => defineApprovedClickUpContract({
    sourceKey: 'bad', clientKey: 'fixture', teamId: '123', approvedListIds: [],
    timezone: 'America/Phoenix', contractVersion: 'v1',
  }), /one approved/i);
  assert.throws(
    () => createDeterministicClickUpAdapter({ ...contract() } as never, { client: mockClient([], []).client }),
    /approved ClickUp contract/i,
  );
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
  assert.equal('CLICKUP_LIST_CLIENTS' in await import('./clickup.ts'), false);
});

test('evidence and top-task output are deterministic, allowlisted, and privacy-sanitized', async () => {
  const entries = [time('a', '2026-08-10T07:00:00.000Z', '1000')];
  const tasks = [task('a', '2026-08-10T07:00:00.000Z')];
  const result = await adapter(verified([page(entries)]), verified([page(tasks)])).run(context);
  assert.match(result.evidence.requestFingerprint, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    'token', 'authorization', 'headers', 'rawresponse', 'private time entry description',
    'private task description', 'private comment', 'private@example.test', 'private list name',
  ]) assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  assert.deepEqual(result.tasks, [{
    id: 'a',
    name: 'Task a',
    url: 'https://app.clickup.com/t/a',
    dueAt: '2026-08-10T07:00:00.000Z',
  }]);
});

test('ClickUp adapter values feed the engine without reshaping', async () => {
  const adapted = await adapter(
    verified([page([time('a', '2026-08-10T07:00:00.000Z', '3600000')])]),
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
