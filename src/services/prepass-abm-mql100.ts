export type Mql100PlusWindow = { start: string; end: string };
export type FleetFunnelRow = { fleet_size: string; mqls: number | string };
export type Mql100PlusWindowResult = { window: Mql100PlusWindow; mql100Plus: number };

const MAX_QUERY_WINDOWS = 36;
const MQL_100_PLUS_BANDS = new Set(['101-500', '500+']);

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function chartBucketKey(date: Date, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') return isoDate(date);
  if (granularity === 'month') return isoDate(date).slice(0, 7);

  const monday = new Date(date);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
  return isoDate(monday);
}

export function buildMql100PlusWindows(start: string, end: string): Mql100PlusWindow[] {
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || first > last) return [];

  const dayCount = Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
  const granularity = dayCount < 30 ? 'day' : dayCount <= 90 ? 'week' : 'month';
  const windows: Mql100PlusWindow[] = [];
  let currentKey = '';

  for (const date = new Date(first); date <= last; date.setUTCDate(date.getUTCDate() + 1)) {
    const value = isoDate(date);
    const key = chartBucketKey(date, granularity);
    if (key !== currentKey) {
      if (windows.length >= MAX_QUERY_WINDOWS) return [];
      windows.push({ start: value, end: value });
      currentKey = key;
    } else {
      windows[windows.length - 1].end = value;
    }
  }

  return windows;
}

export function sumMql100Plus(rows: FleetFunnelRow[]): number {
  return rows
    .filter(row => MQL_100_PLUS_BANDS.has(row.fleet_size))
    .reduce((sum, row) => sum + Number(row.mqls ?? 0), 0);
}

export function attachMql100PlusTrend<T extends { date: string }>(
  dailyData: T[],
  results: Mql100PlusWindowResult[],
): Array<T & { mql100Plus: number }> {
  const byWindowStart = new Map(results.map(result => [result.window.start, result.mql100Plus]));
  return dailyData.map(day => ({
    ...day,
    mql100Plus: byWindowStart.get(day.date) ?? 0,
  }));
}
