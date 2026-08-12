import assert from 'node:assert/strict';

import {
  aggregateGoodGameShopifyCampaigns,
  summariseGoodGameShopifyAttribution,
} from '../src/lib/goodgame-shopify-attribution.ts';

const dailyRows = [
  {
    date: '2026-08-01', platform: 'meta', campaign_id: 'cmp-1', campaign_name: 'Prospecting',
    media_spend: 100, new_customers: 2, shopify_first_order_revenue: 80,
    shopify_lifetime_net_revenue: 120, shopify_lifetime_refunds: 10,
    meta_reported_purchases: 3, meta_reported_revenue: 150,
  },
  {
    date: '2026-08-02', platform: 'meta', campaign_id: 'cmp-1', campaign_name: 'Prospecting',
    media_spend: 50, new_customers: 1, shopify_first_order_revenue: 40,
    shopify_lifetime_net_revenue: 60, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 1, meta_reported_revenue: 50,
  },
  {
    date: '2026-08-02', platform: 'direct', campaign_id: null, campaign_name: null,
    media_spend: 0, new_customers: 1, shopify_first_order_revenue: 20,
    shopify_lifetime_net_revenue: 20, shopify_lifetime_refunds: 0,
    meta_reported_purchases: 0, meta_reported_revenue: 0,
  },
];

const customers = [
  { customer_id: '1', order_count: 2 },
  { customer_id: '2', order_count: 1 },
  { customer_id: '3', order_count: 3 },
  { customer_id: '4', order_count: 1 },
];

const summary = summariseGoodGameShopifyAttribution(dailyRows, customers);
assert.deepEqual(summary, {
  newCustomers: 4,
  attributedSpend: 150,
  firstOrderRevenue: 140,
  lifetimeNetRevenue: 200,
  refunds: 10,
  averageLtv: 50,
  cac: 37.5,
  ltvCac: 4 / 3,
  repeatCustomers: 2,
  repeatPurchaseRate: 0.5,
  metaReportedPurchases: 4,
  metaReportedRevenue: 200,
});

const campaigns = aggregateGoodGameShopifyCampaigns(dailyRows);
assert.equal(campaigns.length, 2);
assert.deepEqual(campaigns[0], {
  key: 'meta||cmp-1', label: 'Prospecting', platform: 'meta', spend: 150, newCustomers: 3,
  cac: 50, firstOrderRevenue: 120, lifetimeNetRevenue: 180,
  averageLtv: 60, ltvCac: 1.2, metaReportedPurchases: 4, metaReportedRevenue: 200,
});
assert.equal(campaigns[1].label, 'Direct / no campaign');
assert.equal(campaigns[1].cac, 0);
assert.equal(campaigns[1].ltvCac, 0);

const empty = summariseGoodGameShopifyAttribution([], []);
assert.equal(empty.cac, 0);
assert.equal(empty.averageLtv, 0);
assert.equal(empty.repeatPurchaseRate, 0);
assert.equal(empty.ltvCac, 0);

console.log('Good Game Shopify attribution math: PASS');
