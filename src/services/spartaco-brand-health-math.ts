export type MetricDirection = 'higher' | 'lower';

export function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function weightedRate<T>(
  rows: T[],
  numerator: (row: T) => number,
  denominator: (row: T) => number,
): number | null {
  const totalNumerator = rows.reduce((sum, row) => sum + (Number(numerator(row)) || 0), 0);
  const totalDenominator = rows.reduce((sum, row) => sum + (Number(denominator(row)) || 0), 0);
  return safeRate(totalNumerator, totalDenominator);
}

export function benchmarkDelta(
  actual: number | null,
  benchmark: number | null,
  direction: MetricDirection,
): number | null {
  if (actual === null || benchmark === null || benchmark === 0) return null;
  const raw = (actual - benchmark) / benchmark;
  return direction === 'lower' ? -raw : raw;
}

function isoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function completedMonthRange(now = new Date()): {
  start: string;
  end: string;
  latestMonth: string;
  monthKeys: string[];
} {
  const latestMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const startDate = new Date(Date.UTC(
    latestMonthStart.getUTCFullYear(),
    latestMonthStart.getUTCMonth() - 23,
    1,
  ));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const monthKeys = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + index,
      1,
    ));
    return isoDate(date).slice(0, 7);
  });

  return {
    start: isoDate(startDate),
    end: isoDate(endDate),
    latestMonth: monthKeys[monthKeys.length - 1],
    monthKeys,
  };
}

export function monthLabel(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}