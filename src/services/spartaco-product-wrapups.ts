import { fetchSpartacoProductData, type ProductPerformanceRow, type ProductTimeSeriesPoint, type TimeSeriesGrain, type TrafficBreakdownRow } from './spartaco-product-analytics';
import { fetchSpartacoMetaAds, type SpartacoFilterParams, type SpartacoMetaAd } from './spartaco-analytics';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export type WrapupPeriodKey = 'before' | 'during' | 'after';

export type SpartacoWrapupConfig = {
  slug: string;
  brand: string;
  product: string;
  parentProduct: string;
  campaignGroupName: string;
  campaignNames: string[];
  sourceMediumPagePaths: string[];
  campaignStart: string;
  campaignEnd: string;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  status: 'Ready for Review' | 'Draft';
  executiveSummary: string;
  canClaim: string[];
  cannotClaim: string[];
  recommendations: string[];
  caveats: string[];
  emailSearchTerms?: string[];
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
  sourceMediumRows: TrafficBreakdownRow[];
  emailDetails: {
    id: number;
    emailId: string | null;
    date: string;
    name: string;
    subjectLine: string;
    totalSent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
    relevance: 'Product-specific' | 'Related Ronin context';
  }[];
  metaAds: SpartacoMetaAd[];
  outcomeAttribution: {
    totalTrackedLeads: number;
    paidTrackedLeads: number;
    nonPaidTrackedLeads: number | null;
    totalOnlineSales: number;
    paidAttributedSales: number;
    totalSessions: number;
    paidSessions: number;
    haloSessions: number;
    totalEngagedSessions: number;
    paidEngagedSessions: number;
    haloEngagedSessions: number;
  };
  emailBenchmark: {
    productSent: number;
    productOpenRate: number;
    productClickRate: number;
    productClicks: number;
    comparableProducts: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  paidOverview: {
    impressions: number;
    clicks: number;
    ctr: number;
    cost: number;
    cpc: number;
    leads: number;
    cpl: number;
    revenue: number;
    purchases: number;
    benchmarkCpl: number | null;
    benchmarkProducts: number;
    cplDelta: number | null;
    cplRank: number | null;
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
    sourceMediumPagePaths: [
      '/lp/ronin-tl-power-ascender-material-handling',
    ],
    campaignStart: '2026-04-23',
    campaignEnd: '2026-05-22',
    beforeStart: '2026-03-26',
    beforeEnd: '2026-04-22',
    afterStart: '2026-05-23',
    afterEnd: '2026-06-19',
    status: 'Ready for Review',
    executiveSummary:
      'The Ronin Material Lifting campaign clearly increased measurable landing-page activity while marketing was live. The campaign generated 215K+ paid impressions, 5.3K+ paid clicks, 138 tracked conversions/leads, 3.3K+ campaign landing-page GA4 sessions, 1.3K+ engaged sessions, and one product-specific Act-On email with 15K+ sends and a 9% click rate during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, GSC, and online sales. The story is before/during/after marketing impact on campaign landing-page attention, traffic, engagement, leads, and online sales — not offline/distributor sales.',
    canClaim: [
      'Paid media created a clear measurable awareness and traffic lift while the campaign was live.',
      'Campaign landing-page sessions and engaged sessions increased during the campaign period.',
      'Tracked leads/conversions occurred while media was active.',
      'Act-On email added a measurable owned-channel touchpoint for the product campaign.',
      'Campaign landing-page traffic dropped back down after the campaign ended, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as before/during/after marketing impact: more eyeballs, more traffic, more engaged sessions, tracked leads, and online sales where available.',
      'For future product campaigns, keep campaign, email, social, and landing-page naming consistent so product attribution stays automatic.',
      'If Act-On creative links or email HTML become available later, add direct preview links; for now, show subject-line context plus performance by email.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
      'Act-On and social attribution require consistent product naming/tagging; missing attributed rows should be treated as a data-coverage caveat, not proof that those channels did nothing.',
    ],
  },
  {
    slug: 'huskie-new-cutting-tools-2026-01-07',
    brand: 'Huskie',
    product: 'New Cutting Tools',
    parentProduct: 'New Cutting Tools',
    campaignGroupName: 'Huskie New Cutting Tools — Jan/Feb 2026',
    campaignNames: [
      '[LEAD] 01-26: Huskie New Cutting Tools',
      '[LEAD] P.Max | 01-26: Huskie New Cutting Tools',
    ],
    sourceMediumPagePaths: [
      '/lp/new-cutting-tools',
    ],
    campaignStart: '2026-01-27',
    campaignEnd: '2026-02-20',
    beforeStart: '2025-12-30',
    beforeEnd: '2026-01-26',
    afterStart: '2026-02-21',
    afterEnd: '2026-03-20',
    status: 'Draft',
    executiveSummary:
      'The Huskie New Cutting Tools campaign increased measurable digital demand for the campaign landing page and product-specific lead activity while marketing was live. The campaign generated 320K+ paid impressions, 5.6K+ paid clicks, 541 tracked leads/conversions, 412 campaign landing-page GA4 sessions, 260 engaged sessions, and one product-specific Act-On email with 6K+ sends during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, GSC, social, and online sales. The story is marketing-driven awareness, traffic, engagement, and lead activity — not offline/distributor sales.',
    canClaim: [
      'Paid media increased measurable reach, clicks, and tracked lead activity for the campaign.',
      'Campaign landing-page sessions and engaged sessions increased during the campaign period versus the post-campaign window.',
      'The campaign generated product-specific tracked leads/conversions while media was active.',
      'Act-On email added a measurable owned-channel touchpoint for the product campaign.',
      'Paid activity and tracked leads dropped materially after the campaign window, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a scaled demand-generation campaign: paid reach, clicks, tracked leads, landing-page engagement, and email support.',
      'For future Huskie launches, keep Monday item names, ad campaign names, email names, and landing-page URLs aligned so product attribution stays automatic.',
      'Continue breaking out Monday-aligned product launches from broader product categories when the campaign has its own dedicated landing page and creative set.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'The campaign had some related cutting/crimp activity before the confirmed Monday window, so the story is lift/scale versus an existing baseline rather than starting from zero.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['New Cutting Tools', 'new cutting tool', 'new cutters'],
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekStartKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoDate(d);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function bucketFor(dateStr: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') return dateStr;
  if (grain === 'week') return weekStartKey(dateStr);
  return monthKey(dateStr);
}

function bucketLabel(bucket: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') {
    const d = new Date(`${bucket}T00:00:00Z`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  if (grain === 'week') {
    const d = new Date(`${bucket}T00:00:00Z`);
    return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const [yr, mo] = bucket.split('-');
  const d = new Date(Date.UTC(Number(yr), Number(mo) - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function emptyTimeSeriesPoint(bucket: string, grain: TimeSeriesGrain): ProductTimeSeriesPoint {
  return {
    bucket,
    label: bucketLabel(bucket, grain),
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

function fillTimeSeriesWindow(
  points: ProductTimeSeriesPoint[],
  grain: TimeSeriesGrain,
  start: string,
  end: string
): ProductTimeSeriesPoint[] {
  const byBucket = new Map(points.map((point) => [point.bucket, point]));
  const buckets: string[] = [];
  let cursor = new Date(`${bucketFor(start, grain)}${grain === 'month' ? '-01' : ''}T00:00:00Z`);
  const endBucket = bucketFor(end, grain);

  while (true) {
    const bucket = grain === 'month' ? isoDate(cursor).slice(0, 7) : isoDate(cursor);
    buckets.push(bucket);
    if (bucket === endBucket) break;
    if (grain === 'day') cursor = addDays(cursor, 1);
    else if (grain === 'week') cursor = addDays(cursor, 7);
    else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return buckets.map((bucket) => byBucket.get(bucket) ?? emptyTimeSeriesPoint(bucket, grain));
}

const PAID_CHANNEL_GROUPS = new Set([
  'Cross-network',
  'Paid Search',
  'Paid Social',
  'Paid Shopping',
  'Paid Video',
  'Display',
]);

function isPaidChannelGroup(label: string): boolean {
  return PAID_CHANNEL_GROUPS.has(label) || label.toLowerCase().includes('paid');
}

type WrapupGa4SourceRow = {
  date?: string | null;
  ga4_source: string | null;
  ga4_medium: string | null;
  ga4_default_channel_group: string | null;
  ga4_pageviews?: number | null;
  ga4_total_users?: number | null;
  ga4_sessions: number | null;
  ga4_engaged_sessions: number | null;
  ga4_purchases: number | null;
  ga4_total_revenue: number | null;
  ga4_add_to_carts: number | null;
  ga4_checkouts?: number | null;
};

type ActOnEmailRow = {
  id: number;
  email_id: string | null;
  email_name: string | null;
  subject_line: string | null;
  total_sent: number | null;
  opens: number | null;
  clicks: number | null;
  open_rate: number | null;
  click_rate: number | null;
  report_date: string | null;
};

function sourceMediumKey(source: string | null, medium: string | null) {
  const s = source || '(direct)';
  const m = medium || '(none)';
  return `${s} / ${m}`;
}

async function fetchLandingPageGa4Rows(
  config: SpartacoWrapupConfig,
  start: string,
  end: string
): Promise<WrapupGa4SourceRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const pagePathFilter = config.sourceMediumPagePaths.map((path) => `page_path.eq.${path}`).join(',');
  const { data, error } = await supabase
    .from('spartaco_master_products')
    .select('date,ga4_source,ga4_medium,ga4_default_channel_group,ga4_sessions,ga4_engaged_sessions,ga4_pageviews,ga4_total_users,ga4_purchases,ga4_total_revenue,ga4_add_to_carts,ga4_checkouts')
    .eq('source', 'ga4')
    .gte('date', start)
    .lte('date', end)
    .or(pagePathFilter)
    .limit(10000);

  if (error) throw error;
  return (data ?? []) as WrapupGa4SourceRow[];
}

function summarizeLandingPageGa4(rows: WrapupGa4SourceRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.ga4_sessions += Number(row.ga4_sessions) || 0;
      acc.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
      acc.ga4_pageviews += Number(row.ga4_pageviews) || 0;
      acc.ga4_total_users += Number(row.ga4_total_users) || 0;
      acc.ga4_purchases += Number(row.ga4_purchases) || 0;
      acc.ga4_total_revenue += Number(row.ga4_total_revenue) || 0;
      acc.ga4_add_to_carts += Number(row.ga4_add_to_carts) || 0;
      acc.ga4_checkouts += Number(row.ga4_checkouts) || 0;
      return acc;
    },
    {
      ga4_sessions: 0,
      ga4_engaged_sessions: 0,
      ga4_pageviews: 0,
      ga4_total_users: 0,
      ga4_purchases: 0,
      ga4_total_revenue: 0,
      ga4_add_to_carts: 0,
      ga4_checkouts: 0,
    }
  );
}

function zeroPaidMetrics(summary: ProductPerformanceRow): ProductPerformanceRow {
  return {
    ...summary,
    ad_impressions: 0,
    ad_clicks: 0,
    ad_cost: 0,
    ad_purchases: 0,
    ad_revenue: 0,
  };
}

function zeroPaidMetricsOutsideCampaign(
  points: ProductTimeSeriesPoint[],
  config: SpartacoWrapupConfig,
  grain: TimeSeriesGrain,
): ProductTimeSeriesPoint[] {
  return points.map((point) => {
    const start = new Date(`${point.bucket}${grain === 'month' ? '-01' : ''}T00:00:00Z`);
    const end = grain === 'day'
      ? start
      : grain === 'week'
        ? addDays(start, 6)
        : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const campaignStart = new Date(`${config.campaignStart}T00:00:00Z`);
    const campaignEnd = new Date(`${config.campaignEnd}T00:00:00Z`);
    const outsideCampaign = end < campaignStart || start > campaignEnd;
    if (!outsideCampaign) return point;
    return {
      ...point,
      ad_impressions: 0,
      ad_clicks: 0,
      ad_cost: 0,
      ad_purchases: 0,
      ad_revenue: 0,
      ad_roas: 0,
      ad_cpl: 0,
    };
  });
}

function withLandingPageGa4(summary: ProductPerformanceRow, rows: WrapupGa4SourceRow[]): ProductPerformanceRow {
  return {
    ...summary,
    ...summarizeLandingPageGa4(rows),
  };
}

function buildLandingPageGa4TimeSeries(
  rows: WrapupGa4SourceRow[],
  grain: TimeSeriesGrain
): Map<string, Pick<ProductTimeSeriesPoint, 'ga4_sessions' | 'ga4_engaged_sessions' | 'ga4_purchases' | 'ga4_revenue'>> {
  const buckets = new Map<string, { sessions: number; engaged: number; purchases: number; revenue: number }>();
  for (const row of rows) {
    if (!row.date) continue;
    const bucket = bucketFor(row.date, grain);
    const existing = buckets.get(bucket) ?? { sessions: 0, engaged: 0, purchases: 0, revenue: 0 };
    existing.sessions += Number(row.ga4_sessions) || 0;
    existing.engaged += Number(row.ga4_engaged_sessions) || 0;
    existing.purchases += Number(row.ga4_purchases) || 0;
    existing.revenue += Number(row.ga4_total_revenue) || 0;
    buckets.set(bucket, existing);
  }

  return new Map(
    Array.from(buckets.entries()).map(([bucket, values]) => [
      bucket,
      {
        ga4_sessions: values.sessions,
        ga4_engaged_sessions: values.engaged,
        ga4_purchases: values.purchases,
        ga4_revenue: values.revenue,
      },
    ])
  );
}

function mergeLandingPageGa4TimeSeries(
  points: ProductTimeSeriesPoint[],
  landingPageGa4ByBucket: Map<string, Pick<ProductTimeSeriesPoint, 'ga4_sessions' | 'ga4_engaged_sessions' | 'ga4_purchases' | 'ga4_revenue'>>
) {
  return points.map((point) => ({
    ...point,
    ga4_sessions: landingPageGa4ByBucket.get(point.bucket)?.ga4_sessions ?? 0,
    ga4_engaged_sessions: landingPageGa4ByBucket.get(point.bucket)?.ga4_engaged_sessions ?? 0,
    ga4_purchases: landingPageGa4ByBucket.get(point.bucket)?.ga4_purchases ?? 0,
    ga4_revenue: landingPageGa4ByBucket.get(point.bucket)?.ga4_revenue ?? 0,
  }));
}

function isRelevantWrapupEmail(config: SpartacoWrapupConfig, row: Pick<ActOnEmailRow, 'email_name' | 'subject_line'>): boolean {
  const searchable = `${row.email_name ?? ''} ${row.subject_line ?? ''}`.toLowerCase();
  const terms = config.emailSearchTerms ?? ['material handling', 'material lifting', 'material', 'lift', 'lifts', 'lifting', 'power ascender', 'titan lift', 'ronin-lift'];
  return terms.some((term) => searchable.includes(term.toLowerCase()));
}

function emailSearchOrFilter(config: SpartacoWrapupConfig): string {
  const terms = config.emailSearchTerms ?? ['Material', 'Lift', 'Handling', 'Ascender', 'Titan'];
  return terms
    .flatMap((term) => [`email_name.ilike.%${term}%`, `subject_line.ilike.%${term}%`])
    .join(',');
}

async function buildEmailDetails(config: SpartacoWrapupConfig) {
  const supabase = createSpartacoSupabaseClient();
  const { data, error } = await supabase
    .from('act_on_emails')
    .select('id,email_id,email_name,subject_line,total_sent,opens,clicks,open_rate,click_rate,report_date')
    .gte('report_date', config.beforeStart)
    .lte('report_date', config.afterEnd)
    .or(emailSearchOrFilter(config))
    .order('report_date', { ascending: true })
    .limit(25);

  if (error) throw error;

  return ((data ?? []) as ActOnEmailRow[])
    .filter((row) => row.report_date)
    .filter((row) => isRelevantWrapupEmail(config, row))
    .map((row) => {
      const name = row.email_name ?? 'Untitled email';
      const subjectLine = row.subject_line ?? name;
      return {
        id: row.id,
        emailId: row.email_id,
        date: row.report_date!,
        name,
        subjectLine,
        totalSent: Number(row.total_sent) || 0,
        opens: Number(row.opens) || 0,
        clicks: Number(row.clicks) || 0,
        openRate: Number(row.open_rate) ? Number(row.open_rate) / 100 : 0,
        clickRate: Number(row.click_rate) ? Number(row.click_rate) / 100 : 0,
        relevance: 'Product-specific' as const,
      };
    })
    .sort((a, b) => b.totalSent - a.totalSent);
}

async function buildComprehensiveSourceMediumRows(
  config: SpartacoWrapupConfig,
  paidLeadRows: TrafficBreakdownRow[]
): Promise<TrafficBreakdownRow[]> {
  const data = await fetchLandingPageGa4Rows(config, config.campaignStart, config.campaignEnd);

  type Acc = TrafficBreakdownRow;
  const rows = new Map<string, Acc>();

  for (const row of data) {
    const key = sourceMediumKey(row.ga4_source, row.ga4_medium);
    if (!key) continue;
    const [label, sublabel] = key.split(' / ');
    const existing = rows.get(key) ?? {
      label,
      sublabel,
      channelGroup: row.ga4_default_channel_group ?? undefined,
      ga4_sessions: 0,
      prev_sessions: 0,
      ga4_engaged_sessions: 0,
      prev_engaged: 0,
      tracked_leads: 0,
      prev_tracked_leads: 0,
      ga4_purchases: 0,
      prev_purchases: 0,
      ga4_total_revenue: 0,
      prev_revenue: 0,
      ga4_add_to_carts: 0,
      prev_carts: 0,
    };
    existing.ga4_sessions += Number(row.ga4_sessions) || 0;
    existing.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
    existing.ga4_purchases += Number(row.ga4_purchases) || 0;
    existing.ga4_total_revenue += Number(row.ga4_total_revenue) || 0;
    existing.ga4_add_to_carts += Number(row.ga4_add_to_carts) || 0;
    rows.set(key, existing);
  }

  // Merge paid lead/conversion counts from the product attribution layer into the
  // comprehensive GA4 source/medium table. This preserves organic/direct/referral
  // traffic while still showing the known paid outcomes by source.
  for (const paid of paidLeadRows) {
    if (!paid.tracked_leads) continue;
    const key = `${paid.label} / ${paid.sublabel ?? '(none)'}`;
    const existing = rows.get(key) ?? {
      label: paid.label,
      sublabel: paid.sublabel,
      channelGroup: paid.channelGroup,
      ga4_sessions: 0,
      prev_sessions: 0,
      ga4_engaged_sessions: 0,
      prev_engaged: 0,
      tracked_leads: 0,
      prev_tracked_leads: 0,
      ga4_purchases: 0,
      prev_purchases: 0,
      ga4_total_revenue: 0,
      prev_revenue: 0,
      ga4_add_to_carts: 0,
      prev_carts: 0,
    };
    existing.tracked_leads += paid.tracked_leads;
    existing.channelGroup = existing.channelGroup ?? paid.channelGroup;
    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((a, b) => {
    const aScore = a.ga4_sessions + a.tracked_leads;
    const bScore = b.ga4_sessions + b.tracked_leads;
    return bScore - aScore;
  });
}

function buildOutcomeAttribution(
  duringData: Awaited<ReturnType<typeof fetchSpartacoProductData>>,
  duringSummary: ProductPerformanceRow,
  sourceMediumRows: TrafficBreakdownRow[]
) {
  const paidTrafficRows = sourceMediumRows.filter((row) => isPaidChannelGroup(row.channelGroup ?? row.label));
  const paidSessions = paidTrafficRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  const paidEngagedSessions = paidTrafficRows.reduce((sum, row) => sum + row.ga4_engaged_sessions, 0);

  return {
    totalTrackedLeads: duringData.summary.ad_conversions,
    paidTrackedLeads: duringData.summary.ad_conversions,
    nonPaidTrackedLeads: null,
    totalOnlineSales: duringSummary.ga4_purchases,
    paidAttributedSales: duringData.summary.ad_purchases,
    totalSessions: duringSummary.ga4_sessions,
    paidSessions,
    haloSessions: Math.max(0, duringSummary.ga4_sessions - paidSessions),
    totalEngagedSessions: duringSummary.ga4_engaged_sessions,
    paidEngagedSessions,
    haloEngagedSessions: Math.max(0, duringSummary.ga4_engaged_sessions - paidEngagedSessions),
  };
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

async function buildPaidOverview(config: SpartacoWrapupConfig, during: ProductPerformanceRow) {
  const allProducts = await fetchSpartacoProductData({
    ...BASE_PARAMS,
    brand: 'all',
    product: 'all',
    start: config.campaignStart,
    end: config.campaignEnd,
    compStart: config.beforeStart,
    compEnd: config.beforeEnd,
  });

  const comparableProducts = allProducts.productRows
    .filter((row) => row.product !== config.product)
    .filter((row) => row.ad_cost > 0 && row.ad_conversions > 0);
  const benchmarkCost = comparableProducts.reduce((sum, row) => sum + row.ad_cost, 0);
  const benchmarkLeads = comparableProducts.reduce((sum, row) => sum + row.ad_conversions, 0);
  const benchmarkCpl = benchmarkLeads > 0 ? benchmarkCost / benchmarkLeads : null;
  const cpl = during.ad_conversions > 0 ? during.ad_cost / during.ad_conversions : 0;
  const cplRankedProducts = allProducts.productRows
    .filter((row) => row.ad_cost > 0 && row.ad_conversions > 0)
    .map((row) => ({ product: row.product, cpl: row.ad_cost / row.ad_conversions }))
    .sort((a, b) => a.cpl - b.cpl);
  const cplRank = cplRankedProducts.findIndex((row) => row.product === config.product);

  return {
    impressions: during.ad_impressions,
    clicks: during.ad_clicks,
    ctr: during.ad_impressions > 0 ? during.ad_clicks / during.ad_impressions : 0,
    cost: during.ad_cost,
    cpc: during.ad_clicks > 0 ? during.ad_cost / during.ad_clicks : 0,
    leads: during.ad_conversions,
    cpl,
    revenue: during.ad_revenue,
    purchases: during.ad_purchases,
    benchmarkCpl,
    benchmarkProducts: comparableProducts.length,
    cplDelta: benchmarkCpl && cpl > 0 ? (cpl - benchmarkCpl) / benchmarkCpl : null,
    cplRank: cplRank >= 0 ? cplRank + 1 : null,
  };
}

export function getSpartacoWrapup(slug: string): SpartacoWrapupConfig | null {
  return SPARTACO_WRAPUPS.find((wrapup) => wrapup.slug === slug) ?? null;
}

export async function fetchSpartacoProductWrapup(slug: string): Promise<SpartacoProductWrapup | null> {
  const config = getSpartacoWrapup(slug);
  if (!config) return null;

  const fullWindowParams = paramsFor(config, config.beforeStart, config.afterEnd);

  const [beforeData, duringData, afterData, fullWindowData, emailBenchmark, emailDetails, metaAdsByBrand, beforeLandingGa4, duringLandingGa4, afterLandingGa4, fullWindowLandingGa4] = await Promise.all([
    fetchSpartacoProductData(paramsFor(config, config.beforeStart, config.beforeEnd)),
    fetchSpartacoProductData(paramsFor(config, config.campaignStart, config.campaignEnd)),
    fetchSpartacoProductData(paramsFor(config, config.afterStart, config.afterEnd)),
    fetchSpartacoProductData(fullWindowParams),
    buildEmailBenchmark(config),
    buildEmailDetails(config),
    fetchSpartacoMetaAds({
      mode: 'ALL',
      params: fullWindowParams,
      campaignNames: config.campaignNames,
    }),
    fetchLandingPageGa4Rows(config, config.beforeStart, config.beforeEnd),
    fetchLandingPageGa4Rows(config, config.campaignStart, config.campaignEnd),
    fetchLandingPageGa4Rows(config, config.afterStart, config.afterEnd),
    fetchLandingPageGa4Rows(config, config.beforeStart, config.afterEnd),
  ]);

  const before = zeroPaidMetrics(withLandingPageGa4(beforeData.summary, beforeLandingGa4));
  const during = withLandingPageGa4(duringData.summary, duringLandingGa4);
  const after = zeroPaidMetrics(withLandingPageGa4(afterData.summary, afterLandingGa4));
  const [sourceMediumRows, paidOverview] = await Promise.all([
    buildComprehensiveSourceMediumRows(config, duringData.sourceMediumRows),
    buildPaidOverview(config, during),
  ]);
  const fullWindowTimeSeries = zeroPaidMetricsOutsideCampaign(fillTimeSeriesWindow(
    fullWindowData.timeSeries,
    fullWindowData.timeSeriesGrain,
    config.beforeStart,
    config.afterEnd
  ), config, fullWindowData.timeSeriesGrain);
  const landingPageGa4TimeSeries = buildLandingPageGa4TimeSeries(fullWindowLandingGa4, fullWindowData.timeSeriesGrain);

  return {
    config,
    periods: [
      { key: 'before', label: '4w Before', start: config.beforeStart, end: config.beforeEnd, summary: before },
      { key: 'during', label: 'Campaign Period', start: config.campaignStart, end: config.campaignEnd, summary: during },
      { key: 'after', label: '4w After', start: config.afterStart, end: config.afterEnd, summary: after },
    ],
    fullWindowTimeSeries: mergeLandingPageGa4TimeSeries(fullWindowTimeSeries, landingPageGa4TimeSeries),
    fullWindowTimeSeriesGrain: fullWindowData.timeSeriesGrain,
    sourceMediumRows,
    emailDetails: emailDetails.slice(0, 6),
    metaAds: metaAdsByBrand[config.brand] ?? [],
    outcomeAttribution: buildOutcomeAttribution(duringData, during, sourceMediumRows),
    emailBenchmark,
    paidOverview,
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
