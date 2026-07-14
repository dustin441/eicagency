import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-aluminum-poles-awareness-2026-02-18');
  assert.ok(wrapup, 'Expected Aluminum Poles Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Aluminum Poles');
  assert.equal(wrapup.config.parentProduct, 'Tree Tools & Poles');
  assert.equal(wrapup.config.campaignStart, '2026-02-18');
  assert.equal(wrapup.config.campaignEnd, '2026-03-13');
  assert.equal(wrapup.config.beforeStart, '2026-01-21');
  assert.equal(wrapup.config.beforeEnd, '2026-02-17');
  assert.equal(wrapup.config.afterStart, '2026-03-14');
  assert.equal(wrapup.config.afterEnd, '2026-04-10');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Performance Max | 02-16: Jameson Aluminum Poles',
    '[LEAD] 02-16: Jameson Aluminum Poles',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/jameson-aluminum-telescoping-pole']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('2026-02-18') && caveat.includes('Meta begins on 2026-02-19')),
    'Expected caveat to preserve 02-16 label vs 2/18 source-date nuance'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('RMKT + Primer Audiences') && caveat.includes('avoid double counting')),
    'Expected caveat to exclude the duplicate/renamed Meta row'
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
  assert.equal(before.ga4_sessions, 41);
  assert.equal(before.ga4_engaged_sessions, 26);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 92108);
  assert.equal(during.ad_clicks, 2919);
  assert.ok(Math.abs(during.ad_cost - 1887.1031) < 0.001);
  assert.equal(during.ad_conversions, 65);
  assert.equal(during.ad_purchases, 3);
  assert.ok(Math.abs(during.ad_revenue - 1783.16) < 0.001);
  assert.equal(during.ga4_sessions, 1614);
  assert.equal(during.ga4_engaged_sessions, 1007);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 7926);
  assert.equal(during.email_opens, 1300);
  assert.equal(during.email_clicks, 108);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 22);
  assert.equal(after.ga4_engaged_sessions, 9);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 92108);
  assert.equal(wrapup.paidOverview.clicks, 2919);
  assert.equal(wrapup.paidOverview.leads, 65);
  assert.equal(wrapup.paidOverview.purchases, 3);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1887.1031) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.revenue - 1783.16) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 29.03235538461539) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 0.9449192256639289) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 65);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 0);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 3);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1614);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1007);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta Website Conversions breakout');
  assert.equal(metaBreakdown.impressions, 53211);
  assert.equal(metaBreakdown.clicks, 2249);
  assert.equal(metaBreakdown.leads, 21);
  assert.ok(Math.abs(metaBreakdown.cost - 738.67) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 35.1747619047619) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 38897);
  assert.equal(googleBreakdown.clicks, 670);
  assert.equal(googleBreakdown.leads, 44);
  assert.ok(Math.abs(googleBreakdown.cost - 1148.4331) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 26.100752272727277) < 0.001);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-02-18');
  assert.equal(wrapup.emailDetails[0]?.name, '02-16 Jameson Aluminum Poles');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 7926);
  assert.equal(wrapup.emailDetails[0]?.opens, 1300);
  assert.equal(wrapup.emailDetails[0]?.clicks, 108);

  assert.equal(wrapup.metaAds.length, 2);
  for (const ad of wrapup.metaAds) {
    assert.equal(ad.adName, '02-16: Jameson Aluminum Poles Video');
    assert.ok(ad.destinationUrl?.startsWith('https://jamesontools.com/lp/jameson-aluminum-telescoping-pole'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 365);
  assert.equal(googleCpc.tracked_leads, 44);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row for Meta tracked conversions');
  assert.equal(fbPaid.tracked_leads, 21);

  assert.ok(
    wrapup.config.executiveSummary.includes('92.1K paid impressions')
      && wrapup.config.executiveSummary.includes('65 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/jameson-aluminum-telescoping-pole'),
    'Expected executive summary to preserve Aluminum Poles performance and LP-only scope'
  );

  console.log('Jameson Aluminum Poles Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
