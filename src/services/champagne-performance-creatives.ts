import type { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { MetaCreative } from '@/services/analytics';
import type { ChampagneFilterParams } from './champagne-analytics';
import { champagneCampaignMatchesScope, type ChampagneCampaignScope } from '../lib/champagne-campaign-scope.ts';

type CreativeRow = {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
  headline: string | null;
  primary_text: string | null;
  final_creative_link: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

const SELECT = 'date,id,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,leads,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url';

// Performance is one card per immutable ad ID, not the concept-level Ad Analysis.
// Keep this loader separate so concept grouping cannot collapse individual ads.
export async function fetchChampagnePerformanceCreatives(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  params: Pick<ChampagneFilterParams, 'start' | 'end' | 'channel'>,
  scope: ChampagneCampaignScope,
): Promise<MetaCreative[]> {
  if (params.channel !== 'all' && params.channel !== 'Meta') return [];
  const ads = new Map<string, MetaCreative>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('champagne_meta_ads_creatives')
      .select(SELECT)
      .gte('date', params.start)
      .lte('date', params.end)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    // Never show a silently incomplete gallery after a failed later page.
    if (error) throw new Error('Unable to load Champagne Haus individual ad creatives');
    const rows = (data ?? []) as unknown as CreativeRow[];
    for (const row of rows) {
      if (!champagneCampaignMatchesScope(row.campaign_name ?? '', scope)) continue;
      const adId = String(row.ad_id);
      const ad = ads.get(adId) ?? {
        adId, name: '', campaign: '', adset: '', headline: '', primaryText: '',
        finalCreativeLink: '', destinationUrl: '', ctaType: '', isVideo: false,
        videoId: '', videoUrl: '', spend: 0, impressions: 0, clicks: 0, leads: 0,
      };
      ad.spend += Number(row.spend ?? 0);
      ad.impressions += Number(row.impressions ?? 0);
      // This creative source exposes broad clicks, not verified link clicks.
      // Halloween is a link-click-only scope, so mark creative clicks unavailable.
      ad.clicks += scope === 'halloween' ? 0 : Number(row.clicks ?? 0);
      ad.leads += scope === 'halloween' ? 0 : Number(row.leads ?? 0);
      if (scope === 'halloween') ad.clicksAvailable = false;
      // Rows arrive oldest first. Refresh non-empty copy and expiring media URLs.
      ad.name = row.ad_name || row.headline || ad.name || adId;
      ad.campaign = row.campaign_name || ad.campaign;
      ad.adset = row.adset_name || ad.adset;
      ad.headline = row.headline || ad.headline;
      ad.primaryText = row.primary_text || ad.primaryText;
      ad.finalCreativeLink = row.final_creative_link || ad.finalCreativeLink;
      ad.destinationUrl = row.destination_url || ad.destinationUrl;
      ad.ctaType = row.cta_type || ad.ctaType;
      ad.videoId = row.video_id || ad.videoId;
      ad.videoUrl = row.video_url || ad.videoUrl;
      if (row.is_video != null) ad.isVideo = row.is_video;
      ads.set(adId, ad);
    }
    if (rows.length < pageSize) break;
  }
  return [...ads.values()].sort((a, b) => b.spend - a.spend);
}
