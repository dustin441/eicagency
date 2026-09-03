import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalEvidenceHash } from './evidence.ts';
import { buildApprovedConfigRevision } from './config-revision.ts';
import {
  RefreshOrchestrationError,
  runClientHealthRefresh,
  type ClientRefreshPlan,
  type InjectedSourceCollector,
  type OrderedRefreshClock,
  type RefreshOrchestrationDependencies,
  type RefreshLifecyclePort,
  type RefreshRunPlan,
} from './run-refresh.ts';
import { assembleClientHealthSnapshot, type CompletedSourceAdapterResult, type SnapshotAssemblyInput } from './build-snapshot.ts';
import type { SnapshotPersistenceBundle } from './store-snapshot.ts';
import type { ClientHealthValueInputs } from './engine.ts';

let RUN_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_A = '22222222-2222-4222-8222-222222222222';
const CLIENT_B = '33333333-3333-4333-8333-333333333333';
const SOURCE_RUN_IDS = [
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
];
const INVOCATION_ID = '88888888-8888-4888-8888-888888888888';
const SNAPSHOT_DATE = '2026-08-19';
const RETRIEVED_AT = '2026-08-20T11:00:00.000Z';
const SECRET = 'Canary-secret-should-never-persist';
const emptyValues = (): ClientHealthValueInputs => ({
  budget: null, monthSpend: null, currentRows: null, previousRows: null,
  hoursUsed: null, hoursAllotted: null, overdueTaskCount: null, revenue: null, fulfillmentCost: null,
});

function result(sourceKey: string, fingerprint: string, status: 'succeeded' | 'partial' | 'failed' = 'succeeded'): CompletedSourceAdapterResult {
  const succeeded = status === 'succeeded';
  return {
    source: { key: sourceKey, status, dataThrough: succeeded ? SNAPSHOT_DATE : null, stale: !succeeded, rowCount: succeeded ? 1 : null },
    values: emptyValues(),
    evidence: {
      sourceKey, provider: 'supabase', project: 'eic', relation: `approved_${sourceKey}`,
      retrievedAt: RETRIEVED_AT, sourceContractVersion: 'sources-v1', requestFingerprint: fingerprint,
      selectedRowCount: succeeded ? 1 : null,
      unknownSecret: SECRET,
    } as never,
    failure: succeeded ? null : { code: status === 'partial' ? 'partial_query' : 'query_failed', reason: SECRET },
  };
}

function client(clientId: string, sourceKeys: string[] = ['paid'], status: 'succeeded' | 'partial' | 'failed' = 'succeeded'): ClientRefreshPlan {
  const metricSource = sourceKeys[0] ?? 'not-collected';
  const sourceBindings = Object.fromEntries(sourceKeys.map((sourceKey, index) => [sourceKey, {
    sourceKey, provider: 'supabase' as const, project: 'eic' as const, relation: `approved_${sourceKey}`,
    requestFingerprint: String.fromCharCode(97 + index).repeat(64), permittedValueFields: [], permitsTasks: false,
    expectedDataThrough: SNAPSHOT_DATE,
  }]));
  const assemblyInput: SnapshotAssemblyInput = {
    clientId,
    clientKey: `client-${clientId.slice(0, 4)}`,
    configApproved: true,
    calculationVersion: 'health-v1',
    sourceContractVersion: 'sources-v1',
    snapshotDate: SNAPSHOT_DATE,
    retrievedAt: RETRIEVED_AT,
    phoenix: {
      month: { start: '2026-08-01', end: SNAPSHOT_DATE },
      current: { start: '2026-08-06', end: SNAPSHOT_DATE },
      previous: { start: '2026-07-23', end: '2026-08-05' },
      elapsedMonthDays: 19, daysInMonth: 31, comparisonDays: 14,
    },
    metricConfig: [
      { key: 'budget_pacing', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 10, yellowThreshold: 20, sourceKeys: [metricSource] },
      { key: 'north_star', required: true, weight: 25, direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15, sourceKeys: [metricSource] },
      { key: 'hours', required: true, weight: 20, direction: 'lower_is_better', greenThreshold: 90, yellowThreshold: 110, sourceKeys: [metricSource] },
      { key: 'overdue_tasks', required: true, weight: 15, direction: 'lower_is_better', greenThreshold: 0, yellowThreshold: 2, sourceKeys: [metricSource] },
      { key: 'margin', required: true, weight: 15, direction: 'higher_is_better', greenThreshold: 60, yellowThreshold: 40, sourceKeys: [metricSource] },
    ],
    requiredSourceKeys: [...sourceKeys],
    optionalSourceKeys: [],
    sourceBindings,
    fixedValues: { monthlyBudget: null, monthlyHoursAllotment: 20 },
    sourceResults: [],
  };
  return {
    assemblyInput,
    display: {
      clientId, clientKey: assemblyInput.clientKey,
      displayName: `Client ${clientId.slice(0, 4)}`, dashboardHref: `/dashboard/client-${clientId.slice(0, 4)}`,
      configStatus: 'approved', reportingTimezone: 'America/Phoenix', clickupListIds: [], marginAliases: [],
    },
    metricConfig: assemblyInput.metricConfig.map((metric) => ({ ...metric, label: metric.key, adapterKey: `approved.${metric.key}` })).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    collectors: sourceKeys.map((sourceKey) => ({
      sourceKey,
      windowStart: '2026-08-01',
      windowEnd: SNAPSHOT_DATE,
      async collect() { return result(sourceKey, sourceBindings[sourceKey].requestFingerprint, status); },
    })),
  };
}

function unapproved(clientId = CLIENT_A): ClientRefreshPlan {
  const plan = client(clientId, []);
  plan.assemblyInput.configApproved = false;
  plan.display.configStatus = 'configuration_required';
  plan.metricConfig = [];
  plan.display.clientId = clientId;
  plan.display.clientKey = plan.assemblyInput.clientKey;
  plan.assemblyInput.fixedValues = { monthlyBudget: null, monthlyHoursAllotment: null };
  plan.assemblyInput.sourceBindings = { malformed: null as never };
  plan.assemblyInput.requiredSourceKeys = ['ignored-malformed-key', 'ignored-malformed-key'];
  plan.collectors = [];
  return plan;
}

let CURRENT_PLAN: RefreshRunPlan;
function durableClients(clients: ClientRefreshPlan[]) {
  return clients.map((planned) => ({
    ...planned.display,
    fixedValues: planned.assemblyInput.fixedValues as { monthlyBudget: number | null; monthlyHoursAllotment: number | null },
    metrics: planned.metricConfig,
    sources: planned.display.configStatus === 'configuration_required' ? [] : Object.values(planned.assemblyInput.sourceBindings).map((binding) => ({
      sourceKey: binding.sourceKey, provider: 'supabase' as const, project: 'eic' as const,
      relation: (binding as { relation: string }).relation, requestFingerprint: binding.requestFingerprint,
      permittedFactFields: binding.permittedValueFields, freshnessPolicy: { maximumLagDays: 0 },
    })),
  }));
}
function runPlan(clients: ClientRefreshPlan[], concurrency = 2): RefreshRunPlan {
  const content = { schemaVersion: 2 as const, calculationVersion: 'health-v1', sourceContractVersion: 'sources-v1', clients: durableClients(clients) };
  let configRevision;
  try {
    configRevision = buildApprovedConfigRevision(content);
  } catch {
    configRevision = buildApprovedConfigRevision({ ...content, clients: durableClients([client(CLIENT_A)]) });
  }
  CURRENT_PLAN = { invocationId: INVOCATION_ID, leaseDurationMs: 30_000, snapshotDate: SNAPSHOT_DATE, calculationVersion: 'health-v1', sourceContractVersion: 'sources-v1', concurrency, deadlineMs: 1_000, configRevision, clients };
  return CURRENT_PLAN;
}

function runPlanV3(clients: ClientRefreshPlan[], effectiveMonth: string): RefreshRunPlan {
  for (const planned of clients) {
    for (const binding of Object.values(planned.assemblyInput.sourceBindings)) {
      binding.permittedValueFields = ['currentRows', 'previousRows'];
    }
    planned.assemblyInput.northStarLanes = [{
      key: 'cpl',
      label: 'Cost per result trend',
      formula: 'cost_per_result',
      evaluation: 'period_over_period_change',
      required: true,
      weight: 100,
      direction: 'lower_is_better',
      greenThreshold: 5,
      yellowThreshold: 15,
      sourceKeys: ['paid'],
    }];
  }
  const durable = durableClients(clients).map((planned) => {
    const { fixedValues, ...clientFields } = planned;
    return {
      ...clientFields,
      economics: {
        effectiveMonth,
        monthlyRetainer: fixedValues.monthlyHoursAllotment === null ? null : 4_600,
        deliveryModel: 'custom' as const,
        fulfillmentHourlyCost: 46,
        targetMarginPercent: 80,
      },
      fixedValues: { monthlyBudget: fixedValues.monthlyBudget },
      northStarLanes: [{
        key: 'cpl',
        label: 'Cost per result trend',
        formula: 'cost_per_result' as const,
        evaluation: 'period_over_period_change' as const,
        required: true,
        weight: 100,
        direction: 'lower_is_better' as const,
        greenThreshold: 5,
        yellowThreshold: 15,
        sourceKeys: ['paid'],
      }],
    };
  });
  const configRevision = buildApprovedConfigRevision({
    schemaVersion: 3,
    calculationVersion: 'health-v1',
    sourceContractVersion: 'sources-v1',
    clients: durable,
  });
  CURRENT_PLAN = {
    invocationId: INVOCATION_ID,
    leaseDurationMs: 30_000,
    snapshotDate: SNAPSHOT_DATE,
    calculationVersion: 'health-v1',
    sourceContractVersion: 'sources-v1',
    concurrency: 1,
    deadlineMs: 1_000,
    configRevision,
    clients,
  };
  return CURRENT_PLAN;
}

function clock(): OrderedRefreshClock & { calls: number } {
  let calls = 0;
  return {
    get calls() { return calls; },
    nextTimestamp() {
      const value = new Date(Date.UTC(2026, 7, 20, 12, 0, calls)).toISOString();
      calls += 1;
      return value;
    },
  };
}

function leaseGrant(
  input: { refreshRunId: string; invocationId: string; claimAttemptId: string; leaseDurationMs: number },
  fencingToken: number,
  grantedAtMs: number,
) {
  return {
    refreshRunId: input.refreshRunId,
    invocationId: input.invocationId,
    claimAttemptId: input.claimAttemptId,
    leaseGrantedAt: new Date(grantedAtMs).toISOString(),
    leaseExpiresAt: new Date(grantedAtMs + input.leaseDurationMs).toISOString(),
    fencingToken,
  };
}

type FailurePhase = 'createSource' | 'completeSource' | 'persist' | 'validate' | 'publish' | 'cleanup';
function harness(failure?: FailurePhase) {
  const calls = {
    activeRevision: [] as unknown[], materialize: [] as unknown[],
    createRefresh: [] as unknown[], acquireLease: [] as unknown[], renewLease: [] as unknown[], releaseLease: [] as unknown[], createSource: [] as unknown[], completeSource: [] as Array<Record<string, unknown>>,
    validate: [] as unknown[], publish: [] as unknown[], fail: [] as Array<Record<string, unknown>>, bundles: [] as SnapshotPersistenceBundle[],
    ownership: [] as Array<Record<string, unknown>>,
  };
  let completeCalls = 0;
  let activeLease: Record<string, unknown> | null = null;
  let leaseCommitMs = Date.UTC(2026, 7, 20, 13);
  const recordOwnership = (options: { signal: AbortSignal; invocationId: string; claimAttemptId: string; fencingToken: number }) => calls.ownership.push(structuredClone({ ...options, signal: undefined }));
  const lifecycle: RefreshLifecyclePort = {
    async getActiveConfigRevision() {
      calls.activeRevision.push({});
      const revision = CURRENT_PLAN.configRevision;
      return { revision, activation: {
        revisionId: revision.id, revisionHash: revision.hash,
        activationId: '99999999-9999-4999-8999-999999999999', reviewedCommitSha: 'c'.repeat(40),
        operatorIdentity: 'operator@example.com', reason: 'Approved test revision', activatedAt: '2026-08-20T00:00:00.000Z',
      } };
    },
    async createRefreshRun(input) { calls.createRefresh.push(structuredClone(input)); RUN_ID = input.id; return { ...input, status: 'collecting' }; },
    async getRefreshRun(id) {
      const created = calls.createRefresh[0] as Record<string, unknown>;
      if (!created) return null;
      return { ...created, id, status: failure === 'publish' ? 'validated' : 'collecting' };
    },
    async acquireRefreshLease(input) {
      calls.acquireLease.push(structuredClone(input));
      activeLease = leaseGrant(input, 1, leaseCommitMs++);
      return activeLease;
    },
    async renewRefreshLease(input, options) {
      recordOwnership(options); calls.renewLease.push(structuredClone(input));
      activeLease = leaseGrant(input, input.fencingToken, leaseCommitMs++);
      return activeLease;
    },
    async getRefreshLease() { return activeLease; },
    async releaseRefreshLease(input, options) { recordOwnership(options); calls.releaseLease.push(structuredClone(input)); },
    async createSourceRun(input, options) {
      recordOwnership(options); calls.createSource.push(structuredClone(input));
      if (failure === 'createSource') throw new Error(`infra ${SECRET}`);
      return { ...input, status: 'running' };
    },
    async getSourceRun(id) {
      const requested = calls.createSource.find((value) => (value as { id?: string }).id === id) as Record<string, unknown>;
      if (!requested) return null;
      return { ...requested, status: 'running' };
    },
    async completeSourceRun(input, options) {
      recordOwnership(options); calls.completeSource.push(structuredClone(input) as unknown as Record<string, unknown>);
      completeCalls += 1;
      if (failure === 'completeSource' && completeCalls === 1) throw new Error(`complete ${SECRET}`);
      if (failure === 'cleanup' && input.errorCode === 'source_orchestration_failed') throw new Error(`cleanup ${SECRET}`);
    },
    async validateRefreshRun(input, options) { recordOwnership(options); calls.validate.push(structuredClone(input)); if (failure === 'validate') throw new Error(`validate ${SECRET}`); },
    async publishRefreshRun(input, options) { recordOwnership(options); calls.publish.push(structuredClone(input)); if (failure === 'publish') throw new Error(`publish ${SECRET}`); },
    async failRefreshRun(input, options) { recordOwnership(options); calls.fail.push(structuredClone(input) as unknown as Record<string, unknown>); },
  };
  const persistence = {
    async persistSnapshotBundle(bundle: SnapshotPersistenceBundle, options: { signal: AbortSignal; invocationId: string; claimAttemptId: string; fencingToken: number }) {
      recordOwnership(options); calls.bundles.push(structuredClone(bundle));
      if (failure === 'persist') throw new Error(`persist ${SECRET}`);
      return {
        refreshRunId: bundle.snapshot.refreshRunId, configRevisionId: bundle.configRevisionId, configRevisionHash: bundle.configRevisionHash,
        clientId: bundle.snapshot.clientId, snapshotId: bundle.snapshotId,
        taskCount: bundle.tasks.length, evidenceHash: bundle.evidenceHash, idempotencyKey: bundle.idempotencyKey,
      };
    },
  };
  const planner = {
    materializePlan(activeRevision: unknown, snapshotDate: string) {
      calls.materialize.push({ activeRevision: structuredClone(activeRevision), snapshotDate });
      return {
        calculationVersion: CURRENT_PLAN.calculationVersion,
        sourceContractVersion: CURRENT_PLAN.sourceContractVersion,
        configRevision: CURRENT_PLAN.configRevision,
        clients: CURRENT_PLAN.clients,
      };
    },
  };
  return { lifecycle, planner, persistence, clock: clock(), calls };
}

async function expectFailed(
  plan: RefreshRunPlan,
  h: ReturnType<typeof harness> & Partial<RefreshOrchestrationDependencies>,
) {
  await assert.rejects(runClientHealthRefresh(plan, h), (error: unknown) => {
    assert.ok(error instanceof RefreshOrchestrationError);
    assert.equal(error.code, 'refresh_orchestration_failed');
    assert.equal(error.message, 'Client health refresh failed.');
    return true;
  });
  assert.equal(h.calls.fail.length, 1);
  assert.deepEqual(h.calls.fail[0], {
    refreshRunId: RUN_ID,
    finishedAt: h.calls.fail[0].finishedAt,
    errorCode: 'refresh_orchestration_failed',
    errorMessage: 'Client health refresh failed.',
  });
  assert.equal(JSON.stringify(h.calls.fail).includes(SECRET), false);
}

test('refresh orchestration errors never expose raw string or enumerable object causes', () => {
  const cases = [
    'Authorization: Bearer string-cause-secret',
    {
      message: 'provider rejected request: object-cause-secret',
      headers: { authorization: 'Bearer object-cause-token' },
    },
  ];

  for (const cause of cases) {
    const error = new RefreshOrchestrationError(cause);
    assert.ok(error instanceof RefreshOrchestrationError);
    assert.equal(error.name, 'RefreshOrchestrationError');
    assert.equal(error.code, 'refresh_orchestration_failed');
    assert.equal(error.message, 'Client health refresh failed.');
    assert.equal('cause' in error, false);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'name']);
    assert.deepEqual({ ...error }, {
      code: 'refresh_orchestration_failed',
      name: 'RefreshOrchestrationError',
    });

    const publicViews = [
      JSON.stringify(error),
      JSON.stringify(Object.keys(error)),
      JSON.stringify({ ...error }),
      ...Object.getOwnPropertyNames(error).map((key) => String((error as unknown as Record<string, unknown>)[key])),
    ].join('\n');
    assert.equal(publicViews.includes('string-cause-secret'), false);
    assert.equal(publicViews.includes('object-cause-secret'), false);
    assert.equal(publicViews.includes('object-cause-token'), false);
  }
});

test('v3 economics must match the exact refresh snapshot month before lifecycle writes', async () => {
  const plan = runPlanV3([client(CLIENT_A)], '2026-09-01');
  const h = harness();

  await assert.rejects(runClientHealthRefresh(plan, h), RefreshOrchestrationError);
  assert.equal(h.calls.createRefresh.length, 0);
  assert.equal(h.calls.createSource.length, 0);
  assert.equal(h.calls.bundles.length, 0);
  assert.equal(h.calls.fail.length, 0);
});

test('v3 economics with the matching effective month preserves existing refresh behavior', async () => {
  const plan = runPlanV3([client(CLIENT_A)], '2026-08-01');
  const h = harness();

  const result = await runClientHealthRefresh(plan, h);
  assert.equal(result.receipts.length, 1);
  assert.equal(h.calls.createRefresh.length, 1);
  assert.equal(h.calls.bundles.length, 1);
});

test('successful multi-client run preserves logical identity across completion order and enforces bounded concurrency', async () => {
  async function execute(delays: Record<string, number>) {
    const a = client(CLIENT_A, ['zeta', 'alpha']);
    const b = client(CLIENT_B, ['beta']);
    let active = 0;
    let maximum = 0;
    for (const plan of [a, b]) for (const collector of plan.collectors) {
      collector.collect = async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, delays[`${plan.assemblyInput.clientId}:${collector.sourceKey}`]));
        active -= 1;
        return result(collector.sourceKey, plan.assemblyInput.sourceBindings[collector.sourceKey].requestFingerprint);
      };
    }
    const h = harness();
    const output = await runClientHealthRefresh(runPlan([b, a], 2), h);
    return { output, calls: h.calls, maximum };
  }
  const first = await execute({ [`${CLIENT_A}:alpha`]: 20, [`${CLIENT_A}:zeta`]: 1, [`${CLIENT_B}:beta`]: 10 });
  const second = await execute({ [`${CLIENT_A}:alpha`]: 1, [`${CLIENT_A}:zeta`]: 20, [`${CLIENT_B}:beta`]: 2 });
  assert.equal(first.maximum, 2);
  assert.equal(second.maximum, 2);
  assert.equal(
    (first.calls.createRefresh[0] as { refreshIdentityHash: string }).refreshIdentityHash,
    (second.calls.createRefresh[0] as { refreshIdentityHash: string }).refreshIdentityHash,
  );
  assert.notEqual(first.output.refreshRunId, second.output.refreshRunId);
  assert.deepEqual(first.calls.createSource.map((call) => {
    const input = call as Record<string, unknown>;
    return [input.clientId, input.sourceKey];
  }), [
    [CLIENT_A, 'alpha'], [CLIENT_A, 'zeta'], [CLIENT_B, 'beta'],
  ]);
  assert.deepEqual(first.calls.completeSource.map((call) => call.id), first.calls.createSource.map((call) => (call as Record<string, unknown>).id));
  assert.equal(first.calls.validate.length, 1);
  assert.equal(first.calls.publish.length, 1);
  assert.equal(first.calls.fail.length, 0);
});

test('authoritative run hash covers explicit metadata and sorted persistence receipts', async () => {
  const h = harness();
  const output = await runClientHealthRefresh(runPlan([client(CLIENT_B), client(CLIENT_A)]), h);
  const entries = output.receipts.map((receipt) => ({
    clientId: receipt.clientId, assemblyEvidenceHash: receipt.evidenceHash,
    persistenceIdempotencyKey: receipt.idempotencyKey, snapshotId: receipt.snapshotId,
  })).sort((left, right) => left.clientId.localeCompare(right.clientId));
  assert.equal(output.evidenceHash, canonicalEvidenceHash({
    refreshRunId: RUN_ID,
    configRevisionId: CURRENT_PLAN.configRevision.id,
    configRevisionHash: CURRENT_PLAN.configRevision.hash,
    snapshotDate: SNAPSHOT_DATE, calculationVersion: 'health-v1', sourceContractVersion: 'sources-v1',
    startedAt: '2026-08-20T12:00:00.000Z', clients: entries,
  }));
  assert.equal((h.calls.validate[0] as Record<string, unknown>).evidenceHash, output.evidenceHash);
});

test('adapter-declared partial and failed results persist incomplete snapshots and still publish', async () => {
  for (const status of ['partial', 'failed'] as const) {
    const h = harness();
    const output = await runClientHealthRefresh(runPlan([client(CLIENT_A, ['paid'], status)]), h);
    assert.equal(output.receipts.length, 1);
    assert.equal(h.calls.bundles[0].snapshot.overallStatus, 'incomplete');
    assert.equal(h.calls.completeSource[0].status, status);
    assert.equal(h.calls.publish.length, 1);
    assert.equal(h.calls.fail.length, 0);
  }
});

test('configuration-required client bypasses collectors and binding validation but persists safely', async () => {
  const h = harness();
  const output = await runClientHealthRefresh(runPlan([unapproved()]), h);
  assert.equal(h.calls.createSource.length, 0);
  assert.equal(h.calls.completeSource.length, 0);
  assert.equal(h.calls.bundles[0].snapshot.overallStatus, 'configuration_required');
  assert.equal(output.receipts.length, 1);
  assert.equal(h.calls.publish.length, 1);
});

test('collector throw fails closed and sanitizes lifecycle writes and the public error', async () => {
  const h = harness();
  const plan = client(CLIENT_A);
  const primary = new Error(`adapter exploded ${SECRET}`);
  plan.collectors[0].collect = async () => { throw primary; };
  await expectFailed(runPlan([plan]), h);
  assert.equal(h.calls.validate.length, 0);
  assert.equal(h.calls.publish.length, 0);
  assert.equal(h.calls.bundles.length, 0);
  assert.deepEqual(h.calls.completeSource[0], {
    id: (h.calls.createSource[0] as Record<string, unknown>).id, refreshRunId: RUN_ID, status: 'failed', finishedAt: h.calls.completeSource[0].finishedAt,
    dataThrough: null, rowCount: null, requestFingerprint: null, evidence: {}, facts: {},
    errorCode: 'source_orchestration_failed', errorMessage: 'Source collection did not complete.',
  });
  assert.equal(JSON.stringify(h.calls).includes(SECRET), false);
});

test('assembler identity attack fails the run before persistence', async () => {
  const h = harness();
  const attack = (input: SnapshotAssemblyInput) => {
    const actual = assembleClientHealthSnapshot(input);
    return { ...actual, clientId: CLIENT_B };
  };
  await expectFailed(runPlan([client(CLIENT_A)]), { ...h, assemble: attack });
  assert.equal(h.calls.bundles.length, 0);
  assert.equal(h.calls.validate.length, 0);
  assert.equal(h.calls.publish.length, 0);
});

for (const phase of ['completeSource', 'persist', 'validate', 'publish'] as const) {
  test(`${phase} failure fails closed with exactly one refresh terminal transition`, async () => {
    const h = harness(phase);
    await expectFailed(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.fail.length, 1);
    assert.equal(h.calls.validate.length, phase === 'validate' || phase === 'publish' ? 1 : 0);
    assert.equal(h.calls.publish.length, phase === 'publish' ? 1 : 0);
  });
}

test('cleanup failure cannot replace the collector primary failure', async () => {
  const h = harness('cleanup');
  const plan = client(CLIENT_A);
  const primary = new Error(`primary ${SECRET}`);
  plan.collectors[0].collect = async () => { throw primary; };
  await expectFailed(runPlan([plan]), h);
  assert.equal(h.calls.completeSource.length, 1);
  assert.equal(h.calls.fail.length, 1);
});

test('source rows are completed only from assembler-sanitized metadata and evidence', async () => {
  const h = harness();
  await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
  const completion = h.calls.completeSource[0];
  assert.equal(JSON.stringify(completion).includes(SECRET), false);
  assert.deepEqual(completion.evidence, {
    project: 'eic', provider: 'supabase', relation: 'approved_paid', requestFingerprint: 'a'.repeat(64),
    retrievedAt: RETRIEVED_AT, selectedRowCount: 1, sourceContractVersion: 'sources-v1', sourceKey: 'paid',
  });
  assert.deepEqual(completion.facts, {});
});

test('rejects malformed plans and inconsistent lifecycle receipts before unsafe progress', async () => {
  const invalidPlans: RefreshRunPlan[] = [];
  invalidPlans.push(runPlan([client(CLIENT_A)], 0));
  invalidPlans.push(runPlan([client(CLIENT_A), client(CLIENT_A)]));
  const duplicateSource = client(CLIENT_A, ['paid', 'other']);
  duplicateSource.collectors[1].sourceKey = 'paid';
  invalidPlans.push(runPlan([duplicateSource]));
  const mismatch = client(CLIENT_A);
  mismatch.collectors[0].sourceKey = 'wrong';
  invalidPlans.push(runPlan([mismatch]));
  const badDate = runPlan([client(CLIENT_A)]);
  badDate.snapshotDate = '08/19/2026';
  invalidPlans.push(badDate);
  const badId = client('not-a-uuid');
  invalidPlans.push(runPlan([badId]));
  const badTimestamp = client(CLIENT_A);
  badTimestamp.assemblyInput.retrievedAt = '2026-08-20 11:00:00';
  invalidPlans.push(runPlan([badTimestamp]));
  for (const plan of invalidPlans) {
    const h = harness();
    await assert.rejects(runClientHealthRefresh(plan, h));
    assert.equal(h.calls.createRefresh.length, 0);
  }

  const h = harness();
  h.lifecycle.createSourceRun = async (input) => ({ id: SOURCE_RUN_IDS[0], refreshRunId: CLIENT_B, clientId: input.clientId, sourceKey: input.sourceKey });
  await expectFailed(runPlan([client(CLIENT_A)]), h);
  assert.equal(h.calls.validate.length, 0);
  assert.equal(h.calls.publish.length, 0);
});

test('unknown collector payloads fail closed and Canary remains absent from foundation identifiers', async () => {
  const h = harness();
  const plan = client(CLIENT_A);
  plan.collectors[0].collect = async () => ({ secret: SECRET });
  await expectFailed(runPlan([plan]), h);
  assert.equal(JSON.stringify(h.calls).includes(SECRET), false);
  const moduleText = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('./run-refresh.ts', import.meta.url), 'utf8'));
  assert.equal(moduleText.toLowerCase().includes('canary'), false);
});

test('all authorization blockers fail preflight before lifecycle, collector, or persistence calls', async () => {
  const mutations: Array<(plan: ClientRefreshPlan) => void> = [
    (plan) => { (plan.assemblyInput.phoenix as unknown as Record<string, unknown>).secret = SECRET; },
    (plan) => { plan.assemblyInput.phoenix.current.end = 'not-a-date'; },
    (plan) => { plan.assemblyInput.sourceBindings.paid.sourceKey = 'other'; },
    (plan) => { plan.assemblyInput.sourceBindings.paid.requestFingerprint = 'bad'; },
    (plan) => { (plan.assemblyInput.sourceBindings.paid as unknown as Record<string, unknown>).secret = SECRET; },
    (plan) => { plan.assemblyInput.requiredSourceKeys = ['paid', 'paid']; },
    (plan) => { (plan.assemblyInput.metricConfig[0] as unknown as Record<string, unknown>).secret = SECRET; },
    (plan) => { plan.assemblyInput.metricConfig[0].sourceKeys = ['unapproved']; },
  ];
  for (const mutate of mutations) {
    const h = harness();
    const candidate = client(CLIENT_A);
    let collected = 0;
    candidate.collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
    mutate(candidate);
    await assert.rejects(runClientHealthRefresh(runPlan([candidate]), h));
    assert.equal(h.calls.createRefresh.length, 0);
    assert.equal(h.calls.createSource.length, 0);
    assert.equal(h.calls.bundles.length, 0);
    assert.equal(collected, 0);
  }
});

test('collector receives the exact normalized authorization and source windows are stored exactly', async () => {
  const h = harness();
  const plan = client(CLIENT_A, ['paid', 'nonwindowed']);
  plan.collectors[0].windowStart = '2026-07-23';
  plan.collectors[0].windowEnd = SNAPSHOT_DATE;
  plan.collectors[1].windowStart = null;
  plan.collectors[1].windowEnd = null;
  const contexts: unknown[] = [];
  for (const collector of plan.collectors) collector.collect = async (context) => {
    contexts.push(structuredClone({ ...context, signal: undefined }));
    return result(collector.sourceKey, plan.assemblyInput.sourceBindings[collector.sourceKey].requestFingerprint);
  };
  await runClientHealthRefresh(runPlan([plan]), h);
  assert.deepEqual(h.calls.createSource.map((raw) => {
    const call = raw as Record<string, unknown>;
    return [call.sourceKey, call.windowStart, call.windowEnd];
  }), [['nonwindowed', null, null], ['paid', '2026-07-23', SNAPSHOT_DATE]]);
  const paid = contexts.find((raw) => (raw as { binding: { sourceKey: string } }).binding.sourceKey === 'paid') as Record<string, unknown>;
  assert.deepEqual(paid.phoenix, plan.assemblyInput.phoenix);
  assert.deepEqual(paid.binding, plan.assemblyInput.sourceBindings.paid);
  assert.equal(JSON.stringify(contexts).includes(SECRET), false);
});

test('malformed and out-of-bounds collector windows are rejected before writes', async () => {
  const windows: Array<[unknown, unknown]> = [
    ['2026-08-01', null], [null, SNAPSHOT_DATE], ['bad-date', SNAPSHOT_DATE],
    ['2026-08-20', SNAPSHOT_DATE], ['2026-07-22', SNAPSHOT_DATE], ['2026-07-23', '2026-08-20'],
  ];
  for (const [start, end] of windows) {
    const h = harness();
    const plan = client(CLIENT_A);
    plan.collectors[0].windowStart = start as string | null;
    plan.collectors[0].windowEnd = end as string | null;
    await assert.rejects(runClientHealthRefresh(runPlan([plan]), h));
    assert.equal(h.calls.createRefresh.length, 0);
  }
});

test('refresh create response loss or malformed receipt reconciles the exact caller ID and continues', async () => {
  for (const mode of ['throw', 'malformed'] as const) {
    const h = harness();
    h.lifecycle.createRefreshRun = async (input) => {
      h.calls.createRefresh.push(structuredClone(input)); RUN_ID = input.id;
      if (mode === 'throw') throw new Error('response lost');
      return { nope: true };
    };
    h.lifecycle.getRefreshRun = async (id) => {
      const created = h.calls.createRefresh[0] as Record<string, unknown> | undefined;
      return created ? { ...created, id, status: 'collecting' } : null;
    };
    await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.publish.length, 1);
    assert.equal((h.calls.createRefresh[0] as { id: string }).id, RUN_ID);
  }
});

test('refresh create mismatch or unavailable reconciliation makes no unsafe calls', async () => {
  for (const mode of ['mismatch', 'unavailable'] as const) {
    const h = harness();
    h.lifecycle.createRefreshRun = async (input) => { h.calls.createRefresh.push(structuredClone(input)); RUN_ID = input.id; throw new Error('response lost'); };
    h.lifecycle.getRefreshRun = async (id) => {
      if (mode === 'unavailable') throw new Error('read unavailable');
      return { ...(h.calls.createRefresh[0] as Record<string, unknown>), id, status: 'collecting', snapshotDate: '2026-08-18' };
    };
    await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
    assert.equal(h.calls.createSource.length, 0);
    assert.equal(h.calls.completeSource.length, 0);
    assert.equal(h.calls.fail.length, 0);
  }
});

test('source create response loss or malformed receipt reconciles exact state and continues', async () => {
  for (const mode of ['throw', 'malformed'] as const) {
    const h = harness();
    h.lifecycle.createSourceRun = async (input) => {
      h.calls.createSource.push(structuredClone(input));
      if (mode === 'throw') throw new Error('response lost');
      return { nope: true };
    };
    await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.publish.length, 1);
    assert.equal(h.calls.completeSource[0].id, (h.calls.createSource[0] as { id: string }).id);
  }
});

test('successful source create does not pre-read evidence from an earlier execution', async () => {
  const h = harness();
  let collected = 0;
  const plan = client(CLIENT_A);
  plan.collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
  let reads = 0;
  h.lifecycle.getSourceRun = async () => { reads += 1; throw new Error('must not pre-read'); };
  await runClientHealthRefresh(runPlan([plan]), h);
  assert.equal(collected, 1);
  assert.equal(reads, 0);
  assert.equal(h.calls.createSource.length, 1);
});

test('uncertain publish succeeds only when read-back proves published', async () => {
  const h = harness();
  h.lifecycle.publishRefreshRun = async (input) => { h.calls.publish.push(structuredClone(input)); throw new Error('response lost'); };
  h.lifecycle.getRefreshRun = async (id) => {
    const created = h.calls.createRefresh[0] as Record<string, unknown> | undefined;
    return created ? { ...created, id, status: 'published' } : null;
  };
  const output = await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
  assert.equal(output.refreshRunId, RUN_ID);
  assert.equal(h.calls.fail.length, 0);
});

test('uncertain publish fails only when read-back proves validated', async () => {
  const h = harness();
  h.lifecycle.publishRefreshRun = async (input) => { h.calls.publish.push(structuredClone(input)); throw new Error('response lost'); };
  h.lifecycle.getRefreshRun = async (id) => {
    const created = h.calls.createRefresh[0] as Record<string, unknown> | undefined;
    return created ? { ...created, id, status: 'validated' } : null;
  };
  await expectFailed(runPlan([client(CLIENT_A)]), h);
  assert.equal(h.calls.fail.length, 1);
});

test('unknown publish outcome never performs an unsafe fail transition', async () => {
  const h = harness();
  h.lifecycle.publishRefreshRun = async (input) => { h.calls.publish.push(structuredClone(input)); throw new Error('response lost'); };
  h.lifecycle.getRefreshRun = async () => { throw new Error('read unavailable'); };
  await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
  assert.equal(h.calls.fail.length, 0);
});

test('swapped collector source key, provider, or fingerprint fails before assembly persistence', async () => {
  const attacks: Array<(payload: CompletedSourceAdapterResult) => void> = [
    (payload) => { payload.source.key = 'other'; },
    (payload) => { payload.evidence.provider = 'clickup'; },
    (payload) => { payload.evidence.requestFingerprint = 'b'.repeat(64); },
  ];
  for (const attack of attacks) {
    const h = harness();
    const plan = client(CLIENT_A);
    plan.collectors[0].collect = async () => { const payload = result('paid', 'a'.repeat(64)); attack(payload); return payload; };
    await expectFailed(runPlan([plan]), h);
    assert.equal(h.calls.bundles.length, 0);
  }
});

async function executeMutationCase(mutate: boolean) {
  const h = harness();
  const plan = client(CLIENT_A);
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let context: Record<string, unknown> | undefined;
  let assembledInput: SnapshotAssemblyInput | undefined;
  plan.collectors[0].collect = async (value) => {
    context = structuredClone({ ...value, signal: undefined }); entered(); await gate;
    const binding = value.binding;
    return result(value.binding.sourceKey, binding.requestFingerprint);
  };
  const promise = runClientHealthRefresh(runPlan([plan]), { ...h, assemble(input) { assembledInput = structuredClone(input); return assembleClientHealthSnapshot(input); } });
  await waiting;
  if (mutate) {
    plan.assemblyInput.phoenix.current.start = '1999-01-01';
    (plan.assemblyInput.sourceBindings.paid as { relation: string }).relation = 'mutated';
    plan.assemblyInput.sourceBindings.paid.requestFingerprint = 'f'.repeat(64);
    plan.assemblyInput.metricConfig[0].weight = 999;
    plan.assemblyInput.requiredSourceKeys[0] = 'mutated';
  }
  release();
  await promise;
  return {
    context, assembledInput, bundles: h.calls.bundles,
    refreshIdentityHash: (h.calls.createRefresh[0] as { refreshIdentityHash: string }).refreshIdentityHash,
  };
}

test('mutating original authorization during collection cannot alter context, hash, or assembly', async () => {
  const baseline = await executeMutationCase(false);
  const attacked = await executeMutationCase(true);
  assert.deepEqual(attacked.context, baseline.context);
  assert.deepEqual(attacked.assembledInput, baseline.assembledInput);
  assert.equal(attacked.refreshIdentityHash, baseline.refreshIdentityHash);
  assert.equal(
    (attacked.bundles.length > 0),
    (baseline.bundles.length > 0),
  );
});

test('collector timeout aborts the operation, closes its source row, and fails closed', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  plan.deadlineMs = 10;
  let observedAbort = false;
  plan.clients[0].collectors[0].collect = ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { observedAbort = true; reject(new Error('collector aborted')); }, { once: true });
  });
  await expectFailed(plan, h);
  assert.equal(observedAbort, true);
  assert.equal(h.calls.completeSource.length, 1);
  assert.equal(h.calls.completeSource[0].status, 'failed');
});

test('lifecycle timeout propagates AbortSignal and fails closed without hanging timers', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  plan.deadlineMs = 10;
  let observedAbort = false;
  h.lifecycle.completeSourceRun = (input, { signal }) => {
    h.calls.completeSource.push(structuredClone(input) as Record<string, unknown>);
    if (input.errorCode === 'source_orchestration_failed') return Promise.resolve();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      observedAbort = true; reject(new Error('lifecycle aborted'));
    }, { once: true }));
  };
  await expectFailed(plan, h);
  assert.equal(observedAbort, true);
  assert.equal(h.calls.publish.length, 0);
});

test('persistence timeout propagates AbortSignal and fails closed', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  plan.deadlineMs = 10;
  let observedAbort = false;
  h.persistence.persistSnapshotBundle = (_bundle, { signal }: { signal?: AbortSignal } = {}) => new Promise((_resolve, reject) => {
    assert.ok(signal);
    signal.addEventListener('abort', () => { observedAbort = true; reject(new Error('persistence aborted')); }, { once: true });
  });
  await expectFailed(plan, h);
  assert.equal(observedAbort, true);
  assert.equal(h.calls.publish.length, 0);
});

test('exclusive lease allows only one concurrent invocation to collect or mutate the shared run', async () => {
  const h = harness();
  let activeLease: Record<string, unknown> | null = null;
  let collected = 0;
  h.lifecycle.acquireRefreshLease = async (input) => {
    h.calls.acquireLease.push(structuredClone(input));
    if (activeLease) throw new Error('lease held');
    activeLease = leaseGrant(input, 7, Date.UTC(2026, 7, 20, 12, 59));
    return activeLease;
  };
  h.lifecycle.getRefreshLease = async () => activeLease;
  const first = runPlan([client(CLIENT_A)]);
  first.clients[0].collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
  const second = { ...first, clients: [client(CLIENT_A)] };
  second.clients[0].collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
  const settled = await Promise.allSettled([runClientHealthRefresh(first, h), runClientHealthRefresh(second, h)]);
  assert.equal(settled.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(settled.filter(({ status }) => status === 'rejected').length, 1);
  assert.equal(h.calls.acquireLease.length, 2);
  assert.notEqual((h.calls.acquireLease[0] as { claimAttemptId: string }).claimAttemptId, (h.calls.acquireLease[1] as { claimAttemptId: string }).claimAttemptId);
  assert.equal(collected, 1);
  assert.equal(h.calls.createSource.length, 1);
  assert.equal(h.calls.bundles.length, 1);
  assert.equal(h.calls.fail.length, 0);
  assert.equal(h.calls.completeSource.length, 1);
});

test('lease response loss and malformed receipt reconcile only the exact invocation claim', async () => {
  for (const mode of ['throw', 'malformed'] as const) {
    const h = harness();
    let committed: Record<string, unknown> | null = null;
    h.lifecycle.acquireRefreshLease = async (input) => {
      h.calls.acquireLease.push(structuredClone(input));
      committed = leaseGrant(input, 5, Date.UTC(2026, 7, 20, 12, 59));
      if (mode === 'throw') throw new Error('response lost');
      return { nope: true };
    };
    h.lifecycle.getRefreshLease = async () => committed;
    await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.publish.length, 1);
    assert.ok(h.calls.ownership.every(({ invocationId, fencingToken }) => invocationId === INVOCATION_ID && fencingToken === 5));
  }
});

test('lease mismatch or unavailable reconciliation performs no owned mutation, collection, cleanup, fail, or persistence', async () => {
  for (const mode of ['mismatch', 'unavailable'] as const) {
    const h = harness();
    let collected = 0;
    const candidate = client(CLIENT_A);
    candidate.collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
    h.lifecycle.acquireRefreshLease = async (input) => { h.calls.acquireLease.push(structuredClone(input)); throw new Error('uncertain'); };
    h.lifecycle.getRefreshLease = async () => {
      if (mode === 'unavailable') throw new Error('unavailable');
      const claim = h.calls.acquireLease[0] as Record<string, unknown>;
      return leaseGrant({
        refreshRunId: claim.refreshRunId as string,
        invocationId: '99999999-9999-4999-8999-999999999999',
        claimAttemptId: claim.claimAttemptId as string,
        leaseDurationMs: claim.leaseDurationMs as number,
      }, 2, Date.UTC(2026, 7, 20, 12, 59));
    };
    await assert.rejects(runClientHealthRefresh(runPlan([candidate]), h), RefreshOrchestrationError);
    assert.equal(collected, 0);
    assert.equal(h.calls.createSource.length, 0);
    assert.equal(h.calls.completeSource.length, 0);
    assert.equal(h.calls.bundles.length, 0);
    assert.equal(h.calls.fail.length, 0);
    assert.equal(h.calls.releaseLease.length, 0);
  }
});

test('mock lifecycle rejects a stale fence and orchestrator cannot persist or terminally mutate with it', async () => {
  const h = harness();
  let activeFence = 1;
  h.lifecycle.completeSourceRun = async (input, options) => {
    h.calls.completeSource.push(structuredClone(input) as Record<string, unknown>);
    activeFence = 2;
    if (options.fencingToken !== activeFence) throw new Error('stale fence');
  };
  h.lifecycle.failRefreshRun = async (_input, options) => { if (options.fencingToken !== activeFence) throw new Error('stale fence'); };
  await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
  assert.equal(h.calls.bundles.length, 0);
  assert.equal(h.calls.validate.length, 0);
  assert.equal(h.calls.publish.length, 0);
  assert.equal(h.calls.releaseLease.length, 0);
});

test('all post-claim mutations and persistence receive ownership while collector receives no ownership secret', async () => {
  const h = harness();
  let collectorContext: Record<string, unknown> | undefined;
  const candidate = client(CLIENT_A);
  candidate.collectors[0].collect = async (context) => {
    collectorContext = context as unknown as Record<string, unknown>;
    return result('paid', 'a'.repeat(64));
  };
  await runClientHealthRefresh(runPlan([candidate]), h);
  assert.ok(h.calls.ownership.length >= 6);
  assert.ok(h.calls.ownership.every(({ invocationId, fencingToken }) => invocationId === INVOCATION_ID && fencingToken === 1));
  assert.equal('invocationId' in (collectorContext ?? {}), false);
  assert.equal('fencingToken' in (collectorContext ?? {}), false);
  assert.ok((collectorContext?.signal as AbortSignal).aborted === false);
});

test('malformed complete refresh create receipts reconcile exact complete persisted identity', async () => {
  for (const mutate of [
    (receipt: Record<string, unknown>) => { receipt.status = 'failed'; },
    (receipt: Record<string, unknown>) => { receipt.snapshotDate = '2026-08-18'; },
    (receipt: Record<string, unknown>) => { receipt.startedAt = '2026-08-20T12:00:09.000Z'; },
    (receipt: Record<string, unknown>) => { delete receipt.sourceContractVersion; },
  ]) {
    const h = harness();
    h.lifecycle.createRefreshRun = async (input) => {
      h.calls.createRefresh.push(structuredClone(input)); RUN_ID = input.id;
      const receipt: Record<string, unknown> = { ...input, status: 'collecting' }; mutate(receipt); return receipt;
    };
    await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.publish.length, 1);
  }
});

test('malformed complete source create receipts reconcile exact ID, status, parent, client, key, windows, and startedAt', async () => {
  for (const field of ['status', 'refreshRunId', 'clientId', 'sourceKey', 'windowStart', 'windowEnd', 'startedAt'] as const) {
    const h = harness();
    h.lifecycle.createSourceRun = async (input) => {
      h.calls.createSource.push(structuredClone(input));
      const receipt: Record<string, unknown> = { ...input, status: 'running' };
      receipt[field] = field === 'status' ? 'failed' : field.includes('window') ? null : 'wrong';
      return receipt;
    };
    await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    assert.equal(h.calls.publish.length, 1, field);
  }
});

test('create readback identity mismatch fails closed before collection or persistence', async () => {
  const h = harness();
  let collected = 0;
  const candidate = client(CLIENT_A);
  candidate.collectors[0].collect = async () => { collected += 1; return result('paid', 'a'.repeat(64)); };
  h.lifecycle.createSourceRun = async (input) => { h.calls.createSource.push(structuredClone(input)); return { nope: true }; };
  h.lifecycle.getSourceRun = async (id) => {
    const requested = h.calls.createSource[0] as Record<string, unknown>;
    return { ...requested, id, status: 'running', startedAt: '2026-08-20T12:00:59.000Z' };
  };
  await assert.rejects(runClientHealthRefresh(runPlan([candidate]), h), RefreshOrchestrationError);
  assert.equal(collected, 0);
  assert.equal(h.calls.bundles.length, 0);
  assert.equal(h.calls.validate.length, 0);
});

test('lease acquisition timeout aborts and performs no unsafe owned calls', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  plan.deadlineMs = 10;
  let aborted = false;
  h.lifecycle.acquireRefreshLease = (_input, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true }));
  h.lifecycle.getRefreshLease = async () => { throw new Error('unavailable'); };
  await assert.rejects(runClientHealthRefresh(plan, h), RefreshOrchestrationError);
  assert.equal(aborted, true);
  assert.equal(h.calls.createSource.length, 0);
  assert.equal(h.calls.fail.length, 0);
});

test('renews the exact fenced lease before every bounded owned phase', async () => {
  const h = harness();
  const candidate = client(CLIENT_A, ['alpha', 'paid']);
  await runClientHealthRefresh(runPlan([candidate], 2), h);
  assert.ok(h.calls.renewLease.length >= 8);
  const acquired = h.calls.acquireLease[0] as { claimAttemptId: string };
  const renewals = h.calls.renewLease as Array<{ claimAttemptId: string; leaseDurationMs: number; fencingToken: number }>;
  assert.ok(renewals.every(({ claimAttemptId, fencingToken }) => claimAttemptId === acquired.claimAttemptId && fencingToken === 1));
  assert.ok(renewals.every(({ leaseDurationMs }) => leaseDurationMs === 30_000));
  const released = h.calls.releaseLease[0] as { leaseGrantedAt: string; leaseExpiresAt: string };
  assert.equal(new Date(released.leaseExpiresAt).getTime() - new Date(released.leaseGrantedAt).getTime(), 30_000);
  assert.ok(h.calls.ownership.every(({ claimAttemptId }) => claimAttemptId === acquired.claimAttemptId));
});

test('renewal response loss reconciles only the exact attempt and continues', async () => {
  const h = harness();
  let active: Record<string, unknown> | null = null;
  let renewCalls = 0;
  h.lifecycle.renewRefreshLease = async (input, options) => {
    h.calls.ownership.push(structuredClone({ ...options, signal: undefined }));
    h.calls.renewLease.push(structuredClone(input));
    active = leaseGrant(input, input.fencingToken, Date.UTC(2026, 7, 20, 14) + renewCalls);
    renewCalls += 1;
    if (renewCalls === 1) throw new Error('renewal response lost');
    return active;
  };
  h.lifecycle.getRefreshLease = async () => active;
  await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
  assert.equal(h.calls.publish.length, 1);
  assert.ok(renewCalls > 1);
});

test('uncertain renewal ownership stops without cleanup, failure, persistence, or release', async () => {
  for (const mode of ['mismatch', 'unavailable'] as const) {
    const h = harness();
    h.lifecycle.renewRefreshLease = async () => { throw new Error('renew uncertain'); };
    h.lifecycle.getRefreshLease = async () => {
      if (mode === 'unavailable') throw new Error('read unavailable');
      const claim = h.calls.acquireLease[0] as Record<string, unknown>;
      return {
        refreshRunId: claim.refreshRunId, invocationId: claim.invocationId,
        claimAttemptId: '99999999-9999-4999-8999-999999999999',
        leaseGrantedAt: '2026-08-20T14:00:00.000Z', leaseExpiresAt: '2026-08-20T14:00:30.000Z', fencingToken: 1,
      };
    };
    await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
    assert.equal(h.calls.createSource.length, 0);
    assert.equal(h.calls.completeSource.length, 0);
    assert.equal(h.calls.bundles.length, 0);
    assert.equal(h.calls.fail.length, 0);
    assert.equal(h.calls.releaseLease.length, 0);
  }
});

test('lease duration covers renewal, reconciliation, operation, and reconciliation deadlines plus margin', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  plan.deadlineMs = 1_000;
  plan.leaseDurationMs = 4_999;
  await assert.rejects(runClientHealthRefresh(plan, h), RefreshOrchestrationError);
  assert.equal(h.calls.createRefresh.length, 0);
  assert.equal(h.calls.acquireLease.length, 0);
});

test('malformed authoritative lease grants and readbacks fail closed', async () => {
  for (const mode of ['duration', 'clock-order', 'readback'] as const) {
    const h = harness();
    let malformedGrant: unknown = { malformed: true };
    h.lifecycle.acquireRefreshLease = async (input) => {
      h.calls.acquireLease.push(structuredClone(input));
      if (mode === 'readback') return malformedGrant;
      const grant = leaseGrant(input, 1, Date.UTC(2026, 7, 20, 13));
      if (mode === 'duration') grant.leaseExpiresAt = new Date(new Date(grant.leaseExpiresAt).getTime() - 1).toISOString();
      if (mode === 'clock-order') grant.leaseExpiresAt = new Date(new Date(grant.leaseGrantedAt).getTime() - 1).toISOString();
      malformedGrant = grant;
      return grant;
    };
    h.lifecycle.getRefreshLease = async () => malformedGrant;
    await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
    assert.equal(h.calls.createSource.length, 0);
    assert.equal(h.calls.fail.length, 0);
    assert.equal(h.calls.releaseLease.length, 0);
  }
});

test('renewal must strictly advance both authoritative grant and expiry', async () => {
  const h = harness();
  let active: Record<string, unknown> | null = null;
  h.lifecycle.acquireRefreshLease = async (input) => {
    h.calls.acquireLease.push(structuredClone(input));
    active = leaseGrant(input, 1, Date.UTC(2026, 7, 20, 13));
    return active;
  };
  h.lifecycle.renewRefreshLease = async (input) => {
    h.calls.renewLease.push(structuredClone(input));
    return active;
  };
  h.lifecycle.getRefreshLease = async () => active;
  await assert.rejects(runClientHealthRefresh(runPlan([client(CLIENT_A)]), h), RefreshOrchestrationError);
  assert.equal(h.calls.createSource.length, 0);
  assert.equal(h.calls.fail.length, 0);
  assert.equal(h.calls.releaseLease.length, 0);
});

test('full response-loss sequence remains inside the conservative four-deadline lease budget', async () => {
  const h = harness();
  const plan = runPlan([client(CLIENT_A)]);
  const almostDeadline = plan.deadlineMs - 1;
  let virtualNow = Date.UTC(2026, 7, 20, 13);
  let active: Record<string, unknown> | null = null;
  let renewalCalls = 0;
  let renewalSequenceStartedAt = 0;
  let renewalGrantedAt = 0;
  let sourceReadbackFinishedAt = 0;

  h.lifecycle.acquireRefreshLease = async (input) => {
    h.calls.acquireLease.push(structuredClone(input));
    active = leaseGrant(input, 1, virtualNow);
    return active;
  };
  h.lifecycle.renewRefreshLease = async (input, options) => {
    h.calls.ownership.push(structuredClone({ ...options, signal: undefined }));
    h.calls.renewLease.push(structuredClone(input));
    renewalCalls += 1;
    if (renewalCalls === 1) {
      renewalSequenceStartedAt = virtualNow;
      virtualNow += almostDeadline;
      renewalGrantedAt = virtualNow;
      active = leaseGrant(input, input.fencingToken, virtualNow);
      throw new Error('renew response lost near deadline');
    }
    virtualNow += 1;
    active = leaseGrant(input, input.fencingToken, virtualNow);
    return active;
  };
  let leaseReadbacks = 0;
  h.lifecycle.getRefreshLease = async () => {
    leaseReadbacks += 1;
    if (leaseReadbacks === 1) virtualNow += almostDeadline;
    return active;
  };
  h.lifecycle.createSourceRun = async (input, options) => {
    h.calls.ownership.push(structuredClone({ ...options, signal: undefined }));
    h.calls.createSource.push(structuredClone(input));
    virtualNow += almostDeadline;
    throw new Error('source create response lost near deadline');
  };
  h.lifecycle.getSourceRun = async (id) => {
    const requested = h.calls.createSource.find((value) => (value as { id?: string }).id === id) as Record<string, unknown>;
    if (!requested) return null;
    virtualNow += almostDeadline;
    sourceReadbackFinishedAt = virtualNow;
    return { ...requested, status: 'running' };
  };

  await runClientHealthRefresh(plan, h);
  assert.equal(renewalCalls > 1, true);
  assert.equal(leaseReadbacks, 1);
  assert.equal(sourceReadbackFinishedAt - renewalSequenceStartedAt, 4 * almostDeadline);
  assert.ok(sourceReadbackFinishedAt - renewalSequenceStartedAt < plan.leaseDurationMs);
  assert.ok(sourceReadbackFinishedAt - renewalGrantedAt < plan.leaseDurationMs);
});

test('invocation and per-execution IDs do not affect logical identity but every execution gets a fresh attempt and run', async () => {
  async function execute(grantBaseMs: number) {
    const h = harness();
    let active: Record<string, unknown> | null = null;
    let grantMs = grantBaseMs;
    h.lifecycle.acquireRefreshLease = async (input) => {
      h.calls.acquireLease.push(structuredClone(input));
      active = leaseGrant(input, 1, grantMs++);
      return active;
    };
    h.lifecycle.renewRefreshLease = async (input, options) => {
      h.calls.ownership.push(structuredClone({ ...options, signal: undefined }));
      h.calls.renewLease.push(structuredClone(input));
      active = leaseGrant(input, input.fencingToken, grantMs++);
      return active;
    };
    h.lifecycle.getRefreshLease = async () => active;
    const output = await runClientHealthRefresh(runPlan([client(CLIENT_A)]), h);
    return { output, h };
  }
  const first = await execute(Date.UTC(2026, 7, 20, 13));
  const second = await execute(Date.UTC(2026, 7, 21, 13));
  const firstCreate = first.h.calls.createRefresh[0] as { refreshIdentityHash: string; runAttemptId: string; id: string };
  const secondCreate = second.h.calls.createRefresh[0] as { refreshIdentityHash: string; runAttemptId: string; id: string };
  assert.equal(firstCreate.refreshIdentityHash, secondCreate.refreshIdentityHash);
  assert.match(firstCreate.refreshIdentityHash, /^[a-f0-9]{64}$/);
  assert.notEqual(firstCreate.runAttemptId, secondCreate.runAttemptId);
  assert.notEqual(firstCreate.id, secondCreate.id);
  assert.notEqual(first.output.evidenceHash, second.output.evidenceHash);
  assert.notEqual(
    (first.h.calls.acquireLease[0] as { claimAttemptId: string }).claimAttemptId,
    (second.h.calls.acquireLease[0] as { claimAttemptId: string }).claimAttemptId,
  );
  assert.notEqual(
    (first.h.calls.releaseLease[0] as { leaseGrantedAt: string }).leaseGrantedAt,
    (second.h.calls.releaseLease[0] as { leaseGrantedAt: string }).leaseGrantedAt,
  );
  assert.deepEqual(Object.keys(first.h.calls.acquireLease[0] as object).sort(), ['claimAttemptId', 'invocationId', 'leaseDurationMs', 'refreshRunId']);
  assert.equal(JSON.stringify(first.h.calls.createRefresh[0]).includes(SECRET), false);
});

test('logical identity excludes retrievedAt, invocation, and unknown private input fields', async () => {
  async function execute(invocationId: string, retrievedAt: string, addPrivateFields: boolean) {
    const h = harness();
    const plannedClient = client(CLIENT_A);
    plannedClient.assemblyInput.retrievedAt = retrievedAt;
    plannedClient.collectors[0].collect = async () => {
      const collected = result('paid', 'a'.repeat(64));
      (collected.evidence as { retrievedAt: string }).retrievedAt = retrievedAt;
      return collected;
    };
    if (addPrivateFields) {
      (plannedClient as ClientRefreshPlan & { privateToken: string }).privateToken = SECRET;
      (plannedClient.collectors[0] as InjectedSourceCollector & { privateCursor: string }).privateCursor = SECRET;
    }
    const plan = runPlan([plannedClient]);
    plan.invocationId = invocationId;
    if (addPrivateFields) (plan as RefreshRunPlan & { privateExecutionMetadata: string }).privateExecutionMetadata = SECRET;
    await runClientHealthRefresh(plan, h);
    return h.calls.createRefresh[0] as { refreshIdentityHash: string };
  }

  const baseline = await execute(INVOCATION_ID, RETRIEVED_AT, false);
  const changed = await execute('99999999-9999-4999-8999-999999999999', '2026-08-20T12:00:00.000Z', true);
  assert.equal(changed.refreshIdentityHash, baseline.refreshIdentityHash);
  assert.equal(JSON.stringify(changed).includes(SECRET), false);
});

test('zero-client plans are rejected before refresh creation', async () => {
  const h = harness();
  await assert.rejects(runClientHealthRefresh(runPlan([]), h), RefreshOrchestrationError);
  assert.equal(h.calls.createRefresh.length, 0);
});

test('a process restart always creates a fresh run and fully recollects instead of resuming old timestamps', async () => {
  const first = harness();
  const second = harness();
  await runClientHealthRefresh(runPlan([client(CLIENT_A)]), first);
  await runClientHealthRefresh(runPlan([client(CLIENT_A)]), second);
  assert.equal(first.calls.createRefresh.length, 1);
  assert.equal(second.calls.createRefresh.length, 1);
  assert.equal(first.calls.createSource.length, 1);
  assert.equal(second.calls.createSource.length, 1);
  assert.notEqual(
    (first.calls.createRefresh[0] as { id: string }).id,
    (second.calls.createRefresh[0] as { id: string }).id,
  );
  assert.notEqual(
    (first.calls.createSource[0] as { id: string }).id,
    (second.calls.createSource[0] as { id: string }).id,
  );
});
