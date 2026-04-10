import { createServerSupabaseClient } from '@/lib/supabase-server';

// ─── Filter Params ────────────────────────────────────────────────────────────

export type FilterParams = {
  start: string;      // YYYY-MM-DD — current period start
  end: string;        // YYYY-MM-DD — current period end
  compStart: string;  // YYYY-MM-DD — comparison period start
  compEnd: string;    // YYYY-MM-DD — comparison period end
  channel?: string;   // 'all' | 'Google' | 'Meta'
  focus?: string;     // 'all' | 'SMB' | 'ABM' | 'FD360' (Overall page only)
};

/** Compute default FilterParams for the current month vs previous month */
export function defaultFilterParams(): FilterParams {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const end = now.toISOString().split('T')[0];
  const prevFirst = new Date(y, m - 1, 1);
  const prevLast  = new Date(y, m, 0);
  return {
    start,
    end,
    compStart: prevFirst.toISOString().split('T')[0],
    compEnd:   prevLast.toISOString().split('T')[0],
    channel: 'all',
    focus: 'all',
  };
}

/** Build FilterParams from raw URL searchParams (with fallback defaults) */
export function paramsFromSearch(p: Record<string, string | undefined>): FilterParams {
  const defaults = defaultFilterParams();
  return {
    start:     p.start     ?? defaults.start,
    end:       p.end       ?? defaults.end,
    compStart: p.comp_start ?? defaults.compStart,
    compEnd:   p.comp_end   ?? defaults.compEnd,
    channel:   p.channel   ?? 'all',
    focus:     p.focus     ?? 'all',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FocusStats = {
  focus: string;
  filterParams: FilterParams;
  // Budget pacing (from budgets table)
  budget: number;
  googleBudgetSpent: number;
  metaBudgetSpent: number;
  // Current period totals
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  platformConversions: number; // platform-reported leads
  totalMqls: number;
  totalSqls: number;
  totalWon: number;
  callMqls: number;
  enrollmentMqls: number;
  callSqls: number;
  enrollmentSqls: number;
  callWon: number;
  enrollmentWon: number;
  // Previous period (for change %)
  prevSpend: number;
  prevImpressions: number;
  prevClicks: number;
  prevConversions: number;
  prevMqls: number;
  prevWon: number;
  // Platform split
  googleSpend: number;
  metaSpend: number;
  googleClicks: number;
  metaClicks: number;
  googleImpressions: number;
  metaImpressions: number;
  googleConversions: number;
  metaConversions: number;
  googleMqls: number;
  metaMqls: number;
  googleWon: number;
  metaWon: number;
  // Daily trend (date range)
  dailyData: { date: string; spend: number; mql: number }[];
  // Top campaigns
  campaigns: {
    name: string; platform: string; spend: number; clicks: number;
    impressions: number; conversions: number; mqls: number; sqls: number; won: number;
  }[];
};

export type DashboardStats = {
  filterParams: FilterParams;
  // Current period aggregates
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  platformConversions: number;
  totalMqls: number;
  totalSqls: number;
  totalWon: number;
  // Previous period
  prevSpend: number;
  prevClicks: number;
  prevImpressions: number;
  prevConversions: number;
  prevMqls: number;
  prevWon: number;
  // Daily trend
  dailyData: { date: string; spend: number; mql: number }[];
  // Channel breakdown
  channels: { name: string; spend: number; clicks: number; mqls: number; sqls: number; won: number }[];
};

// ─── MMP row type ─────────────────────────────────────────────────────────────

type MmpRow = {
  date: string;
  platform: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  platform_conversions: number;
  mqls: number;
  sqls: number;
  closed_won: number;
  call_mqls: number;
  call_sqls: number;
  call_won: number;
  enrollment_mqls: number;
  enrollment_sqls: number;
  enrollment_won: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sum(rows: Record<string, unknown>[] | null | undefined, key: string): number {
  return rows?.reduce((acc, row) => acc + (Number(row[key]) || 0), 0) ?? 0;
}

function sumField(rows: MmpRow[], key: keyof MmpRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function byPlatform(rows: MmpRow[], platform: string): MmpRow[] {
  return rows.filter((r) => r.platform === platform);
}

function applyChannelFilter(
  query: ReturnType<ReturnType<typeof createServerSupabaseClient>['from']>,
  channel?: string
) {
  if (channel && channel !== 'all') {
    return (query as unknown as { eq: (col: string, val: string) => typeof query }).eq('platform', channel);
  }
  return query;
}

// ─── fetchFocusData ───────────────────────────────────────────────────────────

export async function fetchFocusData(focus: string, params: FilterParams): Promise<FocusStats> {
  const supabase = createServerSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  const SELECT_COLS = 'date,platform,campaign_name,spend,impressions,clicks,platform_conversions,mqls,sqls,closed_won,call_mqls,call_sqls,call_won,enrollment_mqls,enrollment_sqls,enrollment_won';

  const budgetClient = focus === 'FD360' ? 'FD360' : focus === 'ABM' ? 'ABM' : 'SMB';

  // Build base queries
  let currQ = supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', focus).gte('date', start).lte('date', end);
  let prevQ = supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', focus).gte('date', compStart).lte('date', compEnd);
  let trendQ = supabase.from('master_marketing_performance').select('date,spend,mqls').eq('focus', focus).gte('date', start).lte('date', end).order('date');

  // Apply channel filter
  if (channel && channel !== 'all') {
    currQ  = (currQ  as unknown as { eq: (c: string, v: string) => typeof currQ  }).eq('platform', channel);
    prevQ  = (prevQ  as unknown as { eq: (c: string, v: string) => typeof prevQ  }).eq('platform', channel);
    trendQ = (trendQ as unknown as { eq: (c: string, v: string) => typeof trendQ }).eq('platform', channel);
  }

  const [
    { data: currRows },
    { data: prevRows },
    { data: trendRows },
    { data: budgetRow },
  ] = await Promise.all([
    currQ,
    prevQ,
    trendQ,
    supabase.from('budgets').select('budget,google_spent,meta_spent').eq('client', budgetClient).single(),
  ]);

  const curr = (currRows ?? []) as MmpRow[];
  const prevData = (prevRows ?? []) as MmpRow[];

  const google = byPlatform(curr, 'Google');
  const meta   = byPlatform(curr, 'Meta');

  // ── Current ──────────────────────────────────────────────────────────────────
  const totalSpend         = sumField(curr, 'spend');
  const totalImpressions   = sumField(curr, 'impressions');
  const totalClicks        = sumField(curr, 'clicks');
  const platformConversions = sumField(curr, 'platform_conversions');
  const totalMqls          = sumField(curr, 'mqls');
  const totalSqls          = sumField(curr, 'sqls');
  const totalWon           = sumField(curr, 'closed_won');
  const callMqls           = sumField(curr, 'call_mqls');
  const enrollmentMqls     = sumField(curr, 'enrollment_mqls');
  const callSqls           = sumField(curr, 'call_sqls');
  const enrollmentSqls     = sumField(curr, 'enrollment_sqls');
  const callWon            = sumField(curr, 'call_won');
  const enrollmentWon      = sumField(curr, 'enrollment_won');

  // ── Previous ─────────────────────────────────────────────────────────────────
  const prevSpend       = sumField(prevData, 'spend');
  const prevImpressions = sumField(prevData, 'impressions');
  const prevClicks      = sumField(prevData, 'clicks');
  const prevConversions = sumField(prevData, 'platform_conversions');
  const prevMqls        = sumField(prevData, 'mqls');
  const prevWon         = sumField(prevData, 'closed_won');

  // ── Platform split ────────────────────────────────────────────────────────────
  const googleSpend       = sumField(google, 'spend');
  const metaSpend         = sumField(meta, 'spend');
  const googleClicks      = sumField(google, 'clicks');
  const metaClicks        = sumField(meta, 'clicks');
  const googleImpressions = sumField(google, 'impressions');
  const metaImpressions   = sumField(meta, 'impressions');
  const googleConversions = sumField(google, 'platform_conversions');
  const metaConversions   = sumField(meta, 'platform_conversions');
  const googleMqls        = sumField(google, 'mqls');
  const metaMqls          = sumField(meta, 'mqls');
  const googleWon         = sumField(google, 'closed_won');
  const metaWon           = sumField(meta, 'closed_won');

  // ── Daily trend ───────────────────────────────────────────────────────────────
  const trendMap = new Map<string, { spend: number; mql: number }>();
  // Seed every date in the current range
  const rangeStart = new Date(start + 'T12:00:00');
  const rangeEnd   = new Date(end   + 'T12:00:00');
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0 });
  }
  (trendRows ?? []).forEach((r: { date: string; spend: number; mqls: number }) => {
    const e = trendMap.get(r.date) ?? { spend: 0, mql: 0 };
    trendMap.set(r.date, { spend: e.spend + Number(r.spend), mql: e.mql + Number(r.mqls) });
  });
  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date, spend: Math.round(s.spend), mql: Math.round(s.mql),
  }));

  // ── Campaign rollup ───────────────────────────────────────────────────────────
  const campaignMap = new Map<string, {
    platform: string; spend: number; clicks: number; impressions: number;
    conversions: number; mqls: number; sqls: number; won: number;
  }>();
  curr.forEach((r) => {
    const key = `${r.campaign_name}||${r.platform}`;
    const e = campaignMap.get(key) ?? { platform: r.platform, spend: 0, clicks: 0, impressions: 0, conversions: 0, mqls: 0, sqls: 0, won: 0 };
    campaignMap.set(key, {
      platform: r.platform,
      spend:       e.spend       + Number(r.spend),
      clicks:      e.clicks      + Number(r.clicks),
      impressions: e.impressions + Number(r.impressions),
      conversions: e.conversions + Number(r.platform_conversions),
      mqls:        e.mqls        + Number(r.mqls),
      sqls:        e.sqls        + Number(r.sqls),
      won:         e.won         + Number(r.closed_won),
    });
  });
  const campaigns = Array.from(campaignMap.entries())
    .map(([key, v]) => ({ name: key.split('||')[0], ...v }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  return {
    focus, filterParams: params,
    budget: Number(budgetRow?.budget ?? 0),
    googleBudgetSpent: Number(budgetRow?.google_spent ?? 0),
    metaBudgetSpent: Number(budgetRow?.meta_spent ?? 0),
    totalSpend, totalImpressions, totalClicks, platformConversions,
    totalMqls, totalSqls, totalWon,
    callMqls, enrollmentMqls, callSqls, enrollmentSqls, callWon, enrollmentWon,
    prevSpend, prevImpressions, prevClicks, prevConversions, prevMqls, prevWon,
    googleSpend, metaSpend, googleClicks, metaClicks,
    googleImpressions, metaImpressions,
    googleConversions, metaConversions,
    googleMqls, metaMqls, googleWon, metaWon,
    dailyData, campaigns,
  };
}

// ─── fetchDashboardData (Overall) ─────────────────────────────────────────────

export async function fetchDashboardData(params: FilterParams): Promise<DashboardStats> {
  const supabase = createServerSupabaseClient();
  const { start, end, compStart, compEnd, channel, focus } = params;

  const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; })();
  const today = new Date().toISOString().split('T')[0];

  // Build platform queries for current/prev/trend
  function platformQuery(table: string, cols: string, dateStart: string, dateEnd: string) {
    let q = supabase.from(table).select(cols).gte('date', dateStart).lte('date', dateEnd);
    if (channel && channel !== 'all') {
      // google_campaigns uses 'Product' not 'platform' — skip channel filter for legacy tables
    }
    return q;
  }

  const [
    { data: gCurr },
    { data: mCurr },
    { data: lCurr },
    { data: gPrev },
    { data: mPrev },
    { data: lPrev },
    { data: gTrend },
    { data: mTrend },
    { count: gMqlAll },
    { count: mMqlAll },
    { count: gWonAll },
    { count: mWonAll },
    { data: mmpCurr },
    { data: mmpPrev },
  ] = await Promise.all([
    platformQuery('google_campaigns', 'cost,clicks,impressions,conversions', start, end),
    platformQuery('meta_campaigns', 'spend,clicks,impressions,leads', start, end),
    supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', start).lte('date', end),
    platformQuery('google_campaigns', 'cost,clicks,impressions', compStart, compEnd),
    platformQuery('meta_campaigns', 'spend,clicks,impressions,leads', compStart, compEnd),
    supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', compStart).lte('date', compEnd),
    platformQuery('google_campaigns', 'date,cost,conversions', thirtyDaysAgo, today),
    platformQuery('meta_campaigns', 'date,spend,leads', thirtyDaysAgo, today),
    supabase.from('Google MQL').select('*', { count: 'exact', head: true }),
    supabase.from('Meta MQL').select('*', { count: 'exact', head: true }),
    supabase.from('Google WON').select('*', { count: 'exact', head: true }),
    supabase.from('Meta WON').select('*', { count: 'exact', head: true }),
    // MMP for MQL/SQL/Won (has proper focus + funnel data)
    (() => {
      let q = supabase.from('master_marketing_performance')
        .select('spend,platform_conversions,mqls,sqls,closed_won')
        .gte('date', start).lte('date', end);
      if (focus && focus !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('focus', focus);
      if (channel && channel !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('platform', channel);
      return q;
    })(),
    (() => {
      let q = supabase.from('master_marketing_performance')
        .select('spend,platform_conversions,mqls,sqls,closed_won')
        .gte('date', compStart).lte('date', compEnd);
      if (focus && focus !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('focus', focus);
      if (channel && channel !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('platform', channel);
      return q;
    })(),
  ]);

  const totalSpend = sum(gCurr, 'cost') + sum(mCurr, 'spend') + sum(lCurr, 'spend');
  const prevSpend  = sum(gPrev, 'cost') + sum(mPrev, 'spend') + sum(lPrev, 'spend');
  const totalClicks = sum(gCurr, 'clicks') + sum(mCurr, 'clicks') + sum(lCurr, 'clicks');
  const prevClicks  = sum(gPrev, 'clicks') + sum(mPrev, 'clicks') + sum(lPrev, 'clicks');
  const totalImpressions = sum(gCurr, 'impressions') + sum(mCurr, 'impressions') + sum(lCurr, 'impressions');
  const prevImpressions  = sum(gPrev, 'impressions') + sum(mPrev, 'impressions') + sum(lPrev, 'impressions');

  // MQL/SQL/Won from MMP (respects focus + channel filters)
  const mmpCurrRows = (mmpCurr ?? []) as Record<string, unknown>[];
  const mmpPrevRows = (mmpPrev ?? []) as Record<string, unknown>[];
  const platformConversions = sum(mmpCurrRows, 'platform_conversions');
  const prevConversions     = sum(mmpPrevRows, 'platform_conversions');
  const totalMqls  = sum(mmpCurrRows, 'mqls');
  const prevMqls   = sum(mmpPrevRows, 'mqls');
  const totalSqls  = sum(mmpCurrRows, 'sqls');
  const totalWon   = sum(mmpCurrRows, 'closed_won');
  const prevWon    = sum(mmpPrevRows, 'closed_won');

  // Daily trend (always last 30 days, unaffected by date filter)
  const trendMap = new Map<string, { spend: number; mql: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0 });
  }
  gTrend?.forEach((r) => {
    const e = trendMap.get(r.date as string) ?? { spend: 0, mql: 0 };
    trendMap.set(r.date as string, { spend: e.spend + Number(r.cost), mql: e.mql + Number(r.conversions) });
  });
  mTrend?.forEach((r) => {
    const e = trendMap.get(r.date as string) ?? { spend: 0, mql: 0 };
    trendMap.set(r.date as string, { spend: e.spend + Number(r.spend), mql: e.mql + Number(r.leads) });
  });
  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date, spend: Math.round(s.spend), mql: Math.round(s.mql),
  }));

  const channels = [
    { name: 'Google Ads',   spend: sum(gCurr, 'cost'),  clicks: sum(gCurr, 'clicks'),  mqls: gMqlAll ?? 0, sqls: 0, won: gWonAll ?? 0 },
    { name: 'Meta Ads',     spend: sum(mCurr, 'spend'), clicks: sum(mCurr, 'clicks'),  mqls: mMqlAll ?? 0, sqls: 0, won: mWonAll ?? 0 },
    { name: 'LinkedIn Ads', spend: sum(lCurr, 'spend'), clicks: sum(lCurr, 'clicks'),  mqls: 0, sqls: 0, won: 0 },
  ];

  return {
    filterParams: params,
    totalSpend, totalClicks, totalImpressions, platformConversions,
    totalMqls, totalSqls, totalWon,
    prevSpend, prevClicks, prevImpressions, prevConversions, prevMqls, prevWon,
    dailyData, channels,
  };
}
