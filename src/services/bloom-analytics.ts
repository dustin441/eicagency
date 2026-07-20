import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

export type BloomFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type BloomSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  websiteChats: number;
  costPerWebchat: number;
};

export type BloomTimePoint = {
  label: string;
  spend: number;
  websiteChats: number;
  impressions: number;
  clicks: number;
};

export type BloomCampaignRow = {
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  websiteChats: number;
  ctr: number;
  costPerWebchat: number;
};

export type BloomWeeklyReadout = {
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
  periodStart: string;
  periodEnd: string;
};

export type BloomBudgetPacing = {
  budget: number | null;
  spend: number;
  monthStart: string;
  monthEnd: string;
};

export type BloomDashboardData = {
  filterParams: BloomFilterParams;
  summary: BloomSummary;
  prevSummary: BloomSummary;
  timeSeries: BloomTimePoint[];
  campaignRows: BloomCampaignRow[];
  metaCreatives: MetaCreative[];
  weeklyReadout: BloomWeeklyReadout | null;
  budgetPacing: BloomBudgetPacing;
};

type AdRow = {
  id: number;
  date: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  website_chats: number;
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

type ReadoutRow = {
  period_start: string | null;
  period_end: string | null;
  overall_story: string | null;
  wins: string[] | null;
  opportunities: string[] | null;
  accomplishments: string[] | null;
  focus_next_week: string[] | null;
  execution_context: string[] | null;
};

function summarise(rows: Pick<AdRow, 'cost' | 'impressions' | 'clicks' | 'website_chats'>[]): BloomSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const websiteChats = rows.reduce((s, r) => s + Number(r.website_chats ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    websiteChats,
    costPerWebchat: websiteChats > 0 ? spend / websiteChats : 0,
  };
}


const BLOOM_ROW_SELECT = 'id,date,ad_name,adset_name,campaign_name,impressions,clicks,cost,website_chats,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url';
const SUPABASE_PAGE_SIZE = 1000;

// Maps raw bloom_meta_ads rows into MetaCreative[], deduped by
// ad_name/adset/campaign (fine-grained — a given ad running in two ad sets
// stays as two entries). website_chats is mapped to the `leads` field for
// MetaCreative compatibility. Shared by the Performance tab (which
// additionally slices to top 30 by spend) and the Ad Analysis tab (which
// further aggregates by ad_name via aggregateMetaCreativesByName, no slice).
function buildBloomMetaCreatives(rows: AdRow[]): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rows) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const ex = creativeMap.get(key) ?? {
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name,
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      permanentImageUrl: String(r.permanent_image_url ?? ''),
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl: String(r.video_url ?? ''),
      spend: 0, leads: 0, clicks: 0, impressions: 0,
    };
    ex.spend += Number(r.cost ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    ex.leads += Number(r.website_chats ?? 0);
    // Rows arrive oldest-first, so overwriting (not ||=) on every non-empty
    // value means the LATEST row wins — important because Meta's signed
    // final_creative_link/video URLs expire after a few days, so keeping the
    // first-seen row's link (as ||= did) served stale/broken images once an
    // ad had been running for most of the date range.
    if (r.headline) ex.headline = String(r.headline);
    if (r.primary_text) ex.primaryText = String(r.primary_text);
    if (r.final_creative_link) ex.finalCreativeLink = String(r.final_creative_link);
    if (r.permanent_image_url) ex.permanentImageUrl = String(r.permanent_image_url);
    if (r.destination_url) ex.destinationUrl = String(r.destination_url);
    if (r.cta_type) ex.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) ex.isVideo = Boolean(r.is_video);
    if (r.video_id) ex.videoId = String(r.video_id);
    if (r.video_url) ex.videoUrl = String(r.video_url);
    creativeMap.set(key, ex);
  }
  return Array.from(creativeMap.values());
}

// Every reporting query must paginate because even a 30-day range can exceed
// Supabase's 1,000-row response cap. Date + id ordering keeps page boundaries
// deterministic while preserving oldest-first creative-link selection.
async function fetchPagedBloomRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<AdRow[]> {
  const rows: AdRow[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await db.from('bloom_meta_ads')
      .select(BLOOM_ROW_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch Bloom reporting rows: ${error.message}`);
    const page = (data ?? []) as unknown as AdRow[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchPagedBloomCosts(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<{ cost: number }[]> {
  const rows: { cost: number }[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await db.from('bloom_meta_ads')
      .select('id,cost')
      .gte('date', start)
      .lte('date', end)
      .order('id', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch Bloom pacing rows: ${error.message}`);
    const page = (data ?? []) as unknown as { cost: number }[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

export function bloomParamsFromSearch(p: Record<string, string | undefined>): BloomFilterParams {
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

export async function fetchBloomDashboardData(params: BloomFilterParams): Promise<BloomDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
  const yday = new Date(now); yday.setDate(yday.getDate() - 1);
  const monthEnd = yday.toISOString().split('T')[0] < monthStart ? monthStart : yday.toISOString().split('T')[0];

  const [currRows, prevRows, readoutRes, budgetRes, pacingRows] = await Promise.all([
    fetchPagedBloomRows(db, start, end),
    fetchPagedBloomRows(db, compStart, compEnd),
    db.from('bloom_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .order('generated_at', { ascending: false })
      .limit(1),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'bloom')
      .order('period_start', { ascending: false })
      .limit(1),
    fetchPagedBloomCosts(db, monthStart, monthEnd),
  ]);

  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as { budget: number }[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, BloomTimePoint>();
  for (const r of currRows) {
    const ex = dateMap.get(r.date) ?? { label: r.date, spend: 0, websiteChats: 0, impressions: 0, clicks: 0 };
    ex.spend += Number(r.cost ?? 0);
    ex.websiteChats += Number(r.website_chats ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, ex);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows
  const campMap = new Map<string, BloomCampaignRow>();
  for (const r of currRows) {
    const ex = campMap.get(r.campaign_name) ?? {
      campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0,
      websiteChats: 0, ctr: 0, costPerWebchat: 0,
    };
    ex.spend += Number(r.cost ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    ex.websiteChats += Number(r.website_chats ?? 0);
    campMap.set(r.campaign_name, ex);
  }
  const campaignRows = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      costPerWebchat: c.websiteChats > 0 ? c.spend / c.websiteChats : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Meta creatives — aggregate by ad+adset+campaign
  const metaCreatives: MetaCreative[] = buildBloomMetaCreatives(currRows)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Weekly readout
  let weeklyReadout: BloomWeeklyReadout | null = null;
  if (readoutRows[0]?.overall_story) {
    const r = readoutRows[0];
    weeklyReadout = {
      overallStory: r.overall_story ?? '',
      wins: Array.isArray(r.wins) ? r.wins : [],
      opportunities: Array.isArray(r.opportunities) ? r.opportunities : [],
      accomplishments: Array.isArray(r.accomplishments) ? r.accomplishments : [],
      focusNextWeek: Array.isArray(r.focus_next_week) ? r.focus_next_week : [],
      executionContext: Array.isArray(r.execution_context) ? r.execution_context : [],
      periodStart: r.period_start ?? '',
      periodEnd: r.period_end ?? '',
    };
  }

  const budgetPacing: BloomBudgetPacing = {
    budget: budgetRows[0]?.budget ? Number(budgetRows[0].budget) : null,
    spend: pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0),
    monthStart,
    monthEnd,
  };

  return { filterParams: params, summary, prevSummary, timeSeries, campaignRows, metaCreatives, weeklyReadout, budgetPacing };
}

// Powers the "Ad Analysis" tab — same source table as fetchBloomDashboardData,
// but paginated (no 1,000-row cap) and aggregated by ad NAME (one card per
// creative, merged across ad sets/campaigns) instead of the Performance
// tab's finer-grained key.
export async function fetchBloomCreativeAnalysis(params: BloomFilterParams): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const rows = await fetchPagedBloomRows(db, params.start, params.end);
  const creatives = aggregateMetaCreativesByName(buildBloomMetaCreatives(rows));
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight: await fetchCreativeAiInsight(db, 'bloom_creative_ai_insights', 'Bloom Aesthetic'),
  };
}
