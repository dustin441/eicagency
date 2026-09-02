import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import type { SourceValueField } from './build-snapshot.ts';
import type { SupabaseProject } from './adapters/types.ts';
import type { ClientHealthDirection, ClientHealthMetricKey } from './repository.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const KEY = /^[a-z0-9][a-z0-9_.-]*$/;
const METRICS: readonly ClientHealthMetricKey[] = ['budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin'];
const FACT_FIELDS: readonly SourceValueField[] = ['monthSpend', 'currentRows', 'previousRows', 'hoursUsed', 'overdueTaskCount', 'revenue', 'fulfillmentCost'];
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export type ConfigRevisionClientDisplay = {
  clientId: string;
  clientKey: string;
  displayName: string;
  dashboardHref: string | null;
  reportingTimezone: string;
  clickupListIds: string[];
  marginAliases: string[];
  configStatus: 'approved' | 'configuration_required';
};
export type ConfigRevisionFixedValues = {
  monthlyBudget: number | null;
  monthlyHoursAllotment: number | null;
};
export type ConfigRevisionMetric = {
  key: ClientHealthMetricKey;
  label: string;
  adapterKey: string;
  required: boolean;
  weight: number;
  direction: ClientHealthDirection;
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};
export type ConfigRevisionFreshnessPolicy = { maximumLagDays: number };
type SourceBindingBase = {
  sourceKey: string;
  requestFingerprint: string;
  permittedFactFields: SourceValueField[];
  freshnessPolicy: ConfigRevisionFreshnessPolicy;
};
export type ConfigRevisionSourceBinding = SourceBindingBase & (
  | { provider: 'supabase'; project: SupabaseProject; relation: string }
  | { provider: 'google-sheets'; spreadsheetId: string; range: string; approvedClientAliasHash: string; valueRenderOption: 'UNFORMATTED_VALUE'; dateTimeRenderOption: 'FORMATTED_STRING' }
  | { provider: 'clickup'; endpointFamily: 'team-time-entries-and-overdue-tasks'; permitsTasks: boolean; allowedListIds: string[] }
);
export type ApprovedConfigRevisionClient = ConfigRevisionClientDisplay & {
  fixedValues: ConfigRevisionFixedValues;
  metrics: ConfigRevisionMetric[];
  sources: ConfigRevisionSourceBinding[];
};
export type ApprovedConfigRevision = {
  schemaVersion: 2;
  calculationVersion: string;
  sourceContractVersion: string;
  clients: ApprovedConfigRevisionClient[];
};
export type NormalizedConfigRevision = { id: string; hash: string; content: ApprovedConfigRevision };
export type ConfigRevisionActivationReceipt = {
  revisionId: string;
  revisionHash: string;
  activationId: string;
  reviewedCommitSha: string;
  operatorIdentity: string;
  reason: string;
  activatedAt: string;
};
export type ActiveConfigRevision = { revision: NormalizedConfigRevision; activation: ConfigRevisionActivationReceipt };

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  if (canonicalEvidenceJson(Object.keys(value).sort(compare)) !== canonicalEvidenceJson([...keys].sort(compare))) throw new Error(`${field} has an incompatible key set`);
}
function text(value: unknown, field: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim() || value.length > max) throw new Error(`${field} must be a trimmed nonempty string of at most ${max} characters`);
  return value;
}
function key(value: unknown, field: string): string {
  const result = text(value, field, 128);
  if (!KEY.test(result)) throw new Error(`${field} must be a safe key`);
  return result;
}
function uuid(value: unknown, field: string): string {
  const result = text(value, field, 36);
  if (!UUID.test(result)) throw new Error(`${field} must be a canonical UUID`);
  return result;
}
function nullableText(value: unknown, field: string): string | null { return value === null ? null : text(value, field, 512); }
function boundedNumber(value: unknown, field: string, maximum = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) throw new Error(`${field} must be a bounded nonnegative number`);
  return Object.is(value, -0) ? 0 : value;
}
function strings(value: unknown, field: string, maxItems = 100): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} must be a bounded string array`);
  const result = value.map((item, index) => text(item, `${field}[${index}]`, 256));
  if (new Set(result).size !== result.length) throw new Error(`${field} contains duplicates`);
  return result.sort(compare);
}
function keys(value: unknown, field: string): string[] { return strings(value, field).map((item, index) => key(item, `${field}[${index}]`)).sort(compare); }
function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 64);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== result) throw new Error(`${field} must be a canonical ISO timestamp`);
  return result;
}
function revisionUuid(hash: string): string {
  const chars = hash.slice(0, 32).split('');
  chars[12] = '8'; chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function display(value: Record<string, unknown>, field: string): ConfigRevisionClientDisplay {
  const dashboardHref = nullableText(value.dashboardHref, `${field}.dashboardHref`);
  if (dashboardHref !== null && (!dashboardHref.startsWith('/') || dashboardHref.startsWith('//'))) throw new Error(`${field}.dashboardHref must be an absolute dashboard path`);
  const configStatus = value.configStatus;
  if (configStatus !== 'approved' && configStatus !== 'configuration_required') throw new Error(`${field}.configStatus is invalid`);
  return {
    clientId: uuid(value.clientId, `${field}.clientId`), clientKey: key(value.clientKey, `${field}.clientKey`),
    displayName: text(value.displayName, `${field}.displayName`), dashboardHref,
    reportingTimezone: text(value.reportingTimezone, `${field}.reportingTimezone`, 128),
    clickupListIds: strings(value.clickupListIds, `${field}.clickupListIds`), marginAliases: strings(value.marginAliases, `${field}.marginAliases`), configStatus,
  };
}
function fixedValues(value: unknown, field: string): ConfigRevisionFixedValues {
  const item = object(value, field);
  exact(item, ['monthlyBudget','monthlyHoursAllotment'], field);
  return {
    monthlyBudget: item.monthlyBudget === null ? null : boundedNumber(item.monthlyBudget, `${field}.monthlyBudget`),
    monthlyHoursAllotment: item.monthlyHoursAllotment === null ? null : boundedNumber(item.monthlyHoursAllotment, `${field}.monthlyHoursAllotment`),
  };
}
function metric(value: unknown, field: string): ConfigRevisionMetric {
  const item = object(value, field);
  exact(item, ['key','label','adapterKey','required','weight','direction','greenThreshold','yellowThreshold','sourceKeys'], field);
  const metricKey = item.key as ClientHealthMetricKey;
  if (!METRICS.includes(metricKey)) throw new Error(`${field}.key is invalid`);
  if (typeof item.required !== 'boolean') throw new Error(`${field}.required must be boolean`);
  const direction = item.direction as ClientHealthDirection;
  if (direction !== 'lower_is_better' && direction !== 'higher_is_better') throw new Error(`${field}.direction is invalid`);
  return { key: metricKey, label: text(item.label, `${field}.label`), adapterKey: key(item.adapterKey, `${field}.adapterKey`), required: item.required,
    weight: boundedNumber(item.weight, `${field}.weight`, 100), direction,
    greenThreshold: boundedNumber(item.greenThreshold, `${field}.greenThreshold`), yellowThreshold: boundedNumber(item.yellowThreshold, `${field}.yellowThreshold`),
    sourceKeys: keys(item.sourceKeys, `${field}.sourceKeys`) };
}
function source(value: unknown, field: string): ConfigRevisionSourceBinding {
  const item = object(value, field);
  const provider = item.provider;
  const providerKeys = provider === 'supabase' ? ['project','relation']
    : provider === 'google-sheets' ? ['spreadsheetId','range','approvedClientAliasHash','valueRenderOption','dateTimeRenderOption']
      : provider === 'clickup' ? ['endpointFamily','permitsTasks','allowedListIds'] : null;
  if (!providerKeys) throw new Error(`${field}.provider is invalid`);
  exact(item, ['sourceKey','provider','requestFingerprint','permittedFactFields','freshnessPolicy',...providerKeys], field);
  const fingerprint = text(item.requestFingerprint, `${field}.requestFingerprint`, 64);
  if (!SHA256.test(fingerprint)) throw new Error(`${field}.requestFingerprint must be lowercase SHA-256`);
  const permittedFactFields = strings(item.permittedFactFields, `${field}.permittedFactFields`) as SourceValueField[];
  if (permittedFactFields.some((fact) => !FACT_FIELDS.includes(fact))) throw new Error(`${field}.permittedFactFields contains an invalid field`);
  const policy = object(item.freshnessPolicy, `${field}.freshnessPolicy`);
  exact(policy, ['maximumLagDays'], `${field}.freshnessPolicy`);
  const base = { sourceKey: key(item.sourceKey, `${field}.sourceKey`), requestFingerprint: fingerprint, permittedFactFields,
    freshnessPolicy: { maximumLagDays: boundedNumber(policy.maximumLagDays, `${field}.freshnessPolicy.maximumLagDays`, 365) } };
  if (provider === 'supabase') {
    if (item.project !== 'eic' && item.project !== 'prepass') throw new Error(`${field}.project is invalid`);
    return { ...base, provider, project: item.project, relation: key(item.relation, `${field}.relation`) };
  }
  if (provider === 'google-sheets') {
    if (item.valueRenderOption !== 'UNFORMATTED_VALUE' || item.dateTimeRenderOption !== 'FORMATTED_STRING') throw new Error(`${field} render options are invalid`);
    const aliasHash = text(item.approvedClientAliasHash, `${field}.approvedClientAliasHash`, 64);
    if (!SHA256.test(aliasHash)) throw new Error(`${field}.approvedClientAliasHash must be lowercase SHA-256`);
    return { ...base, provider, spreadsheetId: text(item.spreadsheetId, `${field}.spreadsheetId`), range: text(item.range, `${field}.range`, 512), approvedClientAliasHash: aliasHash,
      valueRenderOption: item.valueRenderOption, dateTimeRenderOption: item.dateTimeRenderOption };
  }
  if (item.endpointFamily !== 'team-time-entries-and-overdue-tasks' || typeof item.permitsTasks !== 'boolean') throw new Error(`${field} ClickUp authorization is invalid`);
  return { ...base, provider: 'clickup', endpointFamily: item.endpointFamily, permitsTasks: item.permitsTasks, allowedListIds: strings(item.allowedListIds, `${field}.allowedListIds`) };
}

export function normalizeConfigRevisionContent(value: unknown): ApprovedConfigRevision {
  const root = object(value, 'revision');
  exact(root, ['schemaVersion','calculationVersion','sourceContractVersion','clients'], 'revision');
  if (root.schemaVersion !== 2) throw new Error('revision.schemaVersion must be 2');
  if (!Array.isArray(root.clients) || root.clients.length < 1 || root.clients.length > 100) throw new Error('revision.clients must contain between 1 and 100 entries');
  const clients = root.clients.map((raw, index): ApprovedConfigRevisionClient => {
    const item = object(raw, `revision.clients[${index}]`);
    exact(item, ['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','fixedValues','metrics','sources'], `revision.clients[${index}]`);
    const normalizedDisplay = display(item, `revision.clients[${index}]`);
    const normalizedFixedValues = fixedValues(item.fixedValues, `revision.clients[${index}].fixedValues`);
    if (!Array.isArray(item.metrics) || !Array.isArray(item.sources)) throw new Error(`revision.clients[${index}] metrics and sources must be arrays`);
    if (normalizedDisplay.configStatus === 'configuration_required') {
      if (item.metrics.length !== 0 || item.sources.length !== 0) throw new Error(`revision.clients[${index}] configuration-required clients cannot have metrics or sources`);
      if (normalizedFixedValues.monthlyBudget !== null || normalizedFixedValues.monthlyHoursAllotment !== null) throw new Error(`revision.clients[${index}] configuration-required clients must have null fixed values`);
      return { ...normalizedDisplay, fixedValues: normalizedFixedValues, metrics: [], sources: [] };
    }
    const metrics = item.metrics.map((entry, metricIndex) => metric(entry, `revision.clients[${index}].metrics[${metricIndex}]`)).sort((a,b)=>compare(a.key,b.key));
    if (metrics.length !== METRICS.length || canonicalEvidenceJson(metrics.map(({key:keyValue})=>keyValue).sort(compare)) !== canonicalEvidenceJson([...METRICS].sort(compare))) throw new Error(`revision.clients[${index}] must contain the exact five metrics`);
    const sources = item.sources.map((entry, sourceIndex) => source(entry, `revision.clients[${index}].sources[${sourceIndex}]`)).sort((a,b)=>compare(a.sourceKey,b.sourceKey));
    const sourceKeys = sources.map(({sourceKey})=>sourceKey);
    if (sources.length === 0 || new Set(sourceKeys).size !== sourceKeys.length) throw new Error(`revision.clients[${index}] sources must be nonempty and unique`);
    const taskEnabledListIds = sources.flatMap((entry) => entry.provider === 'clickup' && entry.permitsTasks ? entry.allowedListIds : []);
    if (new Set(taskEnabledListIds).size !== taskEnabledListIds.length) throw new Error(`revision.clients[${index}] ClickUp allowedListIds must be unique across task-enabled sources`);
    if (metrics.some((entry) => entry.sourceKeys.length === 0 || entry.sourceKeys.some((sourceKey) => !sourceKeys.includes(sourceKey)))) throw new Error(`revision.clients[${index}] metric sourceKeys must reference configured sources`);
    return { ...normalizedDisplay, fixedValues: normalizedFixedValues, metrics, sources };
  }).sort((a,b)=>compare(a.clientId,b.clientId));
  if (new Set(clients.map(({clientId})=>clientId)).size !== clients.length || new Set(clients.map(({clientKey})=>clientKey)).size !== clients.length) throw new Error('revision contains duplicate client identity');
  return { schemaVersion: 2, calculationVersion: key(root.calculationVersion, 'revision.calculationVersion'), sourceContractVersion: key(root.sourceContractVersion, 'revision.sourceContractVersion'), clients };
}

export function buildApprovedConfigRevision(content: unknown): NormalizedConfigRevision {
  const normalized = normalizeConfigRevisionContent(content);
  const hash = canonicalEvidenceHash(normalized);
  return { id: revisionUuid(hash), hash, content: normalized };
}
export const buildConfigRevision = buildApprovedConfigRevision;

export function normalizeActiveConfigRevision(value: unknown): ActiveConfigRevision {
  const root = object(value, 'activeConfigRevision');
  exact(root, ['revision','activation'], 'activeConfigRevision');
  const supplied = object(root.revision, 'activeConfigRevision.revision');
  exact(supplied, ['id','hash','content'], 'activeConfigRevision.revision');
  const revision = buildApprovedConfigRevision(supplied.content);
  if (supplied.id !== revision.id || supplied.hash !== revision.hash) throw new Error('active configuration revision identity does not match its content');
  const raw = object(root.activation, 'activeConfigRevision.activation');
  exact(raw, ['revisionId','revisionHash','activationId','reviewedCommitSha','operatorIdentity','reason','activatedAt'], 'activeConfigRevision.activation');
  const activation: ConfigRevisionActivationReceipt = {
    revisionId: uuid(raw.revisionId, 'activation.revisionId'), revisionHash: text(raw.revisionHash, 'activation.revisionHash', 64),
    activationId: uuid(raw.activationId, 'activation.activationId'), reviewedCommitSha: text(raw.reviewedCommitSha, 'activation.reviewedCommitSha', 40),
    operatorIdentity: text(raw.operatorIdentity, 'activation.operatorIdentity'), reason: text(raw.reason, 'activation.reason', 1024), activatedAt: timestamp(raw.activatedAt, 'activation.activatedAt'),
  };
  if (!SHA256.test(activation.revisionHash) || !COMMIT_SHA.test(activation.reviewedCommitSha)) throw new Error('activation receipt hashes are invalid');
  if (activation.revisionId !== revision.id || activation.revisionHash !== revision.hash) throw new Error('activation receipt does not match active revision');
  return { revision, activation };
}
