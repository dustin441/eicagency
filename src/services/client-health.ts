import 'server-only';

import {
  createEicClientHealthRepository,
  type ClientHealthDirection,
  type ClientHealthLatestRecord,
  type ClientHealthMetricConfig,
  type ClientHealthOverallStatus,
  type ClientHealthSourceFreshness,
} from './client-health/repository.ts';

const SNAPSHOT_DIMENSION_KEYS = [
  'budget_pacing',
  'north_star',
  'hours',
  'overdue_tasks',
  'margin',
] as const;

const PRESENTATION_DIMENSION_KEYS = {
  budget_pacing: 'budgetPacing',
  north_star: 'northStarCost',
  hours: 'hoursPacing',
  overdue_tasks: 'overdueTasks',
  margin: 'margin',
} as const;

const DIMENSION_LABELS: Record<SnapshotDimensionKey, string> = {
  budget_pacing: 'Budget pacing',
  north_star: 'North-star cost',
  hours: 'Hours pacing',
  overdue_tasks: 'Overdue tasks',
  margin: 'Margin',
};

type SnapshotDimensionKey = typeof SNAPSHOT_DIMENSION_KEYS[number];
export type ClientHealthDimensionStatus = ClientHealthOverallStatus | 'unavailable';

export type ClientHealthDimensionConfig = {
  label: string;
  adapterKey: string;
  required: boolean;
  weight: number;
  direction: ClientHealthDirection;
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};

export type ClientHealthDimension = {
  label: string;
  status: ClientHealthDimensionStatus;
  value: number | null;
  reason: string;
  config: ClientHealthDimensionConfig | null;
};

export type ClientHealthRow = {
  id: string;
  clientKey: string;
  name: string;
  dashboardHref: string | null;
  status: ClientHealthOverallStatus;
  score: number | null;
  reasons: string[];
  dimensions: {
    budgetPacing: ClientHealthDimension;
    northStarCost: ClientHealthDimension;
    hoursPacing: ClientHealthDimension;
    overdueTasks: ClientHealthDimension;
    margin: ClientHealthDimension;
  };
  values: ClientHealthLatestRecord['metrics'];
  timestamps: {
    snapshotDate: string;
    currentWindowStart: string | null;
    currentWindowEnd: string | null;
    priorWindowStart: string | null;
    priorWindowEnd: string | null;
    dataThrough: string | null;
    calculatedAt: string;
  };
  sourceFreshness: Array<ClientHealthSourceFreshness & { key: string }>;
  tasks: Array<{
    id: string;
    listId: string;
    name: string;
    href: string | null;
    dueAt: string | null;
    rank: number;
  }>;
  configRevision: ClientHealthLatestRecord['configRevision'];
  versions: ClientHealthLatestRecord['versions'];
};

export type ClientHealthCounts = {
  healthy: number;
  watch: number;
  atRisk: number;
  incomplete: number;
  configurationRequired: number;
};

export type ClientHealthDashboardData = {
  state: 'ready' | 'no_published_snapshots';
  rows: ClientHealthRow[];
  counts: ClientHealthCounts;
};

export type ClientHealthDashboardRepository = Pick<
  ReturnType<typeof createEicClientHealthRepository>,
  'readLatest'
>;

export function clientHealthSourcePresentationStatus(
  source: ClientHealthSourceFreshness,
): ClientHealthDimensionStatus {
  if (source.status === 'unavailable') return 'unavailable';
  if (source.status === 'succeeded') return source.stale === true ? 'watch' : 'healthy';
  if (source.status === 'partial') return 'watch';
  return 'incomplete';
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Client health ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Client health ${field} must be a finite number`);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, field: string): number | null {
  return value === null ? null : finiteNumber(value, field);
}

function sameKeySet(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function configByKey(
  configs: ClientHealthMetricConfig[],
  overallStatus: ClientHealthOverallStatus,
): Map<SnapshotDimensionKey, ClientHealthMetricConfig> {
  if (overallStatus === 'configuration_required' && configs.length === 0) {
    return new Map<SnapshotDimensionKey, ClientHealthMetricConfig>();
  }
  if (!Array.isArray(configs) || configs.length !== SNAPSHOT_DIMENSION_KEYS.length) {
    throw new Error('Client health snapshot must contain exactly five metric configurations');
  }
  const result = new Map<SnapshotDimensionKey, ClientHealthMetricConfig>();
  for (const config of configs) {
    if (!config || typeof config !== 'object' || !SNAPSHOT_DIMENSION_KEYS.includes(config.key)) {
      throw new Error('Client health snapshot has an invalid metric configuration');
    }
    if (result.has(config.key)) throw new Error(`Client health snapshot has duplicate metric configuration ${config.key}`);
    if (
      typeof config.label !== 'string' || config.label.trim() === ''
      || typeof config.adapterKey !== 'string' || config.adapterKey.trim() === ''
      || typeof config.required !== 'boolean'
      || !Number.isFinite(config.weight)
      || !Number.isFinite(config.greenThreshold)
      || !Number.isFinite(config.yellowThreshold)
      || !Array.isArray(config.sourceKeys)
      || config.sourceKeys.some((source) => typeof source !== 'string' || source.trim() === '')
      || !['lower_is_better', 'higher_is_better'].includes(config.direction)
    ) {
      throw new Error(`Client health snapshot has an invalid metric configuration ${config.key}`);
    }
    result.set(config.key, config);
  }
  if (result.size !== SNAPSHOT_DIMENSION_KEYS.length) {
    throw new Error('Client health snapshot must contain exactly five metric configurations');
  }
  return result;
}

function mapDimensions(
  rawDimensions: ClientHealthLatestRecord['dimensionStatuses'],
  configs: ClientHealthMetricConfig[],
  overallStatus: ClientHealthOverallStatus,
): ClientHealthRow['dimensions'] {
  const dimensions = object(rawDimensions, 'dimension statuses');
  if (!sameKeySet(dimensions, SNAPSHOT_DIMENSION_KEYS)) {
    throw new Error('Client health snapshot must contain exactly five dimensions');
  }
  const configsByKey = configByKey(configs, overallStatus);
  const mapped: Partial<ClientHealthRow['dimensions']> = {};

  for (const key of SNAPSHOT_DIMENSION_KEYS) {
    const raw = object(dimensions[key], `dimension ${key}`);
    if (!sameKeySet(raw, ['status', 'value', 'reason', 'required', 'weight'])) {
      throw new Error(`Client health dimension ${key} must contain status, value, reason, required, and weight`);
    }
    if (!['healthy', 'watch', 'at_risk', 'incomplete', 'unavailable', 'configuration_required'].includes(String(raw.status))) {
      throw new Error(`Client health dimension ${key} status is invalid`);
    }
    const value = nullableFiniteNumber(raw.value, `dimension ${key} value`);
    if (typeof raw.reason !== 'string' || raw.reason.trim() === '') {
      throw new Error(`Client health dimension ${key} reason is invalid`);
    }
    if (typeof raw.required !== 'boolean') throw new Error(`Client health dimension ${key} required is invalid`);
    const weight = finiteNumber(raw.weight, `dimension ${key} weight`);
    const config = configsByKey.get(key);
    if (overallStatus === 'configuration_required') {
      if (raw.status !== 'configuration_required' || value !== null || raw.required !== true || weight !== 0) {
        throw new Error(`Client health unconfigured dimension ${key} is malformed`);
      }
    } else if (!config || raw.required !== config.required || weight !== config.weight) {
      throw new Error(`Client health dimension ${key} does not match its immutable configuration`);
    }
    mapped[PRESENTATION_DIMENSION_KEYS[key]] = {
      label: config?.label ?? DIMENSION_LABELS[key],
      status: raw.status as ClientHealthDimensionStatus,
      value,
      reason: raw.reason,
      config: config ? {
        label: config.label,
        adapterKey: config.adapterKey,
        required: config.required,
        weight: config.weight,
        direction: config.direction,
        greenThreshold: config.greenThreshold,
        yellowThreshold: config.yellowThreshold,
        sourceKeys: [...config.sourceKeys],
      } : null,
    };
  }

  return mapped as ClientHealthRow['dimensions'];
}

function validateScore(record: ClientHealthLatestRecord): void {
  if (record.status === 'incomplete' || record.status === 'configuration_required') {
    if (record.score !== null) throw new Error(`Client health ${record.status} score must be null`);
    return;
  }
  const score = finiteNumber(record.score, `${record.status} score`);
  if (score < 0 || score > 100) throw new Error(`Client health ${record.status} score must be between 0 and 100`);
}

function validateOverallConsistency(
  status: ClientHealthOverallStatus,
  dimensions: ClientHealthRow['dimensions'],
): void {
  const values = Object.values(dimensions);
  const blockedRequired = values.some((dimension) => dimension.config?.required === true
    && ['incomplete', 'configuration_required', 'unavailable'].includes(dimension.status));
  if (['healthy', 'watch', 'at_risk'].includes(status) && blockedRequired) {
    throw new Error(`Client health ${status} snapshot contains an unscoreable required dimension`);
  }
  if (status === 'incomplete' && !blockedRequired) {
    throw new Error('Client health incomplete snapshot must contain an unscoreable required dimension');
  }
  if (status === 'configuration_required' && values.some((dimension) => dimension.status !== 'configuration_required' || dimension.config !== null)) {
    throw new Error('Client health configuration_required snapshot has contradictory dimension state');
  }
}

function mapRecord(record: ClientHealthLatestRecord): ClientHealthRow {
  validateScore(record);
  const dimensions = mapDimensions(record.dimensionStatuses, record.metricConfig, record.status);
  validateOverallConsistency(record.status, dimensions);
  return {
    id: record.snapshotId,
    clientKey: record.client.key,
    name: record.client.name,
    dashboardHref: record.client.dashboardHref,
    status: record.status,
    score: record.score,
    reasons: [...record.reasons],
    dimensions,
    values: { ...record.metrics },
    timestamps: {
      snapshotDate: record.snapshotDate,
      currentWindowStart: record.metrics.currentWindowStart,
      currentWindowEnd: record.metrics.currentWindowEnd,
      priorWindowStart: record.metrics.previousWindowStart,
      priorWindowEnd: record.metrics.previousWindowEnd,
      dataThrough: record.freshness.dataThrough,
      calculatedAt: record.calculatedAt,
    },
    sourceFreshness: Object.entries(record.freshness.sources)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, freshness]) => ({ key, ...freshness })),
    tasks: record.tasks.map((task) => ({
      id: task.id,
      listId: task.listId,
      name: task.name,
      href: task.url || null,
      dueAt: task.dueAt,
      rank: task.rank,
    })),
    configRevision: { ...record.configRevision },
    versions: { ...record.versions },
  };
}

const EMPTY_COUNTS: ClientHealthCounts = {
  healthy: 0,
  watch: 0,
  atRisk: 0,
  incomplete: 0,
  configurationRequired: 0,
};

export async function buildClientHealthDashboard(
  repository: ClientHealthDashboardRepository,
): Promise<ClientHealthDashboardData> {
  const latest = await repository.readLatest();
  const records = latest.filter((record) => record.client.key.toLowerCase() !== 'canary');
  if (records.length === 0) {
    return { state: 'no_published_snapshots', rows: [], counts: { ...EMPTY_COUNTS } };
  }
  const rows = records.map(mapRecord);
  return {
    state: 'ready',
    rows,
    counts: {
      healthy: rows.filter(({ status }) => status === 'healthy').length,
      watch: rows.filter(({ status }) => status === 'watch').length,
      atRisk: rows.filter(({ status }) => status === 'at_risk').length,
      incomplete: rows.filter(({ status }) => status === 'incomplete').length,
      configurationRequired: rows.filter(({ status }) => status === 'configuration_required').length,
    },
  };
}

export async function fetchClientHealthDashboard(): Promise<ClientHealthDashboardData> {
  return buildClientHealthDashboard(createEicClientHealthRepository());
}
