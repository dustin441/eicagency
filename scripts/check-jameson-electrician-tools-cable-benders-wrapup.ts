import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-electrician-tools-cable-benders-2026-03-11');
  assert.ok(wrapup, 'Expected Cable Benders wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Cable Benders');
  assert.equal(wrapup.config.parentProduct, 'Cable Benders');
  assert.equal(wrapup.config.campaignStart, '2026-03-11');
  assert.equal(wrapup.config.campaignEnd, '2026-03-31');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[LEAD] 03-09: Electrician Tools- Cable Benders',
    '[SALES] 03-09: Electrician Tools- Cable Benders',
  ]);
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/lp/bulldog-cable-benders'));
  assert.ok(wrapup.config.sourceMediumPagePaths.includes('/bulldog-bender'));
  assert.ok(!wrapup.config.campaignNames.includes('[LEAD] Jameson Electrician Tools: Cable Benders'));

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before, 'Expected before period');
  assert.ok(during, 'Expected during period');
  assert.ok(after, 'Expected after period');

  assert.equal(before.ga4_sessions, 184);
  assert.equal(before.ga4_engaged_sessions, 85);
  assert.equal(before.ga4_purchases, 3);
  assert.ok(Math.abs(before.ga4_total_revenue - 523.33) < 0.001);
  assert.equal(before.ad_clicks, 0);
  assert.equal(before.ad_conversions, 0);

  assert.equal(during.ad_impressions, 103110);
  assert.equal(during.ad_clicks, 4544);
  assert.ok(Math.abs(during.ad_cost - 1740.2698) < 0.001);
  assert.equal(during.ad_conversions, 44);
  assert.equal(during.ad_purchases, 6);
  assert.ok(Math.abs(during.ad_revenue - 1709.66) < 0.001);
  assert.equal(during.ga4_sessions, 2998);
  assert.equal(during.ga4_engaged_sessions, 1327);
  assert.equal(during.ga4_purchases, 7);
  assert.ok(Math.abs(during.ga4_total_revenue - 1451.14) < 0.001);
  assert.equal(during.email_total_sent, 7377);
  assert.equal(during.email_opens, 1146);
  assert.equal(during.email_clicks, 138);

  assert.equal(after.ga4_sessions, 181);
  assert.equal(after.ga4_engaged_sessions, 90);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);

  assert.equal(wrapup.paidOverview.impressions, 103110);
  assert.equal(wrapup.paidOverview.clicks, 4544);
  assert.equal(wrapup.paidOverview.leads, 44);
  assert.equal(wrapup.paidOverview.purchases, 6);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1740.2698) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 39.55158636) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 44);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 2998);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1327);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-03-11');
  assert.equal(wrapup.emailDetails[0]?.name, '3-09 Cable Benders Campaign');
  assert.equal(wrapup.emailDetails[0]?.clicks, 138);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  assert.ok(metaBreakdown, 'Expected Meta website-conversions breakout');
  assert.equal(metaBreakdown.impressions, 72412);
  assert.equal(metaBreakdown.clicks, 3220);
  assert.equal(metaBreakdown.leads, 20);
  assert.ok(Math.abs(metaBreakdown.cost - 1084.54) < 0.001);

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 30698);
  assert.equal(googleBreakdown.clicks, 1324);
  assert.equal(googleBreakdown.leads, 24);
  assert.ok(Math.abs(googleBreakdown.cost - 655.7298) < 0.001);

  assert.equal(wrapup.metaAds.length, 9);
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.previewUrl, `Expected preview URL for ${ad.adId}`);
    assert.ok(ad.finalCreativeLink?.startsWith('/spartaco-creatives/jameson-'), `Expected cached local creative for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected Google CPC source-medium row');
  assert.equal(googleCpc.tracked_leads, 24);
  assert.equal(googleCpc.ga4_purchases, 4);
  assert.ok(Math.abs(googleCpc.ga4_total_revenue - 490.85) < 0.001);
  const facebookReferral = wrapup.sourceMediumRows.find((row) => row.label === 'l.facebook.com' && row.sublabel === 'referral');
  assert.ok(facebookReferral, 'Expected l.facebook.com referral row');
  assert.equal(facebookReferral.ga4_purchases, 3);
  assert.ok(Math.abs(facebookReferral.ga4_total_revenue - 960.29) < 0.001);

  assert.ok(
    wrapup.config.executiveSummary.includes('2,998 campaign-period sessions')
      && wrapup.config.executiveSummary.includes('not broad Electrician Tools'),
    'Expected executive summary to preserve strict Cable Benders framing'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('uses only the dated 03-09 row to avoid double counting')),
    'Expected caveat to preserve duplicate Meta-row exclusion'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('broad bending-tool') && caveat.includes('cut/crimp pages are excluded')),
    'Expected caveat to preserve adjacent-category exclusion'
  );

  console.log('Jameson Electrician Tools — Cable Benders wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
