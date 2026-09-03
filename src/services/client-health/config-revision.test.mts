import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalEvidenceHash } from './evidence.ts';
import {
  buildApprovedConfigRevision,
  normalizeActiveConfigRevision,
  projectV3ClientEconomics,
  type ApprovedConfigRevisionV2,
  type ApprovedConfigRevisionV3,
} from './config-revision.ts';

type MutableMetric = ApprovedConfigRevisionV2['clients'][number]['metrics'][number] & Record<string, unknown>;
type MutableSource = ApprovedConfigRevisionV2['clients'][number]['sources'][number] & Record<string, unknown>;
type MutableClient = Omit<ApprovedConfigRevisionV2['clients'][number], 'metrics' | 'sources' | 'fixedValues'> & Record<string, unknown> & {
  metrics: MutableMetric[];
  sources: MutableSource[];
  fixedValues: ApprovedConfigRevisionV2['clients'][number]['fixedValues'] & Record<string, unknown>;
};
type MutableRevision = Omit<ApprovedConfigRevisionV2, 'clients'> & Record<string, unknown> & { clients: MutableClient[] };
type MutableActive = {
  revision: ReturnType<typeof buildApprovedConfigRevision> & Record<string, unknown>;
  activation: {
    revisionId: string; revisionHash: string; activationId: string; reviewedCommitSha: string;
    operatorIdentity: string; reason: string; activatedAt: string;
  } & Record<string, unknown>;
};

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';

function approved(clientId = CLIENT_A, clientKey = 'alpha') {
  const sourceKeys = ['paid'];
  const metric = (key: ApprovedConfigRevisionV2['clients'][number]['metrics'][number]['key'], direction: 'lower_is_better' | 'higher_is_better' = 'lower_is_better') => ({
    key, label: key, adapterKey: `approved.${key}`, required: true, weight: 20, direction,
    greenThreshold: key === 'margin' ? 60 : 10, yellowThreshold: key === 'margin' ? 40 : 20, sourceKeys,
  });
  return {
    clientId, clientKey, displayName: `Client ${clientKey}`, dashboardHref: `/dashboard/${clientKey}`,
    reportingTimezone: 'America/Phoenix', clickupListIds: ['list-b', 'list-a'], marginAliases: ['Zulu', 'Alpha'],
    configStatus: 'approved' as const,
    fixedValues: { monthlyBudget: 10_000, monthlyHoursAllotment: 20 },
    metrics: [metric('budget_pacing'), metric('north_star'), metric('hours'), metric('overdue_tasks'), metric('margin', 'higher_is_better')],
    sources: [{
      sourceKey: 'paid', provider: 'supabase' as const, project: 'eic' as const, relation: 'approved_paid_daily',
      requestFingerprint: 'a'.repeat(64), permittedFactFields: ['monthSpend', 'currentRows', 'previousRows'] as ApprovedConfigRevisionV2['clients'][number]['sources'][number]['permittedFactFields'],
      freshnessPolicy: { maximumLagDays: 1 },
    }],
  };
}
function content(): ApprovedConfigRevisionV2 {
  return { schemaVersion: 2, calculationVersion: 'health-v2', sourceContractVersion: 'sources-v2', clients: [approved()] };
}
function v3Content(): ApprovedConfigRevisionV3 {
  const { fixedValues: _v2FixedValues, ...base } = approved();
  return {
    schemaVersion: 3,
    calculationVersion: 'health-v2',
    sourceContractVersion: 'sources-v2',
    clients: [{
      ...base,
      economics: {
        effectiveMonth: '2026-09-01', monthlyRetainer: 4_600, deliveryModel: 'custom',
        fulfillmentHourlyCost: 46, targetMarginPercent: 80,
      },
      fixedValues: { monthlyBudget: 10_000 },
      northStarLanes: [{
        key: 'cpl', label: 'Cost per lead trend', formula: 'cost_per_result', evaluation: 'period_over_period_change',
        required: true, weight: 100, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15,
        sourceKeys: ['paid'],
      }],
    }],
  };
}
function mutate(mutator: (value: MutableRevision) => void, pattern = /incompatible|invalid|must|cannot|exact/i): void {
  const value = structuredClone(content()) as MutableRevision; mutator(value); assert.throws(() => buildApprovedConfigRevision(value), pattern);
}

test('v2 content canonicalizes all sets and derives stable SHA-256 and UUID', () => {
  const first = content() as MutableRevision; first.clients.push(approved(CLIENT_B, 'beta') as MutableClient); first.clients.reverse();
  first.clients[1].metrics.reverse(); first.clients[1].clickupListIds.reverse(); first.clients[1].marginAliases.reverse();
  const second = content() as MutableRevision; second.clients.push(approved(CLIENT_B, 'beta') as MutableClient);
  const a = buildApprovedConfigRevision(first); const b = buildApprovedConfigRevision(second);
  assert.deepEqual(a, b); assert.equal(a.hash, canonicalEvidenceHash(a.content));
  assert.match(a.hash, /^[a-f0-9]{64}$/); assert.match(a.id, /^[a-f0-9-]{36}$/);
  assert.equal(a.content.schemaVersion, 2); assert.deepEqual(a.content.clients.map(({clientId})=>clientId), [CLIENT_A, CLIENT_B]);
});

test('v2 canonical hash remains frozen across the additive v3 implementation', () => {
  const revision = buildApprovedConfigRevision(content());
  assert.equal(revision.hash, '244e8b44fb58cd2b0c8565662f62121a80f378752af75061b22bbd051de06c25');
  assert.equal(revision.id, '244e8b44-fb58-8d2b-8c85-65662f62121a');
});

test('v3 content canonicalizes sets and economics into a stable content address', () => {
  const first = v3Content();
  first.clients[0].metrics.reverse(); first.clients[0].clickupListIds.reverse(); first.clients[0].marginAliases.reverse();
  const a = buildApprovedConfigRevision(first); const b = buildApprovedConfigRevision(v3Content());
  assert.deepEqual(a, b); assert.equal(a.content.schemaVersion, 3); assert.equal(a.hash, canonicalEvidenceHash(a.content));
  if (a.content.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.deepEqual(a.content.clients[0].economics, {
    effectiveMonth: '2026-09-01', monthlyRetainer: 4_600, deliveryModel: 'custom',
    fulfillmentHourlyCost: 46, targetMarginPercent: 80,
  });
});

test('v3 setup-state clients preserve verified economics without inventing performance configuration', () => {
  const value = v3Content();
  value.clients[0].configStatus = 'configuration_required';
  value.clients[0].metrics = [];
  value.clients[0].sources = [];
  value.clients[0].northStarLanes = [];
  const normalized = buildApprovedConfigRevision(value).content;
  if (normalized.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.equal(normalized.clients[0].economics.monthlyRetainer, 4_600);
  assert.equal(normalized.clients[0].fixedValues.monthlyBudget, 10_000);
  assert.deepEqual(normalized.clients[0].metrics, []);
  assert.deepEqual(normalized.clients[0].sources, []);
  assert.deepEqual(normalized.clients[0].northStarLanes, []);
});

test('v3 requires exact bounded North Star lanes while v2 has no lane field', () => {
  assert.equal('northStarLanes' in buildApprovedConfigRevision(content()).content.clients[0], false);
  const normalized = buildApprovedConfigRevision(v3Content()).content;
  if (normalized.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.deepEqual(normalized.clients[0].northStarLanes.map(({ key }) => key), ['cpl']);

  const missing = structuredClone(v3Content()) as unknown as { clients: Array<Record<string, unknown>> };
  delete missing.clients[0].northStarLanes;
  assert.throws(() => buildApprovedConfigRevision(missing), /incompatible key set/i);

  const empty = structuredClone(v3Content()); empty.clients[0].northStarLanes = [];
  assert.throws(() => buildApprovedConfigRevision(empty), /between 1 and 4 lanes/i);
  const duplicate = structuredClone(v3Content()); duplicate.clients[0].northStarLanes.push(structuredClone(duplicate.clients[0].northStarLanes[0]));
  assert.throws(() => buildApprovedConfigRevision(duplicate), /unique lane keys/i);
  const noSources = structuredClone(v3Content()); noSources.clients[0].northStarLanes[0].sourceKeys = [];
  assert.throws(() => buildApprovedConfigRevision(noSources), /sourceKeys.*nonempty/i);
  const unknownSource = structuredClone(v3Content()); unknownSource.clients[0].northStarLanes[0].sourceKeys = ['unknown'];
  assert.throws(() => buildApprovedConfigRevision(unknownSource), /reference configured sources/i);
  const absoluteCost = structuredClone(v3Content()); absoluteCost.clients[0].northStarLanes[0].evaluation = 'absolute_target';
  const absoluteNormalized = buildApprovedConfigRevision(absoluteCost).content;
  if (absoluteNormalized.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.equal(absoluteNormalized.clients[0].northStarLanes[0].evaluation, 'absolute_target');
  const incompatibleDirection = structuredClone(absoluteCost); incompatibleDirection.clients[0].northStarLanes[0].direction = 'higher_is_better';
  assert.throws(() => buildApprovedConfigRevision(incompatibleDirection), /direction.*incompatible/i);
  const overweight = structuredClone(v3Content()); overweight.clients[0].northStarLanes[0].weight = 101;
  assert.throws(() => buildApprovedConfigRevision(overweight), /weight/i);
});

test('v3 lane sources require exact fact permissions and parent-metric ownership', () => {
  const missingPrevious = v3Content();
  missingPrevious.clients[0].sources[0].permittedFactFields = ['currentRows'];
  assert.throws(() => buildApprovedConfigRevision(missingPrevious), /source must permit previousRows/i);

  const ownershipDrift = v3Content();
  ownershipDrift.clients[0].sources.push({
    ...structuredClone(ownershipDrift.clients[0].sources[0]),
    sourceKey: 'other',
    requestFingerprint: 'b'.repeat(64),
  });
  ownershipDrift.clients[0].metrics.find(({ key }) => key === 'north_star')!.sourceKeys = ['paid', 'other'];
  assert.throws(() => buildApprovedConfigRevision(ownershipDrift), /must equal the North Star lane source union/i);

  const exactKeys = v3Content();
  (exactKeys.clients[0].northStarLanes[0] as unknown as Record<string, unknown>).unknown = true;
  assert.throws(() => buildApprovedConfigRevision(exactKeys), /incompatible key set/i);

  const roasCurrentOnly = v3Content();
  roasCurrentOnly.clients[0].northStarLanes[0] = {
    key: 'roas', label: 'ROAS target', formula: 'roas', evaluation: 'absolute_target', required: true,
    weight: 100, direction: 'higher_is_better', greenThreshold: 3, yellowThreshold: 2, sourceKeys: ['paid'],
  };
  roasCurrentOnly.clients[0].sources[0].permittedFactFields = ['currentRows'];
  assert.doesNotThrow(() => buildApprovedConfigRevision(roasCurrentOnly));

  const roasTrend = structuredClone(roasCurrentOnly);
  roasTrend.clients[0].northStarLanes[0].evaluation = 'period_over_period_change';
  assert.throws(() => buildApprovedConfigRevision(roasTrend), /source must permit previousRows/i);
  roasTrend.clients[0].sources[0].permittedFactFields = ['currentRows', 'previousRows'];
  assert.doesNotThrow(() => buildApprovedConfigRevision(roasTrend));
});

test('v3 canonicalizes Spartaco dual lanes by key and enforces a bounded total weight', () => {
  const value = v3Content();
  value.clients[0].clientKey = 'spartaco';
  value.clients[0].northStarLanes[0].weight = 50;
  value.clients[0].northStarLanes.push({
    key: 'roas', label: 'ROAS target', formula: 'roas', evaluation: 'absolute_target', required: true,
    weight: 50, direction: 'higher_is_better', greenThreshold: 4, yellowThreshold: 2, sourceKeys: ['paid'],
  });
  value.clients[0].northStarLanes.reverse();
  const normalized = buildApprovedConfigRevision(value).content;
  if (normalized.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.deepEqual(normalized.clients[0].northStarLanes.map(({ key }) => key), ['cpl', 'roas']);

  value.clients[0].northStarLanes[0].weight = 51;
  assert.throws(() => buildApprovedConfigRevision(value), /total lane weight/i);
});

test('v3 projection derives allotted hours and exposes revenue/rate without inventing usage or cost', () => {
  const normalized = buildApprovedConfigRevision(v3Content()).content;
  if (normalized.schemaVersion !== 3) assert.fail('expected v3 content');
  const projected = projectV3ClientEconomics(normalized.clients[0]);
  assert.deepEqual(projected, {
    fixedValues: { monthlyBudget: 10_000, monthlyHoursAllotment: 20 },
    economicsInputs: {
      effectiveMonth: '2026-09-01', revenue: 4_600, deliveryModel: 'custom',
      fulfillmentHourlyCost: 46, targetMarginPercent: 80,
    },
  });
  assert.equal('hoursUsed' in projected.economicsInputs, false);
  assert.equal('fulfillmentCost' in projected.economicsInputs, false);
});

test('v3 requires exact explicit economics and rejects dates, values, unknown keys, and allotted-hours input', () => {
  const candidate = () => structuredClone(v3Content());
  for (const effectiveMonth of ['2026-09-02', '2026-9-01', 'not-a-date', '2026-13-01']) {
    const value = candidate(); value.clients[0].economics.effectiveMonth = effectiveMonth;
    assert.throws(() => buildApprovedConfigRevision(value), /effectiveMonth.*first day|canonical/i);
  }
  for (const mutateEconomics of [
    (economics: Record<string, unknown>) => { economics.monthlyRetainer = -1; },
    (economics: Record<string, unknown>) => { economics.fulfillmentHourlyCost = 0; },
    (economics: Record<string, unknown>) => { economics.targetMarginPercent = 100; },
    (economics: Record<string, unknown>) => { economics.deliveryModel = 'agency'; },
    (economics: Record<string, unknown>) => { economics.unknown = true; },
    (economics: Record<string, unknown>) => { delete economics.targetMarginPercent; },
  ]) {
    const value = candidate(); mutateEconomics(value.clients[0].economics as unknown as Record<string, unknown>);
    assert.throws(() => buildApprovedConfigRevision(value), /retainer|greater than zero|less than 100|delivery model|incompatible key set/i);
  }
  const hours = candidate(); (hours.clients[0].fixedValues as Record<string, unknown>).monthlyHoursAllotment = 20;
  assert.throws(() => buildApprovedConfigRevision(hours), /fixedValues.*incompatible key set/i);
});

test('v3 preserves null retainer and legitimate zeros while defaults remain explicit', () => {
  const value = v3Content(); value.clients[0].economics.monthlyRetainer = null;
  value.clients[0].fixedValues.monthlyBudget = 0; value.clients[0].economics.targetMarginPercent = 0;
  const normalized = buildApprovedConfigRevision(value).content;
  if (normalized.schemaVersion !== 3) assert.fail('expected v3 content');
  assert.equal(normalized.clients[0].economics.monthlyRetainer, null);
  assert.equal(normalized.clients[0].economics.targetMarginPercent, 0);
  assert.deepEqual(projectV3ClientEconomics(normalized.clients[0]).fixedValues, { monthlyBudget: 0, monthlyHoursAllotment: null });

  const missingDefault = structuredClone(v3Content()) as unknown as { clients: Array<{ economics: Record<string, unknown> }> };
  delete missingDefault.clients[0].economics.fulfillmentHourlyCost;
  assert.throws(() => buildApprovedConfigRevision(missingDefault), /incompatible key set/i);
});

test('daily and runtime fields are not revision content and are rejected rather than silently hashed', () => {
  for (const [target, key, value] of [
    ['root','snapshotDate','2026-08-19'], ['root','retrievedAt','2026-08-20T00:00:00.000Z'], ['client','windows',{}],
    ['client','collectors',[]], ['client','sourceResults',[]],
  ] as const) mutate((revision) => { (target === 'root' ? revision : revision.clients[0])[key] = value; }, /incompatible key set/i);
});

test('arbitrary blobs and self-attested approval fields are rejected', () => {
  for (const [target, key] of [['client','metadata'], ['metric','sourceConfig'], ['client','configApproved'], ['client','approvedAt'], ['metric','approvedBy']] as const) {
    mutate((revision) => { const object = target === 'metric' ? revision.clients[0].metrics[0] : revision.clients[0]; object[key] = {}; }, /incompatible key set/i);
  }
});

test('approved clients require exact five typed metrics and exact typed source bindings', () => {
  mutate((revision) => { revision.clients[0].metrics.pop(); }, /exact five/i);
  mutate((revision) => { revision.clients[0].metrics[0].sourceKeys = ['unknown']; }, /reference configured sources/i);
  mutate((revision) => { revision.clients[0].sources[0].secretToken = 'no'; }, /incompatible key set/i);
  mutate((revision) => { revision.clients[0].sources[0].permitsTasks = true; }, /incompatible key set/i);
  mutate((revision) => { revision.clients[0].sources[0].allowedListIds = []; }, /incompatible key set/i);
  mutate((revision) => { revision.clients[0].sources[0].permittedFactFields = ['budget'] as unknown as ApprovedConfigRevisionV2['clients'][number]['sources'][number]['permittedFactFields']; }, /invalid field/i);
});

test('ClickUp task authorization exists only on ClickUp, is bounded, and maps each list to exactly one task-enabled source', () => {
  const value = content() as MutableRevision;
  value.clients[0].sources = [{ sourceKey: 'tasks', provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks', permitsTasks: true,
    allowedListIds: ['1'], requestFingerprint: 'b'.repeat(64), permittedFactFields: ['hoursUsed','overdueTaskCount'], freshnessPolicy: { maximumLagDays: 0 } }];
  for (const metric of value.clients[0].metrics) metric.sourceKeys = ['tasks'];
  assert.equal(buildApprovedConfigRevision(value).content.clients[0].sources[0].provider, 'clickup');
  value.clients[0].sources[0].allowedListIds = Array.from({length: 101}, (_, index) => `${index + 1}`);
  assert.throws(() => buildApprovedConfigRevision(value), /bounded string array/i);

  value.clients[0].sources = [
    { sourceKey: 'tasks-a', provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks', permitsTasks: true,
      allowedListIds: ['1','2'], requestFingerprint: 'b'.repeat(64), permittedFactFields: ['hoursUsed'], freshnessPolicy: { maximumLagDays: 0 } },
    { sourceKey: 'tasks-b', provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks', permitsTasks: true,
      allowedListIds: ['2','3'], requestFingerprint: 'c'.repeat(64), permittedFactFields: ['overdueTaskCount'], freshnessPolicy: { maximumLagDays: 0 } },
  ];
  for (const metric of value.clients[0].metrics) metric.sourceKeys = ['tasks-a'];
  assert.throws(() => buildApprovedConfigRevision(value), /allowedListIds.*unique.*task-enabled/i);

  (value.clients[0].sources[1] as MutableSource).permitsTasks = false;
  assert.doesNotThrow(() => buildApprovedConfigRevision(value));
});

test('configuration-required clients have no metrics or sources', () => {
  const value = content() as MutableRevision; value.clients[0].configStatus = 'configuration_required';
  assert.throws(() => buildApprovedConfigRevision(value), /cannot have metrics or sources/i);
  value.clients[0].metrics = []; value.clients[0].sources = []; value.clients[0].fixedValues = { monthlyBudget: null, monthlyHoursAllotment: null };
  assert.deepEqual(buildApprovedConfigRevision(value).content.clients[0].metrics, []);
});

test('every durable content change changes hash and deterministic revision id', () => {
  const a = buildApprovedConfigRevision(content()); const value = content(); value.clients[0].displayName = 'Changed'; const b = buildApprovedConfigRevision(value);
  assert.notEqual(a.hash, b.hash); assert.notEqual(a.id, b.id); assert.deepEqual(b, buildApprovedConfigRevision(value));
});

test('fixed calculation inputs are exact durable content and change revision identity', () => {
  const original = buildApprovedConfigRevision(content());
  const changed = content(); changed.clients[0].fixedValues.monthlyBudget = 10_001;
  const revised = buildApprovedConfigRevision(changed);
  assert.notEqual(revised.hash, original.hash); assert.notEqual(revised.id, original.id);
  mutate((revision) => { revision.clients[0].fixedValues.runtimeOverride = 1; }, /incompatible key set/i);
  mutate((revision) => { revision.clients[0].fixedValues.monthlyHoursAllotment = undefined as unknown as number; }, /bounded nonnegative/i);
});

test('active revision receipt proves exact revision identity, hash, content, and activation provenance', () => {
  const revision = buildApprovedConfigRevision(content());
  const active = { revision, activation: { revisionId: revision.id, revisionHash: revision.hash, activationId: '33333333-3333-4333-8333-333333333333',
    reviewedCommitSha: 'c'.repeat(40), operatorIdentity: 'operator@example.com', reason: 'Reviewed for production', activatedAt: '2026-08-20T00:00:00.000Z' } };
  assert.deepEqual(normalizeActiveConfigRevision(active), active);
  for (const mutation of [
    (value: MutableActive) => { value.revision.hash = 'd'.repeat(64); },
    (value: MutableActive) => { value.activation.revisionId = '44444444-4444-4444-8444-444444444444'; },
    (value: MutableActive) => { value.activation.configApproved = true; },
  ]) { const candidate = structuredClone(active) as MutableActive; mutation(candidate); assert.throws(() => normalizeActiveConfigRevision(candidate), /identity|does not match|incompatible/i); }
});
