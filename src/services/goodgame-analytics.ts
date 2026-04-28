import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

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
  ctr: number;
  cpc: number;
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
  purchases: number;
  revenue: number;
};

export type GoodGameChannelRow = {
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

export type GoodGameCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
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
  cpc: number;        // derived
  costPer75: number;  // derived — Engagement
  ctr: number;        // derived
  // vs prior period
  prevSpend: number;
  prevImpressions: number;
  prevClicks: number;
  prevViews75: number;
  prevThruplays: number;
};

export type GoodGameBudgetPacing = {
  budget: number;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type GoodGameDashboardData = {
  filterParams: GoodGameFilterParams;
  summary: GoodGameSummary;
  prevSummary: GoodGameSummary;
  timeSeries: GoodGameTimePoint[];
  channelRows: GoodGameChannelRow[];
  campaignRows: GoodGameCampaignRow[];
  focusStats: GoodGameFocusStats[];
  metaCreatives: MetaCreative[];
  budgetPacing: GoodGameBudgetPacing;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number | null;
  conversions: number | null;  // Google uses this; Meta uses purchases
  revenue: number;
};

type AdRow = {
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
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
  page_name: string | null;
  page_profile_image_url: string | null;
};

function rowPurchases(r: MasterRow): number {
  // Google stores conversions in `conversions`; Meta stores them in `purchases`
  return Number(r.purchases ?? r.conversions ?? 0);
}

function summarise(rows: MasterRow[]): GoodGameSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowPurchases(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
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

export async function fetchGoodGameDashboardData(params: GoodGameFilterParams): Promise<GoodGameDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyChannel(q: any) {
    return channel !== 'all' ? q.eq('ad_channel', channel) : q;
  }

  const masterSelect = 'date,campaign_name,ad_channel,impressions,clicks,cost,purchases,conversions,revenue';

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, focusCurrRes, focusPrevRes, pacingRes] = await Promise.all([
    applyChannel(
      db.from('goodgame_master').select(masterSelect).gte('date', start).lte('date', end)
    ),
    applyChannel(
      db.from('goodgame_master').select(masterSelect).gte('date', compStart).lte('date', compEnd)
    ),
    // Creatives: use RPC to aggregate server-side — avoids the 1,000-row Supabase default limit
    db.rpc('goodgame_creative_rollup', { p_start: start, p_end: end }),
    db.rpc('goodgame_focus_rollup', { p_start: start, p_end: end }),
    db.rpc('goodgame_focus_rollup', { p_start: compStart, p_end: compEnd }),
    // Budget pacing: always current calendar month, no channel filter
    db.from('goodgame_master').select('ad_channel,cost').gte('date', monthStart).lte('date', monthEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, GoodGameTimePoint>();
  for (const r of currRows) {
    const pt = dateMap.get(r.date) ?? { label: r.date, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    pt.spend += Number(r.cost ?? 0);
    pt.impressions += Number(r.impressions ?? 0);
    pt.clicks += Number(r.clicks ?? 0);
    pt.purchases += rowPurchases(r);
    pt.revenue += Number(r.revenue ?? 0);
    dateMap.set(r.date, pt);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown
  const allChannels = channel === 'all' ? ['Meta', 'Google'] : [channel];
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
      spend: 0, impressions: 0, clicks: 0, ctr: 0, purchases: 0, revenue: 0, roas: 0,
    };
    row.spend += Number(r.cost ?? 0);
    row.impressions += Number(r.impressions ?? 0);
    row.clicks += Number(r.clicks ?? 0);
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

  // Creative rollup — RPC already returns one pre-aggregated row per ad_id, sorted by spend DESC LIMIT 100
  const metaCreatives: MetaCreative[] = rawAds.map(r => {
    const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, r.preview_url);
    return {
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
      videoUrl,
      pageName: String(r.page_name ?? ''),
      pageProfileImageUrl: String(r.page_profile_image_url ?? ''),
      previewUrl,
      spend: Number(r.cost ?? 0),
      leads: Number(r.purchases ?? r.leads ?? 0),
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
    };
  });

  // Focus breakdown — merge current + previous period by focus name
  type FocusRow = { focus: string; spend: number; impressions: number; clicks: number; views_75: number; thruplays: number };
  const focusCurr  = (focusCurrRes.data  ?? []) as unknown as FocusRow[];
  const focusPrev  = (focusPrevRes.data  ?? []) as unknown as FocusRow[];
  const FOCUSES = ['Engagement', 'Traffic', 'Conversion'] as const;

  const focusStats: GoodGameFocusStats[] = FOCUSES
    .map(f => {
      const c = focusCurr.find(r => r.focus === f) ?? { spend: 0, impressions: 0, clicks: 0, views_75: 0, thruplays: 0 };
      const p = focusPrev.find(r => r.focus === f) ?? { spend: 0, impressions: 0, clicks: 0, views_75: 0, thruplays: 0 };
      const spend = Number(c.spend ?? 0);
      const clicks = Number(c.clicks ?? 0);
      const views75 = Number(c.views_75 ?? 0);
      return {
        focus: f,
        spend,
        impressions: Number(c.impressions ?? 0),
        clicks,
        views75,
        thruplays: Number(c.thruplays ?? 0),
        cpc: clicks > 0 ? spend / clicks : 0,
        costPer75: views75 > 0 ? spend / views75 : 0,
        ctr: Number(c.impressions ?? 0) > 0 ? (clicks / Number(c.impressions ?? 0)) * 100 : 0,
        prevSpend: Number(p.spend ?? 0),
        prevImpressions: Number(p.impressions ?? 0),
        prevClicks: Number(p.clicks ?? 0),
        prevViews75: Number(p.views_75 ?? 0),
        prevThruplays: Number(p.thruplays ?? 0),
      };
    })
    .filter(f => f.spend > 0 || f.prevSpend > 0);

  // Budget pacing — $20k/month hardcoded
  const MONTHLY_BUDGET = 20_000;
  const pacingRows = (pacingRes.data ?? []) as unknown as { ad_channel: string; cost: number }[];
  const metaPacing  = pacingRows.filter(r => r.ad_channel === 'Meta').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const googlePacing = pacingRows.filter(r => r.ad_channel === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: GoodGameBudgetPacing = {
    budget: MONTHLY_BUDGET,
    metaSpend: metaPacing,
    googleSpend: googlePacing,
    totalSpend: metaPacing + googlePacing,
    monthStart,
    monthEnd,
  };

  return { filterParams: params, summary, prevSummary, timeSeries, channelRows, campaignRows, focusStats, metaCreatives, budgetPacing };
}
