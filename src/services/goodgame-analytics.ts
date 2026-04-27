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

export type GoodGameDashboardData = {
  filterParams: GoodGameFilterParams;
  summary: GoodGameSummary;
  prevSummary: GoodGameSummary;
  timeSeries: GoodGameTimePoint[];
  channelRows: GoodGameChannelRow[];
  campaignRows: GoodGameCampaignRow[];
  metaCreatives: MetaCreative[];
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

function summarise(rows: MasterRow[]): GoodGameSummary {
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

  const masterSelect = 'date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue';

  const [currRes, prevRes, adRes] = await Promise.all([
    applyChannel(
      db.from('goodgame_master').select(masterSelect).gte('date', start).lte('date', end)
    ),
    applyChannel(
      db.from('goodgame_master').select(masterSelect).gte('date', compStart).lte('date', compEnd)
    ),
    // Creatives always Meta only — channel filter doesn't apply
    db.from('goodgame_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,conversions,leads,preview_url,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url,page_name,page_profile_image_url')
      .gte('date', start)
      .lte('date', end),
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
    pt.purchases += Number(r.purchases ?? 0);
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
        purchases: curr.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
        prevPurchases: prev.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
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
    row.purchases += Number(r.purchases ?? 0);
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

  // Creative rollup — ad-level, Meta only
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, r.preview_url);
    const existing = creativeMap.get(key) ?? {
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
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.purchases ?? r.conversions ?? 0);
    existing.headline ||= String(r.headline ?? '');
    existing.primaryText ||= String(r.primary_text ?? '');
    existing.finalCreativeLink ||= String(r.final_creative_link ?? '');
    existing.destinationUrl ||= String(r.destination_url ?? '');
    existing.ctaType ||= String(r.cta_type ?? '');
    existing.isVideo ||= Boolean(r.is_video);
    existing.videoId ||= String(r.video_id ?? '');
    if (!existing.videoUrl && videoUrl) existing.videoUrl = videoUrl;
    existing.pageName ||= String(r.page_name ?? '');
    existing.pageProfileImageUrl ||= String(r.page_profile_image_url ?? '');
    if (!existing.previewUrl && previewUrl) existing.previewUrl = previewUrl;
    creativeMap.set(key, existing);
  }
  const metaCreatives: MetaCreative[] = Array.from(creativeMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 100);

  return { filterParams: params, summary, prevSummary, timeSeries, channelRows, campaignRows, metaCreatives };
}
