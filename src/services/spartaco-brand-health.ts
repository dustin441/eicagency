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
  benchmarkDelta,
  canonicalProductName,
  completedMonthRange,
  monthLabel,
  safeRate,
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
  supporting: { label: string; value: number | null; format: BrandHealthFormat }[];
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
  benchmark: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  priorYear: {
    engagedSessions: number;
    engagementRate: number | null;
    leads: number;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number;
  } | null;
  monthly: ProductTimeSeriesPoint[];
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

function monthAverage(points: ProductTimeSeriesPoint[], field: keyof ProductTimeSeriesPoint): number | null {
  if (points.length === 0) return null;
  return points.reduce((total, point) => total + (Number(point[field]) || 0), 0) / points.length;
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
  };
}

function buildChannels(latestRows: ProductSourceRow[], historicalRows: ProductSourceRow[]): BrandHealthChannelRow[] {
  const latestOrganic = channelGroupRows(latestRows, 'Organic Search');
  const historicalOrganic = channelGroupRows(historicalRows, 'Organic Search');
  const latestSocial = channelGroupRows(latestRows, 'Organic Social');
  const historicalSocial = channelGroupRows(historicalRows, 'Organic Social');
  const latestDirect = channelGroupRows(latestRows, 'Direct');
  const historicalDirect = channelGroupRows(historicalRows, 'Direct');

  const paidActual = safeRate(sum(latestRows, 'ad_cost'), sum(latestRows, 'ad_conversions'));
  const paidBenchmark = safeRate(sum(historicalRows, 'ad_cost'), sum(historicalRows, 'ad_conversions'));
  const emailActual = safeRate(sum(latestRows, 'email_clicks'), sum(latestRows, 'email_total_sent'));
  const emailBenchmark = safeRate(sum(historicalRows, 'email_clicks'), sum(historicalRows, 'email_total_sent'));
  const organicActual = safeRate(sum(latestOrganic, 'ga4_engaged_sessions'), sum(latestOrganic, 'ga4_sessions'));
  const organicBenchmark = safeRate(sum(historicalOrganic, 'ga4_engaged_sessions'), sum(historicalOrganic, 'ga4_sessions'));
  const socialActual = safeRate(sum(latestSocial, 'ga4_engaged_sessions'), sum(latestSocial, 'ga4_sessions'));
  const socialBenchmark = safeRate(sum(historicalSocial, 'ga4_engaged_sessions'), sum(historicalSocial, 'ga4_sessions'));
  const directActual = safeRate(sum(latestDirect, 'ga4_engaged_sessions'), sum(latestDirect, 'ga4_sessions'));
  const directBenchmark = safeRate(sum(historicalDirect, 'ga4_engaged_sessions'), sum(historicalDirect, 'ga4_sessions'));

  return [
    addChannelRow('Paid Media', 'CPL', paidActual, paidBenchmark, 'lower', 'currency', [
      { label: 'ROAS', value: safeRate(sum(latestRows, 'ad_revenue'), sum(latestRows, 'ad_cost')), format: 'roas' },
      { label: 'CTR', value: safeRate(sum(latestRows, 'ad_clicks'), sum(latestRows, 'ad_impressions')), format: 'percent' },
    ]),
    addChannelRow('Email', 'Click rate', emailActual, emailBenchmark, 'higher', 'percent', [
      { label: 'Open rate', value: safeRate(sum(latestRows, 'email_opens'), sum(latestRows, 'email_total_sent')), format: 'percent' },
      { label: 'Sends', value: sum(latestRows, 'email_total_sent'), format: 'count' },
    ]),
    addChannelRow('Organic Search', 'Engagement rate', organicActual, organicBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: sum(latestOrganic, 'ga4_engaged_sessions'), format: 'count' },
      { label: 'GSC CTR', value: safeRate(sum(latestRows, 'gsc_clicks'), sum(latestRows, 'gsc_impressions')), format: 'percent' },
    ]),
    addChannelRow('Organic Social', 'Engagement rate', socialActual, socialBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: sum(latestSocial, 'ga4_engaged_sessions'), format: 'count' },
      { label: 'Native engagement', value: safeRate(sum(latestRows, 'social_interactions'), sum(latestRows, 'social_impressions')), format: 'percent' },
    ]),
    addChannelRow('Direct', 'Engagement rate', directActual, directBenchmark, 'higher', 'percent', [
      { label: 'Engaged sessions', value: sum(latestDirect, 'ga4_engaged_sessions'), format: 'count' },
      { label: 'Sessions', value: sum(latestDirect, 'ga4_sessions'), format: 'count' },
    ]),
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
  const monthly = completeMonthlySeries(rows, monthKeys);
  const latest = monthly[monthly.length - 1] ?? emptyMonthlyPoint(latestMonth);
  const historical = monthly.slice(0, -1);
  const priorYearPoint = monthly.find(point => point.bucket === monthKeys[monthKeys.length - 13]);
  const latestSources = new Set(latestRows.map(row => row.source).filter(Boolean));
  const hasGa4 = latestSources.has('ga4');
  const hasAds = latestSources.has('ads');
  const sourceLabels: [string, string][] = [
    ['ga4', 'Website'],
    ['ads', 'Paid media'],
    ['email', 'Email'],
    ['gsc', 'Organic search'],
    ['social', 'Organic social'],
  ];

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
    benchmark: {
      engagedSessions: monthAverage(historical, 'ga4_engaged_sessions'),
      engagementRate: safeRate(
        historical.reduce((total, point) => total + point.ga4_engaged_sessions, 0),
        historical.reduce((total, point) => total + point.ga4_sessions, 0),
      ),
      leads: monthAverage(historical, 'ad_conversions'),
      cpl: safeRate(
        historical.reduce((total, point) => total + point.ad_cost, 0),
        historical.reduce((total, point) => total + point.ad_conversions, 0),
      ),
      roas: safeRate(
        historical.reduce((total, point) => total + point.ad_revenue, 0),
        historical.reduce((total, point) => total + point.ad_cost, 0),
      ),
      onlineRevenue: monthAverage(historical, 'ga4_revenue'),
    },
    priorYear: priorYearPoint ? {
      engagedSessions: priorYearPoint.ga4_engaged_sessions,
      engagementRate: pointEngagementRate(priorYearPoint),
      leads: priorYearPoint.ad_conversions,
      cpl: pointCpl(priorYearPoint),
      roas: pointRoas(priorYearPoint),
      onlineRevenue: priorYearPoint.ga4_revenue,
    } : null,
    monthly,
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
  ['spartaco-brand-health-v4'],
  { revalidate: 3600 },
);
