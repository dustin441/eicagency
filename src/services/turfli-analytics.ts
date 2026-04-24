import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

export type TurfliFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Meta' | 'Google'
};

export type TurfliSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
};

export type TurfliTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type TurfliChannelRow = {
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

export type TurfliCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  costPerConversion: number;
};

export type TurfliAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  costPerConversion: number;
  previewUrl: string;
};

export type TurliBudgetPacing = {
  budget: number | null;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type TurfliWeeklyReadout = {
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
  periodStart: string;
  periodEnd: string;
};

export type TurfliDashboardData = {
  filterParams: TurfliFilterParams;
  summary: TurfliSummary;
  prevSummary: TurfliSummary;
  timeSeries: TurfliTimePoint[];
  channelRows: TurfliChannelRow[];
  campaignRows: TurfliCampaignRow[];
  adRows: TurfliAdRow[];
  budgetPacing: TurliBudgetPacing;
  weeklyReadout: TurfliWeeklyReadout | null;
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
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  preview_url: string;
};

type BudgetRow = {
  budget: number;
};

type ReadoutRow = {
  period_start: string;
  period_end: string;
  overall_story: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focus_next_week: string[];
  execution_context: string[];
};

function summarise(rows: MasterRow[]): TurfliSummary {
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

export function turfliParamsFromSearch(p: Record<string, string | undefined>): TurfliFilterParams {
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

export async function fetchTurfliDashboardData(params: TurfliFilterParams): Promise<TurfliDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maybeChannel(q: any): any {
    return channel !== 'all' ? q.eq('ad_channel', channel) : q;
  }

  // Current + previous period rows from master
  const [currRes, prevRes, adRes, budgetRes, readoutRes, pacingRes] = await Promise.all([
    maybeChannel(
      db.from('turfli_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', start)
        .lte('date', end)
    ),
    maybeChannel(
      db.from('turfli_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', compStart)
        .lte('date', compEnd)
    ),
    db.from('turfli_meta_ads')
      .select('ad_name,adset_name,campaign_name,ad_channel,impressions,clicks,cost,conversions,preview_url')
      .gte('date', start)
      .lte('date', end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'turfli')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('turfli_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .order('created_at', { ascending: false })
      .limit(1),
    // Budget pacing: current calendar month spend by channel
    db.from('turfli_master')
      .select('ad_channel,cost')
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .lte('date', new Date().toISOString().split('T')[0]),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRow[];
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { ad_channel: string; cost: number }[];

  // Summaries
  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, TurfliTimePoint>();
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
  const channelRows: TurfliChannelRow[] = channels.map(ch => {
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
      conversions: curr.reduce((s, r) => s + Number(r.conversions ?? 0), 0),
      prevConversions: prev.reduce((s, r) => s + Number(r.conversions ?? 0), 0),
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign rows — group by campaign_name + ad_channel
  const campMap = new Map<string, TurfliCampaignRow>();
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
  const campaignRows: TurfliCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Ad rows — group by ad_name + adset_name + campaign_name
  const adMap = new Map<string, TurfliAdRow>();
  for (const r of rawAds) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const existing = adMap.get(key) ?? {
      adName: r.ad_name,
      adsetName: r.adset_name,
      campaignName: r.campaign_name,
      channel: r.ad_channel ?? 'Meta',
      spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, costPerConversion: 0,
      previewUrl: r.preview_url ?? '',
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.conversions += Number(r.conversions ?? 0);
    if (!existing.previewUrl && r.preview_url) existing.previewUrl = r.preview_url;
    adMap.set(key, existing);
  }
  const adRows: TurfliAdRow[] = Array.from(adMap.values())
    .map(a => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      costPerConversion: a.conversions > 0 ? a.spend / a.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Budget pacing
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];
  const metaSpend = pacingRows.filter(r => r.ad_channel === 'Meta').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const googleSpend = pacingRows.filter(r => r.ad_channel === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: TurliBudgetPacing = {
    budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
    metaSpend,
    googleSpend,
    totalSpend: metaSpend + googleSpend,
    monthStart,
    monthEnd,
  };

  // Weekly readout
  let weeklyReadout: TurfliWeeklyReadout | null = null;
  if (readoutRows[0] && readoutRows[0].overall_story) {
    const r = readoutRows[0];
    weeklyReadout = {
      overallStory: r.overall_story,
      wins: r.wins ?? [],
      opportunities: r.opportunities ?? [],
      accomplishments: r.accomplishments ?? [],
      focusNextWeek: r.focus_next_week ?? [],
      executionContext: r.execution_context ?? [],
      periodStart: r.period_start,
      periodEnd: r.period_end,
    };
  }

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    adRows,
    budgetPacing,
    weeklyReadout,
  };
}
