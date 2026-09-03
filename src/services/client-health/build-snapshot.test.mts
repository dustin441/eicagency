import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleClientHealthSnapshot,
  normalizeSnapshotAssemblyInput,
  type CompletedSourceAdapterResult,
  type SnapshotAssemblyInput,
  type SnapshotSourceBinding,
} from './build-snapshot.ts';
import type { ClientHealthValueInputs, EngineMetricConfig } from './engine.ts';

const PAID_HASH = 'a'.repeat(64);
const CLICK_HASH = 'b'.repeat(64);
const MARGIN_HASH = 'c'.repeat(64);
const ALIAS_HASH = 'd'.repeat(64);
const retrievedAt = '2026-08-20T12:00:00.000Z';

const emptyValues = (): ClientHealthValueInputs => ({
  budget: null,
  monthSpend: null,
  currentRows: null,
  previousRows: null,
  hoursUsed: null,
  hoursAllotted: null,
  overdueTaskCount: null,
  revenue: null,
  fulfillmentCost: null,
});

const configs: EngineMetricConfig[] = [
  { key: 'budget_pacing', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['paid'] },
  { key: 'north_star', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
  { key: 'hours', required: true, weight: 20, direction: 'lower_is_better', greenThreshold: 90, yellowThreshold: 110, sourceKeys: ['click'] },
  { key: 'overdue_tasks', required: true, weight: 15, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 2, sourceKeys: ['click'] },
  { key: 'margin', required: true, weight: 15, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['margin'] },
];

const bindings = (): Record<string, SnapshotSourceBinding> => ({
  paid: {
    sourceKey: 'paid',
    provider: 'supabase',
    project: 'eic',
    relation: 'approved_daily_facts',
    requestFingerprint: PAID_HASH,
    permittedValueFields: ['monthSpend', 'currentRows', 'previousRows'],
    permitsTasks: false,
    expectedDataThrough: '2026-08-19',
  },
  click: {
    sourceKey: 'click',
    provider: 'clickup',
    endpointFamily: 'team-time-entries-and-overdue-tasks',
    requestFingerprint: CLICK_HASH,
    permittedValueFields: ['hoursUsed', 'overdueTaskCount'],
    permitsTasks: true,
    expectedDataThrough: '2026-08-19',
  },
  margin: {
    sourceKey: 'margin',
    provider: 'google-sheets',
    spreadsheetId: 'approved-sheet-id',
    range: "'Monthly Margin'!A1:E1000",
    approvedClientAliasHash: ALIAS_HASH,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
    requestFingerprint: MARGIN_HASH,
    permittedValueFields: ['revenue', 'fulfillmentCost'],
    permitsTasks: false,
    expectedDataThrough: '2026-08-19',
  },
});

const supabaseEvidence = (selectedRowCount: number | null = 3) => ({
  sourceKey: 'paid',
  provider: 'supabase' as const,
  project: 'eic' as const,
  relation: 'approved_daily_facts',
  retrievedAt,
  sourceContractVersion: 'sources-v1',
  requestFingerprint: PAID_HASH,
  selectedRowCount,
});

const clickEvidence = (timeEntryCount: number | null = 1, overdueTaskCount: number | null = 1, totalDurationMs: string | null = '3600000') => ({
  sourceKey: 'click',
  provider: 'clickup' as const,
  endpointFamily: 'team-time-entries-and-overdue-tasks' as const,
  retrievedAt,
  sourceContractVersion: 'sources-v1',
  requestFingerprint: CLICK_HASH,
  timeEntryCount,
  totalDurationMs,
  overdueTaskCount,
});

const sheetsEvidence = (matchedRowCount: number | null = 1) => ({
  sourceKey: 'margin',
  provider: 'google-sheets' as const,
  spreadsheetId: 'approved-sheet-id',
  range: "'Monthly Margin'!A1:E1000",
  approvedClientAliasHash: ALIAS_HASH,
  valueRenderOption: 'UNFORMATTED_VALUE' as const,
  dateTimeRenderOption: 'FORMATTED_STRING' as const,
  sourceContractVersion: 'sources-v1',
  requestFingerprint: MARGIN_HASH,
  matchedRowCount,
});

const clickTask = (id = 'A1', dueAt = '2026-08-10T12:00:00.000Z', listId = '456') => ({
  id,
  listId,
  name: `Task ${id}`,
  url: `https://app.clickup.com/t/${id}`,
  dueAt,
});

function paidResult(): CompletedSourceAdapterResult {
  return {
    source: { key: 'paid', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 3 },
    values: {
      ...emptyValues(),
      monthSpend: 1_900,
      currentRows: [{ spend: 100, results: 0 }, { spend: 50, results: 1 }],
      previousRows: [{ spend: 100, results: 2 }],
    },
    evidence: supabaseEvidence(),
    failure: null,
  };
}

function clickResult(totalDurationMs = '3600000', overdueTaskCount = 1, tasks = [clickTask()]): CompletedSourceAdapterResult {
  const timeEntryCount = 1;
  return {
    source: { key: 'click', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: timeEntryCount + overdueTaskCount },
    values: { ...emptyValues(), hoursUsed: Number(totalDurationMs) / 3_600_000, overdueTaskCount },
    tasks,
    evidence: clickEvidence(timeEntryCount, overdueTaskCount, totalDurationMs),
    failure: null,
  };
}

function marginResult(): CompletedSourceAdapterResult {
  return {
    source: { key: 'margin', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 1 },
    values: { ...emptyValues(), revenue: 10_000, fulfillmentCost: 3_000 },
    evidence: sheetsEvidence(),
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
    metricConfig: structuredClone(configs),
    requiredSourceKeys: ['paid', 'click', 'margin'],
    optionalSourceKeys: [],
    sourceBindings: bindings(),
    fixedValues: { monthlyBudget: 3_100, monthlyHoursAllotment: 20 },
    sourceResults: [paidResult(), clickResult(), marginResult()],
  };
}

function replace(input: SnapshotAssemblyInput, key: string, result: CompletedSourceAdapterResult): void {
  input.sourceResults[input.sourceResults.findIndex(({ source }) => source.key === key)] = result;
}

function failedClick(reason: string): CompletedSourceAdapterResult {
  return {
    source: { key: 'click', status: 'failed', dataThrough: null, stale: true, rowCount: null },
    values: emptyValues(),
    tasks: [],
    evidence: clickEvidence(null, null, null),
    failure: { code: 'query_failed', reason },
  };
}

function addSupabaseSource(input: SnapshotAssemblyInput, key: string, values: Partial<ClientHealthValueInputs> = {}): void {
  input.optionalSourceKeys.push(key);
  input.sourceBindings[key] = {
    sourceKey: key,
    provider: 'supabase',
    project: 'eic',
    relation: `${key}_facts`,
    requestFingerprint: PAID_HASH,
    permittedValueFields: [],
    permitsTasks: false,
    expectedDataThrough: '2026-08-19',
  };
  input.sourceResults.push({
    source: { key, status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 0 },
    values: { ...emptyValues(), ...values },
    evidence: { ...supabaseEvidence(0), sourceKey: key, relation: `${key}_facts` },
    failure: null,
  });
}

function attack(name: string, mutate: (input: SnapshotAssemblyInput) => void, expected: RegExp): void {
  test(name, () => {
    const input = baseInput();
    mutate(input);
    assert.throws(() => assembleClientHealthSnapshot(input), expected);
  });
}

test('v3 assembles source-isolated CPL and absolute ROAS lane evidence into the parent score', () => {
  const cplInput = baseInput();
  cplInput.northStarLanes = [{
    key: 'cpl', label: 'Cost per lead trend', formula: 'cost_per_result', evaluation: 'period_over_period_change',
    required: true, weight: 100, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'],
  }];
  const cpl = assembleClientHealthSnapshot(cplInput);
  assert.equal(cpl.snapshot.dimensions.north_star.status, 'at_risk');
  assert.equal(cpl.snapshot.dimensions.north_star.value, 200);
  assert.deepEqual(cpl.snapshot.dimensions.north_star.facts?.lanes.map(({ key, currentValue, previousValue, evaluationValue }) => ({ key, currentValue, previousValue, evaluationValue })), [
    { key: 'cpl', currentValue: 150, previousValue: 50, evaluationValue: 200 },
  ]);
  assert.equal(cpl.snapshot.values.currentCostPerResult, null);

  const roasInput = baseInput();
  roasInput.northStarLanes = [{
    key: 'roas', label: 'ROAS target', formula: 'roas', evaluation: 'absolute_target',
    required: true, weight: 100, direction: 'higher_is_better', greenThreshold: 3, yellowThreshold: 2, sourceKeys: ['paid'],
  }];
  const paid = roasInput.sourceResults.find(({ source }) => source.key === 'paid')!;
  paid.values.currentRows = [{ spend: 100, results: 350 }];
  paid.values.previousRows = null;
  const roas = assembleClientHealthSnapshot(roasInput);
  assert.equal(roas.snapshot.dimensions.north_star.status, 'healthy');
  assert.equal(roas.snapshot.dimensions.north_star.value, 3.5);
  assert.equal(roas.snapshot.dimensions.north_star.facts?.lanes[0].previousValue, null);
});

test('v3 keeps dual lane sources separate, canonicalizes order, and fails closed only for required missing lanes', () => {
  const input = baseInput();
  input.optionalSourceKeys.push('sales');
  input.sourceBindings.sales = {
    sourceKey: 'sales', provider: 'supabase', project: 'eic', relation: 'sales_daily_facts', requestFingerprint: PAID_HASH,
    permittedValueFields: ['currentRows'], permitsTasks: false, expectedDataThrough: '2026-08-19',
  };
  input.sourceResults.push({
    source: { key: 'sales', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 1 },
    values: { ...emptyValues(), currentRows: [{ spend: 200, results: 800 }] },
    evidence: { ...supabaseEvidence(1), sourceKey: 'sales', relation: 'sales_daily_facts' }, failure: null,
  });
  input.northStarLanes = [
    { key: 'sales-roas', label: 'Product sales ROAS', formula: 'roas', evaluation: 'absolute_target', required: true, weight: 50, direction: 'higher_is_better', greenThreshold: 3, yellowThreshold: 2, sourceKeys: ['sales'] },
    { key: 'lead-cpl', label: 'Lead CPL trend', formula: 'cost_per_result', evaluation: 'period_over_period_change', required: true, weight: 50, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
  ];
  input.metricConfig.find(({ key }) => key === 'north_star')!.sourceKeys = ['paid', 'sales'];
  const assembled = assembleClientHealthSnapshot(input);
  assert.deepEqual(assembled.snapshot.dimensions.north_star.facts?.lanes.map(({ key }) => key), ['lead-cpl', 'sales-roas']);
  assert.equal(assembled.snapshot.dimensions.north_star.value, null);
  assert.equal(assembled.snapshot.dimensions.north_star.status, 'at_risk');

  const reordered = structuredClone(input);
  reordered.northStarLanes!.reverse();
  reordered.sourceResults.reverse();
  assert.equal(assembleClientHealthSnapshot(reordered).evidenceHash, assembled.evidenceHash);

  const missingRequired = structuredClone(input);
  missingRequired.sourceResults = missingRequired.sourceResults.filter(({ source }) => source.key !== 'sales');
  assert.equal(assembleClientHealthSnapshot(missingRequired).snapshot.dimensions.north_star.status, 'incomplete');

  const stale = structuredClone(input);
  stale.sourceResults.find(({ source }) => source.key === 'paid')!.source.dataThrough = '2026-08-18';
  stale.sourceResults.find(({ source }) => source.key === 'paid')!.source.stale = true;
  const staleDimension = assembleClientHealthSnapshot(stale).snapshot.dimensions.north_star;
  assert.equal(staleDimension.status, 'incomplete');
  assert.match(staleDimension.reason, /required North Star lane lead-cpl is incomplete/i);
  assert.equal(staleDimension.facts?.lanes.find(({ key }) => key === 'lead-cpl')?.status, 'incomplete');

  const optionalMissing = structuredClone(input);
  optionalMissing.northStarLanes!.find(({ key }) => key === 'sales-roas')!.required = false;
  optionalMissing.sourceResults = optionalMissing.sourceResults.filter(({ source }) => source.key !== 'sales');
  const optional = assembleClientHealthSnapshot(optionalMissing);
  assert.equal(optional.snapshot.dimensions.north_star.status, 'at_risk');
  assert.equal(optional.snapshot.dimensions.north_star.facts?.lanes.find(({ key }) => key === 'sales-roas')?.status, 'unavailable');
});

test('assembles realistic provider-bound success with exact values, tasks, counts, and hashes', () => {
  const assembled = assembleClientHealthSnapshot(baseInput());
  assert.equal(assembled.clientId, 'client-1');
  assert.equal(assembled.snapshot.values.budget, 3_100);
  assert.equal(assembled.snapshot.values.monthSpend, 1_900);
  assert.equal(assembled.snapshot.values.hoursUsed, 1);
  assert.equal(assembled.snapshot.values.overdueTaskCount, 1);
  assert.equal(assembled.snapshot.values.marginPercent, 70);
  assert.deepEqual(assembled.tasks, [{ ...clickTask(), rank: 1 }]);
  assert.equal(assembled.sources.paid.evidence?.selectedRowCount, 3);
  assert.equal(assembled.sources.click.evidence?.timeEntryCount, 1);
  assert.equal(assembled.sources.margin.evidence?.matchedRowCount, 1);
  assert.deepEqual(assembled.sources.paid.facts, {
    currentRows: [{ spend: 100, results: 0 }, { spend: 50, results: 1 }],
    monthSpend: 1_900,
    previousRows: [{ spend: 100, results: 2 }],
  });
  assert.deepEqual(assembled.sources.click.facts, { hoursUsed: 1, overdueTaskCount: 1, topTasks: [clickTask()] });
  assert.deepEqual(assembled.sources.margin.facts, { fulfillmentCost: 3_000, revenue: 10_000 });
  assert.match(assembled.snapshot.calculationHash, /^[a-f0-9]{64}$/);
  assert.match(assembled.evidenceHash, /^[a-f0-9]{64}$/);
});

test('uses one authoritative assembly evidenceHash and renames the nested engine hash to calculationHash', () => {
  const assembled = assembleClientHealthSnapshot(baseInput());
  assert.equal('evidenceHash' in assembled.snapshot, false);
  assert.equal(Object.hasOwn(assembled, 'evidenceHash'), true);
  assert.equal(Object.hasOwn(assembled.snapshot, 'calculationHash'), true);
  assert.notEqual(assembled.evidenceHash, assembled.snapshot.calculationHash);
});

test('committed ClickUp task facts participate in the authoritative evidence hash', () => {
  const first = baseInput();
  const second = baseInput();
  const click = second.sourceResults.find(({ source }) => source.key === 'click') as CompletedSourceAdapterResult & { tasks: ReturnType<typeof clickTask>[] };
  click.tasks[0] = { ...click.tasks[0], name: 'Changed task name' };
  const left = assembleClientHealthSnapshot(first);
  const right = assembleClientHealthSnapshot(second);
  assert.notEqual(left.evidenceHash, right.evidenceHash);
  assert.equal((right.sources.click.facts?.topTasks as ReturnType<typeof clickTask>[])[0].name, 'Changed task name');
});

test('source and row order are canonical and do not affect assembly evidenceHash', () => {
  const first = baseInput();
  const second = baseInput();
  const earlier = clickTask('A1', '2026-08-09T12:00:00.000Z');
  const later = clickTask('B1', '2026-08-10T12:00:00.000Z');
  replace(first, 'click', clickResult('3600000', 2, [earlier, later]));
  replace(second, 'click', clickResult('3600000', 2, [later, earlier]));
  second.sourceResults.reverse();
  second.sourceResults.find(({ source }) => source.key === 'paid')!.values.currentRows!.reverse();
  assert.equal(assembleClientHealthSnapshot(first).evidenceHash, assembleClientHealthSnapshot(second).evidenceHash);
  const paidFacts = assembleClientHealthSnapshot(second).sources.paid.facts;
  assert.ok(paidFacts);
  assert.deepEqual(paidFacts.currentRows, [
    { spend: 100, results: 0 }, { spend: 50, results: 1 },
  ]);
  assert.deepEqual(assembleClientHealthSnapshot(second).sources.click.facts?.topTasks, [earlier, later]);
});

test('accepts exact bounded PostgreSQL-compatible ClickUp task fields', () => {
  const input = baseInput();
  const id = 'A'.repeat(128);
  const task = clickTask(id, '2026-08-10T12:00:00.000Z', '1'.repeat(64));
  task.name = 'x'.repeat(500);
  replace(input, 'click', clickResult('3600000', 1, [task]));
  assert.deepEqual(assembleClientHealthSnapshot(input).sources.click.facts?.topTasks, [task]);
});

test('missing and failed required sources make the snapshot incomplete without leaked values', () => {
  const missing = baseInput();
  missing.sourceResults = missing.sourceResults.filter(({ source }) => source.key !== 'paid');
  const missingAssembly = assembleClientHealthSnapshot(missing);
  assert.equal(missingAssembly.sources.paid.status, 'missing');
  assert.equal(missingAssembly.snapshot.status, 'incomplete');

  const failed = baseInput();
  const leaking = failedClick('secret') as CompletedSourceAdapterResult & { tasks: ReturnType<typeof clickTask>[]; rawError: unknown };
  leaking.values.hoursUsed = 999;
  leaking.values.overdueTaskCount = 999;
  leaking.tasks = [clickTask('SECRET')];
  leaking.rawError = new Error('credential');
  replace(failed, 'click', leaking);
  const failedAssembly = assembleClientHealthSnapshot(failed);
  assert.equal(failedAssembly.snapshot.values.hoursUsed, null);
  assert.deepEqual(failedAssembly.tasks, []);
  assert.deepEqual(failedAssembly.sources.click.facts, { hoursUsed: null, overdueTaskCount: null, topTasks: null });
  assert.equal('rawError' in failedAssembly.sources.click, false);
});

test('unapproved gate ignores malformed configuration and malicious adapter payloads', () => {
  const input = baseInput() as unknown as Record<string, unknown>;
  input.configApproved = false;
  input.metricConfig = { secret: 'metric-secret' };
  input.requiredSourceKeys = 'bad';
  input.sourceBindings = { secret: 'binding-secret' };
  input.sourceResults = [{ rawError: new Error('token=secret') }];
  (input.phoenix as Record<string, unknown>).unsupportedSecret = 'phoenix-secret-one';
  const assembled = assembleClientHealthSnapshot(input as unknown as SnapshotAssemblyInput);
  const second = baseInput() as unknown as Record<string, unknown>;
  second.configApproved = false;
  (second.phoenix as Record<string, unknown>).unsupportedSecret = 'phoenix-secret-two';
  const secondAssembly = assembleClientHealthSnapshot(second as unknown as SnapshotAssemblyInput);
  assert.equal(assembled.evidenceHash, secondAssembly.evidenceHash);
  assert.equal(assembled.snapshot.status, 'configuration_required');
  assert.deepEqual(assembled.sources, {});
  assert.deepEqual(assembled.tasks, []);
  assert.equal('evidenceHash' in assembled.snapshot, false);
  assert.match(assembled.snapshot.calculationHash, /^[a-f0-9]{64}$/);
});

attack('rejects evidence provider substitution', (input) => {
  input.sourceResults[0].evidence = { ...sheetsEvidence(3), sourceKey: 'paid', requestFingerprint: PAID_HASH };
}, /provider does not match/i);

attack('rejects wrong Supabase project', (input) => {
  (input.sourceResults[0].evidence as unknown as Record<string, unknown>).project = 'prepass';
}, /Supabase evidence identity/i);

attack('rejects wrong Supabase relation', (input) => {
  (input.sourceResults[0].evidence as unknown as Record<string, unknown>).relation = 'unapproved_facts';
}, /Supabase evidence identity/i);

attack('rejects wrong Google Sheets identity', (input) => {
  (input.sourceResults[2].evidence as unknown as Record<string, unknown>).spreadsheetId = 'other-sheet';
}, /Google Sheets evidence identity/i);

attack('rejects wrong Google Sheets fingerprint', (input) => {
  (input.sourceResults[2].evidence as unknown as Record<string, unknown>).requestFingerprint = 'e'.repeat(64);
}, /request fingerprint does not match/i);

attack('rejects unauthorized value fields', (input) => {
  input.sourceResults[0].values.revenue = 5;
}, /does not permit value field revenue/i);

attack('rejects metric source ownership mismatch', (input) => {
  input.metricConfig.find(({ key }) => key === 'budget_pacing')!.sourceKeys = ['margin'];
}, /not configured as a source for metric budget_pacing/i);

attack('rejects old dataThrough paired with stale=false', (input) => {
  input.sourceResults[0].source.dataThrough = '2026-08-18';
}, /claimed stale does not match/i);

attack('rejects future dataThrough beyond the binding and snapshot cutoff', (input) => {
  input.sourceResults[0].source.dataThrough = '2026-08-20';
}, /dataThrough exceeds its approved cutoff/i);

attack('rejects a future snapshot date relative to retrievedAt in Phoenix', (input) => {
  input.snapshotDate = '2026-08-21';
}, /snapshotDate cannot be after/i);

attack('rejects future ClickUp task due dates', (input) => {
  replace(input, 'click', clickResult('3600000', 1, [clickTask('A1', '2026-08-20T07:00:00.000Z')]));
}, /dueAt exceeds the snapshot-day Phoenix cutoff/i);

for (const [name, mutate, expected] of [
  ['noncanonical ClickUp URL', (task: ReturnType<typeof clickTask>) => { task.url = 'http://app.clickup.com/t/A1'; }, /exact canonical ClickUp task URL/i],
  ['noncanonical ClickUp ID', (task: ReturnType<typeof clickTask>) => { task.id = 'A-1'; }, /canonical ClickUp task ID/i],
  ['noncanonical ClickUp list ID', (task: ReturnType<typeof clickTask>) => { task.listId = '0456'; }, /canonical ClickUp list ID/i],
  ['oversized ClickUp ID', (task: ReturnType<typeof clickTask>) => { task.id = 'A'.repeat(129); task.url = `https://app.clickup.com/t/${task.id}`; }, /bounded canonical ClickUp task ID/i],
  ['oversized ClickUp list ID', (task: ReturnType<typeof clickTask>) => { task.listId = '1'.repeat(65); }, /bounded canonical ClickUp list ID/i],
  ['oversized ClickUp task name', (task: ReturnType<typeof clickTask>) => { task.name = 'x'.repeat(501); }, /name is oversized/i],
  ['NUL in ClickUp task name', (task: ReturnType<typeof clickTask>) => { task.name = 'bad\0name'; }, /PostgreSQL-incompatible NUL/i],
  ['unpaired high surrogate in ClickUp task name', (task: ReturnType<typeof clickTask>) => { task.name = 'bad\ud800name'; }, /unpaired surrogate/i],
  ['unpaired low surrogate in ClickUp task name', (task: ReturnType<typeof clickTask>) => { task.name = 'bad\udc00name'; }, /unpaired surrogate/i],
] as const) {
  attack(`rejects ${name}`, (input) => {
    const task = clickTask();
    mutate(task);
    replace(input, 'click', clickResult('3600000', 1, [task]));
  }, expected);
}

test('rejects verified-empty Supabase success carrying values, rows, or tasks', () => {
  const mutations: Array<(result: CompletedSourceAdapterResult & { tasks?: unknown[] }) => void> = [
    (result) => { result.values.monthSpend = 1; },
    (result) => { result.values.currentRows = []; },
    (result) => { result.tasks = [clickTask()]; },
  ];
  for (const mutate of mutations) {
    const input = baseInput();
    const empty = {
      source: { key: 'paid', status: 'succeeded', dataThrough: null, stale: true, rowCount: 0 },
      values: emptyValues(),
      evidence: supabaseEvidence(0),
      failure: null,
    } as CompletedSourceAdapterResult & { tasks?: unknown[] };
    mutate(empty);
    replace(input, 'paid', empty as CompletedSourceAdapterResult);
    assert.throws(() => assembleClientHealthSnapshot(input), /verified-empty Supabase source must contain no values, ratio rows, or tasks/i);
  }
});

test('accepts truly empty Supabase evidence and leaves its metrics incomplete', () => {
  const input = baseInput();
  replace(input, 'paid', {
    source: { key: 'paid', status: 'succeeded', dataThrough: null, stale: true, rowCount: 0 },
    values: emptyValues(),
    evidence: supabaseEvidence(0),
    failure: null,
  });
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.sources.paid.evidence?.selectedRowCount, 0);
  assert.deepEqual(assembled.sources.paid.facts, { currentRows: null, monthSpend: null, previousRows: null });
  assert.equal(assembled.snapshot.status, 'incomplete');
});

attack('rejects Supabase provider count mismatch', (input) => {
  (input.sourceResults[0].evidence as unknown as Record<string, unknown>).selectedRowCount = 2;
}, /rowCount does not match selectedRowCount/i);

attack('rejects Google Sheets provider count mismatch', (input) => {
  (input.sourceResults[2].evidence as unknown as Record<string, unknown>).matchedRowCount = 2;
}, /rowCount does not match matchedRowCount|count must equal 1/i);

attack('rejects ClickUp provider count mismatch', (input) => {
  (input.sourceResults[1].evidence as unknown as Record<string, unknown>).timeEntryCount = 2;
}, /rowCount does not equal timeEntryCount plus overdueTaskCount/i);

test('redacts secret adapter failure reasons to fixed public text and excludes them from evidenceHash', () => {
  const first = baseInput();
  const second = baseInput();
  replace(first, 'click', failedClick('Bearer private-token-one database.internal'));
  replace(second, 'click', failedClick('oauth-secret-two private payload'));
  const a = assembleClientHealthSnapshot(first);
  const b = assembleClientHealthSnapshot(second);
  assert.deepEqual(a.sources.click.failure, { code: 'query_failed', reason: 'The approved source query failed.' });
  assert.equal(JSON.stringify(a).includes('private-token'), false);
  assert.equal(a.evidenceHash, b.evidenceHash);
});

test('allowlists result evidence but rejects unsupported authorization fields', () => {
  const first = baseInput();
  const second = baseInput();
  (first.sourceResults[0].evidence as unknown as Record<string, unknown>).accessToken = 'secret-one';
  (second.sourceResults[0].evidence as unknown as Record<string, unknown>).accessToken = 'secret-two';
  const a = assembleClientHealthSnapshot(first);
  const b = assembleClientHealthSnapshot(second);
  assert.equal(a.evidenceHash, b.evidenceHash);
  assert.equal('accessToken' in a.sources.paid.evidence!, false);

  for (const mutate of [
    (input: SnapshotAssemblyInput) => { (input.sourceBindings.paid as unknown as Record<string, unknown>).unsupportedSecret = 'secret'; },
    (input: SnapshotAssemblyInput) => { (input.metricConfig[0] as unknown as Record<string, unknown>).unsupportedSecret = 'secret'; },
    (input: SnapshotAssemblyInput) => { (input.phoenix as unknown as Record<string, unknown>).unsupportedSecret = 'secret'; },
  ]) {
    const input = baseInput();
    input.sourceResults = [];
    mutate(input);
    assert.throws(() => normalizeSnapshotAssemblyInput(input), /unsupported fields/i);
  }
});

test('preflight deeply reconstructs approved authorization and empties source results', () => {
  const input = baseInput();
  input.sourceResults = [];
  const normalized = normalizeSnapshotAssemblyInput(input);
  assert.notEqual(normalized, input);
  assert.notEqual(normalized.phoenix, input.phoenix);
  assert.notEqual(normalized.sourceBindings.paid, input.sourceBindings.paid);
  assert.deepEqual(normalized.sourceResults, []);
  input.phoenix.month.start = '1999-01-01';
  (input.sourceBindings.paid as { provider: 'supabase'; relation: string }).relation = 'mutated';
  assert.equal(normalized.phoenix.month.start, '2026-08-01');
  assert.equal((normalized.sourceBindings.paid as { relation: string }).relation, 'approved_daily_facts');
});

test('rejects forged succeeded ClickUp cross-fields', () => {
  const cases: Array<[string, (result: CompletedSourceAdapterResult & Record<string, unknown>) => void, RegExp]> = [
    ['missing tasks', (result) => { delete result.tasks; }, /tasks must be an array/i],
    ['missing duration', (result) => { (result.evidence as unknown as Record<string, unknown>).totalDurationMs = null; }, /totalDurationMs evidence/i],
    ['missing time count', (result) => { (result.evidence as unknown as Record<string, unknown>).timeEntryCount = null; }, /exact ClickUp count evidence|rowCount requires complete/i],
    ['hours mismatch', (result) => { result.values.hoursUsed = 2; }, /hoursUsed does not match/i],
    ['overdue mismatch', (result) => { result.values.overdueTaskCount = 2; }, /overdueTaskCount does not match/i],
    ['task count mismatch', (result) => { result.tasks = []; }, /tasks length does not match/i],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = baseInput();
    const forged = clickResult() as CompletedSourceAdapterResult & Record<string, unknown>;
    mutate(forged);
    replace(input, 'click', forged);
    assert.throws(() => assembleClientHealthSnapshot(input), expected, name);
  }
});

test('deterministically ranks the ClickUp top five with canonical list IDs', () => {
  const input = baseInput();
  const tasks = ['F6', 'E5', 'D4', 'C3', 'B2'].map((id, index) => clickTask(
    id,
    `2026-08-${String(10 + (index % 3)).padStart(2, '0')}T12:00:00.000Z`,
    index % 2 ? '789' : '456',
  ));
  replace(input, 'click', clickResult('3600000', 7, tasks));
  const assembled = assembleClientHealthSnapshot(input);
  assert.equal(assembled.tasks.length, 5);
  assert.deepEqual(assembled.tasks.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
  assert.ok(assembled.tasks.every(({ listId }) => listId === '456' || listId === '789'));
});

test('rejects duplicate and unknown source results and exact binding-key drift', () => {
  const duplicate = baseInput();
  duplicate.sourceResults.push(paidResult());
  assert.throws(() => assembleClientHealthSnapshot(duplicate), /duplicate source adapter result/i);

  const unknown = baseInput();
  unknown.sourceResults.push({ ...paidResult(), source: { ...paidResult().source, key: 'rogue' } });
  assert.throws(() => assembleClientHealthSnapshot(unknown), /unknown source key/i);

  const missingBinding = baseInput();
  delete missingBinding.sourceBindings.margin;
  assert.throws(() => assembleClientHealthSnapshot(missingBinding), /sourceBindings key set/i);
});

test('rejects scalar collisions and optional sources without field permission', () => {
  const collision = baseInput();
  addSupabaseSource(collision, 'paid2', { monthSpend: 1 });
  collision.sourceBindings.paid2.permittedValueFields = ['monthSpend'];
  collision.metricConfig.find(({ key }) => key === 'budget_pacing')!.sourceKeys.push('paid2');
  assert.throws(() => assembleClientHealthSnapshot(collision), /monthSpend has multiple providers/i);

  const forbidden = baseInput();
  addSupabaseSource(forbidden, 'other', { currentRows: [] });
  assert.throws(() => assembleClientHealthSnapshot(forbidden), /does not permit value field currentRows/i);
});

test('facts are a bounded exact assembler projection and affect evidenceHash', () => {
  const baseline = assembleClientHealthSnapshot(baseInput());
  const changed = baseInput();
  changed.sourceResults[0].values.monthSpend = 1_901;
  assert.notEqual(assembleClientHealthSnapshot(changed).evidenceHash, baseline.evidenceHash);

  const oversized = baseInput();
  oversized.sourceResults[0].values.currentRows = Array.from({ length: 100_001 }, () => ({ spend: 1, results: 1 }));
  assert.throws(() => assembleClientHealthSnapshot(oversized), /cannot exceed 100000 rows/i);
});

test('rejects nonfinite, negative, fixed-field, and succeeded-with-failure payloads', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const input = baseInput();
    input.sourceResults[0].values.monthSpend = bad;
    assert.throws(() => assembleClientHealthSnapshot(input), /finite|nonnegative/i);
  }
  const fixed = baseInput();
  fixed.sourceResults[0].values.budget = 1;
  assert.throws(() => assembleClientHealthSnapshot(fixed), /fixed field budget/i);

  const failedSuccess = baseInput();
  failedSuccess.sourceResults[0].failure = { code: 'query_failed', reason: 'secret' };
  assert.throws(() => assembleClientHealthSnapshot(failedSuccess), /succeeded with a failure/i);
});
