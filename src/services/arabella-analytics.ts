import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

export type ArabellaFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type ArabellasSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type ArabellaTimePoint = {
  label: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number;
};

export type ArabellaChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
};

export type ArabellasCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  ctr: number;
  prevCtr: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  roas: number;
  prevRoas: number;
};

export type ArabellaAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  prevSpend: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  roas: number;
  prevRoas: number;
  clicks: number;
  prevClicks: number;
  impressions: number;
};

export type ArabellasBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type ArabellaWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type ArabellasDashboardData = {
  filterParams: ArabellaFilterParams;
  summary: ArabellasSummary;
  prevSummary: ArabellasSummary;
  timeSeries: ArabellaTimePoint[];
  channelRows: ArabellaChannelRow[];
  campaignRows: ArabellasCampaignRow[];
  adRows: ArabellaAdRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: ArabellasBudgetPacing;
  weeklyReadout: ArabellaWeeklyReadout | null;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
};

type AdRawRow = {
  ad_id?: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  preview_url: string;
};

type MetaCreativeRow = AdRawRow & {
  leads: number | null;
  final_creative_link: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  ad_status: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
  page_name: string | null;
  page_profile_image_url: string | null;
};

type BudgetRow = {
  budget: number;
};

type ReadoutRow = {
  period_start: string | null;
  period_end: string | null;
  overall_story: string | null;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

const CREATIVE_SELECT = 'ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url,leads,final_creative_link,primary_text,headline,destination_url,cta_type,ad_status,is_video,video_id,video_url,page_name,page_profile_image_url';

function summarise(rows: MasterRow[]): ArabellasSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + Number(r.purchases ?? 0), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

async function fetchPagedCreativeRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<MetaCreativeRow[]> {
  const rows: MetaCreativeRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('arabella_meta_ads_creatives')
      .select(CREATIVE_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return [];

    const page = (data ?? []) as unknown as MetaCreativeRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

// Maps raw arabella_meta_ads_creatives rows into MetaCreative[], deduped by
// ad_id/adset/campaign (fine-grained — a given ad running in two ad sets
// stays as two entries). Shared by the Performance tab (which additionally
// slices to top 30 by spend) and the Ad Analysis tab (which further
// aggregates by ad_name via aggregateMetaCreativesByName, no slice).
function buildArabellaMetaCreatives(creativeRows: MetaCreativeRow[]): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of creativeRows) {
    const key = `${r.ad_id || r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const existing = creativeMap.get(key) ?? {
      adId: String(r.ad_id ?? ''),
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name,
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl: String(r.video_url ?? ''),
      previewUrl: String(r.preview_url ?? ''),
      pageName: String(r.page_name ?? ''),
      pageProfileImageUrl: String(r.page_profile_image_url ?? ''),
      sales: 0,
      revenue: 0,
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.purchases ?? r.leads ?? 0);
    existing.sales = (existing.sales ?? 0) + Number(r.purchases ?? 0);
    existing.revenue = (existing.revenue ?? 0) + Number(r.revenue ?? 0);
    // Rows arrive oldest-first, so overwriting (not ||=) on every non-empty
    // value means the LATEST row wins — important because Meta's signed
    // final_creative_link/video URLs expire after a few days, so keeping the
    // first-seen row's link (as ||= did) served stale/broken images once an
    // ad had been running for most of the date range.
    if (r.headline) existing.headline = String(r.headline);
    if (r.primary_text) existing.primaryText = String(r.primary_text);
    if (r.final_creative_link) existing.finalCreativeLink = String(r.final_creative_link);
    if (r.destination_url) existing.destinationUrl = String(r.destination_url);
    if (r.cta_type) existing.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) existing.isVideo = Boolean(r.is_video);
    if (r.video_id) existing.videoId = String(r.video_id);
    if (r.video_url) existing.videoUrl = String(r.video_url);
    if (r.preview_url) existing.previewUrl = String(r.preview_url);
    if (r.page_name) existing.pageName = String(r.page_name);
    if (r.page_profile_image_url) existing.pageProfileImageUrl = String(r.page_profile_image_url);
    creativeMap.set(key, existing);
  }
  return Array.from(creativeMap.values())
    .filter(c => c.finalCreativeLink || c.primaryText || c.headline || c.isVideo);
}

export function arabellaParamsFromSearch(p: Record<string, string | undefined>): ArabellaFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
  };
}

export async function fetchArabellasDashboardData(params: ArabellaFilterParams): Promise<ArabellasDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, prevAdRes, creativeRows, budgetRes, pacingRes, readoutRes] = await Promise.all([
    db.from('arabella_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
      .gte('date', start)
      .lte('date', end),
    db.from('arabella_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('arabella_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url')
      .gte('date', start)
      .lte('date', end),
    db.from('arabella_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url')
      .gte('date', compStart)
      .lte('date', compEnd),
    fetchPagedCreativeRows(db, start, end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'arabella')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('arabella_master')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('arabella_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRawRow[];
  const prevRawAds = (prevAdRes.data ?? []) as unknown as AdRawRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; purchases: number; impressions: number; clicks: number; revenue: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, purchases: 0, impressions: 0, clicks: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries: ArabellaTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({
      label,
      ...d,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown (Meta only currently)
  const channels = ['Meta'];
  const channelRows: ArabellaChannelRow[] = channels.map(ch => {
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
      purchases: curr.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
      prevPurchases: prev.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
      revenue: curr.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
      prevRevenue: prev.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign rows — current period
  type CampAccum = { campaign: string; channel: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
  const campMap = new Map<string, CampAccum>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const existing = campMap.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    campMap.set(key, existing);
  }
  // Previous period by campaign
  const prevCampMap = new Map<string, CampAccum>();
  for (const r of prevRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const existing = prevCampMap.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    prevCampMap.set(key, existing);
  }
  const campaignRows: ArabellasCampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(`${c.campaign}__${c.channel}`) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 } as CampAccum;
      return {
        ...c,
        prevSpend: p.spend,
        prevImpressions: p.impressions,
        prevClicks: p.clicks,
        prevPurchases: p.purchases,
        prevRevenue: p.revenue,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        prevRoas: p.spend > 0 ? p.revenue / p.spend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Ad rows — current period, group by ad_name + adset_name
  type AdAccum = { adName: string; adsetName: string; campaignName: string; previewUrl: string; spend: number; purchases: number; revenue: number; clicks: number; impressions: number };
  const adMap = new Map<string, AdAccum>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}`;
    const existing = adMap.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: r.preview_url ?? '', spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.previewUrl ||= r.preview_url ?? '';
    adMap.set(key, existing);
  }
  // Previous period ads
  const prevAdMap = new Map<string, AdAccum>();
  for (const r of prevRawAds) {
    const key = `${r.ad_name}__${r.adset_name}`;
    const existing = prevAdMap.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: '', spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    prevAdMap.set(key, existing);
  }
  const adRows: ArabellaAdRow[] = Array.from(adMap.values())
    .map(a => {
      const p = prevAdMap.get(`${a.adName}__${a.adsetName}`) ?? { spend: 0, purchases: 0, revenue: 0, clicks: 0 } as AdAccum;
      return {
        ...a,
        roas: a.spend > 0 ? a.revenue / a.spend : 0,
        prevSpend: p.spend,
        prevPurchases: p.purchases,
        prevRevenue: p.revenue,
        prevRoas: p.spend > 0 ? p.revenue / p.spend : 0,
        prevClicks: p.clicks,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  const metaCreatives: MetaCreative[] = buildArabellaMetaCreatives(creativeRows)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Budget pacing
  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: ArabellasBudgetPacing = {
    budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
    totalSpend,
    monthStart,
    monthEnd,
  };

  const latestReadout = readoutRows[0];
  const weeklyReadout: ArabellaWeeklyReadout | null = latestReadout
    ? {
        periodStart: latestReadout.period_start ?? '',
        periodEnd: latestReadout.period_end ?? '',
        overallStory: latestReadout.overall_story ?? '',
        wins: stringArray(latestReadout.wins),
        opportunities: stringArray(latestReadout.opportunities),
        accomplishments: stringArray(latestReadout.accomplishments),
        focusNextWeek: stringArray(latestReadout.focus_next_week),
        executionContext: stringArray(latestReadout.execution_context),
      }
    : null;

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    adRows,
    metaCreatives,
    budgetPacing,
    weeklyReadout,
  };
}

// Powers the "Ad Analysis" tab — same source rows as
// fetchArabellasDashboardData, but aggregated by ad NAME (one card per
// creative, merged across ad sets/campaigns) instead of the Performance
// tab's finer-grained key, and with no top-30 cap.
export async function fetchArabellaCreativeAnalysis(params: ArabellaFilterParams): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const creativeRows = await fetchPagedCreativeRows(db, params.start, params.end);
  const creatives = aggregateMetaCreativesByName(buildArabellaMetaCreatives(creativeRows));
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight: await fetchCreativeAiInsight(db, 'arabella_creative_ai_insights', 'Arabella'),
  };
}
