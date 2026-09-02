import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildClientHealthDashboard,
  type ClientHealthDashboardRepository,
} from './client-health.ts';
import type {
  ClientHealthLatestRecord,
  ClientHealthMetricConfig,
  ClientHealthOverallStatus,
} from './client-health/repository.ts';

const KEYS = ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin'] as const;
const LABELS = {
  budget_pacing: 'Budget pacing',
  north_star: 'Qualified lead cost',
  hours: 'Hours pacing',
  overdue_tasks: 'Overdue tasks',
  margin: 'Margin',
} as const;

function metricConfig(): ClientHealthMetricConfig[] {
  return KEYS.map((key, index) => ({
    id: `revision-1:${key}`,
    key,
    label: LABELS[key],
    adapterKey: `snapshot.${key}`,
    required: key !== 'margin',
    weight: 10 + index,
    direction: key === 'margin' ? 'higher_is_better' : 'lower_is_better',
    greenThreshold: key === 'margin' ? 60 : 10,
    yellowThreshold: key === 'margin' ? 40 : 20,
    sourceKeys: [`source-${key}`],
  }));
}

function dimensions(status: string = 'healthy') {
  return Object.fromEntries(KEYS.map((key, index) => [key, {
    status: key === 'margin' && status === 'incomplete' ? 'unavailable' : status,
    value: status === 'configuration_required' ? null : index === 0 ? 0 : index + 0.5,
    reason: `${LABELS[key]} immutable reason`,
    required: status === 'configuration_required' ? true : key !== 'margin',
    weight: status === 'configuration_required' ? 0 : 10 + index,
  }]));
}

function record(
  key: string,
  status: ClientHealthOverallStatus,
  overrides: Partial<ClientHealthLatestRecord> = {},
): ClientHealthLatestRecord {
  return {
    snapshotId: `snapshot-${key}`,
    refreshRunId: 'run-1',
    snapshotDate: '2026-08-26',
    calculatedAt: '2026-08-27T02:03:04.000Z',
    status,
    score: status === 'incomplete' || status === 'configuration_required' ? null : 82.5,
    reasons: [`${status} snapshot reason`],
    client: {
      id: `client-${key}`,
      key,
      name: key.toUpperCase(),
      dashboardHref: key === 'nolink' ? null : `/dashboard/${key}`,
      configStatus: status === 'configuration_required' ? 'configuration_required' : 'approved',
      reportingTimezone: 'America/Phoenix',
      monthlyHoursAllotment: 0,
      clickupListIds: ['list-1'],
      marginAliases: ['Finance alias'],
    },
    metrics: {
      budget: 0,
      monthSpend: 0,
      expectedSpend: 125,
      currentWindowStart: '2026-08-13',
      currentWindowEnd: '2026-08-26',
      currentSpend: 0,
      currentResultCount: 0,
      currentCostPerResult: null,
      previousWindowStart: '2026-07-30',
      previousWindowEnd: '2026-08-12',
      previousSpend: 250,
      previousResultCount: 5,
      previousCostPerResult: 50,
      hoursUsed: 0,
      hoursAllotted: 0,
      projectedHours: 0,
      overdueTaskCount: 0,
      revenue: null,
      fulfillmentCost: null,
      marginPercent: null,
    },
    dimensionStatuses: dimensions(status),
    freshness: {
      dataThrough: '2026-08-26',
      sources: {
        paid: { status: 'succeeded', dataThrough: '2026-08-26', stale: false },
        finance: { status: 'unavailable', dataThrough: null, stale: null },
      },
    },
    versions: { calculation: 'calc-v3', sourceContract: 'sources-v4' },
    evidenceHash: 'a'.repeat(64),
    configRevision: { id: 'revision-1', hash: 'b'.repeat(64) },
    tasks: [{ id: 'task-1', listId: 'list-1', name: 'Fix tracking', url: 'https://app.clickup.com/t/task-1', dueAt: null, rank: 1 }],
    metricConfig: status === 'configuration_required' ? [] : metricConfig(),
    ...overrides,
  };
}

function repository(records: ClientHealthLatestRecord[] | Error): ClientHealthDashboardRepository {
  return {
    async readLatest() {
      if (records instanceof Error) throw records;
      return records;
    },
  };
}

test('maps every overall and dimension status from immutable snapshots and excludes Canary before rows and counts', async () => {
  const statuses: ClientHealthOverallStatus[] = ['healthy', 'watch', 'at_risk', 'incomplete', 'configuration_required'];
  const source = statuses.map((status) => record(status, status));
  source.push(record('canary', 'at_risk'));

  const dashboard = await buildClientHealthDashboard(repository(source));

  assert.equal(dashboard.state, 'ready');
  assert.deepEqual(dashboard.counts, {
    healthy: 1, watch: 1, atRisk: 1, incomplete: 1, configurationRequired: 1,
  });
  assert.deepEqual(dashboard.rows.map((row) => row.status), statuses);
  assert.equal(dashboard.rows.some((row) => row.clientKey === 'canary'), false);
  assert.deepEqual(Object.keys(dashboard.rows[0].dimensions), [
    'budgetPacing', 'northStarCost', 'hoursPacing', 'overdueTasks', 'margin',
  ]);
  assert.equal(dashboard.rows[3].dimensions.margin.status, 'unavailable');
  assert.equal(dashboard.rows[0].dimensions.budgetPacing.value, 0);
  assert.equal(dashboard.rows[0].dimensions.northStarCost.reason, 'Qualified lead cost immutable reason');
  assert.deepEqual(dashboard.rows[0].dimensions.northStarCost.config, {
    label: 'Qualified lead cost', adapterKey: 'snapshot.north_star', required: true, weight: 11,
    direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['source-north_star'],
  });
  assert.equal(dashboard.rows[3].score, null);
  assert.equal(dashboard.rows[4].score, null);
  assert.equal(dashboard.rows[4].dimensions.margin.config, null);
  assert.equal(dashboard.rows[4].dimensions.margin.label, 'Margin');
});

test('preserves zero versus null and all snapshot dates, freshness, task links, and nullable links', async () => {
  const nullableLinkRecord = record('nolink', 'healthy');
  nullableLinkRecord.tasks.push({ id: 'task-2', listId: 'list-1', name: 'Task without link', url: '', dueAt: '2026-08-25', rank: 2 });
  const dashboard = await buildClientHealthDashboard(repository([nullableLinkRecord]));
  const row = dashboard.rows[0];

  assert.equal(row.dashboardHref, null);
  assert.equal(row.values.budget, 0);
  assert.equal(row.values.monthSpend, 0);
  assert.equal(row.values.currentResultCount, 0);
  assert.equal(row.values.currentCostPerResult, null);
  assert.equal(row.values.marginPercent, null);
  assert.deepEqual(row.timestamps, {
    snapshotDate: '2026-08-26',
    currentWindowStart: '2026-08-13', currentWindowEnd: '2026-08-26',
    priorWindowStart: '2026-07-30', priorWindowEnd: '2026-08-12',
    dataThrough: '2026-08-26', calculatedAt: '2026-08-27T02:03:04.000Z',
  });
  assert.deepEqual(row.sourceFreshness, [
    { key: 'finance', status: 'unavailable', dataThrough: null, stale: null },
    { key: 'paid', status: 'succeeded', dataThrough: '2026-08-26', stale: false },
  ]);
  assert.deepEqual(row.tasks[0], {
    id: 'task-1', name: 'Fix tracking', href: 'https://app.clickup.com/t/task-1',
    dueAt: null, listId: 'list-1', rank: 1,
  });
  assert.deepEqual(row.tasks[1], {
    id: 'task-2', name: 'Task without link', href: null,
    dueAt: '2026-08-25', listId: 'list-1', rank: 2,
  });
  assert.equal(row.configRevision.id, 'revision-1');
  assert.equal(row.reasons[0], 'healthy snapshot reason');
});

test('returns an explicit no-published-snapshots presentation state', async () => {
  const dashboard = await buildClientHealthDashboard(repository([]));
  assert.deepEqual(dashboard, {
    state: 'no_published_snapshots',
    rows: [],
    counts: { healthy: 0, watch: 0, atRisk: 0, incomplete: 0, configurationRequired: 0 },
  });
});

test('propagates repository errors rather than returning a partial or empty dashboard', async () => {
  await assert.rejects(
    buildClientHealthDashboard(repository(new Error('snapshot view unavailable'))),
    /snapshot view unavailable/,
  );
});

test('fails closed on missing, extra, malformed, or config-mismatched dimensions', async () => {
  const base = record('broken', 'healthy');
  const missingMargin = { ...base.dimensionStatuses };
  delete (missingMargin as Record<string, unknown>).margin;
  const cases: Array<{ dimensions: unknown; config?: ClientHealthMetricConfig[]; pattern: RegExp }> = [
    { dimensions: missingMargin, pattern: /exactly five dimensions/i },
    { dimensions: { ...base.dimensionStatuses, rogue: (base.dimensionStatuses as Record<string, unknown>).margin }, pattern: /exactly five dimensions/i },
    { dimensions: { ...base.dimensionStatuses, margin: { status: 'green', value: 1, reason: 'bad', required: false, weight: 14 } }, pattern: /dimension margin status/i },
    { dimensions: { ...base.dimensionStatuses, margin: { status: 'healthy', value: '1', reason: 'bad', required: false, weight: 14 } }, pattern: /dimension margin value/i },
    { dimensions: { ...base.dimensionStatuses, margin: { status: 'healthy', value: 1, reason: '', required: false, weight: 14 } }, pattern: /dimension margin reason/i },
    { dimensions: base.dimensionStatuses, config: metricConfig().slice(0, 4), pattern: /exactly five metric configurations/i },
    { dimensions: base.dimensionStatuses, config: metricConfig().map((item) => item.key === 'margin' ? { ...item, weight: 99 } : item), pattern: /dimension margin.*configuration/i },
  ];

  for (const malformed of cases) {
    const row = record('broken', 'healthy', {
      dimensionStatuses: malformed.dimensions as ClientHealthLatestRecord['dimensionStatuses'],
      ...(malformed.config ? { metricConfig: malformed.config } : {}),
    });
    await assert.rejects(buildClientHealthDashboard(repository([row])), malformed.pattern);
  }
});

test('fails closed when scoreability contradicts the published overall status', async () => {
  await assert.rejects(
    buildClientHealthDashboard(repository([record('broken', 'incomplete', { score: 10 })])),
    /incomplete.*score must be null/i,
  );
  await assert.rejects(
    buildClientHealthDashboard(repository([record('broken', 'healthy', { score: null })])),
    /healthy.*score must be a finite number/i,
  );
});
