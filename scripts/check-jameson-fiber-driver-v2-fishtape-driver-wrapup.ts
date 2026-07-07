import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-fiber-driver-v2-fishtape-driver-utility-2026-05-07');
  assert.ok(wrapup, 'Expected Fiber Driver V2 utility-audience wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Fiber Driver');
  assert.equal(wrapup.config.parentProduct, 'Fiber Drivers');
  assert.equal(wrapup.config.campaignStart, '2026-05-07');
  assert.equal(wrapup.config.campaignEnd, '2026-05-28');
  assert.equal(wrapup.config.paidMetricsSource, 'meta_ad_filter');
  assert.deepEqual(wrapup.config.metaAdNameIncludes, ['V2']);
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 05-04: Fiber Driver V1: FISHTAPE DRIVER',
  ]);
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/lp/jameson-fiber-driver-fish-tape-driver'));
  assert.ok(!wrapup.config.campaignNames.some((name) => name.includes('Air Boost')));

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

  assert.equal(during.ad_impressions, 70446);
  assert.equal(during.ad_clicks, 1553);
  assert.ok(Math.abs(during.ad_cost - 654.67) < 0.001);
  assert.equal(during.ad_conversions, 51);
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

  assert.equal(wrapup.paidOverview.clicks, 1553);
  assert.equal(wrapup.paidOverview.leads, 51);
  assert.equal(wrapup.paidOverview.purchases, 2);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 654.67) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 12.8366666667) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 1.438) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 51);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 1623);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 463);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-05-21');
  assert.equal(wrapup.emailDetails[0]?.name, '05-04: Fiber Driver-Fishtape Driver');
  assert.equal(wrapup.emailDetails[0]?.clicks, 1683);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Meta/Facebook paid breakout');
  assert.equal(metaBreakdown.clicks, 1553);
  assert.equal(metaBreakdown.leads, 51);
  assert.ok(Math.abs(metaBreakdown.cost - 654.67) < 0.001);

  assert.ok(wrapup.metaAds.length > 0, 'Expected filtered V2 Meta ads');
  assert.ok(wrapup.metaAds.every((ad) => ad.adName.includes('V2')), 'Expected all returned Meta ads to be V2 ad variants');
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
    wrapup.config.executiveSummary.includes('ad-name-level Meta rows that contain V2')
      && wrapup.config.executiveSummary.includes('does not split sessions by Meta ad variant')
      && wrapup.config.executiveSummary.includes('telecom-category read'),
    'Expected executive summary to preserve V2 split, telecom/utility separation, and GA4 caveat'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('ad_name contains V2')),
    'Expected caveat to document V2 ad-name filter'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Air Boost') && caveat.includes('excluded')),
    'Expected caveat to confirm Air Boost exclusion'
  );

  console.log('Jameson Fiber Driver V2: FISHTAPE DRIVER utility-audience wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
