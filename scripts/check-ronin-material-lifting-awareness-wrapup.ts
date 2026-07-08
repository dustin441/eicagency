import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('ronin-material-lifting-awareness-2026-04-23');
  assert.ok(wrapup, 'Expected Ronin Material Lifting Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Ronin');
  assert.equal(wrapup.config.product, 'Material Lifting');
  assert.equal(wrapup.config.parentProduct, 'Material Lifting');
  assert.equal(wrapup.config.campaignStart, '2026-04-23');
  assert.equal(wrapup.config.campaignEnd, '2026-05-22');
  assert.equal(wrapup.config.beforeStart, '2026-03-26');
  assert.equal(wrapup.config.beforeEnd, '2026-04-22');
  assert.equal(wrapup.config.afterStart, '2026-05-23');
  assert.equal(wrapup.config.afterEnd, '2026-06-19');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[SALES] 4-20: Ronin-Material Lifting',
    '[LEAD] 4-20: Ronin-Material Lifting',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/ronin-tl-power-ascender-material-handling']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('4-20') && caveat.includes('2026-04-23') && caveat.includes('2026-05-22')),
    'Expected caveat to preserve 4-20 label vs 4/23 first source date'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('fb.me') && caveat.includes('material-handling landing page')),
    'Expected caveat to explain mixed Meta destinations'
  );

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ad_impressions, 0);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);
  assert.equal(before.ga4_sessions, 96);
  assert.equal(before.ga4_engaged_sessions, 34);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 215541);
  assert.equal(during.ad_clicks, 5382);
  assert.ok(Math.abs(during.ad_cost - 4019.1803) < 0.001);
  assert.equal(during.ad_conversions, 138);
  assert.equal(during.ad_purchases, 1);
  assert.equal(during.ad_revenue, 0);
  assert.equal(during.ga4_sessions, 3312);
  assert.equal(during.ga4_engaged_sessions, 1326);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 15483);
  assert.equal(during.email_opens, 2846);
  assert.equal(during.email_clicks, 1394);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 15);
  assert.equal(after.ga4_engaged_sessions, 4);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 215541);
  assert.equal(wrapup.paidOverview.clicks, 5382);
  assert.equal(wrapup.paidOverview.leads, 138);
  assert.equal(wrapup.paidOverview.purchases, 1);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 4019.1803) < 0.001);
  assert.equal(wrapup.paidOverview.revenue, 0);
  assert.equal(wrapup.paidOverview.roas, 0);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 29.124494927536233) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 138);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 0);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 1);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 3312);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1326);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Facebook Lead Ads breakout for Ronin Meta rows');
  assert.equal(metaBreakdown.impressions, 139221);
  assert.equal(metaBreakdown.clicks, 4185);
  assert.equal(metaBreakdown.leads, 127);
  assert.ok(Math.abs(metaBreakdown.cost - 2627.84) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 20.691653543307087) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google breakout');
  assert.equal(googleBreakdown.impressions, 76320);
  assert.equal(googleBreakdown.clicks, 1197);
  assert.equal(googleBreakdown.leads, 11);
  assert.ok(Math.abs(googleBreakdown.cost - 1391.3403) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 126.48548181818181) < 0.001);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-04-30');
  assert.equal(wrapup.emailDetails[0]?.name, '04-20 Ronin Material Handling');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 15483);
  assert.equal(wrapup.emailDetails[0]?.opens, 2846);
  assert.equal(wrapup.emailDetails[0]?.clicks, 1394);

  assert.equal(wrapup.metaAds.length, 20);
  assert.ok(wrapup.metaAds.some((ad) => ad.destinationUrl === 'http://fb.me/' && ad.leads >= 50));
  assert.ok(wrapup.metaAds.some((ad) => ad.destinationUrl?.includes('/lp/ronin-tl-power-ascender-material-handling/') && ad.leads > 0));
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.campaignName === '[LEAD] 4-20: Ronin-Material Lifting');
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row');
  assert.equal(fbPaid.ga4_sessions, 1528);
  assert.equal(fbPaid.tracked_leads, 127);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 817);
  assert.equal(googleCpc.tracked_leads, 11);
  const igPaid = wrapup.sourceMediumRows.find((row) => row.label === 'ig' && row.sublabel === 'paid');
  assert.ok(igPaid, 'Expected ig/paid source-medium row');
  assert.equal(igPaid.ga4_sessions, 266);

  assert.ok(
    wrapup.config.executiveSummary.includes('215.5K paid impressions')
      && wrapup.config.executiveSummary.includes('138 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/ronin-tl-power-ascender-material-handling'),
    'Expected executive summary to preserve Ronin Material Lifting performance and LP-only scope'
  );

  console.log('Ronin Material Lifting Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
