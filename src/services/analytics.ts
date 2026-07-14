import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getPresetDates, computeCompDates } from '@/lib/date-utils';

// ─── Filter Params ────────────────────────────────────────────────────────────

export type FilterParams = {
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD
  compStart: string;  // YYYY-MM-DD — comparison period start
  compEnd: string;    // YYYY-MM-DD — comparison period end
  channel?: string;   // 'all' | 'Google' | 'Meta'
  focus?: string;     // 'all' | 'SMB' | 'ABM' | 'FD360' (Overall page only)
};


/** Compute default FilterParams (Last 30 Days vs Previous Period) */
export function defaultFilterParams(): FilterParams {
  const { start, end } = getPresetDates('last30')!;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  
  return {
    start,
    end,
    compStart,
    compEnd,
    channel: 'all',
    focus: 'all',
  };
}

/** Build FilterParams from raw URL searchParams (with fallback defaults) */
export function paramsFromSearch(p: Record<string, string | undefined>): FilterParams {
  const defaults = defaultFilterParams();
  const start = p.start ?? defaults.start;
  const end = p.end ?? defaults.end;
  const fallbackComp = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? fallbackComp.compStart,
    compEnd:   p.comp_end   ?? fallbackComp.compEnd,
    channel:   p.channel   ?? 'all',
    focus:     p.focus     ?? 'all',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────


export type MetaCreative = {
  name: string; campaign: string; adset: string;
  headline: string; primaryText: string;
  finalCreativeLink: string; destinationUrl: string; ctaType: string;
  isVideo: boolean; videoId: string; videoUrl: string;
  pageName?: string; pageProfileImageUrl?: string;
  previewUrl?: string;
  sales?: number; revenue?: number;
  spend: number; leads: number; clicks: number; impressions: number;
  // Funnel attribution (PrePass only — matched by Meta ad_id via Marketo utm_ad_id).
  // Optional so other client dashboards that don't populate them are unaffected.
  adId?: string; mqls?: number; sqls?: number; won?: number;
};

// Aggregate ad creatives by ad NAME (case-insensitive), summing metrics across
// campaigns/ad sets so the same creative appears once instead of duplicated.
// Used by "Ad Analysis" tabs, which — unlike Performance tabs — intentionally
// merge same-named ads regardless of which campaign/ad set they ran in.
// Mirrors spartaco-analytics.ts's aggregateMetaAdsByName but operates directly
// on the shared MetaCreative shape so every client can reuse one function.
export function aggregateMetaCreativesByName(creatives: MetaCreative[]): MetaCreative[] {
  const hasImage = (link: string) => Boolean(link && link !== 'null' && link !== 'undefined');
  const byName = new Map<string, MetaCreative>();
  for (const ad of [...creatives].sort((a, b) => b.spend - a.spend)) {
    const key = (ad.name || ad.headline || ad.campaign).trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...ad });
      continue;
    }
    existing.impressions += ad.impressions;
    existing.clicks += ad.clicks;
    existing.spend += ad.spend;
    existing.leads += ad.leads;
    existing.sales = (existing.sales ?? 0) + (ad.sales ?? 0);
    existing.revenue = (existing.revenue ?? 0) + (ad.revenue ?? 0);
    existing.mqls = (existing.mqls ?? 0) + (ad.mqls ?? 0);
    existing.sqls = (existing.sqls ?? 0) + (ad.sqls ?? 0);
    existing.won = (existing.won ?? 0) + (ad.won ?? 0);
    if (!hasImage(existing.finalCreativeLink) && hasImage(ad.finalCreativeLink)) {
      existing.finalCreativeLink = ad.finalCreativeLink;
      existing.isVideo = ad.isVideo;
      existing.videoId = ad.videoId;
      existing.videoUrl = ad.videoUrl;
      existing.previewUrl = ad.previewUrl;
    }
    existing.headline ||= ad.headline;
    existing.primaryText ||= ad.primaryText;
    existing.destinationUrl ||= ad.destinationUrl;
    existing.ctaType ||= ad.ctaType;
  }
  return Array.from(byName.values()).sort((a, b) => b.spend - a.spend);
}

export type MetaCreativeSummary = {
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number;
  leads: number; cpl: number; sales: number; revenue: number; roas: number;
};

// Roll up a MetaCreative[] into the KPI-strip totals shown on an Ad Analysis
// page. Works for both leads-mode clients (leads/cpl populated) and
// sales-mode clients (sales/revenue/roas populated) — callers pick which
// fields to display based on their own metricMode.
export function summarizeMetaCreatives(creatives: MetaCreative[]): MetaCreativeSummary {
  const spend = creatives.reduce((a, c) => a + c.spend, 0);
  const impressions = creatives.reduce((a, c) => a + c.impressions, 0);
  const clicks = creatives.reduce((a, c) => a + c.clicks, 0);
  const leads = creatives.reduce((a, c) => a + c.leads, 0);
  const sales = creatives.reduce((a, c) => a + (c.sales ?? 0), 0);
  const revenue = creatives.reduce((a, c) => a + (c.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    leads,
    cpl: leads > 0 ? spend / leads : 0,
    sales,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

// Per-ad funnel counts keyed by Meta ad_id, attributed (windowed) via the
// prepass_meta_ad_performance RPC. Returns an empty map on any error so callers
// can merge unconditionally without breaking the dashboard.
export async function fetchPrepassAdConversionCounts(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  start: string,
  end: string,
): Promise<Map<string, { mqls: number; sqls: number; won: number }>> {
  const map = new Map<string, { mqls: number; sqls: number; won: number }>();
  const { data, error } = await supabase.rpc('prepass_meta_ad_performance', { p_start: start, p_end: end });
  if (error || !data) return map;
  (data as unknown as Record<string, unknown>[]).forEach(r => {
    const id = String(r.ad_id ?? '');
    if (id) map.set(id, { mqls: Number(r.mqls ?? 0), sqls: Number(r.sqls ?? 0), won: Number(r.won ?? 0) });
  });
  return map;
}

export type GoogleCreative = {
  name: string; campaign: string;
  headline: string; description: string;
  // Full responsive-search-ad asset lists (optional). When present, previews
  // render every headline/description instead of just the primary one.
  headlines?: string[]; descriptions?: string[];
  spend: number; clicks: number; impressions: number; results: number;
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
  dailyData: { date: string; spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number; calls: number; wonCalls: number; closedWon: number }[];
  // Top campaigns
  campaigns: {
    name: string; platform: string; spend: number; clicks: number;
    impressions: number; conversions: number; mqls: number; sqls: number; won: number;
  }[];
  // Channel/platform breakdown with comparison period
  channels: ChannelRow[];
  // Product breakdown with comparison period
  products: ChannelRow[];
  // Additional breakdowns
  metaCreatives: MetaCreative[];
  googleCreatives: GoogleCreative[];
  // Fleet-size breakdown (PrePass ABM). Empty for other focuses.
  fleetDistribution: FleetBandStat[];
  fleetBands: string[]; // ordered size bands present (excludes "(not answered)") — table columns
  extensions: { extensionType: string; extensionText: string | null; campaignName: string; spend: number; clicks: number; impressions: number; leads: number }[];
};

// Fleet-size band stats (PrePass ABM). leads = count, cost = campaign-attributed cost/lead.
// mqls/sqls/won = how many of the band's leads reached each funnel stage (crossed from
// the CRM funnel tables via campaign_leads.id_marketo).
export type FleetBandStat = { band: string; leads: number; cost: number; mqls: number; sqls: number; won: number };
// Canonical display order for fleet-size bands; unknown bands sort after these.
export const FLEET_BAND_ORDER = ['1-5', '6-50', '51-100', '101-500', '500+', '(not answered)'];

export type ChannelRow = {
  name: string;
  // Current period
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
  // Comparison period
  prevImpressions: number;
  prevClicks: number;
  prevSpend: number;
  prevLeads: number;
  prevMqls: number;
  prevSqls: number;
  prevWon: number;
  // Fleet-size breakdown (PrePass ABM only) keyed by band → leads + attributed cost/lead
  fleet?: Record<string, { leads: number; cost: number }>;
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
  channels: ChannelRow[];
  linkedinCampaigns: { name: string; spend: number; clicks: number; impressions: number; leads: number }[];
  extensions: { extensionType: string; extensionText: string | null; campaignName: string; spend: number; clicks: number; impressions: number; leads: number }[];
};

export type SegmentReadout = {
  smb:   string[];
  abm:   string[];
  fd360: string[];
};

export type WeeklyExecutiveReadout = {
  currentStart: string;
  currentEnd: string;
  overallStory: string[];
  wins: SegmentReadout;
  opportunities: SegmentReadout;
  executionContext: string[];
  accomplishments: string[];
  focusNextWeek: string[];
};

// ─── MMP row type ─────────────────────────────────────────────────────────────

type MmpRow = {
  date: string;
  platform: string;
  campaign_name: string;
  product: string | null;
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


// ─── fetchFocusData ───────────────────────────────────────────────────────────

export async function fetchFocusData(focus: string, params: FilterParams): Promise<FocusStats> {
  console.log('[fetchFocusData] called', { focus, start: params.start, end: params.end });
  const supabase = createServerSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  const budgetClient = focus === 'FD360' ? 'FD360' : focus === 'ABM' ? 'ABM' : 'SMB';
  // RPCs aggregate server-side → bypass PostgREST row-count cap (1000-row default kills 90-day ranges)
  const channelFilter = (channel && channel !== 'all') ? channel : null;

  // This-month date range for budget pacing — always current month regardless of date filter
  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yday = new Date(now); yday.setDate(yday.getDate() - 1);
  const thisMonthEnd   = yday.toISOString().split('T')[0] < thisMonthStart ? thisMonthStart : yday.toISOString().split('T')[0];

  // Cutoff for enrollment time queries — last 12 months for meaningful sample
  const enrollCutoff = new Date(now);
  enrollCutoff.setFullYear(enrollCutoff.getFullYear() - 1);
  const enrollCutoffStr = enrollCutoff.toISOString().split('T')[0];

  const callPattern = focus === 'ABM' ? '%ABM%' : focus === 'FD360' ? '%FD360%' : '%SMB%';

  const [
    { data: currRows,       error: errCurr },
    { data: prevRows,       error: errPrev },
    { data: trendRows,      error: errTrend },
    { data: budgetRow,      error: errBudget },
    { data: pacingRows,     error: errPacing },
    { data: enrollRows,     error: errEnroll },
    { data: enrollWonRows,  error: errEnrollWon },
    { data: callGoogleData, error: errCallGoogle },
    { data: callMasterData, error: errCallMaster },
  ] = await Promise.all([
    supabase.rpc('get_focus_period_stats', { p_focus: focus, p_start: start, p_end: end, p_channel: channelFilter }),
    supabase.rpc('get_focus_period_stats', { p_focus: focus, p_start: compStart, p_end: compEnd, p_channel: channelFilter }),
    supabase.rpc('get_focus_trend', { p_focus: focus, p_start: start, p_end: end, p_channel: channelFilter }),
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
    // Google ad-attributed phone calls
    supabase.from('call_google')
      .select('created_at')
      .eq('status', 'Received')
      .ilike('campaign', callPattern)
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59'),
    // Won calls from CRM (call_master) — exclude Meta LeadAds campaigns that share segment names
    supabase.from('call_master')
      .select('data,qtd_won')
      .ilike('origem', callPattern)
      .not('origem', 'ilike', 'LeadAds%')
      .gte('data', start)
      .lte('data', end),
  ]);

  const queryErrors = { errCurr, errPrev, errTrend, errBudget, errPacing, errEnroll, errEnrollWon, errCallGoogle, errCallMaster };
  const anyError = Object.entries(queryErrors).find(([, e]) => e);
  if (anyError) console.error('[fetchFocusData] Supabase query error:', anyError[0], anyError[1]);

  console.log('[fetchFocusData] rows returned', { curr: currRows?.length ?? 'null', prev: prevRows?.length ?? 'null', errCurr, errPrev });

  const curr     = (currRows ?? []) as MmpRow[];
  const prevData = (prevRows ?? []) as MmpRow[];

  const google     = byPlatform(curr, 'Google');
  const meta       = byPlatform(curr, 'Meta');
  const prevGoogle = byPlatform(prevData, 'Google');
  const prevMeta   = byPlatform(prevData, 'Meta');

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
  const trendMap = new Map<string, { spend: number; mql: number; clicks: number; impressions: number; platformConversions: number; sqls: number; calls: number; wonCalls: number; closedWon: number }>();
  // Seed every date in the current range
  const rangeStart = new Date(start + 'T12:00:00');
  const rangeEnd   = new Date(end   + 'T12:00:00');
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    trendMap.set(d.toISOString().split('T')[0], { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0, calls: 0, wonCalls: 0, closedWon: 0 });
  }
  const trendRowsCast = (trendRows ?? []) as unknown as { trend_date: string; trend_spend: number; trend_mqls: number; trend_clicks: number; trend_impressions: number; trend_platform_conversions: number; trend_sqls: number; trend_closed_won: number }[];
  trendRowsCast.forEach((r) => {
    const e = trendMap.get(r.trend_date) ?? { spend: 0, mql: 0, clicks: 0, impressions: 0, platformConversions: 0, sqls: 0, calls: 0, wonCalls: 0, closedWon: 0 };
    trendMap.set(r.trend_date, {
      spend:               e.spend               + Number(r.trend_spend),
      mql:                 e.mql                 + Number(r.trend_mqls),
      clicks:              e.clicks              + Number(r.trend_clicks),
      impressions:         e.impressions         + Number(r.trend_impressions),
      platformConversions: e.platformConversions + Number(r.trend_platform_conversions),
      sqls:                e.sqls                + Number(r.trend_sqls),
      calls:               e.calls,
      wonCalls:            e.wonCalls,
      closedWon:           e.closedWon           + Number(r.trend_closed_won),
    });
  });

  // Merge Google ad-attributed phone calls (one row per call event)
  const callGoogleRows = (callGoogleData ?? []) as unknown as { created_at: string }[];
  callGoogleRows.forEach((r) => {
    const date = r.created_at.split('T')[0];
    const e = trendMap.get(date);
    if (e) trendMap.set(date, { ...e, calls: e.calls + 1 });
  });

  // Merge CRM won calls (pre-aggregated by date)
  const callMasterRows = (callMasterData ?? []) as unknown as { data: string; qtd_won: number }[];
  callMasterRows.forEach((r) => {
    const e = trendMap.get(r.data);
    if (e) trendMap.set(r.data, { ...e, wonCalls: e.wonCalls + Number(r.qtd_won) });
  });

  const dailyData = Array.from(trendMap.entries()).map(([date, s]) => ({
    date,
    spend:               Math.round(s.spend),
    mql:                 Math.round(s.mql),
    clicks:              Math.round(s.clicks),
    impressions:         Math.round(s.impressions),
    platformConversions: Math.round(s.platformConversions),
    sqls:                Math.round(s.sqls),
    calls:               Math.round(s.calls),
    wonCalls:            Math.round(s.wonCalls),
    closedWon:           Math.round(s.closedWon),
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

  // ── Second batch: creatives (filtered by campaign names) ─────────────────────
  const campaignNames = [...new Set(curr.map(r => r.campaign_name))].filter(Boolean);
  const mobileAppExtensionRowsPromise = focus === 'SMB'
    // Match the overall /dashboard app-performance card exactly. Google stores
    // Mobile App extension rows as account-level rows (campaign_name =
    // "ACCOUNT (all campaigns)"), so filtering by SMB campaign names drops the
    // same rows the overall dashboard correctly uses.
    ? supabase.from('prepass_google_extensions')
      .select('extension_type,extension_text,campaign_name,cost,clicks,impressions,conversions')
      .eq('extension_type', 'MOBILE_APP')
      .gte('date', start)
      .lte('date', end)
    : campaignNames.length > 0
      ? supabase.from('prepass_google_extensions')
        .select('extension_type,extension_text,campaign_name,cost,clicks,impressions,conversions')
        .eq('extension_type', 'MOBILE_APP')
        .in('campaign_name', campaignNames)
        .gte('date', start)
        .lte('date', end)
      : Promise.resolve({ data: [] as unknown[], error: null });

  const [
    { data: metaCreativeData },
    { data: googleCreativeData },
    adConversionCounts,
    { data: extensionRows, error: errExtensions },
  ] = await Promise.all([
    campaignNames.length > 0
      ? supabase.from('meta_ads_creatives').select('ad_id,ad_name,campaign_name,adset_name,headline,primary_text,final_creative_link,destination_url,cta_type,is_video,video_id,video_url,spend,leads,clicks,impressions').in('campaign_name', campaignNames).gte('date', start).lte('date', end).order('spend', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    campaignNames.length > 0
      ? supabase.from('google_search_ads_creatives').select('ad_id,campaign_name,headline_1,headline_2,description_1,clicks,impressions,cost,results').in('campaign_name', campaignNames).gte('date', start).lte('date', end).order('cost', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    fetchPrepassAdConversionCounts(supabase, start, end),
    mobileAppExtensionRowsPromise,
  ]);
  if (errExtensions) console.error('[fetchFocusData] extensions error:', errExtensions);

  // Rollup meta creatives (keyed by ad_id so funnel counts attach precisely)
  const metaCreativeMap = new Map<string, { adId: string; name: string; campaign: string; adset: string; headline: string; primaryText: string; finalCreativeLink: string; destinationUrl: string; ctaType: string; isVideo: boolean; videoId: string; videoUrl: string; spend: number; leads: number; clicks: number; impressions: number }>();
  (metaCreativeData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const adId = String(r.ad_id ?? '');
    const key = adId || `${r.ad_name}||${r.campaign_name}`;
    const e = metaCreativeMap.get(key) ?? { adId, name: String(r.ad_name ?? ''), campaign: String(r.campaign_name ?? ''), adset: String(r.adset_name ?? ''), headline: String(r.headline ?? ''), primaryText: String(r.primary_text ?? ''), finalCreativeLink: String(r.final_creative_link ?? ''), destinationUrl: String(r.destination_url ?? ''), ctaType: String(r.cta_type ?? ''), isVideo: Boolean(r.is_video), videoId: String(r.video_id ?? ''), videoUrl: String(r.video_url ?? ''), spend: 0, leads: 0, clicks: 0, impressions: 0 };
    metaCreativeMap.set(key, { ...e, primaryText: e.primaryText || String(r.primary_text ?? ''), finalCreativeLink: e.finalCreativeLink || String(r.final_creative_link ?? ''), destinationUrl: e.destinationUrl || String(r.destination_url ?? ''), ctaType: e.ctaType || String(r.cta_type ?? ''), isVideo: e.isVideo || Boolean(r.is_video), videoId: e.videoId || String(r.video_id ?? ''), videoUrl: e.videoUrl || String(r.video_url ?? ''), spend: e.spend + Number(r.spend), leads: e.leads + Number(r.leads), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions) });
  });
  const metaCreatives = Array.from(metaCreativeMap.values()).map((v) => {
    const c = adConversionCounts.get(v.adId);
    return { ...v, mqls: c?.mqls ?? 0, sqls: c?.sqls ?? 0, won: c?.won ?? 0 };
  }).sort((a, b) => b.spend - a.spend).slice(0, 30);

  // Rollup google search creatives
  const googleCreativeMap = new Map<string, { campaign: string; headline: string; description: string; spend: number; clicks: number; impressions: number; results: number }>();
  (googleCreativeData as unknown as Record<string, unknown>[] ?? []).forEach((r) => {
    const key = `${r.ad_id}||${r.campaign_name}`;
    const e = googleCreativeMap.get(key) ?? { campaign: String(r.campaign_name ?? ''), headline: `${r.headline_1 ?? ''} | ${r.headline_2 ?? ''}`, description: String(r.description_1 ?? ''), spend: 0, clicks: 0, impressions: 0, results: 0 };
    googleCreativeMap.set(key, { ...e, spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions), results: e.results + Number(r.results) });
  });
  const googleCreatives = Array.from(googleCreativeMap.entries()).map(([key, v]) => ({ name: key.split('||')[0], ...v })).sort((a, b) => b.spend - a.spend).slice(0, 30);

  const extMap = new Map<string, { extensionType: string; extensionText: string | null; campaignName: string; spend: number; clicks: number; impressions: number; leads: number }>();
  ((extensionRows ?? []) as unknown as { extension_type: string; extension_text: string | null; campaign_name: string; cost: number; clicks: number; impressions: number; conversions: number }[]).forEach((r) => {
    const key = `${r.extension_type}||${r.extension_text ?? ''}||${r.campaign_name}`;
    const e = extMap.get(key) ?? { extensionType: r.extension_type, extensionText: r.extension_text, campaignName: r.campaign_name, spend: 0, clicks: 0, impressions: 0, leads: 0 };
    e.spend       += Number(r.cost);
    e.clicks      += Number(r.clicks);
    e.impressions += Number(r.impressions);
    e.leads       += Number(r.conversions);
    extMap.set(key, e);
  });
  const extensions = Array.from(extMap.values()).sort((a, b) => b.spend - a.spend);

  const pacingData    = (pacingRows ?? []) as unknown as MmpRow[];
  const googleBudgetSpent = sumField(byPlatform(pacingData, 'Google'), 'spend');
  const metaBudgetSpent   = sumField(byPlatform(pacingData, 'Meta'),   'spend');

  const avgDaysMqlToSql = avgDaysBetween(enrollRows, 'date_mql', 'date_sql');
  const avgDaysSqlToWon = avgDaysBetween(enrollWonRows, 'date_sql', 'date_won');

  // ── Product breakdown (grouped from existing rows — no extra query) ───────────
  type ProductBucket = { impressions: number; clicks: number; spend: number; leads: number; mqls: number; sqls: number; won: number };
  const productCurr = new Map<string, ProductBucket>();
  const productPrev = new Map<string, ProductBucket>();

  function addToProductMap(map: typeof productCurr, row: MmpRow) {
    const prod = row.product && row.product !== 'Other' ? row.product : null;
    const key = (row.campaign_name ?? '').toUpperCase().includes('TRUCKING LEASING')
      ? 'Trucking Leasing'
      : prod ?? `General ${focus}`;
    const e = map.get(key) ?? { impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0 };
    map.set(key, {
      impressions: e.impressions + Number(row.impressions),
      clicks:      e.clicks      + Number(row.clicks),
      spend:       e.spend       + Number(row.spend),
      leads:       e.leads       + Number(row.platform_conversions),
      mqls:        e.mqls        + Number(row.mqls),
      sqls:        e.sqls        + Number(row.sqls),
      won:         e.won         + Number(row.closed_won),
    });
  }

  curr.forEach(r => addToProductMap(productCurr, r));
  prevData.forEach(r => addToProductMap(productPrev, r));

  const products: ChannelRow[] = Array.from(productCurr.entries())
    .map(([name, v]) => {
      const p = productPrev.get(name) ?? { impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0 };
      return {
        name, ...v,
        prevImpressions: p.impressions, prevClicks: p.clicks, prevSpend: p.spend,
        prevLeads: p.leads, prevMqls: p.mqls, prevSqls: p.sqls, prevWon: p.won,
      };
    })
    .filter(r => r.spend > 0 || r.clicks > 0)
    .sort((a, b) => b.spend - a.spend);

  // ── Channel/platform breakdown with comparison period ─────────────────────────
  const channels: ChannelRow[] = [
    {
      name: 'Google Ads',
      impressions: googleImpressions, clicks: googleClicks, spend: googleSpend,
      leads: googleConversions, mqls: googleMqls,
      sqls: sumField(google, 'sqls'), won: googleWon,
      prevImpressions: sumField(prevGoogle, 'impressions'),
      prevClicks:      sumField(prevGoogle, 'clicks'),
      prevSpend:       sumField(prevGoogle, 'spend'),
      prevLeads:       sumField(prevGoogle, 'platform_conversions'),
      prevMqls:        sumField(prevGoogle, 'mqls'),
      prevSqls:        sumField(prevGoogle, 'sqls'),
      prevWon:         sumField(prevGoogle, 'closed_won'),
    },
    {
      name: 'Meta Ads',
      impressions: metaImpressions, clicks: metaClicks, spend: metaSpend,
      leads: metaConversions, mqls: metaMqls,
      sqls: sumField(meta, 'sqls'), won: metaWon,
      prevImpressions: sumField(prevMeta, 'impressions'),
      prevClicks:      sumField(prevMeta, 'clicks'),
      prevSpend:       sumField(prevMeta, 'spend'),
      prevLeads:       sumField(prevMeta, 'platform_conversions'),
      prevMqls:        sumField(prevMeta, 'mqls'),
      prevSqls:        sumField(prevMeta, 'sqls'),
      prevWon:         sumField(prevMeta, 'closed_won'),
    },
  ].filter(c => c.spend > 0 || c.clicks > 0);

  // ── Fleet-size breakdown (PrePass ABM only) ───────────────────────────────────
  // Overall table (Fleet Size Breakdown): leads + MQL/SQL/WON + cost/lead per fleet
  // band, via prepass_abm_fleet_funnel. MQL/SQL/WON come from crossing the CRM funnel
  // tables (Meta/Google MQL/SQL/WON) with campaign_leads by id_marketo — campaign_leads
  // reveals BOTH the ABM origin (utm_campaign matched to an ABM MMP campaign) and the
  // fleet_size band. prepass_fleet_breakdown is still used only for the per-channel /
  // per-product fleet columns (ChannelTable fleetBands). The ABM Cost Efficiency card
  // MQL/SQL/WON totals (fd* below) are the sum of these bands, so card and table agree.
  let fleetDistribution: FleetBandStat[] = [];
  let fleetBands: string[] = [];
  let fdMqls = totalMqls,     fdSqls = totalSqls,     fdWon = totalWon;
  let fdPrevMqls = prevMqls,  fdPrevSqls = prevSqls,  fdPrevWon = prevWon;
  let fdCallMqls = callMqls,  fdEnrollMqls = enrollmentMqls;
  let fdCallSqls = callSqls,  fdEnrollSqls = enrollmentSqls;
  let fdCallWon = callWon,    fdEnrollWon = enrollmentWon;
  if (focus === 'ABM') {
    const orderIdx = (b: string) => { const i = FLEET_BAND_ORDER.indexOf(b); return i === -1 ? 999 : i; };
    const [
      { data: fleetRows, error: errFleet },
      { data: bandCurr,  error: errBandCurr },
      { data: bandPrev,  error: errBandPrev },
    ] = await Promise.all([
      supabase.rpc('prepass_fleet_breakdown', { p_focus: focus, p_start: start, p_end: end }),
      supabase.rpc('prepass_abm_fleet_funnel', { p_start: start, p_end: end }),
      supabase.rpc('prepass_abm_fleet_funnel', { p_start: compStart, p_end: compEnd }),
    ]);
    if (errFleet)    console.error('[fetchFocusData] fleet breakdown error:', errFleet);
    if (errBandCurr) console.error('[fetchFocusData] abm fleet funnel error (curr):', errBandCurr);
    if (errBandPrev) console.error('[fetchFocusData] abm fleet funnel error (prev):', errBandPrev);

    // Per-channel / per-product fleet columns (unchanged) from prepass_fleet_breakdown.
    const rows = (fleetRows ?? []) as unknown as { dimension: string; dim_value: string; fleet_size: string; leads: number; cost_per_lead: number | string }[];
    const bandSet = new Set<string>();
    const attach = (target: ChannelRow[], dim: string) => {
      const byVal = new Map<string, Record<string, { leads: number; cost: number }>>();
      rows.filter(r => r.dimension === dim).forEach(r => {
        const m = byVal.get(r.dim_value) ?? {};
        m[r.fleet_size] = { leads: Number(r.leads), cost: Number(r.cost_per_lead) };
        byVal.set(r.dim_value, m);
        if (r.fleet_size !== '(not answered)') bandSet.add(r.fleet_size);
      });
      target.forEach(row => { const f = byVal.get(row.name); if (f) row.fleet = f; });
    };
    attach(channels, 'channel');
    attach(products, 'product');
    fleetBands = Array.from(bandSet).sort((a, b) => orderIdx(a) - orderIdx(b));

    // Overall band funnel (leads + MQL/SQL/WON + cost/lead) → Fleet Size Breakdown table.
    const bandRows = (bandCurr ?? []) as unknown as { fleet_size: string; leads: number; mqls: number; sqls: number; won: number; cost_per_lead: number | string }[];
    fleetDistribution = bandRows
      .map(r => ({ band: r.fleet_size, leads: Number(r.leads), cost: Number(r.cost_per_lead), mqls: Number(r.mqls), sqls: Number(r.sqls), won: Number(r.won) }))
      .sort((a, b) => orderIdx(a.band) - orderIdx(b.band));

    // Cost Efficiency totals = only fleets > 100 trucks (101-500 and 500+).
    const above100 = (band: string) => parseInt(band, 10) > 100;
    fdMqls = fleetDistribution.filter(d => above100(d.band)).reduce((a, d) => a + d.mqls, 0);
    fdSqls = fleetDistribution.filter(d => above100(d.band)).reduce((a, d) => a + d.sqls, 0);
    fdWon  = fleetDistribution.filter(d => above100(d.band)).reduce((a, d) => a + d.won, 0);
    const prevBandRows = (bandPrev ?? []) as unknown as { fleet_size: string; mqls: number; sqls: number; won: number }[];
    fdPrevMqls = prevBandRows.filter(d => above100(d.fleet_size)).reduce((a, d) => a + Number(d.mqls), 0);
    fdPrevSqls = prevBandRows.filter(d => above100(d.fleet_size)).reduce((a, d) => a + Number(d.sqls), 0);
    fdPrevWon  = prevBandRows.filter(d => above100(d.fleet_size)).reduce((a, d) => a + Number(d.won), 0);
    // Fleet funnel is entirely form/enrollment attributed (no call linkage).
    fdCallMqls = 0; fdEnrollMqls = fdMqls;
    fdCallSqls = 0; fdEnrollSqls = fdSqls;
    fdCallWon = 0;  fdEnrollWon = fdWon;
  }

  const configuredBudget = Number(budgetRow?.budget ?? 0);

  return {
    focus, filterParams: params,
    budget: configuredBudget,
    googleBudgetSpent,
    metaBudgetSpent,
    totalSpend, totalImpressions, totalClicks, platformConversions,
    totalMqls: fdMqls, totalSqls: fdSqls, totalWon: fdWon,
    avgDaysMqlToSql, avgDaysSqlToWon,
    callMqls: fdCallMqls, enrollmentMqls: fdEnrollMqls, callSqls: fdCallSqls, enrollmentSqls: fdEnrollSqls, callWon: fdCallWon, enrollmentWon: fdEnrollWon,
    prevSpend, prevImpressions, prevClicks, prevConversions, prevMqls: fdPrevMqls, prevSqls: fdPrevSqls, prevWon: fdPrevWon,
    googleSpend, metaSpend, googleClicks, metaClicks,
    googleImpressions, metaImpressions,
    googleConversions, metaConversions,
    googleMqls, metaMqls, googleWon, metaWon,
    channels, products,
    dailyData, campaigns, metaCreatives, googleCreatives,
    fleetDistribution, fleetBands, extensions,
  };
}

// ─── fetchDashboardData (Overall) ─────────────────────────────────────────────

export async function fetchDashboardData(params: FilterParams): Promise<DashboardStats> {
  console.log('[fetchDashboardData] called', { start: params.start, end: params.end, channel: params.channel, focus: params.focus });
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

  const isAllChannels   = !channel || channel === 'all';
  const includeLinkedIn = isAllChannels; // LinkedIn is not in MMP

  // Cutoff for enrollment time queries — last 12 months for meaningful sample
  const nowD = new Date();
  const enrollCutoff = new Date(nowD);
  enrollCutoff.setFullYear(enrollCutoff.getFullYear() - 1);
  const enrollCutoffStr = enrollCutoff.toISOString().split('T')[0];

  const [
    { data: currRows,      error: errCurr },
    { data: prevRows,      error: errPrev },
    { data: trendRows,     error: errTrend },
    { data: liCurr },
    { data: liPrev },
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

  console.log('[fetchDashboardData] rows returned', { curr: currRows?.length ?? 'null', prev: prevRows?.length ?? 'null', errCurr, errPrev, errTrend });

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
  const googleRows    = byPlatform(curr, 'Google');
  const metaRows      = byPlatform(curr, 'Meta');
  const prevGoogleRows = byPlatform(prevData, 'Google');
  const prevMetaRows   = byPlatform(prevData, 'Meta');

  const channels: ChannelRow[] = [
    {
      name: 'Google Ads',
      impressions: sumField(googleRows, 'impressions'),
      clicks:      sumField(googleRows, 'clicks'),
      spend:       sumField(googleRows, 'spend'),
      leads:       sumField(googleRows, 'platform_conversions'),
      mqls:        sumField(googleRows, 'mqls'),
      sqls:        sumField(googleRows, 'sqls'),
      won:         sumField(googleRows, 'closed_won'),
      prevImpressions: sumField(prevGoogleRows, 'impressions'),
      prevClicks:      sumField(prevGoogleRows, 'clicks'),
      prevSpend:       sumField(prevGoogleRows, 'spend'),
      prevLeads:       sumField(prevGoogleRows, 'platform_conversions'),
      prevMqls:        sumField(prevGoogleRows, 'mqls'),
      prevSqls:        sumField(prevGoogleRows, 'sqls'),
      prevWon:         sumField(prevGoogleRows, 'closed_won'),
    },
    {
      name: 'Meta Ads',
      impressions: sumField(metaRows, 'impressions'),
      clicks:      sumField(metaRows, 'clicks'),
      spend:       sumField(metaRows, 'spend'),
      leads:       sumField(metaRows, 'platform_conversions'),
      mqls:        sumField(metaRows, 'mqls'),
      sqls:        sumField(metaRows, 'sqls'),
      won:         sumField(metaRows, 'closed_won'),
      prevImpressions: sumField(prevMetaRows, 'impressions'),
      prevClicks:      sumField(prevMetaRows, 'clicks'),
      prevSpend:       sumField(prevMetaRows, 'spend'),
      prevLeads:       sumField(prevMetaRows, 'platform_conversions'),
      prevMqls:        sumField(prevMetaRows, 'mqls'),
      prevSqls:        sumField(prevMetaRows, 'sqls'),
      prevWon:         sumField(prevMetaRows, 'closed_won'),
    },
    {
      name: 'LinkedIn Ads',
      impressions: liImpr,  clicks: liClicks,  spend: liSpend,
      leads: 0, mqls: 0, sqls: 0, won: 0,
      prevImpressions: prevLiImpr, prevClicks: prevLiClicks, prevSpend: prevLiSpend,
      prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
    },
  ].filter(c => c.spend > 0 || c.clicks > 0);

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

  // ── Google Ads extensions rollup ──────────────────────────────────────────────
  // Only real ad extensions — excludes branding assets (BUSINESS_NAME/BUSINESS_LOGO/LOGO/etc.)
  // which get billed the whole campaign's cost since they render on every ad, not per-interaction.
  const EXTENSION_TYPES = ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'CALL', 'MOBILE_APP', 'PROMOTION', 'PRICE'];
  const { data: extensionRows, error: errExtensions } = await supabase
    .from('prepass_google_extensions')
    .select('extension_type,extension_text,campaign_name,cost,clicks,impressions,conversions')
    .in('extension_type', EXTENSION_TYPES)
    .gte('date', start).lte('date', end);
  if (errExtensions) console.error('[fetchDashboardData] extensions error:', errExtensions);
  // Grouped by campaign too — an extension used across multiple campaigns must show as separate
  // rows, matching the Google Ads UI 1:1, instead of a combined total that inflates vs. any single campaign view.
  const extMap = new Map<string, { extensionType: string; extensionText: string | null; campaignName: string; spend: number; clicks: number; impressions: number; leads: number }>();
  (extensionRows as unknown as { extension_type: string; extension_text: string | null; campaign_name: string; cost: number; clicks: number; impressions: number; conversions: number }[] ?? []).forEach(r => {
    const key = `${r.extension_type}|${r.extension_text ?? ''}|${r.campaign_name}`;
    const e = extMap.get(key) ?? { extensionType: r.extension_type, extensionText: r.extension_text, campaignName: r.campaign_name, spend: 0, clicks: 0, impressions: 0, leads: 0 };
    e.spend       += Number(r.cost);
    e.clicks      += Number(r.clicks);
    e.impressions += Number(r.impressions);
    e.leads       += Number(r.conversions);
    extMap.set(key, e);
  });
  const extensions = Array.from(extMap.values()).sort((a, b) => b.spend - a.spend);

  return {
    filterParams: params,
    totalSpend, totalClicks, totalImpressions, platformConversions,
    totalMqls, totalSqls, totalWon,
    avgDaysMqlToSql, avgDaysSqlToWon,
    prevSpend, prevClicks, prevImpressions, prevConversions, prevMqls, prevSqls, prevWon,
    dailyData, channels, linkedinCampaigns, extensions,
  };
}

// ─── fetchPrepassWeeklyExecutiveReadout ────────────────────────────────────────
// N8N writes to `prepass_weekly_readout`; this just reads the latest row.

type ReadoutRow = {
  period_start:      string | null;
  period_end:        string | null;
  overall_story:     string | null;
  wins:              { smb?: string[]; abm?: string[]; fd360?: string[] } | string[];
  opportunities:     { smb?: string[]; abm?: string[]; fd360?: string[] } | string[];
  accomplishments:   string[];
  focus_next_week:   string[];
  execution_context: string[];
};

const EMPTY_SEGMENT: SegmentReadout = { smb: [], abm: [], fd360: [] };

function toSegmentReadout(
  val: { smb?: string[]; abm?: string[]; fd360?: string[] } | string[] | null | undefined
): SegmentReadout {
  if (!val || Array.isArray(val)) return EMPTY_SEGMENT;
  return { smb: val.smb ?? [], abm: val.abm ?? [], fd360: val.fd360 ?? [] };
}

export async function fetchPrepassWeeklyExecutiveReadout(): Promise<WeeklyExecutiveReadout> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('prepass_weekly_readout')
    .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const row = data as unknown as ReadoutRow | null;

  return {
    currentStart:    row?.period_start      ?? '',
    currentEnd:      row?.period_end        ?? '',
    overallStory:    parseOverallStory(row?.overall_story),
    wins:            toSegmentReadout(row?.wins),
    opportunities:   toSegmentReadout(row?.opportunities),
    executionContext: row?.execution_context ?? [],
    accomplishments: row?.accomplishments   ?? [],
    focusNextWeek:   row?.focus_next_week   ?? [],
  };
}

// ─── Monthly Report Types ─────────────────────────────────────────────────────

export type MonthlyTrendPoint = {
  month: string;    // 'YYYY-MM'
  label: string;    // 'Jan 25'
  spend: number;
  mqls: number;
  sqls: number;
  won: number;
  leads: number;
  costPerMql: number;
  costPerLead: number;
  costPerWon: number;
};

export type MonthlyCampaignRow = {
  name: string;
  focus: string;
  platform: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
};

export type MonthlyReportStats = {
  currentMonthLabel: string;
  prevMonthLabel: string;
  currentMonthStart: string;
  currentMonthEnd: string;
  focus: string;
  totalSpend: number; prevSpend: number;
  totalImpressions: number; prevImpressions: number;
  totalClicks: number; prevClicks: number;
  platformConversions: number; prevConversions: number;
  totalMqls: number; prevMqls: number;
  totalSqls: number; prevSqls: number;
  totalWon: number; prevWon: number;
  avgDaysMqlToSql: number; avgDaysSqlToWon: number;
  focusRows: ChannelRow[];
  channelRows: ChannelRow[];
  productRows: ChannelRow[];
  monthlyTrend: MonthlyTrendPoint[];
  campaigns: MonthlyCampaignRow[];
  metaCreatives: MetaCreative[];
  googleCreatives: GoogleCreative[];
};

// ─── fetchMonthlyReportData ───────────────────────────────────────────────────

export async function fetchMonthlyReportData(focus = 'all'): Promise<MonthlyReportStats> {
  const supabase = createServerSupabaseClient();

  const now = new Date();
  // Last full calendar month
  const currEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
  const currStart = new Date(currEnd.getFullYear(), currEnd.getMonth(), 1);
  // Month before that
  const prevEnd   = new Date(currStart.getFullYear(), currStart.getMonth(), 0);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
  // 6-month trend window
  const trendStart = new Date(currStart.getFullYear(), currStart.getMonth() - 5, 1);

  const iso = (d: Date) => d.toISOString().split('T')[0];
  const currStartStr  = iso(currStart);
  const currEndStr    = iso(currEnd);
  const prevStartStr  = iso(prevStart);
  const prevEndStr    = iso(prevEnd);
  const trendStartStr = iso(trendStart);

  const enrollCutoff = new Date(now);
  enrollCutoff.setFullYear(enrollCutoff.getFullYear() - 1);
  const enrollCutoffStr = iso(enrollCutoff);

  const SELECT_COLS = 'date,platform,campaign_name,product,spend,impressions,clicks,platform_conversions,mqls,sqls,closed_won';

  type MmpReportRow = {
    date: string; platform: string; campaign_name: string; product: string | null;
    spend: number; impressions: number; clicks: number; platform_conversions: number;
    mqls: number; sqls: number; closed_won: number;
  };

  // Always fetch all 3 focuses so the segment comparison table always has full data.
  // The `focus` param filters which rows are used for KPIs, trend, channel, product, campaigns.
  const [
    { data: smbCurrRaw }, { data: smbPrevRaw },
    { data: abmCurrRaw }, { data: abmPrevRaw },
    { data: fd360CurrRaw }, { data: fd360PrevRaw },
    { data: enrollRows },
    { data: enrollWonRows },
  ] = await Promise.all([
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'SMB').gte('date', currStartStr).lte('date', currEndStr),
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'SMB').gte('date', prevStartStr).lte('date', prevEndStr),
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'ABM').gte('date', currStartStr).lte('date', currEndStr),
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'ABM').gte('date', prevStartStr).lte('date', prevEndStr),
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'FD360').gte('date', currStartStr).lte('date', currEndStr),
    supabase.from('master_marketing_performance').select(SELECT_COLS).eq('focus', 'FD360').gte('date', prevStartStr).lte('date', prevEndStr),
    supabase.from('enrollment').select('date_mql,date_sql').not('date_mql', 'is', null).not('date_sql', 'is', null).gte('date_mql', enrollCutoffStr),
    supabase.from('enrollment_won').select('date_sql,date_won').not('date_sql', 'is', null).not('date_won', 'is', null).gte('date_sql', enrollCutoffStr),
  ]);

  const smbCurr   = (smbCurrRaw   ?? []) as unknown as MmpReportRow[];
  const smbPrev   = (smbPrevRaw   ?? []) as unknown as MmpReportRow[];
  const abmCurr   = (abmCurrRaw   ?? []) as unknown as MmpReportRow[];
  const abmPrev   = (abmPrevRaw   ?? []) as unknown as MmpReportRow[];
  const fd360Curr = (fd360CurrRaw ?? []) as unknown as MmpReportRow[];
  const fd360Prev = (fd360PrevRaw ?? []) as unknown as MmpReportRow[];

  // Rows used for main metrics — respect focus filter
  const curr = focus === 'SMB'   ? smbCurr
             : focus === 'ABM'   ? abmCurr
             : focus === 'FD360' ? fd360Curr
             : [...smbCurr, ...abmCurr, ...fd360Curr];
  const prev = focus === 'SMB'   ? smbPrev
             : focus === 'ABM'   ? abmPrev
             : focus === 'FD360' ? fd360Prev
             : [...smbPrev, ...abmPrev, ...fd360Prev];

  // Paginated 6-month trend (includes `focus` col for JS filtering)
  type TrendRow = { date: string; focus: string; spend: number; mqls: number; sqls: number; closed_won: number; platform_conversions: number };
  const trendBaseQ = supabase.from('master_marketing_performance')
    .select('date,focus,spend,mqls,sqls,closed_won,platform_conversions')
    .gte('date', trendStartStr)
    .lte('date', currEndStr);
  const allTrendRows: TrendRow[] = [];
  let tFrom = 0;
  for (;;) {
    const { data: page } = await trendBaseQ.range(tFrom, tFrom + 999);
    const rows = (page ?? []) as unknown as TrendRow[];
    allTrendRows.push(...rows);
    if (rows.length < 1000) break;
    tFrom += 1000;
  }

  // ─── Aggregation helpers ──────────────────────────────────────────────────────

  type Bucket = { impressions: number; clicks: number; spend: number; leads: number; mqls: number; sqls: number; won: number };
  const emptyB = (): Bucket => ({ impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0 });

  function addToB(b: Bucket, r: MmpReportRow) {
    b.impressions += Number(r.impressions);
    b.clicks      += Number(r.clicks);
    b.spend       += Number(r.spend);
    b.leads       += Number(r.platform_conversions);
    b.mqls        += Number(r.mqls);
    b.sqls        += Number(r.sqls);
    b.won         += Number(r.closed_won);
  }

  function toChannelRowR(name: string, c: Bucket, p: Bucket): ChannelRow {
    return {
      name,
      impressions: c.impressions, clicks: c.clicks, spend: c.spend, leads: c.leads,
      mqls: c.mqls, sqls: c.sqls, won: c.won,
      prevImpressions: p.impressions, prevClicks: p.clicks, prevSpend: p.spend,
      prevLeads: p.leads, prevMqls: p.mqls, prevSqls: p.sqls, prevWon: p.won,
    };
  }

  // ─── Overall totals ───────────────────────────────────────────────────────────

  const cb = emptyB(); curr.forEach(r => addToB(cb, r));
  const pb = emptyB(); prev.forEach(r => addToB(pb, r));

  const totalSpend          = cb.spend;
  const totalImpressions    = cb.impressions;
  const totalClicks         = cb.clicks;
  const platformConversions = cb.leads;
  const totalMqls           = cb.mqls;
  const totalSqls           = cb.sqls;
  const totalWon            = cb.won;
  const prevSpend           = pb.spend;
  const prevImpressions     = pb.impressions;
  const prevClicks          = pb.clicks;
  const prevConversions     = pb.leads;
  const prevMqls            = pb.mqls;
  const prevSqls            = pb.sqls;
  const prevWon             = pb.won;

  // ─── Focus comparison rows (always all 3 for the segment comparison table) ────

  function agg(rows: MmpReportRow[]) { const b = emptyB(); rows.forEach(r => addToB(b, r)); return b; }
  const focusRows: ChannelRow[] = [
    toChannelRowR('SMB',   agg(smbCurr),   agg(smbPrev)),
    toChannelRowR('ABM',   agg(abmCurr),   agg(abmPrev)),
    toChannelRowR('FD360', agg(fd360Curr), agg(fd360Prev)),
  ].filter(r => r.spend > 0 || r.clicks > 0);

  // ─── Channel / platform breakdown ────────────────────────────────────────────

  const platC = new Map<string, Bucket>();
  const platP = new Map<string, Bucket>();
  for (const r of curr) {
    const k = r.platform === 'Google' ? 'Google Ads' : r.platform === 'Meta' ? 'Meta Ads' : r.platform;
    if (!platC.has(k)) platC.set(k, emptyB());
    addToB(platC.get(k)!, r);
  }
  for (const r of prev) {
    const k = r.platform === 'Google' ? 'Google Ads' : r.platform === 'Meta' ? 'Meta Ads' : r.platform;
    if (!platP.has(k)) platP.set(k, emptyB());
    addToB(platP.get(k)!, r);
  }
  const channelRows: ChannelRow[] = Array.from(platC.entries())
    .map(([name, c]) => toChannelRowR(name, c, platP.get(name) ?? emptyB()))
    .filter(r => r.spend > 0 || r.clicks > 0)
    .sort((a, b) => b.spend - a.spend);

  // ─── Product breakdown ────────────────────────────────────────────────────────

  const prodC = new Map<string, Bucket>();
  const prodP = new Map<string, Bucket>();
  for (const r of curr) {
    const k = (r.product && r.product !== 'Other') ? r.product : `General ${focus}`;
    if (!prodC.has(k)) prodC.set(k, emptyB());
    addToB(prodC.get(k)!, r);
  }
  for (const r of prev) {
    const k = (r.product && r.product !== 'Other') ? r.product : `General ${focus}`;
    if (!prodP.has(k)) prodP.set(k, emptyB());
    addToB(prodP.get(k)!, r);
  }
  const productRows: ChannelRow[] = Array.from(prodC.entries())
    .map(([name, c]) => toChannelRowR(name, c, prodP.get(name) ?? emptyB()))
    .filter(r => r.spend > 0 || r.clicks > 0)
    .sort((a, b) => b.spend - a.spend);

  // ─── Monthly trend ────────────────────────────────────────────────────────────

  type MonthBucket = { spend: number; mqls: number; sqls: number; won: number; leads: number };
  const monthBuckets = new Map<string, MonthBucket>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currStart.getFullYear(), currStart.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthBuckets.set(k, { spend: 0, mqls: 0, sqls: 0, won: 0, leads: 0 });
  }
  for (const r of allTrendRows) {
    if (focus !== 'all' && r.focus !== focus) continue;
    const k = r.date.slice(0, 7);
    const b = monthBuckets.get(k);
    if (!b) continue;
    b.spend += Number(r.spend);
    b.mqls  += Number(r.mqls);
    b.sqls  += Number(r.sqls);
    b.won   += Number(r.closed_won);
    b.leads += Number(r.platform_conversions);
  }
  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthBuckets.entries()).map(([month, b]) => ({
    month,
    label:       new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    spend:       Math.round(b.spend),
    mqls:        Math.round(b.mqls),
    sqls:        Math.round(b.sqls),
    won:         Math.round(b.won),
    leads:       Math.round(b.leads),
    costPerMql:  b.mqls  > 0 ? Math.round(b.spend / b.mqls)  : 0,
    costPerLead: b.leads > 0 ? Math.round(b.spend / b.leads) : 0,
    costPerWon:  b.won   > 0 ? Math.round(b.spend / b.won)   : 0,
  }));

  // ─── Campaign rollup ──────────────────────────────────────────────────────────

  const campaignMap = new Map<string, MonthlyCampaignRow>();
  const focusPairs: [string, MmpReportRow[]][] = [['SMB', smbCurr], ['ABM', abmCurr], ['FD360', fd360Curr]];
  for (const [f, rows] of focusPairs) {
    if (focus !== 'all' && focus !== f) continue;
    for (const r of rows) {
      const key = `${r.campaign_name}||${r.platform}||${f}`;
      const e = campaignMap.get(key) ?? { name: r.campaign_name, focus: f, platform: r.platform, spend: 0, clicks: 0, impressions: 0, leads: 0, mqls: 0, sqls: 0, won: 0 };
      campaignMap.set(key, {
        ...e,
        spend:       e.spend       + Number(r.spend),
        clicks:      e.clicks      + Number(r.clicks),
        impressions: e.impressions + Number(r.impressions),
        leads:       e.leads       + Number(r.platform_conversions),
        mqls:        e.mqls        + Number(r.mqls),
        sqls:        e.sqls        + Number(r.sqls),
        won:         e.won         + Number(r.closed_won),
      });
    }
  }
  const campaigns: MonthlyCampaignRow[] = Array.from(campaignMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 50);

  // ─── Creatives ────────────────────────────────────────────────────────────────

  const campaignNames = [...new Set(curr.map(r => r.campaign_name))].filter(Boolean);
  const [
    { data: metaCreativeData },
    { data: googleCreativeData },
    adConversionCounts,
  ] = await Promise.all([
    campaignNames.length > 0
      ? supabase.from('meta_ads_creatives')
          .select('ad_id,ad_name,campaign_name,adset_name,headline,primary_text,final_creative_link,destination_url,cta_type,is_video,video_id,video_url,spend,leads,clicks,impressions')
          .in('campaign_name', campaignNames).gte('date', currStartStr).lte('date', currEndStr)
          .order('spend', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    campaignNames.length > 0
      ? supabase.from('google_search_ads_creatives')
          .select('ad_id,campaign_name,headline_1,headline_2,description_1,clicks,impressions,cost,results')
          .in('campaign_name', campaignNames).gte('date', currStartStr).lte('date', currEndStr)
          .order('cost', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    fetchPrepassAdConversionCounts(supabase, currStartStr, currEndStr),
  ]);

  const mcMap = new Map<string, { adId: string; name: string; campaign: string; adset: string; headline: string; primaryText: string; finalCreativeLink: string; destinationUrl: string; ctaType: string; isVideo: boolean; videoId: string; videoUrl: string; spend: number; leads: number; clicks: number; impressions: number }>();
  (metaCreativeData as unknown as Record<string, unknown>[] ?? []).forEach(r => {
    const adId = String(r.ad_id ?? '');
    const key = adId || `${r.ad_name}||${r.campaign_name}`;
    const e = mcMap.get(key) ?? { adId, name: String(r.ad_name ?? ''), campaign: String(r.campaign_name ?? ''), adset: String(r.adset_name ?? ''), headline: String(r.headline ?? ''), primaryText: String(r.primary_text ?? ''), finalCreativeLink: String(r.final_creative_link ?? ''), destinationUrl: String(r.destination_url ?? ''), ctaType: String(r.cta_type ?? ''), isVideo: Boolean(r.is_video), videoId: String(r.video_id ?? ''), videoUrl: String(r.video_url ?? ''), spend: 0, leads: 0, clicks: 0, impressions: 0 };
    mcMap.set(key, { ...e, primaryText: e.primaryText || String(r.primary_text ?? ''), finalCreativeLink: e.finalCreativeLink || String(r.final_creative_link ?? ''), destinationUrl: e.destinationUrl || String(r.destination_url ?? ''), ctaType: e.ctaType || String(r.cta_type ?? ''), isVideo: e.isVideo || Boolean(r.is_video), videoId: e.videoId || String(r.video_id ?? ''), videoUrl: e.videoUrl || String(r.video_url ?? ''), spend: e.spend + Number(r.spend), leads: e.leads + Number(r.leads), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions) });
  });
  const metaCreatives: MetaCreative[] = Array.from(mcMap.values()).map((v) => {
    const c = adConversionCounts.get(v.adId);
    return { ...v, mqls: c?.mqls ?? 0, sqls: c?.sqls ?? 0, won: c?.won ?? 0 };
  }).sort((a, b) => b.spend - a.spend).slice(0, 30);

  const gcMap = new Map<string, { campaign: string; headline: string; description: string; spend: number; clicks: number; impressions: number; results: number }>();
  (googleCreativeData as unknown as Record<string, unknown>[] ?? []).forEach(r => {
    const key = `${r.ad_id}||${r.campaign_name}`;
    const e = gcMap.get(key) ?? { campaign: String(r.campaign_name ?? ''), headline: `${r.headline_1 ?? ''} | ${r.headline_2 ?? ''}`, description: String(r.description_1 ?? ''), spend: 0, clicks: 0, impressions: 0, results: 0 };
    gcMap.set(key, { ...e, spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions), results: e.results + Number(r.results) });
  });
  const googleCreatives: GoogleCreative[] = Array.from(gcMap.entries()).map(([key, v]) => ({ name: key.split('||')[0], ...v })).sort((a, b) => b.spend - a.spend).slice(0, 30);

  const avgDaysMqlToSql = avgDaysBetween(enrollRows, 'date_mql', 'date_sql');
  const avgDaysSqlToWon = avgDaysBetween(enrollWonRows, 'date_sql', 'date_won');

  return {
    currentMonthLabel: currStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    prevMonthLabel:    prevStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    currentMonthStart: currStartStr,
    currentMonthEnd:   currEndStr,
    focus,
    totalSpend, prevSpend,
    totalImpressions, prevImpressions,
    totalClicks, prevClicks,
    platformConversions, prevConversions,
    totalMqls, prevMqls,
    totalSqls, prevSqls,
    totalWon, prevWon,
    avgDaysMqlToSql, avgDaysSqlToWon,
    focusRows, channelRows, productRows,
    monthlyTrend, campaigns,
    metaCreatives, googleCreatives,
  };
}

// ─── Ad Analysis (Creative Analysis) page ──────────────────────────────────────
// Same creatives the Performance/Monthly Report tabs already fetch (kept
// ad_id-level there — never merged just because two ads share an ad_name), but
// aggregated by ad NAME here so a creative running across multiple ad
// sets/campaigns collapses into one card. Mirrors Spartaco's Ad Analysis tab
// (docs/spartaco-creative-analysis.md), with PrePass's three focuses
// (SMB / ABM / FD360) replacing Spartaco's three brands.

const PREPASS_CREATIVE_FOCUSES = ['SMB', 'ABM', 'FD360'] as const;
export type PrepassCreativeFocus = typeof PREPASS_CREATIVE_FOCUSES[number];

const PREPASS_PAGE_SIZE = 1000;

async function fetchPagedRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PREPASS_PAGE_SIZE) {
    const to = from + PREPASS_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PREPASS_PAGE_SIZE) break;
  }
  return rows;
}

export type PrepassCreativeSummary = {
  spend: number; clicks: number; impressions: number; ctr: number; cpc: number;
  mqls: number; sqls: number; won: number;
  cpMql: number; cpSql: number; cpWon: number;
};

// Image-based creative (Google Display RDA / Performance Max asset). Same shape
// as NSI's NsiImageCreative (src/services/nsi-creative-analytics.ts) — no
// MQL/SQL/Won here since Display/PMax aren't attributed at ad-level.
export type PrepassImageCreative = {
  id: string;
  name: string;
  imageUrl: string;
  type: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  headlines?: string[];
  descriptions?: string[];
};

export type PrepassCreativeFocusBlock = {
  focus: PrepassCreativeFocus;
  ads: MetaCreative[];
  googleAds: GoogleCreative[];
  displayAds: PrepassImageCreative[];
  pmaxAds: PrepassImageCreative[];
  summary: PrepassCreativeSummary;
};

// Same campaign_name → focus classifier used by the "PrePass Creative Vision
// Insights" n8n workflow (169m42sWf4OzMtGH): FD360 beats ABM beats default SMB.
function classifyPrepassFocus(campaignName: string): PrepassCreativeFocus {
  const upper = (campaignName || '').toUpperCase();
  if (upper.includes('FD360')) return 'FD360';
  if (upper.includes('ABM')) return 'ABM';
  return 'SMB';
}

// Structured, per-focus AI insight produced daily by the "PrePass Creative
// Vision Insights" n8n workflow (9eyDHrkiHtJudRoa), which has Claude Sonnet
// look at the actual ad images/video frames of the last 30 days, split by
// focus. Stored in prepass_creative_ai_insights (one row per focus/day) —
// same schema as spartaco_creative_ai_insights, just `focus` instead of `brand`.
export type PrepassAiInsightItem = { point: string; evidence?: string; why?: string };
export type PrepassAiTest = { title: string; why?: string };
export type PrepassFocusAiInsight = {
  focus: string;
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  videoVsImage: string;
  whatWorks: PrepassAiInsightItem[];
  improvements: PrepassAiInsightItem[];
  nextTests: PrepassAiTest[];
  nextCreativeBrief: string;
  asOf: string; // as_of_date (YYYY-MM-DD)
};

export type PrepassCreativeAnalysis = {
  params: FilterParams;
  focuses: PrepassCreativeFocusBlock[];
  aiInsights: Record<string, PrepassFocusAiInsight>;
};

function summarizePrepassCreatives(ads: MetaCreative[]): PrepassCreativeSummary {
  const spend = ads.reduce((a, ad) => a + ad.spend, 0);
  const clicks = ads.reduce((a, ad) => a + ad.clicks, 0);
  const impressions = ads.reduce((a, ad) => a + ad.impressions, 0);
  const mqls = ads.reduce((a, ad) => a + (ad.mqls ?? 0), 0);
  const sqls = ads.reduce((a, ad) => a + (ad.sqls ?? 0), 0);
  const won = ads.reduce((a, ad) => a + (ad.won ?? 0), 0);
  return {
    spend, clicks, impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    mqls, sqls, won,
    cpMql: mqls > 0 ? spend / mqls : 0,
    cpSql: sqls > 0 ? spend / sqls : 0,
    cpWon: won > 0 ? spend / won : 0,
  };
}

// Latest structured AI insight per focus from prepass_creative_ai_insights.
// jsonb columns come back already parsed by supabase-js.
async function fetchPrepassAiInsights(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  focuses: readonly string[]
): Promise<Record<string, PrepassFocusAiInsight>> {
  const out: Record<string, PrepassFocusAiInsight> = {};
  const { data, error } = await supabase
    .from('prepass_creative_ai_insights')
    .select('focus,as_of_date,ads_analyzed,has_data,summary,video_vs_image,what_works,improvements,next_tests,next_creative_brief')
    .in('focus', focuses as string[])
    .order('as_of_date', { ascending: false });

  if (error || !data) return out;
  type Row = {
    focus: string;
    as_of_date: string | null;
    ads_analyzed: number | null;
    has_data: boolean | null;
    summary: string | null;
    video_vs_image: string | null;
    what_works: PrepassAiInsightItem[] | null;
    improvements: PrepassAiInsightItem[] | null;
    next_tests: PrepassAiTest[] | null;
    next_creative_brief: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  for (const r of rows) {
    if (out[r.focus]) continue; // rows are newest-first; keep the latest per focus
    out[r.focus] = {
      focus: r.focus,
      hasData: Boolean(r.has_data),
      adsAnalyzed: r.ads_analyzed ?? 0,
      summary: r.summary ?? '',
      videoVsImage: r.video_vs_image ?? '',
      whatWorks: Array.isArray(r.what_works) ? r.what_works : [],
      improvements: Array.isArray(r.improvements) ? r.improvements : [],
      nextTests: Array.isArray(r.next_tests) ? r.next_tests : [],
      nextCreativeBrief: r.next_creative_brief ?? '',
      asOf: r.as_of_date ?? '',
    };
  }
  return out;
}

// Google Display (RDA) creatives, aggregated by ad_id and bucketed by focus.
// Populated by "Google Ads Puller - PrePass Display [Creatives] v2".
async function fetchPrepassDisplayByFocus(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  params: FilterParams
): Promise<Record<PrepassCreativeFocus, PrepassImageCreative[]>> {
  const rows = await fetchPagedRows<Record<string, unknown>>(async (from, to) => {
    const query = supabase
      .from('google_display_creatives')
      .select('ad_id,ad_name,campaign_name,image_url,headlines,descriptions,long_headline,impressions,clicks,cost')
      .gte('date', params.start).lte('date', params.end)
      .order('date', { ascending: true })
      .range(from, to);
    return await query;
  });

  const byAd = new Map<string, PrepassImageCreative & { focus: PrepassCreativeFocus }>();
  for (const r of rows) {
    const id = String(r.ad_id ?? '');
    if (!id) continue;
    const spend = Number(r.cost) || 0;
    const clicks = Number(r.clicks) || 0;
    const impressions = Number(r.impressions) || 0;
    const existing = byAd.get(id);
    if (!existing) {
      const headlines = String(r.headlines ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
      const descriptions = String(r.descriptions ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
      const longHeadline = String(r.long_headline ?? '').trim();
      byAd.set(id, {
        id, name: String(r.ad_name ?? '') || id,
        imageUrl: String(r.image_url ?? ''), type: 'Responsive Display',
        spend, clicks, impressions, ctr: 0, cpc: 0,
        headlines: longHeadline ? [longHeadline, ...headlines] : headlines,
        descriptions,
        focus: classifyPrepassFocus(String(r.campaign_name ?? '')),
      });
    } else {
      existing.spend += spend;
      existing.clicks += clicks;
      existing.impressions += impressions;
      if (!existing.imageUrl && r.image_url) existing.imageUrl = String(r.image_url);
    }
  }

  const MIN_DISPLAY_SPEND = 15;
  const out: Record<PrepassCreativeFocus, PrepassImageCreative[]> = { SMB: [], ABM: [], FD360: [] };
  for (const { focus, ...c } of byAd.values()) {
    if (c.spend < MIN_DISPLAY_SPEND) continue;
    out[focus].push({ ...c, ctr: c.impressions > 0 ? c.clicks / c.impressions : 0, cpc: c.clicks > 0 ? c.spend / c.clicks : 0 });
  }
  for (const focus of PREPASS_CREATIVE_FOCUSES) out[focus].sort((a, b) => b.spend - a.spend);
  return out;
}

// Google Performance Max assets, bucketed by focus. Per-asset spend/clicks are
// Google's asset-group attribution (shared across assets in the group) — not
// additive — so these are for ranking/display only, matching NSI's approach.
async function fetchPrepassPmaxByFocus(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<Record<PrepassCreativeFocus, PrepassImageCreative[]>> {
  const { data } = await supabase
    .from('google_pmax_creatives')
    .select('id,campaign_name,asset_name,asset_type,field_type,asset_image_url,url_image_video,impressions,clicks,cost');
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const MIN_PMAX_SPEND = 15;
  const out: Record<PrepassCreativeFocus, PrepassImageCreative[]> = { SMB: [], ABM: [], FD360: [] };
  for (const r of rows) {
    const img = String(r.asset_image_url || r.url_image_video || '');
    if (!img || img.length <= 4) continue;
    const spend = Number(r.cost) || 0;
    if (spend < MIN_PMAX_SPEND) continue;
    const clicks = Number(r.clicks) || 0;
    const impressions = Number(r.impressions) || 0;
    const focus = classifyPrepassFocus(String(r.campaign_name ?? ''));
    out[focus].push({
      id: String(r.id ?? ''),
      name: String(r.asset_name || r.id || ''),
      imageUrl: img,
      type: String(r.field_type || r.asset_type || ''),
      spend, clicks, impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
    });
  }
  for (const focus of PREPASS_CREATIVE_FOCUSES) out[focus].sort((a, b) => b.spend - a.spend);
  return out;
}

export async function fetchPrepassCreativeAnalysis(params: FilterParams): Promise<PrepassCreativeAnalysis> {
  const supabase = createServerSupabaseClient();

  const [adConversionCounts, aiInsights, displayByFocus, pmaxByFocus] = await Promise.all([
    fetchPrepassAdConversionCounts(supabase, params.start, params.end),
    fetchPrepassAiInsights(supabase, PREPASS_CREATIVE_FOCUSES),
    fetchPrepassDisplayByFocus(supabase, params),
    fetchPrepassPmaxByFocus(supabase),
  ]);

  const focuses = await Promise.all(
    PREPASS_CREATIVE_FOCUSES.map(async (focus): Promise<PrepassCreativeFocusBlock> => {
      const { data: mmpRows } = await supabase
        .from('master_marketing_performance')
        .select('campaign_name')
        .eq('focus', focus)
        .gte('date', params.start)
        .lte('date', params.end);
      const campaignNames = [...new Set(
        (mmpRows ?? []).map((r) => String((r as { campaign_name: string }).campaign_name))
      )].filter(Boolean);

      const [metaRows, googleRows] = await Promise.all([
        campaignNames.length > 0
          ? fetchPagedRows<Record<string, unknown>>(async (from, to) => {
              const query = supabase
                .from('meta_ads_creatives')
                .select('ad_id,ad_name,campaign_name,adset_name,headline,primary_text,final_creative_link,destination_url,cta_type,is_video,video_id,video_url,spend,leads,clicks,impressions')
                .in('campaign_name', campaignNames)
                .gte('date', params.start).lte('date', params.end)
                .order('date', { ascending: true })
                .range(from, to);
              return await query;
            })
          : Promise.resolve([]),
        campaignNames.length > 0
          ? fetchPagedRows<Record<string, unknown>>(async (from, to) => {
              const query = supabase
                .from('google_search_ads_creatives')
                .select('ad_id,campaign_name,headline_1,headline_2,description_1,clicks,impressions,cost,results')
                .in('campaign_name', campaignNames)
                .gte('date', params.start).lte('date', params.end)
                .order('date', { ascending: true })
                .range(from, to);
              return await query;
            })
          : Promise.resolve([]),
      ]);

      // Roll up to one row per ad_id first — rows are fetched oldest-first, so
      // an unconditional overwrite on the (usually expiring) creative-link
      // fields keeps the freshest link instead of pinning to an expired one.
      const mcMap = new Map<string, MetaCreative>();
      for (const r of metaRows) {
        const adId = String(r.ad_id ?? '');
        const key = adId || `${r.ad_name}||${r.campaign_name}`;
        const e = mcMap.get(key) ?? {
          adId, name: String(r.ad_name ?? ''), campaign: String(r.campaign_name ?? ''), adset: String(r.adset_name ?? ''),
          headline: '', primaryText: '', finalCreativeLink: '', destinationUrl: '', ctaType: '',
          isVideo: false, videoId: '', videoUrl: '', previewUrl: '',
          spend: 0, leads: 0, clicks: 0, impressions: 0,
        };
        const finalCreativeLink = String(r.final_creative_link ?? '') || e.finalCreativeLink;
        mcMap.set(key, {
          ...e,
          headline: e.headline || String(r.headline ?? ''),
          primaryText: e.primaryText || String(r.primary_text ?? ''),
          finalCreativeLink,
          destinationUrl: e.destinationUrl || String(r.destination_url ?? ''),
          ctaType: e.ctaType || String(r.cta_type ?? ''),
          isVideo: e.isVideo || Boolean(r.is_video),
          videoId: e.videoId || String(r.video_id ?? ''),
          videoUrl: String(r.video_url ?? '') || e.videoUrl,
          spend: e.spend + Number(r.spend), leads: e.leads + Number(r.leads),
          clicks: e.clicks + Number(r.clicks), impressions: e.impressions + Number(r.impressions),
        });
      }

      const adsById: MetaCreative[] = Array.from(mcMap.values()).map((v) => {
        const c = v.adId ? adConversionCounts.get(v.adId) : undefined;
        return { ...v, mqls: c?.mqls ?? 0, sqls: c?.sqls ?? 0, won: c?.won ?? 0 };
      });
      const ads = aggregateMetaCreativesByName(adsById);

      const gcMap = new Map<string, GoogleCreative>();
      for (const r of googleRows) {
        const key = `${r.ad_id}||${r.campaign_name}`;
        const e = gcMap.get(key) ?? {
          name: String(r.ad_id ?? ''), campaign: String(r.campaign_name ?? ''),
          headline: `${r.headline_1 ?? ''} | ${r.headline_2 ?? ''}`, description: String(r.description_1 ?? ''),
          spend: 0, clicks: 0, impressions: 0, results: 0,
        };
        gcMap.set(key, {
          ...e,
          spend: e.spend + Number(r.cost), clicks: e.clicks + Number(r.clicks),
          impressions: e.impressions + Number(r.impressions), results: e.results + Number(r.results),
        });
      }
      const MIN_SEARCH_SPEND = 15;
      const googleAds = Array.from(gcMap.values())
        .filter((g) => g.spend >= MIN_SEARCH_SPEND)
        .sort((a, b) => b.spend - a.spend);

      return {
        focus, ads, googleAds,
        displayAds: displayByFocus[focus] ?? [],
        pmaxAds: pmaxByFocus[focus] ?? [],
        summary: summarizePrepassCreatives(ads),
      };
    })
  );

  return { params, focuses, aiInsights };
}

// ─── Monthly Readout ──────────────────────────────────────────────────────────

export type MonthlyReadout = {
  overallStory: string[];
  kpiInsights: SegmentReadout;
  accomplishments: string[];
  focusNextMonth: string[];
  executionContext: string[];
  monthStart: string;
  monthEnd: string;
};

type MonthlyReadoutRow = {
  month_start: string;
  month_end: string;
  overall_story: string;
  kpi_insights: { smb?: string[]; abm?: string[]; fd360?: string[] } | null;
  accomplishments: string[] | null;
  focus_next_month: string[] | null;
  execution_context: string[] | null;
};

// overall_story may be a JSON array string (new) or a plain paragraph (legacy)
function parseOverallStory(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    if (typeof parsed === 'string') return [parsed];
  } catch {}
  return [raw];
}

export async function fetchMonthlyReadout(): Promise<MonthlyReadout> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('prepass_monthly_readout')
    .select('month_start,month_end,overall_story,kpi_insights,accomplishments,focus_next_month,execution_context')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const row = data as unknown as MonthlyReadoutRow | null;

  return {
    monthStart:       row?.month_start      ?? '',
    monthEnd:         row?.month_end        ?? '',
    overallStory:     parseOverallStory(row?.overall_story),
    kpiInsights:      toSegmentReadout(row?.kpi_insights),
    accomplishments:  row?.accomplishments  ?? [],
    focusNextMonth:   row?.focus_next_month ?? [],
    executionContext: row?.execution_context ?? [],
  };
}

// ─── PrePass GA4 Performance ─────────────────────────────────────────────────

export type Ga4MetricKey =
  | 'totalUsers'
  | 'newUsers'
  | 'sessions'
  | 'engagedSessions'
  | 'engagementRate'
  | 'bounceRate'
  | 'averageSessionDuration'
  | 'keyEvents';

export type Ga4MetricSummary = {
  key: Ga4MetricKey;
  label: string;
  value: number;
  previousValue: number;
  format: 'number' | 'percent' | 'duration';
  inverted?: boolean;
};

export type Ga4TimeSeriesPoint = {
  month: string;
  label: string;
  totalUsers: number;
  newUsers: number;
  engagementRate: number;
};

export type Ga4SourceMediumRow = {
  source: string;
  medium: string;
  channel: string;
  totalUsers: number;
  previousTotalUsers: number;
  newUsers: number;
  previousNewUsers: number;
  sessions: number;
  previousSessions: number;
  engagedSessions: number;
  previousEngagedSessions: number;
  engagementRate: number;
  previousEngagementRate: number;
  keyEvents: number;
  previousKeyEvents: number;
};

export type Ga4SourceMediumOption = {
  value: string;
  label: string;
  source: string;
  medium: string;
  channel: string;
};

export type Ga4PerformanceStats = {
  scorecardRangeLabel: string;
  comparisonRangeLabel: string;
  scorecardStart: string;
  scorecardEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  lastCompleteMonthEnd: string;
  propertyId: string | null;
  metrics: Ga4MetricSummary[];
  timeSeries: Ga4TimeSeriesPoint[];
  sourceMedium: Ga4SourceMediumRow[];
  sourceMediumOptions: Ga4SourceMediumOption[];
  selectedSourceMedium: string;
};

type PrepassGa4Row = {
  property_id: string | null;
  date: string;
  session_source: string | null;
  session_medium: string | null;
  session_default_channel_group: string | null;
  total_users: number | string | null;
  new_users: number | string | null;
  sessions: number | string | null;
  engaged_sessions: number | string | null;
  engagement_rate: number | string | null;
  bounce_rate: number | string | null;
  average_session_duration: number | string | null;
  key_events: number | string | null;
};

type Ga4Bucket = {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  weightedAvgSessionDuration: number;
  keyEvents: number;
};

const emptyGa4Bucket = (): Ga4Bucket => ({
  totalUsers: 0,
  newUsers: 0,
  sessions: 0,
  engagedSessions: 0,
  weightedAvgSessionDuration: 0,
  keyEvents: 0,
});

function addGa4Row(bucket: Ga4Bucket, row: PrepassGa4Row) {
  const sessions = Number(row.sessions) || 0;
  bucket.totalUsers += Number(row.total_users) || 0;
  bucket.newUsers += Number(row.new_users) || 0;
  bucket.sessions += sessions;
  bucket.engagedSessions += Number(row.engaged_sessions) || 0;
  bucket.weightedAvgSessionDuration += (Number(row.average_session_duration) || 0) * sessions;
  bucket.keyEvents += Number(row.key_events) || 0;
}

function sourceMediumKey(row: PrepassGa4Row) {
  return [
    row.session_source || '(not set)',
    row.session_medium || '(not set)',
    row.session_default_channel_group || 'Unassigned',
  ].join('\u0001');
}

function sourceMediumValue(source: string, medium: string, channel: string) {
  return [source, medium, channel].map(encodeURIComponent).join('|');
}

function sourceMediumValueFromRow(row: PrepassGa4Row) {
  return sourceMediumValue(
    row.session_source || '(not set)',
    row.session_medium || '(not set)',
    row.session_default_channel_group || 'Unassigned',
  );
}

function summarizeGa4Bucket(bucket: Ga4Bucket) {
  const engagementRate = bucket.sessions > 0 ? bucket.engagedSessions / bucket.sessions : 0;
  return {
    totalUsers: bucket.totalUsers,
    newUsers: bucket.newUsers,
    sessions: bucket.sessions,
    engagedSessions: bucket.engagedSessions,
    engagementRate,
    bounceRate: bucket.sessions > 0 ? Math.max(0, 1 - engagementRate) : 0,
    averageSessionDuration: bucket.sessions > 0 ? bucket.weightedAvgSessionDuration / bucket.sessions : 0,
    keyEvents: bucket.keyEvents,
  };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  return new Date(`${month}-15T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatRangeLabel(start: string, end: string) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth && s.getDate() === 1 && e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate()) {
    return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const startLabel = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  const endLabel = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function fetchPrepassGa4PerformanceData(range?: {
  start?: string;
  end?: string;
  compStart?: string;
  compEnd?: string;
  sourceMedium?: string;
}): Promise<Ga4PerformanceStats> {
  const supabase = createServerSupabaseClient();
  const now = new Date();
  const lastCompleteMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const defaultScorecardStart = new Date(lastCompleteMonthEnd.getFullYear(), lastCompleteMonthEnd.getMonth(), 1);
  const trendStart = new Date(2024, 0, 1);

  const iso = (d: Date) => d.toISOString().split('T')[0];
  const defaultStartStr = iso(defaultScorecardStart);
  const defaultEndStr = iso(lastCompleteMonthEnd);
  let scorecardStartStr = isIsoDate(range?.start) ? range.start : defaultStartStr;
  let scorecardEndStr = isIsoDate(range?.end) ? range.end : defaultEndStr;
  if (scorecardStartStr > scorecardEndStr) {
    [scorecardStartStr, scorecardEndStr] = [scorecardEndStr, scorecardStartStr];
  }

  let compStart = isIsoDate(range?.compStart) ? range.compStart : '';
  let compEnd = isIsoDate(range?.compEnd) ? range.compEnd : '';
  if (!compStart || !compEnd) {
    const comp = computeCompDates(scorecardStartStr, scorecardEndStr, 'prev_period');
    compStart = comp.compStart;
    compEnd = comp.compEnd;
  }
  if (compStart > compEnd) {
    [compStart, compEnd] = [compEnd, compStart];
  }
  const trendStartStr = iso(trendStart);
  const lastCompleteMonthEndStr = iso(lastCompleteMonthEnd);
  const queryStartStr = [trendStartStr, scorecardStartStr, compStart].sort()[0];
  const queryEndStr = [lastCompleteMonthEndStr, scorecardEndStr, compEnd].sort().at(-1)!;

  const rows: PrepassGa4Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('prepass_ga4_daily')
      .select('property_id,date,session_source,session_medium,session_default_channel_group,total_users,new_users,sessions,engaged_sessions,engagement_rate,bounce_rate,average_session_duration,key_events')
      .gte('date', queryStartStr)
      .lte('date', queryEndStr)
      .order('date', { ascending: true })
      .range(from, from + 999);

    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = (data ?? []) as unknown as PrepassGa4Row[];
    rows.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }

  const currentBucket = emptyGa4Bucket();
  const previousBucket = emptyGa4Bucket();
  const monthBuckets = new Map<string, Ga4Bucket>();
  const currentSourceBuckets = new Map<string, { row: PrepassGa4Row; bucket: Ga4Bucket }>();
  const previousSourceBuckets = new Map<string, { row: PrepassGa4Row; bucket: Ga4Bucket }>();
  const optionBuckets = new Map<string, { row: PrepassGa4Row; bucket: Ga4Bucket }>();

  for (const row of rows) {
    const key = sourceMediumValueFromRow(row);
    const optionBucket = optionBuckets.get(key) ?? { row, bucket: emptyGa4Bucket() };
    addGa4Row(optionBucket.bucket, row);
    optionBuckets.set(key, optionBucket);
  }

  const sourceMediumOptions: Ga4SourceMediumOption[] = Array.from(optionBuckets.entries())
    .sort(([, a], [, b]) => b.bucket.sessions - a.bucket.sessions || b.bucket.totalUsers - a.bucket.totalUsers)
    .map(([value, { row }]) => {
      const source = row.session_source || '(not set)';
      const medium = row.session_medium || '(not set)';
      const channel = row.session_default_channel_group || 'Unassigned';
      return {
        value,
        label: `${source} / ${medium}`,
        source,
        medium,
        channel,
      };
    });

  const selectedSourceMedium = sourceMediumOptions.some((option) => option.value === range?.sourceMedium)
    ? range!.sourceMedium!
    : 'all';
  const filteredRows = selectedSourceMedium === 'all'
    ? rows
    : rows.filter((row) => sourceMediumValueFromRow(row) === selectedSourceMedium);

  const lastCompleteMonthStart = new Date(lastCompleteMonthEnd.getFullYear(), lastCompleteMonthEnd.getMonth(), 1);
  for (let cursor = new Date(trendStart); cursor <= lastCompleteMonthStart; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    monthBuckets.set(monthKey(cursor), emptyGa4Bucket());
  }

  for (const row of filteredRows) {
    const date = row.date.slice(0, 10);
    const bucket = monthBuckets.get(date.slice(0, 7));
    if (bucket && date <= lastCompleteMonthEndStr) addGa4Row(bucket, row);
    if (date >= scorecardStartStr && date <= scorecardEndStr) {
      addGa4Row(currentBucket, row);
      const key = sourceMediumKey(row);
      const sourceBucket = currentSourceBuckets.get(key) ?? { row, bucket: emptyGa4Bucket() };
      addGa4Row(sourceBucket.bucket, row);
      currentSourceBuckets.set(key, sourceBucket);
    }
    if (date >= compStart && date <= compEnd) {
      addGa4Row(previousBucket, row);
      const key = sourceMediumKey(row);
      const sourceBucket = previousSourceBuckets.get(key) ?? { row, bucket: emptyGa4Bucket() };
      addGa4Row(sourceBucket.bucket, row);
      previousSourceBuckets.set(key, sourceBucket);
    }
  }

  const current = summarizeGa4Bucket(currentBucket);
  const previous = summarizeGa4Bucket(previousBucket);

  const metrics: Ga4MetricSummary[] = [
    { key: 'totalUsers', label: 'Total Users', value: current.totalUsers, previousValue: previous.totalUsers, format: 'number' },
    { key: 'newUsers', label: 'New Users', value: current.newUsers, previousValue: previous.newUsers, format: 'number' },
    { key: 'sessions', label: 'Sessions', value: current.sessions, previousValue: previous.sessions, format: 'number' },
    { key: 'engagedSessions', label: 'Engaged Sessions', value: current.engagedSessions, previousValue: previous.engagedSessions, format: 'number' },
    { key: 'engagementRate', label: 'Engagement Rate', value: current.engagementRate, previousValue: previous.engagementRate, format: 'percent' },
    { key: 'bounceRate', label: 'Bounce Rate', value: current.bounceRate, previousValue: previous.bounceRate, format: 'percent', inverted: true },
    { key: 'averageSessionDuration', label: 'Avg. Session Duration', value: current.averageSessionDuration, previousValue: previous.averageSessionDuration, format: 'duration' },
    { key: 'keyEvents', label: 'Key Events', value: current.keyEvents, previousValue: previous.keyEvents, format: 'number' },
  ];

  const timeSeries: Ga4TimeSeriesPoint[] = Array.from(monthBuckets.entries()).map(([month, bucket]) => {
    const summary = summarizeGa4Bucket(bucket);
    return {
      month,
      label: monthLabel(month),
      totalUsers: Math.round(summary.totalUsers),
      newUsers: Math.round(summary.newUsers),
      engagementRate: summary.engagementRate,
    };
  });

  const sourceKeys = new Set([...currentSourceBuckets.keys(), ...previousSourceBuckets.keys()]);
  const sourceMedium: Ga4SourceMediumRow[] = Array.from(sourceKeys)
    .map((key) => {
      const currentSource = currentSourceBuckets.get(key);
      const previousSource = previousSourceBuckets.get(key);
      const row = currentSource?.row ?? previousSource!.row;
      const currentSummary = summarizeGa4Bucket(currentSource?.bucket ?? emptyGa4Bucket());
      const previousSummary = summarizeGa4Bucket(previousSource?.bucket ?? emptyGa4Bucket());

      return {
        source: row.session_source || '(not set)',
        medium: row.session_medium || '(not set)',
        channel: row.session_default_channel_group || 'Unassigned',
        totalUsers: currentSummary.totalUsers,
        previousTotalUsers: previousSummary.totalUsers,
        newUsers: currentSummary.newUsers,
        previousNewUsers: previousSummary.newUsers,
        sessions: currentSummary.sessions,
        previousSessions: previousSummary.sessions,
        engagedSessions: currentSummary.engagedSessions,
        previousEngagedSessions: previousSummary.engagedSessions,
        engagementRate: currentSummary.engagementRate,
        previousEngagementRate: previousSummary.engagementRate,
        keyEvents: currentSummary.keyEvents,
        previousKeyEvents: previousSummary.keyEvents,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.totalUsers - a.totalUsers)
    .slice(0, 25);

  return {
    scorecardRangeLabel: formatRangeLabel(scorecardStartStr, scorecardEndStr),
    comparisonRangeLabel: formatRangeLabel(compStart, compEnd),
    scorecardStart: scorecardStartStr,
    scorecardEnd: scorecardEndStr,
    comparisonStart: compStart,
    comparisonEnd: compEnd,
    lastCompleteMonthEnd: lastCompleteMonthEndStr,
    propertyId: rows.find((row) => row.property_id)?.property_id ?? null,
    metrics,
    timeSeries,
    sourceMedium,
    sourceMediumOptions,
    selectedSourceMedium,
  };
}
