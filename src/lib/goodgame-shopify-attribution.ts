export type GoodGameShopifyAttributionDailyRow = {
  date: string;
  platform: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  media_spend: number;
  new_customers: number;
  shopify_first_order_total_revenue: number;
  shopify_lifetime_total_revenue: number;
  shopify_lifetime_refunds: number;
  meta_reported_purchases: number;
  meta_reported_revenue: number;
};

export type GoodGameShopifyCustomerRow = {
  customer_id: string;
  order_count: number;
};

export type GoodGameShopifyAttributionSummary = {
  newCustomers: number;
  attributedSpend: number;
  firstOrderRevenue: number;
  lifetimeTotalRevenue: number;
  refunds: number;
  averageLtv: number;
  cac: number;
  lifetimeRoas: number;
  repeatCustomers: number;
  repeatPurchaseRate: number;
  metaReportedPurchases: number;
  metaReportedRevenue: number;
};

export type GoodGameShopifyAttributionRow = {
  key: string;
  label: string;
  platform: string;
  spend: number;
  newCustomers: number;
  cac: number;
  firstOrderRevenue: number;
  lifetimeTotalRevenue: number;
  averageLtv: number;
  lifetimeRoas: number;
  metaReportedPurchases: number;
  metaReportedRevenue: number;
};

export function summariseGoodGameShopifyAttribution(
  rows: GoodGameShopifyAttributionDailyRow[],
  customers: GoodGameShopifyCustomerRow[],
  scopedMediaSpend?: number,
): GoodGameShopifyAttributionSummary {
  const newCustomers = rows.reduce((sum, row) => sum + Number(row.new_customers ?? 0), 0);
  const attributedSpend = scopedMediaSpend
    ?? rows.reduce((sum, row) => sum + Number(row.media_spend ?? 0), 0);
  const firstOrderRevenue = rows.reduce((sum, row) => sum + Number(row.shopify_first_order_total_revenue ?? 0), 0);
  const lifetimeTotalRevenue = rows.reduce((sum, row) => sum + Number(row.shopify_lifetime_total_revenue ?? 0), 0);
  const refunds = rows.reduce((sum, row) => sum + Number(row.shopify_lifetime_refunds ?? 0), 0);
  const repeatCustomers = customers.filter((row) => Number(row.order_count ?? 0) > 1).length;
  const averageLtv = customers.length > 0 ? lifetimeTotalRevenue / customers.length : 0;
  const cac = newCustomers > 0 ? attributedSpend / newCustomers : 0;

  return {
    newCustomers,
    attributedSpend,
    firstOrderRevenue,
    lifetimeTotalRevenue,
    refunds,
    averageLtv,
    cac,
    lifetimeRoas: attributedSpend > 0 ? lifetimeTotalRevenue / attributedSpend : 0,
    repeatCustomers,
    repeatPurchaseRate: customers.length > 0 ? repeatCustomers / customers.length : 0,
    metaReportedPurchases: rows.reduce((sum, row) => sum + Number(row.meta_reported_purchases ?? 0), 0),
    metaReportedRevenue: rows.reduce((sum, row) => sum + Number(row.meta_reported_revenue ?? 0), 0),
  };
}

export function aggregateGoodGameShopifyCampaigns(
  rows: GoodGameShopifyAttributionDailyRow[],
): GoodGameShopifyAttributionRow[] {
  const map = new Map<string, GoodGameShopifyAttributionRow>();

  for (const row of rows) {
    const platform = row.platform || 'other';
    const label = row.campaign_name || (platform === 'direct' ? 'Direct / no campaign' : 'Unassigned');
    const key = `${platform}||${row.campaign_id || label}`;
    const entry = map.get(key) ?? {
      key,
      label,
      platform,
      spend: 0,
      newCustomers: 0,
      cac: 0,
      firstOrderRevenue: 0,
      lifetimeTotalRevenue: 0,
      averageLtv: 0,
      lifetimeRoas: 0,
      metaReportedPurchases: 0,
      metaReportedRevenue: 0,
    };

    entry.spend += Number(row.media_spend ?? 0);
    entry.newCustomers += Number(row.new_customers ?? 0);
    entry.firstOrderRevenue += Number(row.shopify_first_order_total_revenue ?? 0);
    entry.lifetimeTotalRevenue += Number(row.shopify_lifetime_total_revenue ?? 0);
    entry.metaReportedPurchases += Number(row.meta_reported_purchases ?? 0);
    entry.metaReportedRevenue += Number(row.meta_reported_revenue ?? 0);
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((row) => {
      const cac = row.newCustomers > 0 ? row.spend / row.newCustomers : 0;
      const averageLtv = row.newCustomers > 0 ? row.lifetimeTotalRevenue / row.newCustomers : 0;
      return {
        ...row,
        cac,
        averageLtv,
        lifetimeRoas: row.spend > 0 ? row.lifetimeTotalRevenue / row.spend : 0,
      };
    })
    .filter((row) => row.newCustomers > 0 || row.spend > 0)
    .sort((a, b) => b.newCustomers - a.newCustomers || b.spend - a.spend);
}
