import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateClientHealthEconomics,
  calculateMonthlyAllottedHours,
  calculateProjectedFulfillmentCost,
  calculateProjectedHours,
  calculateProjectedRealizedMarginPercent,
  DEFAULT_FULFILLMENT_HOURLY_COST,
  DEFAULT_TARGET_MARGIN_PERCENT,
  resolveFulfillmentHourlyCost,
} from './economics.ts';

test('uses the approved custom and platform hourly-cost defaults', () => {
  assert.deepEqual(DEFAULT_FULFILLMENT_HOURLY_COST, { custom: 46, platform: 26 });
  assert.equal(DEFAULT_TARGET_MARGIN_PERCENT, 80);
  assert.equal(resolveFulfillmentHourlyCost('custom'), 46);
  assert.equal(resolveFulfillmentHourlyCost('platform'), 26);
  assert.equal(resolveFulfillmentHourlyCost('custom', 52.5), 52.5);
});

test('derives monthly allotted hours from the approved 80% top-line margin', () => {
  assert.equal(calculateMonthlyAllottedHours({
    monthlyRetainer: 4_600,
    fulfillmentHourlyCost: 46,
    targetMarginPercent: 80,
  }), 20);
  assert.equal(calculateMonthlyAllottedHours({
    monthlyRetainer: 2_600,
    fulfillmentHourlyCost: 26,
  }), 20);
});

test('uses decimal arithmetic rather than accumulating binary floating-point artifacts', () => {
  assert.equal(calculateMonthlyAllottedHours({
    monthlyRetainer: 0.3,
    fulfillmentHourlyCost: 0.2,
    targetMarginPercent: 80,
  }), 0.3);
  assert.equal(calculateProjectedHours({ hoursUsed: 0.1, daysInMonth: 30, elapsedDays: 3 }), 1);
  assert.equal(calculateProjectedFulfillmentCost({ projectedHours: 0.1, fulfillmentHourlyCost: 0.2 }), 0.02);
  assert.equal(calculateProjectedRealizedMarginPercent({
    monthlyRetainer: 0.3,
    projectedFulfillmentCost: 0.1,
  }), 66.66666666666667);
});

test('projects hours, fulfillment cost, and realized margin without intermediate rounding', () => {
  const result = calculateClientHealthEconomics({
    monthlyRetainer: 4_600,
    deliveryModel: 'custom',
    hoursUsed: 12,
    daysInMonth: 30,
    elapsedDays: 10,
  });

  assert.deepEqual(result, {
    fulfillmentHourlyCost: 46,
    targetMarginPercent: 80,
    monthlyAllottedHours: 20,
    projectedHours: 36,
    projectedFulfillmentCost: 1_656,
    projectedRealizedMarginPercent: 64,
  });
});

test('preserves legitimate zero values and propagates unavailable inputs as null', () => {
  assert.equal(calculateMonthlyAllottedHours({
    monthlyRetainer: 0,
    fulfillmentHourlyCost: 46,
  }), 0);
  assert.equal(calculateMonthlyAllottedHours({
    monthlyRetainer: null,
    fulfillmentHourlyCost: 46,
  }), null);
  assert.equal(calculateProjectedHours({ hoursUsed: 0, daysInMonth: 31, elapsedDays: 10 }), 0);
  assert.equal(calculateProjectedHours({ hoursUsed: null, daysInMonth: 31, elapsedDays: 10 }), null);
  assert.equal(calculateProjectedHours({ hoursUsed: 0, daysInMonth: 31, elapsedDays: 0 }), null);
  assert.equal(calculateProjectedFulfillmentCost({ projectedHours: null, fulfillmentHourlyCost: 46 }), null);
  assert.equal(calculateProjectedRealizedMarginPercent({
    monthlyRetainer: 0,
    projectedFulfillmentCost: 0,
  }), null);
  assert.equal(calculateProjectedRealizedMarginPercent({
    monthlyRetainer: null,
    projectedFulfillmentCost: 0,
  }), null);
});

test('does not clamp a legitimate negative projected margin', () => {
  assert.equal(calculateProjectedRealizedMarginPercent({
    monthlyRetainer: 1_000,
    projectedFulfillmentCost: 1_250,
  }), -25);
});

test('rejects unsupported delivery models, zero hourly cost, and invalid target margins', () => {
  assert.throws(() => resolveFulfillmentHourlyCost('agency' as 'custom'), /delivery model/i);
  assert.throws(() => resolveFulfillmentHourlyCost('custom', 0), /greater than zero/i);
  assert.throws(() => calculateMonthlyAllottedHours({
    monthlyRetainer: 1_000,
    fulfillmentHourlyCost: 46,
    targetMarginPercent: -1,
  }), /target margin percent must be nonnegative/i);
  assert.throws(() => calculateMonthlyAllottedHours({
    monthlyRetainer: 1_000,
    fulfillmentHourlyCost: 46,
    targetMarginPercent: 100,
  }), /less than 100/i);
});

test('rejects non-finite, negative, and out-of-range projection inputs', () => {
  assert.throws(() => calculateMonthlyAllottedHours({
    monthlyRetainer: Number.NaN,
    fulfillmentHourlyCost: 46,
  }), /monthly retainer must be a finite number/i);
  assert.throws(() => calculateProjectedHours({ hoursUsed: -1, daysInMonth: 30, elapsedDays: 10 }), /hours used must be nonnegative/i);
  assert.throws(() => calculateProjectedHours({ hoursUsed: 1, daysInMonth: 32, elapsedDays: 10 }), /days in month must be an integer between 28 and 31/i);
  assert.throws(() => calculateProjectedHours({ hoursUsed: 1, daysInMonth: 30, elapsedDays: 31 }), /elapsed days must be an integer between 0 and days in month/i);
  assert.throws(() => calculateProjectedFulfillmentCost({
    projectedHours: Number.POSITIVE_INFINITY,
    fulfillmentHourlyCost: 46,
  }), /projected hours must be a finite number/i);
  assert.throws(() => calculateProjectedRealizedMarginPercent({
    monthlyRetainer: 1_000,
    projectedFulfillmentCost: -1,
  }), /projected fulfillment cost must be nonnegative/i);
});
