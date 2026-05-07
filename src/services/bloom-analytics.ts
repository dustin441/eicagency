import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

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
  purchases: number;
  revenue: number;
  roas: number;
  costPerPurchase: number;
};

export type BloomTimePoint = {
  label: string;
  spend: number;
  revenue: number;
  purchases: number;
};

export type BloomCampaignRow = {
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ctr: number;
  roas: number;
  costPerPurchase: number;
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
  date: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  final_creative_link: string | null;
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

function summarise(rows: Pick<AdRow, 'cost' | 'impressions' | 'clicks' | 'purchases' | 'revenue'>[]): BloomSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + Number(r.purchases ?? 0), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
  };
}

function isCompressedCreativeUrl(url: string): boolean {
  return /p64x64|_p64x64|s64x64|64x64|p100x100|s100x100/i.test(url);
}
function preferCreativeUrl(current: string, next: string): string {
  if (!next || next === 'null' || next === 'undefined') return current;
  if (!current || current === 'null' || current === 'undefined') return next;
  if (isCompressedCreativeUrl(current) && !isCompressedCreativeUrl(next)) return next;
  return current;
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
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, readoutRes, budgetRes, pacingRes] = await Promise.all([
    db.from('bloom_meta_ads')
      .select('date,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end),
    db.from('bloom_meta_ads')
      .select('date,campaign_name,impressions,clicks,cost,purchases,revenue')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('bloom_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .order('generated_at', { ascending: false })
      .limit(1),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'bloom')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('bloom_meta_ads')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as AdRow[];
  const prevRows = (prevRes.data ?? []) as unknown as AdRow[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as { budget: number }[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, BloomTimePoint>();
  for (const r of currRows) {
    const ex = dateMap.get(r.date) ?? { label: r.date, spend: 0, revenue: 0, purchases: 0 };
    ex.spend += Number(r.cost ?? 0);
    ex.revenue += Number(r.revenue ?? 0);
    ex.purchases += Number(r.purchases ?? 0);
    dateMap.set(r.date, ex);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows
  const campMap = new Map<string, BloomCampaignRow>();
  for (const r of currRows) {
    const ex = campMap.get(r.campaign_name) ?? {
      campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0,
      purchases: 0, revenue: 0, ctr: 0, roas: 0, costPerPurchase: 0,
    };
    ex.spend += Number(r.cost ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    ex.purchases += Number(r.purchases ?? 0);
    ex.revenue += Number(r.revenue ?? 0);
    campMap.set(r.campaign_name, ex);
  }
  const campaignRows = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      costPerPurchase: c.purchases > 0 ? c.spend / c.purchases : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Meta creatives — aggregate by ad+adset+campaign
  // purchases mapped to leads field for MetaCreative compatibility
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of currRows) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const ex = creativeMap.get(key) ?? {
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
      spend: 0, leads: 0, clicks: 0, impressions: 0,
    };
    ex.spend += Number(r.cost ?? 0);
    ex.impressions += Number(r.impressions ?? 0);
    ex.clicks += Number(r.clicks ?? 0);
    ex.leads += Number(r.purchases ?? 0);
    ex.headline ||= String(r.headline ?? '');
    ex.primaryText ||= String(r.primary_text ?? '');
    ex.finalCreativeLink = preferCreativeUrl(ex.finalCreativeLink, String(r.final_creative_link ?? ''));
    ex.destinationUrl ||= String(r.destination_url ?? '');
    ex.ctaType ||= String(r.cta_type ?? '');
    ex.isVideo ||= Boolean(r.is_video);
    ex.videoId ||= String(r.video_id ?? '');
    ex.videoUrl ||= String(r.video_url ?? '');
    creativeMap.set(key, ex);
  }
  const metaCreatives: MetaCreative[] = Array.from(creativeMap.values())
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
