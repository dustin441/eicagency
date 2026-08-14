import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  aggregateGoodGameShopifyCampaigns,
  goodGamePaidPlatformsForChannel,
  summariseGoodGameShopifyAttribution,
} from '../src/lib/goodgame-shopify-attribution.ts';

assert.deepEqual(goodGamePaidPlatformsForChannel('all'), ['meta', 'google']);
assert.deepEqual(goodGamePaidPlatformsForChannel('Meta'), ['meta']);
assert.deepEqual(goodGamePaidPlatformsForChannel('Google'), ['google']);

const dashboardSource = readFileSync(
  new URL('../src/components/GoodGameSalesDashboardClient.tsx', import.meta.url),
  'utf8',
);
assert.match(dashboardSource, /Shopify Lifetime Value/);
assert.doesNotMatch(dashboardSource, /Only customers attributed to Meta or Google Ads are included/);

const dailyRows = [
  {
    date: '2026-08-01', platform: 'meta', campaign_id: 'cmp-1', campaign_name: 'Prospecting',
    media_spend: 100, new_customers: 2, shopify_first_order_total_revenue: 80,
    shopify_lifetime_total_revenue: 130, shopify_lifetime_refunds: 10,
    meta_reported_purchases: 3, meta_reported_revenue: 150,
  },
  {
    date: '2026-08-02', platform: 'meta', campaign_id: 'cmp-1', campaign_name: 'Prospecting',
    media_spend: 50, new_customers: 1, shopify_first_order_total_revenue: 40,
    shopify_lifetime_total_revenue: 66, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 1, meta_reported_revenue: 50,
  },
  {
    date: '2026-08-02', platform: 'direct', campaign_id: null, campaign_name: null,
    media_spend: 0, new_customers: 1, shopify_first_order_total_revenue: 20,
    shopify_lifetime_total_revenue: 24, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 0, meta_reported_revenue: 0,
  },
];

const customers = [
  { customer_id: '1', order_count: 2, lifetime_total_revenue: 130, lifetime_refunds: 10 },
  { customer_id: '2', order_count: 1, lifetime_total_revenue: 40, lifetime_refunds: 0 },
  { customer_id: '3', order_count: 3, lifetime_total_revenue: 26, lifetime_refunds: 0 },
  { customer_id: '4', order_count: 1, lifetime_total_revenue: 24, lifetime_refunds: 0 },
];

const summary = summariseGoodGameShopifyAttribution(dailyRows, customers, 120);
assert.deepEqual(summary, {
  newCustomers: 4,
  eligibleCustomers: 4,
  attributedSpend: 120,
  firstOrderRevenue: 140,
  lifetimeTotalRevenue: 220,
  refunds: 10,
  averageLtv: 55,
  cac: 30,
  lifetimeRoas: 11 / 6,
  repeatCustomers: 2,
  repeatPurchaseRate: 0.5,
  metaReportedPurchases: 4,
  metaReportedRevenue: 200,
});

const campaigns = aggregateGoodGameShopifyCampaigns(dailyRows);
assert.equal(campaigns.length, 2);
assert.deepEqual(campaigns[0], {
  key: 'meta||cmp-1', label: 'Prospecting', platform: 'meta', spend: 150, newCustomers: 3,
  cac: 50, firstOrderRevenue: 120, lifetimeTotalRevenue: 196,
  averageLtv: 196 / 3, lifetimeRoas: 196 / 150, metaReportedPurchases: 4, metaReportedRevenue: 200,
});
assert.equal(campaigns[1].label, 'Direct / no campaign');
assert.equal(campaigns[1].cac, 0);
assert.equal(campaigns[1].lifetimeRoas, 0);

const empty = summariseGoodGameShopifyAttribution([], []);
assert.equal(empty.cac, 0);
assert.equal(empty.averageLtv, 0);
assert.equal(empty.repeatPurchaseRate, 0);
assert.equal(empty.lifetimeRoas, 0);

const customerDenominatorSummary = summariseGoodGameShopifyAttribution(
  [{
    date: '2026-08-01', platform: 'meta', campaign_id: 'cmp-2', campaign_name: 'Sales',
    media_spend: 50, new_customers: 2, shopify_first_order_total_revenue: 100,
    shopify_lifetime_total_revenue: 200, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 2, meta_reported_revenue: 100,
  }],
  [{ customer_id: 'only-customer', order_count: 1, lifetime_total_revenue: 200, lifetime_refunds: 0 }],
  50,
);
assert.equal(customerDenominatorSummary.averageLtv, 200);

// The selected period identifies customers by any purchase, not by first purchase.
// Their full Shopify history is the source of LTV, even when daily acquisition rows
// contain a different lifetime total for newly acquired customers.
const anyPurchaseCohortSummary = summariseGoodGameShopifyAttribution(
  [{
    date: '2026-08-01', platform: 'meta', campaign_id: 'cmp-3', campaign_name: 'Sales',
    media_spend: 100, new_customers: 1, shopify_first_order_total_revenue: 50,
    shopify_lifetime_total_revenue: 50, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 1, meta_reported_revenue: 50,
  }],
  [
    { customer_id: 'new-in-period', order_count: 1, lifetime_total_revenue: 50, lifetime_refunds: 0 },
    { customer_id: 'bought-before-period', order_count: 4, lifetime_total_revenue: 350, lifetime_refunds: 25 },
    { customer_id: 'bought-before-period', order_count: 4, lifetime_total_revenue: 350, lifetime_refunds: 25 },
  ],
  100,
);
assert.equal(anyPurchaseCohortSummary.newCustomers, 1);
assert.equal(anyPurchaseCohortSummary.eligibleCustomers, 2);
assert.equal(anyPurchaseCohortSummary.lifetimeTotalRevenue, 400);
assert.equal(anyPurchaseCohortSummary.averageLtv, 200);
assert.equal(anyPurchaseCohortSummary.lifetimeRoas, 4);
assert.equal(anyPurchaseCohortSummary.repeatCustomers, 1);
assert.equal(anyPurchaseCohortSummary.repeatPurchaseRate, 0.5);
assert.equal(anyPurchaseCohortSummary.refunds, 25);

console.log('Good Game Shopify attribution math: PASS');
