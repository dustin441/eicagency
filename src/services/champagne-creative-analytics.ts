// Champagne Haus — Ad Analysis (creative-level) data layer.
//
// Champagne Haus is Google-only. Creatives + the daily Claude-vision insights live
// in the Spartaco/NSI Supabase project (lozgnyxixzfxokllevtb), populated by two n8n
// workflows: "Champagne Haus Google Creatives -> Supabase" (Search RSA + Display RDA
// + PMax assets) and "Champagne Haus Creative Vision Insights" (per-channel AI
// analysis).
//
// All metrics here are real per-ad sums for Search and Display. PMax per-asset
// cost/clicks are the asset GROUP's metrics replicated onto each asset, so they
// are NOT additive — we use them only to rank assets, and pull the TRUE PMax
// spend/clicks for the header from the campaign-level champagne_google table.

import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { GoogleCreative } from '@/services/analytics';

export type ChampagneCreativeKpis = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // fraction 0-1
  cpc: number;
  engagements?: number;
  costPerEngagement?: number;
};

export type ChampagneImageCreative = {
  id: string;
  name: string;
  imageUrl: string;
  type: string; // field_type / asset_type label
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number; // fraction
  cpc: number;
  headlines?: string[];
  descriptions?: string[];
};

export type ChampagnePmaxTextAsset = {
  id: string;
  type: string;
  text: string;
  spend: number;
  clicks: number;
  cpc: number;
};

export type ChampagneAiInsightItem = { point: string; evidence?: string; why?: string };
export type ChampagneAiTest = { title: string; why?: string };
export type ChampagneChannelInsight = {
  segment: string; // 'Search' | 'Display' | 'PMax'
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  whatWorks: ChampagneAiInsightItem[];
  improvements: ChampagneAiInsightItem[];
  nextTests: ChampagneAiTest[];
  nextCreativeBrief: string;
  asOf: string; // YYYY-MM-DD
};

export type ChampagneCreativeAnalysis = {
  periodDays: number;
  search: { kpis: ChampagneCreativeKpis; google: GoogleCreative[] };
  display: { kpis: ChampagneCreativeKpis; creatives: ChampagneImageCreative[] };
  pmax: { kpis: ChampagneCreativeKpis; creatives: ChampagneImageCreative[]; textAssets: ChampagnePmaxTextAsset[] };
  insights: Record<string, ChampagneChannelInsight>;
  asOf: string;
};

const PERIOD_DAYS = 30;

function windowStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Collect distinct, non-empty {prefix}{1..n} values in order (RSA assets).
function collectAssets(row: Record<string, unknown>, prefix: string, count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= count; i++) {
    const v = String(row[`${prefix}${i}`] ?? '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function kpisFrom(rows: { spend: number; impressions: number; clicks: number; engagements?: number }[]): ChampagneCreativeKpis {
  const spend = rows.reduce((a, r) => a + r.spend, 0);
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const engagements = rows.reduce((a, r) => a + (r.engagements ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    engagements,
    costPerEngagement: engagements > 0 ? spend / engagements : undefined,
  };
}

// ─── Search (RSA copy) ──────────────────────────────────────────────────────────

async function fetchSearch(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string
): Promise<{ kpis: ChampagneCreativeKpis; google: GoogleCreative[] }> {
  const cols =
    'ad_id,campaign_name,ad_group_name,clicks,impressions,cost,conversions,' +
    'headline_1,headline_2,headline_3,headline_4,headline_5,headline_6,headline_7,headline_8,' +
    'headline_9,headline_10,headline_11,headline_12,headline_13,headline_14,headline_15,' +
    'description_1,description_2,description_3,description_4';
  const { data } = await supabase
    .from('champagne_google_search_creatives')
    .select(cols)
    .gte('date', start);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const byAd = new Map<string, GoogleCreative>();
  for (const r of rows) {
    const id = String(r.ad_id ?? '');
    if (!id) continue;
    const existing = byAd.get(id);
    const spend = num(r.cost);
    const clicks = num(r.clicks);
    const impressions = num(r.impressions);
    const results = num(r.conversions);
    if (!existing) {
      const headlines = collectAssets(r, 'headline_', 15);
      const descriptions = collectAssets(r, 'description_', 4);
      byAd.set(id, {
        name: String(r.ad_group_name || r.campaign_name || id),
        campaign: String(r.campaign_name ?? ''),
        headline: headlines[0] ?? '',
        description: descriptions[0] ?? '',
        headlines,
        descriptions,
        spend,
        clicks,
        impressions,
        results,
      });
    } else {
      existing.spend += spend;
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.results += results;
    }
  }
  const google = Array.from(byAd.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);
  const kpis = kpisFrom(google.map((g) => ({ spend: g.spend, impressions: g.impressions, clicks: g.clicks })));
  return { kpis, google };
}

// ─── Display (RDA image + copy) ─────────────────────────────────────────────────

async function fetchDisplay(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string
): Promise<{ kpis: ChampagneCreativeKpis; creatives: ChampagneImageCreative[] }> {
  const { data } = await supabase
    .from('champagne_google_display_creatives')
    .select(
      'ad_id,ad_name,ad_group_name,image_url,headlines,descriptions,long_headline,impressions,clicks,cost,engagements'
    )
    .gte('date', start);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  type Agg = ChampagneImageCreative & { engagements: number };
  const byAd = new Map<string, Agg>();
  for (const r of rows) {
    const id = String(r.ad_id ?? '');
    if (!id) continue;
    const spend = num(r.cost);
    const clicks = num(r.clicks);
    const impressions = num(r.impressions);
    const engagements = num(r.engagements);
    const existing = byAd.get(id);
    if (!existing) {
      const headlines = String(r.headlines ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
      const descriptions = String(r.descriptions ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
      const lh = String(r.long_headline ?? '').trim();
      byAd.set(id, {
        id,
        name: String(r.ad_name || r.ad_group_name || id),
        imageUrl: String(r.image_url ?? ''),
        type: 'Responsive Display',
        spend,
        clicks,
        impressions,
        ctr: 0,
        cpc: 0,
        headlines: lh ? [lh, ...headlines] : headlines,
        descriptions,
        engagements,
      });
    } else {
      existing.spend += spend;
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.engagements += engagements;
      if (!existing.imageUrl && r.image_url) existing.imageUrl = String(r.image_url);
    }
  }
  const aggs = Array.from(byAd.values());
  const creatives: ChampagneImageCreative[] = aggs
    .slice()
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 24)
    .map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      type: a.type,
      spend: a.spend,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
      headlines: a.headlines,
      descriptions: a.descriptions,
    }));
  const kpis = kpisFrom(
    aggs.map((a) => ({ spend: a.spend, impressions: a.impressions, clicks: a.clicks, engagements: a.engagements }))
  );
  return { kpis, creatives };
}

// ─── PMax (assets) ──────────────────────────────────────────────────────────────

async function fetchPmax(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string
): Promise<{ kpis: ChampagneCreativeKpis; creatives: ChampagneImageCreative[]; textAssets: ChampagnePmaxTextAsset[] }> {
  // Per-asset content + relative metrics (asset-group attributed → ranking only).
  const { data: assetData } = await supabase
    .from('champagne_google_pmax_creatives')
    .select(
      'id,asset_name,asset_type,field_type,text_content,asset_image_url,url_image_video,impressions,clicks,cost,cpc'
    );
  const assets = (assetData ?? []) as unknown as Record<string, unknown>[];

  const creatives: ChampagneImageCreative[] = [];
  const textAssets: ChampagnePmaxTextAsset[] = [];
  for (const a of assets) {
    const img = String(a.asset_image_url || a.url_image_video || '');
    const spend = num(a.cost);
    const clicks = num(a.clicks);
    const impressions = num(a.impressions);
    const type = String(a.field_type || a.asset_type || '');
    if (img && img.length > 4) {
      creatives.push({
        id: String(a.id ?? ''),
        name: String(a.asset_name || a.id || ''),
        imageUrl: img,
        type,
        spend,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
      });
    } else if (String(a.text_content ?? '').trim()) {
      textAssets.push({
        id: String(a.id ?? ''),
        type,
        text: String(a.text_content),
        spend,
        clicks,
        cpc: clicks > 0 ? spend / clicks : 0,
      });
    }
  }
  creatives.sort((a, b) => b.spend - a.spend);
  textAssets.sort((a, b) => b.spend - a.spend);

  // TRUE PMax spend/clicks come from the campaign-level table (per-asset cost is
  // not additive). champagne_google tags PMax campaigns ad_channel='Google Pmax'.
  const { data: campData } = await supabase
    .from('champagne_google')
    .select('cost,clicks,impressions')
    .eq('ad_channel', 'Google Pmax')
    .gte('date', start);
  const camp = (campData ?? []) as unknown as { cost: unknown; clicks: unknown; impressions: unknown }[];
  const kpis = kpisFrom(
    camp.map((c) => ({ spend: num(c.cost), impressions: num(c.impressions), clicks: num(c.clicks) }))
  );

  return { kpis, creatives: creatives.slice(0, 24), textAssets: textAssets.slice(0, 40) };
}

// ─── AI insights (per channel) ──────────────────────────────────────────────────

async function fetchInsights(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>
): Promise<Record<string, ChampagneChannelInsight>> {
  const out: Record<string, ChampagneChannelInsight> = {};
  const { data } = await supabase
    .from('champagne_creative_ai_insights')
    .select('segment,as_of_date,ads_analyzed,has_data,summary,what_works,improvements,next_tests,next_creative_brief')
    .order('as_of_date', { ascending: false });
  type Row = {
    segment: string;
    as_of_date: string | null;
    ads_analyzed: number | null;
    has_data: boolean | null;
    summary: string | null;
    what_works: ChampagneAiInsightItem[] | null;
    improvements: ChampagneAiInsightItem[] | null;
    next_tests: ChampagneAiTest[] | null;
    next_creative_brief: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  for (const r of rows) {
    if (out[r.segment]) continue; // newest-first; keep latest per segment
    out[r.segment] = {
      segment: r.segment,
      hasData: Boolean(r.has_data),
      adsAnalyzed: r.ads_analyzed ?? 0,
      summary: r.summary ?? '',
      whatWorks: Array.isArray(r.what_works) ? r.what_works : [],
      improvements: Array.isArray(r.improvements) ? r.improvements : [],
      nextTests: Array.isArray(r.next_tests) ? r.next_tests : [],
      nextCreativeBrief: r.next_creative_brief ?? '',
      asOf: r.as_of_date ?? '',
    };
  }
  return out;
}

export async function fetchChampagneCreativeAnalysis(): Promise<ChampagneCreativeAnalysis> {
  const supabase = createSpartacoSupabaseClient();
  const start = windowStart(PERIOD_DAYS);

  const [search, display, pmax, insights] = await Promise.all([
    fetchSearch(supabase, start),
    fetchDisplay(supabase, start),
    fetchPmax(supabase, start),
    fetchInsights(supabase),
  ]);

  const asOf =
    Object.values(insights)
      .map((i) => i.asOf)
      .filter(Boolean)
      .sort()
      .pop() ?? '';

  return { periodDays: PERIOD_DAYS, search, display, pmax, insights, asOf };
}
