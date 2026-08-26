import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalEvidenceHash } from './evidence.ts';
import {
  buildApprovedConfigRevision,
  type ConfigRevisionPlanClient,
} from './config-revision.ts';

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const SNAPSHOT_DATE = '2026-08-19';

function plan(clientId = CLIENT_A, clientKey = 'alpha', retrievedAt = '2026-08-20T11:00:00.000Z'): ConfigRevisionPlanClient {
  const metricConfig = [
    { key: 'budget_pacing' as const, required: true, weight: 25, direction: 'lower_is_better' as const, greenThreshold: 10, yellowThreshold: 20, sourceKeys: ['paid'] },
    { key: 'north_star' as const, required: true, weight: 25, direction: 'lower_is_better' as const, greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
    { key: 'hours' as const, required: true, weight: 20, direction: 'lower_is_better' as const, greenThreshold: 90, yellowThreshold: 110, sourceKeys: ['paid'] },
    { key: 'overdue_tasks' as const, required: true, weight: 15, direction: 'lower_is_better' as const, greenThreshold: 0, yellowThreshold: 2, sourceKeys: ['paid'] },
    { key: 'margin' as const, required: true, weight: 15, direction: 'higher_is_better' as const, greenThreshold: 60, yellowThreshold: 40, sourceKeys: ['paid'] },
  ];
  return {
    assemblyInput: {
      clientId,
      clientKey,
      configApproved: true,
      calculationVersion: 'health-v1',
      sourceContractVersion: 'sources-v1',
      snapshotDate: SNAPSHOT_DATE,
      retrievedAt,
      phoenix: {
        month: { start: '2026-08-01', end: SNAPSHOT_DATE },
        current: { start: '2026-08-06', end: SNAPSHOT_DATE },
        previous: { start: '2026-07-23', end: '2026-08-05' },
        elapsedMonthDays: 19,
        daysInMonth: 31,
        comparisonDays: 14,
      },
      metricConfig,
      requiredSourceKeys: ['paid'],
      optionalSourceKeys: [],
      sourceBindings: {
        paid: {
          sourceKey: 'paid', provider: 'supabase', project: 'eic', relation: 'approved_paid_daily',
          requestFingerprint: 'a'.repeat(64),
          permittedValueFields: ['revenue', 'previousRows', 'overdueTaskCount', 'monthSpend', 'hoursUsed', 'fulfillmentCost', 'currentRows'],
          permitsTasks: false, expectedDataThrough: SNAPSHOT_DATE,
        },
      },
      fixedValues: { monthlyBudget: 1_000, monthlyHoursAllotment: null },
      sourceResults: [],
    },
    collectors: [{
      sourceKey: 'paid', windowStart: '2026-08-01', windowEnd: SNAPSHOT_DATE,
      async collect() { return { privateRuntimeResult: 'not revision content' }; },
    }],
    display: {
      displayName: `Client ${clientKey}`, dashboardHref: `/dashboard/${clientKey}`, configStatus: 'approved',
      reportingTimezone: 'America/Phoenix', monthlyHoursAllotment: null,
      clickupListIds: ['list-b', 'list-a'], marginAliases: ['Zulu', 'Alpha'], metadata: { tier: 'managed', nested: { b: 2, a: 1 } },
    },
    metricDisplayConfig: metricConfig.map(({ key }) => ({
      key, label: key === 'budget_pacing' ? 'Budget pacing' : 'North star', adapterKey: `approved.${key}`,
      sourceConfig: { relation: `${key}_facts`, options: { b: 2, a: 1 } },
      approvedAt: '2026-08-01T00:00:00.000Z', approvedBy: 'reviewer@example.com',
    })),
  };
}

function unapproved(clientId = CLIENT_B): ConfigRevisionPlanClient {
  const value = plan(clientId, 'configuration-required');
  value.assemblyInput.configApproved = false;
  value.assemblyInput.sourceResults = [{ privateResult: 'ignored' }] as never;
  value.assemblyInput.sourceBindings = { privateBinding: { secretRuntimeState: true } } as never;
  value.assemblyInput.requiredSourceKeys = ['ignored'];
  (value.assemblyInput as unknown as Record<string, unknown>).privateRuntimeField = 'ignored';
  value.collectors = [];
  value.display.configStatus = 'configuration_required';
  value.metricDisplayConfig = [];
  return value;
}

function throwsPlan(mutate: (value: ConfigRevisionPlanClient) => void, pattern: RegExp): void {
  const value = plan();
  mutate(value);
  assert.throws(() => buildApprovedConfigRevision([value]), pattern);
}

test('canonical order is deterministic across client, metric, display, and allowlist array ordering', () => {
  const firstA = plan(CLIENT_A, 'alpha');
  const firstB = plan(CLIENT_B, 'beta');
  firstA.assemblyInput.metricConfig.reverse();
  firstA.metricDisplayConfig.reverse();
  firstA.display.clickupListIds.reverse();
  firstA.display.marginAliases.reverse();

  const first = buildApprovedConfigRevision([firstB, firstA]);
  const second = buildApprovedConfigRevision([plan(CLIENT_A, 'alpha'), plan(CLIENT_B, 'beta')]);

  assert.deepEqual(first, second);
  assert.equal(first.hash, canonicalEvidenceHash(first.content));
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(first.content.clients.map(({ assemblyInput }) => assemblyInput.clientId), [CLIENT_A, CLIENT_B]);
  assert.deepEqual(first.content.clients[0].assemblyInput.metricConfig.map(({ key }) => key), [
    'budget_pacing', 'hours', 'margin', 'north_star', 'overdue_tasks',
  ]);
});

test('retrieval data, source results, collector functions, and unapproved private outer fields are excluded', () => {
  const firstApproved = plan(CLIENT_A, 'alpha', '2026-08-20T11:00:00.000Z');
  const secondApproved = plan(CLIENT_A, 'alpha', '2026-08-20T12:00:00.000Z');
  secondApproved.collectors[0].collect = async () => ({ differentPrivateRuntimeResult: true });
  const firstUnapproved = unapproved();
  const secondUnapproved = unapproved();
  secondUnapproved.assemblyInput.sourceResults = [{ tokenFromCollector: 'different ignored value' }] as never;
  (secondUnapproved.assemblyInput as unknown as Record<string, unknown>).privateRuntimeField = 'different ignored value';

  const first = buildApprovedConfigRevision([firstApproved, firstUnapproved]);
  const second = buildApprovedConfigRevision([secondApproved, secondUnapproved]);

  assert.deepEqual(first, second);
  assert.ok(!('retrievedAt' in first.content.clients[0].assemblyInput));
  assert.ok(!('sourceResults' in first.content.clients[0].assemblyInput));
  assert.ok(!('collect' in first.content.clients[0].collectors[0]));
  assert.ok(!('privateRuntimeField' in first.content.clients[1].assemblyInput));
});

test('collectors exactly cover source bindings and enforce exact keys and real bounded windows', () => {
  throwsPlan((value) => { value.collectors = []; }, /exactly cover authorized source bindings/i);
  throwsPlan((value) => { value.collectors[0].sourceKey = 'other'; }, /exactly cover authorized source bindings/i);
  throwsPlan((value) => { value.collectors[0].windowEnd = null; }, /invalid window/i);
  throwsPlan((value) => { value.collectors[0].windowStart = '2026-08-20'; }, /invalid window/i);
  throwsPlan((value) => { value.collectors[0].windowStart = '2026-07-22'; }, /invalid window/i);
  throwsPlan((value) => { value.collectors[0].windowStart = '2026-02-30'; }, /real calendar date/i);
  throwsPlan((value) => { value.collectors[0].windowStart = '2026-13-01'; }, /real calendar date/i);
  throwsPlan((value) => { (value.collectors[0] as unknown as Record<string, unknown>).privateField = true; }, /incompatible key set/i);
});

test('metric display coverage and display authorization status must exactly match engine configuration', () => {
  throwsPlan((value) => { value.metricDisplayConfig.pop(); }, /exactly cover engine metric configuration/i);
  throwsPlan((value) => { value.metricDisplayConfig[0].key = 'margin'; }, /exactly cover engine metric configuration/i);
  throwsPlan((value) => { value.display.configStatus = 'configuration_required'; }, /conflicts with calculation authorization/i);
  const value = unapproved();
  value.metricDisplayConfig = plan().metricDisplayConfig;
  assert.throws(() => buildApprovedConfigRevision([value]), /empty for configuration-required clients/i);
});

test('secret-bearing keys and metadata/source configuration bounds are rejected', () => {
  throwsPlan((value) => { value.display.metadata = { api_token: 'secret' }; }, /forbidden or malformed key/i);
  throwsPlan((value) => { value.metricDisplayConfig[0].sourceConfig = { privateKey: 'secret' }; }, /forbidden or malformed key/i);
  throwsPlan((value) => { value.display.metadata = { note: 'x'.repeat(2049) }; }, /overlong string/i);
  throwsPlan((value) => { value.metricDisplayConfig[0].sourceConfig = { rows: Array.from({ length: 101 }, () => 1) }; }, /oversized array/i);
  throwsPlan((value) => { value.display.monthlyHoursAllotment = 1_000_000_001; }, /bounded nonnegative number/i);
});

test('duplicate clients and collectors are rejected', () => {
  assert.throws(() => buildApprovedConfigRevision([plan(), plan()]), /duplicate revision client/i);
  throwsPlan((value) => { value.collectors.push({ ...value.collectors[0] }); }, /exactly cover authorized source bindings|duplicates/i);
});

test('configuration content changes produce a new hash and deterministic revision id', () => {
  const first = buildApprovedConfigRevision([plan()]);
  const changed = plan();
  changed.display.displayName = 'Changed approved display name';
  const second = buildApprovedConfigRevision([changed]);

  assert.notEqual(first.hash, second.hash);
  assert.notEqual(first.id, second.id);
  assert.equal(buildApprovedConfigRevision([changed]).id, second.id);
});

test('approved configuration-bearing objects reject unknown outer keys', () => {
  throwsPlan((value) => { (value as unknown as Record<string, unknown>).unknown = true; }, /incompatible key set/i);
  throwsPlan((value) => { (value.assemblyInput as unknown as Record<string, unknown>).unknown = true; }, /unsupported fields/i);
  throwsPlan((value) => { (value.display as unknown as Record<string, unknown>).unknown = true; }, /incompatible key set/i);
  throwsPlan((value) => { (value.metricDisplayConfig[0] as unknown as Record<string, unknown>).unknown = true; }, /incompatible key set/i);
});
