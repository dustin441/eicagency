import { assertDateOnly, comparisonWindows, phoenixMonthWindow } from './date-windows.ts';
import { canonicalEvidenceHash } from './evidence.ts';
import Decimal from 'decimal.js-light';

// A finite binary64 canonical decimal can reach from 10^308 down to 10^-324.
// A JavaScript array has fewer than 10^10 entries, so summing nonnegative source
// rows can add at most ten leading places. The exact aggregate therefore spans at
// most 308 + 10 - (-324) + 1 = 643 significant decimal places. Keeping 650
// prevents an addend from being rounded away before decimalToNumber rejects a
// total that cannot round-trip through the number-based snapshot schema.
const HealthDecimal = Decimal.clone({ precision: 650, rounding: Decimal.ROUND_HALF_UP });
type HealthDecimal = InstanceType<typeof HealthDecimal>;

export const CLIENT_HEALTH_METRIC_KEYS = [
  'budget_pacing',
  'north_star',
  'hours',
  'overdue_tasks',
  'margin',
] as const;

export type ClientHealthMetricKey = typeof CLIENT_HEALTH_METRIC_KEYS[number];
export type MetricDirection = 'lower_is_better' | 'higher_is_better';
export type DimensionStatus = 'healthy' | 'watch' | 'at_risk' | 'incomplete' | 'unavailable' | 'configuration_required';
export type OverallStatus = 'healthy' | 'watch' | 'at_risk' | 'incomplete' | 'configuration_required';
export type EngineSourceStatus = 'succeeded' | 'partial' | 'failed' | 'missing';

export type EngineMetricConfig = {
  key: ClientHealthMetricKey;
  required: boolean;
  weight: number;
  direction: MetricDirection;
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};

export type EngineSourceInput = {
  key: string;
  status: EngineSourceStatus;
  dataThrough: string | null;
  stale: boolean;
  rowCount: number | null;
};

export type RatioRow = { spend: number; results: number };

export type ClientHealthValueInputs = {
  budget: number | null;
  monthSpend: number | null;
  currentRows: RatioRow[] | null;
  previousRows: RatioRow[] | null;
  hoursUsed: number | null;
  hoursAllotted: number | null;
  overdueTaskCount: number | null;
  revenue: number | null;
  fulfillmentCost: number | null;
};

export type ClientHealthEngineInput = {
  clientKey: string;
  configApproved: boolean;
  lastCompleteSourceDate: string;
  calculationVersion: string;
  metricConfig: EngineMetricConfig[];
  sources: EngineSourceInput[];
  values: ClientHealthValueInputs;
};

export type DimensionResult = {
  status: DimensionStatus;
  value: number | null;
  reason: string;
  required: boolean;
  weight: number;
};

export type SnapshotValues = {
  budget: number | null;
  monthSpend: number | null;
  expectedSpend: number | null;
  elapsedMonthFraction: number | null;
  budgetPacingVariancePercent: number | null;
  currentSpend: number | null;
  currentResultCount: number | null;
  currentCostPerResult: number | null;
  previousSpend: number | null;
  previousResultCount: number | null;
  previousCostPerResult: number | null;
  northStarChangePercent: number | null;
  hoursUsed: number | null;
  hoursAllotted: number | null;
  projectedHours: number | null;
  projectedHoursPercent: number | null;
  overdueTaskCount: number | null;
  revenue: number | null;
  fulfillmentCost: number | null;
  marginPercent: number | null;
};

export type NormalizedSourceStatus = {
  status: EngineSourceStatus;
  dataThrough: string | null;
  stale: boolean;
  rowCount: number | null;
};

export type ClientHealthSnapshot = {
  clientKey: string;
  status: OverallStatus;
  score: number | null;
  reasons: string[];
  dataThrough: string | null;
  windows: {
    month: ReturnType<typeof phoenixMonthWindow>;
    comparison: ReturnType<typeof comparisonWindows>;
  };
  values: SnapshotValues;
  sources: Record<string, NormalizedSourceStatus>;
  dimensions: Record<ClientHealthMetricKey, DimensionResult>;
  calculationVersion: string;
  evidenceHash: string;
};

const DIMENSION_LABELS: Record<ClientHealthMetricKey, string> = {
  budget_pacing: 'Budget pacing',
  north_star: 'North-star trend',
  hours: 'Hours utilization',
  overdue_tasks: 'Overdue tasks',
  margin: 'Margin',
};

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
  return Object.is(value, -0) ? 0 : value;
}

function nonnegative(value: unknown, field: string): number {
  const number = finite(value, field);
  if (number < 0) throw new Error(`${field} must be nonnegative`);
  return number;
}

function nullableNonnegative(value: unknown, field: string): number | null {
  return value === null ? null : nonnegative(value, field);
}

function decimal(value: number): HealthDecimal {
  // Decimal's number constructor uses the source number's canonical decimal string,
  // avoiding binary floating-point artifacts while preserving source precision.
  return new HealthDecimal(value);
}

function decimalToNumber(value: HealthDecimal, field: string, exact = false): number {
  const result = value.toNumber();
  if (!Number.isFinite(result)) throw new Error(`${field} must be finite`);
  if (!value.isZero() && result === 0) throw new Error(`${field} must be safely representable as a number`);
  if (exact && !decimal(result).eq(value)) {
    throw new Error(`${field} must be safely representable as a number`);
  }
  return Object.is(result, -0) ? 0 : result;
}

function validateConfig(configs: EngineMetricConfig[]): Map<ClientHealthMetricKey, EngineMetricConfig> {
  if (!Array.isArray(configs)) throw new Error('metricConfig must be an array');
  const configByKey = new Map<ClientHealthMetricKey, EngineMetricConfig>();
  for (const [index, config] of configs.entries()) {
    if (!config || typeof config !== 'object') throw new Error(`metricConfig[${index}] is malformed`);
    if (!CLIENT_HEALTH_METRIC_KEYS.includes(config.key)) throw new Error(`metricConfig[${index}] has an invalid metric key`);
    if (configByKey.has(config.key)) throw new Error(`Duplicate metric key: ${config.key}`);
    if (typeof config.required !== 'boolean') throw new Error(`${config.key} required must be boolean`);
    const weight = finite(config.weight, `${config.key} weight`);
    if (weight <= 0) throw new Error(`${config.key} weight must be greater than zero`);
    const greenThreshold = finite(config.greenThreshold, `${config.key} green threshold`);
    const yellowThreshold = finite(config.yellowThreshold, `${config.key} yellow threshold`);
    if (config.direction !== 'lower_is_better' && config.direction !== 'higher_is_better') {
      throw new Error(`${config.key} has an invalid direction`);
    }
    if (
      (config.direction === 'lower_is_better' && greenThreshold > yellowThreshold)
      || (config.direction === 'higher_is_better' && greenThreshold < yellowThreshold)
    ) {
      throw new Error(`${config.key} thresholds are invalid for ${config.direction}`);
    }
    if (!Array.isArray(config.sourceKeys) || config.sourceKeys.length === 0) {
      throw new Error(`${config.key} sourceKeys must contain at least one source`);
    }
    const sourceKeys = config.sourceKeys.map((sourceKey) => {
      if (typeof sourceKey !== 'string' || sourceKey.trim() === '') throw new Error(`${config.key} has an invalid source key`);
      return sourceKey;
    });
    if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error(`${config.key} has duplicate source keys`);
    configByKey.set(config.key, {
      key: config.key,
      required: config.required,
      weight,
      direction: config.direction,
      greenThreshold,
      yellowThreshold,
      sourceKeys: [...sourceKeys].sort(),
    });
  }
  for (const key of CLIENT_HEALTH_METRIC_KEYS) {
    if (!configByKey.has(key)) throw new Error(`Missing required dimension configuration: ${key}`);
  }
  const totalWeight = [...configByKey.values()].reduce(
    (sum, config) => sum.plus(decimal(config.weight)),
    new HealthDecimal(0),
  );
  if (totalWeight.lte(0)) throw new Error('Total metric weight must be finite and greater than zero');
  decimalToNumber(totalWeight, 'Total metric weight', true);
  return configByKey;
}

function validateRows(rows: RatioRow[] | null, field: string): RatioRow[] | null {
  if (rows === null) return null;
  if (!Array.isArray(rows)) throw new Error(`${field} must be an array or null`);
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`${field}[${index}] is malformed`);
    return {
      spend: nonnegative(row.spend, `${field}[${index}].spend`),
      results: nonnegative(row.results, `${field}[${index}].results`),
    };
  });
}

function normalizeSources(
  sources: EngineSourceInput[],
  configs: Map<ClientHealthMetricKey, EngineMetricConfig>,
): Record<string, NormalizedSourceStatus> {
  if (!Array.isArray(sources)) throw new Error('sources must be an array');
  const sourceMap = new Map<string, NormalizedSourceStatus>();
  for (const [index, source] of sources.entries()) {
    if (!source || typeof source !== 'object' || typeof source.key !== 'string' || source.key.trim() === '') {
      throw new Error(`sources[${index}] is malformed`);
    }
    if (sourceMap.has(source.key)) throw new Error(`Duplicate source key: ${source.key}`);
    if (!['succeeded', 'partial', 'failed', 'missing'].includes(source.status)) {
      throw new Error(`${source.key} has an invalid source status`);
    }
    if (typeof source.stale !== 'boolean') throw new Error(`${source.key} stale must be boolean`);
    if (source.dataThrough !== null) assertDateOnly(source.dataThrough, `${source.key}.dataThrough`);
    const rowCount = source.rowCount === null ? null : nonnegative(source.rowCount, `${source.key}.rowCount`);
    if (rowCount !== null && !Number.isInteger(rowCount)) throw new Error(`${source.key}.rowCount must be an integer`);
    sourceMap.set(source.key, {
      status: source.status,
      dataThrough: source.dataThrough,
      stale: source.stale,
      rowCount,
    });
  }
  for (const config of configs.values()) {
    for (const sourceKey of config.sourceKeys) {
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, { status: 'missing', dataThrough: null, stale: false, rowCount: null });
      }
    }
  }
  return Object.fromEntries([...sourceMap.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

function sumRows(
  rows: RatioRow[] | null,
  field: string,
): { spend: HealthDecimal | null; results: HealthDecimal | null; cost: HealthDecimal | null } {
  if (rows === null) return { spend: null, results: null, cost: null };
  const spend = rows.reduce((sum, row) => sum.plus(decimal(row.spend)), new HealthDecimal(0));
  const results = rows.reduce((sum, row) => sum.plus(decimal(row.results)), new HealthDecimal(0));
  decimalToNumber(spend, `${field} spend total`, true);
  decimalToNumber(results, `${field} results total`, true);
  return { spend, results, cost: results.isZero() ? null : spend.div(results) };
}

/** Exact values remain unrounded; formatting is confined to explanatory presentation text. */
function displayed(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function classify(value: HealthDecimal, config: EngineMetricConfig): Exclude<DimensionStatus, 'incomplete' | 'unavailable' | 'configuration_required'> {
  const greenThreshold = decimal(config.greenThreshold);
  const yellowThreshold = decimal(config.yellowThreshold);
  if (config.direction === 'lower_is_better') {
    if (value.lte(greenThreshold)) return 'healthy';
    if (value.lte(yellowThreshold)) return 'watch';
    return 'at_risk';
  }
  if (value.gte(greenThreshold)) return 'healthy';
  if (value.gte(yellowThreshold)) return 'watch';
  return 'at_risk';
}

function missingDimension(config: EngineMetricConfig, reason: string): DimensionResult {
  return {
    status: config.required ? 'incomplete' : 'unavailable',
    value: null,
    reason,
    required: config.required,
    weight: config.weight,
  };
}

function sourceProblem(
  config: EngineMetricConfig,
  sources: Record<string, NormalizedSourceStatus>,
): string | null {
  for (const key of config.sourceKeys) {
    const source = sources[key];
    if (source.status !== 'succeeded') return `${DIMENSION_LABELS[config.key]} source ${key} is ${source.status}.`;
    if (source.stale) return `${DIMENSION_LABELS[config.key]} source ${key} is stale.`;
    if (source.dataThrough === null) return `${DIMENSION_LABELS[config.key]} source ${key} has no data-through date.`;
  }
  return null;
}

function dimension(
  config: EngineMetricConfig,
  sources: Record<string, NormalizedSourceStatus>,
  value: HealthDecimal | null,
  missingReason: string,
  specialRiskReason?: string,
): DimensionResult {
  const problem = sourceProblem(config, sources);
  if (problem) return missingDimension(config, problem);
  const numericValue = value === null ? null : decimalToNumber(value, `${config.key} value`);
  if (specialRiskReason) {
    return { status: 'at_risk', value: numericValue, reason: specialRiskReason, required: config.required, weight: config.weight };
  }
  if (value === null) return missingDimension(config, missingReason);
  const status = classify(value, config);
  return {
    status,
    value: numericValue,
    reason: `${DIMENSION_LABELS[config.key]} is ${displayed(numericValue!)} (${status.replace('_', ' ')}).`,
    required: config.required,
    weight: config.weight,
  };
}

function minimumRequiredDataThrough(
  configs: Map<ClientHealthMetricKey, EngineMetricConfig>,
  sources: Record<string, NormalizedSourceStatus>,
): string | null {
  const requiredKeys = new Set(
    [...configs.values()].filter((config) => config.required).flatMap((config) => config.sourceKeys),
  );
  if (requiredKeys.size === 0) return null;
  const dates = [...requiredKeys].map((key) => sources[key].dataThrough);
  if (dates.some((date) => date === null)) return null;
  return (dates as string[]).sort()[0];
}

function scoreDimensions(dimensions: Record<ClientHealthMetricKey, DimensionResult>): {
  status: OverallStatus;
  score: number | null;
} {
  const values = CLIENT_HEALTH_METRIC_KEYS.map((key) => dimensions[key]);
  if (values.some((item) => item.required && item.status === 'incomplete')) return { status: 'incomplete', score: null };
  const totalWeight = values.reduce((sum, item) => sum.plus(decimal(item.weight)), new HealthDecimal(0));
  const points: Record<'healthy' | 'watch' | 'at_risk' | 'unavailable', number> = {
    healthy: 100,
    watch: 50,
    at_risk: 0,
    unavailable: 0,
  };
  const weightedPoints = values.reduce((sum, item) => {
    if (item.status === 'configuration_required' || item.status === 'incomplete') return sum;
    return sum.plus(decimal(item.weight).times(points[item.status]));
  }, new HealthDecimal(0));
  const scoreDecimal = weightedPoints.div(totalWeight);
  const score = decimalToNumber(scoreDecimal, 'Weighted score');
  let status: OverallStatus = scoreDecimal.gte(80) ? 'healthy' : scoreDecimal.gte(50) ? 'watch' : 'at_risk';
  const criticalRequiredRisk = (['north_star', 'margin'] as const).some((key) => (
    dimensions[key].required && dimensions[key].status === 'at_risk'
  ));
  if (criticalRequiredRisk) status = 'at_risk';
  if (status === 'healthy' && values.some((item) => item.required && item.status === 'at_risk')) status = 'watch';
  return { status, score };
}

function orderedConfigs(configs: Map<ClientHealthMetricKey, EngineMetricConfig>): EngineMetricConfig[] {
  return CLIENT_HEALTH_METRIC_KEYS.map((key) => configs.get(key)!);
}

function orderedRows(rows: RatioRow[] | null): RatioRow[] | null {
  return rows === null ? null : [...rows].sort((left, right) => {
    if (left.spend !== right.spend) return left.spend < right.spend ? -1 : 1;
    return left.results < right.results ? -1 : left.results > right.results ? 1 : 0;
  });
}

function configurationRequiredSnapshot(
  input: ClientHealthEngineInput,
  month: ReturnType<typeof phoenixMonthWindow>,
  comparison: ReturnType<typeof comparisonWindows>,
): ClientHealthSnapshot {
  const dimensions = Object.fromEntries(CLIENT_HEALTH_METRIC_KEYS.map((key) => [key, {
    status: 'configuration_required',
    value: null,
    reason: `${DIMENSION_LABELS[key]} configuration requires approval.`,
    required: true,
    weight: 0,
  }])) as Record<ClientHealthMetricKey, DimensionResult>;
  const values = Object.fromEntries([
    'budget',
    'monthSpend',
    'expectedSpend',
    'elapsedMonthFraction',
    'budgetPacingVariancePercent',
    'currentSpend',
    'currentResultCount',
    'currentCostPerResult',
    'previousSpend',
    'previousResultCount',
    'previousCostPerResult',
    'northStarChangePercent',
    'hoursUsed',
    'hoursAllotted',
    'projectedHours',
    'projectedHoursPercent',
    'overdueTaskCount',
    'revenue',
    'fulfillmentCost',
    'marginPercent',
  ].map((key) => [key, null])) as SnapshotValues;
  const snapshotWithoutHash = {
    clientKey: input.clientKey,
    status: 'configuration_required' as const,
    score: null,
    reasons: CLIENT_HEALTH_METRIC_KEYS.map((key) => dimensions[key].reason),
    dataThrough: null,
    windows: { month, comparison },
    values,
    sources: {},
    dimensions,
    calculationVersion: input.calculationVersion,
  };
  const normalizedEvidence = {
    input: {
      clientKey: input.clientKey,
      configApproved: false,
      lastCompleteSourceDate: input.lastCompleteSourceDate,
      calculationVersion: input.calculationVersion,
    },
    output: snapshotWithoutHash,
  };
  return { ...snapshotWithoutHash, evidenceHash: canonicalEvidenceHash(normalizedEvidence) };
}

export function buildClientHealthSnapshot(input: ClientHealthEngineInput): ClientHealthSnapshot {
  if (!input || typeof input !== 'object') throw new Error('Client health input is malformed');
  if (typeof input.clientKey !== 'string' || input.clientKey.trim() === '') throw new Error('clientKey is required');
  if (typeof input.configApproved !== 'boolean') throw new Error('configApproved must be boolean');
  if (typeof input.calculationVersion !== 'string' || input.calculationVersion.trim() === '') throw new Error('calculationVersion is required');
  assertDateOnly(input.lastCompleteSourceDate, 'lastCompleteSourceDate');

  const month = phoenixMonthWindow(input.lastCompleteSourceDate);
  const comparison = comparisonWindows(input.lastCompleteSourceDate, 14);
  if (!input.configApproved) return configurationRequiredSnapshot(input, month, comparison);

  const configs = validateConfig(input.metricConfig);
  const sources = normalizeSources(input.sources, configs);
  if (!input.values || typeof input.values !== 'object') throw new Error('values are malformed');
  // Canonical row order is used for both arithmetic and evidence so floating-point
  // addition and the resulting ratings cannot depend on source retrieval order.
  const currentRows = orderedRows(validateRows(input.values.currentRows, 'currentRows'));
  const previousRows = orderedRows(validateRows(input.values.previousRows, 'previousRows'));
  const valuesInput: Omit<ClientHealthValueInputs, 'currentRows' | 'previousRows'> = {
    budget: nullableNonnegative(input.values.budget, 'budget'),
    monthSpend: nullableNonnegative(input.values.monthSpend, 'monthSpend'),
    hoursUsed: nullableNonnegative(input.values.hoursUsed, 'hoursUsed'),
    hoursAllotted: nullableNonnegative(input.values.hoursAllotted, 'hoursAllotted'),
    overdueTaskCount: nullableNonnegative(input.values.overdueTaskCount, 'overdueTaskCount'),
    revenue: nullableNonnegative(input.values.revenue, 'revenue'),
    fulfillmentCost: nullableNonnegative(input.values.fulfillmentCost, 'fulfillmentCost'),
  };
  if (valuesInput.overdueTaskCount !== null && !Number.isInteger(valuesInput.overdueTaskCount)) {
    throw new Error('overdueTaskCount must be an integer');
  }

  const current = sumRows(currentRows, 'currentRows');
  const previous = sumRows(previousRows, 'previousRows');
  const elapsedDays = new HealthDecimal(month.elapsedDays);
  const daysInMonth = new HealthDecimal(month.daysInMonth);
  const elapsedMonthFraction = elapsedDays.div(daysInMonth);
  const expectedSpend = valuesInput.budget === null
    ? null
    : decimal(valuesInput.budget).times(elapsedDays).div(daysInMonth);
  const budgetPacingVariancePercent = valuesInput.budget === null || valuesInput.monthSpend === null || valuesInput.budget === 0
    ? null
    : decimal(valuesInput.monthSpend).times(daysInMonth)
      .minus(decimal(valuesInput.budget).times(elapsedDays))
      .abs()
      .times(100)
      .div(decimal(valuesInput.budget).times(daysInMonth));
  const projectedHours = valuesInput.hoursUsed === null
    ? null
    : decimal(valuesInput.hoursUsed).times(daysInMonth).div(elapsedDays);
  const projectedHoursPercent = valuesInput.hoursUsed === null || valuesInput.hoursAllotted === null || valuesInput.hoursAllotted === 0
    ? null
    : decimal(valuesInput.hoursUsed).times(daysInMonth).times(100)
      .div(elapsedDays.times(decimal(valuesInput.hoursAllotted)));
  const marginPercent = valuesInput.revenue === null || valuesInput.fulfillmentCost === null || valuesInput.revenue === 0
    ? null
    : decimal(valuesInput.revenue).minus(decimal(valuesInput.fulfillmentCost)).times(100).div(valuesInput.revenue);
  const northStarChangePercent = current.spend === null || current.results === null || current.results.isZero()
    || previous.spend === null || previous.spend.isZero() || previous.results === null || previous.results.isZero()
    ? null
    : current.spend.times(previous.results)
      .minus(previous.spend.times(current.results))
      .times(100)
      .div(current.results.times(previous.spend));

  const snapshotValues: SnapshotValues = {
    budget: valuesInput.budget,
    monthSpend: valuesInput.monthSpend,
    expectedSpend: expectedSpend === null ? null : decimalToNumber(expectedSpend, 'expectedSpend'),
    elapsedMonthFraction: decimalToNumber(elapsedMonthFraction, 'elapsedMonthFraction'),
    budgetPacingVariancePercent: budgetPacingVariancePercent === null
      ? null
      : decimalToNumber(budgetPacingVariancePercent, 'budgetPacingVariancePercent'),
    currentSpend: current.spend === null ? null : decimalToNumber(current.spend, 'currentSpend', true),
    currentResultCount: current.results === null ? null : decimalToNumber(current.results, 'currentResultCount', true),
    currentCostPerResult: current.cost === null ? null : decimalToNumber(current.cost, 'currentCostPerResult'),
    previousSpend: previous.spend === null ? null : decimalToNumber(previous.spend, 'previousSpend', true),
    previousResultCount: previous.results === null ? null : decimalToNumber(previous.results, 'previousResultCount', true),
    previousCostPerResult: previous.cost === null ? null : decimalToNumber(previous.cost, 'previousCostPerResult'),
    northStarChangePercent: northStarChangePercent === null
      ? null
      : decimalToNumber(northStarChangePercent, 'northStarChangePercent'),
    hoursUsed: valuesInput.hoursUsed,
    hoursAllotted: valuesInput.hoursAllotted,
    projectedHours: projectedHours === null ? null : decimalToNumber(projectedHours, 'projectedHours'),
    projectedHoursPercent: projectedHoursPercent === null
      ? null
      : decimalToNumber(projectedHoursPercent, 'projectedHoursPercent'),
    overdueTaskCount: valuesInput.overdueTaskCount,
    revenue: valuesInput.revenue,
    fulfillmentCost: valuesInput.fulfillmentCost,
    marginPercent: marginPercent === null ? null : decimalToNumber(marginPercent, 'marginPercent'),
  };

  const budgetConfig = configs.get('budget_pacing')!;
  const northStarConfig = configs.get('north_star')!;
  const hoursConfig = configs.get('hours')!;
  const overdueConfig = configs.get('overdue_tasks')!;
  const marginConfig = configs.get('margin')!;
  const dimensions: Record<ClientHealthMetricKey, DimensionResult> = {
      budget_pacing: dimension(
        budgetConfig,
        sources,
        budgetPacingVariancePercent,
        'Budget pacing inputs are missing.',
        valuesInput.budget === 0 && valuesInput.monthSpend !== null && sourceProblem(budgetConfig, sources) === null
          ? 'Budget pacing is at risk because the verified monthly budget is zero.'
          : undefined,
      ),
      north_star: dimension(
        northStarConfig,
        sources,
        northStarChangePercent,
        'North-star current or previous comparison data is missing.',
        currentRows !== null && previousRows !== null && current.results?.isZero() === true && sourceProblem(northStarConfig, sources) === null
          ? 'North-star trend is at risk because the current window has zero verified results.'
          : currentRows !== null && previousRows !== null && previous.results?.isZero() === true && sourceProblem(northStarConfig, sources) === null
            ? 'North-star trend is at risk because the previous window has zero verified results.'
            : undefined,
      ),
      hours: dimension(
        hoursConfig,
        sources,
        projectedHoursPercent,
        'Hours used or monthly allotment is missing.',
        valuesInput.hoursAllotted === 0 && valuesInput.hoursUsed !== null && sourceProblem(hoursConfig, sources) === null
          ? 'Hours utilization is at risk because the verified monthly allotment is zero.'
          : undefined,
      ),
      overdue_tasks: dimension(
        overdueConfig,
        sources,
        valuesInput.overdueTaskCount === null ? null : decimal(valuesInput.overdueTaskCount),
        'Overdue task count is missing.',
      ),
      margin: dimension(
        marginConfig,
        sources,
        marginPercent,
        'Margin revenue or fulfillment cost is missing.',
        valuesInput.revenue === 0 && valuesInput.fulfillmentCost !== null && sourceProblem(marginConfig, sources) === null
          ? 'Margin is at risk because verified revenue is zero.'
          : undefined,
      ),
  };
  const { status, score } = scoreDimensions(dimensions);

  const snapshotWithoutHash = {
    clientKey: input.clientKey,
    status,
    score,
    reasons: CLIENT_HEALTH_METRIC_KEYS.map((key) => dimensions[key].reason),
    dataThrough: minimumRequiredDataThrough(configs, sources),
    windows: { month, comparison },
    values: snapshotValues,
    sources,
    dimensions,
    calculationVersion: input.calculationVersion,
  };
  const normalizedEvidence = {
    input: {
      clientKey: input.clientKey,
      configApproved: input.configApproved,
      lastCompleteSourceDate: input.lastCompleteSourceDate,
      calculationVersion: input.calculationVersion,
      metricConfig: orderedConfigs(configs),
      sources,
      values: {
        ...valuesInput,
        currentRows: orderedRows(currentRows),
        previousRows: orderedRows(previousRows),
      },
    },
    output: snapshotWithoutHash,
  };
  return { ...snapshotWithoutHash, evidenceHash: canonicalEvidenceHash(normalizedEvidence) };
}
