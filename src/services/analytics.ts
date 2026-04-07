import { createServerSupabaseClient } from '@/lib/supabase-server';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardStats = {
  // Current period aggregates
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalMqls: number;
  totalSqls: number;
  totalWon: number;
  // Previous period (for MoM/WoW/etc. change %)
  prevSpend: number;
  prevClicks: number;
  prevImpressions: number;
  prevMqls: number;
  prevWon: number;
  // 30-day daily trend for chart
  dailyData: { date: string; spend: number; mql: number }[];
  // Channel breakdown (spend from current period, MQL/Won all-time from attribution tables)
  channels: { name: string; spend: number; clicks: number; mqls: number; sqls: number; won: number }[];
  period: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sum(rows: Record<string, unknown>[] | null | undefined, key: string): number {
  return rows?.reduce((acc, row) => acc + (Number(row[key]) || 0), 0) ?? 0;
}

function getDateRanges(period: string) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  const prevMonthFirst = new Date(y, now.getMonth() - 1, 1);
  const prevMonthLast = new Date(y, now.getMonth(), 0);

  switch (period) {
    case 'day': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().split('T')[0];
      return { current: { start: today, end: today }, prev: { start: yd, end: yd } };
    }
    case 'week': {
      const wStart = new Date(now); wStart.setDate(wStart.getDate() - 6);
      const prevWEnd = new Date(wStart); prevWEnd.setDate(prevWEnd.getDate() - 1);
      const prevWStart = new Date(prevWEnd); prevWStart.setDate(prevWStart.getDate() - 6);
      return {
        current: { start: wStart.toISOString().split('T')[0], end: today },
        prev: { start: prevWStart.toISOString().split('T')[0], end: prevWEnd.toISOString().split('T')[0] },
      };
    }
    case 'year':
      return {
        current: { start: `${y}-01-01`, end: today },
        prev: { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
      };
    default: // month
      return {
        current: { start: `${y}-${m}-01`, end: today },
        prev: {
          start: prevMonthFirst.toISOString().split('T')[0],
          end: prevMonthLast.toISOString().split('T')[0],
        },
      };
  }
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchDashboardData(period = 'month'): Promise<DashboardStats> {
  // Uses service role key — bypasses RLS, server-only.
  const supabase = createServerSupabaseClient();
  const { current, prev } = getDateRanges(period);

  const thirtyDaysAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: gCurr },
    { data: mCurr },
    { data: lCurr },
    { data: gPrev },
    { data: mPrev },
    { data: lPrev },
    { data: gTrend },
    { data: mTrend },
    { count: mqlCount },
    { count: prevMqlCount },
    { count: sqlCount },
    { count: wonCount },
    { count: prevWonCount },
    // All-time channel attribution (dedicated tables have text dates, can't filter by period)
    { count: gMqlAll },
    { count: mMqlAll },
    { count: gWonAll },
    { count: mWonAll },
  ] = await Promise.all([
    // Current period — spend/clicks/impressions by platform
    supabase.from('google_campaigns').select('cost,clicks,impressions').gte('date', current.start).lte('date', current.end),
    supabase.from('meta_campaigns').select('spend,clicks,impressions').gte('date', current.start).lte('date', current.end),
    supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', current.start).lte('date', current.end),
    // Previous period — for change % calculation
    supabase.from('google_campaigns').select('cost,clicks,impressions').gte('date', prev.start).lte('date', prev.end),
    supabase.from('meta_campaigns').select('spend,clicks,impressions').gte('date', prev.start).lte('date', prev.end),
    supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', prev.start).lte('date', prev.end),
    // 30-day trend (always last 30 days regardless of period — best for chart)
    supabase.from('google_campaigns').select('date,cost,conversions').gte('date', thirtyDaysAgo).lte('date', today).order('date'),
    supabase.from('meta_campaigns').select('date,spend,leads').gte('date', thirtyDaysAgo).lte('date', today).order('date'),
    // MQL/SQL/Won — enrollment table has proper timestamps, best for period filtering
    supabase.from('enrollment').select('*', { count: 'exact', head: true }).not('date_mql', 'is', null).gte('date_mql', current.start),
    supabase.from('enrollment').select('*', { count: 'exact', head: true }).not('date_mql', 'is', null).gte('date_mql', prev.start).lte('date_mql', prev.end),
    supabase.from('enrollment').select('*', { count: 'exact', head: true }).not('date_sql', 'is', null).gte('date_sql', current.start),
    supabase.from('enrollment_won').select('*', { count: 'exact', head: true }).not('date_won', 'is', null).gte('date_won', current.start),
    supabase.from('enrollment_won').select('*', { count: 'exact', head: true }).not('date_won', 'is', null).gte('date_won', prev.start).lte('date_won', prev.end),
    // All-time channel attribution totals
    supabase.from('Google MQL').select('*', { count: 'exact', head: true }),
    supabase.from('Meta MQL').select('*', { count: 'exact', head: true }),
    supabase.from('Google WON').select('*', { count: 'exact', head: true }),
    supabase.from('Meta WON').select('*', { count: 'exact', head: true }),
  ]);

  // ── Aggregate totals ────────────────────────────────────────────────────────

  const totalSpend = sum(gCurr, 'cost') + sum(mCurr, 'spend') + sum(lCurr, 'spend');
  const prevSpend  = sum(gPrev, 'cost') + sum(mPrev, 'spend') + sum(lPrev, 'spend');
  const totalClicks = sum(gCurr, 'clicks') + sum(mCurr, 'clicks') + sum(lCurr, 'clicks');
  const prevClicks  = sum(gPrev, 'clicks') + sum(mPrev, 'clicks') + sum(lPrev, 'clicks');
  const totalImpressions = sum(gCurr, 'impressions') + sum(mCurr, 'impressions') + sum(lCurr, 'impressions');
  const prevImpressions  = sum(gPrev, 'impressions') + sum(mPrev, 'impressions') + sum(lPrev, 'impressions');

  // ── Daily trend (last 30 days) ──────────────────────────────────────────────

  const trendMap = new Map<string, { spend: number; mql: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0 });
  }
  gTrend?.forEach((r) => {
    const e = trendMap.get(r.date) ?? { spend: 0, mql: 0 };
    trendMap.set(r.date, { spend: e.spend + Number(r.cost), mql: e.mql + Number(r.conversions) });
  });
  mTrend?.forEach((r) => {
    const e = trendMap.get(r.date) ?? { spend: 0, mql: 0 };
    trendMap.set(r.date, { spend: e.spend + Number(r.spend), mql: e.mql + Number(r.leads) });
  });
  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date,
    spend: Math.round(s.spend),
    mql: Math.round(s.mql),
  }));

  // ── Channel breakdown ────────────────────────────────────────────────────────

  const channels = [
    {
      name: 'Google Ads',
      spend: sum(gCurr, 'cost'),
      clicks: sum(gCurr, 'clicks'),
      mqls: gMqlAll ?? 0,
      sqls: 0,
      won: gWonAll ?? 0,
    },
    {
      name: 'Meta Ads',
      spend: sum(mCurr, 'spend'),
      clicks: sum(mCurr, 'clicks'),
      mqls: mMqlAll ?? 0,
      sqls: 0,
      won: mWonAll ?? 0,
    },
    {
      name: 'LinkedIn Ads',
      spend: sum(lCurr, 'spend'),
      clicks: sum(lCurr, 'clicks'),
      mqls: 0, // LinkedIn lead tracking not yet implemented in data pipeline
      sqls: 0,
      won: 0,
    },
  ];

  return {
    totalSpend,
    totalClicks,
    totalImpressions,
    totalMqls: mqlCount ?? 0,
    totalSqls: sqlCount ?? 0,
    totalWon: wonCount ?? 0,
    prevSpend,
    prevClicks,
    prevImpressions,
    prevMqls: prevMqlCount ?? 0,
    prevWon: prevWonCount ?? 0,
    dailyData,
    channels,
    period,
  };
}
