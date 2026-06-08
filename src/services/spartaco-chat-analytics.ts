import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type MetaChatCreative, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SpartacoSummaryRow = {
  brand: string;
  channel: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type SpartacoCampaignRow = {
  brand: string;
  channel: string;
  campaign: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
};

export type SpartacoTrendPoint = {
  date: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeDivide(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchSpartacoChatSummary(
  brand: string,
  channel: string,
  mode: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpartacoSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('spartaco_chat_summary', {
    p_brand: brand,
    p_channel: channel,
    p_mode: mode,
    p_start: start,
    p_end: end,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    brand_name: string; ad_channel: string;
    spend: number; leads: number; purchases: number; revenue: number;
    impressions: number; clicks: number;
  }[];

  return rows.map((r) => {
    const spend = Number(r.spend) || 0;
    const leads = Number(r.leads) || 0;
    const purchases = Number(r.purchases) || 0;
    const revenue = Number(r.revenue) || 0;
    const impressions = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    return {
      brand: String(r.brand_name ?? ''),
      channel: String(r.ad_channel ?? ''),
      spend,
      leads,
      purchases,
      revenue,
      impressions,
      clicks,
      cpl: safeDivide(spend, leads),
      cpa: safeDivide(spend, purchases),
      roas: safeDivide(revenue, spend),
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: safeDivide(spend, clicks),
    };
  });
}

export async function fetchSpartacoChatCampaigns(
  brand: string,
  channel: string,
  mode: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 25,
): Promise<SpartacoCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('spartaco_chat_campaigns', {
    p_brand: brand,
    p_channel: channel,
    p_mode: mode,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    brand_name: string; ad_channel: string; campaign_name: string;
    spend: number; leads: number; purchases: number; revenue: number;
    impressions: number; clicks: number;
  }[];

  return rows.map((r) => {
    const spend = Number(r.spend) || 0;
    const leads = Number(r.leads) || 0;
    const purchases = Number(r.purchases) || 0;
    const revenue = Number(r.revenue) || 0;
    return {
      brand: String(r.brand_name ?? ''),
      channel: String(r.ad_channel ?? ''),
      campaign: String(r.campaign_name ?? ''),
      spend,
      leads,
      purchases,
      revenue,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      cpl: safeDivide(spend, leads),
      cpa: safeDivide(spend, purchases),
      roas: safeDivide(revenue, spend),
    };
  });
}

export async function fetchSpartacoChatSpendTrend(
  brand: string,
  channel: string,
  mode: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('spartaco_chat_spend_trend', {
    p_brand: brand,
    p_channel: channel,
    p_mode: mode,
    p_start: start,
    p_end: end,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    date_day: string; spend: number; leads: number; purchases: number;
    revenue: number; impressions: number; clicks: number;
  }[];

  // Map to SpendTrendResult so the existing TrendChart renders without changes.
  // `won` holds purchases (closest semantic match for the line chart).
  return {
    focus: brand === 'all' ? 'All Brands' : brand,
    platform: channel === 'all' ? 'All Channels' : channel,
    startDate: start,
    endDate: end,
    data: rows.map((r) => ({
      date: String(r.date_day),
      spend: Number(r.spend) || 0,
      leads: Number(r.leads) || 0,
      mqls: 0,
      sqls: 0,
      won: Number(r.purchases) || 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
  };
}

export async function fetchSpartacoChatMetaCreatives(
  brand: string,
  mode: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<MetaChatCreative[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('spartaco_chat_meta_creatives', {
    p_brand: brand,
    p_mode: mode,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    brand_name: string; ad_id: string; ad_name: string; campaign_name: string;
    headline: string; primary_text: string; final_creative_link: string;
    destination_url: string; cta_type: string; is_video: boolean; video_url: string | null;
    spend: number; leads: number; purchases: number; revenue: number;
    impressions: number; clicks: number;
  }[];

  return rows.map((r) => {
    const spend = Number(r.spend) || 0;
    const leads = Number(r.leads) || 0;
    const purchases = Number(r.purchases) || 0;
    const revenue = Number(r.revenue) || 0;
    const impressions = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    return {
      brand: String(r.brand_name ?? ''),
      adName: String(r.ad_name ?? ''),
      campaign: String(r.campaign_name ?? ''),
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoUrl: r.video_url ?? null,
      spend,
      leads,
      clicks,
      impressions,
      cpl: safeDivide(spend, leads),
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      // Extended Spartaco fields
      purchases,
      revenue,
      cpa: safeDivide(spend, purchases),
      roas: revenue > 0 ? safeDivide(revenue, spend) : null,
    };
  });
}
