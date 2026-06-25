import assert from 'node:assert/strict';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
  const wrapup = await fetchSpartacoProductWrapup('huskie-new-cutting-tools-2026-01-07');
  assert.ok(wrapup, 'Expected Huskie New Cutting Tools wrap-up config/data to exist');
  assert.equal(wrapup.config.brand, 'Huskie');
  assert.equal(wrapup.config.product, 'New Cutting Tools');
  assert.equal(wrapup.config.campaignStart, '2026-01-07');
  assert.equal(wrapup.config.campaignEnd, '2026-02-20');
  assert.deepEqual(wrapup.config.sourceMediumPagePaths, ['/lp/new-cutting-tools']);

  const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
  const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
  const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
  assert.ok(before && during && after, 'Expected before/during/after period summaries');

  assert.equal(during.ad_impressions, 320512);
  assert.equal(during.ad_clicks, 5644);
  assert.equal(Math.round(during.ad_cost * 100) / 100, 2093.39);
  assert.equal(during.ad_conversions, 541);
  assert.equal(during.ga4_sessions, 412);
  assert.equal(during.ga4_engaged_sessions, 260);
  assert.equal(after.ga4_sessions, 45);
  assert.equal(after.ga4_engaged_sessions, 19);
  assert.equal(during.email_total_sent, 6018);
  assert.equal(during.email_clicks, 166);

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
