import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-hot-stick-tree-tools-2026-03-05');
  assert.ok(wrapup, 'Expected Hot-Stick Tree Tools wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Hot-Stick');
  assert.equal(wrapup.config.parentProduct, 'Hot-Stick');
  assert.equal(wrapup.config.campaignStart, '2026-03-05');
  assert.equal(wrapup.config.campaignEnd, '2026-03-27');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 03-02: Jameson Hot-Stick Tree Tools | Interests',
    '[LEAD] Performance Max | 03-02: Jameson Hot-Stick Tree Tools',
  ]);
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/lp/hot-stick-tools'));
  assert.ok(!wrapup.config.campaignNames.includes('[LEAD] Jameson Hot-Stick Tree Tools | Interests'));
  assert.ok(!wrapup.config.campaignNames.some((name) => name.includes('HERO')));

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 696);
  assert.equal(before.ga4_engaged_sessions, 68);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 53931);
  assert.equal(during.ad_clicks, 1587);
  assert.ok(Math.abs(during.ad_cost - 1367.2612) < 0.001);
  assert.equal(during.ad_conversions, 23);
  assert.equal(during.ad_purchases, 2);
  assert.ok(Math.abs(during.ad_revenue - 1009.58) < 0.001);
  assert.equal(during.ga4_sessions, 1316);
  assert.equal(during.ga4_engaged_sessions, 400);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 7449);
  assert.equal(during.email_opens, 1332);
  assert.equal(during.email_clicks, 124);

  assert.equal(after.ga4_sessions, 319);
  assert.equal(after.ga4_engaged_sessions, 102);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.clicks, 1587);
  assert.equal(wrapup.paidOverview.leads, 23);
  assert.equal(wrapup.paidOverview.purchases, 2);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1367.2612) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 59.44613913) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 23);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1316);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 400);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-03-05');
  assert.equal(wrapup.emailDetails[0]?.name, '03-02 Jameson Hot-Stick Tree Tools');
  assert.equal(wrapup.emailDetails[0]?.clicks, 124);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Meta/Facebook lead ads breakout');
  assert.equal(metaBreakdown.clicks, 1228);
  assert.equal(metaBreakdown.leads, 11);
  assert.ok(Math.abs(metaBreakdown.cost - 869.73) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.clicks, 359);
  assert.equal(googleBreakdown.leads, 12);
  assert.ok(Math.abs(googleBreakdown.cost - 497.5312) < 0.001);

  assert.equal(wrapup.metaAds.length, 12);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected Google CPC source-medium row');
  assert.equal(googleCpc.tracked_leads, 12);

  assert.ok(
    wrapup.config.executiveSummary.includes('separate from the later/current HERO Hot Stick campaign')
      && wrapup.config.executiveSummary.includes('1,316 campaign-period sessions'),
    'Expected executive summary to preserve non-HERO Hot-Stick framing'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('uses only the dated 03-02 row to avoid double counting')),
    'Expected caveat to preserve duplicate Meta-row exclusion'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('06-01 Tree Tools-HERO Hot Stick Tree Tools') && caveat.includes('excluded')),
    'Expected caveat to preserve HERO campaign exclusion'
  );

  console.log('Jameson Hot-Stick Tree Tools wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
