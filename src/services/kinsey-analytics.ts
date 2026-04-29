import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

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

export type KinseyDashboardData = {
  filterParams: KinseyFilterParams;
  summary: KinseySummary;
  prevSummary: KinseySummary;
  timeSeries: KinseyTimePoint[];
  channelRows: KinseyChannelRow[];
  campaignRows: KinseyCampaignRow[];
  adRows: KinseyAdRow[];
  budgetPacing: KinseyBudgetPacing;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
};

type AdRawRow = {
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

type BudgetRow = { budget: number };

function summarise(rows: MasterRow[]): KinseySummary {
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
  };
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

  const [currRes, prevRes, adRes, prevAdRes, budgetRes, pacingRes] = await Promise.all([
    db.from('kinsey_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
      .gte('date', start)
      .lte('date', end),
    db.from('kinsey_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
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
    db.from('budgets')
      .select('budget')
      .ilike('client', 'kinsey')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('kinsey_master')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRawRow[];
  const prevRawAds = (prevAdRes.data ?? []) as unknown as AdRawRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; purchases: number; impressions: number; clicks: number; revenue: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, purchases: 0, impressions: 0, clicks: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
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
      purchases: curr.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
      prevPurchases: prev.reduce((s, r) => s + Number(r.purchases ?? 0), 0),
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
    e.clicks += Number(r.clicks ?? 0); e.purchases += Number(r.purchases ?? 0); e.revenue += Number(r.revenue ?? 0);
    campMap.set(key, e);
  }
  const prevCampMap = new Map<string, CampAccum>();
  for (const r of prevRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const e = prevCampMap.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0); e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0); e.purchases += Number(r.purchases ?? 0); e.revenue += Number(r.revenue ?? 0);
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

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    adRows,
    budgetPacing: {
      budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
      totalSpend,
      monthStart,
      monthEnd,
    },
  };
}
