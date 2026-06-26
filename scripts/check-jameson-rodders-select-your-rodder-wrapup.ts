import assert from 'node:assert/strict';
import { fetchSpartacoProductData } from '../src/services/spartaco-product-analytics';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-rodders-select-your-rodder-2026-02-25');
  assert.ok(wrapup, 'Expected Jameson Rodders Select Your Rodder wrap-up');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Rodders');
  assert.equal(wrapup.config.parentProduct, 'Rodders');
  assert.equal(wrapup.config.campaignStart, '2026-02-25');
  assert.equal(wrapup.config.campaignEnd, '2026-03-20');
  assert.equal(wrapup.config.beforeStart, '2026-01-28');
  assert.equal(wrapup.config.beforeEnd, '2026-02-24');
  assert.equal(wrapup.config.afterStart, '2026-03-21');
  assert.equal(wrapup.config.afterEnd, '2026-04-17');

  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 02-23: Jameson Rodders - Select Your Rodder',
    '[LEAD] Performance Max | Conduit Rodders',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/duct-rodders',
    '/duct-rodders/selection-tool',
    '/duct-rodders/duct-rodder-selection-guide',
    '/duct-rodders/duct-hunter-selection-guide',
    '/lp/selector-tool-intro',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumScopedPageRules, [
    { pagePath: '/where-to-buy', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/fish-tapes-fish-rods', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/cable-reel-handling', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/products', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/fiber-installation', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/contact', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
    { pagePath: '/overhead-cable-tools', sources: ['google'], mediums: ['cpc', 'pmax'], channelGroups: ['Cross-network', 'Paid Search'], start: '2026-02-25', end: '2026-03-20' },
  ]);

  const productData = await fetchSpartacoProductData({
    brand: 'Jameson',
    product: 'Rodders',
    channel: 'all',
    campaign: 'all',
    focus: 'all',
    channelGroup: 'all',
    sourceMedium: 'all',
    start: '2026-02-25',
    end: '2026-03-20',
    compStart: '2026-01-28',
    compEnd: '2026-02-24',
  });
  assert.ok(productData.productRows.some((row) => row.product === 'Rodders'), 'Expected Rodders in product rows');

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected all comparison periods');

  assert.equal(before.ad_cost, 0);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);
  assert.equal(after.ad_cost, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(during.ad_impressions, 169804);
  assert.equal(during.ad_clicks, 2154);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 2377.00);
  assert.equal(during.ad_conversions, 31);
  assert.equal(during.ad_purchases, 4);
  assert.equal(Math.round(during.ad_revenue * 100) / 100, 5722.93);
  assert.equal(during.ga4_sessions, 1617);
  assert.equal(during.ga4_engaged_sessions, 921);
  assert.equal(during.ga4_purchases, 10);
  assert.equal(Math.round(during.ga4_total_revenue * 100) / 100, 1414.42);
  assert.equal(during.email_total_sent, 6095);
  assert.equal(during.email_opens, 1050);
  assert.equal(during.email_clicks, 190);

  assert.equal(wrapup.emailDetails.length, 2);
  assert.deepEqual(wrapup.emailDetails.map((email) => email.name).sort(), [
    '02-23 Jameson Rodders - Select Your Rodder',
    'Rodders In-Stock email',
  ].sort());
  assert.ok(!wrapup.emailDetails.some((email) => email.name.includes('competitor')), 'Competitor seed email should be excluded');

  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc traffic row');
  assert.equal(googleCpc.ga4_sessions, 952);
  assert.equal(googleCpc.ga4_engaged_sessions, 619);
  assert.equal(googleCpc.tracked_leads, 27);
  assert.equal(googleCpc.ga4_purchases, 10);

  const metaWebsite = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  assert.ok(metaWebsite, 'Expected Meta conversion breakout');
  assert.equal(metaWebsite.label, 'Meta Website Conversions');
  assert.equal(metaWebsite.leads, 4);
  assert.equal(Math.round(metaWebsite.cost * 100) / 100, 890.63);

  const onsiteGoogle = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(onsiteGoogle, 'Expected Google conversion breakout');
  assert.equal(onsiteGoogle.leads, 27);
  assert.equal(Math.round(onsiteGoogle.cost * 100) / 100, 1486.37);

  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 31);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1617);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 921);

  assert.ok(wrapup.metaAds.length > 0, 'Expected Meta creative rows for Rodders');
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl), 'Expected Rodders Meta creative preview URLs');
  assert.ok(wrapup.metaAds.some((ad) => ad.finalCreativeLink), 'Expected Rodders Meta creative media links');

  console.log('Jameson Rodders Select Your Rodder wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
