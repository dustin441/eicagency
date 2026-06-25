// Shared helper for the per-client "Creative Vision Insights" automation.
//
// Each client has its own n8n workflow (Claude Sonnet 4.6 with VISION over the
// last 30 days of ad creatives) that writes one structured row per day into a
// `{client}_creative_ai_insights` table in the Spartaco Supabase project. The
// schema mirrors `spartaco_creative_ai_insights`, so the shapes below match
// `SpartacoBrandAiInsight` and the card renders identically.
//
// Unlike Spartaco (which surfaces this on a dedicated "Ad Analysis" tab), these
// clients render the insight inline on their Performance tab, just above the Ad
// Performance / Meta Ad Creatives table.

import type { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export type CreativeAiInsightItem = { point: string; evidence?: string; why?: string };
export type CreativeAiInsightTest = { title: string; why?: string };

export type CreativeAiInsight = {
  brand: string;
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  videoVsImage: string;
  whatWorks: CreativeAiInsightItem[];
  improvements: CreativeAiInsightItem[];
  nextTests: CreativeAiInsightTest[];
  nextCreativeBrief: string;
  asOf: string; // as_of_date (YYYY-MM-DD)
};

type SpartacoClient = ReturnType<typeof createSpartacoSupabaseClient>;

// Latest structured AI insight for a single client/brand. Returns null when the
// table is empty or the query fails so callers can simply skip the card.
export async function fetchCreativeAiInsight(
  db: SpartacoClient,
  table: string,
  brand: string
): Promise<CreativeAiInsight | null> {
  const { data, error } = await db
    .from(table)
    .select(
      'brand,as_of_date,ads_analyzed,has_data,summary,video_vs_image,what_works,improvements,next_tests,next_creative_brief'
    )
    .eq('brand', brand)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const r = data as unknown as {
    brand: string;
    as_of_date: string | null;
    ads_analyzed: number | null;
    has_data: boolean | null;
    summary: string | null;
    video_vs_image: string | null;
    what_works: CreativeAiInsightItem[] | null;
    improvements: CreativeAiInsightItem[] | null;
    next_tests: CreativeAiInsightTest[] | null;
    next_creative_brief: string | null;
  };

  return {
    brand: r.brand,
    hasData: Boolean(r.has_data),
    adsAnalyzed: r.ads_analyzed ?? 0,
    summary: r.summary ?? '',
    videoVsImage: r.video_vs_image ?? '',
    whatWorks: Array.isArray(r.what_works) ? r.what_works : [],
    improvements: Array.isArray(r.improvements) ? r.improvements : [],
    nextTests: Array.isArray(r.next_tests) ? r.next_tests : [],
    nextCreativeBrief: r.next_creative_brief ?? '',
    asOf: r.as_of_date ?? '',
  };
}
