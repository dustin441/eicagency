import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { daysBetween } from '@/lib/date-utils';
import type { SpartacoFilterParams } from './spartaco-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductPerformanceRow = {
  product: string;
  brand: string;
  // Ads
  ad_impressions: number;
  ad_clicks: number;
  ad_cost: number;
  ad_conversions: number;
  ad_purchases: number;
  ad_revenue: number;
  // GA4
  ga4_sessions: number;
  ga4_engaged_sessions: number;
  ga4_pageviews: number;
  ga4_total_users: number;
  ga4_purchases: number;
  ga4_total_revenue: number;
  ga4_add_to_carts: number;
  ga4_checkouts: number;
  // Email
  email_total_sent: number;
  email_opens: number;
  email_clicks: number;
  // GSC
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_avg_position: number;   // weighted average: SUM(impressions×position) / SUM(impressions)
  gsc_keywords_ranked: number; // COUNT(DISTINCT gsc_query) per product
  // Social
  social_impressions: number;
  social_engagement: number;
  social_interactions: number;
  social_post_count: number;  // COUNT(DISTINCT social_post_id) per product
};

export type TimeSeriesGrain = 'day' | 'week' | 'month';

export type ProductTimeSeriesPoint = {
  bucket: string;
  label: string;
  ad_cost: number;
  ad_revenue: number;
  ad_roas: number;
  ad_purchases: number;
  ga4_sessions: number;
  ga4_purchases: number;
  ga4_revenue: number;
  gsc_clicks: number;
  email_opens: number;
  social_engagement: number;
};

export type TrafficBreakdownRow = {
  label: string;
  sublabel?: string;
  channelGroup?: string;
  ga4_sessions: number;
  prev_sessions: number;
  ga4_engaged_sessions: number;
  prev_engaged: number;
  ga4_purchases: number;
  prev_purchases: number;
  ga4_total_revenue: number;
  prev_revenue: number;
  ga4_add_to_carts: number;
  prev_carts: number;
};

export type ProductDashboardData = {
  filterParams: SpartacoFilterParams;
  summary: ProductPerformanceRow;
  previousSummary: ProductPerformanceRow;
  productRows: ProductPerformanceRow[];
  previousProductRows: ProductPerformanceRow[];
  channelGroupRows: TrafficBreakdownRow[];
  sourceMediumRows: TrafficBreakdownRow[];
  timeSeries: ProductTimeSeriesPoint[];
  timeSeriesGrain: TimeSeriesGrain;
  filterOptions: {
    brands: string[];
    products: string[];
    channelGroups: string[];
    sourceMediums: string[];
  };
};

type ProductSourceRow = {
  date: string;
  brand: string | null;
  product: string | null;
  ad_impressions: number | null;
  ad_clicks: number | null;
  ad_cost: number | null;
  ad_conversions: number | null;
  ad_purchases: number | null;
  ad_revenue: number | null;
  ga4_sessions: number | null;
  ga4_engaged_sessions: number | null;
  ga4_pageviews: number | null;
  ga4_total_users: number | null;
  ga4_purchases: number | null;
  ga4_total_revenue: number | null;
  ga4_add_to_carts: number | null;
  ga4_checkouts: number | null;
  email_total_sent: number | null;
  email_opens: number | null;
  email_clicks: number | null;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_position: number | null;
  gsc_query: string | null;
  ga4_source: string | null;
  ga4_medium: string | null;
  ga4_default_channel_group: string | null;
  social_impressions: number | null;
  social_engagement: number | null;
  social_interactions: number | null;
  social_post_id: string | null;
};

const PRODUCT_SELECT = [
  'date',
  'brand',
  'product',
  'ad_impressions',
  'ad_clicks',
  'ad_cost',
  'ad_conversions',
  'ad_purchases',
  'ad_revenue',
  'ga4_sessions',
  'ga4_engaged_sessions',
  'ga4_pageviews',
  'ga4_total_users',
  'ga4_purchases',
  'ga4_total_revenue',
  'ga4_add_to_carts',
  'ga4_checkouts',
  'email_total_sent',
  'email_opens',
  'email_clicks',
  'gsc_clicks',
  'gsc_impressions',
  'gsc_position',
  'gsc_query',
  'social_impressions',
  'social_engagement',
  'social_interactions',
  'social_post_id',
  'ga4_source',
  'ga4_medium',
  'ga4_default_channel_group',
].join(',');

const SUPABASE_PAGE_SIZE = 1000;
type EqQuery<T> = { eq(column: string, value: string): T };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_ROW: ProductPerformanceRow = {
  product: 'Total', brand: 'Total',
  ad_impressions: 0, ad_clicks: 0, ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
  ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
  ga4_purchases: 0, ga4_total_revenue: 0, ga4_add_to_carts: 0, ga4_checkouts: 0,
  email_total_sent: 0, email_opens: 0, email_clicks: 0,
  gsc_clicks: 0, gsc_impressions: 0, gsc_avg_position: 0, gsc_keywords_ranked: 0,
  social_impressions: 0, social_engagement: 0, social_interactions: 0, social_post_count: 0,
};

/**
 * Sum all rows into a single summary row.
 * gsc_avg_position uses impressions-weighted average.
 * gsc_keywords_ranked and social_post_count are summed (acceptable at merge level).
 */
function summarize(rows: ProductPerformanceRow[]): ProductPerformanceRow {
  const acc = { ...EMPTY_ROW };
  for (const row of rows) {
    acc.ad_impressions       += Number(row.ad_impressions)       || 0;
    acc.ad_clicks            += Number(row.ad_clicks)            || 0;
    acc.ad_cost              += Number(row.ad_cost)              || 0;
    acc.ad_conversions       += Number(row.ad_conversions)       || 0;
    acc.ad_purchases         += Number(row.ad_purchases)         || 0;
    acc.ad_revenue           += Number(row.ad_revenue)           || 0;
    acc.ga4_sessions         += Number(row.ga4_sessions)         || 0;
    acc.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
    acc.ga4_pageviews        += Number(row.ga4_pageviews)        || 0;
    acc.ga4_total_users      += Number(row.ga4_total_users)      || 0;
    acc.ga4_purchases        += Number(row.ga4_purchases)        || 0;
    acc.ga4_total_revenue    += Number(row.ga4_total_revenue)    || 0;
    acc.ga4_add_to_carts     += Number(row.ga4_add_to_carts)     || 0;
    acc.ga4_checkouts        += Number(row.ga4_checkouts)        || 0;
    acc.email_total_sent     += Number(row.email_total_sent)     || 0;
    acc.email_opens          += Number(row.email_opens)          || 0;
    acc.email_clicks         += Number(row.email_clicks)         || 0;
    acc.gsc_clicks           += Number(row.gsc_clicks)           || 0;
    // Weighted average position: must update avg BEFORE updating impressions total
    const rowImp = Number(row.gsc_impressions) || 0;
    const rowPos = Number(row.gsc_avg_position) || 0;
    const newImp = acc.gsc_impressions + rowImp;
    acc.gsc_avg_position = newImp > 0
      ? (acc.gsc_avg_position * acc.gsc_impressions + rowPos * rowImp) / newImp
      : 0;
    acc.gsc_impressions      = newImp;
    acc.gsc_keywords_ranked  += Number(row.gsc_keywords_ranked)  || 0;
    acc.social_impressions   += Number(row.social_impressions)   || 0;
    acc.social_engagement    += Number(row.social_engagement)    || 0;
    acc.social_interactions  += Number(row.social_interactions)  || 0;
    acc.social_post_count    += Number(row.social_post_count)    || 0;
  }
  return acc;
}

/** Merge rows that share the same product name (collapse brand dimension) */
function mergeByProduct(rows: ProductPerformanceRow[]): ProductPerformanceRow[] {
  const map = new Map<string, ProductPerformanceRow>();
  for (const row of rows) {
    const key = row.product || 'Unknown';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, product: key });
    } else {
      const merged = summarize([existing, row]);
      merged.product = key;
      merged.brand = row.brand;
      map.set(key, merged);
    }
  }
  return Array.from(map.values());
}

function normalizeProductRow(row: ProductSourceRow): ProductPerformanceRow {
  const gscImp = Number(row.gsc_impressions) || 0;
  const gscPos = Number(row.gsc_position) || 0;
  return {
    product: row.product || 'Unknown',
    brand: row.brand || 'Unknown',
    ad_impressions:       Number(row.ad_impressions)       || 0,
    ad_clicks:            Number(row.ad_clicks)            || 0,
    ad_cost:              Number(row.ad_cost)              || 0,
    ad_conversions:       Number(row.ad_conversions)       || 0,
    ad_purchases:         Number(row.ad_purchases)         || 0,
    ad_revenue:           Number(row.ad_revenue)           || 0,
    ga4_sessions:         Number(row.ga4_sessions)         || 0,
    ga4_engaged_sessions: Number(row.ga4_engaged_sessions) || 0,
    ga4_pageviews:        Number(row.ga4_pageviews)        || 0,
    ga4_total_users:      Number(row.ga4_total_users)      || 0,
    ga4_purchases:        Number(row.ga4_purchases)        || 0,
    ga4_total_revenue:    Number(row.ga4_total_revenue)    || 0,
    ga4_add_to_carts:     Number(row.ga4_add_to_carts)     || 0,
    ga4_checkouts:        Number(row.ga4_checkouts)        || 0,
    email_total_sent:     Number(row.email_total_sent)     || 0,
    email_opens:          Number(row.email_opens)          || 0,
    email_clicks:         Number(row.email_clicks)         || 0,
    gsc_clicks:           Number(row.gsc_clicks)           || 0,
    gsc_impressions:      gscImp,
    gsc_avg_position:     gscImp > 0 ? gscPos : 0,
    gsc_keywords_ranked:  0, // overridden by Set count in aggregateByProductAndBrand
    social_impressions:   Number(row.social_impressions)   || 0,
    social_engagement:    Number(row.social_engagement)    || 0,
    social_interactions:  Number(row.social_interactions)  || 0,
    social_post_count:    0, // overridden by Set count in aggregateByProductAndBrand
  };
}

function aggregateByProductAndBrand(rows: ProductSourceRow[]): ProductPerformanceRow[] {
  const grouped  = new Map<string, ProductPerformanceRow>();
  const queries  = new Map<string, Set<string>>();
  const postIds  = new Map<string, Set<string>>();

  for (const row of rows) {
    const normalized = normalizeProductRow(row);
    const key = `${normalized.product}::${normalized.brand}`;

    // Track distinct gsc_query and social_post_id per product+brand
    if (!queries.has(key))  queries.set(key, new Set());
    if (!postIds.has(key))  postIds.set(key, new Set());
    if (row.gsc_query)       queries.get(key)!.add(row.gsc_query);
    if (row.social_post_id)  postIds.get(key)!.add(row.social_post_id);

    const existing = grouped.get(key);
    if (existing) {
      const merged = summarize([existing, normalized]);
      merged.product = normalized.product;
      merged.brand   = normalized.brand;
      grouped.set(key, merged);
    } else {
      grouped.set(key, normalized);
    }
  }

  // Apply distinct counts from Sets
  for (const [key, row] of grouped.entries()) {
    row.gsc_keywords_ranked = queries.get(key)?.size ?? 0;
    row.social_post_count   = postIds.get(key)?.size  ?? 0;
  }

  return Array.from(grouped.values()).sort((a, b) => b.ad_cost - a.ad_cost);
}

const IGNORED_SOURCES = new Set(['(not set)', '(data not available)', null, undefined]);

function buildTrafficRows(
  currentRows: ProductSourceRow[],
  previousRows: ProductSourceRow[],
  keyFn: (r: ProductSourceRow) => string | null,
  metaFn: (r: ProductSourceRow) => { label: string; sublabel?: string; channelGroup?: string },
): TrafficBreakdownRow[] {
  type Acc = { sessions: number; engaged: number; purchases: number; revenue: number; carts: number };
  const zero = (): Acc => ({ sessions: 0, engaged: 0, purchases: 0, revenue: 0, carts: 0 });

  const curr = new Map<string, { meta: ReturnType<typeof metaFn> } & Acc>();
  const prev = new Map<string, Acc>();

  for (const row of currentRows) {
    const key = keyFn(row);
    if (!key) continue;
    const entry = curr.get(key) ?? { meta: metaFn(row), ...zero() };
    entry.sessions  += Number(row.ga4_sessions)         || 0;
    entry.engaged   += Number(row.ga4_engaged_sessions) || 0;
    entry.purchases += Number(row.ga4_purchases)        || 0;
    entry.revenue   += Number(row.ga4_total_revenue)    || 0;
    entry.carts     += Number(row.ga4_add_to_carts)     || 0;
    curr.set(key, entry);
  }

  for (const row of previousRows) {
    const key = keyFn(row);
    if (!key) continue;
    const entry = prev.get(key) ?? zero();
    entry.sessions  += Number(row.ga4_sessions)         || 0;
    entry.engaged   += Number(row.ga4_engaged_sessions) || 0;
    entry.purchases += Number(row.ga4_purchases)        || 0;
    entry.revenue   += Number(row.ga4_total_revenue)    || 0;
    entry.carts     += Number(row.ga4_add_to_carts)     || 0;
    prev.set(key, entry);
  }

  return Array.from(curr.entries())
    .map(([key, c]) => {
      const p = prev.get(key) ?? zero();
      return {
        ...c.meta,
        ga4_sessions:         c.sessions,
        prev_sessions:        p.sessions,
        ga4_engaged_sessions: c.engaged,
        prev_engaged:         p.engaged,
        ga4_purchases:        c.purchases,
        prev_purchases:       p.purchases,
        ga4_total_revenue:    c.revenue,
        prev_revenue:         p.revenue,
        ga4_add_to_carts:     c.carts,
        prev_carts:           p.carts,
      };
    })
    .sort((a, b) => b.ga4_sessions - a.ga4_sessions);
}

// ─── Time Series ──────────────────────────────────────────────────────────────

function weekStartKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function bucketKey(dateStr: string, grain: TimeSeriesGrain): string {
  if (grain === 'day')  return dateStr;
  if (grain === 'week') return weekStartKey(dateStr);
  return dateStr.slice(0, 7); // YYYY-MM
}

function bucketLabel(bucket: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') {
    const d = new Date(bucket + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  if (grain === 'week') {
    const d = new Date(bucket + 'T00:00:00');
    return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const [yr, mo] = bucket.split('-');
  const d = new Date(Number(yr), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildTimeSeries(rows: ProductSourceRow[], grain: TimeSeriesGrain): ProductTimeSeriesPoint[] {
  const map = new Map<string, Omit<ProductTimeSeriesPoint, 'label'>>();

  for (const row of rows) {
    if (!row.date) continue;
    const bucket = bucketKey(row.date, grain);
    const entry = map.get(bucket) ?? {
      bucket,
      ad_cost: 0, ad_revenue: 0, ad_roas: 0, ad_purchases: 0,
      ga4_sessions: 0, ga4_purchases: 0, ga4_revenue: 0,
      gsc_clicks: 0, email_opens: 0, social_engagement: 0,
    };
    entry.ad_cost           += Number(row.ad_cost)           || 0;
    entry.ad_revenue        += Number(row.ad_revenue)        || 0;
    entry.ad_purchases      += Number(row.ad_purchases)      || 0;
    entry.ga4_sessions      += Number(row.ga4_sessions)      || 0;
    entry.ga4_purchases     += Number(row.ga4_purchases)     || 0;
    entry.ga4_revenue       += Number(row.ga4_total_revenue) || 0;
    entry.gsc_clicks        += Number(row.gsc_clicks)        || 0;
    entry.email_opens       += Number(row.email_opens)       || 0;
    entry.social_engagement += Number(row.social_engagement) || 0;
    map.set(bucket, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => ({
      ...entry,
      label: bucketLabel(entry.bucket, grain),
      ad_roas: entry.ad_cost > 0 ? entry.ad_revenue / entry.ad_cost : 0,
    }));
}

async function fetchPagedProductRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: unknown[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      throw new Error(error.message ?? 'Supabase query failed');
    }

    const page = (data ?? []) as unknown as T[];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export async function fetchSpartacoProductData(
  params: SpartacoFilterParams
): Promise<ProductDashboardData> {
  const supabase = createSpartacoSupabaseClient();

  const brandArg   = params.brand   && params.brand   !== 'all' ? params.brand   : null;
  const productArg = params.product && params.product !== 'all' ? params.product : null;

  function applyProductFilters<T extends EqQuery<T>>(query: T) {
    let next = query;
    if (brandArg)   next = next.eq('brand', brandArg);
    if (productArg) next = next.eq('product', productArg);
    return next;
  }

  const [currentSourceRows, previousSourceRows, optRows] = await Promise.all([
    fetchPagedProductRows<ProductSourceRow>(async (from, to) =>
      await applyProductFilters(
        supabase
          .from('spartaco_master_products')
          .select(PRODUCT_SELECT)
          .gte('date', params.start)
          .lte('date', params.end)
          .order('date',    { ascending: true })
          .order('brand',   { ascending: true })
          .order('product', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedProductRows<ProductSourceRow>(async (from, to) =>
      await applyProductFilters(
        supabase
          .from('spartaco_master_products')
          .select(PRODUCT_SELECT)
          .gte('date', params.compStart)
          .lte('date', params.compEnd)
          .order('date',    { ascending: true })
          .order('brand',   { ascending: true })
          .order('product', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedProductRows<{ brand: string; product: string }>(async (from, to) =>
      await supabase
        .from('spartaco_master_products')
        .select('brand,product')
        .gte('date', params.start)
        .lte('date', params.end)
        .not('brand',   'is', null)
        .not('product', 'is', null)
        .order('brand',   { ascending: true })
        .order('product', { ascending: true })
        .range(from, to)
    ),
  ]);

  const current          = aggregateByProductAndBrand(currentSourceRows);
  const previous         = aggregateByProductAndBrand(previousSourceRows);
  const productRows      = mergeByProduct(current);
  const previousProductRows = mergeByProduct(previous);
  const optData          = (optRows ?? []) as unknown as { brand: string; product: string }[];

  // Summary-level distinct counts use the raw source rows for accuracy
  const summaryCurrentRaw  = summarize(current);
  summaryCurrentRaw.gsc_keywords_ranked = new Set(
    currentSourceRows.map(r => r.gsc_query).filter((q): q is string => !!q)
  ).size;
  summaryCurrentRaw.social_post_count = new Set(
    currentSourceRows.map(r => r.social_post_id).filter((p): p is string => !!p)
  ).size;

  const summaryPreviousRaw = summarize(previous);
  summaryPreviousRaw.gsc_keywords_ranked = new Set(
    previousSourceRows.map(r => r.gsc_query).filter((q): q is string => !!q)
  ).size;
  summaryPreviousRaw.social_post_count = new Set(
    previousSourceRows.map(r => r.social_post_id).filter((p): p is string => !!p)
  ).size;

  const channelGroupRows = buildTrafficRows(
    currentSourceRows,
    previousSourceRows,
    r => r.ga4_default_channel_group || null,
    r => ({ label: r.ga4_default_channel_group ?? 'Unknown' }),
  );

  const sourceMediumRows = buildTrafficRows(
    currentSourceRows,
    previousSourceRows,
    r => {
      const s = r.ga4_source;
      const m = r.ga4_medium;
      if (!s || IGNORED_SOURCES.has(s)) return null;
      return `${s} / ${m ?? '(none)'}`;
    },
    r => ({
      label:        r.ga4_source ?? '',
      sublabel:     r.ga4_medium ?? '(none)',
      channelGroup: r.ga4_default_channel_group ?? undefined,
    }),
  );

  const totalDays = daysBetween(params.start, params.end);
  const grain: TimeSeriesGrain = totalDays <= 30 ? 'day' : totalDays <= 90 ? 'week' : 'month';

  return {
    filterParams:         params,
    summary:              summaryCurrentRaw,
    previousSummary:      summaryPreviousRaw,
    productRows,
    previousProductRows,
    channelGroupRows,
    sourceMediumRows,
    timeSeries:           buildTimeSeries(currentSourceRows, grain),
    timeSeriesGrain:      grain,
    filterOptions: {
      brands:        [...new Set(optData.map(r => r.brand).filter(Boolean))].sort(),
      products:      [...new Set(optData.map(r => r.product).filter(Boolean))].sort(),
      channelGroups: channelGroupRows.map(r => r.label).filter(l => l !== 'Unassigned'),
      sourceMediums: sourceMediumRows.slice(0, 25).map(r => `${r.label} / ${r.sublabel ?? ''}`),
    },
  };
}
