import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApprovedConfigRevision, type ActiveConfigRevision } from './config-revision.ts';
import {
  createProductionClientHealthRefreshPlanner,
  type ProductionAdapterFactories,
} from './production-refresh-planner.ts';

const CLIENT_ID = '10000000-0000-4000-8000-000000000001';
const SNAPSHOT_DATE = '2026-09-02';

function active(content: unknown): ActiveConfigRevision {
  const revision = buildApprovedConfigRevision(content);
  return {
    revision,
    activation: {
      revisionId: revision.id,
      revisionHash: revision.hash,
      activationId: '20000000-0000-4000-8000-000000000002',
      reviewedCommitSha: 'a'.repeat(40),
      operatorIdentity: 'operator@example.com',
      reason: 'Production fixture approval',
      activatedAt: '2026-09-03T00:00:00.000Z',
    },
  };
}

const source = (sourceKey: 'performance' | 'clickup') => sourceKey === 'performance' ? {
  sourceKey,
  provider: 'supabase' as const,
  project: 'eic' as const,
  relation: 'client_health_alpha_daily',
  requestFingerprint: 'a'.repeat(64),
  permittedFactFields: ['monthSpend', 'currentRows', 'previousRows'] as const,
  freshnessPolicy: { maximumLagDays: 2 },
} : {
  sourceKey,
  provider: 'clickup' as const,
  endpointFamily: 'team-time-entries-and-overdue-tasks' as const,
  requestFingerprint: 'b'.repeat(64),
  permittedFactFields: ['hoursUsed', 'overdueTaskCount'] as const,
  freshnessPolicy: { maximumLagDays: 0 },
  permitsTasks: true,
  allowedListIds: ['123'],
};

const metric = (
  key: 'budget_pacing' | 'north_star' | 'hours' | 'overdue_tasks' | 'margin',
  sourceKey: 'performance' | 'clickup',
  required = true,
) => ({
  key,
  label: key,
  adapterKey: `alpha.${sourceKey}`,
  required,
  weight: 20,
  direction: key === 'margin' ? 'higher_is_better' as const : 'lower_is_better' as const,
  greenThreshold: key === 'margin' ? 60 : 10,
  yellowThreshold: key === 'margin' ? 40 : 20,
  sourceKeys: [sourceKey],
});

function v2Content(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2 as const,
    calculationVersion: 'health-v2',
    sourceContractVersion: 'sources-v2',
    clients: [{
      clientId: CLIENT_ID,
      clientKey: 'alpha',
      displayName: 'Alpha',
      dashboardHref: '/dashboard/alpha',
      reportingTimezone: 'America/Phoenix',
      clickupListIds: ['123'],
      marginAliases: [],
      configStatus: 'approved' as const,
      fixedValues: { monthlyBudget: 1_000, monthlyHoursAllotment: 20 },
      metrics: [
        metric('budget_pacing', 'performance'),
        metric('north_star', 'performance'),
        metric('hours', 'clickup'),
        metric('overdue_tasks', 'clickup'),
        metric('margin', 'clickup', false),
      ],
      sources: [source('performance'), source('clickup')],
      ...overrides,
    }],
  };
}

function factories(calls: string[]): ProductionAdapterFactories {
  return {
    createSupabase(adapterKey) {
      calls.push(`supabase:${adapterKey}`);
      return async () => ({ adapterKey });
    },
    createClickUp(clientKey, contractVersion) {
      calls.push(`clickup:${clientKey}:${contractVersion}`);
      return async () => ({ clientKey });
    },
  };
}

test('materializes exact v2 bindings, adapter factories, fingerprints, and Phoenix windows', async () => {
  const calls: string[] = [];
  const revision = active(v2Content());
  const plan = await createProductionClientHealthRefreshPlanner(factories(calls)).materializePlan(revision, SNAPSHOT_DATE);
  const client = plan.clients[0];

  assert.deepEqual(plan.configRevision, revision.revision);
  assert.deepEqual(calls, ['clickup:alpha:sources-v2', 'supabase:alpha.performance']);
  assert.deepEqual(client.assemblyInput.phoenix, {
    month: { start: '2026-09-01', end: '2026-09-02' },
    current: { start: '2026-08-20', end: '2026-09-02' },
    previous: { start: '2026-08-06', end: '2026-08-19' },
    elapsedMonthDays: 2,
    daysInMonth: 30,
    comparisonDays: 14,
  });
  assert.equal(client.assemblyInput.retrievedAt, '2026-09-03T07:00:00.000Z');
  assert.equal(client.assemblyInput.sourceBindings.performance.requestFingerprint, 'a'.repeat(64));
  assert.equal(client.assemblyInput.sourceBindings.clickup.requestFingerprint, 'b'.repeat(64));
  assert.deepEqual(client.assemblyInput.requiredSourceKeys, ['clickup', 'performance']);
  assert.deepEqual(client.assemblyInput.optionalSourceKeys, []);
  assert.deepEqual(client.collectors.map(({ sourceKey, windowStart, windowEnd }) => ({ sourceKey, windowStart, windowEnd })), [
    { sourceKey: 'clickup', windowStart: '2026-09-01', windowEnd: '2026-09-02' },
    { sourceKey: 'performance', windowStart: '2026-08-06', windowEnd: '2026-09-02' },
  ]);
});

test('fails closed for google-sheets while metric adapter labels cannot redirect source collection', async () => {
  const planner = createProductionClientHealthRefreshPlanner(factories([]));
  const google = v2Content();
  google.clients[0].sources[0] = {
    sourceKey: 'performance', provider: 'google-sheets', spreadsheetId: 'sheet', range: 'A1:B2',
    approvedClientAliasHash: 'c'.repeat(64), valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING', requestFingerprint: 'a'.repeat(64),
    permittedFactFields: ['monthSpend'], freshnessPolicy: { maximumLagDays: 0 },
  } as never;
  assert.throws(() => planner.materializePlan(active(google), SNAPSHOT_DATE), /unsupported production source provider/i);

  const mismatch = v2Content();
  mismatch.clients[0].metrics[0].adapterKey = 'canary.performance';
  const plan = await planner.materializePlan(active(mismatch), SNAPSHOT_DATE);
  assert.equal(plan.clients[0].collectors.find(({ sourceKey }) => sourceKey === 'performance')?.sourceKey, 'performance');
});

test('configuration-required clients bypass all collectors and adapter validation', async () => {
  const calls: string[] = [];
  const revision = active({
    schemaVersion: 2,
    calculationVersion: 'health-v2',
    sourceContractVersion: 'sources-v2',
    clients: [{
      clientId: CLIENT_ID, clientKey: 'pending', displayName: 'Pending', dashboardHref: null,
      reportingTimezone: 'America/Phoenix', clickupListIds: [], marginAliases: [],
      configStatus: 'configuration_required', fixedValues: { monthlyBudget: null, monthlyHoursAllotment: null },
      metrics: [], sources: [],
    }],
  });
  const plan = await createProductionClientHealthRefreshPlanner(factories(calls)).materializePlan(revision, SNAPSHOT_DATE);
  assert.deepEqual(calls, []);
  assert.deepEqual(plan.clients[0].collectors, []);
  assert.equal(plan.clients[0].assemblyInput.configApproved, false);
  assert.deepEqual(plan.clients[0].assemblyInput.sourceBindings, {});
});

test('v3 materialization projects economics into exact engine fixed values', async () => {
  const base = v2Content().clients[0];
  const { fixedValues: _v2Fixed, ...shared } = base;
  const revision = active({
    schemaVersion: 3,
    calculationVersion: 'health-v3',
    sourceContractVersion: 'sources-v3',
    clients: [{
      ...shared,
      fixedValues: { monthlyBudget: 1_200 },
      economics: {
        effectiveMonth: '2026-09-01', monthlyRetainer: 4_600, deliveryModel: 'custom',
        fulfillmentHourlyCost: 46, targetMarginPercent: 80,
      },
      northStarLanes: [{
        key: 'cpl', label: 'CPL', formula: 'cost_per_result', evaluation: 'period_over_period_change',
        required: true, weight: 100, direction: 'lower_is_better', greenThreshold: 5,
        yellowThreshold: 15, sourceKeys: ['performance'],
      }],
    }],
  });
  const plan = await createProductionClientHealthRefreshPlanner(factories([])).materializePlan(revision, SNAPSHOT_DATE);
  assert.deepEqual(plan.clients[0].assemblyInput.fixedValues, { monthlyBudget: 1_200, monthlyHoursAllotment: 20 });
  const revisedClient = revision.revision.content.clients[0];
  assert.ok('northStarLanes' in revisedClient);
  assert.deepEqual(plan.clients[0].assemblyInput.northStarLanes, revisedClient.northStarLanes);
});

test('production planner contains no Canary adapter path', async () => {
  const sourceText = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('./production-refresh-planner.ts', import.meta.url), 'utf8'));
  assert.equal(/canary/i.test(sourceText), false);
});