import Decimal from 'decimal.js-light';

export type DeliveryModel = 'custom' | 'platform';

export const DEFAULT_FULFILLMENT_HOURLY_COST: Readonly<Record<DeliveryModel, number>> = Object.freeze({
  custom: 46,
  platform: 26,
});

export const DEFAULT_TARGET_MARGIN_PERCENT = 80;

const EconomicsDecimal = Decimal.clone({ precision: 650, rounding: Decimal.ROUND_HALF_UP });
type EconomicsDecimal = InstanceType<typeof EconomicsDecimal>;

export type MonthlyAllottedHoursInput = {
  monthlyRetainer: number | null;
  fulfillmentHourlyCost: number;
  targetMarginPercent?: number;
};

export type ProjectedHoursInput = {
  hoursUsed: number | null;
  daysInMonth: number;
  elapsedDays: number;
};

export type ProjectedFulfillmentCostInput = {
  projectedHours: number | null;
  fulfillmentHourlyCost: number;
};

export type ProjectedRealizedMarginInput = {
  monthlyRetainer: number | null;
  projectedFulfillmentCost: number | null;
};

export type ClientHealthEconomicsInput = {
  monthlyRetainer: number | null;
  deliveryModel: DeliveryModel;
  fulfillmentHourlyCost?: number;
  targetMarginPercent?: number;
  hoursUsed: number | null;
  daysInMonth: number;
  elapsedDays: number;
};

export type ClientHealthEconomics = {
  fulfillmentHourlyCost: number;
  targetMarginPercent: number;
  monthlyAllottedHours: number | null;
  projectedHours: number | null;
  projectedFulfillmentCost: number | null;
  projectedRealizedMarginPercent: number | null;
};

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function nonnegative(value: unknown, field: string): number {
  const result = finite(value, field);
  if (result < 0) throw new Error(`${field} must be nonnegative`);
  return result;
}

function positive(value: unknown, field: string): number {
  const result = nonnegative(value, field);
  if (result === 0) throw new Error(`${field} must be greater than zero`);
  return result;
}

function decimal(value: number): EconomicsDecimal {
  return new EconomicsDecimal(value);
}

function decimalToNumber(value: EconomicsDecimal, field: string): number {
  const result = value.toNumber();
  if (!Number.isFinite(result)) throw new Error(`${field} must be finite`);
  if (!value.isZero() && result === 0) {
    throw new Error(`${field} must be safely representable as a number`);
  }
  return Object.is(result, -0) ? 0 : result;
}

function validatedHourlyCost(value: unknown): EconomicsDecimal {
  return decimal(positive(value, 'Fulfillment hourly cost'));
}

function validatedTargetMargin(value: unknown): EconomicsDecimal {
  const margin = nonnegative(value, 'Target margin percent');
  if (margin >= 100) throw new Error('Target margin percent must be less than 100');
  return decimal(margin);
}

function monthlyAllottedHoursDecimal(
  monthlyRetainer: number | null,
  hourlyCost: EconomicsDecimal,
  targetMarginPercent: EconomicsDecimal,
): EconomicsDecimal | null {
  if (monthlyRetainer === null) return null;
  const retainer = decimal(nonnegative(monthlyRetainer, 'Monthly retainer'));
  return retainer.times(decimal(100).minus(targetMarginPercent)).div(100).div(hourlyCost);
}

function projectedHoursDecimal(input: ProjectedHoursInput): EconomicsDecimal | null {
  const daysInMonth = finite(input.daysInMonth, 'Days in month');
  if (!Number.isInteger(daysInMonth) || daysInMonth < 28 || daysInMonth > 31) {
    throw new Error('Days in month must be an integer between 28 and 31');
  }
  const elapsedDays = finite(input.elapsedDays, 'Elapsed days');
  if (!Number.isInteger(elapsedDays) || elapsedDays < 0 || elapsedDays > daysInMonth) {
    throw new Error('Elapsed days must be an integer between 0 and days in month');
  }
  if (input.hoursUsed === null) return null;
  const hoursUsed = decimal(nonnegative(input.hoursUsed, 'Hours used'));
  if (elapsedDays === 0) return null;
  return hoursUsed.times(daysInMonth).div(elapsedDays);
}

function projectedFulfillmentCostDecimal(
  projectedHours: number | null,
  hourlyCost: EconomicsDecimal,
): EconomicsDecimal | null {
  if (projectedHours === null) return null;
  return decimal(nonnegative(projectedHours, 'Projected hours')).times(hourlyCost);
}

function projectedRealizedMarginDecimal(
  monthlyRetainer: number | null,
  projectedFulfillmentCost: number | null,
): EconomicsDecimal | null {
  const cost = projectedFulfillmentCost === null
    ? null
    : decimal(nonnegative(projectedFulfillmentCost, 'Projected fulfillment cost'));
  if (monthlyRetainer === null) return null;
  const retainer = decimal(nonnegative(monthlyRetainer, 'Monthly retainer'));
  if (cost === null || retainer.isZero()) return null;
  return retainer.minus(cost).times(100).div(retainer);
}

export function resolveFulfillmentHourlyCost(
  deliveryModel: DeliveryModel,
  override?: number,
): number {
  if (deliveryModel !== 'custom' && deliveryModel !== 'platform') {
    throw new Error('Delivery model must be custom or platform');
  }
  const value = override === undefined ? DEFAULT_FULFILLMENT_HOURLY_COST[deliveryModel] : override;
  return decimalToNumber(validatedHourlyCost(value), 'Fulfillment hourly cost');
}

export function calculateMonthlyAllottedHours(input: MonthlyAllottedHoursInput): number | null {
  const hourlyCost = validatedHourlyCost(input.fulfillmentHourlyCost);
  const targetMargin = validatedTargetMargin(input.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT);
  const result = monthlyAllottedHoursDecimal(input.monthlyRetainer, hourlyCost, targetMargin);
  return result === null ? null : decimalToNumber(result, 'Monthly allotted hours');
}

export function calculateProjectedHours(input: ProjectedHoursInput): number | null {
  const result = projectedHoursDecimal(input);
  return result === null ? null : decimalToNumber(result, 'Projected hours');
}

export function calculateProjectedFulfillmentCost(input: ProjectedFulfillmentCostInput): number | null {
  const result = projectedFulfillmentCostDecimal(
    input.projectedHours,
    validatedHourlyCost(input.fulfillmentHourlyCost),
  );
  return result === null ? null : decimalToNumber(result, 'Projected fulfillment cost');
}

export function calculateProjectedRealizedMarginPercent(input: ProjectedRealizedMarginInput): number | null {
  const result = projectedRealizedMarginDecimal(input.monthlyRetainer, input.projectedFulfillmentCost);
  return result === null ? null : decimalToNumber(result, 'Projected realized margin percent');
}

export function calculateClientHealthEconomics(input: ClientHealthEconomicsInput): ClientHealthEconomics {
  const fulfillmentHourlyCost = resolveFulfillmentHourlyCost(input.deliveryModel, input.fulfillmentHourlyCost);
  const hourlyCost = decimal(fulfillmentHourlyCost);
  const targetMargin = validatedTargetMargin(input.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT);
  const projectedHours = projectedHoursDecimal(input);
  const monthlyAllottedHours = monthlyAllottedHoursDecimal(input.monthlyRetainer, hourlyCost, targetMargin);
  const projectedFulfillmentCost = projectedHours === null ? null : projectedHours.times(hourlyCost);
  const projectedRealizedMargin = input.monthlyRetainer === null || projectedFulfillmentCost === null
    ? null
    : (() => {
      const retainer = decimal(nonnegative(input.monthlyRetainer, 'Monthly retainer'));
      return retainer.isZero()
        ? null
        : retainer.minus(projectedFulfillmentCost).times(100).div(retainer);
    })();

  return {
    fulfillmentHourlyCost,
    targetMarginPercent: decimalToNumber(targetMargin, 'Target margin percent'),
    monthlyAllottedHours: monthlyAllottedHours === null
      ? null
      : decimalToNumber(monthlyAllottedHours, 'Monthly allotted hours'),
    projectedHours: projectedHours === null ? null : decimalToNumber(projectedHours, 'Projected hours'),
    projectedFulfillmentCost: projectedFulfillmentCost === null
      ? null
      : decimalToNumber(projectedFulfillmentCost, 'Projected fulfillment cost'),
    projectedRealizedMarginPercent: projectedRealizedMargin === null
      ? null
      : decimalToNumber(projectedRealizedMargin, 'Projected realized margin percent'),
  };
}
