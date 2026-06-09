import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GoodGameSummaryRow = {
  phase: string;
  retailer: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  costPerLpView: number | null;
};

export type GoodGameCampaignRow = {
  phase: string;
  retailer: string;
  channel: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  conversions: number;
  cpm: number | null;
  costPerLpView: number | null;
};

export type GoodGameVideoRow = {
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

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchGoodGameChatSummary(
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<GoodGameSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('goodgame_chat_summary', {
    p_phase: phase, p_retailer: retailer, p_channel: channel,
    p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    phase: string; retailer: string; ad_channel: string;
    spend: number; impressions: number; clicks: number;
    landing_page_views: number; conversions: number;
    cpm: number | null; ctr: number | null; cost_per_lp_view: number | null;
  }[];

  return rows.map((r) => ({
    phase: String(r.phase ?? ''),
    retailer: String(r.retailer ?? ''),
    channel: String(r.ad_channel ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    landingPageViews: Number(r.landing_page_views) || 0,
    conversions: Number(r.conversions) || 0,
    cpm: r.cpm != null ? Number(r.cpm) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
    costPerLpView: r.cost_per_lp_view != null ? Number(r.cost_per_lp_view) : null,
  }));
}

export async function fetchGoodGameChatCampaigns(
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 25,
): Promise<GoodGameCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('goodgame_chat_campaigns', {
    p_phase: phase, p_retailer: retailer, p_channel: channel,
    p_start: start, p_end: end, p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    phase: string; retailer: string; ad_channel: string; campaign_name: string;
    spend: number; impressions: number; clicks: number;
    landing_page_views: number; conversions: number;
    cpm: number | null; cost_per_lp_view: number | null;
  }[];

  return rows.map((r) => ({
    phase: String(r.phase ?? ''),
    retailer: String(r.retailer ?? ''),
    channel: String(r.ad_channel ?? ''),
    campaign: String(r.campaign_name ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    landingPageViews: Number(r.landing_page_views) || 0,
    conversions: Number(r.conversions) || 0,
    cpm: r.cpm != null ? Number(r.cpm) : null,
    costPerLpView: r.cost_per_lp_view != null ? Number(r.cost_per_lp_view) : null,
  }));
}

export async function fetchGoodGameChatSpendTrend(
  phase: string,
  retailer: string,
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('goodgame_chat_spend_trend', {
    p_phase: phase, p_retailer: retailer, p_channel: channel,
    p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    date_day: string; spend: number; impressions: number; clicks: number;
    landing_page_views: number; conversions: number;
  }[];

  // Map to SpendTrendResult so the existing TrendChart renders without changes.
  // landing_page_views → leads (engaged website traffic), conversions → won (Get Directions / store visits)
  return {
    focus: phase === 'all' ? 'All Phases' : phase === 'awareness' ? 'Awareness' : 'Retargeting',
    platform: channel === 'all' ? 'All Channels' : channel,
    startDate: start,
    endDate: end,
    data: rows.map((r) => ({
      date: String(r.date_day),
      spend: Number(r.spend) || 0,
      leads: Number(r.landing_page_views) || 0,
      mqls: 0,
      sqls: 0,
      won: Number(r.conversions) || 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
  };
}

export async function fetchGoodGameChatVideoPerf(
  retailer: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<GoodGameVideoRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('goodgame_chat_video_perf', {
    p_retailer: retailer, p_start: start, p_end: end, p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    campaign_name: string; retailer: string; spend: number; impressions: number;
    views_25pct: number; views_50pct: number; views_75pct: number;
    views_100pct: number; thruplay: number;
    completion_rate_75: number | null; cost_per_75pct_view: number | null;
  }[];

  return rows.map((r) => ({
    campaign: String(r.campaign_name ?? ''),
    retailer: String(r.retailer ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    views25: Number(r.views_25pct) || 0,
    views50: Number(r.views_50pct) || 0,
    views75: Number(r.views_75pct) || 0,
    views100: Number(r.views_100pct) || 0,
    thruplay: Number(r.thruplay) || 0,
    completionRate75: r.completion_rate_75 != null ? Number(r.completion_rate_75) : null,
    costPer75View: r.cost_per_75pct_view != null ? Number(r.cost_per_75pct_view) : null,
  }));
}

export async function fetchGoodGameChatMetaCreatives(
  retailer: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<GoodGameCreativeRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('goodgame_chat_meta_creatives', {
    p_retailer: retailer, p_start: start, p_end: end, p_limit: limit,
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

  return rows.map((r) => ({
    adId: String(r.ad_id ?? ''),
    adName: String(r.ad_name ?? ''),
    campaign: String(r.campaign_name ?? ''),
    headline: String(r.headline ?? ''),
    primaryText: String(r.primary_text ?? ''),
    finalCreativeLink: String(r.final_creative_link ?? ''),
    isVideo: Boolean(r.is_video),
    videoUrl: r.video_url ?? null,
    ctaType: String(r.cta_type ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    landingPageViews: Number(r.landing_page_views) || 0,
    views75: Number(r.views_75pct) || 0,
    thruplay: Number(r.thruplay) || 0,
    completionRate75: r.completion_rate_75 != null ? Number(r.completion_rate_75) : null,
    costPer75View: r.cost_per_75pct_view != null ? Number(r.cost_per_75pct_view) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
  }));
}
