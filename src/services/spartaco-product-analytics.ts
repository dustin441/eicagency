import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { FilterParams, toIsoDate } from './analytics';

export type ProductPerformanceRow = {
  id: number;
  date: string;
  brand: string;
  product: string;
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

export async function fetchSpartacoProductData(params: FilterParams): Promise<ProductDashboardData> {
  const supabase = createSpartacoSupabaseClient();
  
  // Define queries
  let currentQuery = supabase.from('spartaco_master_products').select('*').gte('date', params.start).lte('date', params.end);
  let prevQuery = supabase.from('spartaco_master_products').select('*').gte('date', params.compStart).lte('date', params.compEnd);
  
  if (params.brand && params.brand !== 'all') {
    currentQuery = currentQuery.eq('brand', params.brand);
    prevQuery = prevQuery.eq('brand', params.brand);
  }

  // Handle product filter from searchParams
  const productFilter = (params as any).product;
  if (productFilter && productFilter !== 'all') {
    currentQuery = currentQuery.eq('product', productFilter);
    prevQuery = prevQuery.eq('product', productFilter);
  }

  const [{ data: currentRows }, { data: prevRows }] = await Promise.all([
    currentQuery,
    prevQuery
  ]);

  const current = (currentRows || []) as ProductPerformanceRow[];
  const previous = (prevRows || []) as ProductPerformanceRow[];

  // Aggregate by product
  const aggregateByProduct = (rows: ProductPerformanceRow[]) => {
    const map = new Map<string, ProductPerformanceRow>();
    rows.forEach(row => {
      const key = row.product || 'Unknown';
      if (!map.has(key)) {
        map.set(key, { ...row, id: 0, date: '' });
      } else {
        const entry = map.get(key)!;
        entry.ad_impressions += row.ad_impressions || 0;
        entry.ad_clicks += row.ad_clicks || 0;
        entry.ad_cost += row.ad_cost || 0;
        entry.ad_conversions += row.ad_conversions || 0;
        entry.ad_purchases += row.ad_purchases || 0;
        entry.ad_revenue += row.ad_revenue || 0;
        entry.ga4_sessions += row.ga4_sessions || 0;
        entry.ga4_engaged_sessions += row.ga4_engaged_sessions || 0;
        entry.ga4_pageviews += row.ga4_pageviews || 0;
        entry.ga4_total_users += row.ga4_total_users || 0;
        entry.email_total_sent += row.email_total_sent || 0;
        entry.email_opens += row.email_opens || 0;
        entry.email_clicks += row.email_clicks || 0;
        entry.gsc_clicks += row.gsc_clicks || 0;
        entry.gsc_impressions += row.gsc_impressions || 0;
        entry.social_impressions += row.social_impressions || 0;
        entry.social_engagement += row.social_engagement || 0;
      }
    });
    return Array.from(map.values());
  };

  const productRows = aggregateByProduct(current);
  const prevProductRows = aggregateByProduct(previous);

  // Global summary
  const summarize = (rows: ProductPerformanceRow[]): ProductPerformanceRow => {
    return rows.reduce((acc, row) => ({
      ...acc,
      ad_impressions: acc.ad_impressions + (row.ad_impressions || 0),
      ad_clicks: acc.ad_clicks + (row.ad_clicks || 0),
      ad_cost: acc.ad_cost + (row.ad_cost || 0),
      ad_conversions: acc.ad_conversions + (row.ad_conversions || 0),
      ad_purchases: acc.ad_purchases + (row.ad_purchases || 0),
      ad_revenue: acc.ad_revenue + (row.ad_revenue || 0),
      ga4_sessions: acc.ga4_sessions + (row.ga4_sessions || 0),
      ga4_engaged_sessions: acc.ga4_engaged_sessions + (row.ga4_engaged_sessions || 0),
      ga4_pageviews: acc.ga4_pageviews + (row.ga4_pageviews || 0),
      ga4_total_users: acc.ga4_total_users + (row.ga4_total_users || 0),
      email_total_sent: acc.email_total_sent + (row.email_total_sent || 0),
      email_opens: acc.email_opens + (row.email_opens || 0),
      email_clicks: acc.email_clicks + (row.email_clicks || 0),
      gsc_clicks: acc.gsc_clicks + (row.gsc_clicks || 0),
      gsc_impressions: acc.gsc_impressions + (row.gsc_impressions || 0),
      social_impressions: acc.social_impressions + (row.social_impressions || 0),
      social_engagement: acc.social_engagement + (row.social_engagement || 0),
    }), {
      id: 0, date: '', brand: 'Total', product: 'Total',
      ad_impressions: 0, ad_clicks: 0, ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
      ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
      email_total_sent: 0, email_opens: 0, email_clicks: 0,
      gsc_clicks: 0, gsc_impressions: 0,
      social_impressions: 0, social_engagement: 0
    });
  };

  return {
    summary: summarize(current),
    previousSummary: summarize(previous),
    productRows,
    filterOptions: {
      brands: [...new Set(current.map(r => r.brand).filter(Boolean))].sort(),
      products: [...new Set(current.map(r => r.product).filter(Boolean))].sort(),
    }
  };
}
