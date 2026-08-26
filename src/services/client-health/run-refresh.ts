import { randomUUID } from 'node:crypto';

import { assertDateOnly } from './date-windows.ts';
import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import {
  assembleClientHealthSnapshot,
  normalizeSnapshotAssemblyInput,
  type ClientHealthSnapshotAssembly,
  type CompletedSourceAdapterResult,
  type SnapshotAssemblyInput,
  type SnapshotSourceBinding,
} from './build-snapshot.ts';
import {
  storeSnapshot,
  type AtomicSnapshotPersistencePort,
  type RefreshOwnershipContext,
  type SnapshotPersistenceReceipt,
  type StoreSnapshotInput,
} from './store-snapshot.ts';
import type {
  CompleteSourceRunInput,
  FailRefreshRunInput,
  JsonObject,
  PublishRefreshRunInput,
  ValidateRefreshRunInput,
} from './repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_DEADLINE_MS = 120_000;
const MAX_LEASE_DURATION_MS = 600_000;
const LEASE_DEADLINE_MARGIN_MS = 1_000;
const LEASE_SEQUENCE_DEADLINES = 4;
const PUBLIC_REFRESH_ERROR = { errorCode: 'refresh_orchestration_failed', errorMessage: 'Client health refresh failed.' } as const;
const PUBLIC_SOURCE_ERROR = { errorCode: 'source_orchestration_failed', errorMessage: 'Source collection did not complete.' } as const;
const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

type InvocationOptions = { signal: AbortSignal };
type OwnedInvocationOptions = RefreshOwnershipContext;
type RequestedCreateRefreshRunInput = {
  id: string;
  refreshIdentityHash: string;
  runAttemptId: string;
  snapshotDate: string;
  calculationVersion: string;
  sourceContractVersion: string;
  startedAt: string;
};
type RequestedCreateSourceRunInput = {
  id: string;
  refreshRunId: string;
  clientId: string;
  sourceKey: string;
  windowStart: string | null;
  windowEnd: string | null;
  startedAt: string;
};
export type RefreshRunState = {
  id: string;
  refreshIdentityHash: string;
  runAttemptId: string;
  status: 'collecting' | 'validated' | 'published' | 'failed';
  snapshotDate: string;
  calculationVersion: string;
  sourceContractVersion: string;
  startedAt: string;
};
export type SourceRunState = {
  id: string;
  status: 'running' | 'succeeded' | 'partial' | 'failed';
  refreshRunId: string;
  clientId: string;
  sourceKey: string;
  windowStart: string | null;
  windowEnd: string | null;
  startedAt: string;
};

export type RefreshLeaseClaimInput = {
  refreshRunId: string;
  invocationId: string;
  claimAttemptId: string;
  leaseDurationMs: number;
};
export type RefreshLeaseState = {
  refreshRunId: string;
  invocationId: string;
  claimAttemptId: string;
  leaseGrantedAt: string;
  leaseExpiresAt: string;
  fencingToken: number;
};
export type RefreshLeaseRenewalInput = {
  refreshRunId: string;
  invocationId: string;
  claimAttemptId: string;
  fencingToken: number;
  leaseDurationMs: number;
};

export type SourceCollectorContext = {
  clientId: string;
  clientKey: string;
  snapshotDate: string;
  retrievedAt: string;
  sourceContractVersion: string;
  phoenix: SnapshotAssemblyInput['phoenix'];
  binding: SnapshotSourceBinding;
  windowStart: string | null;
  windowEnd: string | null;
  signal: AbortSignal;
};

export type InjectedSourceCollector = {
  sourceKey: string;
  /** Exact authorized source-row window; both endpoints may be null for non-windowed sources. */
  windowStart: string | null;
  windowEnd: string | null;
  collect(context: SourceCollectorContext): Promise<unknown>;
};

export type ClientRefreshPlan = {
  /** A complete assembly authorization. sourceResults must be empty until collectors finish. */
  assemblyInput: SnapshotAssemblyInput;
  collectors: InjectedSourceCollector[];
};

export type RefreshRunPlan = {
  /** Unique canonical UUID for this invocation; excluded from deterministic refresh identity. */
  invocationId: string;
  /** Duration the lifecycle repository adds to its authoritative commit-time clock. */
  leaseDurationMs: number;
  snapshotDate: string;
  calculationVersion: string;
  sourceContractVersion: string;
  concurrency: number;
  deadlineMs: number;
  clients: ClientRefreshPlan[];
};

/** Creates are exact-identity idempotent. Every post-claim mutation must reject a stale/wrong fence. */
export interface RefreshLifecyclePort {
  createRefreshRun(input: RequestedCreateRefreshRunInput, options: InvocationOptions): Promise<unknown>;
  getRefreshRun(id: string, options: InvocationOptions): Promise<unknown>;
  /** Atomic compare-and-claim: compute granted/expires from the repository commit-time clock and return both. */
  acquireRefreshLease(input: RefreshLeaseClaimInput, options: InvocationOptions): Promise<unknown>;
  /** Fenced atomic renewal: retain attempt/fence, compute times at commit, and strictly advance both times. */
  renewRefreshLease(input: RefreshLeaseRenewalInput, options: OwnedInvocationOptions): Promise<unknown>;
  /** Return the exact current committed grant identity, fence, and canonical commit-derived timestamps. */
  getRefreshLease(refreshRunId: string, options: InvocationOptions): Promise<unknown>;
  releaseRefreshLease(input: RefreshLeaseState, options: OwnedInvocationOptions): Promise<void>;
  createSourceRun(input: RequestedCreateSourceRunInput, options: OwnedInvocationOptions): Promise<unknown>;
  getSourceRun(id: string, options: OwnedInvocationOptions): Promise<unknown>;
  completeSourceRun(input: CompleteSourceRunInput, options: OwnedInvocationOptions): Promise<void>;
  validateRefreshRun(input: ValidateRefreshRunInput, options: OwnedInvocationOptions): Promise<void>;
  publishRefreshRun(input: PublishRefreshRunInput, options: OwnedInvocationOptions): Promise<void>;
  failRefreshRun(input: FailRefreshRunInput, options: OwnedInvocationOptions): Promise<void>;
}

export interface OrderedRefreshClock {
  nextTimestamp(): string;
}

type PersistSnapshot = (port: AtomicSnapshotPersistencePort, input: StoreSnapshotInput, options: OwnedInvocationOptions) => Promise<SnapshotPersistenceReceipt>;
export type RefreshOrchestrationDependencies = {
  lifecycle: RefreshLifecyclePort;
  persistence: AtomicSnapshotPersistencePort;
  clock: OrderedRefreshClock;
  assemble?: typeof assembleClientHealthSnapshot;
  persist?: PersistSnapshot;
};

export type RefreshRunResult = { refreshRunId: string; evidenceHash: string; receipts: SnapshotPersistenceReceipt[] };

export class RefreshOrchestrationError extends Error {
  readonly code = PUBLIC_REFRESH_ERROR.errorCode;
  constructor(cause: unknown) {
    super(PUBLIC_REFRESH_ERROR.errorMessage);
    this.name = 'RefreshOrchestrationError';
    // Raw provider failures may contain credentials. Do not retain them on the public error object.
    void cause;
  }
}

type RunningSource = { id: string; refreshRunId: string; clientId: string; sourceKey: string; completed: boolean };
type NormalizedCollector = Pick<InjectedSourceCollector, 'sourceKey' | 'windowStart' | 'windowEnd' | 'collect'>;
type NormalizedClient = { assemblyInput: SnapshotAssemblyInput; collectors: NormalizedCollector[] };
type CollectionJob = { client: NormalizedClient; collector: NormalizedCollector; running: RunningSource; result?: CompletedSourceAdapterResult };

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) throw new Error(`${field} must be a nonempty string without surrounding whitespace`);
  return value;
}
function uuid(value: unknown, field: string): string {
  const result = text(value, field);
  if (!UUID.test(result)) throw new Error(`${field} must be a canonical UUID`);
  return result;
}
function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  const date = new Date(result);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== result) throw new Error(`${field} must be a canonical ISO timestamp`);
  return result;
}
function nextTimestamp(clock: OrderedRefreshClock, field: string): string {
  if (!clock || typeof clock.nextTimestamp !== 'function') throw new Error('Ordered refresh clock is required');
  return timestamp(clock.nextTimestamp(), field);
}
function deterministicUuid(identity: unknown): string {
  const chars = canonicalEvidenceHash(identity).slice(0, 32).split('');
  chars[12] = '8';
  chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function invokeWithDeadline<T>(deadlineMs: number, operation: (options: InvocationOptions) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Refresh operation timed out.'));
    }, deadlineMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation({ signal: controller.signal })), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function invokeOwnedWithDeadline<T>(
  deadlineMs: number,
  ownership: Omit<OwnedInvocationOptions, 'signal'>,
  operation: (options: OwnedInvocationOptions) => Promise<T>,
): Promise<T> {
  return invokeWithDeadline(deadlineMs, ({ signal }) => operation({ ...ownership, signal }));
}

function normalizeWindow(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a date or null`);
  assertDateOnly(value, field);
  return value;
}
function normalizeCollector(collector: InjectedSourceCollector, field: string, input: SnapshotAssemblyInput): NormalizedCollector {
  if (!collector || typeof collector !== 'object' || typeof collector.collect !== 'function') throw new Error(`${field} is malformed`);
  const sourceKey = text(collector.sourceKey, `${field}.sourceKey`);
  const windowStart = normalizeWindow(collector.windowStart, `${field}.windowStart`);
  const windowEnd = normalizeWindow(collector.windowEnd, `${field}.windowEnd`);
  if ((windowStart === null) !== (windowEnd === null)) throw new Error(`${field} window endpoints must both be null or dates`);
  if (windowStart !== null && windowEnd !== null) {
    if (windowStart > windowEnd) throw new Error(`${field} windowStart cannot exceed windowEnd`);
    if (windowStart < input.phoenix.previous.start || windowEnd > input.snapshotDate) throw new Error(`${field} window exceeds approved Phoenix bounds`);
  }
  return { sourceKey, windowStart, windowEnd, collect: collector.collect };
}

function validatePlan(plan: RefreshRunPlan): { clients: NormalizedClient[]; identity: Record<string, unknown> } {
  if (!plan || typeof plan !== 'object') throw new Error('Refresh run plan is malformed');
  uuid(plan.invocationId, 'invocationId');
  if (!Number.isSafeInteger(plan.leaseDurationMs) || plan.leaseDurationMs < 1 || plan.leaseDurationMs > MAX_LEASE_DURATION_MS) throw new Error(`leaseDurationMs must be a safe integer between 1 and ${MAX_LEASE_DURATION_MS}`);
  assertDateOnly(plan.snapshotDate, 'snapshotDate');
  const calculationVersion = text(plan.calculationVersion, 'calculationVersion');
  const sourceContractVersion = text(plan.sourceContractVersion, 'sourceContractVersion');
  if (!Number.isInteger(plan.concurrency) || plan.concurrency < 1 || plan.concurrency > 32) throw new Error('concurrency must be an integer between 1 and 32');
  if (!Number.isSafeInteger(plan.deadlineMs) || plan.deadlineMs < 1 || plan.deadlineMs > MAX_DEADLINE_MS) throw new Error(`deadlineMs must be a safe integer between 1 and ${MAX_DEADLINE_MS}`);
  const minimumLeaseDurationMs = plan.deadlineMs * LEASE_SEQUENCE_DEADLINES + LEASE_DEADLINE_MARGIN_MS;
  if (!Number.isSafeInteger(minimumLeaseDurationMs)) throw new Error('lease lifetime calculation exceeds the safe integer range');
  if (plan.leaseDurationMs < minimumLeaseDurationMs) throw new Error(`leaseDurationMs must be at least 4 * deadlineMs + ${LEASE_DEADLINE_MARGIN_MS}`);
  if (!Array.isArray(plan.clients) || plan.clients.length === 0) throw new Error('clients must be a nonempty array');

  // Normalize every client before returning; no lifecycle write can occur on partial preflight success.
  const unsorted = plan.clients.map((client, index): NormalizedClient => {
    if (!client || typeof client !== 'object' || !client.assemblyInput || typeof client.assemblyInput !== 'object') throw new Error(`clients[${index}] is malformed`);
    const input = normalizeSnapshotAssemblyInput(client.assemblyInput);
    uuid(input.clientId, `clients[${index}].clientId`);
    if (input.snapshotDate !== plan.snapshotDate || input.calculationVersion !== calculationVersion || input.sourceContractVersion !== sourceContractVersion) throw new Error(`${input.clientId} assembly metadata does not match the refresh plan`);
    if (!Array.isArray(client.collectors)) throw new Error(`${input.clientId}.collectors must be an array`);
    if (!input.configApproved) {
      if (client.collectors.length !== 0) throw new Error(`${input.clientId} configuration-required clients cannot have collectors`);
      return { assemblyInput: input, collectors: [] };
    }
    const collectors = client.collectors.map((collector, collectorIndex) => normalizeCollector(collector, `${input.clientId}.collectors[${collectorIndex}]`, input))
      .sort((left, right) => compareCodeUnits(left.sourceKey, right.sourceKey));
    const collectorKeys = collectors.map(({ sourceKey }) => sourceKey);
    if (new Set(collectorKeys).size !== collectorKeys.length) throw new Error(`${input.clientId} has duplicate source collectors`);
    const bindingKeys = Object.keys(input.sourceBindings).sort(compareCodeUnits);
    if (canonicalEvidenceJson(bindingKeys) !== canonicalEvidenceJson(collectorKeys)) throw new Error(`${input.clientId} collector keys must exactly match sourceBindings`);
    return { assemblyInput: input, collectors };
  }).sort((left, right) => compareCodeUnits(left.assemblyInput.clientId, right.assemblyInput.clientId));
  const ids = unsorted.map(({ assemblyInput }) => assemblyInput.clientId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate client');
  const identity = {
    snapshotDate: plan.snapshotDate, calculationVersion, sourceContractVersion,
    clients: unsorted.map(({ assemblyInput, collectors }) => {
      const logicalAssemblyInput: Partial<SnapshotAssemblyInput> = structuredClone(assemblyInput);
      delete logicalAssemblyInput.retrievedAt;
      return { assemblyInput: logicalAssemblyInput, collectors: collectors.map(({ sourceKey, windowStart, windowEnd }) => ({ sourceKey, windowStart, windowEnd })) };
    }),
  };
  return { clients: unsorted, identity };
}

function refreshState(value: unknown, expected: RequestedCreateRefreshRunInput): RefreshRunState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('refresh run state is malformed');
  const state = value as Record<string, unknown>;
  const normalized: RefreshRunState = {
    id: uuid(state.id, 'refreshRun.id'), status: state.status as RefreshRunState['status'],
    refreshIdentityHash: text(state.refreshIdentityHash, 'refreshRun.refreshIdentityHash'),
    runAttemptId: uuid(state.runAttemptId, 'refreshRun.runAttemptId'),
    snapshotDate: text(state.snapshotDate, 'refreshRun.snapshotDate'),
    calculationVersion: text(state.calculationVersion, 'refreshRun.calculationVersion'),
    sourceContractVersion: text(state.sourceContractVersion, 'refreshRun.sourceContractVersion'),
    startedAt: timestamp(state.startedAt, 'refreshRun.startedAt'),
  };
  if (!['collecting', 'validated', 'published', 'failed'].includes(normalized.status)) throw new Error('refreshRun.status is invalid');
  if (!SHA256.test(normalized.refreshIdentityHash)) throw new Error('refreshRun.refreshIdentityHash must be lowercase SHA-256');
  for (const key of ['id', 'refreshIdentityHash', 'runAttemptId', 'snapshotDate', 'calculationVersion', 'sourceContractVersion', 'startedAt'] as const) if (normalized[key] !== expected[key]) throw new Error('refresh run identity does not match');
  return normalized;
}
function refreshCreateReceipt(value: unknown, expected: RequestedCreateRefreshRunInput): RefreshRunState {
  const receipt = refreshState(value, expected);
  if (receipt.status !== 'collecting') throw new Error('createRefreshRun receipt does not match requested collecting run');
  return receipt;
}

function sourceState(value: unknown, expected: RequestedCreateSourceRunInput): SourceRunState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('source run state is malformed');
  const state = value as Record<string, unknown>;
  const normalized: SourceRunState = {
    id: uuid(state.id, 'sourceRun.id'), status: state.status as SourceRunState['status'],
    refreshRunId: uuid(state.refreshRunId, 'sourceRun.refreshRunId'), clientId: uuid(state.clientId, 'sourceRun.clientId'),
    sourceKey: text(state.sourceKey, 'sourceRun.sourceKey'),
    windowStart: normalizeWindow(state.windowStart, 'sourceRun.windowStart'), windowEnd: normalizeWindow(state.windowEnd, 'sourceRun.windowEnd'),
    startedAt: timestamp(state.startedAt, 'sourceRun.startedAt'),
  };
  if (!['running', 'succeeded', 'partial', 'failed'].includes(normalized.status)) throw new Error('sourceRun.status is invalid');
  for (const key of ['id', 'refreshRunId', 'clientId', 'sourceKey', 'windowStart', 'windowEnd', 'startedAt'] as const) if (normalized[key] !== expected[key]) throw new Error('source run identity does not match');
  return normalized;
}
function sourceCreateReceipt(value: unknown, expected: RequestedCreateSourceRunInput): SourceRunState {
  const receipt = sourceState(value, expected);
  if (receipt.status !== 'running') throw new Error('createSourceRun receipt does not match requested running run');
  return receipt;
}

function refreshLeaseState(value: unknown, expected: RefreshLeaseClaimInput): RefreshLeaseState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('refresh lease state is malformed');
  const state = value as Record<string, unknown>;
  const normalized = {
    refreshRunId: uuid(state.refreshRunId, 'refreshLease.refreshRunId'),
    invocationId: uuid(state.invocationId, 'refreshLease.invocationId'),
    claimAttemptId: uuid(state.claimAttemptId, 'refreshLease.claimAttemptId'),
    leaseGrantedAt: timestamp(state.leaseGrantedAt, 'refreshLease.leaseGrantedAt'),
    leaseExpiresAt: timestamp(state.leaseExpiresAt, 'refreshLease.leaseExpiresAt'),
    fencingToken: state.fencingToken,
  };
  if (!Number.isInteger(normalized.fencingToken) || (normalized.fencingToken as number) < 1) throw new Error('refreshLease.fencingToken must be a positive integer');
  if (normalized.refreshRunId !== expected.refreshRunId || normalized.invocationId !== expected.invocationId
    || normalized.claimAttemptId !== expected.claimAttemptId) throw new Error('refresh lease identity does not match');
  const grantedAtMs = new Date(normalized.leaseGrantedAt).getTime();
  const expiresAtMs = new Date(normalized.leaseExpiresAt).getTime();
  if (expiresAtMs <= grantedAtMs || expiresAtMs - grantedAtMs !== expected.leaseDurationMs) throw new Error('refresh lease duration does not match the authoritative grant');
  return normalized as RefreshLeaseState;
}

function renewedRefreshLeaseState(value: unknown, expected: RefreshLeaseRenewalInput, previous: RefreshLeaseState): RefreshLeaseState {
  const state = refreshLeaseState(value, {
    refreshRunId: expected.refreshRunId,
    invocationId: expected.invocationId,
    claimAttemptId: expected.claimAttemptId,
    leaseDurationMs: expected.leaseDurationMs,
  });
  if (state.fencingToken !== expected.fencingToken) throw new Error('refresh lease fence does not match');
  if (new Date(state.leaseGrantedAt).getTime() <= new Date(previous.leaseGrantedAt).getTime()
    || new Date(state.leaseExpiresAt).getTime() <= new Date(previous.leaseExpiresAt).getTime()) throw new Error('refresh lease renewal must strictly advance its grant and expiry');
  return state;
}

async function createOrReconcileRefresh(lifecycle: RefreshLifecyclePort, input: RequestedCreateRefreshRunInput, deadlineMs: number): Promise<RefreshRunState> {
  try {
    return refreshCreateReceipt(await invokeWithDeadline(deadlineMs, (options) => lifecycle.createRefreshRun(input, options)), input);
  } catch (createError) {
    try {
      const state = refreshState(await invokeWithDeadline(deadlineMs, (options) => lifecycle.getRefreshRun(input.id, options)), input);
      if (state.status !== 'collecting') throw new Error('reconciled refresh run is not collecting');
      return state;
    } catch (reconcileError) {
      void createError; void reconcileError;
      throw new Error('Refresh run creation could not be reconciled');
    }
  }
}
async function acquireOrReconcileLease(lifecycle: RefreshLifecyclePort, input: RefreshLeaseClaimInput, deadlineMs: number): Promise<RefreshLeaseState> {
  try {
    return refreshLeaseState(await invokeWithDeadline(deadlineMs, (options) => lifecycle.acquireRefreshLease(input, options)), input);
  } catch (acquireError) {
    try {
      return refreshLeaseState(await invokeWithDeadline(deadlineMs, (options) => lifecycle.getRefreshLease(input.refreshRunId, options)), input);
    } catch (reconcileError) {
      void acquireError; void reconcileError;
      throw new Error('Refresh lease acquisition could not be reconciled');
    }
  }
}

async function renewOrReconcileLease(
  lifecycle: RefreshLifecyclePort,
  input: RefreshLeaseRenewalInput,
  previous: RefreshLeaseState,
  deadlineMs: number,
  ownership: Omit<OwnedInvocationOptions, 'signal'>,
): Promise<RefreshLeaseState> {
  try {
    return renewedRefreshLeaseState(await invokeOwnedWithDeadline(deadlineMs, ownership, (options) => lifecycle.renewRefreshLease(input, options)), input, previous);
  } catch (renewError) {
    try {
      return renewedRefreshLeaseState(await invokeWithDeadline(deadlineMs, (options) => lifecycle.getRefreshLease(input.refreshRunId, options)), input, previous);
    } catch (reconcileError) {
      void renewError; void reconcileError;
      throw new Error('Refresh lease renewal could not be reconciled');
    }
  }
}

async function createOrReconcileSource(
  lifecycle: RefreshLifecyclePort,
  input: RequestedCreateSourceRunInput,
  deadlineMs: number,
  ownership: Omit<OwnedInvocationOptions, 'signal'>,
): Promise<SourceRunState> {
  try {
    return sourceCreateReceipt(await invokeOwnedWithDeadline(deadlineMs, ownership, (options) => lifecycle.createSourceRun(input, options)), input);
  } catch (createError) {
    try {
      const state = sourceState(await invokeOwnedWithDeadline(deadlineMs, ownership, (options) => lifecycle.getSourceRun(input.id, options)), input);
      if (state.status !== 'running') throw new Error('reconciled source run is not running');
      return state;
    } catch (reconcileError) {
      void createError; void reconcileError;
      throw new Error('Source run creation could not be reconciled');
    }
  }
}

function validateCompletedResult(value: unknown, field: string, binding: SnapshotSourceBinding): CompletedSourceAdapterResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must return a completed source adapter result`);
  const result = value as Record<string, unknown>;
  if (!result.source || typeof result.source !== 'object' || Array.isArray(result.source)) throw new Error(`${field}.source is malformed`);
  if ((result.source as Record<string, unknown>).key !== binding.sourceKey) throw new Error(`${field}.source.key does not match its collector binding`);
  if (!result.evidence || typeof result.evidence !== 'object' || Array.isArray(result.evidence)) throw new Error(`${field}.evidence is malformed`);
  const evidence = result.evidence as Record<string, unknown>;
  if (evidence.sourceKey !== binding.sourceKey || evidence.provider !== binding.provider || evidence.requestFingerprint !== binding.requestFingerprint) throw new Error(`${field}.evidence identity does not match its collector binding`);
  const status = (result.source as Record<string, unknown>).status;
  if (status !== 'succeeded' && status !== 'partial' && status !== 'failed') throw new Error(`${field} must return a completed source adapter result`);
  if (!result.values || typeof result.values !== 'object' || Array.isArray(result.values)) throw new Error(`${field}.values is malformed`);
  if (!('failure' in result)) throw new Error(`${field}.failure is required`);
  return value as CompletedSourceAdapterResult;
}

async function collectBounded(
  jobs: CollectionJob[],
  concurrency: number,
  deadlineMs: number,
  beforeBatch: () => Promise<void>,
): Promise<void> {
  for (let cursor = 0; cursor < jobs.length; cursor += concurrency) {
    await beforeBatch();
    const batch = jobs.slice(cursor, cursor + concurrency);
    const settled = await Promise.allSettled(batch.map(async (job) => {
      const input = job.client.assemblyInput;
      const binding = input.sourceBindings[job.collector.sourceKey];
      const value = await invokeWithDeadline(deadlineMs, ({ signal }) => job.collector.collect({
        clientId: input.clientId, clientKey: input.clientKey, snapshotDate: input.snapshotDate, retrievedAt: input.retrievedAt,
        sourceContractVersion: input.sourceContractVersion, phoenix: structuredClone(input.phoenix), binding: structuredClone(binding),
        windowStart: job.collector.windowStart, windowEnd: job.collector.windowEnd, signal,
      }));
      job.result = validateCompletedResult(value, `${input.clientId}.${job.collector.sourceKey}`, binding);
    }));
    const failure = settled.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    if (failure) throw failure.reason;
  }
}

function jsonEvidence(value: Record<string, string | number | null> | null): JsonObject {
  return value === null ? {} : JSON.parse(canonicalEvidenceJson(value)) as JsonObject;
}
function sourceCompletion(running: RunningSource, assembly: ClientHealthSnapshotAssembly, finishedAt: string): CompleteSourceRunInput {
  const source = assembly.sources[running.sourceKey];
  if (!source || source.status === 'missing' || !['succeeded', 'partial', 'failed'].includes(source.status)) throw new Error(`${running.clientId}.${running.sourceKey} has no valid completed assembled source metadata`);
  const requestFingerprint = source.evidence?.requestFingerprint;
  return {
    id: running.id, refreshRunId: running.refreshRunId, status: source.status as 'succeeded' | 'partial' | 'failed', finishedAt,
    dataThrough: source.dataThrough, rowCount: source.rowCount,
    requestFingerprint: typeof requestFingerprint === 'string' && SHA256.test(requestFingerprint) ? requestFingerprint : null,
    evidence: jsonEvidence(source.evidence), errorCode: source.failure?.code ?? null, errorMessage: source.failure?.reason ?? null,
  };
}
async function bestEffortCleanup(
  lifecycle: RefreshLifecyclePort,
  clock: OrderedRefreshClock,
  runningSources: RunningSource[],
  deadlineMs: number,
  renewOwnership: () => Promise<Omit<OwnedInvocationOptions, 'signal'>>,
): Promise<void> {
  for (const source of runningSources.filter(({ completed }) => !completed)) {
    let ownership: Omit<OwnedInvocationOptions, 'signal'>;
    try {
      ownership = await renewOwnership();
    } catch {
      return;
    }
    try {
      await invokeOwnedWithDeadline(deadlineMs, ownership, (options) => lifecycle.completeSourceRun({
        id: source.id, refreshRunId: source.refreshRunId, status: 'failed', finishedAt: nextTimestamp(clock, 'sourceCleanup.finishedAt'),
        dataThrough: null, rowCount: null, requestFingerprint: null, evidence: {},
        errorCode: PUBLIC_SOURCE_ERROR.errorCode, errorMessage: PUBLIC_SOURCE_ERROR.errorMessage,
      }, options));
      source.completed = true;
    } catch { /* best effort; the primary failure remains authoritative */ }
  }
}

export async function runClientHealthRefresh(plan: RefreshRunPlan, dependencies: RefreshOrchestrationDependencies): Promise<RefreshRunResult> {
  if (!dependencies || typeof dependencies !== 'object') throw new Error('Refresh orchestration dependencies are required');
  const normalizedPlan = validatePlan(plan);
  const { clients } = normalizedPlan;
  const deadlineMs = plan.deadlineMs;
  const { lifecycle, persistence, clock } = dependencies;
  if (!lifecycle || typeof lifecycle.createRefreshRun !== 'function' || typeof lifecycle.getRefreshRun !== 'function'
    || typeof lifecycle.acquireRefreshLease !== 'function' || typeof lifecycle.renewRefreshLease !== 'function'
    || typeof lifecycle.getRefreshLease !== 'function' || typeof lifecycle.releaseRefreshLease !== 'function'
    || typeof lifecycle.createSourceRun !== 'function' || typeof lifecycle.getSourceRun !== 'function'
    || typeof lifecycle.completeSourceRun !== 'function' || typeof lifecycle.validateRefreshRun !== 'function'
    || typeof lifecycle.publishRefreshRun !== 'function' || typeof lifecycle.failRefreshRun !== 'function') throw new Error('Complete refresh lifecycle port is required');
  const claimAttemptId = uuid(randomUUID(), 'claimAttemptId');
  const runAttemptId = uuid(randomUUID(), 'runAttemptId');
  const assemble = dependencies.assemble ?? assembleClientHealthSnapshot;
  const persist = dependencies.persist ?? storeSnapshot;
  const runningSources: RunningSource[] = [];
  const refreshIdentityHash = canonicalEvidenceHash(normalizedPlan.identity);
  const refreshRunId = deterministicUuid({ type: 'client-health-refresh-attempt', refreshIdentityHash, runAttemptId });
  const refreshIdentity: Omit<RequestedCreateRefreshRunInput, 'startedAt'> = {
    id: refreshRunId, refreshIdentityHash, runAttemptId,
    snapshotDate: plan.snapshotDate, calculationVersion: plan.calculationVersion,
    sourceContractVersion: plan.sourceContractVersion,
  };
  let refreshCreateInput: RequestedCreateRefreshRunInput | null = null;
  let publishAttempted = false;
  let ownership: Omit<OwnedInvocationOptions, 'signal'> | null = null;
  let lease: RefreshLeaseState | null = null;
  let releaseAllowed = false;
  let successfulResult: RefreshRunResult | null = null;

  const renewOwnership = async (): Promise<Omit<OwnedInvocationOptions, 'signal'>> => {
    const currentOwnership = ownership;
    const currentLease = lease;
    if (!currentOwnership || !currentLease) throw new Error('Refresh lease ownership is not proven');
    ownership = null;
    lease = null;
    const renewed = await renewOrReconcileLease(lifecycle, {
      refreshRunId,
      invocationId: currentLease.invocationId,
      claimAttemptId: currentLease.claimAttemptId,
      fencingToken: currentLease.fencingToken,
      leaseDurationMs: plan.leaseDurationMs,
    }, currentLease, deadlineMs, currentOwnership);
    const renewedOwnership = {
      invocationId: renewed.invocationId,
      claimAttemptId: renewed.claimAttemptId,
      fencingToken: renewed.fencingToken,
    };
    lease = renewed;
    ownership = renewedOwnership;
    return renewedOwnership;
  };

  try {
    refreshCreateInput = { ...refreshIdentity, startedAt: nextTimestamp(clock, 'refresh.startedAt') };
    const persistedRefresh = await createOrReconcileRefresh(lifecycle, refreshCreateInput, deadlineMs);
    const leaseInput = { refreshRunId, invocationId: plan.invocationId, claimAttemptId, leaseDurationMs: plan.leaseDurationMs };
    lease = await acquireOrReconcileLease(lifecycle, leaseInput, deadlineMs);
    ownership = { invocationId: lease.invocationId, claimAttemptId: lease.claimAttemptId, fencingToken: lease.fencingToken };

    const jobs: CollectionJob[] = [];
    for (const client of clients) for (const collector of client.collectors) {
      const input = client.assemblyInput;
      const sourceIdentity: Omit<RequestedCreateSourceRunInput, 'startedAt'> = {
        id: deterministicUuid({ type: 'client-health-source', refreshRunId, clientId: input.clientId, sourceKey: collector.sourceKey }),
        refreshRunId, clientId: input.clientId, sourceKey: collector.sourceKey,
        windowStart: collector.windowStart, windowEnd: collector.windowEnd,
      };
      const createInput: RequestedCreateSourceRunInput = {
        ...sourceIdentity, startedAt: nextTimestamp(clock, 'source.startedAt'),
      };
      const running = { id: createInput.id, refreshRunId, clientId: input.clientId, sourceKey: collector.sourceKey, completed: false };
      runningSources.push(running);
      const sourceCreateOwnership = await renewOwnership();
      await createOrReconcileSource(lifecycle, createInput, deadlineMs, sourceCreateOwnership);
      jobs.push({ client, collector, running });
    }

    await collectBounded(jobs, plan.concurrency, deadlineMs, async () => { await renewOwnership(); });
    const receipts: SnapshotPersistenceReceipt[] = [];
    const assemblies = new Map<string, ClientHealthSnapshotAssembly>();
    for (const client of clients) {
      const sourceResults = jobs.filter((job) => job.client === client).map((job) => {
        if (!job.result) throw new Error(`${client.assemblyInput.clientId}.${job.collector.sourceKey} collector did not return a result`);
        return job.result;
      });
      const assembly = assemble({ ...client.assemblyInput, sourceResults });
      if (assembly.clientId !== client.assemblyInput.clientId || assembly.snapshot.clientKey !== client.assemblyInput.clientKey) throw new Error(`${client.assemblyInput.clientId} assembly client identity does not match its plan`);
      assemblies.set(assembly.clientId, assembly);
    }
    for (const client of clients) {
      const assembly = assemblies.get(client.assemblyInput.clientId);
      if (!assembly) throw new Error(`${client.assemblyInput.clientId} assembly is missing`);
      for (const running of runningSources.filter(({ clientId }) => clientId === assembly.clientId)) {
        const sourceCompletionOwnership = await renewOwnership();
        await invokeOwnedWithDeadline(deadlineMs, sourceCompletionOwnership, (options) => lifecycle.completeSourceRun(sourceCompletion(running, assembly, nextTimestamp(clock, 'source.finishedAt')), options));
        running.completed = true;
      }
      const persistenceOwnership = await renewOwnership();
      receipts.push(await invokeOwnedWithDeadline(deadlineMs, persistenceOwnership, (options) => persist(persistence, {
        refreshRunId, assembly, snapshotDate: plan.snapshotDate, calculatedAt: nextTimestamp(clock, 'snapshot.calculatedAt'),
      }, options)));
    }
    const entries = receipts.map((receipt) => ({
      clientId: receipt.clientId, assemblyEvidenceHash: receipt.evidenceHash,
      persistenceIdempotencyKey: receipt.idempotencyKey, snapshotId: receipt.snapshotId,
    })).sort((left, right) => compareCodeUnits(left.clientId, right.clientId));
    const evidenceHash = canonicalEvidenceHash({
      refreshRunId, snapshotDate: plan.snapshotDate, calculationVersion: plan.calculationVersion,
      sourceContractVersion: plan.sourceContractVersion, startedAt: persistedRefresh.startedAt, clients: entries,
    });
    const validationOwnership = await renewOwnership();
    await invokeOwnedWithDeadline(deadlineMs, validationOwnership, (options) => lifecycle.validateRefreshRun({ refreshRunId, validatedAt: nextTimestamp(clock, 'refresh.validatedAt'), evidenceHash }, options));
    successfulResult = { refreshRunId, evidenceHash, receipts };
    publishAttempted = true;
    const publicationOwnership = await renewOwnership();
    await invokeOwnedWithDeadline(deadlineMs, publicationOwnership, (options) => lifecycle.publishRefreshRun({ refreshRunId, publishedAt: nextTimestamp(clock, 'refresh.publishedAt') }, options));
    releaseAllowed = true;
    return successfulResult;
  } catch (cause) {
    if (!ownership) throw new RefreshOrchestrationError(cause);
    await bestEffortCleanup(lifecycle, clock, runningSources, deadlineMs, renewOwnership);
    if (!ownership) throw new RefreshOrchestrationError(cause);
    if (publishAttempted) {
      try {
        const state = refreshState(
          await invokeWithDeadline(deadlineMs, (options) => lifecycle.getRefreshRun(refreshRunId, options)),
          refreshCreateInput as RequestedCreateRefreshRunInput,
        );
        if (state.status === 'published' && successfulResult) {
          releaseAllowed = true;
          return successfulResult;
        }
        if (state.status !== 'validated') throw new Error('Publication outcome is not safe to reverse');
      } catch {
        throw new RefreshOrchestrationError(cause);
      }
    }
    try {
      const failureOwnership = await renewOwnership();
      await invokeOwnedWithDeadline(deadlineMs, failureOwnership, (options) => lifecycle.failRefreshRun({
        refreshRunId, finishedAt: nextTimestamp(clock, 'refresh.failedAt'), ...PUBLIC_REFRESH_ERROR,
      }, options));
      releaseAllowed = true;
    } catch { /* fenced best effort; original cause remains authoritative */ }
    throw new RefreshOrchestrationError(cause);
  } finally {
    if (releaseAllowed && ownership && lease) {
      try {
        await invokeOwnedWithDeadline(deadlineMs, ownership, (options) => lifecycle.releaseRefreshLease(lease as RefreshLeaseState, options));
      } catch { /* best effort after a proven terminal transition */ }
    }
  }
}
