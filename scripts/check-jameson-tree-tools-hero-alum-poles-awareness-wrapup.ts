import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-tree-tools-hero-alum-poles-awareness-2026-04-21');
  assert.ok(wrapup, 'Expected HERO Alum Poles Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Aluminum Poles');
  assert.equal(wrapup.config.parentProduct, 'Tree Tools & Poles');
  assert.equal(wrapup.config.campaignStart, '2026-04-21');
  assert.equal(wrapup.config.campaignEnd, '2026-05-22');
  assert.equal(wrapup.config.beforeStart, '2026-03-24');
  assert.equal(wrapup.config.beforeEnd, '2026-04-20');
  assert.equal(wrapup.config.afterStart, '2026-05-23');
  assert.equal(wrapup.config.afterEnd, '2026-06-19');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Performance Max | 4-20: Tree Tools-HERO Alum Poles',
    '[LEAD] 4-20: Tree Tools-HERO Alum Poles',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/jameson-aluminum-ta-12f-ta-16f-telescoping-pole']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('4-20') && caveat.includes('2026-04-21') && caveat.includes('2026-05-22')),
    'Expected caveat to preserve 4-20 label vs 4/21 first source date'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('[LEAD] HERO Alum Poles') && caveat.includes('Ronin-labeled') && caveat.includes('avoid double counting')),
    'Expected caveat to exclude overlapping short-lived Meta row and Ronin PMax row'
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
  assert.equal(before.ga4_sessions, 33);
  assert.equal(before.ga4_engaged_sessions, 14);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 154041);
  assert.equal(during.ad_clicks, 6026);
  assert.ok(Math.abs(during.ad_cost - 2019.3396) < 0.001);
  assert.equal(during.ad_conversions, 118);
  assert.equal(during.ad_purchases, 5);
  assert.ok(Math.abs(during.ad_revenue - 2868.36) < 0.001);
  assert.equal(during.ga4_sessions, 4116);
  assert.equal(during.ga4_engaged_sessions, 1617);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 7773);
  assert.equal(during.email_opens, 1331);
  assert.equal(during.email_clicks, 115);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 25);
  assert.equal(after.ga4_engaged_sessions, 10);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 154041);
  assert.equal(wrapup.paidOverview.clicks, 6026);
  assert.equal(wrapup.paidOverview.leads, 118);
  assert.equal(wrapup.paidOverview.purchases, 5);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 2019.3396) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.revenue - 2868.36) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 17.113047457627115) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 1.4204445849524274) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 118);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 0);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 5);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 4116);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1617);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta Website Conversions breakout');
  assert.equal(metaBreakdown.impressions, 58653);
  assert.equal(metaBreakdown.clicks, 2972);
  assert.equal(metaBreakdown.leads, 33);
  assert.ok(Math.abs(metaBreakdown.cost - 1183.69) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 35.869393939393944) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 95388);
  assert.equal(googleBreakdown.clicks, 3054);
  assert.equal(googleBreakdown.leads, 85);
  assert.ok(Math.abs(googleBreakdown.cost - 835.6496) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 9.831171764705884) < 0.001);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-04-21');
  assert.equal(wrapup.emailDetails[0]?.name, '04-20 Tree Tools HERO Aluminum Poles*');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 7773);
  assert.equal(wrapup.emailDetails[0]?.opens, 1331);
  assert.equal(wrapup.emailDetails[0]?.clicks, 115);

  assert.equal(wrapup.metaAds.length, 6);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.adName.includes('4-20: Tree Tools-HERO Alum Poles'));
    assert.ok(ad.destinationUrl?.startsWith('https://jamesontools.com/lp/jameson-aluminum-ta-12f-ta-16f-telescoping-pole'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 2419);
  assert.equal(googleCpc.tracked_leads, 85);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row for Meta tracked conversions');
  assert.equal(fbPaid.tracked_leads, 33);
  const facebookReferral = wrapup.sourceMediumRows.find((row) => row.label === 'facebook.com' && row.sublabel === 'referral');
  assert.ok(facebookReferral, 'Expected facebook.com referral source-medium row');
  assert.equal(facebookReferral.ga4_sessions, 584);

  assert.ok(
    wrapup.config.executiveSummary.includes('154.0K paid impressions')
      && wrapup.config.executiveSummary.includes('118 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/jameson-aluminum-ta-12f-ta-16f-telescoping-pole'),
    'Expected executive summary to preserve HERO Alum Poles performance and LP-only scope'
  );

  console.log('Jameson Tree Tools HERO Alum Poles Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
