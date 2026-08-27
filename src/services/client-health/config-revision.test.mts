import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalEvidenceHash } from './evidence.ts';
import { buildApprovedConfigRevision, normalizeActiveConfigRevision, type ApprovedConfigRevision } from './config-revision.ts';

type MutableMetric = ApprovedConfigRevision['clients'][number]['metrics'][number] & Record<string, unknown>;
type MutableSource = ApprovedConfigRevision['clients'][number]['sources'][number] & Record<string, unknown>;
type MutableClient = Omit<ApprovedConfigRevision['clients'][number], 'metrics' | 'sources' | 'fixedValues'> & Record<string, unknown> & {
  metrics: MutableMetric[];
  sources: MutableSource[];
  fixedValues: ApprovedConfigRevision['clients'][number]['fixedValues'] & Record<string, unknown>;
};
type MutableRevision = Omit<ApprovedConfigRevision, 'clients'> & Record<string, unknown> & { clients: MutableClient[] };
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
  const metric = (key: ApprovedConfigRevision['clients'][number]['metrics'][number]['key'], direction: 'lower_is_better' | 'higher_is_better' = 'lower_is_better') => ({
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
      requestFingerprint: 'a'.repeat(64), permittedFactFields: ['monthSpend', 'currentRows', 'previousRows'] as ApprovedConfigRevision['clients'][number]['sources'][number]['permittedFactFields'],
      freshnessPolicy: { maximumLagDays: 1 },
    }],
  };
}
function content(): ApprovedConfigRevision {
  return { schemaVersion: 2, calculationVersion: 'health-v2', sourceContractVersion: 'sources-v2', clients: [approved()] };
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
  mutate((revision) => { revision.clients[0].sources[0].permittedFactFields = ['budget'] as unknown as ApprovedConfigRevision['clients'][number]['sources'][number]['permittedFactFields']; }, /invalid field/i);
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
