import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BridgewayChatSummaryRow = {
  client: 'bridgeway';
  spend: number;
  impressions: number;
  clicks: number;
  calls: number;       // 60+ second calls = conversions
  costPerCall: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type BridgewayChatCampaignRow = {
  client: 'bridgeway';
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  calls: number;
  costPerCall: number | null;
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

export async function fetchBridgewayChatSummary(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<BridgewayChatSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bridgeway_master')
    .select('impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const calls = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);

  return [{
    client: 'bridgeway',
    spend,
    impressions,
    clicks,
    calls,
    costPerCall: calls > 0 ? spend / calls : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
  }];
}

export async function fetchBridgewayChatCampaigns(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<BridgewayChatCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bridgeway_master')
    .select('campaign_name,ad_channel,impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];

  type Accum = { spend: number; impressions: number; clicks: number; calls: number };
  const map = new Map<string, Accum & { campaign: string; channel: string }>();
  for (const r of rows) {
    const key = `${r.campaign_name}__${r.ad_channel}`;
    const e = map.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0, calls: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.calls += Number(r.conversions ?? 0);
    map.set(key, e);
  }

  return Array.from(map.values())
    .map(m => ({
      client: 'bridgeway' as const,
      campaign: m.campaign,
      channel: m.channel,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      calls: m.calls,
      costPerCall: m.calls > 0 ? m.spend / m.calls : null,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export async function fetchBridgewayChatSpendTrend(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bridgeway_master')
    .select('date,impressions,clicks,cost,conversions')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MasterRow[];

  type DayAccum = { spend: number; calls: number; impressions: number; clicks: number };
  const dateMap = new Map<string, DayAccum>();
  for (const r of rows) {
    const e = dateMap.get(r.date) ?? { spend: 0, calls: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.calls += Number(r.conversions ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, e);
  }

  return {
    focus: 'All Campaigns',
    platform: 'Google',
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
        won: d.calls, // 60+ sec calls mapped to won for chart compatibility
        impressions: d.impressions,
        clicks: d.clicks,
      })),
  };
}
