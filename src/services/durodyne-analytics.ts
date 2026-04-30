import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

export type DurodyneFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Meta' | 'Google'
};

export type DurodyneSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
};

export type DurodyneTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type DurodyneChannelRow = {
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

export type DurodyneCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  costPerConversion: number;
};

export type DurodyneProductLineRow = {
  productLine: 'Duro-Line' | 'New Product Launch';
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  conversions: number;
  prevConversions: number;
  ctr: number;
  costPerConversion: number;
};

export type DurodyneBudgetPacing = {
  budget: number | null;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type DurodyneWeeklyReadout = {
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
  periodStart: string;
  periodEnd: string;
};

export type DurodyneDashboardData = {
  filterParams: DurodyneFilterParams;
  summary: DurodyneSummary;
  prevSummary: DurodyneSummary;
  timeSeries: DurodyneTimePoint[];
  channelRows: DurodyneChannelRow[];
  productLineRows: DurodyneProductLineRow[];
  campaignRows: DurodyneCampaignRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: DurodyneBudgetPacing;
  weeklyReadout: DurodyneWeeklyReadout | null;
};

const MONTHLY_BUDGET = 3500;

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
  spend: number;
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

function summarise(rows: MasterRow[]): DurodyneSummary {
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

function isCompressedCreativeUrl(url: string): boolean {
  return /p64x64|_p64x64|s64x64|64x64|p100x100|s100x100/i.test(url);
}

function preferCreativeUrl(current: string, next: string): string {
  if (!next || next === 'null' || next === 'undefined') return current;
  if (!current || current === 'null' || current === 'undefined') return next;
  if (isCompressedCreativeUrl(current) && !isCompressedCreativeUrl(next)) return next;
  return current;
}

function productLineFromCampaign(campaignName: string): DurodyneProductLineRow['productLine'] {
  return /duro[\s-]*line/i.test(campaignName) ? 'Duro-Line' : 'New Product Launch';
}

export function durodyneParamsFromSearch(p: Record<string, string | undefined>): DurodyneFilterParams {
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

export async function fetchDurodyneDashboardData(params: DurodyneFilterParams): Promise<DurodyneDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maybeChannel(q: any): any {
    return channel !== 'all' ? q.eq('ad_channel', channel) : q;
  }

  // Current + previous period rows from master
  const [currRes, prevRes, adRes, pacingRes] = await Promise.all([
    maybeChannel(
      db.from('durodyne_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', start)
        .lte('date', end)
    ),
    maybeChannel(
      db.from('durodyne_master')
        .select('date,campaign_name,ad_channel,impressions,clicks,cost,conversions')
        .gte('date', compStart)
        .lte('date', compEnd)
    ),
    db.from('durodyne_meta_ads')
      .select('ad_name,adset_name,campaign_name,impressions,clicks,spend,leads,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end),
    // Budget pacing: current calendar month spend by channel
    db.from('durodyne_master')
      .select('ad_channel,cost')
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .lte('date', new Date().toISOString().split('T')[0]),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds = (adRes.data ?? []) as unknown as AdRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { ad_channel: string; cost: number }[];

  // Summaries
  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, DurodyneTimePoint>();
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
  const channelRows: DurodyneChannelRow[] = channels.map(ch => {
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

  const productLines: DurodyneProductLineRow['productLine'][] = ['Duro-Line', 'New Product Launch'];
  const productLineRows: DurodyneProductLineRow[] = productLines.map(productLine => {
    const curr = currRows.filter(r => productLineFromCampaign(r.campaign_name) === productLine);
    const prev = prevRows.filter(r => productLineFromCampaign(r.campaign_name) === productLine);
    const spend = curr.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const impressions = curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
    const clicks = curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
    const conversions = curr.reduce((s, r) => s + Number(r.conversions ?? 0), 0);

    return {
      productLine,
      spend,
      prevSpend: prev.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      impressions,
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      clicks,
      prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      conversions,
      prevConversions: prev.reduce((s, r) => s + Number(r.conversions ?? 0), 0),
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      costPerConversion: conversions > 0 ? spend / conversions : 0,
    };
  }).filter(row => row.spend > 0 || row.prevSpend > 0);

  // Campaign rows — group by campaign_name + ad_channel
  const campMap = new Map<string, DurodyneCampaignRow>();
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
  const campaignRows: DurodyneCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

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
    existing.spend += Number(r.spend ?? 0);
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
  const metaCreatives: MetaCreative[] = Array.from(creativeMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Budget pacing
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];
  const metaSpend = pacingRows.filter(r => r.ad_channel === 'Meta').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const googleSpend = pacingRows.filter(r => r.ad_channel === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: DurodyneBudgetPacing = {
    budget: MONTHLY_BUDGET,
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
    productLineRows,
    campaignRows,
    metaCreatives,
    budgetPacing,
    weeklyReadout: null,
  };
}
