import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('huskie-new-cutting-tools-2026-01-07');
  assert.ok(wrapup, 'Expected Huskie New Cutting Tools wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Huskie');
  assert.equal(wrapup.config.product, 'New Cutting Tools');
  assert.equal(wrapup.config.campaignStart, '2026-01-27');
  assert.equal(wrapup.config.campaignEnd, '2026-02-20');
  assert.equal(wrapup.config.beforeStart, '2025-12-30');
  assert.equal(wrapup.config.beforeEnd, '2026-01-26');
  assert.equal(wrapup.config.afterStart, '2026-02-21');
  assert.equal(wrapup.config.afterEnd, '2026-03-20');
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/new-cutting-tools']);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(during.ad_impressions, 202561);
  assert.equal(during.ad_clicks, 3433);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 1390.8);
  assert.equal(during.ad_conversions, 325);
  assert.equal(during.ga4_sessions, 400);
  assert.equal(during.ga4_engaged_sessions, 253);
  assert.equal(after.ga4_sessions, 36);
  assert.equal(after.ga4_engaged_sessions, 16);
  assert.equal(during.email_total_sent, 6018);
  assert.equal(during.email_clicks, 166);

  for (const [label, summary] of [['before', before], ['after', after]] as const) {
    assert.equal(summary.ad_impressions, 0, `Expected ${label} period paid impressions to be zero`);
    assert.equal(summary.ad_clicks, 0, `Expected ${label} period paid clicks to be zero`);
    assert.equal(Math.round(summary.ad_cost * 100) / 100, 0, `Expected ${label} period paid spend to be zero`);
  }

  for (const point of wrapup.fullWindowTimeSeries) {
    const bucketStart = new Date(`${point.bucket}T00:00:00Z`);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
    const campaignStart = new Date('2026-01-27T00:00:00Z');
    const campaignEnd = new Date('2026-02-20T00:00:00Z');
    const outsideCampaign = bucketEnd < campaignStart || bucketStart > campaignEnd;
    if (!outsideCampaign) continue;
    assert.equal(point.ad_impressions, 0, `Expected ${point.bucket} paid impressions to be zero outside campaign window`);
    assert.equal(point.ad_clicks, 0, `Expected ${point.bucket} paid clicks to be zero outside campaign window`);
    assert.equal(Math.round(point.ad_cost * 100) / 100, 0, `Expected ${point.bucket} paid spend to be zero outside campaign window`);
  }

  assert.ok(wrapup.emailDetails.some((email) => email.name.includes('Huskie New Cutting Tools')),
    `Expected product-specific New Cutting Tools email details. Got: ${wrapup.emailDetails.map((email) => email.name).join(', ')}`,
  );
  assert.ok(wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0) === during.ga4_sessions,
    'Expected source/medium sessions to reconcile to campaign landing-page sessions',
  );

  console.log('Huskie New Cutting Tools wrap-up checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
