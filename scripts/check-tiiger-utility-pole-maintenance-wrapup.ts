import assert from 'node:assert/strict';
import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const productData = await fetchSpartacoProductData({
    brand: 'Tiiger',
    product: 'Pole Maintenance',
    channel: 'all',
    campaign: 'all',
    focus: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
    start: '2026-04-21',
    end: '2026-05-21',
    compStart: '2026-03-24',
    compEnd: '2026-04-20',
  });

  assert.equal(productData.summary.ad_impressions, 275504);
  assert.equal(productData.summary.ad_clicks, 3423);
  assert.equal(Math.round(productData.summary.ad_cost * 100) / 100, 2013.16);
  assert.equal(productData.summary.ad_conversions, 34);
  assert.equal(productData.summary.ga4_sessions, 1893);
  assert.equal(productData.summary.ga4_engaged_sessions, 499);
  assert.equal(productData.summary.email_total_sent, 7481);
  assert.equal(productData.summary.email_opens, 1390);
  assert.equal(productData.summary.email_clicks, 105);
  assert.ok(productData.filterOptions.products.includes('Pole Maintenance'),
    `Expected Tiiger Pole Maintenance to be available in product filters. Got: ${productData.filterOptions.products.join(', ')}`,
  );

  const wrapup = await fetchSpartacoProductWrapup('tiiger-utility-pole-maintenance-2026-04-21');
  assert.ok(wrapup, 'Expected Tiiger Utility Pole Maintenance wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Tiiger');
  assert.equal(wrapup.config.product, 'Pole Maintenance');
  assert.equal(wrapup.config.campaignStart, '2026-04-21');
  assert.equal(wrapup.config.campaignEnd, '2026-05-21');
  assert.equal(wrapup.config.beforeStart, '2026-03-24');
  assert.equal(wrapup.config.beforeEnd, '2026-04-20');
  assert.equal(wrapup.config.afterStart, '2026-05-22');
  assert.equal(wrapup.config.afterEnd, '2026-06-18');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Tiiger | 4-20: Utility Pole Maintenance',
    '[LEAD] Tiiger | P.Max | 4-20: Utility Pole Maintenance',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/lp/tiiger-pole-maintenance',
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(before.ga4_sessions, 84);
  assert.equal(before.ga4_engaged_sessions, 20);
  assert.equal(during.ad_impressions, 275504);
  assert.equal(during.ad_clicks, 3423);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 2013.16);
  assert.equal(during.ad_conversions, 34);
  assert.equal(during.ga4_sessions, 1891);
  assert.equal(during.ga4_engaged_sessions, 499);
  assert.equal(during.email_total_sent, 7481);
  assert.equal(during.email_opens, 1390);
  assert.equal(during.email_clicks, 105);
  assert.equal(after.ga4_sessions, 14);
  assert.equal(after.ga4_engaged_sessions, 5);

  const metaLeadAds = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  assert.ok(metaLeadAds, 'Expected Meta lead ads breakout row');
  assert.equal(metaLeadAds.label, 'Meta Website Conversions');
  assert.equal(metaLeadAds.leads, 21);
  assert.equal(metaLeadAds.clicks, 2359);
  assert.equal(Math.round(metaLeadAds.cost * 100) / 100, 1036.89);

  const onsiteGoogle = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(onsiteGoogle, 'Expected on-site / Google Ads breakout row');
  assert.equal(onsiteGoogle.leads, 13);
  assert.equal(onsiteGoogle.clicks, 1064);
  assert.equal(Math.round(onsiteGoogle.cost * 100) / 100, 976.27);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.name, '04-20 Utility Pole Maintenance: Pole Pullers');
  assert.equal(wrapup.emailDetails[0]?.date, '2026-04-21');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 7481);
  assert.equal(wrapup.emailDetails[0]?.opens, 1390);
  assert.equal(wrapup.emailDetails[0]?.clicks, 105);

  assert.equal(wrapup.emailBenchmark.productSent, 7481);
  assert.equal(wrapup.emailBenchmark.productClicks, 105);
  assert.equal(Math.round(wrapup.emailBenchmark.productOpenRate * 10000) / 100, 18.58);
  assert.equal(Math.round(wrapup.emailBenchmark.productClickRate * 10000) / 100, 1.4);

  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc traffic row');
  assert.equal(googleCpc.ga4_sessions, 608);
  assert.equal(googleCpc.ga4_engaged_sessions, 163);
  assert.equal(googleCpc.tracked_leads, 13);

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1891);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 499);

  assert.ok(wrapup.metaAds.length > 0, 'Expected Meta creative rows for Tiiger Utility Pole Maintenance');
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl), 'Expected Tiiger Utility Meta creative preview URLs');
  assert.ok(wrapup.metaAds.some((ad) => ad.finalCreativeLink), 'Expected Tiiger Utility Meta creative media links');

  console.log('Tiiger Utility Pole Maintenance wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
