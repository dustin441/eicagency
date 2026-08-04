import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

export type LifeRepFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type LifeRepSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpc: number;
};

export type LifeRepTimePoint = {
  label: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
};

export type LifeRepCampaignRow = {
  campaign: string;
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

export type LifeRepAdRow = {
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  clicks: number;
  prevClicks: number;
  purchases: number;
  prevPurchases: number;
};

export type LifeRepBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type LifeRepWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type LifeRepDashboardData = {
  filterParams: LifeRepFilterParams;
  summary: LifeRepSummary;
  prevSummary: LifeRepSummary;
  timeSeries: LifeRepTimePoint[];
  campaignRows: LifeRepCampaignRow[];
  adRows: LifeRepAdRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: LifeRepBudgetPacing;
  weeklyReadout: LifeRepWeeklyReadout | null;
};

type MetaRow = {
  date: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
};

type AdRow = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  preview_url: string | null;
};

type CreativeRow = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  preview_url: string | null;
  final_creative_link?: string | null;
  permanent_image_url?: string | null;
  primary_text?: string | null;
  headline?: string | null;
  destination_url?: string | null;
  cta_type?: string | null;
  is_video?: boolean | null;
  video_id?: string | null;
  video_url?: string | null;
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

function summarise(rows: MetaRow[]): LifeRepSummary {
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
    cpc: clicks > 0 ? spend / clicks : 0,
  };
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
): Promise<CreativeRow[]> {
  const rows: CreativeRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('liferep_meta_ads')
      .select('ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return rows;
    const page = (data ?? []) as unknown as CreativeRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function liferepParamsFromSearch(p: Record<string, string | undefined>): LifeRepFilterParams {
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

export async function fetchLifeRepDashboardData(params: LifeRepFilterParams): Promise<LifeRepDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, prevAdRes, creativeRows, budgetRes, pacingRes, readoutRes] = await Promise.all([
    db.from('liferep_meta')
      .select('date,campaign_name,impressions,clicks,cost,purchases,revenue')
      .gte('date', start)
      .lte('date', end),
    db.from('liferep_meta')
      .select('date,campaign_name,impressions,clicks,cost,purchases,revenue')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('liferep_meta_ads')
      .select('ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,preview_url')
      .gte('date', start)
      .lte('date', end),
    db.from('liferep_meta_ads')
      .select('ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,preview_url')
      .gte('date', compStart)
      .lte('date', compEnd),
    fetchPagedCreativeRows(db, start, end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'liferep')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('liferep_meta')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('liferep_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MetaRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MetaRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRow[];
  const prevRawAds = (prevAdRes.data ?? []) as unknown as AdRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; purchases: number; revenue: number; impressions: number; clicks: number }>();
  for (const r of currRows) {
    const e = dateMap.get(r.date) ?? { spend: 0, purchases: 0, revenue: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, e);
  }
  const timeSeries: LifeRepTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, roas: d.spend > 0 ? d.revenue / d.spend : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows
  type CampAccum = { campaign: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
  const campMap = new Map<string, CampAccum>();
  for (const r of currRows) {
    const e = campMap.get(r.campaign_name) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0);
    campMap.set(r.campaign_name, e);
  }
  const prevCampMap = new Map<string, CampAccum>();
  for (const r of prevRows) {
    const e = prevCampMap.get(r.campaign_name) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0);
    prevCampMap.set(r.campaign_name, e);
  }
  const campaignRows: LifeRepCampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(c.campaign) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 } as CampAccum;
      return {
        ...c,
        prevSpend: p.spend,
        prevImpressions: p.impressions,
        prevClicks: p.clicks,
        prevPurchases: p.purchases,
        prevRevenue: p.revenue,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        prevRoas: p.spend > 0 ? p.revenue / p.spend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Ad rows
  type AdAccum = { adId: string; adName: string; adsetName: string; campaignName: string; previewUrl: string; spend: number; impressions: number; clicks: number; purchases: number };
  const adMap = new Map<string, AdAccum>();
  for (const r of rawAds) {
    const key = r.ad_id || r.ad_name;
    const e = adMap.get(key) ?? { adId: r.ad_id, adName: r.ad_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: r.preview_url ?? '', spend: 0, impressions: 0, clicks: 0, purchases: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.previewUrl ||= r.preview_url ?? '';
    adMap.set(key, e);
  }
  const prevAdMap = new Map<string, AdAccum>();
  for (const r of prevRawAds) {
    const key = r.ad_id || r.ad_name;
    const e = prevAdMap.get(key) ?? { adId: r.ad_id, adName: r.ad_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: '', spend: 0, impressions: 0, clicks: 0, purchases: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    prevAdMap.set(key, e);
  }
  const adRows: LifeRepAdRow[] = Array.from(adMap.values())
    .map(a => {
      const p = prevAdMap.get(a.adId || a.adName) ?? { spend: 0, clicks: 0, purchases: 0 } as AdAccum;
      return { ...a, prevSpend: p.spend, prevClicks: p.clicks, prevPurchases: p.purchases };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Map liferep_meta_ads rows → MetaCreative[], aggregated by ad_id
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of creativeRows) {
    const key = r.ad_id || r.ad_name;
    const existing = creativeMap.get(key) ?? {
      name: r.ad_name || r.campaign_name,
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
      previewUrl: String(r.preview_url ?? ''),
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
      sales: 0,
      revenue: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads = (existing.leads ?? 0) + Number(r.purchases ?? 0);
    existing.sales = (existing.sales ?? 0) + Number(r.purchases ?? 0);
    existing.revenue = (existing.revenue ?? 0) + Number(r.revenue ?? 0);
    existing.previewUrl ||= String(r.preview_url ?? '');
    existing.permanentImageUrl ||= String(r.permanent_image_url ?? '');
    creativeMap.set(key, existing);
  }
  const metaCreatives: MetaCreative[] = Array.from(creativeMap.values())
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const latestReadout = readoutRows[0];
  const weeklyReadout: LifeRepWeeklyReadout | null = latestReadout
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

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
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
  };
}
