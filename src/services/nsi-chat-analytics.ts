import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NsiSummaryRow = {
  channel: string;
  audienceType: string;
  torpedo: string;
  spend: number;
  impressions: number;
  clicks: number;
  submittals: number;
  engagedSessions: number;
  cpl: number | null;
  costPerEngSession: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type NsiCampaignRow = {
  channel: string;
  audienceType: string;
  torpedo: string;
  subCampaign: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  submittals: number;
  engagedSessions: number;
  cpl: number | null;
  costPerEngSession: number | null;
  ctr: number | null;
};

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchNsiChatSummary(
  channel: string,
  type: string,
  torpedo: string,
  subCampaign: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<NsiSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('nsi_chat_summary', {
    p_channel: channel, p_type: type, p_torpedo: torpedo,
    p_sub_campaign: subCampaign, p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    channel: string; audience_type: string; torpedo: string;
    spend: number; impressions: number; clicks: number;
    submittals: number; engaged_sessions: number;
    cpl: number | null; cost_per_eng_session: number | null;
    ctr: number | null; cpc: number | null;
  }[];

  return rows.map((r) => ({
    channel: String(r.channel ?? ''),
    audienceType: String(r.audience_type ?? ''),
    torpedo: String(r.torpedo ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    submittals: Number(r.submittals) || 0,
    engagedSessions: Number(r.engaged_sessions) || 0,
    cpl: r.cpl != null ? Number(r.cpl) : null,
    costPerEngSession: r.cost_per_eng_session != null ? Number(r.cost_per_eng_session) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
    cpc: r.cpc != null ? Number(r.cpc) : null,
  }));
}

export async function fetchNsiChatCampaigns(
  channel: string,
  type: string,
  torpedo: string,
  subCampaign: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 25,
): Promise<NsiCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('nsi_chat_campaigns', {
    p_channel: channel, p_type: type, p_torpedo: torpedo,
    p_sub_campaign: subCampaign, p_start: start, p_end: end, p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    channel: string; audience_type: string; torpedo: string; sub_campaign: string;
    campaign_name: string; spend: number; impressions: number; clicks: number;
    submittals: number; engaged_sessions: number;
    cpl: number | null; cost_per_eng_session: number | null; ctr: number | null;
  }[];

  return rows.map((r) => ({
    channel: String(r.channel ?? ''),
    audienceType: String(r.audience_type ?? ''),
    torpedo: String(r.torpedo ?? ''),
    subCampaign: String(r.sub_campaign ?? ''),
    campaign: String(r.campaign_name ?? ''),
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    submittals: Number(r.submittals) || 0,
    engagedSessions: Number(r.engaged_sessions) || 0,
    cpl: r.cpl != null ? Number(r.cpl) : null,
    costPerEngSession: r.cost_per_eng_session != null ? Number(r.cost_per_eng_session) : null,
    ctr: r.ctr != null ? Number(r.ctr) : null,
  }));
}

export async function fetchNsiChatSpendTrend(
  channel: string,
  type: string,
  torpedo: string,
  subCampaign: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('nsi_chat_spend_trend', {
    p_channel: channel, p_type: type, p_torpedo: torpedo,
    p_sub_campaign: subCampaign, p_start: start, p_end: end,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    date_day: string; spend: number; submittals: number;
    engaged_sessions: number; clicks: number; impressions: number;
  }[];

  const focusLabel = [
    torpedo !== 'all' ? torpedo : null,
    subCampaign !== 'all' ? subCampaign : null,
    channel !== 'all' ? channel : 'All Channels',
  ].filter(Boolean).join(' · ');

  return {
    focus: focusLabel,
    platform: type === 'all' ? 'All Audiences' : type,
    startDate: start,
    endDate: end,
    data: rows.map((r) => ({
      date: String(r.date_day),
      spend: Number(r.spend) || 0,
      leads: Number(r.submittals) || 0,
      mqls: Number(r.engaged_sessions) || 0,
      sqls: 0,
      won: 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
  };
}
