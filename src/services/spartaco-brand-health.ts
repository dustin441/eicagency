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
  buildPropertyMonthlySeries,
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
  currentPeriod: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  previousPeriod: {
    engagedSessions: number | null;
    engagementRate: number | null;
    leads: number | null;
    cpl: number | null;
    roas: number | null;
    onlineRevenue: number | null;
  };
  periodCoverage: {
    currentWebsite: number;
    previousWebsite: number;
    currentPaidMedia: number;
    previousPaidMedia: number;
  };
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
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  unassignedEmail: {
    sends: number;
    opens: number;
    clicks: number;
    openRate: number | null;
    clickRate: number | null;
  };
  brands: BrandHealthSummary[];
};

type PropertyGa4DailyRow = {
  brand: SpartacoHealthBrand;
  property_id: string;
  property_timezone: string;
  date: string;
  sessions: number | string;
  engaged_sessions: number | string;
  total_users: number | string;
  total_revenue: number | string;
};

type PropertyGa4PeriodRow = {
  brand: SpartacoHealthBrand;
  property_id: string;
  property_timezone: string;
  period_grain: 'month' | 'rolling_12';
  start_date: string;
  end_date: string;
  sessions: number | string;
  engaged_sessions: number | string;
  total_users: number | string;
  engagement_rate: number | string;
  total_revenue: number | string;
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

function buildProducts(rows: ProductSourceRow[]): BrandHealthProductRow[] {
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
  propertyRows: PropertyGa4DailyRow[],
  propertyPeriodRows: PropertyGa4PeriodRow[],
  monthKeys: string[],
  latestMonth: string,
): BrandHealthSummary {
  const rows = totalRows.filter(row => row.brand === brand);
  const brandProductRows = productRows.filter(row => row.brand === brand);
  const latestRows = rows.filter(row => row.date.startsWith(latestMonth));
  const historicalRows = rows.filter(row => !row.date.startsWith(latestMonth));
  const historicalAdsRows = historicalRows.filter(row => row.source === 'ads');
  const propertyDailyCoverage = buildPropertyMonthlySeries(
    propertyRows.filter(row => row.brand === brand),
    monthKeys,
  );
  const periodByMonth = new Map(
    propertyPeriodRows
      .filter(row => row.brand === brand && row.period_grain === 'month')
      .map(row => [row.start_date.slice(0, 7), row]),
  );
  const propertyMonthly = propertyDailyCoverage.map(coverage => {
    const period = periodByMonth.get(coverage.month);
    const complete = coverage.complete && Boolean(period);
    return {
      ...coverage,
      sessions: complete ? Number(period?.sessions) || 0 : null,
      engagedSessions: complete ? Number(period?.engaged_sessions) || 0 : null,
      totalRevenue: complete ? Number(period?.total_revenue) || 0 : null,
      complete,
    };
  });
  const propertyByMonth = new Map(propertyMonthly.map(point => [point.month, point]));
  const historicalPropertyMonths = propertyMonthly.slice(0, -1).filter(point => point.complete);
  const monthly = completeMonthlySeries(rows, monthKeys).map(point => {
    const propertyPoint = propertyByMonth.get(point.bucket);
    return {
      ...point,
      ga4_sessions: propertyPoint?.complete ? propertyPoint.sessions ?? 0 : 0,
      ga4_engaged_sessions: propertyPoint?.complete ? propertyPoint.engagedSessions ?? 0 : 0,
      ga4_revenue: propertyPoint?.complete ? propertyPoint.totalRevenue ?? 0 : 0,
    };
  });
  const latest = monthly[monthly.length - 1] ?? emptyMonthlyPoint(latestMonth);
  const latestProperty = propertyByMonth.get(latestMonth);
  const priorYearMonth = monthKeys[monthKeys.length - 13];
  const priorYearRows = rows.filter(row => row.date.startsWith(priorYearMonth));
  const priorYearAdsRows = priorYearRows.filter(row => row.source === 'ads');
  const priorYearPoint = monthly.find(point => point.bucket === priorYearMonth)
    ?? emptyMonthlyPoint(priorYearMonth);
  const priorYearProperty = propertyByMonth.get(priorYearMonth);
  const latestSources = new Set(latestRows.map(row => row.source).filter(source => source && source !== 'ga4'));
  if (latestProperty?.complete) latestSources.add('ga4');
  const hasGa4 = latestProperty?.complete === true;
  const hasAds = latestSources.has('ads');
  const sourceLabels: [string, string][] = [
    ['ga4', 'Website analytics'],
    ['ads', 'Paid media'],
    ['email', 'Email'],
    ['gsc', 'Google Search Console'],
    ['social', 'Native social reporting'],
  ];
  const completedWebsiteMonths = propertyMonthly.filter(point => point.complete).map(point => point.month);
  const sourceCoverage = sourceLabels.map(([source, label]) => source === 'ga4'
    ? {
        source,
        label,
        monthsAvailable: completedWebsiteMonths.length,
        monthsExpected: monthKeys.length,
        firstMonth: completedWebsiteMonths[0] ?? null,
        lastMonth: completedWebsiteMonths[completedWebsiteMonths.length - 1] ?? null,
        missingMonths: monthKeys.filter(month => !completedWebsiteMonths.includes(month)),
      }
    : {
        source,
        label,
        ...sourceMonthCoverage(rows.filter(row => row.source === source), monthKeys),
      });
  const monthlySourceAvailability = Object.fromEntries(monthKeys.map(month => [
    month,
    Array.from(new Set([
      ...(propertyByMonth.get(month)?.complete ? ['ga4'] : []),
      rows
        .filter(row => row.date.startsWith(month))
        .map(row => row.source)
        .filter((source): source is string => Boolean(source) && source !== 'ga4'),
    ].flat())),
  ]));
  const averagePropertyMetric = (field: 'engagedSessions' | 'totalRevenue'): number | null =>
    historicalPropertyMonths.length > 0
      ? historicalPropertyMonths.reduce((total, point) => total + (point[field] ?? 0), 0)
        / historicalPropertyMonths.length
      : null;
  const historicalPropertySessions = historicalPropertyMonths.reduce(
    (total, point) => total + (point.sessions ?? 0),
    0,
  );
  const historicalPropertyEngagedSessions = historicalPropertyMonths.reduce(
    (total, point) => total + (point.engagedSessions ?? 0),
    0,
  );
  const previousMonths = monthKeys.slice(0, 12);
  const currentMonths = monthKeys.slice(12);
  const rollingPeriods = propertyPeriodRows.filter(
    row => row.brand === brand && row.period_grain === 'rolling_12',
  );
  const exactPeriod = (months: string[]) => rollingPeriods.find(
    row => row.start_date === `${months[0]}-01`
      && row.end_date.slice(0, 7) === months[months.length - 1],
  );
  const windowMetrics = (months: string[]) => {
    const windowRows = rows.filter(row => months.includes(row.date.slice(0, 7)));
    const adsRows = windowRows.filter(row => row.source === 'ads');
    const websiteCoverage = propertyMonthly.filter(
      point => months.includes(point.month) && point.complete,
    ).length;
    const paidMediaCoverage = sourceMonthCoverage(adsRows, months).monthsAvailable;
    const period = exactPeriod(months);
    const websiteAvailable = websiteCoverage === months.length && Boolean(period);
    const paidMediaAvailable = paidMediaCoverage === months.length;
    const adCost = sum(adsRows, 'ad_cost');
    const adConversions = sum(adsRows, 'ad_conversions');
    const adRevenue = sum(adsRows, 'ad_revenue');

    return {
      metrics: {
        engagedSessions: websiteAvailable ? Number(period?.engaged_sessions) || 0 : null,
        engagementRate: websiteAvailable ? Number(period?.engagement_rate) || 0 : null,
        leads: paidMediaAvailable ? adConversions : null,
        cpl: paidMediaAvailable ? safeRate(adCost, adConversions) : null,
        roas: paidMediaAvailable ? safeRate(adRevenue, adCost) : null,
        onlineRevenue: websiteAvailable ? Number(period?.total_revenue) || 0 : null,
      },
      websiteCoverage,
      paidMediaCoverage,
    };
  };
  const currentPeriod = windowMetrics(currentMonths);
  const previousPeriod = windowMetrics(previousMonths);

  return {
    brand,
    latestMonth,
    latestMonthLabel: monthLabel(latestMonth),
    currentPeriod: currentPeriod.metrics,
    previousPeriod: previousPeriod.metrics,
    periodCoverage: {
      currentWebsite: currentPeriod.websiteCoverage,
      previousWebsite: previousPeriod.websiteCoverage,
      currentPaidMedia: currentPeriod.paidMediaCoverage,
      previousPaidMedia: previousPeriod.paidMediaCoverage,
    },
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
      engagedSessions: averagePropertyMetric('engagedSessions'),
      engagementRate: safeRate(historicalPropertyEngagedSessions, historicalPropertySessions),
      leads: availableMonthAverage(historicalAdsRows, row => numberValue(row, 'ad_conversions')),
      cpl: safeRate(sum(historicalAdsRows, 'ad_cost'), sum(historicalAdsRows, 'ad_conversions')),
      roas: safeRate(sum(historicalAdsRows, 'ad_revenue'), sum(historicalAdsRows, 'ad_cost')),
      onlineRevenue: averagePropertyMetric('totalRevenue'),
    },
    benchmarkCoverage: {
      website: historicalPropertyMonths.length,
      paidMedia: sourceMonthCoverage(historicalAdsRows, monthKeys.slice(0, -1)).monthsAvailable,
    },
    priorYear: {
      engagedSessions: priorYearProperty?.complete ? priorYearProperty.engagedSessions : null,
      engagementRate: priorYearProperty?.complete
        ? safeRate(priorYearProperty.engagedSessions ?? 0, priorYearProperty.sessions ?? 0)
        : null,
      leads: availableSourceTotal(priorYearAdsRows, row => numberValue(row, 'ad_conversions')),
      cpl: priorYearAdsRows.length > 0 ? pointCpl(priorYearPoint) : null,
      roas: priorYearAdsRows.length > 0 ? pointRoas(priorYearPoint) : null,
      onlineRevenue: priorYearProperty?.complete ? priorYearProperty.totalRevenue : null,
    },
    monthly,
    monthlySourceAvailability,
    channels: buildChannels(latestRows, historicalRows),
    products: buildProducts(brandProductRows),
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

async function fetchPropertyGa4Rows(start: string, end: string): Promise<PropertyGa4DailyRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const pageSize = 1000;
  const rows: PropertyGa4DailyRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('spartaco_ga4_property_daily')
      .select('brand,property_id,property_timezone,date,sessions,engaged_sessions,total_users,total_revenue')
      .gte('date', start)
      .lte('date', end)
      .order('brand', { ascending: true })
      .order('date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as PropertyGa4DailyRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchPropertyGa4PeriodRows(): Promise<PropertyGa4PeriodRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const pageSize = 1000;
  const rows: PropertyGa4PeriodRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('spartaco_ga4_property_period')
      .select('brand,property_id,property_timezone,period_grain,start_date,end_date,sessions,engaged_sessions,total_users,engagement_rate,total_revenue')
      .order('brand', { ascending: true })
      .order('start_date', { ascending: true })
      .order('end_date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as PropertyGa4PeriodRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchRows(start: string, end: string): Promise<{
  totals: ProductSourceRow[];
  products: ProductSourceRow[];
  propertyGa4: PropertyGa4DailyRow[];
  propertyGa4Periods: PropertyGa4PeriodRow[];
}> {
  const [totalRows, productRows, propertyGa4, propertyGa4Periods] = await Promise.all([
    fetchRpcRows('spartaco_brand_health_totals_rollup_json', start, end),
    fetchRpcRows('spartaco_brand_health_rollup_json', start, end),
    fetchPropertyGa4Rows(start, end),
    fetchPropertyGa4PeriodRows(),
  ]);

  const totals = totalRows.filter(row => row.brand !== null);

  const products = productRows
    .filter(row => row.brand !== null)
    .map(remapOtherRow)
    .filter((row): row is ProductSourceRow => row !== null)
    .map(applyMondayProduct)
    .filter((row): row is ProductSourceRow => row.brand !== null)
    .filter(row => SPARTACO_HEALTH_BRANDS.includes(row.brand as SpartacoHealthBrand));

  return { totals, products, propertyGa4, propertyGa4Periods };
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
    currentPeriodLabel: `${monthLabel(range.monthKeys[12])} to ${monthLabel(range.monthKeys[23])}`,
    previousPeriodLabel: `${monthLabel(range.monthKeys[0])} to ${monthLabel(range.monthKeys[11])}`,
    unassignedEmail: {
      sends: unassignedEmailSends,
      opens: unassignedEmailOpens,
      clicks: unassignedEmailClicks,
      openRate: safeRate(unassignedEmailOpens, unassignedEmailSends),
      clickRate: safeRate(unassignedEmailClicks, unassignedEmailSends),
    },
    brands: SPARTACO_HEALTH_BRANDS.map(brand =>
      buildBrandSummary(
        brand,
        rows.totals,
        rows.products,
        rows.propertyGa4,
        rows.propertyGa4Periods,
        range.monthKeys,
        range.latestMonth,
      )
    ),
  };
}

export const fetchCachedSpartacoBrandHealth = unstable_cache(
  fetchSpartacoBrandHealth,
  ['spartaco-brand-health-v8-exact-rolling-periods'],
  { revalidate: 3600 },
);
