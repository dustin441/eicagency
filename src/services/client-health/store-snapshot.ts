import { assertDateOnly } from './date-windows.ts';
import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import type { ClientHealthSnapshotAssembly } from './build-snapshot.ts';
import { reduceNorthStarLanes, type NorthStarLaneEvidence } from './north-star-lanes.ts';
import type { InsertSnapshotInput, InsertSnapshotTaskInput, JsonObject, JsonValue } from './repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CLICKUP_TASK_ID = /^[A-Za-z0-9]+$/;
const CLICKUP_LIST_ID = /^[1-9]\d*$/;
const DIMENSION_KEYS = ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin'] as const;
const DIMENSION_STATUSES = new Set(['healthy', 'watch', 'at_risk', 'incomplete', 'unavailable', 'configuration_required']);
const SOURCE_STATUSES = new Set(['succeeded', 'partial', 'failed', 'missing']);
const OVERALL_STATUSES = new Set(['healthy', 'watch', 'at_risk', 'incomplete', 'configuration_required']);
const RECEIPT_KEYS = ['clientId', 'configRevisionHash', 'configRevisionId', 'evidenceHash', 'idempotencyKey', 'refreshRunId', 'snapshotId', 'taskCount'].sort();

export type SnapshotPersistenceBundle = {
  configRevisionId: string;
  configRevisionHash: string;
  idempotencyKey: string;
  evidenceHash: string;
  snapshotId: string;
  snapshot: InsertSnapshotInput & { evidenceHash: string };
  tasks: InsertSnapshotTaskInput[];
};

export type SnapshotPersistenceReceipt = {
  refreshRunId: string;
  configRevisionId: string;
  configRevisionHash: string;
  clientId: string;
  snapshotId: string;
  taskCount: number;
  evidenceHash: string;
  idempotencyKey: string;
};

/** Exclusive refresh ownership. Persistence implementations must atomically reject a stale or wrong fence. */
export type RefreshOwnershipContext = {
  signal: AbortSignal;
  invocationId: string;
  claimAttemptId: string;
  fencingToken: number;
};

/** This port is intentionally one fenced atomic operation; the existing two-insert repository is not a valid implementation. */
export interface AtomicSnapshotPersistencePort {
  /** Atomically verify invocationId/claimAttemptId/fencingToken is the active refresh lease before writing anything. */
  persistSnapshotBundle(bundle: SnapshotPersistenceBundle, options: RefreshOwnershipContext): Promise<unknown>;
}

export type StoreSnapshotInput = {
  /** Retries are idempotent only when they resume this same refresh run ID. */
  refreshRunId: string;
  configRevisionId: string;
  configRevisionHash: string;
  assembly: ClientHealthSnapshotAssembly;
  snapshotDate: string;
  calculatedAt: string;
};

function canonicalUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${field} must be a canonical UUID`);
  return value;
}

function sha256(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${field} must be a lowercase SHA-256 hash`);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
    throw new Error(`${field} must be a nonempty string without surrounding whitespace`);
  }
  return value;
}

function boundedText(value: unknown, field: string, maximum: number): string {
  const result = text(value, field);
  if (result.length > maximum) throw new Error(`${field} exceeds ${maximum} characters`);
  return result;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], field: string): void {
  if (canonicalEvidenceJson(Object.keys(value).sort()) !== canonicalEvidenceJson([...expected].sort())) {
    throw new Error(`${field} has an incompatible key set`);
  }
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  const date = new Date(result);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== result) throw new Error(`${field} must be a canonical ISO timestamp`);
  return result;
}

function finiteOrNull(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number or null`);
  return Object.is(value, -0) ? 0 : value;
}

function nonnegativeOrNull(value: unknown, field: string): number | null {
  const result = finiteOrNull(value, field);
  if (result !== null && result < 0) throw new Error(`${field} must be nonnegative or null`);
  return result;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be boolean`);
  return value;
}

function countOrNull(value: unknown, field: string): number | null {
  const result = finiteOrNull(value, field);
  if (result !== null && (!Number.isInteger(result) || result < 0)) throw new Error(`${field} must be a nonnegative integer or null`);
  return result;
}

function dateOrNull(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a date or null`);
  assertDateOnly(value, field);
  return value;
}

function jsonObject(value: Record<string, unknown>, field: string): JsonObject {
  const parsed: unknown = JSON.parse(canonicalEvidenceJson(value));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${field} must be a JSON object`);
  return parsed as JsonObject;
}

function deterministicUuid(hash: string): string {
  const chars = hash.slice(0, 32).split('');
  // RFC 9562 UUIDv8 identifies this as a custom SHA-256-derived UUID, rather than mislabeling it as UUIDv5.
  chars[12] = '8';
  chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function projectNorthStarFacts(value: unknown, parent: Record<string, unknown>): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('assembly.snapshot.dimensions.north_star.facts is malformed');
  const facts = value as Record<string, unknown>;
  exactKeys(facts, ['lanes'], 'assembly.snapshot.dimensions.north_star.facts');
  if (!Array.isArray(facts.lanes) || facts.lanes.length < 1 || facts.lanes.length > 4) throw new Error('North Star facts must contain between 1 and 4 lanes');
  const lanes = facts.lanes.map((raw, index): NorthStarLaneEvidence & { label: string; formula: 'cost_per_result' | 'roas'; evaluation: 'period_over_period_change' | 'absolute_target' } => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`North Star lane fact ${index} is malformed`);
    const lane = raw as Record<string, unknown>;
    exactKeys(lane, ['key','label','formula','evaluation','required','weight','currentValue','previousValue','evaluationValue','status','reason'], `North Star lane fact ${index}`);
    const key = boundedText(lane.key, `North Star lane fact ${index}.key`, 64);
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(key)) throw new Error(`North Star lane fact ${index}.key is invalid`);
    const label = boundedText(lane.label, `North Star lane fact ${index}.label`, 120);
    const formula = lane.formula;
    const evaluation = lane.evaluation;
    if (formula !== 'cost_per_result' && formula !== 'roas') throw new Error(`North Star lane fact ${index}.formula is invalid`);
    if (evaluation !== 'period_over_period_change' && evaluation !== 'absolute_target') throw new Error(`North Star lane fact ${index}.evaluation is invalid`);

    const required = boolean(lane.required, `North Star lane fact ${index}.required`);
    const weight = nonnegativeOrNull(lane.weight, `North Star lane fact ${index}.weight`);
    if (weight === null || weight <= 0 || weight > 100) throw new Error(`North Star lane fact ${index}.weight is invalid`);
    const currentValue = nonnegativeOrNull(lane.currentValue, `North Star lane fact ${index}.currentValue`);
    const previousValue = nonnegativeOrNull(lane.previousValue, `North Star lane fact ${index}.previousValue`);
    const evaluationValue = finiteOrNull(lane.evaluationValue, `North Star lane fact ${index}.evaluationValue`);
    const status = lane.status;
    if (!['healthy','watch','at_risk','incomplete','unavailable'].includes(status as string)) throw new Error(`North Star lane fact ${index}.status is invalid`);
    const reason = boundedText(lane.reason, `North Star lane fact ${index}.reason`, 512);
    return { key, label, formula, evaluation, required, weight, currentValue, previousValue, evaluationValue, status: status as NorthStarLaneEvidence['status'], reason };
  });
  const keys = lanes.map(({ key }) => key);
  if (canonicalEvidenceJson(keys) !== canonicalEvidenceJson([...keys].sort()) || new Set(keys).size !== keys.length) throw new Error('North Star lane facts must be unique and canonically ordered');
  if (lanes.reduce((total, lane) => total + lane.weight, 0) > 100) throw new Error('North Star lane fact weight must not exceed 100');
  const reduced = reduceNorthStarLanes(lanes);
  if (reduced.status !== parent.status || reduced.value !== finiteOrNull(parent.value, 'assembly.snapshot.dimensions.north_star.value') || reduced.reason !== parent.reason) {
    throw new Error('North Star lane facts do not match their parent dimension');
  }
  return jsonObject({ lanes }, 'northStarFacts');
}

function projectDimensions(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('assembly.snapshot.dimensions must be an object');
  const dimensions = value as Record<string, Record<string, unknown>>;
  const projected: Record<string, unknown> = {};
  for (const key of DIMENSION_KEYS) {
    const dimension = dimensions[key];
    if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) throw new Error(`assembly.snapshot.dimensions.${key} is malformed`);
    if (!DIMENSION_STATUSES.has(dimension.status as string)) throw new Error(`assembly.snapshot.dimensions.${key}.status is invalid`);
    const base = {
      status: dimension.status,
      value: finiteOrNull(dimension.value, `assembly.snapshot.dimensions.${key}.value`),
      reason: text(dimension.reason, `assembly.snapshot.dimensions.${key}.reason`),
      required: boolean(dimension.required, `assembly.snapshot.dimensions.${key}.required`),
      weight: nonnegativeOrNull(dimension.weight, `assembly.snapshot.dimensions.${key}.weight`),
    };
    projected[key] = key === 'north_star' && Object.prototype.hasOwnProperty.call(dimension, 'facts')
      ? { ...base, facts: projectNorthStarFacts(dimension.facts, dimension) }
      : base;
  }
  return jsonObject(projected, 'dimensionStatuses');
}

function projectSources(assembly: ClientHealthSnapshotAssembly, snapshotDate: string): JsonObject {
  const snapshotSources = assembly.snapshot.sources;
  const metadataSources = assembly.sources;
  if (!snapshotSources || typeof snapshotSources !== 'object' || Array.isArray(snapshotSources)) throw new Error('assembly.snapshot.sources must be an object');
  if (!metadataSources || typeof metadataSources !== 'object' || Array.isArray(metadataSources)) throw new Error('assembly.sources must be an object');
  const snapshotKeys = Object.keys(snapshotSources).sort();
  const metadataKeys = Object.keys(metadataSources).sort();
  if (canonicalEvidenceJson(snapshotKeys) !== canonicalEvidenceJson(metadataKeys)) throw new Error('assembly source key sets do not match');
  const projected: Record<string, unknown> = {};
  for (const key of snapshotKeys) {
    text(key, 'assembly source key');
    const source = snapshotSources[key];
    const metadata = metadataSources[key];
    if (!source || typeof source !== 'object' || !metadata || typeof metadata !== 'object') throw new Error(`assembly source ${key} is malformed`);
    if (!SOURCE_STATUSES.has(source.status)) throw new Error(`assembly.snapshot.sources.${key}.status is invalid`);
    const normalized = {
      status: source.status,
      dataThrough: dateOrNull(source.dataThrough, `assembly.snapshot.sources.${key}.dataThrough`),
      stale: boolean(source.stale, `assembly.snapshot.sources.${key}.stale`),
      rowCount: countOrNull(source.rowCount, `assembly.snapshot.sources.${key}.rowCount`),
    };
    if (normalized.dataThrough !== null && normalized.dataThrough > snapshotDate) throw new Error(`assembly.snapshot.sources.${key}.dataThrough exceeds snapshotDate`);
    const metadataProjection = {
      status: metadata.status,
      dataThrough: metadata.dataThrough,
      stale: metadata.stale,
      rowCount: metadata.rowCount,
    };
    if (canonicalEvidenceJson(normalized) !== canonicalEvidenceJson(metadataProjection)) throw new Error(`assembly source ${key} metadata does not match snapshot`);
    projected[key] = normalized;
  }
  return jsonObject(projected, 'sourceStatuses');
}

function validateWindows(assembly: ClientHealthSnapshotAssembly, snapshotDate: string): void {
  const windows = assembly.snapshot.windows;
  if (!windows || typeof windows !== 'object') throw new Error('assembly.snapshot.windows is malformed');
  const month = windows.month;
  const comparison = windows.comparison;
  if (!month || !comparison || !comparison.current || !comparison.previous) throw new Error('assembly.snapshot.windows is malformed');
  for (const [field, value] of [
    ['month.start', month.start], ['month.end', month.end],
    ['comparison.current.start', comparison.current.start], ['comparison.current.end', comparison.current.end],
    ['comparison.previous.start', comparison.previous.start], ['comparison.previous.end', comparison.previous.end],
  ] as const) assertDateOnly(value, `assembly.snapshot.windows.${field}`);
  if (month.end !== snapshotDate || comparison.current.end !== snapshotDate) {
    throw new Error('snapshotDate must equal the assembly snapshot window end date');
  }
}

function projectTasks(
  assembly: ClientHealthSnapshotAssembly,
  refreshRunId: string,
  snapshotId: string,
): InsertSnapshotTaskInput[] {
  if (!Array.isArray(assembly.tasks)) throw new Error('assembly.tasks must be an array');
  const overdueTaskCount = countOrNull(assembly.snapshot.values.overdueTaskCount, 'assembly.snapshot.values.overdueTaskCount');
  if (assembly.tasks.length !== Math.min(overdueTaskCount ?? 0, 5)) throw new Error('assembly task count does not match overdueTaskCount');
  const clickupSucceeded = Object.values(assembly.sources).some((source) => (
    source?.status === 'succeeded' && source.evidence?.provider === 'clickup'
  ));
  if (assembly.tasks.length > 0 && !clickupSucceeded) throw new Error('assembly tasks require a succeeded ClickUp source');
  const ids = new Set<string>();
  return assembly.tasks.map((task, index) => {
    if (!task || typeof task !== 'object') throw new Error(`assembly.tasks[${index}] is malformed`);
    if (task.rank !== index + 1) throw new Error('assembly tasks must be ordered by contiguous rank');
    const clickupTaskId = text(task.id, `assembly.tasks[${index}].id`);
    if (!CLICKUP_TASK_ID.test(clickupTaskId) || ids.has(clickupTaskId)) throw new Error(`assembly.tasks[${index}].id is invalid or duplicate`);
    ids.add(clickupTaskId);
    const listId = text(task.listId, `assembly.tasks[${index}].listId`);
    if (!CLICKUP_LIST_ID.test(listId)) throw new Error(`assembly.tasks[${index}].listId must be canonical`);
    const taskUrl = text(task.url, `assembly.tasks[${index}].url`);
    if (taskUrl !== `https://app.clickup.com/t/${clickupTaskId}`) throw new Error(`assembly.tasks[${index}].url must be canonical`);
    return {
      refreshRunId,
      snapshotId,
      clickupTaskId,
      listId,
      taskName: text(task.name, `assembly.tasks[${index}].name`),
      taskUrl,
      dueAt: timestamp(task.dueAt, `assembly.tasks[${index}].dueAt`),
      displayRank: task.rank,
    };
  });
}

export function buildSnapshotPersistenceBundle(input: StoreSnapshotInput): SnapshotPersistenceBundle {
  if (!input || typeof input !== 'object') throw new Error('Snapshot persistence input is malformed');
  const refreshRunId = canonicalUuid(input.refreshRunId, 'refreshRunId');
  const configRevisionId = canonicalUuid(input.configRevisionId, 'configRevisionId');
  const configRevisionHash = sha256(input.configRevisionHash, 'configRevisionHash');
  assertDateOnly(input.snapshotDate, 'snapshotDate');
  const calculatedAt = timestamp(input.calculatedAt, 'calculatedAt');
  const assembly = input.assembly;
  if (!assembly || typeof assembly !== 'object' || !assembly.snapshot || typeof assembly.snapshot !== 'object') throw new Error('assembly is malformed');
  const clientId = canonicalUuid(assembly.clientId, 'assembly.clientId');
  sha256(assembly.evidenceHash, 'assembly.evidenceHash');
  sha256(assembly.snapshot.calculationHash, 'assembly.snapshot.calculationHash');
  text(assembly.snapshot.clientKey, 'assembly.snapshot.clientKey');
  if (!OVERALL_STATUSES.has(assembly.snapshot.status)) throw new Error('assembly.snapshot.status is invalid');
  const overallScore = finiteOrNull(assembly.snapshot.score, 'assembly.snapshot.score');
  if (overallScore !== null && (overallScore < 0 || overallScore > 100)) throw new Error('assembly.snapshot.score must be between 0 and 100');
  if (!Array.isArray(assembly.snapshot.reasons)) throw new Error('assembly.snapshot.reasons must be an array');
  const reasons = assembly.snapshot.reasons.map((reason, index) => text(reason, `assembly.snapshot.reasons[${index}]`)) as JsonValue[];
  const dataThrough = dateOrNull(assembly.snapshot.dataThrough, 'assembly.snapshot.dataThrough');
  if (dataThrough !== null && dataThrough > input.snapshotDate) throw new Error('assembly.snapshot.dataThrough exceeds snapshotDate');
  validateWindows(assembly, input.snapshotDate);

  const values = assembly.snapshot.values;
  if (!values || typeof values !== 'object') throw new Error('assembly.snapshot.values is malformed');
  const dimensionStatuses = projectDimensions(assembly.snapshot.dimensions);
  const sourceStatuses = projectSources(assembly, input.snapshotDate);
  const snapshot: InsertSnapshotInput & { evidenceHash: string } = {
    refreshRunId,
    clientId,
    snapshotDate: input.snapshotDate,
    dataThrough,
    budget: nonnegativeOrNull(values.budget, 'assembly.snapshot.values.budget'),
    monthSpend: nonnegativeOrNull(values.monthSpend, 'assembly.snapshot.values.monthSpend'),
    expectedSpend: nonnegativeOrNull(values.expectedSpend, 'assembly.snapshot.values.expectedSpend'),
    currentWindowStart: assembly.snapshot.windows.comparison.current.start,
    currentWindowEnd: assembly.snapshot.windows.comparison.current.end,
    currentSpend: nonnegativeOrNull(values.currentSpend, 'assembly.snapshot.values.currentSpend'),
    currentResultCount: nonnegativeOrNull(values.currentResultCount, 'assembly.snapshot.values.currentResultCount'),
    currentCostPerResult: nonnegativeOrNull(values.currentCostPerResult, 'assembly.snapshot.values.currentCostPerResult'),
    previousWindowStart: assembly.snapshot.windows.comparison.previous.start,
    previousWindowEnd: assembly.snapshot.windows.comparison.previous.end,
    previousSpend: nonnegativeOrNull(values.previousSpend, 'assembly.snapshot.values.previousSpend'),
    previousResultCount: nonnegativeOrNull(values.previousResultCount, 'assembly.snapshot.values.previousResultCount'),
    previousCostPerResult: nonnegativeOrNull(values.previousCostPerResult, 'assembly.snapshot.values.previousCostPerResult'),
    hoursUsed: nonnegativeOrNull(values.hoursUsed, 'assembly.snapshot.values.hoursUsed'),
    hoursAllotted: nonnegativeOrNull(values.hoursAllotted, 'assembly.snapshot.values.hoursAllotted'),
    projectedHours: nonnegativeOrNull(values.projectedHours, 'assembly.snapshot.values.projectedHours'),
    overdueTaskCount: countOrNull(values.overdueTaskCount, 'assembly.snapshot.values.overdueTaskCount'),
    revenue: nonnegativeOrNull(values.revenue, 'assembly.snapshot.values.revenue'),
    fulfillmentCost: nonnegativeOrNull(values.fulfillmentCost, 'assembly.snapshot.values.fulfillmentCost'),
    marginPercent: finiteOrNull(values.marginPercent, 'assembly.snapshot.values.marginPercent'),
    dimensionStatuses,
    sourceStatuses,
    overallStatus: assembly.snapshot.status,
    overallScore,
    reasons,
    calculatedAt,
    evidenceHash: assembly.evidenceHash,
  };
  const snapshotIdentityHash = canonicalEvidenceHash({ refreshRunId, clientId, snapshotDate: input.snapshotDate, evidenceHash: assembly.evidenceHash });
  const snapshotId = deterministicUuid(snapshotIdentityHash);
  const tasks = projectTasks(assembly, refreshRunId, snapshotId);
  const identityAndContent = { configRevisionId, configRevisionHash, snapshotId, evidenceHash: assembly.evidenceHash, snapshot, tasks };
  return {
    configRevisionId,
    configRevisionHash,
    idempotencyKey: canonicalEvidenceHash(identityAndContent),
    evidenceHash: assembly.evidenceHash,
    snapshotId,
    snapshot,
    tasks,
  };
}

function validateReceipt(value: unknown, expected: SnapshotPersistenceReceipt): SnapshotPersistenceReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Snapshot persistence receipt is malformed');
  const receipt = value as Record<string, unknown>;
  if (canonicalEvidenceJson(Object.keys(receipt).sort()) !== canonicalEvidenceJson(RECEIPT_KEYS)) throw new Error('Snapshot persistence receipt fields are malformed');
  canonicalUuid(receipt.refreshRunId, 'receipt.refreshRunId');
  canonicalUuid(receipt.clientId, 'receipt.clientId');
  canonicalUuid(receipt.snapshotId, 'receipt.snapshotId');
  sha256(receipt.evidenceHash, 'receipt.evidenceHash');
  sha256(receipt.idempotencyKey, 'receipt.idempotencyKey');
  if (typeof receipt.taskCount !== 'number' || !Number.isInteger(receipt.taskCount) || receipt.taskCount < 0) throw new Error('receipt.taskCount must be a nonnegative integer');
  for (const key of ['refreshRunId', 'configRevisionId', 'configRevisionHash', 'clientId', 'taskCount'] as const) {
    if (receipt[key] !== expected[key]) throw new Error(`Snapshot persistence receipt ${key} does not match the requested bundle`);
  }
  return receipt as SnapshotPersistenceReceipt;
}

export async function storeSnapshot(
  port: AtomicSnapshotPersistencePort,
  input: StoreSnapshotInput,
  options: RefreshOwnershipContext,
): Promise<SnapshotPersistenceReceipt> {
  if (!port || typeof port.persistSnapshotBundle !== 'function') throw new Error('Atomic snapshot persistence port is required');
  const bundle = buildSnapshotPersistenceBundle(input);
  const receipt = await port.persistSnapshotBundle(bundle, options);
  return validateReceipt(receipt, {
    refreshRunId: bundle.snapshot.refreshRunId,
    configRevisionId: bundle.configRevisionId,
    configRevisionHash: bundle.configRevisionHash,
    clientId: bundle.snapshot.clientId,
    snapshotId: bundle.snapshotId,
    taskCount: bundle.tasks.length,
    evidenceHash: bundle.evidenceHash,
    idempotencyKey: bundle.idempotencyKey,
  });
}
