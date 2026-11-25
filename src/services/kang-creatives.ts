import type { MetaCreative } from './analytics';
import { aggregateKangRows, type KangRow } from './kang-metrics.ts';

export const KANG_ACCOUNT_ID = '1683292242584249';
export type KangCreativeMetadata = {
  account_id: string; ad_id: string;
} & Partial<Record<'creative_id' | 'ad_name' | 'headline' | 'primary_text' | 'image_url' | 'video_url' | 'video_id' | 'destination_url' | 'cta_type' | 'page_name' | 'page_profile_image_url' | 'preview_url' | 'updated_at', string | null>>;

// Facts own the ad universe and every metric. Current metadata only enriches display.
export function buildKangCreatives(rows: KangRow[], metadata: KangCreativeMetadata[]): MetaCreative[] {
  const byId = new Map(metadata.filter(row => row.account_id === KANG_ACCOUNT_ID).map(row => [row.ad_id, row]));
  return aggregateKangRows(rows.filter(row => row.account_id === KANG_ACCOUNT_ID)).ads.map(ad => {
    const meta = byId.get(ad.adId);
    return {
      adId: ad.adId, name: ad.name, campaign: ad.campaign, adset: ad.adset,
      headline: meta?.headline ?? '', primaryText: meta?.primary_text ?? '',
      finalCreativeLink: meta?.image_url ?? '', destinationUrl: meta?.destination_url ?? '',
      ctaType: meta?.cta_type ?? '', isVideo: Boolean(meta?.video_id || meta?.video_url),
      videoId: meta?.video_id ?? '', videoUrl: meta?.video_url ?? '',
      pageName: meta?.page_name ?? '', pageProfileImageUrl: meta?.page_profile_image_url ?? '',
      previewUrl: meta?.preview_url ?? '',
      // Required legacy fields are not rendered in traffic mode. Nullable traffic facts below are authoritative.
      spend: ad.cost ?? 0, impressions: ad.impressions ?? 0, clicks: ad.link_clicks ?? 0, leads: 0,
      clicksAvailable: ad.link_clicks !== null,
      traffic: { spend: ad.cost, impressions: ad.impressions, linkClicks: ad.link_clicks, linkCtr: ad.linkCtr, linkCpc: ad.linkCpc, landingPageViews: ad.landing_page_views, costPerLpv: ad.costPerLpv },
    };
  });
}
