import { fetchSpartacoProductData, type ProductPerformanceRow, type ProductTimeSeriesPoint, type TimeSeriesGrain } from './spartaco-product-analytics';
import { fetchSpartacoMetaAds, type SpartacoFilterParams, type SpartacoMetaAd } from './spartaco-analytics';

export type WrapupPeriodKey = 'before' | 'during' | 'after';

export type SpartacoWrapupConfig = {
  slug: string;
  brand: string;
  product: string;
  parentProduct: string;
  campaignGroupName: string;
  campaignNames: string[];
  campaignStart: string;
  campaignEnd: string;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  status: 'Ready for Bob Review' | 'Draft' | 'Needs Bob Context';
  executiveSummary: string;
  canClaim: string[];
  cannotClaim: string[];
  recommendations: string[];
  bobPrompts: string[];
  caveats: string[];
};

export type WrapupPeriod = {
  key: WrapupPeriodKey;
  label: string;
  start: string;
  end: string;
  summary: ProductPerformanceRow;
};

export type SpartacoProductWrapup = {
  config: SpartacoWrapupConfig;
  periods: WrapupPeriod[];
  fullWindowTimeSeries: ProductTimeSeriesPoint[];
  fullWindowTimeSeriesGrain: TimeSeriesGrain;
  metaAds: SpartacoMetaAd[];
  emailBenchmark: {
    productSent: number;
    productOpenRate: number;
    productClickRate: number;
    productClicks: number;
    comparableProducts: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  gscLift: {
    duringVsBeforeImpressions: number | null;
    afterVsDuringImpressions: number | null;
    duringVsBeforeClicks: number | null;
    afterVsDuringClicks: number | null;
    duringVsBeforeKeywords: number | null;
    afterVsDuringKeywords: number | null;
  };
};

const BASE_PARAMS: Omit<SpartacoFilterParams, 'start' | 'end' | 'compStart' | 'compEnd'> = {
  channel: 'all',
  brand: 'Ronin',
  campaign: 'all',
  focus: 'all',
  product: 'Material Lifting',
  channelGroup: 'all',
  sourceMedium: 'all',
};

export const SPARTACO_WRAPUPS: SpartacoWrapupConfig[] = [
  {
    slug: 'ronin-material-lifting-2026-04-23',
    brand: 'Ronin',
    product: 'Material Lifting',
    parentProduct: 'Material Lifting',
    campaignGroupName: 'Ronin Material Lifting — Apr/May 2026',
    campaignNames: [
      '[LEAD] 4-20: Ronin-Material Lifting',
      '[SALES] 4-20: Ronin-Material Lifting',
    ],
    campaignStart: '2026-04-23',
    campaignEnd: '2026-05-22',
    beforeStart: '2026-03-26',
    beforeEnd: '2026-04-22',
    afterStart: '2026-05-23',
    afterEnd: '2026-06-19',
    status: 'Ready for Bob Review',
    executiveSummary:
      'The Ronin Material Lifting campaign clearly increased measurable product attention while ads were live. The campaign generated 215K+ paid impressions, 5.3K+ paid clicks, 138 tracked conversions/leads, 890 GA4 sessions, and 393 engaged sessions during the campaign window. Because EIC currently has GA4, Act-On, GSC, and ad-platform data — but not total distributor/offline sales — this should be framed as a strong activity and engagement lift, then paired with Bob’s internal sales context before making final sales-impact claims.',
    canClaim: [
      'Paid media created a clear measurable awareness/traffic lift while the campaign was live.',
      'Product traffic and engaged sessions increased sharply during the campaign period.',
      'Tracked leads/conversions occurred while media was active.',
      'Product traffic dropped back down after the campaign ended, which supports the “ads on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Sales causation without Bob adding internal sales, quote, distributor, or sales-team feedback.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Pair the digital activity lift with Bob’s sales-side context before finalizing the causation narrative.',
      'For the next Material Lifting run, validate lead quality and downstream sales outcomes so the next wrap-up can move from “activity lift” toward “business impact.”',
      'Keep campaign/email/social naming consistent so product attribution stays automatic.',
    ],
    bobPrompts: [
      'Did distributor or offline sales increase during or shortly after the campaign?',
      'Were there quote requests, demo requests, or sales conversations tied to Material Lifting?',
      'Did the sales team report better awareness or higher-quality conversations during the flight?',
      'Were there external factors we should mention: promo, inventory, pricing, seasonality, tradeshow, sales push, or relaunch timing?',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current data set does not include full offline/distributor sales.',
      'Act-On and social attribution require consistent product naming/tagging; missing attributed rows should be treated as a data-coverage caveat, not proof that those channels did nothing.',
    ],
  },
];

function paramsFor(config: SpartacoWrapupConfig, start: string, end: string): SpartacoFilterParams {
  return {
    ...BASE_PARAMS,
    brand: config.brand,
    product: config.product,
    start,
    end,
    // comp values are required by the existing product fetcher but ignored by this wrap-up period summary.
    compStart: start,
    compEnd: end,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

function openRate(row: ProductPerformanceRow): number {
  return row.email_total_sent > 0 ? row.email_opens / row.email_total_sent : 0;
}

function clickRate(row: ProductPerformanceRow): number {
  return row.email_total_sent > 0 ? row.email_clicks / row.email_total_sent : 0;
}

async function buildEmailBenchmark(config: SpartacoWrapupConfig) {
  const allProducts = await fetchSpartacoProductData({
    ...BASE_PARAMS,
    brand: config.brand,
    product: 'all',
    start: config.campaignStart,
    end: config.campaignEnd,
    compStart: config.beforeStart,
    compEnd: config.beforeEnd,
  });

  const comparable = allProducts.productRows.filter((row) => row.email_total_sent > 0);
  const sent = comparable.reduce((sum, row) => sum + row.email_total_sent, 0);
  const opens = comparable.reduce((sum, row) => sum + row.email_opens, 0);
  const clicks = comparable.reduce((sum, row) => sum + row.email_clicks, 0);

  const product = allProducts.productRows.find((row) => row.product === config.product);

  return {
    productSent: product?.email_total_sent ?? 0,
    productOpenRate: product ? openRate(product) : 0,
    productClickRate: product ? clickRate(product) : 0,
    productClicks: product?.email_clicks ?? 0,
    comparableProducts: comparable.length,
    avgOpenRate: sent > 0 ? opens / sent : 0,
    avgClickRate: sent > 0 ? clicks / sent : 0,
  };
}

export function getSpartacoWrapup(slug: string): SpartacoWrapupConfig | null {
  return SPARTACO_WRAPUPS.find((wrapup) => wrapup.slug === slug) ?? null;
}

export async function fetchSpartacoProductWrapup(slug: string): Promise<SpartacoProductWrapup | null> {
  const config = getSpartacoWrapup(slug);
  if (!config) return null;

  const fullWindowParams = paramsFor(config, config.beforeStart, config.afterEnd);

  const [beforeData, duringData, afterData, fullWindowData, emailBenchmark, metaAdsByBrand] = await Promise.all([
    fetchSpartacoProductData(paramsFor(config, config.beforeStart, config.beforeEnd)),
    fetchSpartacoProductData(paramsFor(config, config.campaignStart, config.campaignEnd)),
    fetchSpartacoProductData(paramsFor(config, config.afterStart, config.afterEnd)),
    fetchSpartacoProductData(fullWindowParams),
    buildEmailBenchmark(config),
    fetchSpartacoMetaAds({
      mode: 'ALL',
      params: fullWindowParams,
      campaignNames: config.campaignNames,
    }),
  ]);

  const before = beforeData.summary;
  const during = duringData.summary;
  const after = afterData.summary;

  return {
    config,
    periods: [
      { key: 'before', label: '4w Before', start: config.beforeStart, end: config.beforeEnd, summary: before },
      { key: 'during', label: 'Campaign Period', start: config.campaignStart, end: config.campaignEnd, summary: during },
      { key: 'after', label: '4w After', start: config.afterStart, end: config.afterEnd, summary: after },
    ],
    fullWindowTimeSeries: fullWindowData.timeSeries,
    fullWindowTimeSeriesGrain: fullWindowData.timeSeriesGrain,
    metaAds: metaAdsByBrand[config.brand] ?? [],
    emailBenchmark,
    gscLift: {
      duringVsBeforeImpressions: pctChange(during.gsc_impressions, before.gsc_impressions),
      afterVsDuringImpressions: pctChange(after.gsc_impressions, during.gsc_impressions),
      duringVsBeforeClicks: pctChange(during.gsc_clicks, before.gsc_clicks),
      afterVsDuringClicks: pctChange(after.gsc_clicks, during.gsc_clicks),
      duringVsBeforeKeywords: pctChange(during.gsc_keywords_ranked, before.gsc_keywords_ranked),
      afterVsDuringKeywords: pctChange(after.gsc_keywords_ranked, during.gsc_keywords_ranked),
    },
  };
}
