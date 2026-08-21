import { assertDateOnly, comparisonWindows, phoenixMonthWindow } from './date-windows.ts';
import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import Decimal from 'decimal.js-light';
import {
  buildClientHealthSnapshot,
  type ClientHealthMetricKey,
  type ClientHealthSnapshot,
  type ClientHealthValueInputs,
  type EngineMetricConfig,
  type EngineSourceInput,
  type RatioRow,
} from './engine.ts';
import type {
  AdapterFailure,
  AdapterFailureCode,
  ClickUpAdapterEvidence,
  ClickUpAdapterResult,
  ClickUpSnapshotTask,
  SourceAdapterEvidence,
  SourceAdapterResult,
  SupabaseProject,
} from './adapters/types.ts';

export type CompletedSourceAdapterResult = SourceAdapterResult | ClickUpAdapterResult;
export type SourceValueField = Exclude<keyof ClientHealthValueInputs, 'budget' | 'hoursAllotted'>;

type BindingBase = {
  sourceKey: string;
  requestFingerprint: string;
  permittedValueFields: SourceValueField[];
  permitsTasks: boolean;
  expectedDataThrough: string;
};
export type SnapshotSourceBinding = BindingBase & (
  | { provider: 'supabase'; project: SupabaseProject; relation: string }
  | {
    provider: 'google-sheets';
    spreadsheetId: string;
    range: string;
    approvedClientAliasHash: string;
    valueRenderOption: 'UNFORMATTED_VALUE';
    dateTimeRenderOption: 'FORMATTED_STRING';
  }
  | { provider: 'clickup'; endpointFamily: 'team-time-entries-and-overdue-tasks' }
);

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
  /** Per-run, exact source/provider/request/value authorization, keyed by sourceKey. */
  sourceBindings: Record<string, SnapshotSourceBinding>;
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
export type AssembledClientHealthSnapshot = Omit<ClientHealthSnapshot, 'evidenceHash'> & { calculationHash: string };
export type ClientHealthSnapshotAssembly = {
  clientId: string;
  snapshot: AssembledClientHealthSnapshot;
  tasks: AssembledSnapshotTask[];
  sources: Record<string, AssembledSourceMetadata>;
  /** The sole authoritative hash for the complete assembled artifact. */
  evidenceHash: string;
};

const PUBLIC_FAILURE_REASONS: Record<AdapterFailureCode, string> = {
  query_failed: 'The approved source query failed.',
  partial_query: 'The approved source query was incomplete.',
  invalid_count: 'The approved source count was invalid.',
  count_changed: 'The approved source count changed during verification.',
  source_changed: 'The approved source changed during verification.',
  incomplete_page: 'The approved source response was incomplete.',
  duplicate_key: 'The approved source returned duplicate identifiers.',
  page_order: 'The approved source ordering was invalid.',
  malformed_row: 'The approved source returned malformed data.',
  max_pages: 'The approved source exceeded its page limit.',
};
const FAILURE_CODES = new Set<AdapterFailureCode>(Object.keys(PUBLIC_FAILURE_REASONS) as AdapterFailureCode[]);
const VALUE_FIELDS: SourceValueField[] = [
  'monthSpend', 'currentRows', 'previousRows', 'hoursUsed', 'overdueTaskCount', 'revenue', 'fulfillmentCost',
];
const SCALARS = ['monthSpend', 'hoursUsed', 'overdueTaskCount', 'revenue', 'fulfillmentCost'] as const;
const FIELD_METRIC: Record<SourceValueField, ClientHealthMetricKey> = {
  monthSpend: 'budget_pacing',
  currentRows: 'north_star',
  previousRows: 'north_star',
  hoursUsed: 'hours',
  overdueTaskCount: 'overdue_tasks',
  revenue: 'margin',
  fulfillmentCost: 'margin',
};
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
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== text) throw new Error(`${field} must be a canonical ISO timestamp`);
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
function nullableCount(value: unknown, field: string): number | null {
  const count = nullableNonnegative(value, field);
  if (count !== null && !Number.isInteger(count)) throw new Error(`${field} must be an integer`);
  return count;
}
function sourceKeyList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const keys = value.map((key, index) => requiredText(key, `${field}[${index}]`));
  if (new Set(keys).size !== keys.length) throw new Error(`${field} contains duplicate source keys`);
  return [...keys].sort(compareCodeUnits);
}
function phoenixDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function phoenixEndOfDay(date: string): number {
  return Date.parse(`${date}T07:00:00.000Z`) + 86_400_000 - 1;
}
function validateBase(input: SnapshotAssemblyInput): void {
  if (!input || typeof input !== 'object') throw new Error('Snapshot assembly input is malformed');
  requiredText(input.clientId, 'clientId');
  requiredText(input.clientKey, 'clientKey');
  if (typeof input.configApproved !== 'boolean') throw new Error('configApproved must be boolean');
  requiredText(input.calculationVersion, 'calculationVersion');
  requiredText(input.sourceContractVersion, 'sourceContractVersion');
  assertDateOnly(input.snapshotDate, 'snapshotDate');
  const retrievedAt = canonicalTimestamp(input.retrievedAt, 'retrievedAt');
  if (input.snapshotDate > phoenixDate(retrievedAt)) throw new Error('snapshotDate cannot be after the retrievedAt Phoenix date');
  if (!input.phoenix || typeof input.phoenix !== 'object') throw new Error('phoenix windows are required');
  const expectedMonth = phoenixMonthWindow(input.snapshotDate);
  const comparisonDays = nonnegative(input.phoenix.comparisonDays, 'phoenix.comparisonDays');
  if (!Number.isInteger(comparisonDays) || comparisonDays !== 14) throw new Error('phoenix.comparisonDays must match the engine comparison contract of 14 days');
  const expectedComparison = comparisonWindows(input.snapshotDate, comparisonDays);
  const actual = {
    month: input.phoenix.month, current: input.phoenix.current, previous: input.phoenix.previous,
    elapsedMonthDays: input.phoenix.elapsedMonthDays, daysInMonth: input.phoenix.daysInMonth,
  };
  const expected = {
    month: { start: expectedMonth.start, end: expectedMonth.end },
    current: expectedComparison.current, previous: expectedComparison.previous,
    elapsedMonthDays: expectedMonth.elapsedDays, daysInMonth: expectedMonth.daysInMonth,
  };
  if (canonicalEvidenceJson(actual) !== canonicalEvidenceJson(expected)) throw new Error('Phoenix windows and day counts do not match snapshotDate');
}
function assembledSnapshot(snapshot: ClientHealthSnapshot): AssembledClientHealthSnapshot {
  const { evidenceHash: calculationHash, ...withoutAmbiguousHash } = snapshot;
  return { ...withoutAmbiguousHash, calculationHash };
}
function configurationRequired(input: SnapshotAssemblyInput): ClientHealthSnapshotAssembly {
  const snapshot = assembledSnapshot(buildClientHealthSnapshot({
    clientKey: input.clientKey, configApproved: false, lastCompleteSourceDate: input.snapshotDate,
    calculationVersion: input.calculationVersion, metricConfig: [], sources: [], values: EMPTY_VALUES(),
  }));
  const normalized = {
    clientId: input.clientId, clientKey: input.clientKey, configApproved: false,
    calculationVersion: input.calculationVersion, sourceContractVersion: input.sourceContractVersion,
    snapshotDate: input.snapshotDate, retrievedAt: input.retrievedAt, phoenix: input.phoenix,
    snapshot, tasks: [], sources: {},
  };
  return { clientId: input.clientId, snapshot, tasks: [], sources: {}, evidenceHash: canonicalEvidenceHash(normalized) };
}
function sanitizeFailure(value: unknown, sourceKey: string): AdapterFailure {
  if (!value || typeof value !== 'object') throw new Error(`${sourceKey} must carry a failure code`);
  const code = (value as { code?: unknown }).code;
  if (typeof code !== 'string' || !FAILURE_CODES.has(code as AdapterFailureCode)) throw new Error(`${sourceKey} has a non-allowlisted failure code`);
  return { code: code as AdapterFailureCode, reason: PUBLIC_FAILURE_REASONS[code as AdapterFailureCode] };
}
function fingerprint(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${field} must be a lowercase SHA-256 fingerprint`);
  return text;
}
function identity(binding: SnapshotSourceBinding): Record<string, string> {
  if (binding.provider === 'supabase') return { project: binding.project, relation: binding.relation };
  if (binding.provider === 'google-sheets') return {
    spreadsheetId: binding.spreadsheetId, range: binding.range,
    approvedClientAliasHash: binding.approvedClientAliasHash,
    valueRenderOption: binding.valueRenderOption, dateTimeRenderOption: binding.dateTimeRenderOption,
  };
  return { endpointFamily: binding.endpointFamily };
}
function validateBindings(value: unknown, allowlist: string[], snapshotDate: string): Record<string, SnapshotSourceBinding> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('sourceBindings must be an object keyed by sourceKey');
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareCodeUnits(a, b));
  const keys = entries.map(([key]) => key);
  if (canonicalEvidenceJson(keys) !== canonicalEvidenceJson([...allowlist].sort(compareCodeUnits))) {
    throw new Error('sourceBindings key set must exactly equal the required and optional source key union');
  }
  const normalized: Record<string, SnapshotSourceBinding> = {};
  for (const [key, raw] of entries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${key} binding is malformed`);
    const binding = raw as SnapshotSourceBinding;
    const sourceKey = requiredText(binding.sourceKey, `${key}.binding.sourceKey`);
    if (sourceKey !== key) throw new Error(`${key} binding sourceKey does not match its key`);
    if (!['supabase', 'google-sheets', 'clickup'].includes(binding.provider)) throw new Error(`${key} binding provider is invalid`);
    const requestFingerprint = fingerprint(binding.requestFingerprint, `${key}.binding.requestFingerprint`);
    assertDateOnly(binding.expectedDataThrough, `${key}.binding.expectedDataThrough`);
    if (binding.expectedDataThrough > snapshotDate) throw new Error(`${key} expectedDataThrough cannot exceed snapshotDate`);
    const fields = sourceKeyList(binding.permittedValueFields, `${key}.binding.permittedValueFields`) as SourceValueField[];
    if (fields.some((field) => !VALUE_FIELDS.includes(field))) throw new Error(`${key} binding permits an invalid value field`);
    if (typeof binding.permitsTasks !== 'boolean') throw new Error(`${key}.binding.permitsTasks must be boolean`);
    const common = {
      sourceKey,
      requestFingerprint,
      permittedValueFields: fields,
      permitsTasks: binding.permitsTasks,
      expectedDataThrough: binding.expectedDataThrough,
    };
    if (binding.provider === 'supabase') {
      if (binding.project !== 'prepass' && binding.project !== 'eic') throw new Error(`${key} binding Supabase project is invalid`);
      const relation = requiredText(binding.relation, `${key}.binding.relation`);
      normalized[key] = { ...common, provider: 'supabase', project: binding.project, relation };
    } else if (binding.provider === 'google-sheets') {
      const spreadsheetId = requiredText(binding.spreadsheetId, `${key}.binding.spreadsheetId`);
      const range = requiredText(binding.range, `${key}.binding.range`);
      const approvedClientAliasHash = fingerprint(binding.approvedClientAliasHash, `${key}.binding.approvedClientAliasHash`);
      if (binding.valueRenderOption !== 'UNFORMATTED_VALUE' || binding.dateTimeRenderOption !== 'FORMATTED_STRING') {
        throw new Error(`${key} binding render contract is invalid`);
      }
      normalized[key] = {
        ...common,
        provider: 'google-sheets',
        spreadsheetId,
        range,
        approvedClientAliasHash,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      };
    } else {
      if (binding.endpointFamily !== 'team-time-entries-and-overdue-tasks') throw new Error(`${key} binding endpoint family is invalid`);
      normalized[key] = { ...common, provider: 'clickup', endpointFamily: 'team-time-entries-and-overdue-tasks' };
    }
  }
  return normalized;
}
function sanitizeEvidence(
  evidenceValue: unknown, binding: SnapshotSourceBinding, sourceContractVersion: string, retrievedAt: string,
): SanitizedSourceEvidence {
  const sourceKey = binding.sourceKey;
  if (!evidenceValue || typeof evidenceValue !== 'object' || Array.isArray(evidenceValue)) throw new Error(`${sourceKey}.evidence is malformed`);
  const evidence = evidenceValue as (SourceAdapterEvidence | ClickUpAdapterEvidence) & Record<string, unknown>;
  if (requiredText(evidence.sourceKey, `${sourceKey}.evidence.sourceKey`) !== sourceKey) throw new Error(`${sourceKey} evidence source key does not match`);
  if (requiredText(evidence.sourceContractVersion, `${sourceKey}.evidence.sourceContractVersion`) !== sourceContractVersion) throw new Error(`${sourceKey} evidence contract version does not match`);
  if (evidence.provider !== binding.provider) throw new Error(`${sourceKey} evidence provider does not match its binding`);
  const requestFingerprint = fingerprint(evidence.requestFingerprint, `${sourceKey}.evidence.requestFingerprint`);
  if (requestFingerprint !== binding.requestFingerprint) throw new Error(`${sourceKey} evidence request fingerprint does not match its binding`);
  const common = { sourceKey, sourceContractVersion, requestFingerprint };
  if (binding.provider === 'clickup') {
    if (canonicalTimestamp(evidence.retrievedAt, `${sourceKey}.evidence.retrievedAt`) !== retrievedAt) throw new Error(`${sourceKey} evidence retrievedAt does not match`);
    const timeEntryCount = nullableCount(evidence.timeEntryCount, `${sourceKey}.evidence.timeEntryCount`);
    const overdueTaskCount = nullableCount(evidence.overdueTaskCount, `${sourceKey}.evidence.overdueTaskCount`);
    const totalDurationMs = evidence.totalDurationMs === null ? null : requiredText(evidence.totalDurationMs, `${sourceKey}.evidence.totalDurationMs`);
    if (totalDurationMs !== null && !/^(0|[1-9]\d*)$/.test(totalDurationMs)) throw new Error(`${sourceKey} evidence totalDurationMs is invalid`);
    if (evidence.endpointFamily !== binding.endpointFamily) throw new Error(`${sourceKey} evidence endpoint family does not match its binding`);
    return { ...common, provider: 'clickup', endpointFamily: binding.endpointFamily, retrievedAt, timeEntryCount, totalDurationMs, overdueTaskCount };
  }
  if (binding.provider === 'google-sheets') {
    const actualIdentity = {
      spreadsheetId: evidence.spreadsheetId, range: evidence.range,
      approvedClientAliasHash: evidence.approvedClientAliasHash,
      valueRenderOption: evidence.valueRenderOption, dateTimeRenderOption: evidence.dateTimeRenderOption,
    };
    if (canonicalEvidenceJson(actualIdentity) !== canonicalEvidenceJson(identity(binding))) throw new Error(`${sourceKey} Google Sheets evidence identity does not match its binding`);
    return { ...common, provider: 'google-sheets', ...identity(binding), matchedRowCount: nullableCount(evidence.matchedRowCount, `${sourceKey}.evidence.matchedRowCount`) };
  }
  if (canonicalTimestamp(evidence.retrievedAt, `${sourceKey}.evidence.retrievedAt`) !== retrievedAt) throw new Error(`${sourceKey} evidence retrievedAt does not match`);
  if (evidence.project !== binding.project || evidence.relation !== binding.relation) throw new Error(`${sourceKey} Supabase evidence identity does not match its binding`);
  return { ...common, provider: 'supabase', ...identity(binding), retrievedAt, selectedRowCount: nullableCount(evidence.selectedRowCount, `${sourceKey}.evidence.selectedRowCount`) };
}
function validateSource(sourceValue: unknown, index: number, binding: SnapshotSourceBinding, snapshotDate: string): EngineSourceInput {
  if (!sourceValue || typeof sourceValue !== 'object') throw new Error(`sourceResults[${index}].source is malformed`);
  const source = sourceValue as EngineSourceInput;
  const key = requiredText(source.key, `sourceResults[${index}].source.key`);
  if (!['succeeded', 'partial', 'failed'].includes(source.status)) throw new Error(`${key} has an invalid completed status`);
  if (typeof source.stale !== 'boolean') throw new Error(`${key}.stale must be boolean`);
  const rowCount = nullableCount(source.rowCount, `${key}.rowCount`);
  if (source.status === 'succeeded') {
    if (source.dataThrough === null) {
      if (binding.provider !== 'supabase') throw new Error(`${key} only Supabase may report a verified empty success without dataThrough`);
      if (rowCount !== 0) throw new Error(`${key} succeeded without dataThrough must have rowCount 0`);
      if (source.stale !== true) throw new Error(`${key} claimed stale does not match derived freshness`);
    } else {
      assertDateOnly(source.dataThrough, `${key}.dataThrough`);
      if (source.dataThrough > binding.expectedDataThrough || source.dataThrough > snapshotDate) throw new Error(`${key}.dataThrough exceeds its approved cutoff`);
      const expectedStale = source.dataThrough !== binding.expectedDataThrough;
      if (source.stale !== expectedStale) throw new Error(`${key} claimed stale does not match derived freshness`);
    }
  } else {
    if (source.dataThrough !== null) throw new Error(`${key} partial/failed dataThrough must be null`);
    if (!source.stale) throw new Error(`${key} partial/failed source must be stale`);
  }
  return { key, status: source.status, dataThrough: source.dataThrough, stale: source.stale, rowCount };
}
function validateRows(value: unknown, field: string): RatioRow[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array or null`);
  return value.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`${field}[${index}] is malformed`);
    const item = row as RatioRow;
    return { spend: nonnegative(item.spend, `${field}[${index}].spend`), results: nonnegative(item.results, `${field}[${index}].results`) };
  });
}
function canonicalRows(rows: RatioRow[]): RatioRow[] {
  return [...rows].sort((left, right) => compareCodeUnits(canonicalEvidenceJson(left), canonicalEvidenceJson(right)));
}
function expectedClickUpHours(totalDurationMs: string, sourceKey: string): number {
  const total = new ClickUpDurationDecimal(totalDurationMs);
  if (total.gt(Number.MAX_SAFE_INTEGER)) throw new Error(`${sourceKey} evidence totalDurationMs is unsafe`);
  const hours = total.div(3_600_000).toNumber();
  if (!Number.isFinite(hours) || (!total.isZero() && hours === 0)) throw new Error(`${sourceKey} evidence totalDurationMs cannot be represented as hours`);
  return Object.is(hours, -0) ? 0 : hours;
}
function normalizeTask(taskValue: unknown, sourceKey: string, index: number, snapshotDate: string): ClickUpSnapshotTask {
  if (!taskValue || typeof taskValue !== 'object' || Array.isArray(taskValue)) throw new Error(`${sourceKey}.tasks[${index}] is malformed`);
  const task = taskValue as ClickUpSnapshotTask;
  const id = requiredText(task.id, `${sourceKey}.tasks[${index}].id`);
  if (!/^[A-Za-z0-9]+$/.test(id)) throw new Error(`${sourceKey}.tasks[${index}].id must be a canonical ClickUp task ID`);
  const listId = requiredText(task.listId, `${sourceKey}.tasks[${index}].listId`);
  if (!/^[1-9]\d*$/.test(listId)) throw new Error(`${sourceKey}.tasks[${index}].listId must be a canonical ClickUp list ID`);
  const name = requiredText(task.name, `${sourceKey}.tasks[${index}].name`);
  const url = requiredText(task.url, `${sourceKey}.tasks[${index}].url`);
  if (url !== `https://app.clickup.com/t/${id}`) throw new Error(`${sourceKey}.tasks[${index}].url must be the exact canonical ClickUp task URL`);
  const dueAt = canonicalTimestamp(task.dueAt, `${sourceKey}.tasks[${index}].dueAt`);
  if (Date.parse(dueAt) > phoenixEndOfDay(snapshotDate)) throw new Error(`${sourceKey}.tasks[${index}].dueAt exceeds the snapshot-day Phoenix cutoff`);
  return { id, listId, name, url, dueAt };
}
function assertCountBinding(source: EngineSourceInput, evidence: SanitizedSourceEvidence): void {
  if (evidence.provider === 'supabase') {
    if (source.rowCount !== evidence.selectedRowCount) throw new Error(`${source.key} rowCount does not match selectedRowCount evidence`);
  } else if (evidence.provider === 'google-sheets') {
    if (source.rowCount !== evidence.matchedRowCount) throw new Error(`${source.key} rowCount does not match matchedRowCount evidence`);
    if (source.status === 'succeeded' && (source.rowCount !== 1 || evidence.matchedRowCount !== 1)) throw new Error(`${source.key} succeeded Google Sheets count must equal 1`);
  } else {
    const time = evidence.timeEntryCount;
    const overdue = evidence.overdueTaskCount;
    if (typeof time === 'number' && typeof overdue === 'number') {
      if (source.rowCount !== time + overdue) throw new Error(`${source.key} rowCount does not equal timeEntryCount plus overdueTaskCount`);
    } else if (source.rowCount !== null) {
      throw new Error(`${source.key} rowCount requires complete ClickUp count evidence`);
    }
  }
}
function allAdapterValuesNull(values: ClientHealthValueInputs): boolean {
  return Object.values(values).every((value) => value === null);
}

export function assembleClientHealthSnapshot(input: SnapshotAssemblyInput): ClientHealthSnapshotAssembly {
  validateBase(input);
  if (!input.configApproved) return configurationRequired(input);

  const requiredKeys = sourceKeyList(input.requiredSourceKeys, 'requiredSourceKeys');
  const optionalKeys = sourceKeyList(input.optionalSourceKeys, 'optionalSourceKeys');
  const overlap = requiredKeys.filter((key) => optionalKeys.includes(key));
  if (overlap.length) throw new Error(`Source keys cannot be both required and optional: ${overlap.join(', ')}`);
  const allowlistKeys = [...requiredKeys, ...optionalKeys].sort(compareCodeUnits);
  const allowlist = new Set(allowlistKeys);
  const bindings = validateBindings(input.sourceBindings, allowlistKeys, input.snapshotDate);
  if (!Array.isArray(input.metricConfig)) throw new Error('metricConfig must be an array');
  const metricConfig = input.metricConfig.map((raw, index): EngineMetricConfig => {
    if (!raw || typeof raw !== 'object') throw new Error(`metricConfig[${index}] is malformed`);
    const sourceKeys = sourceKeyList(raw.sourceKeys, `metricConfig[${index}].sourceKeys`);
    if (sourceKeys.some((key) => !allowlist.has(key))) throw new Error('Metric configuration references a source outside the approved allowlist');
    return {
      key: raw.key,
      required: raw.required,
      weight: raw.weight,
      direction: raw.direction,
      greenThreshold: raw.greenThreshold,
      yellowThreshold: raw.yellowThreshold,
      sourceKeys,
    };
  });
  const metricSources = new Map<ClientHealthMetricKey, Set<string>>();
  for (const config of metricConfig) metricSources.set(config.key, new Set(config.sourceKeys));
  if (!Array.isArray(input.sourceResults)) throw new Error('sourceResults must be an array');

  const normalizedResults = input.sourceResults.map((result, index) => {
    if (!result || typeof result !== 'object') throw new Error(`sourceResults[${index}] is malformed`);
    const rawKey = requiredText(result.source?.key, `sourceResults[${index}].source.key`);
    if (!allowlist.has(rawKey)) throw new Error(`Unknown source key: ${rawKey}`);
    const binding = bindings[rawKey];
    const source = validateSource(result.source, index, binding, input.snapshotDate);
    let evidence = sanitizeEvidence(result.evidence, binding, input.sourceContractVersion, input.retrievedAt);
    assertCountBinding(source, evidence);
    if (source.status !== 'succeeded' && evidence.provider === 'clickup') evidence = { ...evidence, totalDurationMs: null };
    const failure = source.status === 'succeeded'
      ? (result.failure === null ? null : (() => { throw new Error(`${source.key} succeeded with a failure`); })())
      : sanitizeFailure(result.failure, source.key);
    return { result, source, evidence, failure, binding };
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

  for (const { result, source, evidence, failure, binding } of normalizedResults) {
    sourceMetadata.set(source.key, { ...source, failure, evidence });
    if (source.status !== 'succeeded') continue;
    if (!result.values || typeof result.values !== 'object') throw new Error(`${source.key}.values is malformed`);
    if (result.values.budget !== null && result.values.budget !== undefined) throw new Error(`${source.key} cannot provide fixed field budget`);
    if (result.values.hoursAllotted !== null && result.values.hoursAllotted !== undefined) throw new Error(`${source.key} cannot provide fixed field hoursAllotted`);
    if (binding.provider === 'supabase' && source.dataThrough === null) {
      if (!allAdapterValuesNull(result.values) || 'tasks' in result && result.tasks.length > 0) throw new Error(`${source.key} verified-empty Supabase source must contain no values, ratio rows, or tasks`);
      continue;
    }
    const assertPermission = (field: SourceValueField) => {
      if (!binding.permittedValueFields.includes(field)) throw new Error(`${source.key} binding does not permit value field ${field}`);
      if (!metricSources.get(FIELD_METRIC[field])?.has(source.key)) throw new Error(`${source.key} is not configured as a source for metric ${FIELD_METRIC[field]}`);
    };
    for (const field of SCALARS) {
      const value = nullableNonnegative(result.values[field], `${source.key}.values.${field}`);
      if (value === null) continue;
      assertPermission(field);
      const provider = scalarProviders.get(field);
      if (provider) throw new Error(`${field} has multiple providers: ${provider}, ${source.key}`);
      if (field === 'overdueTaskCount' && !Number.isInteger(value)) throw new Error(`${field} must be an integer`);
      scalarProviders.set(field, source.key);
      values[field] = value;
    }
    for (const field of ['currentRows', 'previousRows'] as const) {
      const rows = validateRows(result.values[field], `${source.key}.values.${field}`);
      if (rows === null) continue;
      assertPermission(field);
      ratioProvided[field] = true;
      ratioRows[field].push(...rows);
    }
    if ('tasks' in result) {
      if (binding.provider !== 'clickup' || !binding.permitsTasks) throw new Error(`${source.key} binding does not permit tasks`);
      if (!Array.isArray(result.tasks)) throw new Error(`${source.key}.tasks must be an array`);
    }
    if (evidence.provider === 'clickup') {
      if (!('tasks' in result) || !Array.isArray(result.tasks)) throw new Error(`${source.key}.tasks must be an array`);
      const { totalDurationMs, overdueTaskCount, timeEntryCount } = evidence;
      if (typeof totalDurationMs !== 'string') throw new Error(`${source.key} succeeded without exact totalDurationMs evidence`);
      if (typeof overdueTaskCount !== 'number' || !Number.isInteger(overdueTaskCount) || typeof timeEntryCount !== 'number' || !Number.isInteger(timeEntryCount)) throw new Error(`${source.key} succeeded without exact ClickUp count evidence`);
      const hoursUsed = values.hoursUsed;
      const suppliedOverdue = values.overdueTaskCount;
      if (hoursUsed === null || scalarProviders.get('hoursUsed') !== source.key) throw new Error(`${source.key}.values.hoursUsed must be non-null`);
      if (suppliedOverdue === null || scalarProviders.get('overdueTaskCount') !== source.key) throw new Error(`${source.key}.values.overdueTaskCount must be non-null`);
      if (hoursUsed !== expectedClickUpHours(totalDurationMs, source.key)) throw new Error(`${source.key}.values.hoursUsed does not match totalDurationMs evidence`);
      if (suppliedOverdue !== overdueTaskCount) throw new Error(`${source.key}.values.overdueTaskCount does not match evidence`);
      if (result.tasks.length !== Math.min(overdueTaskCount, 5)) throw new Error(`${source.key}.tasks length does not match overdueTaskCount evidence`);
      result.tasks.forEach((task, index) => {
        const normalized = normalizeTask(task, source.key, index, input.snapshotDate);
        if (taskIds.has(normalized.id)) throw new Error(`Duplicate task ID: ${normalized.id}`);
        taskIds.add(normalized.id);
        tasks.push(normalized);
      });
    } else if ('tasks' in result) throw new Error(`${source.key} is not an approved task-list source`);
  }
  values.currentRows = ratioProvided.currentRows ? canonicalRows(ratioRows.currentRows) : null;
  values.previousRows = ratioProvided.previousRows ? canonicalRows(ratioRows.previousRows) : null;

  for (const key of requiredKeys) {
    if (!sourceMetadata.has(key)) sourceMetadata.set(key, { status: 'missing', dataThrough: null, stale: false, rowCount: null, failure: null, evidence: null });
  }
  const sources = Object.fromEntries([...sourceMetadata.entries()].sort(([left], [right]) => compareCodeUnits(left, right)));
  const engineSources = Object.entries(sources).map(([key, source]) => ({ key, status: source.status, dataThrough: source.dataThrough, stale: source.stale, rowCount: source.rowCount }));
  const snapshot = assembledSnapshot(buildClientHealthSnapshot({
    clientKey: input.clientKey, configApproved: true, lastCompleteSourceDate: input.snapshotDate,
    calculationVersion: input.calculationVersion, metricConfig, sources: engineSources, values,
  }));
  const rankedTasks = tasks.sort((left, right) => compareCodeUnits(left.dueAt, right.dueAt) || compareCodeUnits(left.id, right.id))
    .slice(0, 5).map((task, index) => ({ ...task, rank: index + 1 }));
  const normalizedEvidence = {
    clientId: input.clientId, clientKey: input.clientKey, configApproved: true,
    calculationVersion: input.calculationVersion, sourceContractVersion: input.sourceContractVersion,
    snapshotDate: input.snapshotDate, retrievedAt: input.retrievedAt, phoenix: input.phoenix,
    metricConfig: [...metricConfig].sort((a, b) => compareCodeUnits(a.key, b.key)),
    requiredSourceKeys: requiredKeys, optionalSourceKeys: optionalKeys,
    sourceBindings: Object.fromEntries(Object.entries(bindings).map(([key, binding]) => [key, { ...binding, permittedValueFields: [...binding.permittedValueFields].sort(compareCodeUnits) }])),
    fixedValues: { budget: values.budget, hoursAllotted: values.hoursAllotted }, values, sources, tasks: rankedTasks, snapshot,
  };
  return { clientId: input.clientId, snapshot, tasks: rankedTasks, sources, evidenceHash: canonicalEvidenceHash(normalizedEvidence) };
}
