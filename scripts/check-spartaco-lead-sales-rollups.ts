import assert from 'node:assert/strict';

import {
  buildTimeSeries,
  deriveSpartacoProductSourceType,
  mergeByProduct,
  type ProductPerformanceRow,
  type ProductSourceRow,
} from '../src/services/spartaco-product-analytics';
import { hasSpartacoCampaignType } from '../src/services/spartaco-product-wrapups';
import { buildProductChannelKpiRows } from '../src/services/spartaco-product-channel-kpis';

const emptyRow = (overrides: Partial<ProductPerformanceRow>): ProductPerformanceRow => ({
  product: 'Brand', brand: 'Jameson', type: 'ALL',
  ad_impressions: 0, ad_clicks: 0, ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
  ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
  ga4_purchases: 0, ga4_total_revenue: 0, ga4_add_to_carts: 0, ga4_checkouts: 0,
  email_total_sent: 0, email_opens: 0, email_clicks: 0,
  gsc_clicks: 0, gsc_impressions: 0, gsc_avg_position: 0, gsc_keywords_ranked: 0,
  social_impressions: 0, social_engagement: 0, social_interactions: 0, social_post_count: 0,
  ...overrides,
});

assert.equal(deriveSpartacoProductSourceType({
  source: 'ga4', brand: 'Jameson', campaign_name: null, ad_type: null,
}), 'ALL', 'non-ad product data must remain unclassified');
assert.equal(deriveSpartacoProductSourceType({
  source: 'ads', brand: 'Jameson', campaign_name: 'Brand', ad_type: null,
}), 'SALES', 'Jameson Brand must be Sales');
assert.equal(deriveSpartacoProductSourceType({
  source: 'ads', brand: 'Huskie', campaign_name: 'Evergreen Brand', ad_type: 'SALES',
}), 'LEAD', 'all Huskie campaigns must be Lead');

const rows = mergeByProduct([
  emptyRow({ type: 'ALL', ga4_sessions: 25, email_total_sent: 10 }),
  emptyRow({ type: 'LEAD', ad_cost: 100, ad_conversions: 4 }),
  emptyRow({ type: 'SALES', ad_cost: 200, ad_purchases: 2, ad_revenue: 600 }),
  emptyRow({ product: 'Brand', brand: 'Ronin', type: 'SALES', ad_cost: 300, ad_purchases: 1, ad_revenue: 500 }),
]);

assert.equal(rows.length, 4, 'Lead, Sales, cross-channel, and a different brand must remain separate');
const jamesonLead = rows.find((row) => row.brand === 'Jameson' && row.type === 'LEAD');
const jamesonSales = rows.find((row) => row.brand === 'Jameson' && row.type === 'SALES');
const jamesonCrossChannel = rows.find((row) => row.brand === 'Jameson' && row.type === 'ALL');
const roninSales = rows.find((row) => row.brand === 'Ronin' && row.type === 'SALES');
assert.equal(jamesonLead?.ad_cost, 100);
assert.equal(jamesonSales?.ad_cost, 200);
assert.equal(jamesonLead?.ga4_sessions, 0, 'Lead rows must not duplicate cross-channel data');
assert.equal(jamesonSales?.ga4_sessions, 0, 'Sales rows must not duplicate cross-channel data');
assert.equal(jamesonCrossChannel?.ga4_sessions, 25, 'product-level cross-channel data remains visible');
assert.equal(jamesonCrossChannel?.email_total_sent, 10);
assert.equal(roninSales?.ad_cost, 300, 'same-named products from different brands must not merge');

assert.equal(
  hasSpartacoCampaignType([{ type: 'SALES' }], 'SALES'),
  true,
  'a zero-purchase Sales campaign is still applicable'
);
assert.equal(
  hasSpartacoCampaignType([{ type: 'LEAD' }], 'SALES'),
  false,
  'Sales is not applicable when no Sales campaign exists'
);

const sourceRow = (overrides: Partial<ProductSourceRow>): ProductSourceRow => ({
  date: '2026-08-01', source: 'ads', brand: 'Jameson', product: 'Brand',
  monday_product: 'Brand', parent_product: 'Brand', campaign_name: null, email_name: null,
  ad_channel: null, ad_origem: null, ad_type: null, ad_impressions: 0, ad_clicks: 0,
  ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
  ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
  ga4_purchases: 0, ga4_total_revenue: 0, ga4_add_to_carts: 0, ga4_checkouts: 0,
  email_total_sent: 0, email_opens: 0, email_clicks: 0, gsc_clicks: 0,
  gsc_impressions: 0, gsc_position: 0, gsc_query: null, page_path: null,
  ga4_source: null, ga4_medium: null, ga4_default_channel_group: null,
  social_impressions: 0, social_engagement: 0, social_interactions: 0, social_post_id: null,
  ...overrides,
});
const [point] = buildTimeSeries([
  sourceRow({ ad_type: 'LEAD', ad_cost: 50, ad_conversions: 10, ad_purchases: 2, ad_revenue: 100 }),
  sourceRow({ ad_type: 'SALES', ad_cost: 40, ad_conversions: 7, ad_purchases: 1, ad_revenue: 80 }),
], 'day');
assert.equal(point.ad_conversions, 10, 'Sales conversion actions must not inflate Leads');
assert.equal(point.ad_purchases, 1, 'Lead-campaign purchases must not inflate Sales');
assert.equal(point.ad_cpl, 5, 'CPL must use Lead spend only');
assert.equal(point.ad_roas, 2, 'ROAS must use Sales spend only');

const metricInput = {
  ad_impressions: 1, ad_clicks: 1, ad_cost: 90, ad_conversions: 10,
  ad_purchases: 1, ad_revenue: 80, ga4_sessions: 0, ga4_engaged_sessions: 0,
  ga4_total_revenue: 0, email_total_sent: 0, email_opens: 0, email_clicks: 0,
  gsc_clicks: 0, gsc_impressions: 0, gsc_avg_position: 0,
  social_impressions: 0, social_interactions: 0, social_engagement: 0,
};
const paidKpi = buildProductChannelKpiRows(metricInput, metricInput, undefined, undefined, {
  mode: 'ALL', currentLeadSpend: 50, previousLeadSpend: 50,
  currentSalesSpend: 40, previousSalesSpend: 40,
})[0];
assert.equal(paidKpi.metric, 'ROAS');
assert.equal(paidKpi.value, 2, 'summary ROAS must not divide by blended Lead + Sales spend');

console.log('Spartaco Lead/Sales roll-up checks passed');