import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

export type ArabellaFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type ArabellasSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type ArabellaTimePoint = {
  label: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number;
};

export type ArabellaChannelRow = {
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

export type ArabellasCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type ArabellaAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
};

export type ArabellasBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type ArabellasDashboardData = {
  filterParams: ArabellaFilterParams;
  summary: ArabellasSummary;
  prevSummary: ArabellasSummary;
  timeSeries: ArabellaTimePoint[];
  channelRows: ArabellaChannelRow[];
  campaignRows: ArabellasCampaignRow[];
  adRows: ArabellaAdRow[];
  budgetPacing: ArabellasBudgetPacing;
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

type BudgetRow = {
  budget: number;
};

function summarise(rows: MasterRow[]): ArabellasSummary {
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

export function arabellaParamsFromSearch(p: Record<string, string | undefined>): ArabellaFilterParams {
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

export async function fetchArabellasDashboardData(params: ArabellaFilterParams): Promise<ArabellasDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, budgetRes, pacingRes] = await Promise.all([
    db.from('arabella_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
      .gte('date', start)
      .lte('date', end),
    db.from('arabella_master')
      .select('date,campaign_name,ad_channel,impressions,clicks,cost,purchases,revenue')
      .gte('date', compStart)
      .lte('date', compEnd),
    db.from('arabella_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url')
      .gte('date', start)
      .lte('date', end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'arabella')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('arabella_master')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRawRow[];
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
  const timeSeries: ArabellaTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({
      label,
      ...d,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown (Meta only currently)
  const channels = ['Meta'];
  const channelRows: ArabellaChannelRow[] = channels.map(ch => {
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

  // Campaign rows
  const campMap = new Map<string, ArabellasCampaignRow>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const existing = campMap.get(key) ?? {
      campaign: r.campaign_name,
      channel: r.ad_channel,
      spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, ctr: 0, roas: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    campMap.set(key, existing);
  }
  const campaignRows: ArabellasCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Ad rows — group by ad_name + adset_name
  const adMap = new Map<string, ArabellaAdRow>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}`;
    const existing = adMap.get(key) ?? {
      adName: r.ad_name || r.campaign_name,
      adsetName: r.adset_name,
      campaignName: r.campaign_name,
      previewUrl: r.preview_url ?? '',
      spend: 0, purchases: 0, revenue: 0, roas: 0, clicks: 0, impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += Number(r.purchases ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.previewUrl ||= r.preview_url ?? '';
    adMap.set(key, existing);
  }
  const adRows: ArabellaAdRow[] = Array.from(adMap.values())
    .map(a => ({ ...a, roas: a.spend > 0 ? a.revenue / a.spend : 0 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Budget pacing
  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: ArabellasBudgetPacing = {
    budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
    totalSpend,
    monthStart,
    monthEnd,
  };

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    adRows,
    budgetPacing,
  };
}
