import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { MetaCreative } from '@/services/analytics';
import { normalizeCreativeAiInsightTest, type CreativeAiInsightTest } from '@/services/creative-ai-insights';
import { aggregateMetaCreativesByIdentity, shouldReplaceMetaImage } from '@/lib/creative-deep-dive';

export type MedibraneAiInsightItem = { point: string; evidence?: string; why?: string };

export type MedibraneCreativeInsight = {
  segment: string;
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  whatWorks: MedibraneAiInsightItem[];
  improvements: MedibraneAiInsightItem[];
  nextTests: CreativeAiInsightTest[];
  nextCreativeBrief: string;
  asOf: string;
  periodStart: string;
  periodEnd: string;
  topAds: { ad_id?: string; adId?: string }[];
};

export type MedibraneCreativeAnalysis = {
  periodDays: number;
  meta: MetaCreative[];
  referenceMeta: MetaCreative[];
  insight: MedibraneCreativeInsight | null;
  asOf: string;
};

type MetaCreativeRow = {
  date: string;
  ad_id: string;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  leads: number | null;
  final_creative_link: string | null;
  permanent_image_url: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

const PERIOD_DAYS = 30;
const META_SELECT =
  'date,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,leads,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url';

export function getMedibraneCreativeWindow(days: number, now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function fetchPagedRows(start: string, end: string): Promise<MetaCreativeRow[]> {
  const db = createSpartacoSupabaseClient();
  const rows: MetaCreativeRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('medibrane_meta_ads_creatives')
      .select(META_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('ad_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch MediBraine creative rows: ${error.message}`);
    const page = (data ?? []) as unknown as MetaCreativeRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function buildMetaCreatives(rows: MetaCreativeRow[]): MetaCreative[] {
  const byAd = new Map<string, MetaCreative>();

  for (const row of rows) {
    if (!row.ad_id) continue;
    const existing = byAd.get(row.ad_id) ?? {
      adId: row.ad_id,
      name: row.ad_name || row.headline || row.campaign_name || row.ad_id,
      campaign: row.campaign_name || '',
      adset: row.adset_name || '',
      headline: row.headline || '',
      primaryText: row.primary_text || '',
      finalCreativeLink: row.final_creative_link || '',
      permanentImageUrl: row.permanent_image_url || '',
      destinationUrl: row.destination_url || '',
      ctaType: row.cta_type || '',
      isVideo: Boolean(row.is_video),
      videoId: row.video_id || '',
      videoUrl: row.video_url || '',
      previewUrl: `https://www.facebook.com/ads/library/?id=${row.ad_id}`,
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };

    existing.spend += Number(row.spend ?? 0);
    existing.impressions += Number(row.impressions ?? 0);
    existing.clicks += Number(row.clicks ?? 0);
    existing.leads += Number(row.leads ?? 0);
    existing.name = row.ad_name || existing.name;
    existing.campaign = row.campaign_name || existing.campaign;
    existing.adset = row.adset_name || existing.adset;
    existing.headline = row.headline || existing.headline;
    existing.primaryText = row.primary_text || existing.primaryText;
    existing.destinationUrl = row.destination_url || existing.destinationUrl;
    existing.ctaType = row.cta_type || existing.ctaType;
    existing.permanentImageUrl = row.permanent_image_url || existing.permanentImageUrl;
    existing.isVideo = row.is_video === null ? existing.isVideo : Boolean(row.is_video);
    existing.videoId = row.video_id || existing.videoId;
    existing.videoUrl = row.video_url || existing.videoUrl;

    const candidate = { finalCreativeLink: row.final_creative_link || '' };
    if (shouldReplaceMetaImage(existing, candidate)) {
      existing.finalCreativeLink = candidate.finalCreativeLink;
    }

    byAd.set(row.ad_id, existing);
  }

  return aggregateMetaCreativesByIdentity(Array.from(byAd.values()))
    .filter(creative => creative.finalCreativeLink || creative.permanentImageUrl || creative.primaryText || creative.headline || creative.isVideo)
    .sort((a, b) => b.spend - a.spend);
}

async function fetchLatestInsight(): Promise<MedibraneCreativeInsight | null> {
  const db = createSpartacoSupabaseClient();
  const { data, error } = await db
    .from('medibrane_creative_ai_insights')
    .select('segment,as_of_date,period_start,period_end,ads_analyzed,has_data,summary,what_works,improvements,next_tests,next_creative_brief,top_ads')
    .eq('segment', 'Meta')
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch MediBraine creative insight: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as {
    segment: string;
    as_of_date: string | null;
    ads_analyzed: number | null;
    has_data: boolean | null;
    summary: string | null;
    what_works: MedibraneAiInsightItem[] | null;
    improvements: MedibraneAiInsightItem[] | null;
    next_tests: unknown[] | null;
    next_creative_brief: string | null;
    period_start: string | null;
    period_end: string | null;
    top_ads: { ad_id?: string; adId?: string }[] | null;
  };

  return {
    segment: row.segment,
    hasData: Boolean(row.has_data),
    adsAnalyzed: row.ads_analyzed ?? 0,
    summary: row.summary ?? '',
    whatWorks: Array.isArray(row.what_works) ? row.what_works : [],
    improvements: Array.isArray(row.improvements) ? row.improvements : [],
    nextTests: Array.isArray(row.next_tests)
      ? row.next_tests.map(normalizeCreativeAiInsightTest).filter(test => test.title)
      : [],
    nextCreativeBrief: row.next_creative_brief ?? '',
    asOf: row.as_of_date ?? '',
    periodStart: row.period_start ?? '',
    periodEnd: row.period_end ?? '',
    topAds: Array.isArray(row.top_ads) ? row.top_ads : [],
  };
}

export async function fetchMedibraneCreativeAnalysis(): Promise<MedibraneCreativeAnalysis> {
  const currentWindow = getMedibraneCreativeWindow(PERIOD_DAYS);
  const [rows, insight] = await Promise.all([
    fetchPagedRows(currentWindow.start, currentWindow.end),
    fetchLatestInsight(),
  ]);
  const meta = buildMetaCreatives(rows);
  const insightWindowIsCurrent = insight?.periodStart === currentWindow.start && insight?.periodEnd === currentWindow.end;
  const snapshotRows = insight?.periodStart && insight?.periodEnd
    ? insightWindowIsCurrent ? rows : await fetchPagedRows(insight.periodStart, insight.periodEnd)
    : rows;
  const snapshotMeta = buildMetaCreatives(snapshotRows);
  const referenceIds = new Set([
    ...(insight?.topAds ?? []).map(ad => String(ad.ad_id ?? ad.adId ?? '').trim()),
    ...(insight?.nextTests ?? []).map(test => String(test.referenceCreativeId ?? '').trim()),
  ].filter(Boolean));
  const referenceMeta = referenceIds.size
    ? snapshotMeta.filter(creative => referenceIds.has(String(creative.adId ?? '').trim()))
    : snapshotMeta;

  return {
    periodDays: PERIOD_DAYS,
    meta,
    referenceMeta,
    insight,
    asOf: insight?.asOf ?? '',
  };
}
