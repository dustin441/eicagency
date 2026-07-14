import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-fiber-driver-air-boost-awareness-2026-06-02');
  assert.ok(wrapup, 'Expected June Fiber Driver with Air Boost wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Air Boost');
  assert.equal(wrapup.config.parentProduct, 'Fiber Drivers');
  assert.equal(wrapup.config.campaignStart, '2026-06-02');
  assert.equal(wrapup.config.campaignEnd, '2026-06-26');
  assert.equal(wrapup.config.beforeStart, '2026-05-05');
  assert.equal(wrapup.config.beforeEnd, '2026-06-01');
  assert.equal(wrapup.config.afterStart, '2026-06-27');
  assert.equal(wrapup.config.afterEnd, '2026-07-24');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 06-01: Fiber Driver- Fiber Driver with Air Boost',
    '[SALES] Performance Max | 06-01: Fiber Driver- Fiber Driver with Air Boost',
  ]);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('V2 rows are excluded')),
    'Expected V2 exclusion caveat'
  );

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/jameson-fiber-driver-fiber-driver-w-airboost']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Broader category pages')),
    'Expected broad category page exclusion caveat'
  );
  assert.ok(
    wrapup.config.executiveSummary.includes('campaign page only'),
    'Expected executive summary to describe campaign-page-only GA4 scope'
  );

  assert.equal(before.ga4_sessions, 43);
  assert.equal(before.ga4_engaged_sessions, 19);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 57058);
  assert.equal(during.ad_clicks, 2281);
  assert.ok(Math.abs(during.ad_cost - 1336.9019) < 0.001);
  assert.equal(during.ad_conversions, 133);
  assert.equal(during.ad_purchases, 4);
  assert.ok(Math.abs(during.ad_revenue - 2662.29) < 0.001);
  assert.equal(during.ga4_sessions, 999);
  assert.equal(during.ga4_engaged_sessions, 428);
  assert.equal(during.ga4_purchases, 10);
  assert.ok(Math.abs(during.ga4_total_revenue - 2566.1) < 0.001);
  assert.equal(during.email_total_sent, 6721);
  assert.equal(during.email_opens, 1352);
  assert.equal(during.email_clicks, 80);

  assert.equal(after.ga4_sessions, 0);
  assert.equal(after.ga4_engaged_sessions, 0);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.clicks, 2281);
  assert.equal(wrapup.paidOverview.leads, 133);
  assert.equal(wrapup.paidOverview.purchases, 4);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1336.9019) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 10.051893984962405) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 1.9913877001745606) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 133);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 999);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 428);

  assert.equal(wrapup.emailDetails.length, 2);
  assert.deepEqual(wrapup.emailDetails.map((email) => email.date), ['2026-06-16', '2026-06-16']);
  assert.deepEqual(wrapup.emailDetails.map((email) => email.name), [
    '06-01: Fiber Driver w/Air Boost-A Version (closed)',
    '06-01: Fiber Driver w/Air Boost-B Version (open)',
  ]);
  assert.equal(wrapup.emailDetails.reduce((sum, email) => sum + email.totalSent, 0), 6721);
  assert.equal(wrapup.emailDetails.reduce((sum, email) => sum + email.opens, 0), 1352);
  assert.equal(wrapup.emailDetails.reduce((sum, email) => sum + email.clicks, 0), 80);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta Website Conversions breakout row');
  assert.equal(metaBreakdown.clicks, 1913);
  assert.equal(metaBreakdown.leads, 95);
  assert.ok(Math.abs(metaBreakdown.cost - 838.07) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout row');
  assert.equal(googleBreakdown.clicks, 368);
  assert.equal(googleBreakdown.leads, 38);
  assert.ok(Math.abs(googleBreakdown.cost - 498.8319) < 0.001);

  assert.equal(wrapup.metaAds.length, 20);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google / cpc source/medium row for campaign-page GA4 sessions');
  assert.equal(googleCpc.ga4_sessions, 292);
  assert.equal(googleCpc.ga4_purchases, 2);
  assert.ok(Math.abs(googleCpc.ga4_total_revenue - 1178.92) < 0.001);

  const facebookReferral = wrapup.sourceMediumRows.find((row) => row.label === 'm.facebook.com' && row.sublabel === 'referral');
  assert.ok(facebookReferral, 'Expected m.facebook.com / referral row for campaign-page GA4 sessions');
  assert.equal(facebookReferral.ga4_sessions, 224);
  assert.equal(facebookReferral.ga4_purchases, 8);
  assert.ok(Math.abs(facebookReferral.ga4_total_revenue - 1387.18) < 0.001);

  console.log('Jameson Fiber Driver with Air Boost Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
