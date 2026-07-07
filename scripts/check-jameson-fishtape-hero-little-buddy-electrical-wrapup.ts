import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-fishtape-hero-little-buddy-electrical-2026-04-08');
  assert.ok(wrapup, 'Expected Little Buddy Electrical wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Little Buddy');
  assert.equal(wrapup.config.parentProduct, 'Fishtape / Little Buddy');
  assert.equal(wrapup.config.campaignStart, '2026-04-08');
  assert.equal(wrapup.config.campaignEnd, '2026-04-30');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 4-06: Fishtape: HERO Little Buddy-Electrical',
  ]);
  assert.ok(!wrapup.config.campaignNames.some((name) => name.includes('Telecom')));
  assert.ok(!wrapup.config.campaignNames.some((name) => name.includes('ElectricalTrust')));
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/lp/fiberglass-fish-tape-wire-puller-telecom'));
  assert.ok(!wrapup.config.sourceMediumPagePaths.includes('/product-category/duct-rodders'));
  assert.ok(!wrapup.config.sourceMediumPagePaths.includes('/duct-rodders'));

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 513);
  assert.equal(before.ga4_engaged_sessions, 124);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);
  assert.equal(before.ad_clicks, 0);

  assert.equal(during.ad_impressions, 29864);
  assert.equal(during.ad_clicks, 595);
  assert.ok(Math.abs(during.ad_cost - 981.76) < 0.001);
  assert.equal(during.ad_conversions, 9);
  assert.equal(during.ad_purchases, 1);
  assert.ok(Math.abs(during.ad_revenue - 510.88) < 0.001);
  assert.equal(during.ga4_sessions, 581);
  assert.equal(during.ga4_engaged_sessions, 246);
  assert.equal(during.ga4_purchases, 6);
  assert.ok(Math.abs(during.ga4_total_revenue - 3341.85) < 0.001);
  assert.equal(during.email_total_sent, 18428);
  assert.equal(during.email_opens, 2491);
  assert.equal(during.email_clicks, 217);

  assert.equal(after.ga4_sessions, 244);
  assert.equal(after.ga4_engaged_sessions, 122);
  assert.equal(after.ga4_purchases, 4);
  assert.ok(Math.abs(after.ga4_total_revenue - 116.86) < 0.001);
  assert.equal(after.ad_clicks, 0);

  assert.equal(wrapup.paidOverview.clicks, 595);
  assert.equal(wrapup.paidOverview.leads, 9);
  assert.equal(wrapup.paidOverview.purchases, 1);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 981.76) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 109.08444444) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 0.5203715775749674) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 9);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 581);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 246);

  assert.equal(wrapup.emailDetails.length, 3);
  assert.deepEqual(wrapup.emailDetails.map((email) => email.date), ['2026-04-08', '2026-04-15', '2026-04-22']);
  assert.equal(wrapup.emailDetails.reduce((sum, email) => sum + email.totalSent, 0), 18428);
  assert.equal(wrapup.emailDetails.reduce((sum, email) => sum + email.clicks, 0), 217);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta website-conversions breakout');
  assert.equal(metaBreakdown.impressions, 29864);
  assert.equal(metaBreakdown.clicks, 595);
  assert.equal(metaBreakdown.leads, 9);
  assert.ok(Math.abs(metaBreakdown.cost - 981.76) < 0.001);
  assert.equal(wrapup.leadCaptureBreakdown.length, 1);

  assert.equal(wrapup.metaAds.length, 3);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const organic = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'organic');
  assert.ok(organic, 'Expected google organic source-medium row');
  assert.equal(organic.ga4_purchases, 6);
  assert.ok(Math.abs(organic.ga4_total_revenue - 3341.85) < 0.001);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb paid row for tracked Meta website conversions');
  assert.equal(fbPaid.tracked_leads, 9);

  assert.ok(
    wrapup.config.executiveSummary.includes('Meta website-conversion flight')
      && wrapup.config.executiveSummary.includes('not the overlapping Telecom PMax/Meta rows'),
    'Expected executive summary to preserve Electrical-only framing'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('ad row starts recording spend on 2026-04-09')),
    'Expected caveat to preserve 4/8 vs 4/9 date nuance'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('uses only the dated 4-06 Electrical row to avoid double counting')),
    'Expected caveat to preserve ElectricalTrust duplicate exclusion'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Overlapping Telecom rows') && caveat.includes('excluded')),
    'Expected caveat to preserve Telecom exclusion'
  );

  console.log('Jameson Fishtape HERO Little Buddy-Electrical wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
