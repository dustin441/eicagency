import { unstable_cache } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import {
  applyMondayProduct,
  buildTimeSeries,
  remapOtherRow,
  type ProductSourceRow,
  type ProductTimeSeriesPoint,
} from './spartaco-product-analytics';
import {
  availableMonthAverage,
  availableSourceTotal,
  benchmarkDelta,
  canonicalProductName,
  completedMonthRange,
  monthLabel,
  safeRate,
  sourceMonthCoverage,
  type MetricDirection,
} from './spartaco-brand-health-math';

export const SPARTACO_HEALTH_BRANDS = ['Jameson', 'Huskie', 'Ronin', 'Tiiger'] as const;
export type SpartacoHealthBrand = (typeof SPARTACO_HEALTH_BRANDS)[number];
export type BrandHealthFormat = 'count' | 'currency' | 'percent' | 'roas';

export type BrandHealthChannelRow = {
  channel: string;
  primaryMetric: string;
  actual: number | null;
  benchmark: number | null;
  delta: number | null;
  direction: MetricDirection;
  format: BrandHealthFormat;
  actualUnavailable?: boolean;
  supporting: { label: string; value: number | null; format: BrandHealthFormat; unavailable?: boolean }[];
};

export type BrandHealthProductRow = {
  product: string;
  engagedSessions: number;
  engagedShare: number | null;
  engagementRate: number | null;
  leads: number | null;
  cpl: number | null;
  onlineRevenue: number;
};

export type BrandHealthSourceCoverage = {
  source: string;
  label: string;
  monthsAvailable: number;
  monthsExpected: number;
  firstMonth: string | null;
  lastMonth: string | null;
  missingMonths: string[];
};

export type BrandHealthSummary = {
  brand: SpartacoHealthBrand;
  latestMonth: string;
  latestMonthLabel: string;
  latest: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  missingLatestSources: string[];
  sourceCoverage: BrandHealthSourceCoverage[];
  benchmark: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  benchmarkCoverage: {
    website: number;
    paidMedia: number;
  };
  priorYear: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  monthly: ProductTimeSeriesPoint[];
  monthlySourceAvailability: Record<string, string[]>;
  channels: BrandHealthChannelRow[];
  products: BrandHealthProductRow[];
};

export type SpartacoBrandHealthData = {
  start: string;
  end: string;
  latestMonth: string;
  latestMonthLabel: string;
  unassignedEmail: {
    sends: number;
    opens: number;
    clicks: number;
    openRate: number | null;
    clickRate: number | null;
  };
  brands: BrandHealthSummary[];
};

function numberValue(row: ProductSourceRow, field: keyof ProductSourceRow): number {
  return Number(row[field]) || 0;
}

function sum(rows: ProductSourceRow[], field: keyof ProductSourceRow): number {
  return rows.reduce((total, row) => total + numberValue(row, field), 0);
}

function emptyMonthlyPoint(monthKey: string): ProductTimeSeriesPoint {
  return {
    bucket: monthKey,
    label: monthLabel(monthKey),
    ad_cost: 0,
    ad_impressions: 0,
    ad_clicks: 0,
    ad_conversions: 0,
    ad_purchases: 0,
    ad_revenue: 0,
    ad_roas: 0,
    ad_cpl: 0,
    ga4_sessions: 0,
    ga4_engaged_sessions: 0,
    ga4_purchases: 0,
    ga4_revenue: 0,
    email_total_sent: 0,
    email_opens: 0,
    email_clicks: 0,
    email_open_rate: 0,
    email_click_rate: 0,
    gsc_clicks: 0,
    gsc_impressions: 0,
    gsc_ctr: 0,
    gsc_avg_position: 0,
    gsc_keywords_ranked: 0,
    social_post_count: 0,
    social_impressions: 0,
    social_interactions: 0,
    social_engagement: 0,
    social_engagement_rate: 0,
  };
}

function completeMonthlySeries(rows: ProductSourceRow[], monthKeys: string[]): ProductTimeSeriesPoint[] {
  const byMonth = new Map(buildTimeSeries(rows, 'month').map(point => [point.bucket, point]));
  return monthKeys.map(monthKey => byMonth.get(monthKey) ?? emptyMonthlyPoint(monthKey));
}

function pointEngagementRate(point: ProductTimeSeriesPoint): number | null {
  return safeRate(point.ga4_engaged_sessions, point.ga4_sessions);
}

function pointCpl(point: ProductTimeSeriesPoint): number | null {
  return safeRate(point.ad_cost, point.ad_conversions);
}

function pointRoas(point: ProductTimeSeriesPoint): number | null {
  return safeRate(point.ad_revenue, point.ad_cost);
}

function channelGroupRows(rows: ProductSourceRow[], channelGroup: string): ProductSourceRow[] {
  return rows.filter(row => (row.ga4_default_channel_group ?? '').toLowerCase() === channelGroup.toLowerCase());
}

function addChannelRow(
  channel: string,
  primaryMetric: string,
  actual: number | null,
  benchmark: number | null,
  direction: MetricDirection,
  format: BrandHealthFormat,
  supporting: BrandHealthChannelRow['supporting'],
  actualUnavailable = false,
): BrandHealthChannelRow {
  return {
    channel,
    primaryMetric,
    actual,
    benchmark,
    delta: benchmarkDelta(actual, benchmark, direction),
    direction,
    format,
    supporting,
    actualUnavailable,
  };
}

function buildChannels(latestRows: ProductSourceRow[], historicalRows: ProductSourceRow[]): BrandHealthChannelRow[] {
  const latestAds = latestRows.filter(row => row.source === 'ads');
  const historicalAds = historicalRows.filter(row => row.source === 'ads');
  const latestEmail = latestRows.filter(row => row.source === 'email');
  const historicalEmail = historicalRows.filter(row => row.source === 'email');
  const latestGsc = latestRows.filter(row => row.source === 'gsc');
  const latestNativeSocial = latestRows.filter(row => row.source === 'social');
  const hasLatestGa4 = latestRows.some(row => row.source === 'ga4');
  const latestOrganic = channelGroupRows(latestRows, 'Organic Search');
  const historicalOrganic = channelGroupRows(historicalRows, 'Organic Search');
  const latestSocial = channelGroupRows(latestRows, 'Organic Social');
  const historicalSocial = channelGroupRows(historicalRows, 'Organic Social');
  const latestDirect = channelGroupRows(latestRows, 'Direct');
  const historicalDirect = channelGroupRows(historicalRows, 'Direct');

  const paidActual = safeRate(sum(latestAds, 'ad_cost'), sum(latestAds, 'ad_conversions'));
  const paidBenchmark = safeRate(sum(historicalAds, 'ad_cost'), sum(historicalAds, 'ad_conversions'));
  const emailActual = safeRate(sum(latestEmail, 'email_clicks'), sum(latestEmail, 'email_total_sent'));
  const emailBenchmark = safeRate(sum(historicalEmail, 'email_clicks'), sum(historicalEmail, 'email_total_sent'));
  const organicActual = safeRate(sum(latestOrganic, 'ga4_engaged_sessions'), sum(latestOrganic, 'ga4_sessions'));
  const organicBenchmark = safeRate(sum(historicalOrganic, 'ga4_engaged_sessions'), sum(historicalOrganic, 'ga4_sessions'));
  const socialActual = safeRate(sum(latestSocial, 'ga4_engaged_sessions'), sum(latestSocial, 'ga4_sessions'));
  const socialBenchmark = safeRate(sum(historicalSocial, 'ga4_engaged_sessions'), sum(historicalSocial, 'ga4_sessions'));
  const directActual = safeRate(sum(latestDirect, 'ga4_engaged_sessions'), sum(latestDirect, 'ga4_sessions'));
  const directBenchmark = safeRate(sum(historicalDirect, 'ga4_engaged_sessions'), sum(historicalDirect, 'ga4_sessions'));

  return [
    addChannelRow('Paid Media', 'Cost / tracked conversion', paidActual, paidBenchmark, 'lower', 'currency', [
      { label: 'Blended paid ROAS', value: safeRate(sum(latestAds, 'ad_revenue'), sum(latestAds, 'ad_cost')), format: 'roas', unavailable: latestAds.length === 0 },
      { label: 'CTR', value: safeRate(sum(latestAds, 'ad_clicks'), sum(latestAds, 'ad_impressions')), format: 'percent', unavailable: latestAds.length === 0 },
    ], latestAds.length === 0),
    addChannelRow('Email', 'Click rate', emailActual, emailBenchmark, 'higher', 'percent', [
      { label: 'Open rate', value: safeRate(sum(latestEmail, 'email_opens'), sum(latestEmail, 'email_total_sent')), format: 'percent', unavailable: latestEmail.length === 0 },
      { label: 'Sends', value: latestEmail.length > 0 ? sum(latestEmail, 'email_total_sent') : null, format: 'count', unavailable: latestEmail.length === 0 },
    ], latestEmail.length === 0),
    addChannelRow('Organic Search', 'Engagement rate', organicActual, organicBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: hasLatestGa4 ? sum(latestOrganic, 'ga4_engaged_sessions') : null, format: 'count', unavailable: !hasLatestGa4 },
      { label: 'GSC CTR', value: safeRate(sum(latestGsc, 'gsc_clicks'), sum(latestGsc, 'gsc_impressions')), format: 'percent', unavailable: latestGsc.length === 0 },
    ], !hasLatestGa4),
    addChannelRow('Organic Social', 'Engagement rate', socialActual, socialBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: hasLatestGa4 ? sum(latestSocial, 'ga4_engaged_sessions') : null, format: 'count', unavailable: !hasLatestGa4 },
      { label: 'Native engagement', value: safeRate(sum(latestNativeSocial, 'social_interactions'), sum(latestNativeSocial, 'social_impressions')), format: 'percent', unavailable: latestNativeSocial.length === 0 },
    ], !hasLatestGa4),
    addChannelRow('Direct', 'Engagement rate', directActual, directBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: hasLatestGa4 ? sum(latestDirect, 'ga4_engaged_sessions') : null, format: 'count', unavailable: !hasLatestGa4 },
      { label: 'Sessions', value: hasLatestGa4 ? sum(latestDirect, 'ga4_sessions') : null, format: 'count', unavailable: !hasLatestGa4 },
    ], !hasLatestGa4),
  ];
}

function productName(row: ProductSourceRow): string | null {
  return canonicalProductName(row.parent_product, row.monday_product, row.product);
}

function buildProducts(
  rows: ProductSourceRow[],
  totalBrandEngagedSessions: number,
): BrandHealthProductRow[] {
  const grouped = new Map<string, ProductSourceRow[]>();
  for (const row of rows) {
    const name = productName(row);
    if (!name) continue;
    grouped.set(name, [...(grouped.get(name) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([product, productRows]) => {
      const engagedSessions = sum(productRows, 'ga4_engaged_sessions');
      const paidRows = productRows.filter(row => row.source === 'ads');
      const hasPaidAttribution = paidRows.length > 0;
      const cost = sum(paidRows, 'ad_cost');
      const leads = hasPaidAttribution ? sum(paidRows, 'ad_conversions') : null;
      return {
        product,
        engagedSessions,
        engagedShare: safeRate(engagedSessions, totalBrandEngagedSessions),
        engagementRate: safeRate(engagedSessions, sum(productRows, 'ga4_sessions')),
        leads,
        cpl: leads === null ? null : safeRate(cost, leads),
        onlineRevenue: sum(productRows, 'ga4_total_revenue'),
      };
    })
    .filter(row => row.engagedSessions > 0 || (row.leads ?? 0) > 0 || row.onlineRevenue > 0)
    .sort((a, b) => (b.engagedSessions + (b.leads ?? 0)) - (a.engagedSessions + (a.leads ?? 0)));
}

function buildBrandSummary(
  brand: SpartacoHealthBrand,
  totalRows: ProductSourceRow[],
  productRows: ProductSourceRow[],
  monthKeys: string[],
  latestMonth: string,
): BrandHealthSummary {
  const rows = totalRows.filter(row => row.brand === brand);
  const brandProductRows = productRows.filter(row => row.brand === brand);
  const latestRows = rows.filter(row => row.date.startsWith(latestMonth));
  const historicalRows = rows.filter(row => !row.date.startsWith(latestMonth));
  const historicalGa4Rows = historicalRows.filter(row => row.source === 'ga4');
  const historicalAdsRows = historicalRows.filter(row => row.source === 'ads');
  const monthly = completeMonthlySeries(rows, monthKeys);
  const latest = monthly[monthly.length - 1] ?? emptyMonthlyPoint(latestMonth);
  const priorYearMonth = monthKeys[monthKeys.length - 13];
  const priorYearRows = rows.filter(row => row.date.startsWith(priorYearMonth));
  const priorYearGa4Rows = priorYearRows.filter(row => row.source === 'ga4');
  const priorYearAdsRows = priorYearRows.filter(row => row.source === 'ads');
  const priorYearPoint = monthly.find(point => point.bucket === priorYearMonth)
    ?? emptyMonthlyPoint(priorYearMonth);
  const latestSources = new Set(latestRows.map(row => row.source).filter(Boolean));
  const hasGa4 = latestSources.has('ga4');
  const hasAds = latestSources.has('ads');
  const sourceLabels: [string, string][] = [
    ['ga4', 'Website analytics'],
    ['ads', 'Paid media'],
    ['email', 'Email'],
    ['gsc', 'Google Search Console'],
    ['social', 'Native social reporting'],
  ];
  const sourceCoverage = sourceLabels.map(([source, label]) => ({
    source,
    label,
    ...sourceMonthCoverage(rows.filter(row => row.source === source), monthKeys),
  }));
  const monthlySourceAvailability = Object.fromEntries(monthKeys.map(month => [
    month,
    Array.from(new Set(
      rows
        .filter(row => row.date.startsWith(month))
        .map(row => row.source)
        .filter((source): source is string => Boolean(source)),
    )),
  ]));

  return {
    brand,
    latestMonth,
    latestMonthLabel: monthLabel(latestMonth),
    latest: {
      engagedSessions: hasGa4 ? latest.ga4_engaged_sessions : null,
      engagementRate: pointEngagementRate(latest),
      leads: hasAds ? latest.ad_conversions : null,
      cpl: pointCpl(latest),
      roas: pointRoas(latest),
      onlineRevenue: hasGa4 ? latest.ga4_revenue : null,
    },
    missingLatestSources: sourceLabels
      .filter(([source]) => !latestSources.has(source))
      .map(([, label]) => label),
    sourceCoverage,
    benchmark: {
      engagedSessions: availableMonthAverage(historicalGa4Rows, row => numberValue(row, 'ga4_engaged_sessions')),
      engagementRate: safeRate(sum(historicalGa4Rows, 'ga4_engaged_sessions'), sum(historicalGa4Rows, 'ga4_sessions')),
      leads: availableMonthAverage(historicalAdsRows, row => numberValue(row, 'ad_conversions')),
      cpl: safeRate(sum(historicalAdsRows, 'ad_cost'), sum(historicalAdsRows, 'ad_conversions')),
      roas: safeRate(sum(historicalAdsRows, 'ad_revenue'), sum(historicalAdsRows, 'ad_cost')),
      onlineRevenue: availableMonthAverage(historicalGa4Rows, row => numberValue(row, 'ga4_total_revenue')),
    },
    benchmarkCoverage: {
      website: sourceMonthCoverage(historicalGa4Rows, monthKeys.slice(0, -1)).monthsAvailable,
      paidMedia: sourceMonthCoverage(historicalAdsRows, monthKeys.slice(0, -1)).monthsAvailable,
    },
    priorYear: {
      engagedSessions: availableSourceTotal(priorYearGa4Rows, row => numberValue(row, 'ga4_engaged_sessions')),
      engagementRate: priorYearGa4Rows.length > 0 ? pointEngagementRate(priorYearPoint) : null,
      leads: availableSourceTotal(priorYearAdsRows, row => numberValue(row, 'ad_conversions')),
      cpl: priorYearAdsRows.length > 0 ? pointCpl(priorYearPoint) : null,
      roas: priorYearAdsRows.length > 0 ? pointRoas(priorYearPoint) : null,
      onlineRevenue: availableSourceTotal(priorYearGa4Rows, row => numberValue(row, 'ga4_total_revenue')),
    },
    monthly,
    monthlySourceAvailability,
    channels: buildChannels(latestRows, historicalRows),
    products: buildProducts(brandProductRows, sum(rows, 'ga4_engaged_sessions')),
  };
}

async function fetchRpcRows(
  functionName: 'spartaco_brand_health_totals_rollup_json' | 'spartaco_brand_health_rollup_json',
  start: string,
  end: string,
): Promise<ProductSourceRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { data, error } = await supabase
    .rpc(functionName, { p_start: start, p_end: end });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProductSourceRow[];
}

async function fetchRows(start: string, end: string): Promise<{
  totals: ProductSourceRow[];
  products: ProductSourceRow[];
}> {
  const [totalRows, productRows] = await Promise.all([
    fetchRpcRows('spartaco_brand_health_totals_rollup_json', start, end),
    fetchRpcRows('spartaco_brand_health_rollup_json', start, end),
  ]);

  const totals = totalRows.filter(row => row.brand !== null);

  const products = productRows
    .filter(row => row.brand !== null)
    .map(remapOtherRow)
    .filter((row): row is ProductSourceRow => row !== null)
    .map(applyMondayProduct)
    .filter((row): row is ProductSourceRow => row.brand !== null)
    .filter(row => SPARTACO_HEALTH_BRANDS.includes(row.brand as SpartacoHealthBrand));

  return { totals, products };
}

export async function fetchSpartacoBrandHealth(): Promise<SpartacoBrandHealthData> {
  const range = completedMonthRange();
  const rows = await fetchRows(range.start, range.end);
  const unassignedEmailRows = rows.totals.filter(
    row => row.brand === 'Unassigned' && row.source === 'email'
  );
  const unassignedEmailSends = sum(unassignedEmailRows, 'email_total_sent');
  const unassignedEmailOpens = sum(unassignedEmailRows, 'email_opens');
  const unassignedEmailClicks = sum(unassignedEmailRows, 'email_clicks');

  return {
    start: range.start,
    end: range.end,
    latestMonth: range.latestMonth,
    latestMonthLabel: monthLabel(range.latestMonth),
    unassignedEmail: {
      sends: unassignedEmailSends,
      opens: unassignedEmailOpens,
      clicks: unassignedEmailClicks,
      openRate: safeRate(unassignedEmailOpens, unassignedEmailSends),
      clickRate: safeRate(unassignedEmailClicks, unassignedEmailSends),
    },
    brands: SPARTACO_HEALTH_BRANDS.map(brand =>
      buildBrandSummary(brand, rows.totals, rows.products, range.monthKeys, range.latestMonth)
    ),
  };
}

export const fetchCachedSpartacoBrandHealth = unstable_cache(
  fetchSpartacoBrandHealth,
  ['spartaco-brand-health-v5'],
  { revalidate: 3600 },
);
