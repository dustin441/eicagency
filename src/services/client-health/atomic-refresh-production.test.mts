import assert from 'node:assert/strict';
import test from 'node:test';

import { createAtomicRefreshProductionAdapter } from './atomic-refresh-production.ts';
import type { NormalizedConfigRevision } from './config-revision.ts';
import type { ClientHealthAtomicRpcClient, ClientHealthRpcQuery } from './repository.ts';

const signal = new AbortController().signal;
const owned = {
  signal,
  invocationId: '11111111-1111-4111-8111-111111111111',
  claimAttemptId: '22222222-2222-4222-8222-222222222222',
  fencingToken: 7,
};

function harness(response: { data: unknown; error: null | { code?: string; message: string } } = { data: { receipt: true }, error: null }) {
  const calls: Array<{ name: string; args: Record<string, unknown>; signal?: AbortSignal }> = [];
  const db: ClientHealthAtomicRpcClient = {
    rpc(name, args) {
      const call = { name, args } as { name: string; args: Record<string, unknown>; signal?: AbortSignal };
      calls.push(call);
      const query: ClientHealthRpcQuery = {
        abortSignal(value) { call.signal = value; return query; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return query;
    },
  };
  return { adapter: createAtomicRefreshProductionAdapter(db), calls };
}

test('RPC adapter maps every lifecycle and persistence method to exact names, arguments, ownership, and signals', async () => {
  const h = harness();
  const refresh = { id: '33333333-3333-4333-8333-333333333333', configRevisionId: '88888888-8888-4888-8888-888888888888', configRevisionHash: '8'.repeat(64), refreshIdentityHash: 'a'.repeat(64), runAttemptId: '77777777-7777-4777-8777-777777777777', snapshotDate: '2026-08-20', calculationVersion: 'v1', sourceContractVersion: 's1', startedAt: '2026-08-21T00:00:00.000Z' };
  const revision: NormalizedConfigRevision = {
    id: refresh.configRevisionId,
    hash: refresh.configRevisionHash,
    content: { schemaVersion: 1, clients: [] },
  };
  const source = { id: '44444444-4444-4444-8444-444444444444', refreshRunId: refresh.id, clientId: '55555555-5555-4555-8555-555555555555', sourceKey: 'paid', windowStart: null, windowEnd: null, startedAt: '2026-08-21T00:00:01.000Z' };
  const lease = { refreshRunId: refresh.id, invocationId: owned.invocationId, claimAttemptId: owned.claimAttemptId, leaseGrantedAt: '2026-08-21T00:00:02.000Z', leaseExpiresAt: '2026-08-21T00:00:32.000Z', fencingToken: 7 };
  const claim = { refreshRunId: refresh.id, invocationId: owned.invocationId, claimAttemptId: owned.claimAttemptId, leaseDurationMs: 30_000 };
  const receipt = await h.adapter.createConfigRevision(revision, { signal });
  assert.deepEqual(receipt, { receipt: true });
  await h.adapter.getConfigRevision(revision.id, { signal });
  assert.deepEqual(await h.adapter.createRefreshRun(refresh, { signal }), { receipt: true });
  await h.adapter.getRefreshRun(refresh.id, { signal });
  await h.adapter.acquireRefreshLease(claim, { signal });
  await h.adapter.renewRefreshLease({ ...claim, fencingToken: 7 }, owned);
  await h.adapter.getRefreshLease(refresh.id, { signal });
  await h.adapter.releaseRefreshLease(lease, owned);
  await h.adapter.createSourceRun(source, owned);
  await h.adapter.getSourceRun(source.id, owned);
  await h.adapter.completeSourceRun({ id: source.id, refreshRunId: refresh.id, status: 'succeeded', finishedAt: '2026-08-21T00:00:03.000Z', dataThrough: '2026-08-20', rowCount: 2, requestFingerprint: 'a'.repeat(64), evidence: {}, errorCode: null, errorMessage: null }, owned);
  const bundle = { idempotencyKey: 'b'.repeat(64), evidenceHash: 'a'.repeat(64), snapshotId: '66666666-6666-4666-8666-666666666666', snapshot: { refreshRunId: refresh.id, clientId: source.clientId, evidenceHash: 'a'.repeat(64) }, tasks: [] } as never;
  assert.deepEqual(await h.adapter.persistSnapshotBundle(bundle, owned), { receipt: true });
  await h.adapter.validateRefreshRun({ refreshRunId: refresh.id, validatedAt: '2026-08-21T00:00:04.000Z', evidenceHash: 'c'.repeat(64) }, owned);
  await h.adapter.publishRefreshRun({ refreshRunId: refresh.id, publishedAt: '2026-08-21T00:00:05.000Z' }, owned);
  await h.adapter.failRefreshRun({ refreshRunId: refresh.id, finishedAt: '2026-08-21T00:00:06.000Z', errorCode: 'failed', errorMessage: 'Failed.' }, owned);

  assert.deepEqual(h.calls.map(({ name }) => name), [
    'client_health_create_config_revision', 'client_health_get_config_revision',
    'client_health_create_refresh_run', 'client_health_get_refresh_run', 'client_health_acquire_refresh_lease',
    'client_health_renew_refresh_lease', 'client_health_get_refresh_lease', 'client_health_release_refresh_lease',
    'client_health_create_source_run', 'client_health_get_source_run', 'client_health_complete_source_run',
    'client_health_persist_snapshot_bundle', 'client_health_validate_refresh_run',
    'client_health_publish_refresh_run', 'client_health_fail_refresh_run',
  ]);
  assert.ok(h.calls.every((call) => call.signal === signal));
  assert.deepEqual(h.calls[0].args, { p_id: revision.id, p_revision_hash: revision.hash, p_revision: revision.content });
  assert.deepEqual(h.calls[2].args, { p_id: refresh.id, p_config_revision_id: refresh.configRevisionId, p_config_revision_hash: refresh.configRevisionHash, p_refresh_identity_hash: refresh.refreshIdentityHash, p_run_attempt_id: refresh.runAttemptId, p_snapshot_date: refresh.snapshotDate, p_calculation_version: 'v1', p_source_contract_version: 's1', p_started_at: refresh.startedAt });
  assert.deepEqual(h.calls[9].args, { p_id: source.id, p_invocation_id: owned.invocationId, p_claim_attempt_id: owned.claimAttemptId, p_fencing_token: 7 });
  for (const index of [5, 7, 8, 9, 10, 11, 12, 13, 14]) {
    assert.equal(h.calls[index].args.p_invocation_id, owned.invocationId);
    assert.equal(h.calls[index].args.p_claim_attempt_id, owned.claimAttemptId);
    assert.equal(h.calls[index].args.p_fencing_token, 7);
  }
  assert.equal(h.calls[11].args.p_bundle, bundle);
});

test('RPC adapter fails closed on database errors without exposing database messages', async () => {
  const h = harness({ data: null, error: { code: '42501', message: 'sensitive backend detail' } });
  await assert.rejects(h.adapter.getRefreshRun('33333333-3333-4333-8333-333333333333', { signal }), (error: unknown) => {
    assert.match(String(error), /client_health_get_refresh_run failed \(42501\)/);
    assert.doesNotMatch(String(error), /sensitive/);
    return true;
  });
});

test('RPC adapter rejects an already-aborted signal before issuing an RPC', async () => {
  const h = harness();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.adapter.getRefreshRun('33333333-3333-4333-8333-333333333333', { signal: controller.signal }), /was aborted/);
  assert.equal(h.calls.length, 0);
});
