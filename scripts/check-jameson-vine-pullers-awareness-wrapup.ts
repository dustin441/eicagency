import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-vine-pullers-awareness-2026-02-24');
  assert.ok(wrapup, 'Expected Vine Pullers Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Vine Pullers');
  assert.equal(wrapup.config.parentProduct, 'Vine Pullers');
  assert.equal(wrapup.config.campaignStart, '2026-02-24');
  assert.equal(wrapup.config.campaignEnd, '2026-03-20');
  assert.equal(wrapup.config.beforeStart, '2026-01-27');
  assert.equal(wrapup.config.beforeEnd, '2026-02-23');
  assert.equal(wrapup.config.afterStart, '2026-03-21');
  assert.equal(wrapup.config.afterEnd, '2026-04-17');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] Performance Max | 02-23: Jameson Vine Pullers',
    '[LEAD] 02-23: Jameson Vine Pullers',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/jameson-vine-pullers']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('02-23') && caveat.includes('2026-02-24')),
    'Expected caveat to preserve 02-23 label vs 2/24 source-date nuance'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Jameson Vine Pullers') && caveat.includes('LL%') && caveat.includes('avoid double counting')),
    'Expected caveat to exclude duplicate/overlapping Meta rows'
  );

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 28);
  assert.equal(before.ga4_engaged_sessions, 19);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 161512);
  assert.equal(during.ad_clicks, 4206);
  assert.ok(Math.abs(during.ad_cost - 2207.1732) < 0.001);
  assert.equal(during.ad_conversions, 73);
  assert.equal(during.ad_purchases, 0);
  assert.equal(during.ad_revenue, 0);
  assert.equal(during.ga4_sessions, 2274);
  assert.equal(during.ga4_engaged_sessions, 1166);
  assert.equal(during.ga4_purchases, 3);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 7867);
  assert.equal(during.email_opens, 1261);
  assert.equal(during.email_clicks, 109);

  assert.equal(after.ga4_sessions, 12);
  assert.equal(after.ga4_engaged_sessions, 6);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.impressions, 161512);
  assert.equal(wrapup.paidOverview.clicks, 4206);
  assert.equal(wrapup.paidOverview.leads, 73);
  assert.equal(wrapup.paidOverview.purchases, 0);
  assert.equal(wrapup.paidOverview.revenue, 0);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 2207.1732) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 30.235249315068497) < 0.001);
  assert.equal(wrapup.paidOverview.roas, 0);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 73);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 3);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 0);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 2274);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1166);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta Website Conversions breakout');
  assert.equal(metaBreakdown.impressions, 38586);
  assert.equal(metaBreakdown.clicks, 2023);
  assert.equal(metaBreakdown.leads, 2);
  assert.ok(Math.abs(metaBreakdown.cost - 295.25) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 147.625) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 122926);
  assert.equal(googleBreakdown.clicks, 2183);
  assert.equal(googleBreakdown.leads, 71);
  assert.ok(Math.abs(googleBreakdown.cost - 1911.9232) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 26.928495774647885) < 0.001);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-02-24');
  assert.equal(wrapup.emailDetails[0]?.name, '02-23 Jameson Vine Pullers');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 7867);
  assert.equal(wrapup.emailDetails[0]?.opens, 1261);
  assert.equal(wrapup.emailDetails[0]?.clicks, 109);

  assert.equal(wrapup.metaAds.length, 3);
  for (const ad of wrapup.metaAds) {
    assert.equal(ad.adName, '02-23: Jameson Vine Pullers - Social');
    assert.ok(ad.destinationUrl?.startsWith('https://jamesontools.com/lp/jameson-vine-pullers'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 1297);
  assert.equal(googleCpc.tracked_leads, 71);
  assert.equal(googleCpc.ga4_purchases, 3);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row for Meta tracked conversions');
  assert.equal(fbPaid.tracked_leads, 2);

  assert.ok(
    wrapup.config.executiveSummary.includes('161.5K paid impressions')
      && wrapup.config.executiveSummary.includes('73 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/jameson-vine-pullers'),
    'Expected executive summary to preserve Vine Pullers performance and LP-only scope'
  );

  console.log('Jameson Vine Pullers Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
