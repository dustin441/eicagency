export type AuritBudgetRow = {
  client: string;
  budget: number | string | null;
  period_start: string;
};

export type AuritMonthlyBudget = {
  monthStart: string;
  meta: number | null;
  youtube: number | null;
  total: number | null;
};

// Saved monthly plans carry forward until a newer effective row is available.
export function mapAuritMonthlyBudget(rows: AuritBudgetRow[], monthStart: string): AuritMonthlyBudget {
  function latestBudget(client: string): number | null {
    const latest = rows
      .filter(row => row.client === client && row.period_start <= monthStart)
      .sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
    if (!latest || latest.budget === null || String(latest.budget).trim() === '') return null;
    const value = Number(latest.budget);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const meta = latestBudget('aurit_meta');
  const youtube = latestBudget('aurit_youtube');
  return { monthStart, meta, youtube, total: meta !== null && youtube !== null ? meta + youtube : null };
}
