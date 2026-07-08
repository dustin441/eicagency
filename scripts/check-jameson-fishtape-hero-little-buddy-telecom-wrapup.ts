import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-fishtape-hero-little-buddy-telecom-2026-03-26');
  assert.ok(wrapup, 'Expected Fishtape wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Little Buddy');
  assert.equal(wrapup.config.parentProduct, 'Fishtape / Little Buddy');
  assert.equal(wrapup.config.campaignStart, '2026-03-26');
  assert.equal(wrapup.config.campaignEnd, '2026-04-30');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[SALES] Performance Max | 4-06: Fishtape: HERO Little Buddy-Telecom',
    '[LEAD] 4-06: Fishtape: HERO Little Buddy-Telecom',
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 222);
  assert.equal(before.ga4_engaged_sessions, 79);
  assert.equal(before.ga4_purchases, 0);
  assert.ok(Math.abs(before.ga4_total_revenue - 0) < 0.001);
  assert.equal(after.ga4_sessions, 244);
  assert.equal(after.ga4_engaged_sessions, 122);

  assert.equal(during.ad_impressions, 25279);
  assert.equal(during.ad_clicks, 818);
  assert.ok(Math.abs(during.ad_cost - 997.8694) < 0.001);
  assert.equal(during.ad_conversions, 121);
  assert.equal(during.ad_purchases, 6);
  assert.ok(Math.abs(during.ad_revenue - 5701.49) < 0.001);
  assert.equal(during.ga4_sessions, 963);
  assert.equal(during.ga4_engaged_sessions, 331);
  assert.equal(during.ga4_purchases, 6);
  assert.ok(Math.abs(during.ga4_total_revenue - 3341.85) < 0.001);
  assert.equal(during.email_total_sent, 18428);
  assert.equal(during.email_opens, 2491);
  assert.equal(during.email_clicks, 219);

  assert.equal(wrapup.paidOverview.clicks, 818);
  assert.equal(wrapup.paidOverview.leads, 121);
  assert.equal(wrapup.paidOverview.purchases, 6);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 121);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 963);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 331);

  assert.equal(wrapup.emailDetails.length, 3);
  assert.deepEqual(wrapup.emailDetails.map((email) => email.date), [
    '2026-04-08',
    '2026-04-15',
    '2026-04-22',
  ]);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta to be labeled as website conversions/traffic, not native lead ads');
  assert.equal(metaBreakdown.clicks, 121);
  assert.equal(metaBreakdown.leads, 0);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.clicks, 697);
  assert.equal(googleBreakdown.leads, 121);

  assert.equal(wrapup.metaAds.length, 8);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleOrganic = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'organic');
  assert.ok(googleOrganic, 'Expected Google organic source-medium row');
  assert.equal(googleOrganic.ga4_purchases, 6);
  assert.ok(Math.abs(googleOrganic.ga4_total_revenue - 3341.85) < 0.001);

  assert.ok(
    wrapup.config.executiveSummary.includes('removing broader Rodder-category pages')
      && wrapup.config.executiveSummary.includes('no GA4 ecommerce purchases/revenue'),
    'Expected executive summary to explain the corrected Little Buddy/Fish Tape scope'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('previously observed 25 purchases / $15,577.16') && caveat.includes('broader Rodder category pages')),
    'Expected caveat to preserve why the earlier Rodder-heavy total was excluded'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('6 purchases and $3,341.85') && caveat.includes('google / organic')),
    'Expected caveat to preserve corrected campaign-period ecommerce source breakdown'
  );

  console.log('Jameson Fishtape HERO Little Buddy-Telecom wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
