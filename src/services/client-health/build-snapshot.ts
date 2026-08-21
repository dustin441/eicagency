import { assertDateOnly, comparisonWindows, phoenixMonthWindow } from './date-windows.ts';
import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import Decimal from 'decimal.js-light';
import {
  buildClientHealthSnapshot,
  type ClientHealthSnapshot,
  type ClientHealthValueInputs,
  type EngineMetricConfig,
  type EngineSourceInput,
  type RatioRow,
} from './engine.ts';
import type {
  AdapterFailure,
  AdapterFailureCode,
  ClickUpAdapterResult,
  ClickUpSnapshotTask,
  SourceAdapterEvidence,
  SourceAdapterResult,
} from './adapters/types.ts';

export type CompletedSourceAdapterResult = SourceAdapterResult | ClickUpAdapterResult;

export type SnapshotAssemblyInput = {
  clientId: string;
  clientKey: string;
  configApproved: boolean;
  calculationVersion: string;
  sourceContractVersion: string;
  snapshotDate: string;
  retrievedAt: string;
  phoenix: {
    month: { start: string; end: string };
    current: { start: string; end: string };
    previous: { start: string; end: string };
    elapsedMonthDays: number;
    daysInMonth: number;
    comparisonDays: number;
  };
  metricConfig: EngineMetricConfig[];
  requiredSourceKeys: string[];
  optionalSourceKeys: string[];
  /** The only sources permitted to contribute/concatenate ratio rows. */
  ratioSourceKeys: string[];
  fixedValues?: {
    monthlyBudget?: number | null;
    monthlyHoursAllotment?: number | null;
  };
  sourceResults: CompletedSourceAdapterResult[];
};

export type SanitizedSourceEvidence = Record<string, string | number | null>;

export type AssembledSourceMetadata = {
  status: EngineSourceInput['status'];
  dataThrough: string | null;
  stale: boolean;
  rowCount: number | null;
  failure: AdapterFailure | null;
  evidence: SanitizedSourceEvidence | null;
};

export type AssembledSnapshotTask = ClickUpSnapshotTask & { rank: number };

export type ClientHealthSnapshotAssembly = {
  clientId: string;
  snapshot: ClientHealthSnapshot;
  tasks: AssembledSnapshotTask[];
  sources: Record<string, AssembledSourceMetadata>;
  evidenceHash: string;
};

const FAILURE_CODES = new Set<AdapterFailureCode>([
  'query_failed', 'partial_query', 'invalid_count', 'count_changed', 'source_changed',
  'incomplete_page', 'duplicate_key', 'page_order', 'malformed_row', 'max_pages',
]);
const SCALARS = [
  'monthSpend', 'hoursUsed', 'overdueTaskCount', 'revenue', 'fulfillmentCost',
] as const;
const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const ClickUpDurationDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type ScalarField = typeof SCALARS[number];
const EMPTY_VALUES = (): ClientHealthValueInputs => ({
  budget: null,
  monthSpend: null,
  currentRows: null,
  previousRows: null,
  hoursUsed: null,
  hoursAllotted: null,
  overdueTaskCount: null,
  revenue: null,
  fulfillmentCost: null,
});

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
    throw new Error(`${field} must be a nonempty string without surrounding whitespace`);
  }
  return value;
}

function canonicalTimestamp(value: unknown, field: string): string {
  const text = requiredText(value, field);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== text) {
    throw new Error(`${field} must be a canonical ISO timestamp`);
  }
  return text;
}

function nonnegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
  if (value < 0) throw new Error(`${field} must be nonnegative`);
  return Object.is(value, -0) ? 0 : value;
}

function nullableNonnegative(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : nonnegative(value, field);
}

function sourceKeyList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const keys = value.map((key, index) => requiredText(key, `${field}[${index}]`));
  if (new Set(keys).size !== keys.length) throw new Error(`${field} contains duplicate source keys`);
  return [...keys].sort(compareCodeUnits);
}

function validateBase(input: SnapshotAssemblyInput): void {
  if (!input || typeof input !== 'object') throw new Error('Snapshot assembly input is malformed');
  requiredText(input.clientId, 'clientId');
  requiredText(input.clientKey, 'clientKey');
  if (typeof input.configApproved !== 'boolean') throw new Error('configApproved must be boolean');
  requiredText(input.calculationVersion, 'calculationVersion');
  requiredText(input.sourceContractVersion, 'sourceContractVersion');
  assertDateOnly(input.snapshotDate, 'snapshotDate');
  canonicalTimestamp(input.retrievedAt, 'retrievedAt');
  if (!input.phoenix || typeof input.phoenix !== 'object') throw new Error('phoenix windows are required');
  const expectedMonth = phoenixMonthWindow(input.snapshotDate);
  const comparisonDays = nonnegative(input.phoenix.comparisonDays, 'phoenix.comparisonDays');
  if (!Number.isInteger(comparisonDays) || comparisonDays !== 14) {
    throw new Error('phoenix.comparisonDays must match the engine comparison contract of 14 days');
  }
  const expectedComparison = comparisonWindows(input.snapshotDate, comparisonDays);
  const actual = {
    month: input.phoenix.month,
    current: input.phoenix.current,
    previous: input.phoenix.previous,
    elapsedMonthDays: input.phoenix.elapsedMonthDays,
    daysInMonth: input.phoenix.daysInMonth,
  };
  const expected = {
    month: { start: expectedMonth.start, end: expectedMonth.end },
    current: expectedComparison.current,
    previous: expectedComparison.previous,
    elapsedMonthDays: expectedMonth.elapsedDays,
    daysInMonth: expectedMonth.daysInMonth,
  };
  if (canonicalEvidenceJson(actual) !== canonicalEvidenceJson(expected)) {
    throw new Error('Phoenix windows and day counts do not match snapshotDate');
  }
}

function configurationRequired(input: SnapshotAssemblyInput): ClientHealthSnapshotAssembly {
  const snapshot = buildClientHealthSnapshot({
    clientKey: input.clientKey,
    configApproved: false,
    lastCompleteSourceDate: input.snapshotDate,
    calculationVersion: input.calculationVersion,
    metricConfig: [],
    sources: [],
    values: EMPTY_VALUES(),
  });
  const normalized = {
    clientId: input.clientId,
    clientKey: input.clientKey,
    configApproved: false,
    calculationVersion: input.calculationVersion,
    sourceContractVersion: input.sourceContractVersion,
    snapshotDate: input.snapshotDate,
    retrievedAt: input.retrievedAt,
    phoenix: input.phoenix,
    snapshot,
    tasks: [],
    sources: {},
  };
  return { clientId: input.clientId, snapshot, tasks: [], sources: {}, evidenceHash: canonicalEvidenceHash(normalized) };
}

function validateFailure(value: unknown, sourceKey: string): AdapterFailure {
  if (!value || typeof value !== 'object') throw new Error(`${sourceKey} must carry a sanitized failure`);
  const failure = value as AdapterFailure;
  if (!FAILURE_CODES.has(failure.code)) throw new Error(`${sourceKey} has a non-allowlisted failure code`);
  const reason = requiredText(failure.reason, `${sourceKey}.failure.reason`);
  if (reason.length > 500 || /(?:access[_-]?token|authorization|bearer\s|password|secret|stack|\bat\s+\S+\s*\()/i.test(reason)) {
    throw new Error(`${sourceKey} has a non-allowlisted failure reason`);
  }
  return { code: failure.code, reason };
}

function fingerprint(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${field} must be a lowercase SHA-256 fingerprint`);
  return text;
}

function sanitizeEvidence(
  evidenceValue: unknown,
  sourceKey: string,
  sourceContractVersion: string,
  retrievedAt: string,
): SanitizedSourceEvidence {
  if (!evidenceValue || typeof evidenceValue !== 'object' || Array.isArray(evidenceValue)) {
    throw new Error(`${sourceKey}.evidence is malformed`);
  }
  const evidence = evidenceValue as SourceAdapterEvidence & Record<string, unknown>;
  if (requiredText(evidence.sourceKey, `${sourceKey}.evidence.sourceKey`) !== sourceKey) {
    throw new Error(`${sourceKey} evidence source key does not match`);
  }
  if (requiredText(evidence.sourceContractVersion, `${sourceKey}.evidence.sourceContractVersion`) !== sourceContractVersion) {
    throw new Error(`${sourceKey} evidence contract version does not match`);
  }
  const common = {
    sourceKey,
    sourceContractVersion,
    requestFingerprint: fingerprint(evidence.requestFingerprint, `${sourceKey}.evidence.requestFingerprint`),
  };
  if (evidence.provider === 'clickup') {
    if (canonicalTimestamp(evidence.retrievedAt, `${sourceKey}.evidence.retrievedAt`) !== retrievedAt) {
      throw new Error(`${sourceKey} evidence retrievedAt does not match`);
    }
    const overdueTaskCount = nullableNonnegative(evidence.overdueTaskCount, `${sourceKey}.evidence.overdueTaskCount`);
    if (overdueTaskCount !== null && !Number.isInteger(overdueTaskCount)) throw new Error(`${sourceKey} evidence overdueTaskCount must be an integer`);
    const totalDurationMs = evidence.totalDurationMs === null
      ? null
      : requiredText(evidence.totalDurationMs, `${sourceKey}.evidence.totalDurationMs`);
    if (totalDurationMs !== null && !/^(0|[1-9]\d*)$/.test(totalDurationMs)) throw new Error(`${sourceKey} evidence totalDurationMs is invalid`);
    if (evidence.endpointFamily !== 'team-time-entries-and-overdue-tasks') throw new Error(`${sourceKey} evidence endpoint family is invalid`);
    return { ...common, provider: 'clickup', endpointFamily: evidence.endpointFamily, retrievedAt, totalDurationMs, overdueTaskCount };
  }
  if (evidence.provider === 'google-sheets') {
    if (evidence.valueRenderOption !== 'UNFORMATTED_VALUE' || evidence.dateTimeRenderOption !== 'FORMATTED_STRING') {
      throw new Error(`${sourceKey} Google Sheets evidence render contract is invalid`);
    }
    return {
      ...common,
      provider: 'google-sheets',
      spreadsheetId: requiredText(evidence.spreadsheetId, `${sourceKey}.evidence.spreadsheetId`),
      range: requiredText(evidence.range, `${sourceKey}.evidence.range`),
      valueRenderOption: evidence.valueRenderOption,
      dateTimeRenderOption: evidence.dateTimeRenderOption,
      approvedClientAliasHash: fingerprint(evidence.approvedClientAliasHash, `${sourceKey}.evidence.approvedClientAliasHash`),
    };
  }
  if (evidence.project === 'prepass' || evidence.project === 'eic') {
    if (canonicalTimestamp(evidence.retrievedAt, `${sourceKey}.evidence.retrievedAt`) !== retrievedAt) {
      throw new Error(`${sourceKey} evidence retrievedAt does not match`);
    }
    return {
      ...common,
      provider: 'supabase',
      project: evidence.project,
      relation: requiredText(evidence.relation, `${sourceKey}.evidence.relation`),
      retrievedAt,
    };
  }
  throw new Error(`${sourceKey} evidence provider is not allowlisted`);
}

function validateSource(sourceValue: unknown, index: number): EngineSourceInput {
  if (!sourceValue || typeof sourceValue !== 'object') throw new Error(`sourceResults[${index}].source is malformed`);
  const source = sourceValue as EngineSourceInput;
  const key = requiredText(source.key, `sourceResults[${index}].source.key`);
  if (!['succeeded', 'partial', 'failed'].includes(source.status)) throw new Error(`${key} has an invalid completed status`);
  if (typeof source.stale !== 'boolean') throw new Error(`${key}.stale must be boolean`);
  const rowCount = nullableNonnegative(source.rowCount, `${key}.rowCount`);
  if (rowCount !== null && !Number.isInteger(rowCount)) throw new Error(`${key}.rowCount must be an integer`);
  if (source.status === 'succeeded') {
    if (source.dataThrough === null) {
      if (!source.stale) throw new Error(`${key} succeeded without dataThrough must be stale`);
      if (rowCount !== 0) throw new Error(`${key} succeeded without dataThrough must have rowCount 0`);
    } else {
      assertDateOnly(source.dataThrough, `${key}.dataThrough`);
    }
  } else if (source.dataThrough !== null) {
    throw new Error(`${key} partial/failed dataThrough must be null`);
  }
  return { key, status: source.status, dataThrough: source.dataThrough, stale: source.stale, rowCount };
}

function validateRows(value: unknown, field: string): RatioRow[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array or null`);
  return value.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`${field}[${index}] is malformed`);
    const item = row as RatioRow;
    return {
      spend: nonnegative(item.spend, `${field}[${index}].spend`),
      results: nonnegative(item.results, `${field}[${index}].results`),
    };
  });
}

function canonicalRows(rows: RatioRow[]): RatioRow[] {
  return [...rows].sort((left, right) => compareCodeUnits(canonicalEvidenceJson(left), canonicalEvidenceJson(right)));
}

function expectedClickUpHours(totalDurationMs: string, sourceKey: string): number {
  const total = new ClickUpDurationDecimal(totalDurationMs);
  if (total.gt(Number.MAX_SAFE_INTEGER)) throw new Error(`${sourceKey} evidence totalDurationMs is unsafe`);
  const hours = total.div(3_600_000).toNumber();
  if (!Number.isFinite(hours) || (!total.isZero() && hours === 0)) {
    throw new Error(`${sourceKey} evidence totalDurationMs cannot be represented as hours`);
  }
  return Object.is(hours, -0) ? 0 : hours;
}

function normalizeTask(taskValue: unknown, sourceKey: string, index: number): ClickUpSnapshotTask {
  if (!taskValue || typeof taskValue !== 'object' || Array.isArray(taskValue)) throw new Error(`${sourceKey}.tasks[${index}] is malformed`);
  const task = taskValue as ClickUpSnapshotTask;
  const id = requiredText(task.id, `${sourceKey}.tasks[${index}].id`);
  const name = requiredText(task.name, `${sourceKey}.tasks[${index}].name`);
  const url = requiredText(task.url, `${sourceKey}.tasks[${index}].url`);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(`${sourceKey}.tasks[${index}].url must be an absolute HTTPS URL`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.toString() !== url) {
    throw new Error(`${sourceKey}.tasks[${index}].url must be a canonical absolute HTTPS URL without credentials`);
  }
  const dueAt = canonicalTimestamp(task.dueAt, `${sourceKey}.tasks[${index}].dueAt`);
  return { id, name, url, dueAt };
}

export function assembleClientHealthSnapshot(input: SnapshotAssemblyInput): ClientHealthSnapshotAssembly {
  validateBase(input);
  if (!input.configApproved) return configurationRequired(input);

  const requiredKeys = sourceKeyList(input.requiredSourceKeys, 'requiredSourceKeys');
  const optionalKeys = sourceKeyList(input.optionalSourceKeys, 'optionalSourceKeys');
  const ratioKeys = sourceKeyList(input.ratioSourceKeys, 'ratioSourceKeys');
  const overlap = requiredKeys.filter((key) => optionalKeys.includes(key));
  if (overlap.length) throw new Error(`Source keys cannot be both required and optional: ${overlap.join(', ')}`);
  const allowlist = new Set([...requiredKeys, ...optionalKeys]);
  if (ratioKeys.some((key) => !allowlist.has(key))) throw new Error('ratioSourceKeys must belong to the source allowlist');
  if (!Array.isArray(input.metricConfig)) throw new Error('metricConfig must be an array');
  for (const config of input.metricConfig) {
    if (!config || !Array.isArray(config.sourceKeys) || config.sourceKeys.some((key) => !allowlist.has(key))) {
      throw new Error('Metric configuration references a source outside the approved allowlist');
    }
  }
  if (!Array.isArray(input.sourceResults)) throw new Error('sourceResults must be an array');

  const normalizedResults = input.sourceResults.map((result, index) => {
    if (!result || typeof result !== 'object') throw new Error(`sourceResults[${index}] is malformed`);
    const source = validateSource(result.source, index);
    if (!allowlist.has(source.key)) throw new Error(`Unknown source key: ${source.key}`);
    let evidence = sanitizeEvidence(result.evidence, source.key, input.sourceContractVersion, input.retrievedAt);
    if (source.status === 'succeeded' && source.dataThrough === null && evidence.provider !== 'supabase') {
      throw new Error(`${source.key} only Supabase may report a verified empty success without dataThrough`);
    }
    if (source.status !== 'succeeded' && evidence.provider === 'clickup') {
      // ClickUp evidence duplicates two metric values. Failed/partial sources may
      // retain request provenance only, never those values.
      evidence = { ...evidence, totalDurationMs: null, overdueTaskCount: null };
    }
    const failure = source.status === 'succeeded'
      ? (result.failure === null ? null : (() => { throw new Error(`${source.key} succeeded with a failure`); })())
      : validateFailure(result.failure, source.key);
    return { result, source, evidence, failure };
  }).sort((left, right) => compareCodeUnits(left.source.key, right.source.key));
  const resultKeys = normalizedResults.map(({ source }) => source.key);
  if (new Set(resultKeys).size !== resultKeys.length) throw new Error('Duplicate source adapter result');

  const values = EMPTY_VALUES();
  values.budget = nullableNonnegative(input.fixedValues?.monthlyBudget, 'fixedValues.monthlyBudget');
  values.hoursAllotted = nullableNonnegative(input.fixedValues?.monthlyHoursAllotment, 'fixedValues.monthlyHoursAllotment');
  const scalarProviders = new Map<ScalarField, string>();
  const ratioRows: Record<'currentRows' | 'previousRows', RatioRow[]> = { currentRows: [], previousRows: [] };
  const ratioProvided = { currentRows: false, previousRows: false };
  const tasks: ClickUpSnapshotTask[] = [];
  const taskIds = new Set<string>();
  const sourceMetadata = new Map<string, AssembledSourceMetadata>();

  for (const { result, source, evidence, failure } of normalizedResults) {
    sourceMetadata.set(source.key, { ...source, failure, evidence });
    if (source.status !== 'succeeded') continue; // Failure payload values/tasks are deliberately discarded.
    if (!result.values || typeof result.values !== 'object') throw new Error(`${source.key}.values is malformed`);
    if (result.values.budget !== null && result.values.budget !== undefined) throw new Error(`${source.key} cannot provide fixed field budget`);
    if (result.values.hoursAllotted !== null && result.values.hoursAllotted !== undefined) throw new Error(`${source.key} cannot provide fixed field hoursAllotted`);
    for (const field of SCALARS) {
      const value = nullableNonnegative(result.values[field], `${source.key}.values.${field}`);
      if (value === null) continue;
      const provider = scalarProviders.get(field);
      if (provider) throw new Error(`${field} has multiple providers: ${provider}, ${source.key}`);
      if (field === 'overdueTaskCount' && !Number.isInteger(value)) throw new Error(`${field} must be an integer`);
      scalarProviders.set(field, source.key);
      values[field] = value;
    }
    for (const field of ['currentRows', 'previousRows'] as const) {
      const rows = validateRows(result.values[field], `${source.key}.values.${field}`);
      if (rows === null) continue;
      if (!ratioKeys.includes(source.key)) throw new Error(`${source.key} is not approved to provide ratio rows`);
      ratioProvided[field] = true;
      ratioRows[field].push(...rows);
    }
    if (evidence.provider === 'clickup') {
      if (!('tasks' in result) || !Array.isArray(result.tasks)) throw new Error(`${source.key}.tasks must be an array`);
      const totalDurationMs = evidence.totalDurationMs;
      const evidenceOverdueCount = evidence.overdueTaskCount;
      if (typeof totalDurationMs !== 'string') throw new Error(`${source.key} succeeded without exact totalDurationMs evidence`);
      if (typeof evidenceOverdueCount !== 'number' || !Number.isInteger(evidenceOverdueCount)) {
        throw new Error(`${source.key} succeeded without exact overdueTaskCount evidence`);
      }
      const hoursUsed = values.hoursUsed;
      const overdueTaskCount = values.overdueTaskCount;
      if (hoursUsed === null || scalarProviders.get('hoursUsed') !== source.key) {
        throw new Error(`${source.key}.values.hoursUsed must be non-null`);
      }
      if (overdueTaskCount === null || scalarProviders.get('overdueTaskCount') !== source.key) {
        throw new Error(`${source.key}.values.overdueTaskCount must be non-null`);
      }
      if (hoursUsed !== expectedClickUpHours(totalDurationMs, source.key)) {
        throw new Error(`${source.key}.values.hoursUsed does not match totalDurationMs evidence`);
      }
      if (overdueTaskCount !== evidenceOverdueCount) {
        throw new Error(`${source.key}.values.overdueTaskCount does not match evidence`);
      }
      if (result.tasks.length !== Math.min(evidenceOverdueCount, 5)) {
        throw new Error(`${source.key}.tasks length does not match overdueTaskCount evidence`);
      }
      result.tasks.forEach((task, index) => {
        const normalized = normalizeTask(task, source.key, index);
        if (taskIds.has(normalized.id)) throw new Error(`Duplicate task ID: ${normalized.id}`);
        taskIds.add(normalized.id);
        tasks.push(normalized);
      });
    } else if ('tasks' in result) {
      throw new Error(`${source.key} is not an approved task-list source`);
    }
  }
  values.currentRows = ratioProvided.currentRows ? canonicalRows(ratioRows.currentRows) : null;
  values.previousRows = ratioProvided.previousRows ? canonicalRows(ratioRows.previousRows) : null;

  for (const key of requiredKeys) {
    if (!sourceMetadata.has(key)) {
      sourceMetadata.set(key, {
        status: 'missing', dataThrough: null, stale: false, rowCount: null, failure: null, evidence: null,
      });
    }
  }
  const sources = Object.fromEntries([...sourceMetadata.entries()].sort(([left], [right]) => compareCodeUnits(left, right)));
  const engineSources = Object.entries(sources).map(([key, source]) => ({
    key, status: source.status, dataThrough: source.dataThrough, stale: source.stale, rowCount: source.rowCount,
  }));
  const snapshot = buildClientHealthSnapshot({
    clientKey: input.clientKey,
    configApproved: true,
    lastCompleteSourceDate: input.snapshotDate,
    calculationVersion: input.calculationVersion,
    metricConfig: input.metricConfig,
    sources: engineSources,
    values,
  });
  const rankedTasks = tasks
    .sort((left, right) => compareCodeUnits(left.dueAt, right.dueAt) || compareCodeUnits(left.id, right.id))
    .slice(0, 5)
    .map((task, index) => ({ ...task, rank: index + 1 }));
  const normalizedEvidence = {
    clientId: input.clientId,
    clientKey: input.clientKey,
    configApproved: true,
    calculationVersion: input.calculationVersion,
    sourceContractVersion: input.sourceContractVersion,
    snapshotDate: input.snapshotDate,
    retrievedAt: input.retrievedAt,
    phoenix: input.phoenix,
    metricConfig: [...input.metricConfig].map((config) => ({ ...config, sourceKeys: [...config.sourceKeys].sort(compareCodeUnits) }))
      .sort((left, right) => compareCodeUnits(left.key, right.key)),
    requiredSourceKeys: requiredKeys,
    optionalSourceKeys: optionalKeys,
    ratioSourceKeys: ratioKeys,
    fixedValues: { budget: values.budget, hoursAllotted: values.hoursAllotted },
    values,
    sources,
    tasks: rankedTasks,
    snapshot,
  };
  return {
    clientId: input.clientId,
    snapshot,
    tasks: rankedTasks,
    sources,
    evidenceHash: canonicalEvidenceHash(normalizedEvidence),
  };
}
