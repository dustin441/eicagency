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

export function availableMonthAverage<T extends { date: string }>(
  rows: T[],
  value: (row: T) => number,
): number | null {
  const monthlyTotals = new Map<string, number>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + (Number(value(row)) || 0));
  }
  if (monthlyTotals.size === 0) return null;
  return Array.from(monthlyTotals.values()).reduce((total, current) => total + current, 0)
    / monthlyTotals.size;
}

export function availableSourceTotal<T>(
  rows: T[],
  value: (row: T) => number,
): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((total, row) => total + (Number(value(row)) || 0), 0);
}

export function sourceMonthCoverage<T extends { date: string }>(
  rows: T[],
  expectedMonths: string[],
): {
  monthsAvailable: number;
  monthsExpected: number;
  firstMonth: string | null;
  lastMonth: string | null;
  missingMonths: string[];
} {
  const months = Array.from(new Set(rows.map(row => row.date.slice(0, 7)))).sort();
  const availableMonths = new Set(months);
  return {
    monthsAvailable: months.length,
    monthsExpected: expectedMonths.length,
    firstMonth: months[0] ?? null,
    lastMonth: months[months.length - 1] ?? null,
    missingMonths: expectedMonths.filter(month => !availableMonths.has(month)),
  };
}

export type PropertyDailyMetricRow = {
  date: string;
  sessions: number | string | null;
  engaged_sessions: number | string | null;
  total_revenue: number | string | null;
};

export type PropertyMonthlyMetricPoint = {
  month: string;
  sessions: number | null;
  engagedSessions: number | null;
  totalRevenue: number | null;
  daysReported: number;
  daysExpected: number;
  complete: boolean;
};

function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildPropertyMonthlySeries<T extends PropertyDailyMetricRow>(
  rows: T[],
  expectedMonths: string[],
): PropertyMonthlyMetricPoint[] {
  const byMonth = new Map<string, T[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), row]);
  }

  return expectedMonths.map(month => {
    const monthRows = byMonth.get(month) ?? [];
    const daysReported = new Set(monthRows.map(row => row.date.slice(0, 10))).size;
    const daysExpected = daysInMonth(month);
    const complete = daysReported === daysExpected;
    const sumField = (field: 'sessions' | 'engaged_sessions' | 'total_revenue') =>
      monthRows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

    return {
      month,
      sessions: complete ? sumField('sessions') : null,
      engagedSessions: complete ? sumField('engaged_sessions') : null,
      totalRevenue: complete ? sumField('total_revenue') : null,
      daysReported,
      daysExpected,
      complete,
    };
  });
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

const NON_PRODUCT_LABELS = new Set(['', 'Other', 'Brand', 'Shopping', '10% Off Promo', 'Unknown']);

export function canonicalProductName(
  parentProduct: string | null | undefined,
  mondayProduct: string | null | undefined,
  product: string | null | undefined,
): string | null {
  for (const candidate of [parentProduct, mondayProduct, product]) {
    const normalized = candidate?.trim() ?? '';
    if (!NON_PRODUCT_LABELS.has(normalized)) return normalized;
  }
  return null;
}