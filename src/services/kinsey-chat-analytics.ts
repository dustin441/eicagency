import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type MetaChatCreative, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type KinseySummaryRow = {
  adChannel: string;   // discriminator field — unique to Kinsey in duck-typing
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type KinseyCampaignRow = {
  adChannel: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
};

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchKinseyChatSummary(
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<KinseySummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('kinsey_chat_summary', {
    p_channel: channel, p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    ad_channel: string; spend: number; impressions: number; clicks: number;
    purchases: number | null; revenue: number | null; conversions: number;
    roas: number | null; cpa: number | null; ctr: number | null; cpc: number | null;
  }[];

  return rows.map((r) => ({
    adChannel: String(r.ad_channel ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    purchases: Number(r.purchases) || 0,
    revenue: Number(r.revenue) || 0,
    conversions: Number(r.conversions) || 0,
    roas: r.roas != null ? Number(r.roas) : null,
    cpa: r.cpa != null ? Number(r.cpa) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
    cpc: r.cpc != null ? Number(r.cpc) : null,
  }));
}

export async function fetchKinseyChatCampaigns(
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<KinseyCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('kinsey_chat_campaigns', {
    p_channel: channel, p_start: start, p_end: end, p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    ad_channel: string; campaign_name: string;
    spend: number; impressions: number; clicks: number;
    purchases: number | null; revenue: number | null; conversions: number;
    roas: number | null; cpa: number | null; ctr: number | null;
  }[];

  return rows.map((r) => ({
    adChannel: String(r.ad_channel ?? ''),
    campaign: String(r.campaign_name ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    purchases: Number(r.purchases) || 0,
    revenue: Number(r.revenue) || 0,
    conversions: Number(r.conversions) || 0,
    roas: r.roas != null ? Number(r.roas) : null,
    cpa: r.cpa != null ? Number(r.cpa) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
  }));
}

export async function fetchKinseyChatSpendTrend(
  channel: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('kinsey_chat_spend_trend', {
    p_channel: channel, p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    date_day: string; spend: number; purchases: number; revenue: number;
    conversions: number; clicks: number; impressions: number;
  }[];

  // purchases → won; conversions → leads for chart compatibility
  return {
    focus: channel === 'all' ? 'All Channels' : channel,
    platform: 'Meta + Google',
    startDate: start,
    endDate: end,
    data: rows.map((r) => ({
      date: String(r.date_day),
      spend: Number(r.spend) || 0,
      leads: Number(r.conversions) || 0,
      mqls: 0,
      sqls: 0,
      won: Number(r.purchases) || 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
  };
}

export async function fetchKinseyChatMetaCreatives(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<MetaChatCreative[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('kinsey_chat_meta_creatives', {
    p_start: start, p_end: end, p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    ad_id: string; ad_name: string; campaign_name: string;
    headline: string; primary_text: string; final_creative_link: string;
    is_video: boolean; video_url: string | null; cta_type: string;
    spend: number; impressions: number; clicks: number;
    purchases: number; revenue: number;
    roas: number | null; cpa: number | null; ctr: number | null;
  }[];

  return rows.map((r) => ({
    adName: String(r.ad_name ?? ''),
    campaign: String(r.campaign_name ?? ''),
    headline: String(r.headline ?? ''),
    primaryText: String(r.primary_text ?? ''),
    finalCreativeLink: String(r.final_creative_link ?? ''),
    isVideo: Boolean(r.is_video),
    videoUrl: r.video_url ?? null,
    ctaType: String(r.cta_type ?? ''),
    spend: Number(r.spend) || 0,
    leads: 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    cpl: null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
    // Extended — MetaCard shows ROAS grid when roas != null
    purchases: Number(r.purchases) || 0,
    revenue: Number(r.revenue) || 0,
    roas: r.roas != null ? Number(r.roas) : null,
    cpa: r.cpa != null ? Number(r.cpa) : null,
  }));
}
