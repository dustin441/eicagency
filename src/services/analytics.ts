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

export type AdSet = {
  name: string; campaign: string; spend: number;
  clicks: number; leads: number; impressions: number;
};

export type MetaCreative = {
  name: string; campaign: string; adset: string;
  headline: string; primaryText: string;
  finalCreativeLink: string; destinationUrl: string; ctaType: string;
  spend: number; leads: number; clicks: number; impressions: number;
};

export type GoogleCreative = {
  name: string; campaign: string;
  headline: string; description: string;
  spend: number; clicks: number; impressions: number; results: number;
};

export type GeoState = {
  state: string; spend: number; clicks: number; conversions: number;
};

export type ChangeEntry = {
  date: string; platform: string; who: string;
  campaign: string; objectType: string; changeType: string;
  field: string; oldValue: string; newValue: string;
};

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
  // Time between funnel stages (avg days, from enrollment tables)
  avgDaysMqlToSql: number;
  avgDaysSqlToWon: number;
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
  prevSqls: number;
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
  dailyData: { date: string; spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number }[];
  // Top campaigns
  campaigns: {
    name: string; platform: string; spend: number; clicks: number;
    impressions: number; conversions: number; mqls: number; sqls: number; won: number;
  }[];
  // Additional breakdowns
  adsets: AdSet[];
  metaCreatives: MetaCreative[];
  googleCreatives: GoogleCreative[];
  geoStates: GeoState[];
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
  // Time between funnel stages (avg days, from enrollment tables)
  avgDaysMqlToSql: number;
  avgDaysSqlToWon: number;
  // Previous period
  prevSpend: number;
  prevClicks: number;
  prevImpressions: number;
  prevConversions: number;
  prevMqls: number;
  prevSqls: number;
  prevWon: number;
  // Daily trend
  dailyData: { date: string; spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number }[];
  // Channel breakdown
  channels: { name: string; spend: number; clicks: number; mqls: number; sqls: number; won: number }[];
  // Additional
  geoStates: GeoState[];
  linkedinCampaigns: { name: string; spend: number; clicks: number; impressions: number; leads: number }[];
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

function sum(rows: unknown[] | null | undefined, key: string): number {
  return rows?.reduce<number>((acc, row) => acc + (Number((row as Record<string, unknown>)[key]) || 0), 0) ?? 0;
}

function sumField(rows: MmpRow[], key: keyof MmpRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function byPlatform(rows: MmpRow[], platform: string): MmpRow[] {
  return rows.filter((r) => r.platform === platform);
}

function avgDaysBetween(rows: unknown[] | null | undefined, fieldA: string, fieldB: string): number {
  if (!rows?.length) return 0;
  const diffs: number[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const a = r[fieldA] ? new Date(String(r[fieldA])).getTime() : 0;
    const b = r[fieldB] ? new Date(String(r[fieldB])).getTime() : 0;
    const days = (b - a) / 86400000;
    if (days > 0 && days < 365) diffs.push(days);
  }
  if (!diffs.length) return 0;
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
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
  let trendQ = supabase.from('master_marketing_performance').select('date,spend,mqls,clicks,impressions,platform_conversions,sqls').eq('focus', focus).gte('date', start).lte('date', end).order('date');

  // Apply channel filter
  if (channel && channel !== 'all') {
    currQ  = (currQ  as unknown as { eq: (c: string, v: string) => typeof currQ  }).eq('platform', channel);
    prevQ  = (prevQ  as unknown as { eq: (c: string, v: string) => typeof prevQ  }).eq('platform', channel);
    trendQ = (trendQ as unknown as { eq: (c: string, v: string) => typeof trendQ }).eq('platform', channel);
  }

  // This-month date range for budget pacing — always current month regardless of date filter
  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thisMonthEnd   = now.toISOString().split('T')[0];

  // Cutoff for enrollment time queries — last 12 months for meaningful sample
  const enrollCutoff = new Date(now);
  enrollCutoff.setFullYear(enrollCutoff.getFullYear() - 1);
  const enrollCutoffStr = enrollCutoff.toISOString().split('T')[0];

  const [
    { data: currRows },
    { data: prevRows },
    { data: trendRows },
    { data: budgetRow },
    { data: pacingRows },
    { data: enrollRows },
    { data: enrollWonRows },
  ] = await Promise.all([
    currQ,
    prevQ,
    trendQ,
    supabase.from('budgets').select('budget').eq('client', budgetClient).single(),
    // This-month spend by platform — no channel filter so budget always reflects full spend
    supabase.from('master_marketing_performance')
      .select('platform,spend')
      .eq('focus', focus)
      .gte('date', thisMonthStart)
      .lte('date', thisMonthEnd),
    // Avg days MQL → SQL
    supabase.from('enrollment')
      .select('date_mql,date_sql')
      .not('date_mql', 'is', null)
      .not('date_sql', 'is', null)
      .gte('date_mql', enrollCutoffStr),
    // Avg days SQL → Won
    supabase.from('enrollment_won')
      .select('date_sql,date_won')
      .not('date_sql', 'is', null)
      .not('date_won', 'is', null)
      .gte('date_sql', enrollCutoffStr),
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
  const prevSqls        = sumField(prevData, 'sqls');
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
  const trendMap = new Map<string, { spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number }>();
  // Seed every date in the current range
  const rangeStart = new Date(start + 'T12:00:00');
  const rangeEnd   = new Date(end   + 'T12:00:00');
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0 });
  }
  const trendRowsCast = (trendRows ?? []) as unknown as { date: string; spend: number; mqls: number; clicks: number; impressions: number; platform_conversions: number; sqls: number }[];
  trendRowsCast.forEach((r) => {
    const e = trendMap.get(r.date) ?? { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0 };
    trendMap.set(r.date, {
      spend:               e.spend               + Number(r.spend),
      mql:                 e.mql                 + Number(r.mqls),
      clicks:              e.clicks              + Number(r.clicks),
      impressions:         e.impressions         + Number(r.impressions),
      platformConversions: e.platformConversions + Number(r.platform_conversions),
      sqls:                e.sqls                + Number(r.sqls),
    });
  });
  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date,
    spend:               Math.round(s.spend),
    mql:                 Math.round(s.mql),
    clicks:              Math.round(s.clicks),
    impressions:         Math.round(s.impressions),
    platformConversions: Math.round(s.platformConversions),
    sqls:                Math.round(s.sqls),
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

  // ── Second batch: adsets, creatives, geo (filtered by campaign names) ─────────
  const campaignNames = [...new Set(curr.map(r => r.campaign_name))].filter(Boolean);

  const [
    { data: adsetData },
    { data: metaCreativeData },
    { data: googleCreativeData },
    { data: geoData },
  ] = await Promise.all([
    campaignNames.length > 0
      ? supabase.from('meta_adset').select('adset_name,campaign_name,spend,clicks,leads,impressions').in('campaign_name', campaignNames).gte('date', start).lte('date', end).order('spend', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    campaignNames.length > 0
      ? supabase.from('meta_ads_creatives').select('ad_name,campaign_name,adset_name,headline,primary_text,final_creative_link,destination_url,cta_type,spend,leads,clicks,impressions').in('campaign_name', campaignNames).gte('date', start).lte('date', end).order('spend', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    campaignNames.length > 0
      ? supabase.from('google_search_ads_creatives').select('ad_id,campaign_name,headline_1,headline_2,description_1,clicks,impressions,cost,results').in('campaign_name', campaignNames).gte('date', start).lte('date', end).order('cost', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    campaignNames.length > 0
      ? supabase.from('google_geo_state').select('state_name,cost,clicks,conversions').in('campaign_name', campaignNames).gte('date', start).lte('date', end)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  // Rollup adsets
  const adsetMap = new Map<string, { campaign: string; spend: number; clicks: number; leads: number; impressions: number }>();
  (adsetData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const key = `${r.adset_name}||${r.campaign_name}`;
    const e = adsetMap.get(key) ?? { campaign: String(r.campaign_name ?? ''), spend: 0, clicks: 0, leads: 0, impressions: 0 };
    adsetMap.set(key, { campaign: e.campaign, spend: e.spend + Number(r.spend), clicks: e.clicks + Number(r.clicks), leads: e.leads + Number(r.leads), impressions: e.impressions + Number(r.impressions) });
  });
  const adsets = Array.from(adsetMap.entries()).map(([key, v]) => ({ name: key.split('||')[0], ...v })).sort((a, b) => b.spend - a.spend).slice(0, 30);

  // Rollup meta creatives
  const metaCreativeMap = new Map<string, { campaign: string; adset: string; headline: string; primaryText: string; finalCreativeLink: string; destinationUrl: string; ctaType: string; spend: number; leads: number; clicks: number; impressions: number }>();
  (metaCreativeData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const key = `${r.ad_name}||${r.campaign_name}`;
    const e = metaCreativeMap.get(key) ?? { campaign: String(r.campaign_name ?? ''), adset: String(r.adset_name ?? ''), headline: String(r.headline ?? ''), primaryText: String(r.primary_text ?? ''), finalCreativeLink: String(r.final_creative_link ?? ''), destinationUrl: String(r.destination_url ?? ''), ctaType: String(r.cta_type ?? ''), spend: 0, leads: 0, clicks: 0, impressions: 0 };
    metaCreativeMap.set(key, { ...e, primaryText: e.primaryText || String(r.primary_text ?? ''), finalCreativeLink: e.finalCreativeLink || String(r.final_creative_link ?? ''), destinationUrl: e.destinationUrl || String(r.destination_url ?? ''), ctaType: e.ctaType || String(r.cta_type ?? ''), spend: e.spend + Number(r.spend), leads: e.leads + Number(r.leads), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions) });
  });
  const metaCreatives = Array.from(metaCreativeMap.entries()).map(([key, v]) => ({ name: key.split('||')[0], ...v })).sort((a, b) => b.spend - a.spend).slice(0, 30);

  // Rollup google search creatives
  const googleCreativeMap = new Map<string, { campaign: string; headline: string; description: string; spend: number; clicks: number; impressions: number; results: number }>();
  (googleCreativeData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const key = `${r.ad_id}||${r.campaign_name}`;
    const e = googleCreativeMap.get(key) ?? { campaign: String(r.campaign_name ?? ''), headline: `${r.headline_1 ?? ''} | ${r.headline_2 ?? ''}`, description: String(r.description_1 ?? ''), spend: 0, clicks: 0, impressions: 0, results: 0 };
    googleCreativeMap.set(key, { ...e, spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions), results: e.results + Number(r.results) });
  });
  const googleCreatives = Array.from(googleCreativeMap.entries()).map(([key, v]) => ({ name: key.split('||')[0], ...v })).sort((a, b) => b.spend - a.spend).slice(0, 30);

  // Rollup geo states
  const geoMap = new Map<string, { spend: number; clicks: number; conversions: number }>();
  (geoData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const state = String(r.state_name ?? 'Unknown');
    const e = geoMap.get(state) ?? { spend: 0, clicks: 0, conversions: 0 };
    geoMap.set(state, { spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks), conversions: e.conversions + Number(r.conversions) });
  });
  const geoStates = Array.from(geoMap.entries()).map(([state, v]) => ({ state, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 15);

  const pacingData    = (pacingRows ?? []) as unknown as MmpRow[];
  const googleBudgetSpent = sumField(byPlatform(pacingData, 'Google'), 'spend');
  const metaBudgetSpent   = sumField(byPlatform(pacingData, 'Meta'),   'spend');

  const avgDaysMqlToSql = avgDaysBetween(enrollRows, 'date_mql', 'date_sql');
  const avgDaysSqlToWon = avgDaysBetween(enrollWonRows, 'date_sql', 'date_won');

  return {
    focus, filterParams: params,
    budget: Number(budgetRow?.budget ?? 0),
    googleBudgetSpent,
    metaBudgetSpent,
    totalSpend, totalImpressions, totalClicks, platformConversions,
    totalMqls, totalSqls, totalWon,
    avgDaysMqlToSql, avgDaysSqlToWon,
    callMqls, enrollmentMqls, callSqls, enrollmentSqls, callWon, enrollmentWon,
    prevSpend, prevImpressions, prevClicks, prevConversions, prevMqls, prevSqls, prevWon,
    googleSpend, metaSpend, googleClicks, metaClicks,
    googleImpressions, metaImpressions,
    googleConversions, metaConversions,
    googleMqls, metaMqls, googleWon, metaWon,
    dailyData, campaigns, adsets, metaCreatives, googleCreatives, geoStates,
  };
}

// ─── fetchDashboardData (Overall) ─────────────────────────────────────────────

export async function fetchDashboardData(params: FilterParams): Promise<DashboardStats> {
  const supabase = createServerSupabaseClient();
  const { start, end, compStart, compEnd, channel, focus } = params;

  // All primary metrics route through MMP, which has platform + focus + date columns.
  // LinkedIn is not in MMP, so it is fetched separately and only when channel = 'all'.
  function mmpQ(s: string, e: string, cols: string) {
    let q = supabase.from('master_marketing_performance')
      .select(cols).gte('date', s).lte('date', e);
    if (focus   && focus   !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('focus',    focus);
    if (channel && channel !== 'all') q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('platform', channel);
    return q;
  }

  const isAllChannels  = !channel || channel === 'all';
  const includeGoogle  = isAllChannels || channel === 'Google';
  const includeLinkedIn = isAllChannels; // LinkedIn is not in MMP

  // Cutoff for enrollment time queries — last 12 months for meaningful sample
  const nowD = new Date();
  const enrollCutoff = new Date(nowD);
  enrollCutoff.setFullYear(enrollCutoff.getFullYear() - 1);
  const enrollCutoffStr = enrollCutoff.toISOString().split('T')[0];

  const [
    { data: currRows },
    { data: prevRows },
    { data: trendRows },
    { data: liCurr },
    { data: liPrev },
    { data: geoRaw },
    { data: linkedinRaw },
    { data: enrollRows },
    { data: enrollWonRows },
  ] = await Promise.all([
    mmpQ(start,     end,     'platform,spend,impressions,clicks,platform_conversions,mqls,sqls,closed_won'),
    mmpQ(compStart, compEnd, 'platform,spend,impressions,clicks,platform_conversions,mqls,sqls,closed_won'),
    mmpQ(start,     end,     'date,spend,mqls,clicks,impressions,platform_conversions,sqls'),
    // LinkedIn spend/clicks for totals (only when channel = 'all')
    includeLinkedIn
      ? supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', start).lte('date', end)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    includeLinkedIn
      ? supabase.from('linkedin_campaign_data').select('spend,clicks,impressions').gte('date', compStart).lte('date', compEnd)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // Geo is Google-specific — only relevant when Google is included
    includeGoogle
      ? supabase.from('google_geo_state').select('state_name,cost,clicks,conversions').gte('date', start).lte('date', end)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // LinkedIn campaigns table — only when showing all channels
    includeLinkedIn
      ? supabase.from('linkedin_campaign_data').select('campaign_name,spend,clicks,impressions,leads').gte('date', start).lte('date', end)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // Avg days MQL → SQL
    supabase.from('enrollment')
      .select('date_mql,date_sql')
      .not('date_mql', 'is', null)
      .not('date_sql', 'is', null)
      .gte('date_mql', enrollCutoffStr),
    // Avg days SQL → Won
    supabase.from('enrollment_won')
      .select('date_sql,date_won')
      .not('date_sql', 'is', null)
      .not('date_won', 'is', null)
      .gte('date_sql', enrollCutoffStr),
  ]);

  const curr     = (currRows ?? []) as unknown as MmpRow[];
  const prevData = (prevRows ?? []) as unknown as MmpRow[];

  // ── Totals: MMP covers Google + Meta; LinkedIn added separately ───────────────
  const liSpend      = sum(liCurr, 'spend');
  const liClicks     = sum(liCurr, 'clicks');
  const liImpr       = sum(liCurr, 'impressions');
  const prevLiSpend  = sum(liPrev, 'spend');
  const prevLiClicks = sum(liPrev, 'clicks');
  const prevLiImpr   = sum(liPrev, 'impressions');

  const totalSpend       = sumField(curr, 'spend')        + liSpend;
  const totalClicks      = sumField(curr, 'clicks')       + liClicks;
  const totalImpressions = sumField(curr, 'impressions')  + liImpr;
  const prevSpend        = sumField(prevData, 'spend')        + prevLiSpend;
  const prevClicks       = sumField(prevData, 'clicks')       + prevLiClicks;
  const prevImpressions  = sumField(prevData, 'impressions')  + prevLiImpr;

  const platformConversions = sumField(curr,     'platform_conversions');
  const prevConversions     = sumField(prevData, 'platform_conversions');
  const totalMqls  = sumField(curr,     'mqls');
  const prevMqls   = sumField(prevData, 'mqls');
  const totalSqls  = sumField(curr,     'sqls');
  const prevSqls   = sumField(prevData, 'sqls');
  const totalWon   = sumField(curr,     'closed_won');
  const prevWon    = sumField(prevData, 'closed_won');

  // ── Daily trend — respects selected date range + all filters ─────────────────
  const trendMap = new Map<string, { spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number }>();
  const rangeStart = new Date(start + 'T12:00:00');
  const rangeEnd   = new Date(end   + 'T12:00:00');
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0 });
  }
  const trendRowsCast = (trendRows ?? []) as unknown as { date: string; spend: number; mqls: number; clicks: number; impressions: number; platform_conversions: number; sqls: number }[];
  trendRowsCast.forEach((r) => {
    const e = trendMap.get(r.date) ?? { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0 };
    trendMap.set(r.date, {
      spend:               e.spend               + Number(r.spend),
      mql:                 e.mql                 + Number(r.mqls),
      clicks:              e.clicks              + Number(r.clicks),
      impressions:         e.impressions         + Number(r.impressions),
      platformConversions: e.platformConversions + Number(r.platform_conversions),
      sqls:                e.sqls                + Number(r.sqls),
    });
  });
  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date,
    spend:               Math.round(s.spend),
    mql:                 Math.round(s.mql),
    clicks:              Math.round(s.clicks),
    impressions:         Math.round(s.impressions),
    platformConversions: Math.round(s.platformConversions),
    sqls:                Math.round(s.sqls),
  }));

  // ── Channel breakdown — aggregated from MMP by platform ──────────────────────
  const googleRows  = byPlatform(curr, 'Google');
  const metaRows    = byPlatform(curr, 'Meta');
  const allChannels = [
    {
      name: 'Google Ads',
      spend:  sumField(googleRows, 'spend'),
      clicks: sumField(googleRows, 'clicks'),
      mqls:   sumField(googleRows, 'mqls'),
      sqls:   sumField(googleRows, 'sqls'),
      won:    sumField(googleRows, 'closed_won'),
    },
    {
      name: 'Meta Ads',
      spend:  sumField(metaRows, 'spend'),
      clicks: sumField(metaRows, 'clicks'),
      mqls:   sumField(metaRows, 'mqls'),
      sqls:   sumField(metaRows, 'sqls'),
      won:    sumField(metaRows, 'closed_won'),
    },
    {
      name: 'LinkedIn Ads',
      spend:  liSpend,
      clicks: liClicks,
      mqls: 0, sqls: 0, won: 0,
    },
  ];
  // Only include channels that have data (avoids empty rows when filtered)
  const channels = allChannels.filter(c => c.spend > 0 || c.clicks > 0);

  // ── Geo rollup ────────────────────────────────────────────────────────────────
  const geoMap = new Map<string, { spend: number; clicks: number; conversions: number }>();
  (geoRaw as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const state = String(r.state_name ?? 'Unknown');
    const e = geoMap.get(state) ?? { spend: 0, clicks: 0, conversions: 0 };
    geoMap.set(state, { spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks), conversions: e.conversions + Number(r.conversions) });
  });
  const geoStates = Array.from(geoMap.entries()).map(([state, v]) => ({ state, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 15);

  // ── LinkedIn campaigns rollup ─────────────────────────────────────────────────
  const liMap = new Map<string, { spend: number; clicks: number; impressions: number; leads: number }>();
  (linkedinRaw as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const name = String(r.campaign_name ?? 'Unknown');
    const e = liMap.get(name) ?? { spend: 0, clicks: 0, impressions: 0, leads: 0 };
    liMap.set(name, { spend: e.spend + Number(r.spend), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions), leads: e.leads + Number(r.leads) });
  });
  const linkedinCampaigns = Array.from(liMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 25);

  const avgDaysMqlToSql = avgDaysBetween(enrollRows, 'date_mql', 'date_sql');
  const avgDaysSqlToWon = avgDaysBetween(enrollWonRows, 'date_sql', 'date_won');

  return {
    filterParams: params,
    totalSpend, totalClicks, totalImpressions, platformConversions,
    totalMqls, totalSqls, totalWon,
    avgDaysMqlToSql, avgDaysSqlToWon,
    prevSpend, prevClicks, prevImpressions, prevConversions, prevMqls, prevSqls, prevWon,
    dailyData, channels, geoStates, linkedinCampaigns,
  };
}
