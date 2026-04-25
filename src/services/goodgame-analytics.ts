import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

export type GoodGameFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type GoodGameSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
  costPerPurchase: number;
};

export type GoodGameCampaignRow = {
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
};

export type GoodGameDashboardData = {
  filterParams: GoodGameFilterParams;
  summary: GoodGameSummary;
  prevSummary: GoodGameSummary;
  campaignRows: GoodGameCampaignRow[];
  metaCreatives: MetaCreative[];
};

type AdRow = {
  date: string;
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

function summarise(rows: AdRow[]): GoodGameSummary {
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
  };
}

// Ad Library URLs are not playable as inline video — route them to previewUrl instead
function resolveVideoUrls(rawVideoUrl: string | null, rawPreviewUrl: string | null): { videoUrl: string; previewUrl: string } {
  const isAdLibraryUrl = rawVideoUrl?.startsWith('https://www.facebook.com/ads/library/') ?? false;
  return {
    videoUrl: !isAdLibraryUrl && rawVideoUrl ? rawVideoUrl : '',
    previewUrl: isAdLibraryUrl ? (rawVideoUrl ?? '') : (rawPreviewUrl ?? ''),
  };
}

export async function fetchGoodGameDashboardData(params: GoodGameFilterParams): Promise<GoodGameDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const [currRes, prevRes] = await Promise.all([
    db.from('goodgame_meta_ads')
      .select('date,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,conversions,leads,preview_url,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url,page_name,page_profile_image_url')
      .gte('date', start)
      .lte('date', end),
    db.from('goodgame_meta_ads')
      .select('date,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,conversions,leads,preview_url,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url,page_name,page_profile_image_url')
      .gte('date', compStart)
      .lte('date', compEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as AdRow[];
  const prevRows = (prevRes.data ?? []) as unknown as AdRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Campaign breakdown
  const campMap = new Map<string, GoodGameCampaignRow>();
  for (const r of currRows) {
    const existing = campMap.get(r.campaign_name) ?? {
      campaign: r.campaign_name,
      spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, roas: 0, ctr: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    campMap.set(r.campaign_name, existing);
  }
  const campaignRows: GoodGameCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 20);

  // Creative rollup — aggregate by ad_name + adset + campaign
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of currRows) {
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
    .slice(0, 30);

  return { filterParams: params, summary, prevSummary, campaignRows, metaCreatives };
}
