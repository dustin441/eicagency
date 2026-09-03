import { canonicalEvidenceHash, canonicalEvidenceJson } from './evidence.ts';
import type { SourceValueField } from './build-snapshot.ts';
import type { SupabaseProject } from './adapters/types.ts';
import type { ClientHealthDirection, ClientHealthMetricKey } from './repository.ts';
import { calculateMonthlyAllottedHours, resolveFulfillmentHourlyCost, type DeliveryModel } from './economics.ts';
import { normalizeNorthStarLanes, type NorthStarLane } from './north-star-lanes.ts';

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
export type ConfigRevisionV2FixedValues = {
  monthlyBudget: number | null;
  monthlyHoursAllotment: number | null;
};
/** @deprecated v2-only alias retained for existing consumers. */
export type ConfigRevisionFixedValues = ConfigRevisionV2FixedValues;
export type ConfigRevisionV3FixedValues = { monthlyBudget: number | null };
export type ConfigRevisionEconomics = {
  effectiveMonth: string;
  monthlyRetainer: number | null;
  deliveryModel: DeliveryModel;
  fulfillmentHourlyCost: number;
  targetMarginPercent: number;
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
type ApprovedConfigRevisionClientBase = ConfigRevisionClientDisplay & {
  metrics: ConfigRevisionMetric[];
  sources: ConfigRevisionSourceBinding[];
};
export type ApprovedConfigRevisionV2Client = ApprovedConfigRevisionClientBase & { fixedValues: ConfigRevisionV2FixedValues };
export type ApprovedConfigRevisionV3Client = ApprovedConfigRevisionClientBase & {
  economics: ConfigRevisionEconomics;
  fixedValues: ConfigRevisionV3FixedValues;
  northStarLanes: NorthStarLane[];
};
export type ApprovedConfigRevisionClient = ApprovedConfigRevisionV2Client | ApprovedConfigRevisionV3Client;
export type ApprovedConfigRevisionV2 = {
  schemaVersion: 2;
  calculationVersion: string;
  sourceContractVersion: string;
  clients: ApprovedConfigRevisionV2Client[];
};
export type ApprovedConfigRevisionV3 = {
  schemaVersion: 3;
  calculationVersion: string;
  sourceContractVersion: string;
  clients: ApprovedConfigRevisionV3Client[];
};
export type ApprovedConfigRevision = ApprovedConfigRevisionV2 | ApprovedConfigRevisionV3;
export type NormalizedConfigRevision = { id: string; hash: string; content: ApprovedConfigRevision };
export type V3ClientEconomicsProjection = {
  fixedValues: { monthlyBudget: number | null; monthlyHoursAllotment: number | null };
  /** Revenue and rate are durable inputs. Usage-dependent fulfillmentCost is intentionally absent. */
  economicsInputs: {
    effectiveMonth: string;
    revenue: number | null;
    deliveryModel: DeliveryModel;
    fulfillmentHourlyCost: number;
    targetMarginPercent: number;
  };
};
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
function v2FixedValues(value: unknown, field: string): ConfigRevisionV2FixedValues {
  const item = object(value, field);
  exact(item, ['monthlyBudget','monthlyHoursAllotment'], field);
  return {
    monthlyBudget: item.monthlyBudget === null ? null : boundedNumber(item.monthlyBudget, `${field}.monthlyBudget`),
    monthlyHoursAllotment: item.monthlyHoursAllotment === null ? null : boundedNumber(item.monthlyHoursAllotment, `${field}.monthlyHoursAllotment`),
  };
}
function v3FixedValues(value: unknown, field: string): ConfigRevisionV3FixedValues {
  const item = object(value, field);
  exact(item, ['monthlyBudget'], field);
  return { monthlyBudget: item.monthlyBudget === null ? null : boundedNumber(item.monthlyBudget, `${field}.monthlyBudget`) };
}
function effectiveMonth(value: unknown, field: string): string {
  const result = text(value, field, 10);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00.000Z`))) {
    throw new Error(`${field} must be the canonical first day of a month`);
  }
  return result;
}
function economics(value: unknown, field: string): ConfigRevisionEconomics {
  const item = object(value, field);
  exact(item, ['effectiveMonth','monthlyRetainer','deliveryModel','fulfillmentHourlyCost','targetMarginPercent'], field);
  const deliveryModel = item.deliveryModel as DeliveryModel;
  const fulfillmentHourlyCost = resolveFulfillmentHourlyCost(deliveryModel, item.fulfillmentHourlyCost as number);
  calculateMonthlyAllottedHours({
    monthlyRetainer: item.monthlyRetainer as number | null,
    fulfillmentHourlyCost,
    targetMarginPercent: item.targetMarginPercent as number,
  });
  return {
    effectiveMonth: effectiveMonth(item.effectiveMonth, `${field}.effectiveMonth`),
    monthlyRetainer: item.monthlyRetainer === null ? null : (Object.is(item.monthlyRetainer, -0) ? 0 : item.monthlyRetainer as number),
    deliveryModel,
    fulfillmentHourlyCost,
    targetMarginPercent: Object.is(item.targetMarginPercent, -0) ? 0 : item.targetMarginPercent as number,
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

function normalizeClientContract(
  item: Record<string, unknown>,
  field: string,
  normalizedDisplay: ConfigRevisionClientDisplay,
  configurationInputsAreNull: boolean,
): { metrics: ConfigRevisionMetric[]; sources: ConfigRevisionSourceBinding[] } {
  if (!Array.isArray(item.metrics) || !Array.isArray(item.sources)) throw new Error(`${field} metrics and sources must be arrays`);
  if (normalizedDisplay.configStatus === 'configuration_required') {
    if (item.metrics.length !== 0 || item.sources.length !== 0) throw new Error(`${field} configuration-required clients cannot have metrics or sources`);
    if (!configurationInputsAreNull) throw new Error(`${field} configuration-required clients must have null configuration values`);
    return { metrics: [], sources: [] };
  }
  const metrics = item.metrics.map((entry, metricIndex) => metric(entry, `${field}.metrics[${metricIndex}]`)).sort((a,b)=>compare(a.key,b.key));
  if (metrics.length !== METRICS.length || canonicalEvidenceJson(metrics.map(({key:keyValue})=>keyValue).sort(compare)) !== canonicalEvidenceJson([...METRICS].sort(compare))) throw new Error(`${field} must contain the exact five metrics`);
  const sources = item.sources.map((entry, sourceIndex) => source(entry, `${field}.sources[${sourceIndex}]`)).sort((a,b)=>compare(a.sourceKey,b.sourceKey));
  const sourceKeys = sources.map(({sourceKey})=>sourceKey);
  if (sources.length === 0 || new Set(sourceKeys).size !== sourceKeys.length) throw new Error(`${field} sources must be nonempty and unique`);
  const taskEnabledListIds = sources.flatMap((entry) => entry.provider === 'clickup' && entry.permitsTasks ? entry.allowedListIds : []);
  if (new Set(taskEnabledListIds).size !== taskEnabledListIds.length) throw new Error(`${field} ClickUp allowedListIds must be unique across task-enabled sources`);
  if (metrics.some((entry) => entry.sourceKeys.length === 0 || entry.sourceKeys.some((sourceKey) => !sourceKeys.includes(sourceKey)))) throw new Error(`${field} metric sourceKeys must reference configured sources`);
  return { metrics, sources };
}

function uniqueSortedClients<T extends ConfigRevisionClientDisplay>(clients: T[]): T[] {
  clients.sort((a,b)=>compare(a.clientId,b.clientId));
  if (new Set(clients.map(({clientId})=>clientId)).size !== clients.length || new Set(clients.map(({clientKey})=>clientKey)).size !== clients.length) throw new Error('revision contains duplicate client identity');
  return clients;
}

export function normalizeConfigRevisionContent(value: unknown): ApprovedConfigRevision {
  const root = object(value, 'revision');
  exact(root, ['schemaVersion','calculationVersion','sourceContractVersion','clients'], 'revision');
  if (root.schemaVersion !== 2 && root.schemaVersion !== 3) throw new Error('revision.schemaVersion must be 2 or 3');
  if (!Array.isArray(root.clients) || root.clients.length < 1 || root.clients.length > 100) throw new Error('revision.clients must contain between 1 and 100 entries');
  const calculationVersion = key(root.calculationVersion, 'revision.calculationVersion');
  const sourceContractVersion = key(root.sourceContractVersion, 'revision.sourceContractVersion');
  if (root.schemaVersion === 2) {
    const clients = root.clients.map((raw, index): ApprovedConfigRevisionV2Client => {
      const field = `revision.clients[${index}]`; const item = object(raw, field);
      exact(item, ['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','fixedValues','metrics','sources'], field);
      const normalizedDisplay = display(item, field); const normalizedFixedValues = v2FixedValues(item.fixedValues, `${field}.fixedValues`);
      const contract = normalizeClientContract(item, field, normalizedDisplay, normalizedFixedValues.monthlyBudget === null && normalizedFixedValues.monthlyHoursAllotment === null);
      return { ...normalizedDisplay, fixedValues: normalizedFixedValues, ...contract };
    });
    return { schemaVersion: 2, calculationVersion, sourceContractVersion, clients: uniqueSortedClients(clients) };
  }
  const clients = root.clients.map((raw, index): ApprovedConfigRevisionV3Client => {
    const field = `revision.clients[${index}]`; const item = object(raw, field);
    exact(item, ['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','economics','fixedValues','northStarLanes','metrics','sources'], field);
    const normalizedDisplay = display(item, field); const normalizedEconomics = economics(item.economics, `${field}.economics`);
    const normalizedFixedValues = v3FixedValues(item.fixedValues, `${field}.fixedValues`);
    // V3 economics are independently useful and auditable even while the
    // performance contract remains configuration-required.
    const contract = normalizeClientContract(item, field, normalizedDisplay, true);
    if (normalizedDisplay.configStatus === 'configuration_required') {
      if (!Array.isArray(item.northStarLanes) || item.northStarLanes.length !== 0) throw new Error(`${field} configuration-required clients cannot have North Star lanes`);
      return { ...normalizedDisplay, economics: normalizedEconomics, fixedValues: normalizedFixedValues, northStarLanes: [], ...contract };
    }
    const northStarLanes = normalizeNorthStarLanes(item.northStarLanes as NorthStarLane[]);
    const configuredSources = new Map(contract.sources.map((binding) => [binding.sourceKey, binding]));
    for (const lane of northStarLanes) {
      for (const sourceKey of lane.sourceKeys) {
        const binding = configuredSources.get(sourceKey);
        if (!binding) throw new Error(`${field}.northStarLanes must reference configured sources`);
        if (!binding.permittedFactFields.includes('currentRows')) throw new Error(`${field}.${lane.key} source must permit currentRows`);
        if (lane.evaluation === 'period_over_period_change' && !binding.permittedFactFields.includes('previousRows')) throw new Error(`${field}.${lane.key} source must permit previousRows`);
      }
    }
    const laneSourceKeys = [...new Set(northStarLanes.flatMap((lane) => lane.sourceKeys))].sort(compare);
    const northStarMetric = contract.metrics.find((entry) => entry.key === 'north_star');
    if (!northStarMetric || canonicalEvidenceJson(northStarMetric.sourceKeys) !== canonicalEvidenceJson(laneSourceKeys)) {
      throw new Error(`${field} north_star metric sourceKeys must equal the North Star lane source union`);
    }
    return { ...normalizedDisplay, economics: normalizedEconomics, fixedValues: normalizedFixedValues, northStarLanes, ...contract };
  });
  return { schemaVersion: 3, calculationVersion, sourceContractVersion, clients: uniqueSortedClients(clients) };
}

/** Pure projection from durable v3 economics; usage-dependent cost awaits collector-provided hoursUsed. */
export function projectV3ClientEconomics(client: ApprovedConfigRevisionV3Client): V3ClientEconomicsProjection {
  const { economics: durable } = client;
  return {
    fixedValues: {
      monthlyBudget: client.fixedValues.monthlyBudget,
      monthlyHoursAllotment: calculateMonthlyAllottedHours(durable),
    },
    economicsInputs: {
      effectiveMonth: durable.effectiveMonth,
      revenue: durable.monthlyRetainer,
      deliveryModel: durable.deliveryModel,
      fulfillmentHourlyCost: durable.fulfillmentHourlyCost,
      targetMarginPercent: durable.targetMarginPercent,
    },
  };
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
