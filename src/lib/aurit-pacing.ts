import type { AuritMonthlyBudget } from './aurit-budgets';

export type AuritPacingDay = { date: string; channel: 'Meta' | 'Google'; campaignType: string | null; cost: number };
export type AuritPacingPoint = { date: string; planned: number | null; actual: number | null };
export type AuritPacingCard = {
  budget: number | null; spend: number | null; expected: number | null;
  remaining: number | null; spentPercent: number | null; expectedPercent: number | null;
  variance: number | null; status: string; points: AuritPacingPoint[];
};
export type AuritPacing = {
  monthStart: string; monthEnd: string; cutoff: string | null; yesterday: string;
  metaLatest: string | null; youtubeLatest: string | null;
  overall: AuritPacingCard; meta: AuritPacingCard; youtube: AuritPacingCard;
};

// UTC reporting dates match the existing dashboard date utilities. Incomplete
// current-day data is excluded, and all three views share the same cutoff.
export function buildAuritPacing(budgets: AuritMonthlyBudget, rows: AuritPacingDay[], today: string): AuritPacing {
  const monthStart = budgets.monthStart;
  const start = new Date(`${monthStart}T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const daysInMonth = Number(monthEnd.slice(-2));
  const yesterday = new Date(new Date(`${today}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const valid = rows.filter(r => r.date >= monthStart && r.date <= monthEnd && r.date <= yesterday && (r.channel === 'Meta' || r.campaignType === 'VIDEO'));
  if (valid.some(r => !Number.isFinite(r.cost))) throw new Error('Invalid Aurit pacing spend');
  const meta = valid.filter(r => r.channel === 'Meta');
  const youtube = valid.filter(r => r.channel === 'Google' && r.campaignType === 'VIDEO');
  const latest = (list: AuritPacingDay[]) => list.length ? list.map(r => r.date).sort().at(-1)! : null;
  const metaLatest = latest(meta), youtubeLatest = latest(youtube);
  const cutoff = metaLatest && youtubeLatest ? [metaLatest, youtubeLatest].sort()[0] : metaLatest ?? youtubeLatest;
  const elapsed = cutoff ? Number(cutoff.slice(-2)) : 0;
  const delayed = cutoff !== null && cutoff < yesterday;
  const noCompletedDay = yesterday < monthStart;

  function card(budget: number | null, source: AuritPacingDay[], available: boolean): AuritPacingCard {
    let cumulative = 0;
    const byDay = new Map<string, number>();
    for (const row of source) byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.cost);
    const points = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${monthStart.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
      cumulative += byDay.get(date) ?? 0;
      return { date, planned: budget === null ? null : budget * (i + 1) / daysInMonth,
        actual: available && cutoff !== null && date <= cutoff ? cumulative : null };
    });
    const spend = available && cutoff ? source.filter(r => r.date <= cutoff).reduce((sum, row) => sum + row.cost, 0) : null;
    const expected = budget === null || !cutoff ? null : budget * elapsed / daysInMonth;
    const variance = spend === null || expected === null ? null : spend - expected;
    const status = noCompletedDay ? 'Awaiting completed day' : !available ? 'Unavailable' : delayed ? 'Data delayed' : budget === null ? 'Budget unavailable' : budget === 0 ? 'No active budget' : spend! < expected! * 0.9 ? 'Behind pace' : spend! > expected! * 1.1 ? 'Ahead of pace' : 'On pace';
    return { budget, spend, expected, variance, status, points,
      remaining: budget === null || spend === null ? null : budget - spend,
      spentPercent: budget === null || budget <= 0 || spend === null ? null : spend / budget * 100,
      expectedPercent: cutoff ? elapsed / daysInMonth * 100 : null };
  }
  return { monthStart, monthEnd, cutoff, yesterday, metaLatest, youtubeLatest,
    meta: card(budgets.meta, meta, metaLatest !== null),
    youtube: card(budgets.youtube, youtube, youtubeLatest !== null),
    overall: card(budgets.total, [...meta, ...youtube], metaLatest !== null && youtubeLatest !== null) };
}
