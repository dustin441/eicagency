import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATA_GROUNDTRUTH_BUDGET,
  ATA_NORMAL_CHANNEL_BUDGET,
  ATA_TOTAL_EVENT_BUDGET,
} from './prepass-ata-scope.ts';
import {
  buildAtaPacing,
  buildGroundTruthPacing,
} from './prepass-ata-pacing.ts';

test('ATA approved budget split is fixed at $9,000 + $6,000 = $15,000', () => {
  assert.equal(ATA_NORMAL_CHANNEL_BUDGET, 9_000);
  assert.equal(ATA_GROUNDTRUTH_BUDGET, 6_000);
  assert.equal(ATA_TOTAL_EVENT_BUDGET, 15_000);
  assert.equal(ATA_NORMAL_CHANNEL_BUDGET + ATA_GROUNDTRUTH_BUDGET, ATA_TOTAL_EVENT_BUDGET);
});

test('GroundTruth pacing does not expect spend before its October 15 flight', () => {
  const pacing = buildGroundTruthPacing({
    spend: 0,
    now: new Date('2026-10-14T12:00:00Z'),
  });

  assert.equal(pacing.budget, 6_000);
  assert.equal(pacing.completedDays, 0);
  assert.equal(pacing.flightDays, 6);
  assert.equal(pacing.expectedSpend, 0);
  assert.equal(pacing.remainingBudget, 6_000);
  assert.equal(pacing.dailyNeeded, 1_000);
});

test('GroundTruth pacing uses completed flight days and cumulative spend', () => {
  const pacing = buildGroundTruthPacing({
    spend: 2_400,
    now: new Date('2026-10-18T12:00:00Z'),
  });

  assert.equal(pacing.completedDays, 3);
  assert.equal(pacing.remainingDays, 3);
  assert.equal(pacing.expectedSpend, 3_000);
  assert.equal(pacing.remainingBudget, 3_600);
  assert.equal(pacing.dailyNeeded, 1_200);
});

test('total ATA pacing combines normal-channel and GroundTruth budgets and spend', () => {
  const pacing = buildAtaPacing({
    normalSpend: 1_750,
    groundTruthSpend: 2_400,
    now: new Date('2026-10-18T12:00:00Z'),
  });

  assert.equal(pacing.budget, 15_000);
  assert.equal(pacing.spend, 4_150);
  assert.equal(pacing.remainingBudget, 10_850);
  assert.equal(pacing.expectedSpend, (9_000 * 17 / 31) + 3_000);
});

test('total ATA pacing discloses incomplete spend when GroundTruth source is unavailable', () => {
  const pacing = buildAtaPacing({
    normalSpend: 1_750,
    groundTruthSpend: null,
    now: new Date('2026-10-14T12:00:00Z'),
  });

  assert.equal(pacing.spend, 1_750);
  assert.equal(pacing.spendComplete, false);
  assert.equal(pacing.remainingBudget, null);
});
