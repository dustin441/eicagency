import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { resolveDateRange, type MetaChatCreative, type SpendTrendResult } from './chat-analytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BloomChatSummaryRow = {
  client: 'bloom';
  spend: number;
  impressions: number;
  clicks: number;
  websiteChats: number;
  costPerWebchat: number | null;
  ctr: number | null;
  cpc: number | null;
};

export type BloomChatCampaignRow = {
  client: 'bloom';
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  websiteChats: number;
  costPerWebchat: number | null;
  ctr: number | null;
};

type AdRow = {
  date: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  website_chats: number;
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

export async function fetchBloomChatSummary(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<BloomChatSummaryRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bloom_meta_ads')
    .select('impressions,clicks,cost,website_chats')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as AdRow[];
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const websiteChats = rows.reduce((s, r) => s + Number(r.website_chats ?? 0), 0);

  return [{
    client: 'bloom',
    spend,
    impressions,
    clicks,
    websiteChats,
    costPerWebchat: websiteChats > 0 ? spend / websiteChats : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
  }];
}

export async function fetchBloomChatCampaigns(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 20,
): Promise<BloomChatCampaignRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bloom_meta_ads')
    .select('campaign_name,impressions,clicks,cost,website_chats')
    .gte('date', start)
    .lte('date', end);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as AdRow[];

  type Accum = { spend: number; impressions: number; clicks: number; websiteChats: number };
  const map = new Map<string, Accum>();
  for (const r of rows) {
    const e = map.get(r.campaign_name) ?? { spend: 0, impressions: 0, clicks: 0, websiteChats: 0 };
    e.spend += Number(r.cost ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.websiteChats += Number(r.website_chats ?? 0);
    map.set(r.campaign_name, e);
  }

  return Array.from(map.entries())
    .map(([campaign, m]) => ({
      client: 'bloom' as const,
      campaign,
      ...m,
      costPerWebchat: m.websiteChats > 0 ? m.spend / m.websiteChats : null,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export async function fetchBloomChatSpendTrend(
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase
    .from('bloom_meta_ads')
    .select('date,impressions,clicks,cost,website_chats')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as AdRow[];

  type DayAccum = { spend: number; websiteChats: number; impressions: number; clicks: number };
  const dateMap = new Map<string, DayAccum>();
  for (const r of rows) {
    const e = dateMap.get(r.date) ?? { spend: 0, websiteChats: 0, impressions: 0, clicks: 0 };
    e.spend += Number(r.cost ?? 0);
    e.websiteChats += Number(r.website_chats ?? 0);
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
        won: d.websiteChats, // website chats mapped to won for chart compatibility
        impressions: d.impressions,
        clicks: d.clicks,
      })),
  };
}

export async function fetchBloomChatMetaCreatives(
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 10,
): Promise<MetaChatCreative[]> {
  const supabase = createSpartacoSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const allRows: AdRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('bloom_meta_ads')
      .select('date,ad_name,adset_name,campaign_name,impressions,clicks,cost,website_chats,final_creative_link,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
      .gte('date', start)
      .lte('date', end)
      .range(from, from + pageSize - 1);
    if (error) break;
    const page = (data ?? []) as unknown as AdRow[];
    allRows.push(...page);
    if (page.length < pageSize) break;
    if (from + pageSize >= 3000) break;
  }

  type CreativeAccum = {
    adName: string; campaign: string;
    headline: string; primaryText: string; finalCreativeLink: string;
    isVideo: boolean; videoUrl: string | null; ctaType: string;
    spend: number; clicks: number; impressions: number; websiteChats: number;
  };
  const map = new Map<string, CreativeAccum>();
  for (const r of allRows) {
    const key = `${r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const e = map.get(key) ?? {
      adName: String(r.ad_name ?? ''),
      campaign: String(r.campaign_name ?? ''),
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      isVideo: Boolean(r.is_video),
      videoUrl: r.video_url ?? null,
      ctaType: String(r.cta_type ?? ''),
      spend: 0, clicks: 0, impressions: 0, websiteChats: 0,
    };
    e.spend += Number(r.cost ?? 0);
    e.clicks += Number(r.clicks ?? 0);
    e.impressions += Number(r.impressions ?? 0);
    e.websiteChats += Number(r.website_chats ?? 0);
    if (!e.videoUrl && r.video_url) e.videoUrl = r.video_url;
    map.set(key, e);
  }

  return Array.from(map.values())
    .filter(c => c.spend > 0)
    .sort((a, b) => b.websiteChats - a.websiteChats || b.spend - a.spend)
    .slice(0, limit)
    .map(c => ({
      brand: 'Bloom Aesthetics',
      adName: c.adName,
      campaign: c.campaign,
      headline: c.headline,
      primaryText: c.primaryText,
      finalCreativeLink: c.finalCreativeLink,
      isVideo: c.isVideo,
      videoUrl: c.videoUrl,
      ctaType: c.ctaType,
      spend: c.spend,
      leads: c.websiteChats, // website chats = leads for card rendering
      clicks: c.clicks,
      impressions: c.impressions,
      cpl: c.websiteChats > 0 ? c.spend / c.websiteChats : null,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
      purchases: 0,
      revenue: 0,
      roas: null,
      cpa: null,
    }));
}
