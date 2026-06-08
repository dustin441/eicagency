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
  // Optional extended fields for multi-brand clients (Spartaco etc.)
  brand?: string;
  purchases?: number;
  revenue?: number;
  cpa?: number | null;
  roas?: number | null;
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

export type TrendDataPoint = {
  date: string;
  spend: number;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
  impressions: number;
  clicks: number;
};

export type SpendTrendResult = {
  focus: string;
  platform: string;
  startDate: string;
  endDate: string;
  data: TrendDataPoint[];
};

export type SegmentSummary = {
  focus: string;
  platform: string;
  startDate: string;
  endDate: string;
  spend: number;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
  impressions: number;
  clicks: number;
  cpl: number | null;
  costPerMql: number | null;
  costPerSql: number | null;
  costPerWon: number | null;
  ctr: number | null;
  cpc: number | null;
};

// ─── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Resolves a date range from optional explicit dates or a days-ago shorthand.
export function resolveDateRange(
  startDate?: string,
  endDate?: string,
  days?: number,
): { start: string; end: string } {
  const end = endDate ?? todayStr();
  const start = startDate ?? daysAgoStr(days ?? 30);
  return { start, end };
}

// ─── Campaign performance (via RPC — no row-limit truncation) ──────────────────

export async function fetchChatCampaignPerformance(
  focus: string,
  platform: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<CampaignRow[]> {
  const supabase = createServerSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('chat_campaign_perf', {
    p_focus: focus,
    p_platform: platform,
    p_start: start,
    p_end: end,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    campaign_name: string; platform: string; spend: number;
    leads: number; mqls: number; sqls: number; closed_won: number;
  }[];

  return rows.map((r) => ({
    campaign: String(r.campaign_name ?? ''),
    platform: String(r.platform ?? ''),
    spend: Number(r.spend) || 0,
    leads: Number(r.leads) || 0,
    mqls: Number(r.mqls) || 0,
    sqls: Number(r.sqls) || 0,
    won: Number(r.closed_won) || 0,
    costPerMql: Number(r.mqls) > 0 ? (Number(r.spend) || 0) / Number(r.mqls) : null,
    costPerSql: Number(r.sqls) > 0 ? (Number(r.spend) || 0) / Number(r.sqls) : null,
    costPerWon: Number(r.closed_won) > 0 ? (Number(r.spend) || 0) / Number(r.closed_won) : null,
  }));
}

// ─── Spend trend (via RPC — daily time-series for charting) ───────────────────

export async function fetchChatSpendTrend(
  focus: string,
  platform: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SpendTrendResult> {
  const supabase = createServerSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('chat_spend_trend', {
    p_focus: focus,
    p_platform: platform,
    p_start: start,
    p_end: end,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    day: string; spend: number; leads: number; mqls: number;
    sqls: number; closed_won: number; impressions: number; clicks: number;
  }[];

  return {
    focus,
    platform,
    startDate: start,
    endDate: end,
    data: rows.map((r) => ({
      date: String(r.day).slice(0, 10),
      spend: Number(r.spend) || 0,
      leads: Number(r.leads) || 0,
      mqls: Number(r.mqls) || 0,
      sqls: Number(r.sqls) || 0,
      won: Number(r.closed_won) || 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
  };
}

// ─── Segment summary (derived from trend — aggregate all days) ─────────────────

export async function fetchChatSegmentSummary(
  focus: string,
  platform: string,
  startDate?: string,
  endDate?: string,
  days?: number,
): Promise<SegmentSummary> {
  const { start, end } = resolveDateRange(startDate, endDate, days);
  const { data: trend } = await fetchChatSpendTrend(focus, platform, start, end);

  const totals = trend.reduce(
    (acc, d) => {
      acc.spend += d.spend;
      acc.leads += d.leads;
      acc.mqls += d.mqls;
      acc.sqls += d.sqls;
      acc.won += d.won;
      acc.impressions += d.impressions;
      acc.clicks += d.clicks;
      return acc;
    },
    { spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0, impressions: 0, clicks: 0 },
  );

  return {
    focus,
    platform,
    startDate: start,
    endDate: end,
    ...totals,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
    costPerMql: totals.mqls > 0 ? totals.spend / totals.mqls : null,
    costPerSql: totals.sqls > 0 ? totals.spend / totals.sqls : null,
    costPerWon: totals.won > 0 ? totals.spend / totals.won : null,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
  };
}

// ─── Meta creatives (via RPC — no row-limit truncation) ───────────────────────

export async function fetchChatMetaCreatives(
  focus: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 5,
): Promise<MetaChatCreative[]> {
  const supabase = createServerSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('chat_meta_creatives', {
    p_focus: focus,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    ad_name: string; campaign_name: string; headline: string; primary_text: string;
    final_creative_link: string; is_video: boolean; video_url: string | null;
    cta_type: string; spend: number; leads: number; clicks: number; impressions: number;
  }[];

  return rows.map((r) => {
    const spend = Number(r.spend) || 0;
    const leads = Number(r.leads) || 0;
    const clicks = Number(r.clicks) || 0;
    const impressions = Number(r.impressions) || 0;
    return {
      adName: String(r.ad_name ?? ''),
      campaign: String(r.campaign_name ?? ''),
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      isVideo: Boolean(r.is_video),
      videoUrl: r.video_url ?? null,
      ctaType: String(r.cta_type ?? ''),
      spend,
      leads,
      clicks,
      impressions,
      cpl: leads > 0 ? spend / leads : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    };
  });
}

// ─── Google creatives (via RPC — no row-limit truncation) ─────────────────────

export async function fetchChatGoogleCreatives(
  focus: string,
  startDate?: string,
  endDate?: string,
  days?: number,
  limit = 5,
): Promise<GoogleChatCreative[]> {
  const supabase = createServerSupabaseClient();
  const { start, end } = resolveDateRange(startDate, endDate, days);

  const { data, error } = await supabase.rpc('chat_google_creatives', {
    p_focus: focus,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    campaign_name: string; headline_1: string; headline_2: string;
    description_1: string; clicks: number; impressions: number;
    cost: number; results: number;
  }[];

  return rows.map((r) => {
    const cost = Number(r.cost) || 0;
    const clicks = Number(r.clicks) || 0;
    const impressions = Number(r.impressions) || 0;
    const results = Number(r.results) || 0;
    return {
      campaign: String(r.campaign_name ?? ''),
      headline1: String(r.headline_1 ?? ''),
      headline2: String(r.headline_2 ?? ''),
      description: String(r.description_1 ?? ''),
      clicks,
      impressions,
      cost,
      results,
      cpa: results > 0 ? cost / results : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    };
  });
}

// ─── Budget pacing (current calendar month — intentionally ignores date filter) ─

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
