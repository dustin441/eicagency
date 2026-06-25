import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('huskie-battery-tools-sla-725-2026-03-12');
  assert.ok(wrapup, 'Expected Huskie Battery Tools: SLA 725 wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Huskie');
  assert.equal(wrapup.config.product, 'Battery Tools: SLA 725');
  assert.equal(wrapup.config.campaignStart, '2026-03-12');
  assert.equal(wrapup.config.campaignEnd, '2026-04-01');
  assert.equal(wrapup.config.beforeStart, '2026-02-12');
  assert.equal(wrapup.config.beforeEnd, '2026-03-11');
  assert.equal(wrapup.config.afterStart, '2026-04-02');
  assert.equal(wrapup.config.afterEnd, '2026-04-29');
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/huskie-sla-725y-campaign',
    '/lp/sla-725y',
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(before.ga4_sessions, 145);
  assert.equal(before.ga4_engaged_sessions, 81);
  assert.equal(during.ad_impressions, 278961);
  assert.equal(during.ad_clicks, 4770);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 2285.47);
  assert.equal(during.ad_conversions, 57);
  assert.equal(during.ga4_sessions, 3013);
  assert.equal(during.ga4_engaged_sessions, 1514);
  assert.equal(after.ga4_sessions, 19);
  assert.equal(after.ga4_engaged_sessions, 3);
  assert.equal(during.email_total_sent, 14867);
  assert.equal(during.email_clicks, 285);

  for (const [label, summary] of [['before', before], ['after', after]] as const) {
    assert.equal(summary.ad_impressions, 0, `Expected ${label} period paid impressions to be zero`);
    assert.equal(summary.ad_clicks, 0, `Expected ${label} period paid clicks to be zero`);
    assert.equal(Math.round(summary.ad_cost * 100) / 100, 0, `Expected ${label} period paid spend to be zero`);
    assert.equal(summary.ad_conversions, 0, `Expected ${label} period paid leads/conversions to be zero`);
  }

  const metaLeadAds = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  const onsiteGoogle = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(metaLeadAds, 'Expected SLA 725 Facebook Lead Ads breakout row');
  assert.ok(onsiteGoogle, 'Expected SLA 725 on-site / Google Ads breakout row');
  assert.equal(metaLeadAds.leads, 50);
  assert.equal(metaLeadAds.clicks, 4110);
  assert.equal(Math.round(metaLeadAds.cost * 100) / 100, 1443.83);
  assert.equal(onsiteGoogle.leads, 7);
  assert.equal(onsiteGoogle.clicks, 660);
  assert.equal(Math.round(onsiteGoogle.cost * 100) / 100, 841.64);

  assert.ok(wrapup.emailDetails.some((email) => email.name.includes('SLA 725Y') || email.name.includes('SLA-725Y')),
    `Expected product-specific SLA 725 email details. Got: ${wrapup.emailDetails.map((email) => email.name).join(', ')}`,
  );
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0), during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );

  console.log('Huskie Battery Tools: SLA 725 wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
