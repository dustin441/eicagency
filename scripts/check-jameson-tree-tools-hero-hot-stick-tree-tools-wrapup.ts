import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-tree-tools-hero-hot-stick-tree-tools-2026-06-04');
  assert.ok(wrapup, 'Expected HERO Hot Stick Tree Tools wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Hot-Stick');
  assert.equal(wrapup.config.parentProduct, 'Hot-Stick');
  assert.equal(wrapup.config.campaignStart, '2026-06-04');
  assert.equal(wrapup.config.campaignEnd, '2026-06-26');
  assert.equal(wrapup.config.beforeStart, '2026-05-07');
  assert.equal(wrapup.config.beforeEnd, '2026-06-03');
  assert.equal(wrapup.config.afterStart, '2026-06-27');
  assert.equal(wrapup.config.afterEnd, '2026-07-24');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Performance Max | 06-01: Tree Tools-HERO Hot Stick Tree Tools',
    '[LEAD] 06-01: Tree Tools-HERO Hot Stick Tree Tools',
    '[LEAD] 06-01: Tree Tools-HERO Hot Stick Tree Tools | Lead Ads',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/lp/hot-stick-tools',
    '/lp/jameson-folding-pole-saw-with-universal-hotstick-adapter',
  ]);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('2026-06-26') && caveat.includes('match Monday.com')),
    'Expected caveat to preserve Monday.com 6/26 date nuance'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('03-02 Hot-Stick Tree Tools') && caveat.includes('excluded')),
    'Expected caveat to exclude earlier March Hot-Stick flight'
  );

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 74);
  assert.equal(before.ga4_engaged_sessions, 36);
  assert.equal(before.ga4_purchases, 2);
  assert.ok(Math.abs(before.ga4_total_revenue - 81.37) < 0.001);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 85476);
  assert.equal(during.ad_clicks, 2936);
  assert.ok(Math.abs(during.ad_cost - 2504.9435) < 0.001);
  assert.equal(during.ad_conversions, 101);
  assert.equal(during.ad_purchases, 1);
  assert.ok(Math.abs(during.ad_revenue - 272.28) < 0.001);
  assert.equal(during.ga4_sessions, 1350);
  assert.equal(during.ga4_engaged_sessions, 546);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 7579);
  assert.equal(during.email_opens, 2326);
  assert.equal(during.email_clicks, 162);

  assert.equal(after.ga4_sessions, 11);
  assert.equal(after.ga4_engaged_sessions, 7);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.impressions, 85476);
  assert.equal(wrapup.paidOverview.clicks, 2936);
  assert.equal(wrapup.paidOverview.leads, 101);
  assert.equal(wrapup.paidOverview.purchases, 1);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 2504.9435) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 24.801420792079206) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 0.10869706242875338) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 101);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1350);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 546);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-06-11');
  assert.equal(wrapup.emailDetails[0]?.name, '06-01: Tree Tools-HERO Hot Stick Tree Tools');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 7579);
  assert.equal(wrapup.emailDetails[0]?.opens, 2326);
  assert.equal(wrapup.emailDetails[0]?.clicks, 162);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Facebook Lead Ads breakout');
  assert.equal(metaBreakdown.impressions, 42355);
  assert.equal(metaBreakdown.clicks, 1420);
  assert.equal(metaBreakdown.leads, 56);
  assert.ok(Math.abs(metaBreakdown.cost - 1173.35) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 43121);
  assert.equal(googleBreakdown.clicks, 1516);
  assert.equal(googleBreakdown.leads, 45);
  assert.ok(Math.abs(googleBreakdown.cost - 1331.5935) < 0.001);

  assert.equal(wrapup.metaAds.length, 18);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 697);
  assert.equal(googleCpc.tracked_leads, 45);

  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb paid row for tracked Meta leads');
  assert.equal(fbPaid.tracked_leads, 56);

  console.log('Jameson Tree Tools HERO Hot Stick Tree Tools wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
