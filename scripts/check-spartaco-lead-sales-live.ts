import assert from 'node:assert/strict';

import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';

const base = {
  brand: 'all', product: 'all', channel: 'all', campaign: 'all', focus: 'all',
  channelGroup: 'all', sourceMedium: 'all', start: '2026-01-01', end: '2026-08-27',
  compStart: '2025-05-07', compEnd: '2025-12-31',
} as const;

async function main() {
  const [all, lead, sales] = await Promise.all([
    fetchSpartacoProductData({ ...base, productType: 'ALL' }),
    fetchSpartacoProductData({ ...base, productType: 'LEAD' }),
    fetchSpartacoProductData({ ...base, productType: 'SALES' }),
  ]);

  const cents = (value: number) => Math.round(value * 100);
  assert.equal(cents(all.summary.ad_cost), cents(lead.summary.ad_cost + sales.summary.ad_cost));
  assert.equal(all.summary.ad_conversions, lead.summary.ad_conversions);
  assert.equal(all.summary.ad_purchases, sales.summary.ad_purchases);
  assert.equal(cents(all.summary.ad_revenue), cents(sales.summary.ad_revenue));
  assert.equal(sales.summary.ad_conversions, 0, 'Sales conversion actions must not be labeled Leads');
  assert.equal(lead.summary.ad_purchases, 0, 'Lead-campaign purchases must not enter Sales totals');
  assert.equal(lead.summary.ad_revenue, 0, 'Lead-campaign revenue must not enter Sales totals');

  assert.equal(all.summary.ga4_sessions, lead.summary.ga4_sessions);
  assert.equal(all.summary.ga4_sessions, sales.summary.ga4_sessions);
  assert.ok(all.productRows.every((row) => row.type === 'LEAD' || row.type === 'SALES' || row.type === 'ALL'));
  assert.ok(all.productRows.some((row) => row.type === 'ALL'), 'cross-channel product rows must remain visible');
  assert.ok(all.productRows.some((row) => row.brand === 'Jameson' && row.product === 'Brand' && row.type === 'SALES'));
  assert.ok(!all.productRows.some((row) => row.brand === 'Jameson' && row.product === 'Brand' && row.type === 'LEAD'));
  assert.ok(all.productRows.some((row) => row.brand === 'Huskie' && row.type === 'LEAD'));
  assert.ok(!all.productRows.some((row) => row.brand === 'Huskie' && row.type === 'SALES'));

  console.log(JSON.stringify({
    status: 'passed',
    allSpend: Number(all.summary.ad_cost.toFixed(2)),
    leadSpend: Number(lead.summary.ad_cost.toFixed(2)),
    salesSpend: Number(sales.summary.ad_cost.toFixed(2)),
    leads: all.summary.ad_conversions,
    purchases: all.summary.ad_purchases,
    salesRevenue: Number(all.summary.ad_revenue.toFixed(2)),
    ga4SessionsPreserved: all.summary.ga4_sessions,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
