import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CBAChatSummaryRow = {
  client: 'cba';
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type CBAChatCampaignRow = {
  client: 'cba';
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
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

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchCBAChatSummary(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<CBAChatSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('cba_master')
    .select('impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const leads = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);

  return [{
    client: 'cba',
    spend,
    impressions,
    clicks,
    leads,
    cpl: leads > 0 ? spend / leads : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
  }];
}

export async function fetchCBAChatCampaigns(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<CBAChatCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('cba_master')
    .select('campaign_name,impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];

  type Accum = { spend: number; impressions: number; clicks: number; leads: number };
  const map = new Map<string, Accum>();
  for (const r of rows) {
    const e = map.get(r.campaign_name) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.leads += Number(r.conversions ?? 0);
    map.set(r.campaign_name, e);
  }

  return Array.from(map.entries())
    .map(([campaign, m]) => ({
      client: 'cba' as const,
      campaign,
      ...m,
      cpl: m.leads > 0 ? m.spend / m.leads : null,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export async function fetchCBAChatSpendTrend(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('cba_master')
    .select('date,impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];

  type DayAccum = { spend: number; leads: number; impressions: number; clicks: number };
  const dateMap = new Map<string, DayAccum>();
  for (const r of rows) {
    const e = dateMap.get(r.date) ?? { spend: 0, leads: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.leads += Number(r.conversions ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, e);
  }

  return {
    focus: 'All Campaigns',
    platform: 'All Channels',
    startDate: start,
    endDate: end,
    data: Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        spend: d.spend,
        leads: 0,
        mqls: 0,
        sqls: 0,
        won: d.leads, // leads mapped to won for chart compatibility
        impressions: d.impressions,
        clicks: d.clicks,
      })),
  };
}
