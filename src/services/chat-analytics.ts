import { createServerSupabaseClient } from '@/lib/supabase-server';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CampaignRow = {
  campaign: string;
  platform: string;
  spend: number;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
  costPerMql: number | null;
  costPerSql: number | null;
  costPerWon: number | null;
};

export type MetaChatCreative = {
  adName: string;
  campaign: string;
  headline: string;
  primaryText: string;
  finalCreativeLink: string;
  isVideo: boolean;
  videoUrl: string | null;
  ctaType: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  cpl: number | null;
  ctr: number | null;
};

export type GoogleChatCreative = {
  campaign: string;
  headline1: string;
  headline2: string;
  description: string;
  clicks: number;
  impressions: number;
  cost: number;
  results: number;
  cpa: number | null;
  ctr: number | null;
};

export type BudgetPacingRow = {
  focus: string;
  budget: number;
  googleSpent: number;
  metaSpent: number;
  totalSpent: number;
  pctUsed: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function fetchChatCampaignPerformance(
  focus: string,
  platform: string,
  days: number,
): Promise<CampaignRow[]> {
  const supabase = createServerSupabaseClient();
  const start = daysAgoStr(days);

  let query = supabase
    .from('master_marketing_performance')
    .select('campaign_name, platform, spend, platform_conversions, mqls, sqls, closed_won')
    .gte('date', start);

  if (focus !== 'all') query = query.eq('focus', focus);
  if (platform !== 'all') query = query.eq('platform', platform);

  const { data } = await query.limit(1000);
  const rows = (data ?? []) as unknown as {
    campaign_name: string; platform: string; spend: number;
    platform_conversions: number; mqls: number; sqls: number; closed_won: number;
  }[];

  const map = new Map<string, CampaignRow>();
  for (const r of rows) {
    const key = `${r.campaign_name}|${r.platform}`;
    const e = map.get(key) ?? {
      campaign: String(r.campaign_name ?? ''),
      platform: String(r.platform ?? ''),
      spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
      costPerMql: null, costPerSql: null, costPerWon: null,
    };
    e.spend += Number(r.spend) || 0;
    e.leads += Number(r.platform_conversions) || 0;
    e.mqls += Number(r.mqls) || 0;
    e.sqls += Number(r.sqls) || 0;
    e.won += Number(r.closed_won) || 0;
    map.set(key, e);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      costPerMql: r.mqls > 0 ? r.spend / r.mqls : null,
      costPerSql: r.sqls > 0 ? r.spend / r.sqls : null,
      costPerWon: r.won > 0 ? r.spend / r.won : null,
    }))
    .sort((a, b) => (a.costPerWon ?? Infinity) - (b.costPerWon ?? Infinity));
}

export async function fetchChatMetaCreatives(
  focus: string,
  days: number,
  limit: number,
): Promise<MetaChatCreative[]> {
  const supabase = createServerSupabaseClient();
  const start = daysAgoStr(days);

  let query = supabase
    .from('meta_ads_creatives')
    .select('ad_name,campaign_name,headline,primary_text,final_creative_link,is_video,video_url,cta_type,spend,leads,clicks,impressions')
    .gte('date', start);

  if (focus !== 'all') query = query.ilike('campaign_name', `%${focus}%`);

  const { data } = await query.limit(1000);
  const rows = (data ?? []) as unknown as {
    ad_name: string; campaign_name: string; headline: string; primary_text: string;
    final_creative_link: string; is_video: boolean; video_url: string | null;
    cta_type: string; spend: number; leads: number; clicks: number; impressions: number;
  }[];

  const map = new Map<string, MetaChatCreative>();
  for (const r of rows) {
    const key = `${r.ad_name}|${r.campaign_name}|${r.headline}`;
    const e = map.get(key) ?? {
      adName: String(r.ad_name ?? ''),
      campaign: String(r.campaign_name ?? ''),
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      isVideo: Boolean(r.is_video),
      videoUrl: r.video_url ?? null,
      ctaType: String(r.cta_type ?? ''),
      spend: 0, leads: 0, clicks: 0, impressions: 0,
      cpl: null, ctr: null,
    };
    e.spend += Number(r.spend) || 0;
    e.leads += Number(r.leads) || 0;
    e.clicks += Number(r.clicks) || 0;
    e.impressions += Number(r.impressions) || 0;
    if (!e.finalCreativeLink || e.finalCreativeLink === 'null') {
      e.finalCreativeLink = String(r.final_creative_link ?? '');
    }
    if (!e.videoUrl && r.video_url) e.videoUrl = r.video_url;
    map.set(key, e);
  }

  return [...map.values()]
    .filter((r) => r.leads > 0 || r.spend > 10)
    .map((r) => ({
      ...r,
      cpl: r.leads > 0 ? r.spend / r.leads : null,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
    }))
    .sort((a, b) => {
      if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
      if (a.cpl === null) return 1;
      if (b.cpl === null) return -1;
      return a.cpl - b.cpl;
    })
    .slice(0, limit);
}

export async function fetchChatGoogleCreatives(
  focus: string,
  days: number,
  limit: number,
): Promise<GoogleChatCreative[]> {
  const supabase = createServerSupabaseClient();
  const start = daysAgoStr(days);

  let query = supabase
    .from('google_search_ads_creatives')
    .select('campaign_name,headline_1,headline_2,description_1,clicks,impressions,cost,results')
    .gte('date', start);

  if (focus !== 'all') query = query.ilike('campaign_name', `%${focus}%`);

  const { data } = await query.limit(1000);
  const rows = (data ?? []) as unknown as {
    campaign_name: string; headline_1: string; headline_2: string;
    description_1: string; clicks: number; impressions: number;
    cost: number; results: number;
  }[];

  const map = new Map<string, GoogleChatCreative>();
  for (const r of rows) {
    const key = `${r.campaign_name}|${r.headline_1}|${r.headline_2}`;
    const e = map.get(key) ?? {
      campaign: String(r.campaign_name ?? ''),
      headline1: String(r.headline_1 ?? ''),
      headline2: String(r.headline_2 ?? ''),
      description: String(r.description_1 ?? ''),
      clicks: 0, impressions: 0, cost: 0, results: 0,
      cpa: null, ctr: null,
    };
    e.clicks += Number(r.clicks) || 0;
    e.impressions += Number(r.impressions) || 0;
    e.cost += Number(r.cost) || 0;
    e.results += Number(r.results) || 0;
    map.set(key, e);
  }

  return [...map.values()]
    .filter((r) => r.clicks > 0 || r.cost > 0)
    .map((r) => ({
      ...r,
      cpa: r.results > 0 ? r.cost / r.results : null,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
    }))
    .sort((a, b) => b.results - a.results || b.clicks - a.clicks)
    .slice(0, limit);
}

export async function fetchChatBudgetPacing(focus?: string): Promise<BudgetPacingRow[]> {
  const supabase = createServerSupabaseClient();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const segments = focus ? [focus] : ['SMB', 'ABM', 'FD360'];

  const [{ data: budgets }, { data: spend }] = await Promise.all([
    supabase.from('budgets').select('client, budget').in('client', segments),
    supabase
      .from('master_marketing_performance')
      .select('focus, platform, spend')
      .gte('date', monthStart)
      .in('focus', segments)
      .limit(1000),
  ]);

  const budgetRows = (budgets ?? []) as unknown as { client: string; budget: number }[];
  const spendRows = (spend ?? []) as unknown as { focus: string; platform: string; spend: number }[];

  return budgetRows.map((b) => {
    const rows = spendRows.filter((r) => r.focus === b.client);
    const googleSpent = rows
      .filter((r) => r.platform === 'Google')
      .reduce((s, r) => s + (Number(r.spend) || 0), 0);
    const metaSpent = rows
      .filter((r) => r.platform === 'Meta')
      .reduce((s, r) => s + (Number(r.spend) || 0), 0);
    const totalSpent = googleSpent + metaSpent;
    return {
      focus: b.client,
      budget: Number(b.budget),
      googleSpent,
      metaSpent,
      totalSpent,
      pctUsed: Number(b.budget) > 0 ? (totalSpent / Number(b.budget)) * 100 : 0,
    };
  });
}
