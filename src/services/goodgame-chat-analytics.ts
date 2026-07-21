import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import {
  classifyGoodGameDestinationStage,
  matchesGoodGameCampaignScope,
  type GoodGameCampaignScope,
} from '@/lib/goodgame-campaign-scope';
import { resolveDateRange, type SpendTrendResult } from './chat-analytics';

export type GoodGameChatInitiative = Exclude<GoodGameCampaignScope, 'all'>;

export type GoodGameSummaryRow = {
  initiative: GoodGameChatInitiative;
  phase: string;
  retailer: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  conversions: number;
  revenue: number;
  roas: number | null;
  cpm: number | null;
  ctr: number | null;
  costPerLpView: number | null;
};

export type GoodGameCampaignRow = GoodGameSummaryRow & {
  campaign: string;
  destination: string;
};

export type GoodGameVideoRow = {
  initiative: GoodGameChatInitiative;
  campaign: string;
  retailer: string;
  spend: number;
  impressions: number;
  views25: number;
  views50: number;
  views75: number;
  views100: number;
  thruplay: number;
  completionRate75: number | null;
  costPer75View: number | null;
};

export type GoodGameCreativeRow = {
  initiative: GoodGameChatInitiative;
  adId: string;
  adName: string;
  campaign: string;
  headline: string;
  primaryText: string;
  finalCreativeLink: string;
  isVideo: boolean;
  videoUrl: string | null;
  ctaType: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  views75: number;
  thruplay: number;
  completionRate75: number | null;
  costPer75View: number | null;
  ctr: number | null;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  cost: number;
  impressions: number;
  clicks: number;
  landing_page_views: number | null;
  purchases: number | null;
  conversions: number | null;
  revenue: number | null;
};

const PAGE_SIZE = 1000;

function retailerForCampaign(campaignName: string): string {
  if (/huck/i.test(campaignName)) return 'hucks';
  if (/circle\s*k/i.test(campaignName)) return 'circlek';
  if (/murphy/i.test(campaignName)) return 'murphys';
  return 'other';
}

function phaseForCampaign(campaignName: string, initiative: GoodGameChatInitiative): string {
  if (initiative === 'ecommerce') {
    return /retarget|remarket|\bmof\b|catalog/i.test(campaignName) ? 'Retargeting' : 'Prospecting';
  }
  return classifyGoodGameDestinationStage({ campaignName }) === 'store_locator'
    ? 'Store Locator / Get Directions'
    : 'Homepage / Awareness';
}

function matchesPhase(campaignName: string, initiative: GoodGameChatInitiative, phase: string): boolean {
  if (phase === 'all') return true;
  const value = phaseForCampaign(campaignName, initiative);
  return phase === 'retargeting'
    ? value === 'Retargeting' || value === 'Store Locator / Get Directions'
    : value === 'Prospecting' || value === 'Homepage / Awareness';
}

function purchasesForRow(row: MasterRow): number {
  return Number(row.purchases ?? row.conversions ?? 0);
}

async function fetchScopedMasterRows(
  initiative: GoodGameChatInitiative,
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<{ start: string; end: string; rows: MasterRow[] }> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);
  const rows: MasterRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('goodgame_master')
      .select('date,campaign_name,ad_channel,cost,impressions,clicks,landing_page_views,purchases,conversions,revenue')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('campaign_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (channel !== 'all') query = query.eq('ad_channel', channel);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as MasterRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return {
    start,
    end,
    rows: rows.filter(row =>
      matchesGoodGameCampaignScope(row.campaign_name, initiative)
      && matchesPhase(row.campaign_name, initiative, phase)
      && (retailer === 'all' || retailerForCampaign(row.campaign_name) === retailer)
    ),
  };
}

function finishSummary(
  initiative: GoodGameChatInitiative,
  phase: string,
  retailer: string,
  channel: string,
  totals: { spend: number; impressions: number; clicks: number; landingPageViews: number; conversions: number; revenue: number },
): GoodGameSummaryRow {
  return {
    initiative,
    phase,
    retailer,
    channel,
    ...totals,
    roas: initiative === 'ecommerce' && totals.spend > 0 ? totals.revenue / totals.spend : null,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
    costPerLpView: channel === 'Meta' && totals.landingPageViews > 0
      ? totals.spend / totals.landingPageViews
      : null,
  };
}

export async function fetchGoodGameChatSummary(
  initiative: GoodGameChatInitiative,
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<GoodGameSummaryRow[]> {
  const { rows } = await fetchScopedMasterRows(initiative, phase, retailer, channel, startDate, endDate, days);
  const grouped = new Map<string, { phase: string; retailer: string; channel: string; spend: number; impressions: number; clicks: number; landingPageViews: number; conversions: number; revenue: number }>();
  for (const row of rows) {
    const rowPhase = phaseForCampaign(row.campaign_name, initiative);
    const rowRetailer = retailerForCampaign(row.campaign_name);
    const key = `${rowPhase}__${rowRetailer}__${row.ad_channel}`;
    const total = grouped.get(key) ?? { phase: rowPhase, retailer: rowRetailer, channel: row.ad_channel, spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, conversions: 0, revenue: 0 };
    total.spend += Number(row.cost ?? 0);
    total.impressions += Number(row.impressions ?? 0);
    total.clicks += Number(row.clicks ?? 0);
    total.landingPageViews += Number(row.landing_page_views ?? 0);
    total.conversions += initiative === 'ecommerce' ? purchasesForRow(row) : 0;
    total.revenue += initiative === 'ecommerce' ? Number(row.revenue ?? 0) : 0;
    grouped.set(key, total);
  }
  return Array.from(grouped.values())
    .map(total => finishSummary(initiative, total.phase, total.retailer, total.channel, total))
    .sort((a, b) => b.spend - a.spend);
}

export async function fetchGoodGameChatCampaigns(
  initiative: GoodGameChatInitiative,
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 25,
): Promise<GoodGameCampaignRow[]> {
  const { rows } = await fetchScopedMasterRows(initiative, phase, retailer, channel, startDate, endDate, days);
  const grouped = new Map<string, { campaign: string; channel: string; spend: number; impressions: number; clicks: number; landingPageViews: number; conversions: number; revenue: number }>();
  for (const row of rows) {
    const key = `${row.campaign_name}__${row.ad_channel}`;
    const total = grouped.get(key) ?? { campaign: row.campaign_name, channel: row.ad_channel, spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, conversions: 0, revenue: 0 };
    total.spend += Number(row.cost ?? 0);
    total.impressions += Number(row.impressions ?? 0);
    total.clicks += Number(row.clicks ?? 0);
    total.landingPageViews += Number(row.landing_page_views ?? 0);
    total.conversions += initiative === 'ecommerce' ? purchasesForRow(row) : 0;
    total.revenue += initiative === 'ecommerce' ? Number(row.revenue ?? 0) : 0;
    grouped.set(key, total);
  }
  return Array.from(grouped.values())
    .map(total => ({
      ...finishSummary(
        initiative,
        phaseForCampaign(total.campaign, initiative),
        retailerForCampaign(total.campaign),
        total.channel,
        total,
      ),
      campaign: total.campaign,
      destination: initiative === 'ecommerce'
        ? 'Online Purchase'
        : phaseForCampaign(total.campaign, initiative),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export async function fetchGoodGameChatSpendTrend(
  initiative: GoodGameChatInitiative,
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const { start, end, rows } = await fetchScopedMasterRows(initiative, phase, retailer, channel, startDate, endDate, days);
  const grouped = new Map<string, { spend: number; impressions: number; clicks: number; landingPageViews: number; purchases: number }>();
  for (const row of rows) {
    const total = grouped.get(row.date) ?? { spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, purchases: 0 };
    total.spend += Number(row.cost ?? 0);
    total.impressions += Number(row.impressions ?? 0);
    total.clicks += Number(row.clicks ?? 0);
    total.landingPageViews += row.ad_channel === 'Meta' ? Number(row.landing_page_views ?? 0) : 0;
    total.purchases += initiative === 'ecommerce' ? purchasesForRow(row) : 0;
    grouped.set(row.date, total);
  }
  return {
    focus: initiative === 'ecommerce' ? 'eCommerce' : phase === 'retargeting' ? 'Store Locator / Get Directions' : phase === 'awareness' ? 'Homepage / Awareness' : 'All Foot Traffic',
    platform: channel === 'all' ? 'All Channels' : channel,
    startDate: start,
    endDate: end,
    data: Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({
      date,
      spend: row.spend,
      leads: row.landingPageViews,
      mqls: 0,
      sqls: 0,
      won: row.purchases,
      impressions: row.impressions,
      clicks: row.clicks,
    })),
  };
}

export async function fetchGoodGameChatVideoPerf(
  initiative: GoodGameChatInitiative,
  retailer: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<GoodGameVideoRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);
  const { data, error } = await supabase.rpc('goodgame_chat_video_perf', {
    p_retailer: retailer, p_start: start, p_end: end, p_limit: 200,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    campaign_name: string; retailer: string; spend: number; impressions: number;
    views_25pct: number; views_50pct: number; views_75pct: number;
    views_100pct: number; thruplay: number;
    completion_rate_75: number | null; cost_per_75pct_view: number | null;
  }[];
  return rows
    .filter(row => matchesGoodGameCampaignScope(row.campaign_name, initiative))
    .map(row => ({
      initiative,
      campaign: String(row.campaign_name ?? ''),
      retailer: String(row.retailer ?? ''),
      spend: Number(row.spend) || 0,
      impressions: Number(row.impressions) || 0,
      views25: Number(row.views_25pct) || 0,
      views50: Number(row.views_50pct) || 0,
      views75: Number(row.views_75pct) || 0,
      views100: Number(row.views_100pct) || 0,
      thruplay: Number(row.thruplay) || 0,
      completionRate75: row.completion_rate_75 != null ? Number(row.completion_rate_75) : null,
      costPer75View: row.cost_per_75pct_view != null ? Number(row.cost_per_75pct_view) : null,
    }))
    .slice(0, limit);
}

export async function fetchGoodGameChatMetaCreatives(
  initiative: GoodGameChatInitiative,
  retailer: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<GoodGameCreativeRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);
  const { data, error } = await supabase.rpc('goodgame_chat_meta_creatives', {
    p_retailer: retailer, p_start: start, p_end: end, p_limit: 200,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    ad_id: string; ad_name: string; campaign_name: string;
    headline: string; primary_text: string; final_creative_link: string;
    is_video: boolean; video_url: string | null; cta_type: string;
    spend: number; impressions: number; clicks: number;
    landing_page_views: number; views_75pct: number; thruplay: number;
    completion_rate_75: number | null; cost_per_75pct_view: number | null; ctr: number | null;
  }[];
  return rows
    .filter(row => matchesGoodGameCampaignScope(row.campaign_name, initiative))
    .map(row => ({
      initiative,
      adId: String(row.ad_id ?? ''),
      adName: String(row.ad_name ?? ''),
      campaign: String(row.campaign_name ?? ''),
      headline: String(row.headline ?? ''),
      primaryText: String(row.primary_text ?? ''),
      finalCreativeLink: String(row.final_creative_link ?? ''),
      isVideo: Boolean(row.is_video),
      videoUrl: row.video_url ?? null,
      ctaType: String(row.cta_type ?? ''),
      spend: Number(row.spend) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      landingPageViews: Number(row.landing_page_views) || 0,
      views75: Number(row.views_75pct) || 0,
      thruplay: Number(row.thruplay) || 0,
      completionRate75: row.completion_rate_75 != null ? Number(row.completion_rate_75) : null,
      costPer75View: row.cost_per_75pct_view != null ? Number(row.cost_per_75pct_view) : null,
      ctr: row.ctr != null ? Number(row.ctr) : null,
    }))
    .slice(0, limit);
}
