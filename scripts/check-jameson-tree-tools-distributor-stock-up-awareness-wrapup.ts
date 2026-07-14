import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('jameson-tree-tools-distributor-stock-up-awareness-2026-02-10');
  assert.ok(wrapup, 'Expected Distributor Stock Up Awareness wrap-up to load');

  assert.equal(wrapup.config.brand, 'Jameson');
  assert.equal(wrapup.config.product, 'Distributor Stock Up');
  assert.equal(wrapup.config.parentProduct, 'Arborist and Vegetation Management');
  assert.equal(wrapup.config.campaignStart, '2026-02-10');
  assert.equal(wrapup.config.campaignEnd, '2026-04-10');
  assert.equal(wrapup.config.beforeStart, '2026-01-13');
  assert.equal(wrapup.config.beforeEnd, '2026-02-09');
  assert.equal(wrapup.config.afterStart, '2026-04-11');
  assert.equal(wrapup.config.afterEnd, '2026-05-08');
  assert.deepEqual(wrapup.config.campaignNames, ['02-09: Tree Tools-Distributor Stock Up']);
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/tree-care-merchandiser-promo']);
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('Distributor Stock Up-Awareness') && caveat.includes('avoid double counting')),
    'Expected caveat to exclude the duplicate/renamed Stock Up row'
  );
  assert.ok(
    wrapup.config.caveats.some((caveat) => caveat.includes('product Other') && caveat.includes('exact campaign name')),
    'Expected caveat to document Other-product warehouse mapping'
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
  assert.equal(before.ga4_sessions, 28);
  assert.equal(before.ga4_engaged_sessions, 14);
  assert.equal(before.ga4_purchases, 0);
  assert.equal(before.ga4_total_revenue, 0);

  assert.equal(during.ad_impressions, 386344);
  assert.equal(during.ad_clicks, 592);
  assert.ok(Math.abs(during.ad_cost - 1057.33) < 0.001);
  assert.equal(during.ad_conversions, 0);
  assert.equal(during.ad_purchases, 0);
  assert.equal(during.ad_revenue, 0);
  assert.equal(during.ga4_sessions, 374);
  assert.equal(during.ga4_engaged_sessions, 31);
  assert.equal(during.ga4_purchases, 0);
  assert.equal(during.ga4_total_revenue, 0);
  assert.equal(during.email_total_sent, 6287);
  assert.equal(during.email_opens, 1438);
  assert.equal(during.email_clicks, 184);

  assert.equal(after.ad_impressions, 0);
  assert.equal(after.ad_clicks, 0);
  assert.equal(after.ad_conversions, 0);
  assert.equal(after.ga4_sessions, 4);
  assert.equal(after.ga4_engaged_sessions, 3);
  assert.equal(after.ga4_purchases, 0);
  assert.equal(after.ga4_total_revenue, 0);

  assert.equal(wrapup.paidOverview.impressions, 386344);
  assert.equal(wrapup.paidOverview.clicks, 592);
  assert.equal(wrapup.paidOverview.leads, 0);
  assert.equal(wrapup.paidOverview.purchases, 0);
  assert.equal(wrapup.paidOverview.revenue, 0);
  assert.ok(Math.abs(wrapup.paidOverview.cost - 1057.33) < 0.001);
  assert.ok(Math.abs(wrapup.paidOverview.cpc - 1.7860304054054053) < 0.001);
  assert.equal(wrapup.paidOverview.cpl, 0);
  assert.equal(wrapup.paidOverview.roas, 0);
  assert.equal(wrapup.outcomeAttribution.totalTrackedLeads, 0);
  assert.equal(wrapup.outcomeAttribution.totalOnlineSales, 0);
  assert.equal(wrapup.outcomeAttribution.totalSessions, 374);
  assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 31);

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Awareness / Traffic');
  assert.ok(metaBreakdown, 'Expected Meta Awareness / Traffic breakout');
  assert.equal(metaBreakdown.impressions, 386344);
  assert.equal(metaBreakdown.clicks, 592);
  assert.equal(metaBreakdown.leads, 0);
  assert.equal(metaBreakdown.cpl, null);
  assert.ok(Math.abs(metaBreakdown.cost - 1057.33) < 0.001);
  assert.deepEqual(metaBreakdown.campaigns, ['02-09: Tree Tools-Distributor Stock Up']);

  assert.equal(wrapup.emailDetails.length, 4);
  const emailByDate = new Map(wrapup.emailDetails.map((email) => [email.date, email]));
  assert.equal(emailByDate.get('2026-02-10')?.name, 'Jameson Tools - Tree Tools Promo');
  assert.equal(emailByDate.get('2026-02-10')?.clicks, 71);
  assert.equal(emailByDate.get('2026-02-24')?.name, '02-09 Tree Tools Merchandising Campaign email #2');
  assert.equal(emailByDate.get('2026-02-24')?.clicks, 41);
  assert.equal(emailByDate.get('2026-03-10')?.name, '02-09 Tree Tools Merchandising Campaign email #3 (with emoji)');
  assert.equal(emailByDate.get('2026-03-10')?.clicks, 37);
  assert.equal(emailByDate.get('2026-03-24')?.name, '02-09 Tree Tools Merchandising Campaign email # 4 (adaptive sending)');
  assert.equal(emailByDate.get('2026-03-24')?.clicks, 35);

  assert.equal(wrapup.metaAds.length, 2);
  for (const ad of wrapup.metaAds) {
    assert.equal(ad.adName, 'Distributor Stock Up-Awareness');
    assert.ok(ad.destinationUrl?.startsWith('https://jamesontools.com/lp/tree-care-merchandiser-promo'));
    assert.ok(ad.previewUrl, `Expected Facebook preview URL for ${ad.adId}`);
  }

  const sourceSessions = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  assert.equal(sourceSessions, during.ga4_sessions);
  const fbPaid = wrapup.sourceMediumRows.find((row) => row.label === 'fb' && row.sublabel === 'paid');
  assert.ok(fbPaid, 'Expected fb/paid source-medium row');
  assert.equal(fbPaid.ga4_sessions, 190);
  assert.equal(fbPaid.tracked_leads, 0);
  const igPaid = wrapup.sourceMediumRows.find((row) => row.label === 'ig' && row.sublabel === 'paid');
  assert.ok(igPaid, 'Expected ig/paid source-medium row');
  assert.equal(igPaid.ga4_sessions, 79);

  assert.ok(
    wrapup.config.executiveSummary.includes('386K paid impressions')
      && wrapup.config.executiveSummary.includes('374 scoped campaign-period sessions')
      && wrapup.config.executiveSummary.includes('excludes the undated/renamed Distributor Stock Up-Awareness row'),
    'Expected executive summary to preserve the awareness/traffic and duplicate-exclusion story'
  );

  console.log('Jameson Tree Tools Distributor Stock Up Awareness wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
