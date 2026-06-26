import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, toIsoDate } from '@/lib/date-utils';
import type { GoogleCreative } from '@/services/analytics';

export type SpartacoMode = 'LEAD' | 'SALES' | 'ALL';

export type SpartacoFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  brand: string;
  product: string;
  channel: string;
  focus: string;
  campaign: string;
  channelGroup: string;
  sourceMedium: string;
};

export type SpartacoRow = {
  id: number;
  date: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  purchases: number;
  revenue: number;
  add_to_cart: number;
  add_to_cart_value: number;
  begin_checkout: number;
  ad_channel: string;
  brand: string;
  focus: string;
  type: SpartacoMode;
  origem: string;
};

export type SpartacoFilterOptions = {
  brands: string[];
  channels: string[];
  focuses: string[];
  campaigns: string[];
};

export type SpartacoSummary = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  purchases: number;
  revenue: number;
  addToCart: number;
  addToCartValue: number;
  beginCheckout: number;
  ctr: number;
  cpc: number;
  cpl: number;
  cpa: number;
  roas: number;
  costPerAtc: number;
  costPerCheckout: number;
};

export type SpartacoChartPoint = {
  label: string;
  spend: number;
  clicks: number;
  conversions: number;
  purchases: number;
  revenue: number;
  cpl: number;
  cpa: number;
  roas: number;
};

export type SpartacoBreakdownRow = {
  label: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  conversions: number;
  prevConversions: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  addToCart: number;
  prevAddToCart: number;
  addToCartValue: number;
  prevAddToCartValue: number;
  beginCheckout: number;
  prevBeginCheckout: number;
};

export type FiberDriverVersionRow = {
  version: string;
  campaign: string;
  cost: number;
  leads: number;
  cpl: number;
  sales: number;
  cps: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type SpartacoFocusInsight = {
  wins: string[];
  opportunities: string[];
  nextSteps: string[];
};

export type SpartacoWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  focusInsights: {
    jameson: SpartacoFocusInsight;
    huskie: SpartacoFocusInsight;
    ronin: SpartacoFocusInsight;
  };
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type SpartacoDashboardData = {
  mode: SpartacoMode;
  filterParams: SpartacoFilterParams;
  filterOptions: SpartacoFilterOptions;
  summary: SpartacoSummary;
  previousSummary: SpartacoSummary;
  daily: SpartacoChartPoint[];
  weekly: SpartacoChartPoint[];
  monthly: SpartacoChartPoint[];
  brandRows: SpartacoBreakdownRow[];
  productRows: SpartacoBreakdownRow[];
  channelRows: SpartacoBreakdownRow[];
  campaignRows: SpartacoBreakdownRow[];
  fiberDriverRows: FiberDriverVersionRow[];
  metaAdsByBrand: Record<string, SpartacoMetaAd[]>;
  weeklyReadout: SpartacoWeeklyReadout | null;
};

export type SpartacoMetaAd = {
  brand: string;
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string;
  headline: string;
  primaryText: string;
  destinationUrl: string;
  ctaType: string;
  isVideo: boolean;
  videoId: string;
  videoUrl: string;
  finalCreativeLink: string;
  impressions: number;
  clicks: number;
  cost: number;
  leads: number;
  purchases: number;
  revenue: number;
  previewUrl: string;
};

type SpartacoReadoutRow = {
  period_start: string | null;
  period_end: string | null;
  overall_story: string | null;
  focus_insights: unknown;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

const EMPTY_FOCUS_INSIGHT: SpartacoFocusInsight = {
  wins: [],
  opportunities: [],
  nextSteps: [],
};

function defaultCurrentRange() {
  return getPresetDates('last30')!;
}

function computeComparisonRange(start: string, end: string) {
  return computeCompDates(start, end, 'prev_period');
}

export function defaultSpartacoFilterParams(): SpartacoFilterParams {
  const { start, end } = defaultCurrentRange();
  const { compStart, compEnd } = computeComparisonRange(start, end);
  return {
    start,
    end,
    compStart,
    compEnd,
    brand: 'all',
    product: 'all',
    channel: 'all',
    focus: 'all',
    campaign: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
  };
}

export function spartacoParamsFromSearch(p: Record<string, string | undefined>): SpartacoFilterParams {
  const defaults = defaultSpartacoFilterParams();
  const start = p.start ?? defaults.start;
  const end = p.end ?? defaults.end;
  
  // If comp_start/end are provided in URL, use them. 
  // Otherwise, default to the computed previous period for the selected range.
  const computed = computeComparisonRange(start, end);
  
  return {
    start,
    end,
    compStart: p.comp_start ?? computed.compStart,
    compEnd: p.comp_end   ?? computed.compEnd,
    brand:        p.brand         ?? 'all',
    product:      p.product       ?? 'all',
    channel:      p.channel       ?? 'all',
    focus:        p.focus         ?? 'all',
    campaign:     p.campaign      ?? 'all',
    channelGroup: p.channel_group ?? 'all',
    sourceMedium: p.source_medium ?? 'all',
  };
}

const SUPABASE_PAGE_SIZE = 1000;
type EqQuery<T> = { eq(column: string, value: string): T };

async function fetchPagedRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      throw new Error(error.message ?? 'Supabase query failed');
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function numberSum(rows: SpartacoRow[], field: keyof SpartacoRow) {
  return rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}

function summarize(rows: SpartacoRow[]): SpartacoSummary {
  const impressions = numberSum(rows, 'impressions');
  const clicks = numberSum(rows, 'clicks');
  const cost = numberSum(rows, 'cost');
  const conversions = numberSum(rows, 'conversions');
  const purchases = numberSum(rows, 'purchases');
  const revenue = numberSum(rows, 'revenue');
  const addToCart = numberSum(rows, 'add_to_cart');
  const addToCartValue = numberSum(rows, 'add_to_cart_value');
  const beginCheckout = numberSum(rows, 'begin_checkout');
  return {
    impressions,
    clicks,
    cost,
    conversions,
    purchases,
    revenue,
    addToCart,
    addToCartValue,
    beginCheckout,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    cpl: conversions > 0 ? cost / conversions : 0,
    cpa: purchases > 0 ? cost / purchases : 0,
    roas: cost > 0 ? revenue / cost : 0,
    costPerAtc: addToCart > 0 ? cost / addToCart : 0,
    costPerCheckout: beginCheckout > 0 ? cost / beginCheckout : 0,
  };
}

function weekStart(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function labelForBucket(bucket: string, grain: 'day' | 'week' | 'month') {
  const date = new Date(`${bucket}-01T12:00:00`.replace('--', '-'));
  if (grain === 'day') {
    return new Date(`${bucket}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (grain === 'week') {
    const start = new Date(`${bucket}T12:00:00`);
    const end = new Date(`${bucket}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function aggregateTime(rows: SpartacoRow[], grain: 'day' | 'week' | 'month') {
  const bucketMap = new Map<string, SpartacoSummary>();
  for (const row of rows) {
    const bucket =
      grain === 'day' ? row.date :
      grain === 'week' ? weekStart(row.date) :
      monthKey(row.date);
    const current = bucketMap.get(bucket) ?? summarize([]);
    bucketMap.set(bucket, summarize([
      {
        ...row,
        impressions: current.impressions + Number(row.impressions || 0),
        clicks: current.clicks + Number(row.clicks || 0),
        cost: current.cost + Number(row.cost || 0),
        conversions: current.conversions + Number(row.conversions || 0),
        purchases: current.purchases + Number(row.purchases || 0),
        revenue: current.revenue + Number(row.revenue || 0),
      } as SpartacoRow,
    ]));
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, stats]) => ({
      label: labelForBucket(bucket, grain),
      spend: stats.cost,
      clicks: stats.clicks,
      conversions: stats.conversions,
      purchases: stats.purchases,
      revenue: stats.revenue,
      cpl: stats.cpl,
      cpa: stats.cpa,
      roas: stats.roas,
    }));
}

function aggregateBreakdown(
  currentRows: SpartacoRow[],
  prevRows: SpartacoRow[],
  keyFn: (row: SpartacoRow) => string,
  secondaryFn?: (row: SpartacoRow) => string | undefined,
  tertiaryFn?: (row: SpartacoRow) => string | undefined
) {
  const map = new Map<string, SpartacoBreakdownRow>();

  function apply(rows: SpartacoRow[], isPrev: boolean) {
    for (const row of rows) {
      const key = keyFn(row);
      const entry = map.get(key) ?? {
        label: key,
        secondaryLabel: secondaryFn?.(row),
        tertiaryLabel: tertiaryFn?.(row),
        impressions: 0,
        prevImpressions: 0,
        clicks: 0,
        prevClicks: 0,
        cost: 0,
        prevCost: 0,
        conversions: 0,
        prevConversions: 0,
        purchases: 0,
        prevPurchases: 0,
        revenue: 0,
        prevRevenue: 0,
        addToCart: 0,
        prevAddToCart: 0,
        addToCartValue: 0,
        prevAddToCartValue: 0,
        beginCheckout: 0,
        prevBeginCheckout: 0,
      };

      if (isPrev) {
        entry.prevImpressions += Number(row.impressions || 0);
        entry.prevClicks += Number(row.clicks || 0);
        entry.prevCost += Number(row.cost || 0);
        entry.prevConversions += Number(row.conversions || 0);
        entry.prevPurchases += Number(row.purchases || 0);
        entry.prevRevenue += Number(row.revenue || 0);
        entry.prevAddToCart += Number(row.add_to_cart || 0);
        entry.prevAddToCartValue += Number(row.add_to_cart_value || 0);
        entry.prevBeginCheckout += Number(row.begin_checkout || 0);
      } else {
        entry.impressions += Number(row.impressions || 0);
        entry.clicks += Number(row.clicks || 0);
        entry.cost += Number(row.cost || 0);
        entry.conversions += Number(row.conversions || 0);
        entry.purchases += Number(row.purchases || 0);
        entry.revenue += Number(row.revenue || 0);
        entry.addToCart += Number(row.add_to_cart || 0);
        entry.addToCartValue += Number(row.add_to_cart_value || 0);
        entry.beginCheckout += Number(row.begin_checkout || 0);
      }

      map.set(key, entry);
    }
  }

  apply(currentRows, false);
  apply(prevRows, true);

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

function normalizeRows(rows: SpartacoRow[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    ...row,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    cost: Number(row.cost) || 0,
    conversions: Number(row.conversions) || 0,
    purchases: Number(row.purchases) || 0,
    revenue: Number(row.revenue) || 0,
    add_to_cart: Number(row.add_to_cart) || 0,
    add_to_cart_value: Number(row.add_to_cart_value) || 0,
    begin_checkout: Number(row.begin_checkout) || 0,
  }));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
}

function focusInsightFrom(value: unknown): SpartacoFocusInsight {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_FOCUS_INSIGHT;
  const record = value as Record<string, unknown>;
  return {
    wins: asStringArray(record.wins),
    opportunities: asStringArray(record.opportunities),
    nextSteps: asStringArray(record.next_steps ?? record.nextSteps),
  };
}

function normalizeFocusInsights(value: unknown): SpartacoWeeklyReadout['focusInsights'] {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    jameson: focusInsightFrom(record.jameson ?? record.Jameson),
    huskie: focusInsightFrom(record.huskie ?? record.Huskie),
    ronin: focusInsightFrom(record.ronin ?? record.Ronin),
  };
}

function normalizeWeeklyReadout(row: SpartacoReadoutRow | null | undefined): SpartacoWeeklyReadout | null {
  if (!row?.overall_story && !row?.focus_insights) return null;

  return {
    periodStart: row.period_start ?? '',
    periodEnd: row.period_end ?? '',
    overallStory: row.overall_story ?? '',
    focusInsights: normalizeFocusInsights(row.focus_insights),
    wins: asStringArray(row.wins),
    opportunities: asStringArray(row.opportunities),
    accomplishments: asStringArray(row.accomplishments),
    focusNextWeek: asStringArray(row.focus_next_week),
    executionContext: asStringArray(row.execution_context),
  };
}

function normalizeFocus(campaignName: string | null, focus: string | null): string {
  if (focus && focus !== 'Other') return focus;

  const c = (campaignName ?? '').toLowerCase();

  if (c.includes('material lifting'))                                          return 'Material Lifting';

  if (c.includes('tiiger')) {
    if (c.includes('long handled'))                                            return 'Long Handled Tools';
    if (c.includes('pole puller') || c.includes('hydraulic pole'))             return 'Pole Puller';
    if (c.includes('pole maintenance') || c.includes('utility pole'))          return 'Pole Maintenance';
    return 'Other';
  }

  if (c.includes('alum pole') || c.includes('tree tool'))                     return 'Long Handled Tools';
  if (c.includes('little buddy') || c.includes('fishtape'))                   return 'Little Buddy';
  if (c.includes('rodder'))                                                    return 'Rodders';
  if (c.includes('cut/crimp') || c.includes('sla 758'))                       return 'Cut/Crimp Tools';
  if (c.includes('pole maintenance') || c.includes('pole removal'))           return 'Pole Maintenance';

  return 'Other';
}

export async function fetchSpartacoDashboardData(
  mode: SpartacoMode,
  params: SpartacoFilterParams
): Promise<SpartacoDashboardData> {
  const supabase = createSpartacoSupabaseClient();
  const baseSelect = 'id,date,campaign_name,impressions,clicks,cost,conversions,purchases,revenue,add_to_cart,add_to_cart_value,begin_checkout,ad_channel,brand,focus,type,origem';

  function applyDashboardFilters<T extends EqQuery<T>>(query: T) {
    let next = query;

    if (mode !== 'ALL') next = next.eq('type', mode);
    if (params.brand !== 'all') next = next.eq('brand', params.brand);
    if (params.channel !== 'all') next = next.eq('ad_channel', params.channel);
    if (params.focus !== 'all') next = next.eq('focus', params.focus);
    if (params.campaign !== 'all') next = next.eq('campaign_name', params.campaign);

    return next;
  }

  const [currentRows, prevRows, optionsRows, readoutRes, fiberDriverRows] = await Promise.all([
    fetchPagedRows<SpartacoRow>(async (from, to) =>
      await applyDashboardFilters(
        supabase
          .from('master_spartaco')
          .select(baseSelect)
          .gte('date', params.start)
          .lte('date', params.end)
          .order('id', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedRows<SpartacoRow>(async (from, to) =>
      await applyDashboardFilters(
        supabase
          .from('master_spartaco')
          .select(baseSelect)
          .gte('date', params.compStart)
          .lte('date', params.compEnd)
          .order('id', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedRows<{ brand: string | null; ad_channel: string | null; focus: string | null; campaign_name: string | null }>(async (from, to) => {
      let query = supabase
        .from('master_spartaco')
        .select('brand,ad_channel,focus,campaign_name')
        .gte('date', params.start)
        .lte('date', params.end)
        .order('id', { ascending: true })
        .range(from, to);

      if (mode !== 'ALL') {
        query = query.eq('type', mode);
      }

      return await query;
    }),
    supabase
      .from('spartaco_weekly_readout')
      .select('period_start,period_end,overall_story,focus_insights,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
    fetchFiberDriverRows(params.start, params.end),
  ]);

  const current = normalizeRows(currentRows);
  const previous = normalizeRows(prevRows);
  const optionData = optionsRows ?? [];
  const readoutRows = (readoutRes.data ?? []) as unknown as SpartacoReadoutRow[];
  const campaignNames = [...new Set(current.map((row) => row.campaign_name).filter(Boolean))];

  const metaAdsByBrand = await fetchSpartacoMetaAds({
    mode,
    params,
    campaignNames,
  });

  return {
    mode,
    filterParams: params,
    filterOptions: {
      brands: [...new Set(optionData.map((r) => String(r.brand)).filter(Boolean))].sort(),
      channels: [...new Set(optionData.map((r) => String(r.ad_channel)).filter(Boolean))].sort(),
      focuses: [...new Set(optionData.map((r) => String(r.focus)).filter(Boolean))].sort(),
      campaigns: [...new Set(optionData.map((r) => String(r.campaign_name)).filter(Boolean))].sort(),
    },
    summary: summarize(current),
    previousSummary: summarize(previous),
    daily: aggregateTime(current, 'day'),
    weekly: aggregateTime(current, 'week'),
    monthly: aggregateTime(current, 'month'),
    brandRows: aggregateBreakdown(current, previous, (row) => row.brand),
    productRows: aggregateBreakdown(current, previous, (row) => normalizeFocus(row.campaign_name, row.focus)),
    channelRows: aggregateBreakdown(current, previous, (row) => `${row.brand}||${row.ad_channel}`, (row) => row.ad_channel),
    campaignRows: aggregateBreakdown(
      current,
      previous,
      (row) => `${row.brand}||${row.ad_channel}||${row.campaign_name}`,
      (row) => row.ad_channel,
      (row) => row.campaign_name
    ),
    fiberDriverRows,
    metaAdsByBrand,
    weeklyReadout: normalizeWeeklyReadout(readoutRows[0]),
  };
}

async function fetchFiberDriverRows(start: string, end: string): Promise<FiberDriverVersionRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const rows = await fetchPagedRows<{ campaign_name: string | null; impressions: number; clicks: number; cost: number; conversions: number; purchases: number }>(
    async (from, to) =>
      await supabase
        .from('master_spartaco')
        .select('campaign_name,impressions,clicks,cost,conversions,purchases')
        .or('campaign_name.like.%Fiber Driver | V1%,campaign_name.like.%Fiber Driver | V2%')
        .gte('date', start)
        .lte('date', end)
        .range(from, to)
  );

  const byVersion = new Map<string, { campaign: string; cost: number; leads: number; sales: number; impressions: number; clicks: number }>();

  for (const row of rows) {
    const name = row.campaign_name ?? '';
    const version = name.includes('| V1') ? 'V1' : name.includes('| V2') ? 'V2' : null;
    if (!version) continue;

    const e = byVersion.get(version) ?? { campaign: name, cost: 0, leads: 0, sales: 0, impressions: 0, clicks: 0 };
    e.cost += Number(row.cost) || 0;
    e.leads += Number(row.conversions) || 0;
    e.sales += Number(row.purchases) || 0;
    e.impressions += Number(row.impressions) || 0;
    e.clicks += Number(row.clicks) || 0;
    byVersion.set(version, e);
  }

  return Array.from(byVersion.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([version, e]) => ({
      version,
      campaign: e.campaign,
      cost: e.cost,
      leads: e.leads,
      cpl: e.leads > 0 ? e.cost / e.leads : 0,
      sales: e.sales,
      cps: e.sales > 0 ? e.cost / e.sales : 0,
      impressions: e.impressions,
      clicks: e.clicks,
      ctr: e.impressions > 0 ? e.clicks / e.impressions : 0,
    }));
}

export async function fetchSpartacoMetaAds({
  mode,
  params,
  campaignNames,
}: {
  mode: SpartacoMode;
  params: SpartacoFilterParams;
  campaignNames: string[];
}): Promise<Record<string, SpartacoMetaAd[]>> {
  if (params.channel !== 'all' && params.channel !== 'Meta') {
    return {};
  }

  const supabase = createSpartacoSupabaseClient();
  const tableByBrand: Record<string, string> = {
    Jameson: 'jameson_meta_ads',
    Huskie: 'huskie_meta_ads',
    Tiiger: 'huskie_meta_ads',
    Ronin: 'ronin_meta_ads',
  };

  const brands = params.brand !== 'all'
    ? [params.brand].filter((brand) => tableByBrand[brand])
    : Object.keys(tableByBrand).filter((brand) => brand !== 'Tiiger');

  const queries = brands.map(async (brand) => {
    const data = await fetchPagedRows<Record<string, unknown>>(async (from, to) => {
      let query = supabase
        .from(tableByBrand[brand])
        .select('date,ad_id,ad_name,adset_name,campaign_name,headline,primary_text,destination_url,cta_type,is_video,video_id,video_url,final_creative_link,impressions,clicks,cost,leads,purchases,revenue,preview_url')
        .gte('date', params.start)
        .lte('date', params.end)
        .order('date', { ascending: true })
        .order('ad_id', { ascending: true })
        .range(from, to);

      if (params.campaign !== 'all') {
        query = query.eq('campaign_name', params.campaign);
      } else if (campaignNames.length > 0) {
        query = query.in('campaign_name', campaignNames);
      }

      return await query;
    });

    return [brand, rollupMetaAds(brand, data, mode)] as const;
  });

  return Object.fromEntries(await Promise.all(queries));
}

function rollupMetaAds(
  brand: string,
  rows: Record<string, unknown>[] | null | undefined,
  mode: SpartacoMode,
  limit = 20
): SpartacoMetaAd[] {
  const byAd = new Map<string, SpartacoMetaAd>();
  for (const row of rows ?? []) {
    const campaignName = String(row.campaign_name ?? '');
    if (!campaignName) continue;
    if (mode === 'LEAD' && !campaignName.toUpperCase().includes('LEAD')) continue;
    if (mode === 'SALES' && !campaignName.toUpperCase().includes('SALES')) continue;

    const adId = String(row.ad_id ?? '');
    const key = adId || `${String(row.ad_name ?? '')}||${campaignName}`;
    const entry = byAd.get(key) ?? {
      brand,
      adId,
      adName: String(row.ad_name ?? ''),
      adsetName: String(row.adset_name ?? ''),
      campaignName,
      headline: String(row.headline ?? ''),
      primaryText: String(row.primary_text ?? ''),
      destinationUrl: String(row.destination_url ?? ''),
      ctaType: String(row.cta_type ?? ''),
      isVideo: Boolean(row.is_video),
      videoId: String(row.video_id ?? ''),
      videoUrl: String(row.video_url ?? ''),
      finalCreativeLink: String(row.final_creative_link ?? ''),
      impressions: 0,
      clicks: 0,
      cost: 0,
      leads: 0,
      purchases: 0,
      revenue: 0,
      previewUrl: String(row.preview_url ?? ''),
    };

    entry.impressions += Number(row.impressions) || 0;
    entry.clicks += Number(row.clicks) || 0;
    entry.cost += Number(row.cost) || 0;
    entry.leads += Number(row.leads) || 0;
    entry.purchases += Number(row.purchases) || 0;
    entry.revenue += Number(row.revenue) || 0;
    entry.headline ||= String(row.headline ?? '');
    entry.primaryText ||= String(row.primary_text ?? '');
    entry.destinationUrl ||= String(row.destination_url ?? '');
    entry.ctaType ||= String(row.cta_type ?? '');
    entry.videoId ||= String(row.video_id ?? '');
    entry.videoUrl ||= String(row.video_url ?? '');
    entry.finalCreativeLink ||= String(row.final_creative_link ?? '');
    entry.isVideo = entry.isVideo || Boolean(row.is_video);
    entry.previewUrl ||= String(row.preview_url ?? '');

    byAd.set(key, entry);
  }

  return Array.from(byAd.values()).sort((a, b) => b.cost - a.cost).slice(0, limit);
}

// ─── Ad Analysis (Creative Analysis) page ──────────────────────────────────────
// Per-account, ad-level Meta creative analysis for Spartaco. Mirrors the PrePass
// /dashboard/creatives page, but Spartaco has no MQL/SQL/WON — only Leads and
// Sales (purchases + revenue → ROAS). Meta only for now. The three accounts
// (Jameson / Huskie / Ronin) replace PrePass's three focuses.

export type SpartacoCreativeMode = 'LEAD' | 'SALES';

export type SpartacoCreativeSummary = {
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  purchases: number;
  revenue: number;
  roas: number;
  costPerSale: number;
};

export type SpartacoCreativeBrandBlock = {
  brand: string;
  ads: SpartacoMetaAd[];
  googleAds: GoogleCreative[];
  summary: SpartacoCreativeSummary;
};

export type SpartacoCreativeInsight = {
  // 📸 META video-vs-image verdict text, keyed by brand (Jameson/Huskie/Ronin)
  brandVerdicts: Record<string, string>;
  // 📝 cross-brand copywriter note, one entry per line/bullet
  copywriterNote: string[];
  asOf: string;
};

// Structured, per-brand AI insight produced daily by the "Spartaco Creative
// Vision Insights" n8n workflow (yAmZDthBvVV4RKFV), which has Claude Sonnet 4.6
// actually look at the ad images / video frames of the last 30 days. Stored in
// the spartaco_creative_ai_insights table (one row per brand/day).
export type SpartacoAiInsightItem = { point: string; evidence?: string; why?: string };
export type SpartacoAiTest = { title: string; why?: string };
export type SpartacoBrandAiInsight = {
  brand: string;
  hasData: boolean;
  adsAnalyzed: number;
  summary: string;
  videoVsImage: string;
  whatWorks: SpartacoAiInsightItem[];
  improvements: SpartacoAiInsightItem[];
  nextTests: SpartacoAiTest[];
  nextCreativeBrief: string; // legacy free-text brief (fallback)
  asOf: string; // as_of_date (YYYY-MM-DD)
};

export type SpartacoCreativeAnalysis = {
  mode: SpartacoCreativeMode;
  brand: string;
  params: SpartacoFilterParams;
  brands: SpartacoCreativeBrandBlock[];
  insight: SpartacoCreativeInsight;
  // Per-brand structured AI insight from the vision workflow (preferred source).
  aiInsights: Record<string, SpartacoBrandAiInsight>;
};

const SPARTACO_AD_TABLES: Record<string, string> = {
  Jameson: 'jameson_meta_ads',
  Huskie: 'huskie_meta_ads',
  Ronin: 'ronin_meta_ads',
};

// ClickUp task that receives the "Creative Detail — Spartaco" deep-dive comment
// (n8n workflow Ml9nbWcwWqkUNsfc → ClickUp → spartaco_clickup_comments).
const SPARTACO_DEEPDIVE_TASK_ID = '86b8axxp4';

const SPARTACO_BRAND_KEYS = ['Jameson', 'Huskie', 'Ronin'] as const;

function summarizeCreativeAds(ads: SpartacoMetaAd[]): SpartacoCreativeSummary {
  const spend = ads.reduce((a, ad) => a + (Number(ad.cost) || 0), 0);
  const clicks = ads.reduce((a, ad) => a + (Number(ad.clicks) || 0), 0);
  const impressions = ads.reduce((a, ad) => a + (Number(ad.impressions) || 0), 0);
  const leads = ads.reduce((a, ad) => a + (Number(ad.leads) || 0), 0);
  const purchases = ads.reduce((a, ad) => a + (Number(ad.purchases) || 0), 0);
  const revenue = ads.reduce((a, ad) => a + (Number(ad.revenue) || 0), 0);
  return {
    spend,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    leads,
    cpl: leads > 0 ? spend / leads : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    costPerSale: purchases > 0 ? spend / purchases : 0,
  };
}

function hasImageLink(link: string): boolean {
  return Boolean(link && link !== 'null' && link !== 'undefined');
}

// Aggregate ad rows by ad NAME (case-insensitive), summing metrics across
// campaigns/ad sets so the same creative appears once instead of duplicated.
// The highest-spend variant supplies the display name/campaign/creative; if it
// lacks an image, a variant that has one wins the preview.
function aggregateMetaAdsByName(ads: SpartacoMetaAd[]): SpartacoMetaAd[] {
  const byName = new Map<string, SpartacoMetaAd>();
  for (const ad of [...ads].sort((a, b) => b.cost - a.cost)) {
    const key = (ad.adName || ad.headline || ad.campaignName).trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...ad });
      continue;
    }
    existing.impressions += ad.impressions;
    existing.clicks += ad.clicks;
    existing.cost += ad.cost;
    existing.leads += ad.leads;
    existing.purchases += ad.purchases;
    existing.revenue += ad.revenue;
    if (!hasImageLink(existing.finalCreativeLink) && hasImageLink(ad.finalCreativeLink)) {
      existing.finalCreativeLink = ad.finalCreativeLink;
      existing.isVideo = ad.isVideo;
      existing.videoId = ad.videoId;
      existing.videoUrl = ad.videoUrl;
      existing.previewUrl = ad.previewUrl;
    }
    existing.headline ||= ad.headline;
    existing.primaryText ||= ad.primaryText;
    existing.destinationUrl ||= ad.destinationUrl;
    existing.ctaType ||= ad.ctaType;
  }
  return Array.from(byName.values()).sort((a, b) => b.cost - a.cost);
}

// Per-account Google Search ad creatives (from spartaco_google_search), rolled up
// by ad_id and mapped to the shared GoogleCreative shape used by GoogleAdPreviews.
// Collect distinct, non-empty {prefix}{1..n} asset values in order (e.g. all
// responsive-search-ad headlines or descriptions on a row).
function collectAssets(row: Record<string, unknown>, prefix: string, count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= count; i++) {
    const v = String(row[`${prefix}${i}`] ?? '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

async function fetchSpartacoBrandGoogleSearch(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>,
  brand: string,
  params: SpartacoFilterParams
): Promise<GoogleCreative[]> {
  const rows = await fetchPagedRows<Record<string, unknown>>(async (from, to) =>
    await supabase
      .from('spartaco_google_search')
      // Static select string — postgrest-js type-checks the columns at the type
      // level, so a dynamic/template-literal select breaks the build.
      .select('ad_id,campaign_name,headline_1,headline_2,headline_3,headline_4,headline_5,headline_6,headline_7,headline_8,headline_9,headline_10,headline_11,headline_12,headline_13,headline_14,headline_15,description_1,description_2,description_3,description_4,clicks,impressions,cost,results')
      .eq('brand', brand)
      .gte('date', params.start)
      .lte('date', params.end)
      .order('cost', { ascending: false })
      .range(from, to)
  );

  const byAd = new Map<string, GoogleCreative>();
  for (const r of rows) {
    const adId = String(r.ad_id ?? '');
    if (!adId) continue;
    let entry = byAd.get(adId);
    if (!entry) {
      const headlines = collectAssets(r, 'headline_', 15);
      const descriptions = collectAssets(r, 'description_', 4);
      entry = {
        name: adId,
        campaign: String(r.campaign_name ?? ''),
        headline: headlines[0] ?? '',
        description: descriptions[0] ?? '',
        headlines,
        descriptions,
        spend: 0,
        clicks: 0,
        impressions: 0,
        results: 0,
      };
      byAd.set(adId, entry);
    }
    entry.spend += Number(r.cost) || 0;
    entry.clicks += Number(r.clicks) || 0;
    entry.impressions += Number(r.impressions) || 0;
    entry.results += Number(r.results) || 0;
  }

  return Array.from(byAd.values()).sort((a, b) => b.spend - a.spend).slice(0, 30);
}

// Parse the deep-dive "Creative Detail — Spartaco" comment into per-brand
// video-vs-image verdicts + the cross-brand copywriter note. Defensive: if the
// markers move, fields fall back to empty rather than throwing.
export function parseSpartacoCreativeInsight(text: string): {
  brandVerdicts: Record<string, string>;
  copywriterNote: string[];
} {
  const brandVerdicts: Record<string, string> = {};
  let copywriterNote: string[] = [];
  if (!text) return { brandVerdicts, copywriterNote };

  // 📝 Copywriter Note — everything after the marker line
  const noteIdx = text.indexOf('📝');
  if (noteIdx !== -1) {
    copywriterNote = text
      .slice(noteIdx)
      .split('\n')
      .slice(1) // drop the "📝 *Copywriter Note ...*" header line
      .map((l) => l.trim().replace(/^#+\s*/, '').replace(/\*\*/g, ''))
      .filter(Boolean);
  }

  // 📸 per-brand video-vs-image verdict (sections split by "---")
  for (const section of text.split('---')) {
    const header = section.match(/\*\s*(Jameson|Huskie|Ronin)\s*\*/i);
    if (!header) continue;
    const brand = SPARTACO_BRAND_KEYS.find((b) => b.toLowerCase() === header[1].toLowerCase());
    if (!brand) continue;

    const camIdx = section.indexOf('📸');
    if (camIdx === -1) continue;
    let block = section.slice(camIdx);
    const stopIdx = block.indexOf('🏆'); // verdict ends where the Top Ads list begins
    if (stopIdx !== -1) block = block.slice(0, stopIdx);

    const lines = block
      .split('\n')
      .slice(1) // drop the "📸 *META — Video vs Image ...*" header line
      .map((l) => l.trim().replace(/\*/g, ''))
      .filter(Boolean);
    if (lines.length > 0) brandVerdicts[brand] = lines.join('\n');
  }

  return { brandVerdicts, copywriterNote };
}

async function fetchSpartacoCreativeInsight(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>
): Promise<SpartacoCreativeInsight> {
  const empty: SpartacoCreativeInsight = { brandVerdicts: {}, copywriterNote: [], asOf: '' };
  const { data, error } = await supabase
    .from('spartaco_clickup_comments')
    .select('comment_text,posted_at')
    .eq('clickup_task_id', SPARTACO_DEEPDIVE_TASK_ID)
    .ilike('comment_text', '%Creative Detail%')
    .order('posted_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return empty;
  const row = (data ?? []) as unknown as { comment_text: string | null; posted_at: string | null }[];
  const parsed = parseSpartacoCreativeInsight(row[0].comment_text ?? '');
  return { ...parsed, asOf: row[0].posted_at ?? '' };
}

// Latest structured AI insight per brand from spartaco_creative_ai_insights.
// jsonb columns come back already parsed by supabase-js.
async function fetchSpartacoAiInsights(
  supabase: ReturnType<typeof createSpartacoSupabaseClient>,
  brands: string[]
): Promise<Record<string, SpartacoBrandAiInsight>> {
  const out: Record<string, SpartacoBrandAiInsight> = {};
  const { data, error } = await supabase
    .from('spartaco_creative_ai_insights')
    .select(
      'brand,as_of_date,ads_analyzed,has_data,summary,video_vs_image,what_works,improvements,next_tests,next_creative_brief'
    )
    .in('brand', brands)
    .order('as_of_date', { ascending: false });

  if (error || !data) return out;
  type Row = {
    brand: string;
    as_of_date: string | null;
    ads_analyzed: number | null;
    has_data: boolean | null;
    summary: string | null;
    video_vs_image: string | null;
    what_works: SpartacoAiInsightItem[] | null;
    improvements: SpartacoAiInsightItem[] | null;
    next_tests: SpartacoAiTest[] | null;
    next_creative_brief: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  for (const r of rows) {
    if (out[r.brand]) continue; // rows are newest-first; keep the latest per brand
    out[r.brand] = {
      brand: r.brand,
      hasData: Boolean(r.has_data),
      adsAnalyzed: r.ads_analyzed ?? 0,
      summary: r.summary ?? '',
      videoVsImage: r.video_vs_image ?? '',
      whatWorks: Array.isArray(r.what_works) ? r.what_works : [],
      improvements: Array.isArray(r.improvements) ? r.improvements : [],
      nextTests: Array.isArray(r.next_tests) ? r.next_tests : [],
      nextCreativeBrief: r.next_creative_brief ?? '',
      asOf: r.as_of_date ?? '',
    };
  }
  return out;
}

export async function fetchSpartacoCreativeAnalysis(
  mode: SpartacoCreativeMode,
  params: SpartacoFilterParams
): Promise<SpartacoCreativeAnalysis> {
  const supabase = createSpartacoSupabaseClient();
  const baseSelect =
    'date,ad_id,ad_name,adset_name,campaign_name,headline,primary_text,destination_url,cta_type,is_video,video_id,video_url,final_creative_link,impressions,clicks,cost,leads,purchases,revenue,preview_url';

  const brandList =
    params.brand !== 'all'
      ? [params.brand].filter((brand) => SPARTACO_AD_TABLES[brand])
      : Object.keys(SPARTACO_AD_TABLES);

  const [brandBlocks, insight, aiInsights] = await Promise.all([
    Promise.all(
      brandList.map(async (brand): Promise<SpartacoCreativeBrandBlock> => {
        const rows = await fetchPagedRows<Record<string, unknown>>(async (from, to) => {
          let query = supabase
            .from(SPARTACO_AD_TABLES[brand])
            .select(baseSelect)
            .gte('date', params.start)
            .lte('date', params.end)
            .order('date', { ascending: true })
            .order('ad_id', { ascending: true })
            .range(from, to);

          if (params.campaign !== 'all') {
            query = query.eq('campaign_name', params.campaign);
          }

          return await query;
        });

        const ads = aggregateMetaAdsByName(rollupMetaAds(brand, rows, mode, Number.POSITIVE_INFINITY));
        const googleAds = await fetchSpartacoBrandGoogleSearch(supabase, brand, params);
        return { brand, ads, googleAds, summary: summarizeCreativeAds(ads) };
      })
    ),
    fetchSpartacoCreativeInsight(supabase),
    fetchSpartacoAiInsights(supabase, brandList),
  ]);

  return { mode, brand: params.brand, params, brands: brandBlocks, insight, aiInsights };
}
