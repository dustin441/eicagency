import Decimal from 'decimal.js-light';

export type NorthStarLaneFormula = 'cost_per_result' | 'roas';
export type NorthStarLaneEvaluation = 'period_over_period_change' | 'absolute_target';
export type NorthStarLaneDirection = 'lower_is_better' | 'higher_is_better';
export type NorthStarLaneStatus = 'healthy' | 'watch' | 'at_risk' | 'incomplete' | 'unavailable';

export type NorthStarLane = {
  key: string;
  label: string;
  formula: NorthStarLaneFormula;
  evaluation: NorthStarLaneEvaluation;
  required: boolean;
  weight: number;
  direction: NorthStarLaneDirection;
  greenThreshold: number;
  yellowThreshold: number;
  sourceKeys: string[];
};

export type NorthStarRatioRow = { spend: number; results: number };
export type NorthStarRowsBySource = Readonly<Record<string, {
  readonly currentRows: readonly NorthStarRatioRow[] | null;
  readonly previousRows: readonly NorthStarRatioRow[] | null;
}>>;

export type NorthStarLaneEvidence = {
  key: string;
  required: boolean;
  weight: number;
  currentValue: number | null;
  previousValue: number | null;
  evaluationValue: number | null;
  status: NorthStarLaneStatus;
  reason: string;
};

export type ReducedNorthStarLanes = {
  status: NorthStarLaneStatus;
  value: number | null;
  reason: string;
};

const KEY = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return Object.is(value, -0) ? 0 : value;
}

function nonnegative(value: unknown, field: string): number {
  const normalized = finite(value, field);
  if (normalized < 0) throw new Error(`${field} must be nonnegative`);
  return normalized;
}

function validateLane(lane: NorthStarLane, index: number): NorthStarLane {
  const field = `northStarLanes[${index}]`;
  if (!lane || typeof lane !== 'object' || Array.isArray(lane)) throw new Error(`${field} must be an object`);
  const expectedKeys = ['direction','evaluation','formula','greenThreshold','key','label','required','sourceKeys','weight','yellowThreshold'];
  const actualKeys = Object.keys(lane).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) throw new Error(`${field} has an incompatible key set`);
  if (typeof lane.key !== 'string' || lane.key.length > 64 || !KEY.test(lane.key)) throw new Error(`${field}.key is invalid`);
  if (typeof lane.label !== 'string' || lane.label.trim() !== lane.label || lane.label.length < 1 || lane.label.length > 120) throw new Error(`${field}.label is invalid`);
  if (typeof lane.required !== 'boolean') throw new Error(`${field}.required must be boolean`);
  const weight = finite(lane.weight, `${field}.weight`);
  if (weight <= 0 || weight > 100) throw new Error(`${field}.weight must be greater than zero and at most 100`);
  const greenThreshold = finite(lane.greenThreshold, `${field}.greenThreshold`);
  const yellowThreshold = finite(lane.yellowThreshold, `${field}.yellowThreshold`);
  if (!Array.isArray(lane.sourceKeys) || lane.sourceKeys.length < 1) throw new Error(`${field}.sourceKeys must be nonempty and contain at least one source`);
  const sourceKeys = lane.sourceKeys.map((sourceKey, sourceIndex) => {
    if (typeof sourceKey !== 'string' || !KEY.test(sourceKey)) throw new Error(`${field}.sourceKeys[${sourceIndex}] is invalid`);
    return sourceKey;
  }).sort();
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error(`${field}.sourceKeys must be unique`);

  const costPair = lane.formula === 'cost_per_result'
    && (lane.evaluation === 'absolute_target' || lane.evaluation === 'period_over_period_change');
  const roasPair = lane.formula === 'roas'
    && (lane.evaluation === 'absolute_target' || lane.evaluation === 'period_over_period_change');
  if (!costPair && !roasPair) throw new Error(`${field} formula and evaluation must use a supported pair`);
  if ((costPair && lane.direction !== 'lower_is_better') || (roasPair && lane.direction !== 'higher_is_better')) {
    throw new Error(`${field}.direction is incompatible with its formula`);
  }
  if (lane.direction === 'lower_is_better' && greenThreshold > yellowThreshold) throw new Error(`${field} thresholds are invalid for lower-is-better`);
  if (lane.direction === 'higher_is_better' && greenThreshold < yellowThreshold) throw new Error(`${field} thresholds are invalid for higher-is-better`);
  return { ...lane, weight, greenThreshold, yellowThreshold, sourceKeys };
}

function validateRows(rows: readonly NorthStarRatioRow[], field: string): { spend: Decimal; results: Decimal } {
  if (!Array.isArray(rows)) throw new Error(`${field} must be an array or null`);
  let spend = new Decimal(0);
  let results = new Decimal(0);
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${field}[${index}] must be an object`);
    spend = spend.plus(nonnegative(row.spend, `${field}[${index}].spend`));
    results = results.plus(nonnegative(row.results, `${field}[${index}].results`));
  });
  return { spend, results };
}

function classify(lane: NorthStarLane, value: number): 'healthy' | 'watch' | 'at_risk' {
  if (lane.direction === 'lower_is_better') {
    if (value <= lane.greenThreshold) return 'healthy';
    if (value <= lane.yellowThreshold) return 'watch';
    return 'at_risk';
  }
  if (value >= lane.greenThreshold) return 'healthy';
  if (value >= lane.yellowThreshold) return 'watch';
  return 'at_risk';
}

function missing(lane: NorthStarLane, window: 'current' | 'previous', sourceKey: string): NorthStarLaneEvidence {
  return {
    key: lane.key,
    required: lane.required,
    weight: lane.weight,
    currentValue: null,
    previousValue: null,
    evaluationValue: null,
    status: lane.required ? 'incomplete' : 'unavailable',
    reason: `${lane.label} ${window} rows are missing for source ${sourceKey}.`,
  };
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function calculateCpl(lane: NorthStarLane, rowsBySource: NorthStarRowsBySource): NorthStarLaneEvidence {
  let currentSpend = new Decimal(0);
  let currentResults = new Decimal(0);
  let previousSpend = new Decimal(0);
  let previousResults = new Decimal(0);
  for (const sourceKey of lane.sourceKeys) {
    const source = rowsBySource[sourceKey];
    if (!source || source.currentRows === null) return missing(lane, 'current', sourceKey);
    const current = validateRows(source.currentRows, `${sourceKey}.currentRows`);
    currentSpend = currentSpend.plus(current.spend);
    currentResults = currentResults.plus(current.results);
  }

  const base = { key: lane.key, required: lane.required, weight: lane.weight };
  if (currentResults.isZero()) return {
    ...base, currentValue: null, previousValue: null, evaluationValue: null,
    status: 'at_risk', reason: `${lane.label} current window has zero verified results.`,
  };
  const currentValue = currentSpend.div(currentResults);

  if (lane.evaluation === 'absolute_target') {
    let previousComplete = true;
    for (const sourceKey of lane.sourceKeys) {
      const previousRows = rowsBySource[sourceKey]!.previousRows;
      if (previousRows === null) {
        previousComplete = false;
        continue;
      }
      const previous = validateRows(previousRows, `${sourceKey}.previousRows`);
      previousSpend = previousSpend.plus(previous.spend);
      previousResults = previousResults.plus(previous.results);
    }
    const previousValue = previousComplete && !previousResults.isZero()
      ? previousSpend.div(previousResults).toNumber()
      : null;
    const evaluationValue = currentValue.toNumber();
    return {
      ...base,
      currentValue: evaluationValue,
      previousValue,
      evaluationValue,
      status: classify(lane, evaluationValue),
      reason: `${lane.label} is ${formatValue(evaluationValue)} against a healthy threshold of ${formatValue(lane.greenThreshold)}.`,
    };
  }

  for (const sourceKey of lane.sourceKeys) {
    const source = rowsBySource[sourceKey]!;
    if (source.previousRows === null) {
      const evidence = missing(lane, 'previous', sourceKey);
      evidence.currentValue = currentValue.toNumber();
      return evidence;
    }
    const previous = validateRows(source.previousRows, `${sourceKey}.previousRows`);
    previousSpend = previousSpend.plus(previous.spend);
    previousResults = previousResults.plus(previous.results);
  }

  if (previousResults.isZero()) return {
    ...base, currentValue: currentValue.toNumber(), previousValue: null, evaluationValue: null,
    status: 'at_risk', reason: `${lane.label} previous window has zero verified results.`,
  };
  const previousValue = previousSpend.div(previousResults);
  if (previousSpend.isZero() || previousValue.isZero()) return {
    ...base, currentValue: currentValue.toNumber(), previousValue: previousValue.toNumber(), evaluationValue: null,
    status: 'at_risk', reason: `${lane.label} previous window has zero verified spend.`,
  };
  const evaluationValue = currentValue.minus(previousValue).div(previousValue).times(100).toNumber();
  const status = classify(lane, evaluationValue);
  const movement = evaluationValue < 0 ? `improved by ${formatValue(Math.abs(evaluationValue))}%`
    : evaluationValue > 0 ? `worsened by ${formatValue(evaluationValue)}%`
      : 'was unchanged';
  return {
    ...base,
    currentValue: currentValue.toNumber(), previousValue: previousValue.toNumber(), evaluationValue, status,
    reason: `${lane.label} ${movement} period over period.`,
  };
}

function calculateRoas(lane: NorthStarLane, rowsBySource: NorthStarRowsBySource): NorthStarLaneEvidence {
  let currentSpend = new Decimal(0);
  let currentRevenue = new Decimal(0);
  let previousSpend = new Decimal(0);
  let previousRevenue = new Decimal(0);
  let previousComplete = true;
  for (const sourceKey of lane.sourceKeys) {
    const source = rowsBySource[sourceKey];
    if (!source || source.currentRows === null) return missing(lane, 'current', sourceKey);
    const current = validateRows(source.currentRows, `${sourceKey}.currentRows`);
    currentSpend = currentSpend.plus(current.spend);
    currentRevenue = currentRevenue.plus(current.results);
    if (source.previousRows === null) {
      previousComplete = false;
    } else {
      const previous = validateRows(source.previousRows, `${sourceKey}.previousRows`);
      previousSpend = previousSpend.plus(previous.spend);
      previousRevenue = previousRevenue.plus(previous.results);
    }
  }
  const base = { key: lane.key, required: lane.required, weight: lane.weight };
  if (currentSpend.isZero()) return {
    ...base, currentValue: null, previousValue: previousComplete && !previousSpend.isZero() ? previousRevenue.div(previousSpend).toNumber() : null,
    evaluationValue: null, status: 'incomplete', reason: `${lane.label} current window has zero verified spend.`,
  };
  const currentRoas = currentRevenue.div(currentSpend);
  const currentValue = currentRoas.toNumber();
  const previousRoas = previousComplete && !previousSpend.isZero() ? previousRevenue.div(previousSpend) : null;
  const previousValue = previousRoas?.toNumber() ?? null;
  if (lane.evaluation === 'period_over_period_change') {
    if (!previousComplete) return missing(lane, 'previous', lane.sourceKeys.find((sourceKey) => rowsBySource[sourceKey]?.previousRows === null) ?? lane.sourceKeys[0]);
    if (previousRoas === null) return {
      ...base, currentValue, previousValue: null, evaluationValue: null,
      status: 'at_risk', reason: `${lane.label} previous window has zero verified spend.`,
    };
    if (previousValue === 0) return {
      ...base, currentValue, previousValue, evaluationValue: null,
      status: 'at_risk', reason: `${lane.label} previous window has zero verified ROAS.`,
    };
    const evaluationValue = currentRoas.minus(previousRoas).div(previousRoas).times(100).toNumber();
    const status = classify(lane, evaluationValue);
    const movement = evaluationValue > 0 ? `improved by ${formatValue(evaluationValue)}%`
      : evaluationValue < 0 ? `worsened by ${formatValue(Math.abs(evaluationValue))}%`
        : 'was unchanged';
    return {
      ...base, currentValue, previousValue, evaluationValue, status,
      reason: `${lane.label} ${movement} period over period.`,
    };
  }
  const status = classify(lane, currentValue);
  return {
    ...base, currentValue, previousValue, evaluationValue: currentValue, status,
    reason: `${lane.label} is ${formatValue(currentValue)} against a healthy threshold of ${formatValue(lane.greenThreshold)}.`,
  };
}

export function calculateNorthStarLanes(
  lanes: NorthStarLane[],
  rowsBySource: NorthStarRowsBySource,
): NorthStarLaneEvidence[] {
  if (!rowsBySource || typeof rowsBySource !== 'object' || Array.isArray(rowsBySource)) throw new Error('rowsBySource must be an object');
  const normalized = normalizeNorthStarLanes(lanes);
  return normalized.map((lane) => lane.formula === 'cost_per_result'
    ? calculateCpl(lane, rowsBySource)
    : calculateRoas(lane, rowsBySource));
}

export function normalizeNorthStarLanes(lanes: NorthStarLane[]): NorthStarLane[] {
  if (!Array.isArray(lanes) || lanes.length < 1 || lanes.length > 4) throw new Error('northStarLanes must contain between 1 and 4 lanes');
  const normalized = lanes.map(validateLane).sort((left, right) => left.key.localeCompare(right.key));
  if (new Set(normalized.map(({ key }) => key)).size !== normalized.length) throw new Error('duplicate lane key; northStarLanes must have unique lane keys');
  if (normalized.reduce((sum, { weight }) => sum + weight, 0) > 100) throw new Error('total lane weight must not exceed 100');
  return normalized;
}

export function reduceNorthStarLanes(evidence: NorthStarLaneEvidence[]): ReducedNorthStarLanes {
  if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 4) throw new Error('North Star lane evidence must contain between 1 and 4 lanes');
  const required = evidence.filter((lane) => lane.required);
  if (required.length === 0) return { status: 'unavailable', value: null, reason: 'No required North Star lanes are configured.' };
  const precedence: NorthStarLaneStatus[] = ['incomplete', 'at_risk', 'watch'];
  for (const status of precedence) {
    const lane = required.find((candidate) => candidate.status === status);
    if (lane) return {
      status,
      value: evidence.length === 1 ? lane.evaluationValue : null,
      reason: `Required North Star lane ${lane.key} is ${status}.`,
    };
  }
  if (required.some((lane) => lane.status === 'unavailable')) {
    const lane = required.find((candidate) => candidate.status === 'unavailable')!;
    return { status: 'incomplete', value: evidence.length === 1 ? lane.evaluationValue : null, reason: `Required North Star lane ${lane.key} is unavailable.` };
  }
  return {
    status: 'healthy',
    value: evidence.length === 1 ? required[0].evaluationValue : null,
    reason: 'All required North Star lanes are healthy.',
  };
}
