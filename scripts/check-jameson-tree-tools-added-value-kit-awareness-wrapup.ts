import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-tree-tools-added-value-kit-awareness-2026-03-19');
  assert.ok(wrapup, 'Expected Added Value Kit Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Added Value Kit');
  assert.equal(wrapup.config.parentProduct, 'Added Value Kit');
  assert.equal(wrapup.config.campaignStart, '2026-03-18');
  assert.equal(wrapup.config.campaignEnd, '2026-04-10');
  assert.equal(wrapup.config.beforeStart, '2026-02-18');
  assert.equal(wrapup.config.beforeEnd, '2026-03-17');
  assert.equal(wrapup.config.afterStart, '2026-04-11');
  assert.equal(wrapup.config.afterEnd, '2026-05-08');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Performance Max | 03-23: Tree Tools-Added Value Kit',
    '[LEAD] 03-23: Tree Tools-Added Value Kit',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/lp/jameson-value-added-tree-care-tools',
    '/lp/jameson-value-added-tree-care-tools/',
  ]);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Monday.com') && caveat.includes('2026-03-18') && caveat.includes('2026-04-10')),
    'Expected caveat to preserve Monday.com 3/18-4/10 reporting window'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Jameson Tree Tools: Added Value Kit-Awareness') && caveat.includes('avoid double counting')),
    'Expected caveat to exclude renamed duplicate Meta row'
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
  assert.equal(before.ga4_sessions, 0);
  assert.equal(before.ga4_engaged_sessions, 0);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 87814);
  assert.equal(during.ad_clicks, 2405);
  assert.ok(Math.abs(during.ad_cost - 2024.6069) < 0.001);
  assert.equal(during.ad_conversions, 41);
  assert.equal(during.ad_purchases, 11);
  assert.ok(Math.abs(during.ad_revenue - 2272.16) < 0.001);
  assert.equal(during.ga4_sessions, 1697);
  assert.equal(during.ga4_engaged_sessions, 814);
  assert.equal(during.ga4_purchases, 21);
  assert.ok(Math.abs(during.ga4_total_revenue - 106.52) < 0.001);
  assert.equal(during.email_total_sent, 23355);
  assert.equal(during.email_opens, 4156);
  assert.equal(during.email_clicks, 278);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 31);
  assert.equal(after.ga4_engaged_sessions, 5);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 87814);
  assert.equal(wrapup.paidOverview.clicks, 2405);
  assert.equal(wrapup.paidOverview.leads, 41);
  assert.equal(wrapup.paidOverview.purchases, 11);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 2024.6069) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.revenue - 2272.16) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 49.38065609756099) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 1.1222721803427615) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 41);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 21);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 11);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1697);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 814);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta Website Conversions breakout');
  assert.equal(metaBreakdown.impressions, 30368);
  assert.equal(metaBreakdown.clicks, 1285);
  assert.equal(metaBreakdown.leads, 28);
  assert.ok(Math.abs(metaBreakdown.cost - 1167.04) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 41.68) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 57446);
  assert.equal(googleBreakdown.clicks, 1120);
  assert.equal(googleBreakdown.leads, 13);
  assert.ok(Math.abs(googleBreakdown.cost - 857.5669) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 65.96668461538462) < 0.001);

  assert.equal(wrapup.emailDetails.length, 3);
  const emailByName = new Map(wrapup.emailDetails.map((email) => [email.name, email]));
  assert.equal(emailByName.get('03-23 Tree Tools : Added Value Kit - email 1')?.date, '2026-03-25');
  assert.equal(emailByName.get('03-23 Tree Tools : Added Value Kit - email 1')?.totalSent, 7801);
  assert.equal(emailByName.get('03-23 Tree Tools: Added Value Kit email #2')?.date, '2026-04-01');
  assert.equal(emailByName.get('03-23 Tree Tools: Added Value Kit email #2')?.clicks, 88);
  assert.equal(emailByName.get('03-23 Tree Tools: Added Value Kit - email #3')?.date, '2026-04-09');
  assert.equal(emailByName.get('03-23 Tree Tools: Added Value Kit - email #3')?.opens, 1286);
  assert.equal(emailByName.has('03-23 Tree Tools: Added Value Kit - Distributors Only'), false);

  assert.equal(wrapup.metaAds.length, 12);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.adName.includes('03-23: Tree Tools-Added Value Kit'));
    assert.ok(ad.destinationUrl?.startsWith('https://jamesontools.com/lp/jameson-value-added-tree-care-tools'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 553);
  assert.equal(googleCpc.tracked_leads, 13);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row for Meta tracked conversions');
  assert.equal(fbPaid.tracked_leads, 28);
  const metaReferral = wrapup.sourceMediumRows.find((row) => row.label === 'm.facebook.com' && row.sublabel === 'referral');
  assert.ok(metaReferral, 'Expected m.facebook.com referral source-medium row');
  assert.equal(metaReferral.ga4_purchases, 21);
  assert.ok(Math.abs(metaReferral.ga4_total_revenue - 106.52) < 0.001);

  assert.ok(
    wrapup.config.executiveSummary.includes('87.8K paid impressions')
      && wrapup.config.executiveSummary.includes('41 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/jameson-value-added-tree-care-tools'),
    'Expected executive summary to preserve Added Value Kit performance and LP-only scope'
  );

  console.log('Jameson Tree Tools Added Value Kit Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
