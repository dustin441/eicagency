import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, toIsoDate } from '@/lib/date-utils';

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
  ctr: number;
  cpc: number;
  cpl: number;
  cpa: number;
  roas: number;
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
  metaAdsByBrand: Record<string, SpartacoMetaAd[]>;
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
  finalCreativeLink: string;
  impressions: number;
  clicks: number;
  cost: number;
  leads: number;
  purchases: number;
  revenue: number;
  previewUrl: string;
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
    brand:    p.brand      ?? 'all',
    product:  p.product    ?? 'all',
    channel:  p.channel    ?? 'all',
    focus:    p.focus      ?? 'all',
    campaign: p.campaign   ?? 'all',
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
  return {
    impressions,
    clicks,
    cost,
    conversions,
    purchases,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    cpl: conversions > 0 ? cost / conversions : 0,
    cpa: purchases > 0 ? cost / purchases : 0,
    roas: cost > 0 ? revenue / cost : 0,
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
      };

      if (isPrev) {
        entry.prevImpressions += Number(row.impressions || 0);
        entry.prevClicks += Number(row.clicks || 0);
        entry.prevCost += Number(row.cost || 0);
        entry.prevConversions += Number(row.conversions || 0);
        entry.prevPurchases += Number(row.purchases || 0);
        entry.prevRevenue += Number(row.revenue || 0);
      } else {
        entry.impressions += Number(row.impressions || 0);
        entry.clicks += Number(row.clicks || 0);
        entry.cost += Number(row.cost || 0);
        entry.conversions += Number(row.conversions || 0);
        entry.purchases += Number(row.purchases || 0);
        entry.revenue += Number(row.revenue || 0);
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
  }));
}

export async function fetchSpartacoDashboardData(
  mode: SpartacoMode,
  params: SpartacoFilterParams
): Promise<SpartacoDashboardData> {
  const supabase = createSpartacoSupabaseClient();
  const baseSelect = 'id,date,campaign_name,impressions,clicks,cost,conversions,purchases,revenue,ad_channel,brand,focus,type,origem';

  function applyDashboardFilters<T extends EqQuery<T>>(query: T) {
    let next = query;

    if (mode !== 'ALL') next = next.eq('type', mode);
    if (params.brand !== 'all') next = next.eq('brand', params.brand);
    if (params.channel !== 'all') next = next.eq('ad_channel', params.channel);
    if (params.focus !== 'all') next = next.eq('focus', params.focus);
    if (params.campaign !== 'all') next = next.eq('campaign_name', params.campaign);

    return next;
  }

  const [currentRows, prevRows, optionsRows] = await Promise.all([
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
  ]);

  const current = normalizeRows(currentRows);
  const previous = normalizeRows(prevRows);
  const optionData = optionsRows ?? [];
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
    productRows: aggregateBreakdown(current, previous, (row) => row.focus),
    channelRows: aggregateBreakdown(current, previous, (row) => `${row.brand}||${row.ad_channel}`, (row) => row.ad_channel),
    campaignRows: aggregateBreakdown(
      current,
      previous,
      (row) => `${row.brand}||${row.ad_channel}||${row.campaign_name}`,
      (row) => row.ad_channel,
      (row) => row.campaign_name
    ),
    metaAdsByBrand,
  };
}

async function fetchSpartacoMetaAds({
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
    Ronin: 'ronin_meta_ads',
  };

  const brands = params.brand !== 'all'
    ? [params.brand].filter((brand) => tableByBrand[brand])
    : Object.keys(tableByBrand);

  const queries = brands.map(async (brand) => {
    const data = await fetchPagedRows<Record<string, unknown>>(async (from, to) => {
      let query = supabase
        .from(tableByBrand[brand])
        .select('date,ad_id,ad_name,adset_name,campaign_name,headline,primary_text,destination_url,cta_type,is_video,video_id,final_creative_link,impressions,clicks,cost,leads,purchases,revenue,preview_url')
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
  mode: SpartacoMode
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
    entry.finalCreativeLink ||= String(row.final_creative_link ?? '');
    entry.isVideo = entry.isVideo || Boolean(row.is_video);
    entry.previewUrl ||= String(row.preview_url ?? '');

    byAd.set(key, entry);
  }

  return Array.from(byAd.values()).sort((a, b) => b.cost - a.cost).slice(0, 20);
}
