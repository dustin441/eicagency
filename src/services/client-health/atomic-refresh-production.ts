import 'server-only';

import type { ClientHealthAtomicRpcClient, ClientHealthDbError } from './repository.ts';
import type { RefreshLifecyclePort } from './run-refresh.ts';
import type { AtomicSnapshotPersistencePort, RefreshOwnershipContext } from './store-snapshot.ts';


function rpcError(name: string, error: ClientHealthDbError): Error {
  const code = error.code ? ` (${error.code})` : '';
  return new Error(`Client health atomic refresh RPC ${name} failed${code}`);
}

async function invoke(db: ClientHealthAtomicRpcClient, name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  if (!(signal instanceof AbortSignal) || signal.aborted) throw new Error(`Client health atomic refresh RPC ${name} was aborted`);
  const response = await db.rpc(name, args).abortSignal(signal);
  if (response.error) throw rpcError(name, response.error);
  return response.data;
}

const ownership = (options: RefreshOwnershipContext) => ({
  p_invocation_id: options.invocationId,
  p_claim_attempt_id: options.claimAttemptId,
  p_fencing_token: options.fencingToken,
});

/** Server-only EIC adapter. It contains no credentials, browser client, project lookup, or source wiring. */
export function createAtomicRefreshProductionAdapter(db: ClientHealthAtomicRpcClient): RefreshLifecyclePort & AtomicSnapshotPersistencePort {
  if (!db || typeof db.rpc !== 'function') throw new Error('RPC-capable client health database client is required');
  return {
    createConfigRevision: (input, options) => invoke(db, 'client_health_create_config_revision', {
      p_id: input.id, p_revision_hash: input.hash, p_revision: input.content,
    }, options.signal),
    getConfigRevision: (id, options) => invoke(db, 'client_health_get_config_revision', { p_id: id }, options.signal),
    createRefreshRun: (input, options) => invoke(db, 'client_health_create_refresh_run', {
      p_id: input.id, p_config_revision_id: input.configRevisionId, p_config_revision_hash: input.configRevisionHash,
      p_refresh_identity_hash: input.refreshIdentityHash, p_run_attempt_id: input.runAttemptId,
      p_snapshot_date: input.snapshotDate, p_calculation_version: input.calculationVersion,
      p_source_contract_version: input.sourceContractVersion, p_started_at: input.startedAt,
    }, options.signal),
    getRefreshRun: (id, options) => invoke(db, 'client_health_get_refresh_run', { p_id: id }, options.signal),
    acquireRefreshLease: (input, options) => invoke(db, 'client_health_acquire_refresh_lease', {
      p_refresh_run_id: input.refreshRunId, p_invocation_id: input.invocationId,
      p_claim_attempt_id: input.claimAttemptId, p_lease_duration_ms: input.leaseDurationMs,
    }, options.signal),
    renewRefreshLease: (input, options) => invoke(db, 'client_health_renew_refresh_lease', {
      p_refresh_run_id: input.refreshRunId, p_invocation_id: input.invocationId,
      p_claim_attempt_id: input.claimAttemptId, p_fencing_token: input.fencingToken,
      p_lease_duration_ms: input.leaseDurationMs,
    }, options.signal),
    getRefreshLease: (refreshRunId, options) => invoke(db, 'client_health_get_refresh_lease', { p_refresh_run_id: refreshRunId }, options.signal),
    releaseRefreshLease: async (input, options) => { await invoke(db, 'client_health_release_refresh_lease', {
      p_refresh_run_id: input.refreshRunId, p_invocation_id: input.invocationId,
      p_claim_attempt_id: input.claimAttemptId, p_fencing_token: input.fencingToken,
      p_lease_granted_at: input.leaseGrantedAt, p_lease_expires_at: input.leaseExpiresAt,
    }, options.signal); },
    createSourceRun: (input, options) => invoke(db, 'client_health_create_source_run', {
      p_id: input.id, p_refresh_run_id: input.refreshRunId, p_client_id: input.clientId,
      p_source_key: input.sourceKey, p_window_start: input.windowStart, p_window_end: input.windowEnd,
      p_started_at: input.startedAt, ...ownership(options),
    }, options.signal),
    getSourceRun: (id, options) => invoke(db, 'client_health_get_source_run', {
      p_id: id, ...ownership(options),
    }, options.signal),
    completeSourceRun: async (input, options) => { await invoke(db, 'client_health_complete_source_run', {
      p_id: input.id, p_refresh_run_id: input.refreshRunId, p_status: input.status,
      p_finished_at: input.finishedAt, p_data_through: input.dataThrough, p_row_count: input.rowCount,
      p_request_fingerprint: input.requestFingerprint, p_evidence: input.evidence,
      p_error_code: input.errorCode ?? null, p_error_message: input.errorMessage ?? null, ...ownership(options),
    }, options.signal); },
    persistSnapshotBundle: (bundle, options) => invoke(db, 'client_health_persist_snapshot_bundle', {
      p_bundle: bundle, ...ownership(options),
    }, options.signal),
    validateRefreshRun: async (input, options) => { await invoke(db, 'client_health_validate_refresh_run', {
      p_refresh_run_id: input.refreshRunId, p_validated_at: input.validatedAt,
      p_evidence_hash: input.evidenceHash, ...ownership(options),
    }, options.signal); },
    publishRefreshRun: async (input, options) => { await invoke(db, 'client_health_publish_refresh_run', {
      p_refresh_run_id: input.refreshRunId, p_published_at: input.publishedAt, ...ownership(options),
    }, options.signal); },
    failRefreshRun: async (input, options) => { await invoke(db, 'client_health_fail_refresh_run', {
      p_refresh_run_id: input.refreshRunId, p_finished_at: input.finishedAt,
      p_error_code: input.errorCode, p_error_message: input.errorMessage, ...ownership(options),
    }, options.signal); },
  };
}