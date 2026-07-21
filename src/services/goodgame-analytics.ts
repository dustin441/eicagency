import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import {
  isGoodGameEcommerceCampaign,
  matchesGoodGameCampaignScope,
  type GoodGameCampaignScope,
} from '@/lib/goodgame-campaign-scope';
import {
  aggregateMetaCreativesByName,
  summarizeMetaCreatives,
  type MetaCreative,
} from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

export type GoodGameFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Google' | 'Meta'
};

export type GoodGameSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  ctr: number;
  cpc: number;
  costPerLandingPageView: number;
  purchases: number;
  revenue: number;
  roas: number;
  costPerPurchase: number;
};

export type GoodGameTimePoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  purchases: number;
  revenue: number;
  views75: number;
};

export type GoodGameChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  landingPageViews: number;
  prevLandingPageViews: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
};

export type GoodGameCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type GoodGameFocusStats = {
  focus: 'Engagement' | 'Traffic' | 'Conversion';
  spend: number;
  impressions: number;
  clicks: number;
  views75: number;    // video_views_p75 — Engagement primary KPI
  thruplays: number;  // video_thruplay  — Engagement secondary KPI
  purchases: number;
  revenue: number;
  cpc: number;        // derived
  costPer75: number;  // derived — Engagement
  ctr: number;        // derived
  // vs prior period
  prevSpend: number;
  prevImpressions: number;
  prevClicks: number;
  prevViews75: number;
  prevThruplays: number;
  prevPurchases: number;
  prevRevenue: number;
};

export type GoodGameBudgetPacing = {
  budget: number | null;
  metaSpend: number;
  googleSpend: number;
  stackadaptSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type GoodGameWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type StockistStateRow = {
  state: string;
  searches: number;
};

export type GoodGameDashboardData = {
  scope: GoodGameCampaignScope;
  filterParams: GoodGameFilterParams;
  summary: GoodGameSummary;
  prevSummary: GoodGameSummary;
  timeSeries: GoodGameTimePoint[];
  channelRows: GoodGameChannelRow[];
  campaignRows: GoodGameCampaignRow[];
  focusStats: GoodGameFocusStats[];
  metaCreatives: MetaCreative[];
  budgetPacing: GoodGameBudgetPacing;
  weeklyReadout: GoodGameWeeklyReadout | null;
  stockistHeatmap: StockistStateRow[];
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  landing_page_views: number | null;
  purchases: number | null;
  conversions: number | null;  // Google uses this; Meta uses purchases
  revenue: number;
};

type AdRow = {
  id: string;
  date: string;
  ad_id?: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  conversions: number;
  leads: number;
  preview_url: string | null;
  final_creative_link: string | null;
  permanent_image_url: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
  page_name: string | null;
  page_profile_image_url: string | null;
  video_views_p75: number | null;
  video_thruplay: number | null;
};

type WeeklyReadoutRow = {
  period_start: string;
  period_end: string;
  overall_story: string | null;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

function rowPurchases(r: MasterRow): number {
  // Google stores conversions in `conversions`; Meta stores them in `purchases`
  return Number(r.purchases ?? r.conversions ?? 0);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

function summarise(rows: MasterRow[]): GoodGameSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const landingPageViews = rows.reduce((s, r) => s + Number(r.landing_page_views ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowPurchases(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    landingPageViews,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    costPerLandingPageView: landingPageViews > 0 ? spend / landingPageViews : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
  };
}

export function goodgameParamsFromSearch(p: Record<string, string | undefined>): GoodGameFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
    channel: p.channel ?? 'all',
  };
}

// Ad Library URLs are not playable inline — route to previewUrl
function resolveVideoUrls(rawVideoUrl: string | null, rawPreviewUrl: string | null) {
  const isAdLibrary = rawVideoUrl?.startsWith('https://www.facebook.com/ads/library/') ?? false;
  return {
    videoUrl: !isAdLibrary && rawVideoUrl ? rawVideoUrl : '',
    previewUrl: isAdLibrary ? (rawVideoUrl ?? '') : (rawPreviewUrl ?? ''),
  };
}

const GOODGAME_CREATIVE_SELECT = 'id,date,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,leads,preview_url,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url,page_name,page_profile_image_url,video_views_p75,video_thruplay';

// Individual per-ad rows for the Paid Media Performance tab — deliberately
// NOT aggregated by ad_name (unlike goodgame_creative_rollup, which the Sales
// tab still uses). Paginated because goodgame_meta_ads easily exceeds
// Supabase's 1,000-row default (2 ad accounts, ~8-9k rows in a 30-day window).
async function fetchPagedGoodGameMetaAdRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<AdRow[]> {
  const rows: AdRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('goodgame_meta_ads')
      .select(GOODGAME_CREATIVE_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as AdRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

const SUPABASE_PAGE_SIZE = 1000;

async function fetchPagedRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

// goodgame_ad_hires holds manually-uploaded hi-res overrides keyed by
// ad_name (same override goodgame_creative_rollup applies via SQL join).
async function fetchGoodGameAdHiresMap(
  db: ReturnType<typeof createSpartacoSupabaseClient>
): Promise<Map<string, string>> {
  const { data } = await db.from('goodgame_ad_hires').select('ad_name,hires_url');
  const map = new Map<string, string>();
  for (const r of (data ?? []) as unknown as { ad_name: string; hires_url: string | null }[]) {
    if (r.hires_url) map.set(r.ad_name, r.hires_url);
  }
  return map;
}

// Maps raw goodgame_meta_ads rows into MetaCreative[], deduped by
// ad_id/adset/campaign (fine-grained — a given ad running in two ad sets
// stays as two entries, matching the Performance-tab pattern used by every
// other client). Applies the same hi-res override as goodgame_creative_rollup.
function buildGoodGameMetaCreatives(rows: AdRow[], hiresMap: Map<string, string>): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rows) {
    const key = `${r.ad_id || r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, r.preview_url);
    const existing = creativeMap.get(key) ?? {
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name,
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: '',
      permanentImageUrl: '',
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl,
      pageName: String(r.page_name ?? ''),
      pageProfileImageUrl: String(r.page_profile_image_url ?? ''),
      previewUrl,
      spend: 0,
      leads: 0,
      sales: 0,
      revenue: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.purchases ?? r.leads ?? 0);
    existing.sales = Number(existing.sales ?? 0) + Number(r.purchases ?? r.leads ?? 0);
    existing.revenue = Number(existing.revenue ?? 0) + Number(r.revenue ?? 0);
    // Rows arrive oldest-first, so overwriting on every non-empty value means
    // the LATEST row wins — important because Meta's signed final_creative_link
    // /video URLs expire after a few days. The manual hires override always
    // takes precedence when present.
    const rawLink = hiresMap.get(r.ad_name) || (r.final_creative_link ?? '');
    if (rawLink) existing.finalCreativeLink = rawLink;
    if (r.permanent_image_url) existing.permanentImageUrl = r.permanent_image_url;
    if (r.headline) existing.headline = String(r.headline);
    if (r.primary_text) existing.primaryText = String(r.primary_text);
    if (r.destination_url) existing.destinationUrl = String(r.destination_url);
    if (r.cta_type) existing.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) existing.isVideo = Boolean(r.is_video);
    if (r.video_id) existing.videoId = String(r.video_id);
    if (videoUrl) existing.videoUrl = videoUrl;
    if (previewUrl) existing.previewUrl = previewUrl;
    creativeMap.set(key, existing);
  }
  return Array.from(creativeMap.values());
}

function focusForCampaign(campaignName: string): GoodGameFocusStats['focus'] {
  if (isGoodGameEcommerceCampaign(campaignName)) return 'Conversion';
  if (/engagement|awareness/i.test(campaignName)) return 'Engagement';
  return 'Traffic';
}

function buildFocusStats(currentRows: AdRow[], previousRows: AdRow[]): GoodGameFocusStats[] {
  type FocusTotals = {
    spend: number;
    impressions: number;
    clicks: number;
    views75: number;
    thruplays: number;
    purchases: number;
    revenue: number;
  };
  const empty = (): FocusTotals => ({
    spend: 0,
    impressions: 0,
    clicks: 0,
    views75: 0,
    thruplays: 0,
    purchases: 0,
    revenue: 0,
  });

  function aggregate(rows: AdRow[]) {
    const totals = new Map<GoodGameFocusStats['focus'], FocusTotals>();
    for (const row of rows) {
      const focus = focusForCampaign(row.campaign_name);
      const value = totals.get(focus) ?? empty();
      value.spend += Number(row.cost ?? 0);
      value.impressions += Number(row.impressions ?? 0);
      value.clicks += Number(row.clicks ?? 0);
      value.views75 += Number(row.video_views_p75 ?? 0);
      value.thruplays += Number(row.video_thruplay ?? 0);
      value.purchases += Number(row.purchases ?? 0);
      value.revenue += Number(row.revenue ?? 0);
      totals.set(focus, value);
    }
    return totals;
  }

  const current = aggregate(currentRows);
  const previous = aggregate(previousRows);
  const focuses: GoodGameFocusStats['focus'][] = ['Engagement', 'Traffic', 'Conversion'];
  return focuses
    .map((focus) => {
      const c = current.get(focus) ?? empty();
      const p = previous.get(focus) ?? empty();
      return {
        focus,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        views75: c.views75,
        thruplays: c.thruplays,
        purchases: c.purchases,
        revenue: c.revenue,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        costPer75: c.views75 > 0 ? c.spend / c.views75 : 0,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevSpend: p.spend,
        prevImpressions: p.impressions,
        prevClicks: p.clicks,
        prevViews75: p.views75,
        prevThruplays: p.thruplays,
        prevPurchases: p.purchases,
        prevRevenue: p.revenue,
      };
    })
    .filter((focus) => focus.spend > 0 || focus.prevSpend > 0);
}

export async function fetchGoodGameDashboardData(
  params: GoodGameFilterParams,
  scope: GoodGameCampaignScope = 'all'
): Promise<GoodGameDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyChannel(q: any) {
    return channel !== 'all' ? q.eq('ad_channel', channel) : q;
  }

  const masterSelect = 'date,campaign_name,ad_channel,impressions,clicks,cost,landing_page_views,purchases,conversions,revenue';

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yday = new Date(now); yday.setDate(yday.getDate() - 1);
  const monthEnd = yday.toISOString().split('T')[0] < monthStart ? monthStart : yday.toISOString().split('T')[0];
  const budgetClient = scope === 'foot_traffic' ? 'goodgame_foot_traffic' : 'goodgame';

  const [allCurrentRows, allPreviousRows, allRawAds, allPreviousRawAds, hiresMap, allPacingRows, budgetRes, fallbackBudgetRes, weeklyReadoutRes, stockistRes] = await Promise.all([
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyChannel(
        db.from('goodgame_master').select(masterSelect).gte('date', start).lte('date', end)
      )
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyChannel(
        db.from('goodgame_master').select(masterSelect).gte('date', compStart).lte('date', compEnd)
      )
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    fetchPagedGoodGameMetaAdRows(db, start, end),
    fetchPagedGoodGameMetaAdRows(db, compStart, compEnd),
    fetchGoodGameAdHiresMap(db),
    // Budget pacing is always current calendar month and uses the selected campaign scope.
    fetchPagedRows<MasterRow>(async (from, to) =>
      await db.from('goodgame_master')
        .select(masterSelect)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    db.from('budgets').select('budget').eq('client', budgetClient).order('period_start', { ascending: false }).limit(1),
    scope === 'foot_traffic'
      ? db.from('budgets').select('budget').eq('client', 'goodgame').order('period_start', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] }),
    db
      .from('goodgame_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
    db.rpc('stockist_state_rollup'),
  ]);

  const inScope = (campaignName: string) => matchesGoodGameCampaignScope(campaignName, scope);
  const currRows = allCurrentRows.filter((row) => inScope(row.campaign_name));
  const prevRows = allPreviousRows.filter((row) => inScope(row.campaign_name));
  const rawAds = allRawAds.filter((row) =>
    inScope(row.campaign_name) && (channel === 'all' || channel === 'Meta')
  );
  const previousRawAds = allPreviousRawAds.filter((row) =>
    inScope(row.campaign_name) && (channel === 'all' || channel === 'Meta')
  );
  const pacingRows = allPacingRows.filter((row) => inScope(row.campaign_name));

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, GoodGameTimePoint>();
  for (const r of currRows) {
    const pt = dateMap.get(r.date) ?? { label: r.date, spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, purchases: 0, revenue: 0, views75: 0 };
    pt.spend += Number(r.cost ?? 0);
    pt.impressions += Number(r.impressions ?? 0);
    pt.clicks += Number(r.clicks ?? 0);
    pt.landingPageViews += Number(r.landing_page_views ?? 0);
    pt.purchases += rowPurchases(r);
    pt.revenue += Number(r.revenue ?? 0);
    dateMap.set(r.date, pt);
  }
  for (const r of rawAds) {
    const pt = dateMap.get(r.date);
    if (pt) pt.views75 += Number(r.video_views_p75 ?? 0);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown
  const allChannels = channel === 'all' ? ['Meta', 'Google', 'StackAdapt'] : [channel];
  const channelRows: GoodGameChannelRow[] = allChannels
    .map(ch => {
      const curr = currRows.filter(r => r.ad_channel === ch);
      const prev = prevRows.filter(r => r.ad_channel === ch);
      return {
        channel: ch,
        spend: curr.reduce((s, r) => s + Number(r.cost ?? 0), 0),
        prevSpend: prev.reduce((s, r) => s + Number(r.cost ?? 0), 0),
        impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
        prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
        clicks: curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
        prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
        landingPageViews: curr.reduce((s, r) => s + Number(r.landing_page_views ?? 0), 0),
        prevLandingPageViews: prev.reduce((s, r) => s + Number(r.landing_page_views ?? 0), 0),
        purchases: curr.reduce((s, r) => s + rowPurchases(r), 0),
        prevPurchases: prev.reduce((s, r) => s + rowPurchases(r), 0),
        revenue: curr.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
        prevRevenue: prev.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
      };
    })
    .filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign breakdown — group by campaign + channel
  const campMap = new Map<string, GoodGameCampaignRow>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const row = campMap.get(key) ?? {
      campaign: r.campaign_name,
      channel: r.ad_channel,
      spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, ctr: 0, purchases: 0, revenue: 0, roas: 0,
    };
    row.spend += Number(r.cost ?? 0);
    row.impressions += Number(r.impressions ?? 0);
    row.clicks += Number(r.clicks ?? 0);
    row.landingPageViews += Number(r.landing_page_views ?? 0);
    row.purchases += rowPurchases(r);
    row.revenue += Number(r.revenue ?? 0);
    campMap.set(key, row);
  }
  const campaignRows: GoodGameCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Individual ad cards — deduped by ad_id/adset/campaign (NOT ad_name), so
  // the same creative running in two ad sets/campaigns shows as two cards.
  // The ad_name-aggregated view lives on the Sales tab (goodgame_sales_creative_rollup).
  const metaCreatives: MetaCreative[] = buildGoodGameMetaCreatives(rawAds, hiresMap)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 50);

  const focusStats = buildFocusStats(rawAds, previousRawAds);

  // Budget pacing — fetched from budgets table (editable)
  const budgetRows = (budgetRes.data ?? []) as unknown as { budget: number }[];
  const fallbackBudgetRows = (fallbackBudgetRes.data ?? []) as unknown as { budget: number }[];
  const MONTHLY_BUDGET = budgetRows[0]
    ? Number(budgetRows[0].budget)
    : fallbackBudgetRows[0]
      ? Number(fallbackBudgetRows[0].budget)
      : null;
  const metaPacing  = pacingRows.filter(r => r.ad_channel === 'Meta').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const googlePacing = pacingRows.filter(r => r.ad_channel === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const stackadaptPacing = pacingRows.filter(r => r.ad_channel === 'StackAdapt').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: GoodGameBudgetPacing = {
    budget: MONTHLY_BUDGET,
    metaSpend: metaPacing,
    googleSpend: googlePacing,
    stackadaptSpend: stackadaptPacing,
    totalSpend: metaPacing + googlePacing + stackadaptPacing,
    monthStart,
    monthEnd,
  };

  const weeklyRows = (weeklyReadoutRes.data ?? []) as unknown as WeeklyReadoutRow[];
  const latestReadout = weeklyRows[0];
  const weeklyReadout: GoodGameWeeklyReadout | null = latestReadout
    ? {
        periodStart: latestReadout.period_start,
        periodEnd: latestReadout.period_end,
        overallStory: latestReadout.overall_story ?? '',
        wins: stringArray(latestReadout.wins),
        opportunities: stringArray(latestReadout.opportunities),
        accomplishments: stringArray(latestReadout.accomplishments),
        focusNextWeek: stringArray(latestReadout.focus_next_week),
        executionContext: stringArray(latestReadout.execution_context),
      }
    : null;

  const stockistHeatmap = (stockistRes.data ?? []) as unknown as StockistStateRow[];

  return { scope, filterParams: params, summary, prevSummary, timeSeries, channelRows, campaignRows, focusStats, metaCreatives, budgetPacing, weeklyReadout, stockistHeatmap };
}

export async function fetchGoodGameCreativeAnalysis(params: GoodGameFilterParams): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const [dashboard, aiInsight] = await Promise.all([
    fetchGoodGameDashboardData(params),
    fetchCreativeAiInsight(db, 'goodgame_creative_ai_insights', 'Good Game'),
  ]);
  const creatives = aggregateMetaCreativesByName(dashboard.metaCreatives);
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight,
  };
}
