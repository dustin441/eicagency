import assert from 'node:assert/strict';
import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const productData = await fetchSpartacoProductData({
    brand: 'Tiiger',
    product: 'Long Handled Tools',
    channel: 'all',
    campaign: 'all',
    focus: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
    start: '2026-02-10',
    end: '2026-03-13',
    compStart: '2026-01-13',
    compEnd: '2026-02-09',
  });
  assert.equal(productData.summary.ad_impressions, 87787);
  assert.equal(productData.summary.ad_clicks, 1060);
  assert.equal(Math.round(productData.summary.ad_cost * 100) / 100, 2002.45);
  assert.equal(productData.summary.ad_conversions, 12);
  assert.equal(productData.summary.email_total_sent, 2161);
  assert.ok(productData.filterOptions.products.includes('Long Handled Tools'),
    `Expected Tiiger Long Handled Tools to be available in product filters. Got: ${productData.filterOptions.products.join(', ')}`,
  );

  const wrapup = await fetchSpartacoProductWrapup('tiiger-long-handled-tools-2026-02-10');
  assert.ok(wrapup, 'Expected Tiiger Long Handled Tools wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Tiiger');
  assert.equal(wrapup.config.product, 'Long Handled Tools');
  assert.equal(wrapup.config.campaignStart, '2026-02-10');
  assert.equal(wrapup.config.campaignEnd, '2026-03-13');
  assert.equal(wrapup.config.beforeStart, '2026-01-13');
  assert.equal(wrapup.config.beforeEnd, '2026-02-09');
  assert.equal(wrapup.config.afterStart, '2026-03-14');
  assert.equal(wrapup.config.afterEnd, '2026-04-10');
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/tiiger-long-handle-tools',
    '/promotion/tiiger-long-handle-tools',
    '/product-category/tiiger-utility-products/long-handle-tools',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumScopedPageRules, [
    {
      pagePath: '/products',
      sources: ['google'],
      mediums: ['cpc'],
      channelGroups: ['Cross-network'],
      start: '2026-02-10',
      end: '2026-03-13',
      label: '/products/?_product_categories=long-handle-tools',
    },
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(before.ga4_sessions, 23);
  assert.equal(before.ga4_engaged_sessions, 8);
  assert.equal(during.ad_impressions, 87787);
  assert.equal(during.ad_clicks, 1060);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 2002.45);
  assert.equal(during.ad_conversions, 12);
  assert.equal(during.ga4_sessions, 452);
  assert.equal(during.ga4_engaged_sessions, 296);
  assert.equal(during.email_total_sent, 2161);
  assert.equal(during.email_opens, 510);
  assert.equal(during.email_clicks, 201);
  assert.equal(after.ga4_sessions, 18);
  assert.equal(after.ga4_engaged_sessions, 3);

  for (const [label, summary] of [['before', before], ['after', after]] as const) {
    assert.equal(summary.ad_impressions, 0, `Expected ${label} period paid impressions to be zero`);
    assert.equal(summary.ad_clicks, 0, `Expected ${label} period paid clicks to be zero`);
    assert.equal(Math.round(summary.ad_cost * 100) / 100, 0, `Expected ${label} period paid spend to be zero`);
    assert.equal(summary.ad_conversions, 0, `Expected ${label} period paid leads/conversions to be zero`);
  }

  const onsiteGoogle = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(onsiteGoogle, 'Expected Tiiger Long Handled Tools on-site / Google Ads breakout row');
  assert.equal(onsiteGoogle.leads, 12);
  assert.equal(onsiteGoogle.clicks, 1060);
  assert.equal(Math.round(onsiteGoogle.cost * 100) / 100, 2002.45);

  assert.ok(wrapup.emailDetails.some((email) => email.name.includes('Tiiger Long Handled Tools')),
    `Expected product-specific Tiiger Long Handled Tools email details. Got: ${wrapup.emailDetails.map((email) => email.name).join(', ')}`,
  );
  assert.ok(wrapup.emailDetails.every((email) => email.date >= wrapup.config.campaignStart && email.date <= wrapup.config.campaignEnd),
    `Expected Tiiger email details to stay inside the campaign window. Got: ${wrapup.emailDetails.map((email) => `${email.date} ${email.name}`).join(', ')}`,
  );
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0), during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );

  console.log('Tiiger Long Handled Tools wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
