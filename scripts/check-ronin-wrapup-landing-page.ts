import * as assert from 'node:assert';
import { fetchSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

async function main() {
const wrapup = await fetchSpartacoProductWrapup('ronin-material-lifting-2026-04-23');
assert.ok(wrapup, 'Expected Ronin Material Lifting wrapup to load');

const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
assert.ok(before && during && after, 'Expected before/during/after summaries');

// These are raw GA4 totals for the campaign landing page only:
// /lp/ronin-tl-power-ascender-material-handling
assert.equal(before.ga4_sessions, 96, 'before sessions should use campaign landing page scope');
assert.equal(before.ga4_engaged_sessions, 34, 'before engaged sessions should use campaign landing page scope');
assert.equal(during.ga4_sessions, 3312, 'during sessions should use campaign landing page scope');
assert.equal(during.ga4_engaged_sessions, 1326, 'during engaged sessions should use campaign landing page scope');
assert.equal(after.ga4_sessions, 15, 'after sessions should use campaign landing page scope');
assert.equal(after.ga4_engaged_sessions, 4, 'after engaged sessions should use campaign landing page scope');

assert.equal(wrapup.outcomeAttribution.totalSessions, 3312, 'outcome total sessions should match landing page scope');
assert.equal(wrapup.outcomeAttribution.totalEngagedSessions, 1326, 'outcome engaged sessions should match landing page scope');

const sourceMediumSessionTotal = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
const sourceMediumEngagedTotal = wrapup.sourceMediumRows.reduce((sum, row) => sum + row.ga4_engaged_sessions, 0);
assert.equal(sourceMediumSessionTotal, 3312, 'source/medium sessions should sum to landing page total');
assert.equal(sourceMediumEngagedTotal, 1326, 'source/medium engaged sessions should sum to landing page total');

// Paid and email metrics still come from the campaign/product performance layer.
assert.equal(during.ad_impressions, 215541, 'paid impressions should remain unchanged');
assert.equal(during.ad_clicks, 5382, 'paid clicks should remain unchanged');
assert.equal(during.ad_conversions, 138, 'paid leads/conversions should remain unchanged');
assert.equal(during.email_total_sent, 15483, 'Act-On product email sends should remain unchanged');

const roninLeadAds = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
const roninOnsite = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
assert.ok(roninLeadAds, 'Expected Ronin Facebook Lead Ads breakout row');
assert.ok(roninOnsite, 'Expected Ronin on-site / Google Ads breakout row');
assert.equal(roninLeadAds.leads, 127, 'Ronin Meta lead ads should carry 127 leads');
assert.equal(roninLeadAds.clicks, 4185, 'Ronin Meta lead ads should carry 4,185 clicks');
assert.equal(Math.round(roninLeadAds.cost * 100) / 100, 2627.84, 'Ronin Meta lead ads spend should match raw ads');
assert.equal(roninOnsite.leads, 11, 'Ronin Google/on-site ads should carry 11 leads');
assert.equal(roninOnsite.clicks, 1197, 'Ronin Google/on-site ads should carry 1,197 clicks');
assert.equal(Math.round(roninOnsite.cost * 100) / 100, 1391.34, 'Ronin Google/on-site ads spend should match raw ads');

console.log('Ronin wrapup landing-page alignment checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
