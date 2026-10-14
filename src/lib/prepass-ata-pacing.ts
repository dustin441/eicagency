import {
  ATA_BUDGET_MONTH_END,
  ATA_BUDGET_MONTH_START,
  ATA_GROUNDTRUTH_BUDGET,
  ATA_GROUNDTRUTH_FLIGHT_END,
  ATA_GROUNDTRUTH_FLIGHT_START,
  ATA_NORMAL_CHANNEL_BUDGET,
  ATA_TOTAL_EVENT_BUDGET,
} from './prepass-ata-scope.ts';

export type PacingWindow = {
  budget: number;
  spend: number;
  expectedSpend: number;
  remainingBudget: number;
  dailyNeeded: number;
  completedDays: number;
  remainingDays: number;
  flightDays: number;
  cutoff: string;
};

export type AtaPacing = {
  budget: number;
  spend: number;
  spendComplete: boolean;
  expectedSpend: number;
  remainingBudget: number | null;
  paceDelta: number | null;
};

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function fullDaysInclusive(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function buildFixedWindowPacing({
  budget,
  spend,
  start,
  end,
  now = new Date(),
}: {
  budget: number;
  spend: number;
  start: string;
  end: string;
  now?: Date;
}): PacingWindow {
  const windowStart = utcDate(start);
  const windowEnd = utcDate(end);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const cutoff = yesterday < windowStart ? new Date(windowStart) : yesterday > windowEnd ? new Date(windowEnd) : yesterday;
  const flightDays = fullDaysInclusive(windowStart, windowEnd);
  const completedDays = yesterday < windowStart ? 0 : Math.min(flightDays, fullDaysInclusive(windowStart, cutoff));
  const remainingDays = Math.max(0, flightDays - completedDays);
  const expectedSpend = budget * (completedDays / flightDays);
  const remainingBudget = budget - spend;

  return {
    budget,
    spend,
    expectedSpend,
    remainingBudget,
    dailyNeeded: remainingDays > 0 ? Math.max(0, remainingBudget) / remainingDays : 0,
    completedDays,
    remainingDays,
    flightDays,
    cutoff: isoDate(cutoff),
  };
}

export function buildGroundTruthPacing({
  spend,
  now = new Date(),
}: {
  spend: number;
  now?: Date;
}): PacingWindow {
  return buildFixedWindowPacing({
    budget: ATA_GROUNDTRUTH_BUDGET,
    spend,
    start: ATA_GROUNDTRUTH_FLIGHT_START,
    end: ATA_GROUNDTRUTH_FLIGHT_END,
    now,
  });
}

export function buildAtaPacing({
  normalSpend,
  groundTruthSpend,
  now = new Date(),
}: {
  normalSpend: number;
  groundTruthSpend: number | null;
  now?: Date;
}): AtaPacing {
  const normal = buildFixedWindowPacing({
    budget: ATA_NORMAL_CHANNEL_BUDGET,
    spend: normalSpend,
    start: ATA_BUDGET_MONTH_START,
    end: ATA_BUDGET_MONTH_END,
    now,
  });
  const groundTruth = buildGroundTruthPacing({ spend: groundTruthSpend ?? 0, now });
  const spendComplete = groundTruthSpend !== null;
  const spend = normalSpend + (groundTruthSpend ?? 0);
  const expectedSpend = normal.expectedSpend + groundTruth.expectedSpend;

  return {
    budget: ATA_TOTAL_EVENT_BUDGET,
    spend,
    spendComplete,
    expectedSpend,
    remainingBudget: spendComplete ? ATA_TOTAL_EVENT_BUDGET - spend : null,
    paceDelta: spendComplete ? spend - expectedSpend : null,
  };
}
