import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('huskie-60-100-ton-presses-2026-02-03');
  assert.ok(wrapup, 'Expected Huskie 60-100 Ton Presses wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Huskie');
  assert.equal(wrapup.config.product, 'Huskie 60-100 Ton Presses');
  assert.equal(wrapup.config.campaignStart, '2026-02-03');
  assert.equal(wrapup.config.campaignEnd, '2026-02-27');
  assert.equal(wrapup.config.beforeStart, '2026-01-06');
  assert.equal(wrapup.config.beforeEnd, '2026-02-02');
  assert.equal(wrapup.config.afterStart, '2026-02-28');
  assert.equal(wrapup.config.afterEnd, '2026-03-27');
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, [
    '/huskie-60-100-ton-compression-tools',
    '/huskie-60-100-ton-compression-tools/undefined',
  ]);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(before.ga4_sessions, 88);
  assert.equal(before.ga4_engaged_sessions, 25);
  assert.equal(during.ad_impressions, 91904);
  assert.equal(during.ad_clicks, 1105);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 1350.65);
  assert.equal(during.ad_conversions, 13);
  assert.equal(during.ga4_sessions, 661);
  assert.equal(during.ga4_engaged_sessions, 291);
  assert.equal(after.ga4_sessions, 14);
  assert.equal(after.ga4_engaged_sessions, 3);
  assert.equal(during.email_total_sent, 7237);
  assert.equal(during.email_clicks, 2596);

  for (const [label, summary] of [['before', before], ['after', after]] as const) {
    assert.equal(summary.ad_impressions, 0, `Expected ${label} period paid impressions to be zero`);
    assert.equal(summary.ad_clicks, 0, `Expected ${label} period paid clicks to be zero`);
    assert.equal(Math.round(summary.ad_cost * 100) / 100, 0, `Expected ${label} period paid spend to be zero`);
    assert.equal(summary.ad_conversions, 0, `Expected ${label} period paid leads/conversions to be zero`);
  }

  const metaLeadAds = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  const onsiteGoogle = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(metaLeadAds, 'Expected Huskie 60-100 Facebook Lead Ads breakout row');
  assert.ok(onsiteGoogle, 'Expected Huskie 60-100 on-site / Google Ads breakout row');
  assert.equal(metaLeadAds.leads, 8);
  assert.equal(metaLeadAds.clicks, 639);
  assert.equal(Math.round(metaLeadAds.cost * 100) / 100, 744.85);
  assert.equal(onsiteGoogle.leads, 5);
  assert.equal(onsiteGoogle.clicks, 466);
  assert.equal(Math.round(onsiteGoogle.cost * 100) / 100, 605.8);

  assert.ok(wrapup.emailDetails.some((email) => email.name.includes('Huskie 60-100 Ton Presses')),
    `Expected product-specific 60-100 Ton Presses email details. Got: ${wrapup.emailDetails.map((email) => email.name).join(', ')}`,
  );
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0), during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );

  console.log('Huskie 60-100 Ton Presses wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
