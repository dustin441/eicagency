import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

// ─── Good Game — Ad Analysis tab ───────────────────────────────────────────────
// Mirrors the Spartaco/PrePass Ad Analysis pattern: every Meta ad grouped by
// Ad Name in one place, split by campaign objective instead of by brand/focus.
// Paid Media Performance and Sales keep their own separate ad rollups
// (goodgame_creative_rollup / goodgame_sales_creative_rollup) untouched — this
// tab is purely an additional cross-objective view built from
// goodgame_ad_analysis_rollup, which classifies each ad's objective from its
// campaign_name (Trafego/Localizacao/Engajamento view/Engajamento comments/Sales).

export const GOODGAME_AD_OBJECTIVES = [
  'Traffic',
  'Location',
  'Engagement - Views',
  'Engagement - Comments',
  'Sales',
  'Others',
] as const;

export type GoodGameAdObjective = (typeof GOODGAME_AD_OBJECTIVES)[number];

export const GOODGAME_OBJECTIVE_LABELS: Record<GoodGameAdObjective, string> = {
  Traffic: 'Traffic',
  Location: 'Location (Get Directions)',
  'Engagement - Views': 'Engagement — Views',
  'Engagement - Comments': 'Engagement — Comments & Likes',
  Sales: 'Sales',
  Others: 'Others',
};

export type GoodGameAdAnalysisSummary = {
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

export type GoodGameAdAnalysisBlock = {
  objective: GoodGameAdObjective;
  ads: MetaCreative[];
  summary: GoodGameAdAnalysisSummary;
};

export type GoodGameAdAnalysisParams = {
  start: string;
  end: string;
};

export type GoodGameAdAnalysisData = {
  params: GoodGameAdAnalysisParams;
  blocks: GoodGameAdAnalysisBlock[];
};

type AdRow = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  objective: string;
  cost: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  leads: number;
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
  preview_url: string | null;
};

// Ad Library URLs are not playable inline — route to previewUrl instead.
function resolveVideoUrls(rawVideoUrl: string | null, rawPreviewUrl: string | null) {
  const isAdLibrary = rawVideoUrl?.startsWith('https://www.facebook.com/ads/library/') ?? false;
  return {
    videoUrl: !isAdLibrary && rawVideoUrl ? rawVideoUrl : '',
    previewUrl: isAdLibrary ? (rawVideoUrl ?? '') : (rawPreviewUrl ?? ''),
  };
}

function toCreative(r: AdRow): MetaCreative {
  const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, r.preview_url);
  const purchases = Number(r.purchases ?? 0);
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
    sales: purchases,
    revenue: Number(r.revenue ?? 0),
    leads: Number(r.leads || purchases),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
  };
}

function summarize(ads: MetaCreative[]): GoodGameAdAnalysisSummary {
  const spend = ads.reduce((a, c) => a + c.spend, 0);
  const impressions = ads.reduce((a, c) => a + c.impressions, 0);
  const clicks = ads.reduce((a, c) => a + c.clicks, 0);
  const purchases = ads.reduce((a, c) => a + (c.sales ?? 0), 0);
  const revenue = ads.reduce((a, c) => a + (c.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
  };
}

export function goodgameAdAnalysisParamsFromSearch(
  p: Record<string, string | undefined>
): GoodGameAdAnalysisParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  return {
    start: p.start ?? defStart,
    end: p.end ?? defEnd,
  };
}

export async function fetchGoodGameAdAnalysis(
  params: GoodGameAdAnalysisParams
): Promise<GoodGameAdAnalysisData> {
  const db = createSpartacoSupabaseClient();
  const { data } = await db.rpc('goodgame_ad_analysis_rollup', {
    p_start: params.start,
    p_end: params.end,
  });
  const rows = (data ?? []) as unknown as AdRow[];

  const blocks: GoodGameAdAnalysisBlock[] = GOODGAME_AD_OBJECTIVES.map((objective) => {
    const ads = rows
      .filter((r) => r.objective === objective)
      .map(toCreative)
      .sort((a, b) => b.spend - a.spend);
    return { objective, ads, summary: summarize(ads) };
  }).filter((block) => block.ads.length > 0);

  return { params, blocks };
}
