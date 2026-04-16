import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { SpartacoFilterParams } from './spartaco-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One row returned by the product_performance_summary RPC */
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
  // Social
  social_impressions: number;
  social_engagement: number;
  social_interactions: number;
};

export type ProductDashboardData = {
  summary: ProductPerformanceRow;
  previousSummary: ProductPerformanceRow;
  productRows: ProductPerformanceRow[];
  filterOptions: {
    brands: string[];
    products: string[];
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_ROW: ProductPerformanceRow = {
  product: 'Total', brand: 'Total',
  ad_impressions: 0, ad_clicks: 0, ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
  ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
  ga4_purchases: 0, ga4_total_revenue: 0, ga4_add_to_carts: 0, ga4_checkouts: 0,
  email_total_sent: 0, email_opens: 0, email_clicks: 0,
  gsc_clicks: 0, gsc_impressions: 0,
  social_impressions: 0, social_engagement: 0, social_interactions: 0,
};

/** Sum all rows into a single summary row */
function summarize(rows: ProductPerformanceRow[]): ProductPerformanceRow {
  return rows.reduce<ProductPerformanceRow>((acc, row) => ({
    product: 'Total',
    brand: 'Total',
    ad_impressions:       acc.ad_impressions       + (Number(row.ad_impressions) || 0),
    ad_clicks:            acc.ad_clicks            + (Number(row.ad_clicks) || 0),
    ad_cost:              acc.ad_cost              + (Number(row.ad_cost) || 0),
    ad_conversions:       acc.ad_conversions       + (Number(row.ad_conversions) || 0),
    ad_purchases:         acc.ad_purchases         + (Number(row.ad_purchases) || 0),
    ad_revenue:           acc.ad_revenue           + (Number(row.ad_revenue) || 0),
    ga4_sessions:         acc.ga4_sessions         + (Number(row.ga4_sessions) || 0),
    ga4_engaged_sessions: acc.ga4_engaged_sessions + (Number(row.ga4_engaged_sessions) || 0),
    ga4_pageviews:        acc.ga4_pageviews        + (Number(row.ga4_pageviews) || 0),
    ga4_total_users:      acc.ga4_total_users      + (Number(row.ga4_total_users) || 0),
    ga4_purchases:        acc.ga4_purchases        + (Number(row.ga4_purchases) || 0),
    ga4_total_revenue:    acc.ga4_total_revenue    + (Number(row.ga4_total_revenue) || 0),
    ga4_add_to_carts:     acc.ga4_add_to_carts     + (Number(row.ga4_add_to_carts) || 0),
    ga4_checkouts:        acc.ga4_checkouts        + (Number(row.ga4_checkouts) || 0),
    email_total_sent:     acc.email_total_sent     + (Number(row.email_total_sent) || 0),
    email_opens:          acc.email_opens          + (Number(row.email_opens) || 0),
    email_clicks:         acc.email_clicks         + (Number(row.email_clicks) || 0),
    gsc_clicks:           acc.gsc_clicks           + (Number(row.gsc_clicks) || 0),
    gsc_impressions:      acc.gsc_impressions      + (Number(row.gsc_impressions) || 0),
    social_impressions:   acc.social_impressions   + (Number(row.social_impressions) || 0),
    social_engagement:    acc.social_engagement    + (Number(row.social_engagement) || 0),
    social_interactions:  acc.social_interactions  + (Number(row.social_interactions) || 0),
  }), { ...EMPTY_ROW });
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
      // accumulate into existing
      map.set(key, summarize([existing, row]));
      map.get(key)!.product = key;
      map.get(key)!.brand = row.brand; // keep last brand
    }
  }
  return Array.from(map.values());
}

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export async function fetchSpartacoProductData(
  params: SpartacoFilterParams
): Promise<ProductDashboardData> {
  const supabase = createSpartacoSupabaseClient();

  const brandArg = params.brand && params.brand !== 'all' ? params.brand : null;

  // Call the RPC for current and previous periods in parallel
  const [{ data: currentRows, error: errCurrent }, { data: prevRows, error: errPrev }] =
    await Promise.all([
      supabase.rpc('product_performance_summary', {
        p_start: params.start,
        p_end:   params.end,
        p_brand: brandArg,
      }),
      supabase.rpc('product_performance_summary', {
        p_start: params.compStart,
        p_end:   params.compEnd,
        p_brand: brandArg,
      }),
    ]);

  if (errCurrent) console.error('[product-analytics] current period error:', errCurrent);
  if (errPrev) console.error('[product-analytics] comparison period error:', errPrev);

  const current  = (currentRows ?? []) as unknown as ProductPerformanceRow[];
  const previous = (prevRows ?? [])    as unknown as ProductPerformanceRow[];

  // Merge by product (the RPC groups by product+brand, we may want product-only)
  const productRows = mergeByProduct(current);

  // Also fetch filter options: all brands and products regardless of filters
  const { data: optRows } = await supabase
    .from('spartaco_master_products')
    .select('brand, product')
    .gte('date', params.start)
    .lte('date', params.end)
    .not('brand', 'is', null)
    .not('product', 'is', null)
    .limit(10000);

  const optData = (optRows ?? []) as unknown as { brand: string; product: string }[];

  return {
    summary:         summarize(current),
    previousSummary: summarize(previous),
    productRows,
    filterOptions: {
      brands:   [...new Set(optData.map(r => r.brand).filter(Boolean))].sort(),
      products: [...new Set(optData.map(r => r.product).filter(Boolean))].sort(),
    },
  };
}
