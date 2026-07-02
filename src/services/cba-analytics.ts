import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';

export type CBAFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type CBASummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number;
};

export type CBATimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  costPerLead: number;
};

export type CBACampaignRow = {
  campaign: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  ctr: number;
  prevCtr: number;
  conversions: number;
  prevConversions: number;
  costPerLead: number;
  prevCostPerLead: number;
};

export type CBABudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type CBADashboardData = {
  filterParams: CBAFilterParams;
  summary: CBASummary;
  prevSummary: CBASummary;
  timeSeries: CBATimePoint[];
  campaignRows: CBACampaignRow[];
  budgetPacing: CBABudgetPacing;
  metaCreatives: MetaCreative[];
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

type AdRow = {
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  leads: number | null;
  final_creative_link: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

type BudgetRow = { budget: number };

function isCompressedCreativeUrl(url: string): boolean {
  return /p64x64|_p64x64|s64x64|64x64|p100x100|s100x100/i.test(url);
}

function preferCreativeUrl(current: string, next: string): string {
  if (!next || next === 'null' || next === 'undefined') return current;
  if (!current || current === 'null' || current === 'undefined') return next;
  if (isCompressedCreativeUrl(current) && !isCompressedCreativeUrl(next)) return next;
  return current;
}

function summarise(rows: MasterRow[]): CBASummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const leads = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    leads,
    costPerLead: leads > 0 ? spend / leads : 0,
  };
}

const CBA_CREATIVE_SELECT = 'ad_name,adset_name,campaign_name,impressions,clicks,cost,leads,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url';

// Maps raw cba_meta_ads rows into MetaCreative[], deduped by
// ad_name/adset/campaign (fine-grained — a given ad running in two ad sets
// stays as two entries). Shared by the Performance tab (which additionally
// slices to top 30 by spend) and the Ad Analysis tab (which further
// aggregates by ad_name via aggregateMetaCreativesByName, no slice).
function buildCBAMetaCreatives(rawAds: AdRow[]): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
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
      videoUrl: String(r.video_url ?? ''),
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.leads ?? 0);
    existing.headline ||= String(r.headline ?? '');
    existing.primaryText ||= String(r.primary_text ?? '');
    existing.finalCreativeLink = preferCreativeUrl(existing.finalCreativeLink, String(r.final_creative_link ?? ''));
    existing.destinationUrl ||= String(r.destination_url ?? '');
    existing.ctaType ||= String(r.cta_type ?? '');
    existing.isVideo ||= Boolean(r.is_video);
    existing.videoId ||= String(r.video_id ?? '');
    existing.videoUrl ||= String(r.video_url ?? '');
    creativeMap.set(key, existing);
  }
  return Array.from(creativeMap.values());
}

// Paginated raw-row fetch for the Ad Analysis tab — the Performance tab's
// single unpaginated query is fine at 30-day volume, but Ad Analysis has no
// slice cap so it needs to bypass Supabase's 1,000-row default.
async function fetchPagedCBACreativeRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<AdRow[]> {
  const rows: AdRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('cba_meta_ads')
      .select(CBA_CREATIVE_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return rows;
    const page = (data ?? []) as unknown as AdRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function cbaParamsFromSearch(p: Record<string, string | undefined>): CBAFilterParams {
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

export async function fetchCBADashboardData(params: CBAFilterParams): Promise<CBADashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yday = new Date(now); yday.setDate(yday.getDate() - 1);
  const monthEnd = yday.toISOString().split('T')[0] < monthStart ? monthStart : yday.toISOString().split('T')[0];

  const [currRes, prevRes, budgetRes, pacingRes, adRes] = await Promise.all([
    db.from('cba_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
      .gte('date', start)
      .lte('date', end),
    db.from('cba_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'cba')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('cba_master')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('cba_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,leads,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];
  const rawAds = (adRes.data ?? []) as unknown as AdRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; conversions: number; impressions: number; clicks: number }>();
  for (const r of currRows) {
    const e = dateMap.get(r.date) ?? { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.conversions += Number(r.conversions ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, e);
  }
  const timeSeries: CBATimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, costPerLead: d.conversions > 0 ? d.spend / d.conversions : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows with prev-period comparison
  type CampAccum = { campaign: string; spend: number; impressions: number; clicks: number; conversions: number };
  const campMap = new Map<string, CampAccum>();
  for (const r of currRows) {
    const e = campMap.get(r.campaign_name) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.conversions += Number(r.conversions ?? 0);
    campMap.set(r.campaign_name, e);
  }
  const prevCampMap = new Map<string, CampAccum>();
  for (const r of prevRows) {
    const e = prevCampMap.get(r.campaign_name) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.conversions += Number(r.conversions ?? 0);
    prevCampMap.set(r.campaign_name, e);
  }
  const campaignRows: CBACampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(c.campaign) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 } as CampAccum;
      return {
        campaign: c.campaign,
        spend: c.spend,            prevSpend: p.spend,
        impressions: c.impressions, prevImpressions: p.impressions,
        clicks: c.clicks,          prevClicks: p.clicks,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        conversions: c.conversions, prevConversions: p.conversions,
        costPerLead: c.conversions > 0 ? c.spend / c.conversions : 0,
        prevCostPerLead: p.conversions > 0 ? p.spend / p.conversions : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  const metaCreatives: MetaCreative[] = buildCBAMetaCreatives(rawAds)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    campaignRows,
    metaCreatives,
    budgetPacing: {
      budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
      totalSpend,
      monthStart,
      monthEnd,
    },
  };
}

// Powers the "Ad Analysis" tab — same source table as fetchCBADashboardData,
// but paginated (no 1,000-row cap) and aggregated by ad NAME (one card per
// creative, merged across ad sets/campaigns) instead of the Performance
// tab's finer-grained key.
export async function fetchCBACreativeAnalysis(params: CBAFilterParams): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const rawAds = await fetchPagedCBACreativeRows(db, params.start, params.end);
  const creatives = aggregateMetaCreativesByName(buildCBAMetaCreatives(rawAds));
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight: await fetchCreativeAiInsight(db, 'cba_creative_ai_insights', 'CBA'),
  };
}
