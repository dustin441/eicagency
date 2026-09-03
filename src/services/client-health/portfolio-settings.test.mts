import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApprovedConfigRevision, type ActiveConfigRevision } from './config-revision.ts';
import { reviseClientPortfolioSettings, type ClientPortfolioSettingsInput } from './portfolio-settings.ts';

const APPROVED_ID = '11111111-1111-4111-8111-111111111111';
const SETUP_ID = '22222222-2222-4222-8222-222222222222';
const metric = (key: 'budget_pacing'|'north_star'|'hours'|'overdue_tasks'|'margin', direction: 'lower_is_better'|'higher_is_better' = 'lower_is_better') => ({
  key, label: key, adapterKey: `approved.${key}`, required: true, weight: 20, direction,
  greenThreshold: key === 'margin' ? 80 : 10, yellowThreshold: key === 'margin' ? 60 : 20, sourceKeys: ['paid'],
});
const revision = buildApprovedConfigRevision({
  schemaVersion: 3, calculationVersion: 'v3', sourceContractVersion: 's3', clients: [
    {
      clientId: APPROVED_ID, clientKey: 'alpha', displayName: 'Alpha', dashboardHref: '/dashboard/alpha',
      reportingTimezone: 'America/Phoenix', clickupListIds: [], marginAliases: [], configStatus: 'approved',
      economics: { effectiveMonth: '2026-09-01', monthlyRetainer: 4600, deliveryModel: 'custom', fulfillmentHourlyCost: 46, targetMarginPercent: 80 },
      fixedValues: { monthlyBudget: 10000 },
      northStarLanes: [
        { key: 'lead-cpl', label: 'Lead CPL', formula: 'cost_per_result', evaluation: 'period_over_period_change', required: true, weight: 50, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: ['paid'] },
        { key: 'sales-roas', label: 'Sales ROAS', formula: 'roas', evaluation: 'absolute_target', required: true, weight: 50, direction: 'higher_is_better', greenThreshold: 3, yellowThreshold: 2, sourceKeys: ['paid'] },
      ],
      metrics: [metric('budget_pacing'), metric('north_star'), metric('hours'), metric('overdue_tasks'), metric('margin', 'higher_is_better')],
      sources: [{ sourceKey: 'paid', provider: 'supabase', project: 'eic', relation: 'paid_daily', requestFingerprint: 'a'.repeat(64), permittedFactFields: ['currentRows','previousRows','monthSpend','hoursUsed','overdueTaskCount'], freshnessPolicy: { maximumLagDays: 2 } }],
    },
    {
      clientId: SETUP_ID, clientKey: 'setup', displayName: 'Setup', dashboardHref: null,
      reportingTimezone: 'America/Phoenix', clickupListIds: [], marginAliases: [], configStatus: 'configuration_required',
      economics: { effectiveMonth: '2026-09-01', monthlyRetainer: 500, deliveryModel: 'custom', fulfillmentHourlyCost: 46, targetMarginPercent: 80 },
      fixedValues: { monthlyBudget: 900 }, northStarLanes: [], metrics: [], sources: [],
    },
  ],
});
const active: ActiveConfigRevision = { revision, activation: {
  revisionId: revision.id, revisionHash: revision.hash, activationId: '33333333-3333-4333-8333-333333333333',
  reviewedCommitSha: 'b'.repeat(40), operatorIdentity: 'test', reason: 'baseline', activatedAt: '2026-09-03T00:00:00.000Z',
} };

const approvedInput = (): ClientPortfolioSettingsInput => ({
  clientId: APPROVED_ID, effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'platform',
  targetMarginPercent: 75, monthlyBudget: 12000,
  northStarLanes: [
    { key: 'sales-roas', label: 'Sales ROAS target', formula: 'roas', evaluation: 'absolute_target', required: true, weight: 40, direction: 'higher_is_better', greenThreshold: 4, yellowThreshold: 2 },
    { key: 'lead-cpl', label: 'Lead CPL trend', formula: 'cost_per_result', evaluation: 'period_over_period_change', required: true, weight: 60, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 10 },
  ],
});

test('revises approved portfolio settings immutably and preserves reviewed lane source keys', () => {
  const before = structuredClone(active);
  const result = reviseClientPortfolioSettings(active, approvedInput());
  assert.deepEqual(active, before);
  assert.notEqual(result.revision.id, revision.id);
  assert.notEqual(result.revision.hash, revision.hash);
  if (result.revision.content.schemaVersion !== 3) assert.fail('expected v3 revision');
  const client = result.revision.content.clients.find(({ clientId }) => clientId === APPROVED_ID)!;
  assert.deepEqual(client.economics, { effectiveMonth: '2026-10-01', monthlyRetainer: 5200, deliveryModel: 'platform', fulfillmentHourlyCost: 26, targetMarginPercent: 75 });
  assert.equal(client.fixedValues.monthlyBudget, 12000);
  assert.deepEqual(client.northStarLanes.map(({ key, sourceKeys }) => ({ key, sourceKeys })), [
    { key: 'lead-cpl', sourceKeys: ['paid'] }, { key: 'sales-roas', sourceKeys: ['paid'] },
  ]);
  assert.equal(result.preview.monthlyAllottedHours, 50);
  assert.deepEqual(result.preview.northStarLanes, client.northStarLanes);
});

test('approved revisions require the exact reviewed lane key set', () => {
  const missing = approvedInput(); missing.northStarLanes.pop();
  assert.throws(() => reviseClientPortfolioSettings(active, missing), /exact reviewed lane key set/i);
  const extra = approvedInput(); extra.northStarLanes.push({ ...extra.northStarLanes[0], key: 'extra' });
  assert.throws(() => reviseClientPortfolioSettings(active, extra), /exact reviewed lane key set|between 1 and 4/i);
});

test('rejects source-key tampering and unsupported lane semantics', () => {
  const tampered = approvedInput() as unknown as { northStarLanes: Array<Record<string, unknown>> };
  tampered.northStarLanes[0].sourceKeys = ['attacker'];
  assert.throws(() => reviseClientPortfolioSettings(active, tampered as unknown as ClientPortfolioSettingsInput), /incompatible key set/i);
  const fixedCost = approvedInput();
  fixedCost.northStarLanes[1].evaluation = 'absolute_target';
  assert.doesNotThrow(() => reviseClientPortfolioSettings(active, fixedCost));
  const unsupported = approvedInput() as unknown as { northStarLanes: Array<Record<string, unknown>> };
  unsupported.northStarLanes[1].evaluation = 'rolling_average';
  assert.throws(() => reviseClientPortfolioSettings(active, unsupported as unknown as ClientPortfolioSettingsInput), /supported pair/i);
  const wrongDirection = approvedInput(); wrongDirection.northStarLanes[0].direction = 'lower_is_better';
  assert.throws(() => reviseClientPortfolioSettings(active, wrongDirection), /bound to the reviewed source contract/i);
  const wrongFormula = approvedInput(); wrongFormula.northStarLanes[0].formula = 'cost_per_result';
  assert.throws(() => reviseClientPortfolioSettings(active, wrongFormula), /bound to the reviewed source contract/i);
});

test('configuration-required clients preserve an existing budget while permitting economics only', () => {
  const input: ClientPortfolioSettingsInput = {
    clientId: SETUP_ID, effectiveMonth: '2026-10-01', monthlyRetainer: 750, deliveryModel: 'custom',
    targetMarginPercent: 70, monthlyBudget: null, northStarLanes: [],
  };
  const result = reviseClientPortfolioSettings(active, input);
  if (result.revision.content.schemaVersion !== 3) assert.fail('expected v3 revision');
  const client = result.revision.content.clients.find(({ clientId }) => clientId === SETUP_ID)!;
  assert.equal(client.economics.monthlyRetainer, 750);
  assert.equal(client.fixedValues.monthlyBudget, 900);
  assert.equal(result.preview.monthlyBudget, 900);
  assert.deepEqual(client.northStarLanes, []);
  assert.deepEqual(client.metrics, []);
  assert.deepEqual(client.sources, []);
  assert.throws(() => reviseClientPortfolioSettings(active, { ...input, monthlyBudget: 1 }), /cannot edit monthly budget/i);
  assert.throws(() => reviseClientPortfolioSettings(active, { ...input, northStarLanes: [approvedInput().northStarLanes[0]] }), /cannot edit North Star lanes/i);
});

test('rejects unknown clients and malformed bounded values', () => {
  assert.throws(() => reviseClientPortfolioSettings(active, { ...approvedInput(), clientId: '44444444-4444-4444-8444-444444444444' }), /not present/i);
  assert.throws(() => reviseClientPortfolioSettings(active, { ...approvedInput(), monthlyBudget: -1 }), /bounded nonnegative/i);
  assert.throws(() => reviseClientPortfolioSettings(active, { ...approvedInput(), monthlyBudget: Number.NaN }), /bounded nonnegative/i);
  assert.throws(() => reviseClientPortfolioSettings(active, { ...approvedInput(), monthlyRetainer: Number.POSITIVE_INFINITY }), /bounded nonnegative/i);
});

test('equivalent lane order produces deterministic revision identity and preview', () => {
  const first = reviseClientPortfolioSettings(active, approvedInput());
  const reversed = approvedInput(); reversed.northStarLanes.reverse();
  const second = reviseClientPortfolioSettings(active, reversed);
  assert.deepEqual(second, first);
});
