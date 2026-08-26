import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import { normalizeSnapshotAssemblyInput, type SnapshotAssemblyInput } from './build-snapshot.ts';
import type { JsonObject, JsonValue } from './repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY = /^[a-z0-9][a-z0-9_.-]*$/;
const FORBIDDEN = /(secret|token|password|credential|authorization|cookie|private.?key|api.?key|access.?key|refresh.?token)/i;
const METRICS = ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin'] as const;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export type ConfigRevisionClientDisplay = {
  displayName: string;
  dashboardHref: string | null;
  configStatus: 'approved' | 'configuration_required';
  reportingTimezone: string;
  monthlyHoursAllotment: number | null;
  clickupListIds: string[];
  marginAliases: string[];
  metadata: JsonObject;
};
export type ConfigRevisionMetricDisplay = {
  key: typeof METRICS[number];
  label: string;
  adapterKey: string;
  sourceConfig: JsonObject;
  approvedAt: string | null;
  approvedBy: string | null;
};
export type ConfigRevisionPlanClient = {
  assemblyInput: SnapshotAssemblyInput;
  collectors: Array<{ sourceKey: string; windowStart: string | null; windowEnd: string | null; collect(context: unknown): Promise<unknown> }>;
  display: ConfigRevisionClientDisplay;
  metricDisplayConfig: ConfigRevisionMetricDisplay[];
};
export type ApprovedConfigRevision = {
  schemaVersion: 1;
  clients: Array<{
    display: ConfigRevisionClientDisplay;
    metricDisplayConfig: ConfigRevisionMetricDisplay[];
    assemblyInput: Omit<SnapshotAssemblyInput, 'retrievedAt' | 'sourceResults'>;
    collectors: Array<{ sourceKey: string; windowStart: string | null; windowEnd: string | null }>;
  }>;
};
export type NormalizedConfigRevision = { id: string; hash: string; content: ApprovedConfigRevision };

function exact(value: object, keys: readonly string[], field: string): void {
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (canonicalEvidenceJson(actual) !== canonicalEvidenceJson(expected)) throw new Error(`${field} has an incompatible key set`);
}
function text(value: unknown, field: string, max = 1024): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim() || value.length > max) throw new Error(`${field} must be a trimmed nonempty string of at most ${max} characters`);
  return value;
}
function nullableText(value: unknown, field: string): string | null { return value === null ? null : text(value, field); }
function finiteNullable(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new Error(`${field} must be null or a bounded nonnegative number`);
  return Object.is(value, -0) ? 0 : value;
}
function safeJson(value: unknown, field: string, depth = 0): JsonValue {
  if (depth > 8) throw new Error(`${field} exceeds maximum JSON depth`);
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000) throw new Error(`${field} contains an unsafe number`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'string') {
    if (value.length > 2048) throw new Error(`${field} contains an overlong string`);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw new Error(`${field} contains an oversized array`);
    return value.map((item, index) => safeJson(item, `${field}[${index}]`, depth + 1));
  }
  if (!value || typeof value !== 'object') throw new Error(`${field} contains unsupported JSON`);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 64) throw new Error(`${field} contains too many keys`);
  return Object.fromEntries(entries.sort(([a], [b]) => compare(a, b)).map(([key, item]) => {
    if (!key || key.length > 64 || FORBIDDEN.test(key)) throw new Error(`${field} contains a forbidden or malformed key`);
    return [key, safeJson(item, `${field}.${key}`, depth + 1)];
  }));
}
function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${field} must be a bounded string array`);
  const result = value.map((item, index) => text(item, `${field}[${index}]`, 256));
  if (new Set(result).size !== result.length) throw new Error(`${field} contains duplicates`);
  return result.sort(compare);
}
function dateOnly(value: unknown, field: string): string {
  const result = text(value, field, 10);
  const timestamp = Date.parse(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== result) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return result;
}
function display(value: ConfigRevisionClientDisplay, field: string): ConfigRevisionClientDisplay {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} is malformed`);
  exact(value, ['displayName','dashboardHref','configStatus','reportingTimezone','monthlyHoursAllotment','clickupListIds','marginAliases','metadata'], field);
  const dashboardHref = nullableText(value.dashboardHref, `${field}.dashboardHref`);
  if (dashboardHref !== null && !dashboardHref.startsWith('/')) throw new Error(`${field}.dashboardHref must be an absolute dashboard path`);
  if (!['approved','configuration_required'].includes(value.configStatus)) throw new Error(`${field}.configStatus is invalid`);
  const metadata = safeJson(value.metadata, `${field}.metadata`);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`${field}.metadata must be an object`);
  return { displayName: text(value.displayName, `${field}.displayName`, 256), dashboardHref, configStatus: value.configStatus,
    reportingTimezone: text(value.reportingTimezone, `${field}.reportingTimezone`, 128), monthlyHoursAllotment: finiteNullable(value.monthlyHoursAllotment, `${field}.monthlyHoursAllotment`),
    clickupListIds: strings(value.clickupListIds, `${field}.clickupListIds`), marginAliases: strings(value.marginAliases, `${field}.marginAliases`), metadata: metadata as JsonObject };
}
function metricDisplays(value: ConfigRevisionMetricDisplay[], assembly: SnapshotAssemblyInput, field: string): ConfigRevisionMetricDisplay[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  if (!assembly.configApproved && value.length !== 0) throw new Error(`${field} must be empty for configuration-required clients`);
  const result = value.map((metric, index) => {
    if (!metric || typeof metric !== 'object' || Array.isArray(metric)) throw new Error(`${field}[${index}] is malformed`);
    exact(metric, ['key','label','adapterKey','sourceConfig','approvedAt','approvedBy'], `${field}[${index}]`);
    if (!METRICS.includes(metric.key)) throw new Error(`${field}[${index}].key is invalid`);
    const sourceConfig = safeJson(metric.sourceConfig, `${field}[${index}].sourceConfig`);
    if (!sourceConfig || typeof sourceConfig !== 'object' || Array.isArray(sourceConfig)) throw new Error(`${field}[${index}].sourceConfig must be an object`);
    const approvedAt = nullableText(metric.approvedAt, `${field}[${index}].approvedAt`);
    if (approvedAt !== null && new Date(approvedAt).toISOString() !== approvedAt) throw new Error(`${field}[${index}].approvedAt must be canonical`);
    return { key: metric.key, label: text(metric.label, `${field}[${index}].label`, 256), adapterKey: text(metric.adapterKey, `${field}[${index}].adapterKey`, 256),
      sourceConfig: sourceConfig as JsonObject, approvedAt, approvedBy: nullableText(metric.approvedBy, `${field}[${index}].approvedBy`) };
  }).sort((a,b) => compare(a.key,b.key));
  const engineKeys = assembly.metricConfig.map(({ key }) => key).sort(compare);
  if (canonicalEvidenceJson(result.map(({ key }) => key)) !== canonicalEvidenceJson(engineKeys)) throw new Error(`${field} must exactly cover engine metric configuration`);
  return result;
}
function revisionUuid(hash: string): string {
  const chars = hash.slice(0, 32).split(''); chars[12] = '8'; chars[16] = ['8','9','a','b'][parseInt(chars[16],16)%4]; const hex = chars.join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function buildApprovedConfigRevision(clients: ConfigRevisionPlanClient[]): NormalizedConfigRevision {
  if (!Array.isArray(clients) || clients.length === 0 || clients.length > 100) throw new Error('clients must contain between 1 and 100 entries');
  const content: ApprovedConfigRevision = { schemaVersion: 1, clients: clients.map((client, index) => {
    if (!client || typeof client !== 'object') throw new Error(`clients[${index}] is malformed`);
    exact(client, ['assemblyInput','collectors','display','metricDisplayConfig'], `clients[${index}]`);
    const normalized = normalizeSnapshotAssemblyInput(client.assemblyInput);
    const logical = structuredClone(normalized) as Partial<SnapshotAssemblyInput>;
    delete logical.retrievedAt; delete logical.sourceResults;
    logical.metricConfig = [...(logical.metricConfig ?? [])].sort((a, b) => compare(a.key, b.key));
    if (!UUID.test(String(logical.clientId)) || !KEY.test(String(logical.clientKey))) throw new Error(`clients[${index}] identity is malformed`);
    if (!Array.isArray(client.collectors) || client.collectors.length > 100) throw new Error(`clients[${index}].collectors must be a bounded array`);
    const collectors = client.collectors.map((collector, collectorIndex) => {
      if (!collector || typeof collector !== 'object') throw new Error(`clients[${index}].collectors[${collectorIndex}] is malformed`);
      exact(collector, ['sourceKey','windowStart','windowEnd','collect'], `clients[${index}].collectors[${collectorIndex}]`);
      if (typeof collector.collect !== 'function' || !KEY.test(collector.sourceKey)) throw new Error(`clients[${index}].collectors[${collectorIndex}] is malformed`);
      const windowStart = collector.windowStart === null ? null : dateOnly(collector.windowStart, `clients[${index}].collectors[${collectorIndex}].windowStart`);
      const windowEnd = collector.windowEnd === null ? null : dateOnly(collector.windowEnd, `clients[${index}].collectors[${collectorIndex}].windowEnd`);
      if ((windowStart === null) !== (windowEnd === null)
        || (windowStart !== null && (windowStart > windowEnd! || windowStart < normalized.phoenix.previous.start || windowEnd! > normalized.snapshotDate))) {
        throw new Error(`clients[${index}].collectors[${collectorIndex}] has an invalid window`);
      }
      return { sourceKey: collector.sourceKey, windowStart, windowEnd };
    }).sort((a,b)=>compare(a.sourceKey,b.sourceKey));
    const collectorKeys = collectors.map(({ sourceKey }) => sourceKey);
    if (new Set(collectorKeys).size !== collectorKeys.length || canonicalEvidenceJson(collectorKeys) !== canonicalEvidenceJson(Object.keys(normalized.sourceBindings).sort(compare))) throw new Error(`clients[${index}].collectors must exactly cover authorized source bindings`);
    const normalizedDisplay = display(client.display, `clients[${index}].display`);
    if ((normalizedDisplay.configStatus === 'approved') !== normalized.configApproved) throw new Error(`clients[${index}].display.configStatus conflicts with calculation authorization`);
    return { display: normalizedDisplay, metricDisplayConfig: metricDisplays(client.metricDisplayConfig, normalized, `clients[${index}].metricDisplayConfig`),
      assemblyInput: logical as ApprovedConfigRevision['clients'][number]['assemblyInput'], collectors };
  }).sort((a,b)=>compare(a.assemblyInput.clientId,b.assemblyInput.clientId)) };
  const ids = content.clients.map(({ assemblyInput }) => assemblyInput.clientId); if (new Set(ids).size !== ids.length) throw new Error('Duplicate revision client');
  const hash = canonicalEvidenceHash(content); return { id: revisionUuid(hash), hash, content };
}
