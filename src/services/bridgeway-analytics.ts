import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

export type BridgewayFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Meta' | 'Google'
};

export type BridgewaySummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
};

export type BridgewayTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type BridgewayChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  conversions: number;
  prevConversions: number;
};

export type BridgewayCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  costPerConversion: number;
};

export type BridgewayBudgetPacing = {
  budget: number | null;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type BridgewayDashboardData = {
  filterParams: BridgewayFilterParams;
  summary: BridgewaySummary;
  prevSummary: BridgewaySummary;
  timeSeries: BridgewayTimePoint[];
  channelRows: BridgewayChannelRow[];
  campaignRows: BridgewayCampaignRow[];
  budgetPacing: BridgewayBudgetPacing;
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

type BudgetRow = {
  budget: number;
};

function summarise(rows: MasterRow[]): BridgewaySummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    conversions,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
  };
}

export function bridgewayParamsFromSearch(p: Record<string, string | undefined>): BridgewayFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
    channel: p.channel ?? 'all',
  };
}

export async function fetchBridgewayDashboardData(params: BridgewayFilterParams): Promise<BridgewayDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maybeChannel(q: any): any {
    return channel !== 'all' ? q.eq('ad_channel', channel) : q;
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRes, prevRes, budgetRes, pacingRes] = await Promise.all([
    maybeChannel(
      db.from('bridgeway_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', start)
        .lte('date', end)
    ),
    maybeChannel(
      db.from('bridgeway_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', compStart)
        .lte('date', compEnd)
    ),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'bridgeway')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('bridgeway_master')
      .select('ad_channel,cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { ad_channel: string; cost: number }[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, BridgewayTimePoint>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { label: r.date, spend: 0, conversions: 0, impressions: 0, clicks: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.conversions += Number(r.conversions ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown
  const channels = ['Meta', 'Google'];
  const channelRows: BridgewayChannelRow[] = channels.map(ch => {
    const curr = currRows.filter(r => r.ad_channel === ch);
    const prev = prevRows.filter(r => r.ad_channel === ch);
    return {
      channel: ch,
      spend: curr.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      prevSpend: prev.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0) , 0),
      clicks: curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      conversions: curr.reduce((s, r) => s + Number(r.conversions ?? 0), 0),
      prevConversions: prev.reduce((s, r) => s + Number(r.conversions ?? 0), 0),
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign rows — group by campaign_name + ad_channel
  const campMap = new Map<string, BridgewayCampaignRow>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const existing = campMap.get(key) ?? {
      campaign: r.campaign_name,
      channel: r.ad_channel,
      spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, costPerConversion: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.conversions += Number(r.conversions ?? 0);
    campMap.set(key, existing);
  }
  const campaignRows: BridgewayCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Budget pacing
  const metaSpend = pacingRows.filter(r => r.ad_channel === 'Meta').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const googleSpend = pacingRows.filter(r => r.ad_channel === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: BridgewayBudgetPacing = {
    budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
    metaSpend,
    googleSpend,
    totalSpend: metaSpend + googleSpend,
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
    budgetPacing,
  };
}
