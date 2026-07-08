import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-tree-tools-hero-vine-pullers-awareness-2026-05-07');
  assert.ok(wrapup, 'Expected HERO Vine Pullers Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Vine Pullers');
  assert.equal(wrapup.config.parentProduct, 'Vine Pullers');
  assert.equal(wrapup.config.campaignStart, '2026-05-07');
  assert.equal(wrapup.config.campaignEnd, '2026-05-29');
  assert.equal(wrapup.config.beforeStart, '2026-04-09');
  assert.equal(wrapup.config.beforeEnd, '2026-05-06');
  assert.equal(wrapup.config.afterStart, '2026-05-30');
  assert.equal(wrapup.config.afterEnd, '2026-06-26');
  assert.deepEqual(wrapup.config.campaignNames, [
    '[SALES] Performance Max | 05-04: Tree Tools-HERO Vine Pullers',
    '[LEAD] 05-04: Tree Tools-HERO Vine Pullers',
    '[LEAD] [Arborist] 05-04: Tree Tools-HERO Vine Pullers',
  ]);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/jameson-tree-tools-hero-vine-pullers']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('05-04') && caveat.includes('2026-05-07') && caveat.includes('2026-05-29')),
    'Expected caveat to preserve 05-04 label vs 5/7 first source date'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Arborist') && caveat.includes('fb.me')),
    'Expected caveat to explain Arborist/fb.me Meta rows'
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
  assert.equal(before.ga4_sessions, 23);
  assert.equal(before.ga4_engaged_sessions, 11);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 102429);
  assert.equal(during.ad_clicks, 3772);
  assert.ok(Math.abs(during.ad_cost - 2004.6114) < 0.001);
  assert.equal(during.ad_conversions, 116);
  assert.equal(during.ad_purchases, 6);
  assert.ok(Math.abs(during.ad_revenue - 2819.61) < 0.001);
  assert.equal(during.ga4_sessions, 641);
  assert.equal(during.ga4_engaged_sessions, 244);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 22056);
  assert.equal(during.email_opens, 3314);
  assert.equal(during.email_clicks, 399);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 5);
  assert.equal(after.ga4_engaged_sessions, 2);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 102429);
  assert.equal(wrapup.paidOverview.clicks, 3772);
  assert.equal(wrapup.paidOverview.leads, 116);
  assert.equal(wrapup.paidOverview.purchases, 6);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 2004.6114) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.revenue - 2819.61) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpl - 17.28113275862069) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.roas - 1.4065618902496517) < 0.001);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 116);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 0);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 6);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 641);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 244);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Facebook Lead Ads');
  assert.ok(metaBreakdown, 'Expected Facebook Lead Ads breakout for the Meta/Arborist rows');
  assert.equal(metaBreakdown.impressions, 78812);
  assert.equal(metaBreakdown.clicks, 3044);
  assert.equal(metaBreakdown.leads, 66);
  assert.ok(Math.abs(metaBreakdown.cost - 1306.68) < 0.001);
  assert.ok(Math.abs(metaBreakdown.cpl! - 19.79818181818182) < 0.001);
  assert.deepEqual(metaBreakdown.campaigns.sort(), [
    '[LEAD] 05-04: Tree Tools-HERO Vine Pullers',
    '[LEAD] [Arborist] 05-04: Tree Tools-HERO Vine Pullers',
  ].sort());

  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(googleBreakdown, 'Expected Google/PMax breakout');
  assert.equal(googleBreakdown.impressions, 23617);
  assert.equal(googleBreakdown.clicks, 728);
  assert.equal(googleBreakdown.leads, 50);
  assert.ok(Math.abs(googleBreakdown.cost - 697.9314) < 0.001);
  assert.ok(Math.abs(googleBreakdown.cpl! - 13.958628) < 0.001);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0]?.date, '2026-05-14');
  assert.equal(wrapup.emailDetails[0]?.name, '05-04: Tree Tools-HERO Vine Pullers');
  assert.equal(wrapup.emailDetails[0]?.totalSent, 22056);
  assert.equal(wrapup.emailDetails[0]?.opens, 3314);
  assert.equal(wrapup.emailDetails[0]?.clicks, 399);

  assert.equal(wrapup.metaAds.length, 8);
  assert.ok(wrapup.metaAds.some((ad) => ad.campaignName === '[LEAD] [Arborist] 05-04: Tree Tools-HERO Vine Pullers' && ad.destinationUrl === 'http://fb.me/' && ad.leads === 57));
  assert.ok(wrapup.metaAds.some((ad) => ad.campaignName === '[LEAD] 05-04: Tree Tools-HERO Vine Pullers' && ad.destinationUrl?.includes('/lp/jameson-tree-tools-hero-vine-pullers/') && ad.purchases === 1));
  for (const ad of wrapup.metaAds) {
    assert.ok(ad.adName.includes('05-04: Tree Tools-HERO Vine Pullers'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const googleCpc = wrapup.sourceMediumRows.find((row) => row.label === 'google' && row.sublabel === 'cpc');
  assert.ok(googleCpc, 'Expected google/cpc source-medium row');
  assert.equal(googleCpc.ga4_sessions, 241);
  assert.equal(googleCpc.tracked_leads, 50);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row for Meta tracked conversions');
  assert.equal(fbPaid.tracked_leads, 66);
  const direct = wrapup.sourceMediumRows.find((row) => row.label === '(direct)' && row.sublabel === '(none)');
  assert.ok(direct, 'Expected direct source-medium row');
  assert.equal(direct.ga4_sessions, 126);

  assert.ok(
    wrapup.config.executiveSummary.includes('102.4K paid impressions')
      && wrapup.config.executiveSummary.includes('116 tracked conversions')
      && wrapup.config.executiveSummary.includes('/lp/jameson-tree-tools-hero-vine-pullers'),
    'Expected executive summary to preserve HERO Vine Pullers performance and LP-only scope'
  );

  console.log('Jameson Tree Tools HERO Vine Pullers Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
