// Shared helper for the per-client "Creative Vision Insights" automation.
//
// Each client has its own n8n workflow (Claude Sonnet 4.6 with VISION over the
// last 30 days of ad creatives) that writes one structured row per day into a
// `{client}_creative_ai_insights` table in the Spartaco Supabase project. The
// schema mirrors `spartaco_creative_ai_insights`, so the shapes below match
// `SpartacoBrandAiInsight` and the card renders identically.
//
// Surfaced on each client's dedicated "Ad Analysis" tab (mirrors Spartaco/NSI),
// not inline on the Performance tab.

import type { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export type CreativeAiInsightItem = { point: string; evidence?: string; why?: string };

export type CreativeAiInsightTest = {
  title: string;
  why?: string;
  action?: string;
  primaryVariable?: string;
  creativeFormat?: string;
  referenceCreativeId?: string;
  referenceCreativeName?: string;
  priorityScore?: number | null;
};

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
type RawCreativeAiInsightTest = CreativeAiInsightTest & {
  primary_variable?: unknown;
  creative_format?: unknown;
  reference_creative_id?: unknown;
  reference_creative_name?: unknown;
  priority_score?: unknown;
};

export function normalizeCreativeAiInsightTest(value: unknown): CreativeAiInsightTest {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown> & RawCreativeAiInsightTest;
  const score = Number(row.priorityScore ?? row.priority_score);
  return {
    title: String(row.title ?? ''),
    why: row.why ? String(row.why) : undefined,
    action: row.action ? String(row.action) : undefined,
    primaryVariable: row.primaryVariable || row.primary_variable ? String(row.primaryVariable ?? row.primary_variable) : undefined,
    creativeFormat: row.creativeFormat || row.creative_format ? String(row.creativeFormat ?? row.creative_format) : undefined,
    referenceCreativeId: row.referenceCreativeId || row.reference_creative_id ? String(row.referenceCreativeId ?? row.reference_creative_id) : undefined,
    referenceCreativeName: row.referenceCreativeName || row.reference_creative_name ? String(row.referenceCreativeName ?? row.reference_creative_name) : undefined,
    priorityScore: Number.isFinite(score) ? score : null,
  };
}

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
    nextTests: Array.isArray(r.next_tests) ? r.next_tests.map(normalizeCreativeAiInsightTest).filter((test) => test.title) : [],
    nextCreativeBrief: r.next_creative_brief ?? '',
    asOf: r.as_of_date ?? '',
  };
}
