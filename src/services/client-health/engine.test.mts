import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildClientHealthSnapshot,
  type ClientHealthEngineInput,
  type EngineMetricConfig,
} from './engine.ts';
import { canonicalEvidenceHash } from './evidence.ts';
import { comparisonWindows, phoenixDateFromInstant, phoenixMonthWindow } from './date-windows.ts';

const configs: EngineMetricConfig[] = [
  { key: 'budget_pacing', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['paid_media'] },
  { key: 'north_star', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid_media'] },
  { key: 'hours', required: true, weight: 20, direction: 'lower_is_better', greenThreshold: 90, yellowThreshold: 110, sourceKeys: ['clickup_time'] },
  { key: 'overdue_tasks', required: true, weight: 15, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 2, sourceKeys: ['clickup_tasks'] },
  { key: 'margin', required: true, weight: 15, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['margin_sheet'] },
];

const baseInput = (): ClientHealthEngineInput => ({
  clientKey: 'example',
  configApproved: true,
  lastCompleteSourceDate: '2026-08-19',
  calculationVersion: 'client-health-v1',
  metricConfig: configs.map((config) => ({ ...config, sourceKeys: [...config.sourceKeys] })),
  sources: [
    { key: 'paid_media', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 4 },
    { key: 'clickup_time', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 3 },
    { key: 'clickup_tasks', status: 'succeeded', dataThrough: '2026-08-19', stale: false, rowCount: 0 },
    { key: 'margin_sheet', status: 'succeeded', dataThrough: '2026-08-18', stale: false, rowCount: 1 },
  ],
  values: {
    budget: 3_100,
    monthSpend: 1_900,
    currentRows: [{ spend: 100, results: 1 }, { spend: 300, results: 9 }],
    previousRows: [{ spend: 200, results: 4 }, { spend: 200, results: 4 }],
    hoursUsed: 10,
    hoursAllotted: 20,
    overdueTaskCount: 0,
    revenue: 10_000,
    fulfillmentCost: 3_000,
  },
});

test('normalizes totals and computes cost per result as ratio of sums, never average row CPR', () => {
  const snapshot = buildClientHealthSnapshot(baseInput());

  assert.equal(snapshot.values.currentSpend, 400);
  assert.equal(snapshot.values.currentResultCount, 10);
  assert.equal(snapshot.values.currentCostPerResult, 40);
  assert.equal(snapshot.values.previousSpend, 400);
  assert.equal(snapshot.values.previousResultCount, 8);
  assert.equal(snapshot.values.previousCostPerResult, 50);
  assert.equal(snapshot.values.northStarChangePercent, -20);
});

test('verified zero results remain zero, produce null CPR and an explicit at-risk reason', () => {
  const input = baseInput();
  input.values.currentRows = [{ spend: 75, results: 0 }, { spend: 25, results: 0 }];

  const snapshot = buildClientHealthSnapshot(input);

  assert.equal(snapshot.values.currentResultCount, 0);
  assert.equal(snapshot.values.currentCostPerResult, null);
  assert.equal(snapshot.dimensions.north_star.status, 'at_risk');
  assert.match(snapshot.dimensions.north_star.reason, /zero verified results/i);
  assert.notEqual(snapshot.status, 'incomplete');
});

test('preserves missing versus zero and fails closed only for missing required values', () => {
  const zero = buildClientHealthSnapshot(baseInput());
  assert.equal(zero.values.overdueTaskCount, 0);
  assert.equal(zero.dimensions.overdue_tasks.status, 'healthy');

  const missingInput = baseInput();
  missingInput.values.overdueTaskCount = null;
  const missing = buildClientHealthSnapshot(missingInput);
  assert.equal(missing.values.overdueTaskCount, null);
  assert.equal(missing.dimensions.overdue_tasks.status, 'incomplete');
  assert.equal(missing.status, 'incomplete');
  assert.equal(missing.score, null);
});

test('uses exact unrounded budget pacing, projected hours, and margin calculations', () => {
  const snapshot = buildClientHealthSnapshot(baseInput());

  assert.equal(snapshot.values.elapsedMonthFraction, 19 / 31);
  assert.equal(snapshot.values.expectedSpend, 3_100 * (19 / 31));
  assert.equal(snapshot.values.budgetPacingVariancePercent, Math.abs((1_900 / 3_100) * 100 - (19 / 31) * 100));
  assert.equal(snapshot.values.projectedHours, 10 / (19 / 31));
  assert.equal(snapshot.values.projectedHoursPercent, (10 / (19 / 31) / 20) * 100);
  assert.equal(snapshot.values.marginPercent, 70);
});

test('stale, partial, failed, and missing required sources produce deterministic incomplete snapshots', () => {
  for (const source of [
    { status: 'succeeded' as const, stale: true },
    { status: 'partial' as const, stale: false },
    { status: 'failed' as const, stale: false },
    { status: 'missing' as const, stale: false },
  ]) {
    const input = baseInput();
    input.sources = input.sources.map((item) => item.key === 'paid_media' ? { ...item, ...source } : item);
    const snapshot = buildClientHealthSnapshot(input);
    assert.equal(snapshot.status, 'incomplete');
    assert.equal(snapshot.score, null);
    assert.equal(snapshot.dimensions.budget_pacing.status, 'incomplete');
    assert.equal(snapshot.dimensions.north_star.status, 'incomplete');
    assert.match(snapshot.reasons.join(' '), /paid_media/i);
  }
});

test('unapproved client configuration fails closed before scoring', () => {
  const input = baseInput();
  input.configApproved = false;

  const snapshot = buildClientHealthSnapshot(input);

  assert.equal(snapshot.status, 'configuration_required');
  assert.equal(snapshot.score, null);
  assert.ok(Object.values(snapshot.dimensions).every((dimension) => dimension.status === 'configuration_required'));
});

test('rejects malformed config, nonfinite values, duplicate keys, missing dimensions, and invalid weights or thresholds', () => {
  const invalidCases: Array<[string, (input: ClientHealthEngineInput) => void, RegExp]> = [
    ['duplicate', (input) => { input.metricConfig.push({ ...input.metricConfig[0] }); }, /duplicate metric key/i],
    ['missing', (input) => { input.metricConfig = input.metricConfig.slice(0, -1); }, /missing required dimension.*margin/i],
    ['weight', (input) => { input.metricConfig[0].weight = 0; }, /weight/i],
    ['total weight', (input) => { input.metricConfig.forEach((config) => { config.weight = 0; }); }, /weight/i],
    ['lower thresholds', (input) => { input.metricConfig[0].greenThreshold = 30; input.metricConfig[0].yellowThreshold = 20; }, /threshold/i],
    ['higher thresholds', (input) => { input.metricConfig[4].greenThreshold = 30; input.metricConfig[4].yellowThreshold = 40; }, /threshold/i],
    ['nonfinite config', (input) => { input.metricConfig[0].weight = Number.NaN; }, /finite/i],
    ['nonfinite value', (input) => { input.values.monthSpend = Number.POSITIVE_INFINITY; }, /finite/i],
  ];

  for (const [name, mutate, expected] of invalidCases) {
    const input = baseInput();
    mutate(input);
    assert.throws(() => buildClientHealthSnapshot(input), expected, name);
  }
});

test('weighted rating cannot be healthy when any required dimension is at risk', () => {
  const input = baseInput();
  input.metricConfig = input.metricConfig.map((config) => ({ ...config, weight: config.key === 'overdue_tasks' ? 1 : 100 }));
  input.values.overdueTaskCount = 3;

  const snapshot = buildClientHealthSnapshot(input);

  assert.equal(snapshot.dimensions.overdue_tasks.status, 'at_risk');
  assert.equal(snapshot.status, 'watch');
  assert.ok(snapshot.score !== null && snapshot.score >= 80);
});

test('source statuses, reasons, values, and minimum data-through are deterministic', () => {
  const input = baseInput();
  input.sources.reverse();
  const snapshot = buildClientHealthSnapshot(input);

  assert.deepEqual(Object.keys(snapshot.sources), ['clickup_tasks', 'clickup_time', 'margin_sheet', 'paid_media']);
  assert.equal(snapshot.dataThrough, '2026-08-18');
  assert.deepEqual(snapshot.reasons, Object.values(snapshot.dimensions).map((dimension) => dimension.reason));
});

test('canonical evidence hash is lowercase SHA-256 and ignores object, config, source, and source-row ordering', () => {
  const first = baseInput();
  const second = baseInput();
  first.values.currentRows = [
    { spend: 10_000_000_000_000_000, results: 1 },
    { spend: 1, results: 1 },
    { spend: 1, results: 1 },
  ];
  second.values.currentRows = first.values.currentRows.map((row) => ({ ...row }));
  second.metricConfig.reverse();
  second.sources.reverse();
  second.values.currentRows!.reverse();
  second.values.previousRows!.reverse();

  const firstSnapshot = buildClientHealthSnapshot(first);
  const secondSnapshot = buildClientHealthSnapshot(second);

  assert.match(firstSnapshot.evidenceHash, /^[a-f0-9]{64}$/);
  assert.equal(firstSnapshot.evidenceHash, secondSnapshot.evidenceHash);
  assert.equal(canonicalEvidenceHash({ b: 2, a: 1 }), canonicalEvidenceHash({ a: 1, b: 2 }));
});

test('hash evidence is allowlisted and excludes secrets and raw task bodies', () => {
  const input = baseInput() as ClientHealthEngineInput & { accessToken?: string; tasks?: Array<{ id: string; body: string }> };
  input.accessToken = 'super-secret';
  input.tasks = [{ id: 'task-1', body: 'confidential task body' }];
  const withSensitiveFields = buildClientHealthSnapshot(input).evidenceHash;

  delete input.accessToken;
  delete input.tasks;
  assert.equal(withSensitiveFields, buildClientHealthSnapshot(input).evidenceHash);
});

test('America/Phoenix helpers use the supplied complete source date across month boundaries', () => {
  assert.equal(phoenixDateFromInstant('2026-03-01T06:30:00.000Z'), '2026-02-28');
  assert.deepEqual(phoenixMonthWindow('2026-03-01'), {
    start: '2026-03-01', end: '2026-03-01', elapsedDays: 1, daysInMonth: 31, elapsedFraction: 1 / 31,
  });
  assert.deepEqual(phoenixMonthWindow('2024-02-29'), {
    start: '2024-02-01', end: '2024-02-29', elapsedDays: 29, daysInMonth: 29, elapsedFraction: 1,
  });
  assert.deepEqual(comparisonWindows('2026-03-01', 14), {
    current: { start: '2026-02-16', end: '2026-03-01' },
    previous: { start: '2026-02-02', end: '2026-02-15' },
  });
});
