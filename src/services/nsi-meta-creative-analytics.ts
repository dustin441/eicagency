// NSI — Meta Ad Creatives (Ad Analysis tab). Same shape/pattern as
// bloom-analytics.ts / durodyne-analytics.ts: reads `nsi_meta_ads_creatives`
// (populated by n8n "NSI Meta Ads Creatives -> Supabase"), builds MetaCreative[],
// and pulls the AI vision insight from `nsi_meta_creative_ai_insights`
// (populated by n8n "NSI Meta Creative Vision Insights"). NSI is a leads
// business — `leads` maps directly from the table's own `leads` column.

import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

const PERIOD_DAYS = 30;
const SUPABASE_PAGE_SIZE = 1000;

type AdRow = {
  id: number;
  date: string;
  ad_id: string;
  ad_name: string;
  adset_name: string | null;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  leads: number;
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
  preview_url: string | null;
};

const ROW_SELECT =
  'id,date,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,leads,' +
  'final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,' +
  'is_video,video_id,video_url,page_name,page_profile_image_url,preview_url';

function windowStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Aggregates by ad_id (NSI's table is already ad-level, unlike Bloom's
// ad+adset+campaign key) so the same ad running across ad sets merges into
// one card. Latest non-empty value wins per field (Meta's signed image/video
// URLs expire, so the newest row has the freshest link).
function buildNsiMetaCreatives(rows: AdRow[]): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rows) {
    const key = r.ad_id || `${r.ad_name}__${r.campaign_name}`;
    const ex = creativeMap.get(key) ?? {
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name ?? '',
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      permanentImageUrl: String(r.permanent_image_url ?? ''),
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl: String(r.video_url ?? ''),
      pageName: r.page_name ?? undefined,
      pageProfileImageUrl: r.page_profile_image_url ?? undefined,
      previewUrl: r.preview_url ?? undefined,
      adId: r.ad_id,
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    ex.spend += Number(r.cost ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    ex.leads += Number(r.leads ?? 0);
    if (r.headline) ex.headline = String(r.headline);
    if (r.primary_text) ex.primaryText = String(r.primary_text);
    if (r.final_creative_link) ex.finalCreativeLink = String(r.final_creative_link);
    if (r.permanent_image_url) ex.permanentImageUrl = String(r.permanent_image_url);
    if (r.destination_url) ex.destinationUrl = String(r.destination_url);
    if (r.cta_type) ex.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) ex.isVideo = Boolean(r.is_video);
    if (r.video_id) ex.videoId = String(r.video_id);
    if (r.video_url) ex.videoUrl = String(r.video_url);
    if (r.page_name) ex.pageName = r.page_name;
    if (r.page_profile_image_url) ex.pageProfileImageUrl = r.page_profile_image_url;
    creativeMap.set(key, ex);
  }
  return Array.from(creativeMap.values());
}

async function fetchPagedNsiMetaRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string
): Promise<AdRow[]> {
  const rows: AdRow[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await db
      .from('nsi_meta_ads_creatives')
      .select(ROW_SELECT)
      .gte('date', start)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch NSI Meta creative rows: ${error.message}`);
    const page = (data ?? []) as unknown as AdRow[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

// Powers the Meta section of the NSI Ad Analysis tab — same source table used
// by the shared CreativeAnalysisClient / GoodGameCreativeLearningLoop pattern.
export async function fetchNsiMetaCreativeAnalysis(): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const rows = await fetchPagedNsiMetaRows(db, windowStart(PERIOD_DAYS));
  const creatives = aggregateMetaCreativesByName(buildNsiMetaCreatives(rows));
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight: await fetchCreativeAiInsight(db, 'nsi_meta_creative_ai_insights', 'NSI'),
  };
}
