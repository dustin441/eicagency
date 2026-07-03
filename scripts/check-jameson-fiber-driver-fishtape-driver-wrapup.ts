import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-fiber-driver-fishtape-driver-2026-05-07');
  assert.ok(wrapup, 'Expected Fiber Driver V1 wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Fiber Driver');
  assert.equal(wrapup.config.parentProduct, 'Fiber Drivers');
  assert.equal(wrapup.config.campaignStart, '2026-05-07');
  assert.equal(wrapup.config.campaignEnd, '2026-05-28');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 05-04: Fiber Driver V1: FISHTAPE DRIVER',
  ]);
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/lp/jameson-fiber-driver-fish-tape-driver'));

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 455);
  assert.equal(before.ga4_engaged_sessions, 224);
  assert.equal(before.ga4_purchases, 1);
  assert.ok(Math.abs(before.ga4_total_revenue - 349.73) < 0.001);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 175601);
  assert.equal(during.ad_clicks, 3106);
  assert.ok(Math.abs(during.ad_cost - 1506.39) < 0.001);
  assert.equal(during.ad_conversions, 128);
  assert.equal(during.ad_purchases, 2);
  assert.ok(Math.abs(during.ad_revenue - 941.4) < 0.001);
  assert.equal(during.ga4_sessions, 1623);
  assert.equal(during.ga4_engaged_sessions, 463);
  assert.equal(during.ga4_purchases, 2);
  assert.ok(Math.abs(during.ga4_total_revenue - 481.09) < 0.001);
  assert.equal(during.email_total_sent, 9173);
  assert.equal(during.email_opens, 2491);
  assert.equal(during.email_clicks, 1683);

  assert.equal(after.ga4_sessions, 559);
  assert.equal(after.ga4_engaged_sessions, 203);
  assert.equal(after.ga4_purchases, 8);
  assert.ok(Math.abs(after.ga4_total_revenue - 608.87) < 0.001);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.clicks, 3106);
  assert.equal(wrapup.paidOverview.leads, 128);
  assert.equal(wrapup.paidOverview.purchases, 2);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1506.39) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 11.768671875) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 0.6249377651205863) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 128);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1623);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 463);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-05-21');
  assert.equal(wrapup.emailDetails[0]?.name, '05-04: Fiber Driver-Fishtape Driver');
  assert.equal(wrapup.emailDetails[0]?.clicks, 1683);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Meta/Facebook lead ads breakout');
  assert.equal(metaBreakdown.clicks, 3106);
  assert.equal(metaBreakdown.leads, 128);
  assert.ok(Math.abs(metaBreakdown.cost - 1506.39) < 0.001);

  assert.equal(wrapup.metaAds.length, 20);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const direct = wrapup.sourceMediumRows.find((row) => row.label === '(direct)' && row.sublabel === '(none)');
  assert.ok(direct, 'Expected direct source-medium row');
  assert.equal(direct.ga4_purchases, 2);
  assert.ok(Math.abs(direct.ga4_total_revenue - 481.09) < 0.001);

  assert.ok(
    wrapup.config.executiveSummary.includes('Meta-only')
      && wrapup.config.executiveSummary.includes('1,623 campaign-period sessions'),
    'Expected executive summary to preserve Meta-only campaign framing'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('no matching Google row, Air Boost row, or V2 row')),
    'Expected caveat to confirm Air Boost/V2 rows are excluded from the exact campaign'
  );

  console.log('Jameson Fiber Driver V1: FISHTAPE DRIVER wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
