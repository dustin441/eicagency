import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type MetaChatCreative, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LifeRepChatSummaryRow = {
  client: 'liferep';
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type LifeRepChatCampaignRow = {
  client: 'liferep';
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
};

type MetaRow = {
  date: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
};

type AdsRow = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  final_creative_link: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchLifeRepChatSummary(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<LifeRepChatSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('liferep_meta')
    .select('impressions,clicks,cost,purchases,revenue')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MetaRow[];
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + Number(r.purchases ?? 0), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);

  return [{
    client: 'liferep',
    spend,
    impressions,
    clicks,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : null,
    cpa: purchases > 0 ? spend / purchases : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
  }];
}

export async function fetchLifeRepChatCampaigns(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<LifeRepChatCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('liferep_meta')
    .select('campaign_name,impressions,clicks,cost,purchases,revenue')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MetaRow[];

  type Accum = { spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
  const map = new Map<string, Accum>();
  for (const r of rows) {
    const e = map.get(r.campaign_name) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0);
    map.set(r.campaign_name, e);
  }

  return Array.from(map.entries())
    .map(([campaign, m]) => ({
      client: 'liferep' as const,
      campaign,
      ...m,
      roas: m.spend > 0 ? m.revenue / m.spend : null,
      cpa: m.purchases > 0 ? m.spend / m.purchases : null,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export async function fetchLifeRepChatSpendTrend(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('liferep_meta')
    .select('date,impressions,clicks,cost,purchases')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MetaRow[];

  // Aggregate by date
  type DayAccum = { spend: number; purchases: number; impressions: number; clicks: number };
  const dateMap = new Map<string, DayAccum>();
  for (const r of rows) {
    const e = dateMap.get(r.date) ?? { spend: 0, purchases: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, e);
  }

  return {
    focus: 'All Campaigns',
    platform: 'Meta',
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
        won: d.purchases,
        impressions: d.impressions,
        clicks: d.clicks,
      })),
  };
}

export async function fetchLifeRepChatMetaCreatives(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<MetaChatCreative[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const allRows: AdsRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('liferep_meta_ads')
      .select('ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end)
      .range(from, from + pageSize - 1);
    if (error) break;
    const page = (data ?? []) as unknown as AdsRow[];
    allRows.push(...page);
    if (page.length < pageSize) break;
    if (from + pageSize >= 3000) break; // cap at 3k rows for chat context
  }

  type CreativeAccum = {
    adName: string; campaign: string;
    headline: string; primaryText: string; finalCreativeLink: string;
    isVideo: boolean; videoUrl: string | null; ctaType: string;
    spend: number; clicks: number; impressions: number; purchases: number; revenue: number;
  };
  const map = new Map<string, CreativeAccum>();
  for (const r of allRows) {
    const key = r.ad_id || r.ad_name;
    const e = map.get(key) ?? {
      adName: String(r.ad_name ?? ''),
      campaign: String(r.campaign_name ?? ''),
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      isVideo: Boolean(r.is_video),
      videoUrl: r.video_url ?? null,
      ctaType: String(r.cta_type ?? ''),
      spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0,
    };
    e.spend += Number(r.cost ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.purchases += Number(r.purchases ?? 0);
    e.revenue += Number(r.revenue ?? 0);
    if (!e.videoUrl && r.video_url) e.videoUrl = r.video_url;
    map.set(key, e);
  }

  return Array.from(map.values())
    .filter(c => c.spend > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map(c => ({
      brand: 'LifeRep',
      adName: c.adName,
      campaign: c.campaign,
      headline: c.headline,
      primaryText: c.primaryText,
      finalCreativeLink: c.finalCreativeLink,
      isVideo: c.isVideo,
      videoUrl: c.videoUrl,
      ctaType: c.ctaType,
      spend: c.spend,
      leads: 0,
      clicks: c.clicks,
      impressions: c.impressions,
      cpl: null,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
      purchases: c.purchases,
      revenue: c.revenue,
      roas: c.spend > 0 ? c.revenue / c.spend : null,
      cpa: c.purchases > 0 ? c.spend / c.purchases : null,
    }));
}
