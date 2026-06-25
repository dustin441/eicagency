import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { fetchCreativeAiInsight, type CreativeAiInsight } from '@/services/creative-ai-insights';

export type KinseyFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type KinseySummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type KinseyTimePoint = {
  label: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number;
};

export type KinseyChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
};

export type KinseyCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  ctr: number;
  prevCtr: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  roas: number;
  prevRoas: number;
};

export type KinseyAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  prevSpend: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  roas: number;
  prevRoas: number;
  clicks: number;
  prevClicks: number;
  impressions: number;
};

export type KinseyBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type KinseyWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type KinseyDashboardData = {
  filterParams: KinseyFilterParams;
  summary: KinseySummary;
  prevSummary: KinseySummary;
  timeSeries: KinseyTimePoint[];
  channelRows: KinseyChannelRow[];
  campaignRows: KinseyCampaignRow[];
  adRows: KinseyAdRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: KinseyBudgetPacing;
  weeklyReadout: KinseyWeeklyReadout | null;
  aiInsight: CreativeAiInsight | null;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number | null;
  purchases: number | null;
  revenue: number;
};

type AdRawRow = {
  ad_id?: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  preview_url: string;
};

type MetaCreativeRow = AdRawRow & {
  leads: number | null;
  final_creative_link: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  ad_status: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

type BudgetRow = { budget: number };

type ReadoutRow = {
  period_start: string | null;
  period_end: string | null;
  overall_story: string | null;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

const CREATIVE_SELECT = 'ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url,leads,final_creative_link,primary_text,headline,destination_url,cta_type,ad_status,is_video,video_id,video_url';

function summarise(rows: MasterRow[]): KinseySummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowPurchases(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

function rowPurchases(r: MasterRow): number {
  return r.ad_channel === 'Google'
    ? Number(r.conversions ?? r.purchases ?? 0)
    : Number(r.purchases ?? r.conversions ?? 0);
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

async function fetchPagedCreativeRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<MetaCreativeRow[]> {
  const rows: MetaCreativeRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('kinsey_meta_ads_creatives')
      .select(CREATIVE_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return [];

    const page = (data ?? []) as unknown as MetaCreativeRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export function kinseyParamsFromSearch(p: Record<string, string | undefined>): KinseyFilterParams {
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

export async function fetchKinseyDashboardData(params: KinseyFilterParams): Promise<KinseyDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, prevAdRes, creativeRows, budgetRes, pacingRes, readoutRes] = await Promise.all([
    db.from('kinsey_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions,purchases,revenue')
      .gte('date', start)
      .lte('date', end),
    db.from('kinsey_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions,purchases,revenue')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('kinsey_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url')
      .gte('date', start)
      .lte('date', end),
    db.from('kinsey_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url')
      .gte('date', compStart)
      .lte('date', compEnd),
    fetchPagedCreativeRows(db, start, end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'kinsey')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('kinsey_master')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('kinsey_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRawRow[];
  const prevRawAds = (prevAdRes.data ?? []) as unknown as AdRawRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; purchases: number; impressions: number; clicks: number; revenue: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, purchases: 0, impressions: 0, clicks: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += rowPurchases(r);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries: KinseyTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, roas: d.spend > 0 ? d.revenue / d.spend : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown
  const channelRows: KinseyChannelRow[] = ['Meta', 'Google'].map(ch => {
    const curr = currRows.filter(r => r.ad_channel === ch);
    const prev = prevRows.filter(r => r.ad_channel === ch);
    return {
      channel: ch,
      spend: curr.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      prevSpend: prev.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      clicks: curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      purchases: curr.reduce((s, r) => s + rowPurchases(r), 0),
      prevPurchases: prev.reduce((s, r) => s + rowPurchases(r), 0),
      revenue: curr.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
      prevRevenue: prev.reduce((s, r) => s + Number(r.revenue ?? 0), 0),
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign rows — current + prev
  type CampAccum = { campaign: string; channel: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
  const campMap = new Map<string, CampAccum>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const e = campMap.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0); e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0); e.purchases += rowPurchases(r); e.revenue += Number(r.revenue ?? 0);
    campMap.set(key, e);
  }
  const prevCampMap = new Map<string, CampAccum>();
  for (const r of prevRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const e = prevCampMap.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0); e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0); e.purchases += rowPurchases(r); e.revenue += Number(r.revenue ?? 0);
    prevCampMap.set(key, e);
  }
  const campaignRows: KinseyCampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(`${c.campaign}__${c.channel}`) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 } as CampAccum;
      return {
        ...c,
        prevSpend: p.spend, prevImpressions: p.impressions, prevClicks: p.clicks,
        prevPurchases: p.purchases, prevRevenue: p.revenue,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        prevRoas: p.spend > 0 ? p.revenue / p.spend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Ad rows — current + prev
  type AdAccum = { adName: string; adsetName: string; campaignName: string; previewUrl: string; spend: number; purchases: number; revenue: number; clicks: number; impressions: number };
  const adMap = new Map<string, AdAccum>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}`;
    const e = adMap.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: r.preview_url ?? '', spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 };
    e.spend += Number(r.cost ?? 0); e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0); e.clicks += Number(r.clicks ?? 0);
    e.impressions += Number(r.impressions ?? 0); e.previewUrl ||= r.preview_url ?? '';
    adMap.set(key, e);
  }
  const prevAdMap = new Map<string, AdAccum>();
  for (const r of prevRawAds) {
    const key = `${r.ad_name}__${r.adset_name}`;
    const e = prevAdMap.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: '', spend: 0, purchases: 0, revenue: 0, clicks: 0, impressions: 0 };
    e.spend += Number(r.cost ?? 0); e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0); e.clicks += Number(r.clicks ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    prevAdMap.set(key, e);
  }
  const adRows: KinseyAdRow[] = Array.from(adMap.values())
    .map(a => {
      const p = prevAdMap.get(`${a.adName}__${a.adsetName}`) ?? { spend: 0, purchases: 0, revenue: 0, clicks: 0 } as AdAccum;
      return { ...a, roas: a.spend > 0 ? a.revenue / a.spend : 0, prevSpend: p.spend, prevPurchases: p.purchases, prevRevenue: p.revenue, prevRoas: p.spend > 0 ? p.revenue / p.spend : 0, prevClicks: p.clicks };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  const creativeMap = new Map<string, MetaCreative>();
  for (const r of creativeRows) {
    const key = `${r.ad_id || r.ad_name}__${r.adset_name}__${r.campaign_name}`;
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
      previewUrl: String(r.preview_url ?? ''),
      sales: 0,
      revenue: 0,
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.purchases ?? r.leads ?? 0);
    existing.sales = (existing.sales ?? 0) + Number(r.purchases ?? 0);
    existing.revenue = (existing.revenue ?? 0) + Number(r.revenue ?? 0);
    existing.headline ||= String(r.headline ?? '');
    existing.primaryText ||= String(r.primary_text ?? '');
    existing.finalCreativeLink = preferCreativeUrl(existing.finalCreativeLink, String(r.final_creative_link ?? ''));
    existing.destinationUrl ||= String(r.destination_url ?? '');
    existing.ctaType ||= String(r.cta_type ?? '');
    existing.isVideo ||= Boolean(r.is_video);
    existing.videoId ||= String(r.video_id ?? '');
    existing.videoUrl ||= String(r.video_url ?? '');
    existing.previewUrl ||= String(r.preview_url ?? '');
    creativeMap.set(key, existing);
  }
  const metaCreatives: MetaCreative[] = Array.from(creativeMap.values())
    .filter(c => c.finalCreativeLink || c.primaryText || c.headline || c.isVideo)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const latestReadout = readoutRows[0];
  const weeklyReadout: KinseyWeeklyReadout | null = latestReadout
    ? {
        periodStart: latestReadout.period_start ?? '',
        periodEnd: latestReadout.period_end ?? '',
        overallStory: latestReadout.overall_story ?? '',
        wins: stringArray(latestReadout.wins),
        opportunities: stringArray(latestReadout.opportunities),
        accomplishments: stringArray(latestReadout.accomplishments),
        focusNextWeek: stringArray(latestReadout.focus_next_week),
        executionContext: stringArray(latestReadout.execution_context),
      }
    : null;

  const aiInsight = await fetchCreativeAiInsight(db, 'kinsey_creative_ai_insights', 'Kinsey');

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    adRows,
    metaCreatives,
    budgetPacing: {
      budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
      totalSpend,
      monthStart,
      monthEnd,
    },
    weeklyReadout,
    aiInsight,
  };
}
