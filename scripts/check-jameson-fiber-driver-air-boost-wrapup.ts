import assert from 'node:assert/strict';
import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const productData = await fetchSpartacoProductData({
    brand: 'Jameson',
    product: 'Air Boost',
    channel: 'all',
    campaign: 'all',
    focus: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
    start: '2026-02-24',
    end: '2026-03-20',
    compStart: '2026-01-27',
    compEnd: '2026-02-23',
  });
  assert.ok(productData.filterOptions.products.includes('Air Boost'),
    `Expected Air Boost to be available in product filters. Got: ${productData.filterOptions.products.join(', ')}`,
  );

  const wrapup = await fetchSpartacoProductWrapup('jameson-fiber-driver-air-boost-2026-02-24');
  assert.ok(wrapup, 'Expected Jameson Fiber Driver + Air Boost wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Air Boost');
  assert.equal(wrapup.config.parentProduct, 'Fiber Drivers');
  assert.equal(wrapup.config.campaignStart, '2026-02-24');
  assert.equal(wrapup.config.campaignEnd, '2026-03-20');
  assert.equal(wrapup.config.beforeStart, '2026-01-27');
  assert.equal(wrapup.config.beforeEnd, '2026-02-23');
  assert.equal(wrapup.config.afterStart, '2026-03-21');
  assert.equal(wrapup.config.afterEnd, '2026-04-17');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 02-23: Jameson Fiber Driver + Air Boost',
    '[SALES] Performance Max | 02-23: Jameson Fiber Driver + Air Boost',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/fiber-installation',
    '/product-category/fiber-installation',
    '/fiber-blowing',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumScopedPageRules, [
    { pagePath: '/fiber-installation/', sources: ['google'], mediums: ['cpc'], start: '2026-02-24', end: '2026-03-20' },
    { pagePath: '/products', sources: ['google'], mediums: ['cpc'], start: '2026-02-24', end: '2026-03-20' },
    { pagePath: '/contact', sources: ['google'], mediums: ['cpc'], start: '2026-02-24', end: '2026-03-20' },
    { pagePath: '/fish-tapes-fish-rods', sources: ['google'], mediums: ['cpc'], start: '2026-02-24', end: '2026-03-20' },
    { pagePath: '/where-to-buy', sources: ['google'], mediums: ['cpc'], start: '2026-02-24', end: '2026-03-20' },
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(before.ga4_sessions, 240);
  assert.equal(before.ga4_engaged_sessions, 101);
  assert.equal(during.ad_impressions, 204911);
  assert.equal(during.ad_clicks, 3961);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 1958.74);
  assert.equal(during.ad_conversions, 277);
  assert.equal(during.ad_purchases, 6);
  assert.equal(Math.round(during.ad_revenue * 100) / 100, 2000.76);
  assert.equal(during.ga4_sessions, 785);
  assert.equal(during.ga4_engaged_sessions, 469);
  assert.equal(during.ga4_purchases, 8);
  assert.equal(Math.round(during.ga4_total_revenue * 100) / 100, 721.95);
  assert.equal(during.email_total_sent, 3242);
  assert.equal(during.email_opens, 604);
  assert.equal(during.email_clicks, 82);
  assert.equal(after.ga4_sessions, 204);
  assert.equal(after.ga4_engaged_sessions, 72);

  for (const [label, summary] of [['before', before], ['after', after]] as const) {
    assert.equal(summary.ad_impressions, 0, `Expected ${label} paid impressions to be zero`);
    assert.equal(summary.ad_clicks, 0, `Expected ${label} paid clicks to be zero`);
    assert.equal(Math.round(summary.ad_cost * 100) / 100, 0, `Expected ${label} paid spend to be zero`);
    assert.equal(summary.ad_conversions, 0, `Expected ${label} paid conversions to be zero`);
    assert.equal(summary.ad_purchases, 0, `Expected ${label} ad purchases to be zero`);
    assert.equal(Math.round(summary.ad_revenue * 100) / 100, 0, `Expected ${label} ad revenue to be zero`);
  }

  const meta = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  assert.ok(meta, 'Expected Meta/Facebook lead ads breakout row');
  assert.equal(meta.label, 'Facebook Lead Ads');
  assert.equal(meta.leads, 211);
  assert.equal(meta.clicks, 3363);
  assert.equal(Math.round(meta.cost * 100) / 100, 980.65);

  const google = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(google, 'Expected Google/on-site breakout row');
  assert.equal(google.leads, 66);
  assert.equal(google.clicks, 598);
  assert.equal(Math.round(google.cost * 100) / 100, 978.09);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.name, '02-23 Jameson Fiber Driver + Air Boost');
  assert.equal(wrapup.emailDetails[0]?.date, '2026-02-24');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 3242);
  assert.equal(wrapup.emailDetails[0]?.opens, 604);
  assert.equal(wrapup.emailDetails[0]?.clicks, 82);

  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc traffic row');
  assert.equal(googleCpc.ga4_sessions, 581);
  assert.equal(googleCpc.ga4_engaged_sessions, 389);
  assert.equal(googleCpc.tracked_leads, 66);
  assert.equal(googleCpc.ga4_purchases, 8);

  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid tracked-leads row');
  assert.equal(fbPaid.tracked_leads, 211);

  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0), during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, during.ad_conversions,
    'Expected outcome attribution to use de-duplicated campaign conversion total',
  );
  assert.equal(wrapup.outcomeAttribution.totalSessions, 785);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 469);

  assert.ok(wrapup.metaAds.length > 0, 'Expected Meta creative rows for Fiber Driver + Air Boost');
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl), 'Expected Fiber Meta creative preview URLs');
  assert.ok(wrapup.metaAds.some((ad) => ad.finalCreativeLink), 'Expected Fiber Meta creative media links');

  console.log('Jameson Fiber Driver + Air Boost wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
