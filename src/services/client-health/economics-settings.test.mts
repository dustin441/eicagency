import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApprovedConfigRevision, type ActiveConfigRevision } from './config-revision.ts';
import { normalizeClientEconomicsSettings, reviseClientEconomics } from './economics-settings.ts';

const metric = (key: 'budget_pacing'|'north_star'|'hours'|'overdue_tasks'|'margin', direction: 'lower_is_better'|'higher_is_better' = 'lower_is_better') => ({
  key, label: key, adapterKey: `approved.${key}`, required: true, weight: 20, direction,
  greenThreshold: key === 'margin' ? 80 : 10, yellowThreshold: key === 'margin' ? 60 : 20, sourceKeys: ['paid'],
});
const revision = buildApprovedConfigRevision({
  schemaVersion: 3, calculationVersion: 'v3', sourceContractVersion: 's3', clients: [{
    clientId: '11111111-1111-4111-8111-111111111111', clientKey: 'alpha', displayName: 'Alpha',
    dashboardHref: '/dashboard/alpha', reportingTimezone: 'America/Phoenix', clickupListIds: [], marginAliases: [], configStatus: 'approved',
    economics: { effectiveMonth: '2026-09-01', monthlyRetainer: 4600, deliveryModel: 'custom', fulfillmentHourlyCost: 46, targetMarginPercent: 80 },
    fixedValues: { monthlyBudget: 10000 },
    northStarLanes: [{ key: 'cpl', label: 'CPL', formula: 'cost_per_result', evaluation: 'period_over_period_change', required: true, weight: 100, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] }],
    metrics: [metric('budget_pacing'), metric('north_star'), metric('hours'), metric('overdue_tasks'), metric('margin', 'higher_is_better')],
    sources: [{ sourceKey: 'paid', provider: 'supabase', project: 'eic', relation: 'paid_daily', requestFingerprint: 'a'.repeat(64), permittedFactFields: ['currentRows','previousRows','monthSpend','hoursUsed','overdueTaskCount'], freshnessPolicy: { maximumLagDays: 2 } }],
  }],
});
if (revision.content.schemaVersion !== 3) throw new Error('expected v3 fixture');
const revisionClient = revision.content.clients[0];
const active: ActiveConfigRevision = { revision, activation: {
  revisionId: revision.id, revisionHash: revision.hash, activationId: '22222222-2222-4222-8222-222222222222',
  reviewedCommitSha: 'b'.repeat(40), operatorIdentity: 'test', reason: 'baseline', activatedAt: '2026-09-03T00:00:00.000Z',
} };

test('economics settings derive fixed model rate and allotted hours', () => {
  assert.deepEqual(normalizeClientEconomicsSettings({ clientId: revisionClient.clientId, effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'platform', targetMarginPercent: 80 }), {
    clientId: revisionClient.clientId, effectiveMonth: '2026-10-01', monthlyRetainer: 5200,
    deliveryModel: 'platform', targetMarginPercent: 80, fulfillmentHourlyCost: 26, monthlyAllottedHours: 40,
  });
});

test('economics revision is immutable, preserves portfolio contract, and gets a new content address', () => {
  const before = structuredClone(active);
  const result = reviseClientEconomics(active, { clientId: revisionClient.clientId, effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'platform', targetMarginPercent: 80 });
  assert.deepEqual(active, before);
  assert.notEqual(result.revision.id, revision.id);
  assert.notEqual(result.revision.hash, revision.hash);
  if (result.revision.content.schemaVersion !== 3) assert.fail('expected revised v3 content');
  assert.deepEqual(result.revision.content.clients[0].metrics, revisionClient.metrics);
  assert.deepEqual(result.revision.content.clients[0].sources, revisionClient.sources);
  assert.deepEqual(result.revision.content.clients[0].northStarLanes, revisionClient.northStarLanes);
  assert.deepEqual(result.revision.content.clients[0].economics, { effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'platform', fulfillmentHourlyCost: 26, targetMarginPercent: 80 });
});

test('economics settings reject invalid month, margin, and client identity', () => {
  const input = { clientId: revisionClient.clientId, effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'custom' as const, targetMarginPercent: 80 };
  assert.throws(() => normalizeClientEconomicsSettings({ ...input, effectiveMonth: '2026-10-02' }), /first day/);
  assert.throws(() => normalizeClientEconomicsSettings({ ...input, targetMarginPercent: 100 }), /between 0 and 100/);
  assert.throws(() => reviseClientEconomics(active, { ...input, clientId: '33333333-3333-4333-8333-333333333333' }), /not present/);
});
