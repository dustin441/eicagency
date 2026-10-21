import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildNsiConversionBreakout } from './nsi-conversion-metrics.ts';

test('separates Meta lead ads from all website conversions and reconciles the total', () => {
  const result = buildNsiConversionBreakout([
    { ad_channel: 'Google', clicks: 100, cost: 1_000, conversions: 8 },
    { ad_channel: 'Google Pmax', clicks: 50, cost: 500, conversions: 7 },
    { ad_channel: 'LinkedIn', clicks: 25, cost: 250, conversions: 2 },
    { ad_channel: 'Facebook', clicks: 40, cost: 400, conversions: 10 },
  ]);

  assert.equal(result.websiteConversions, 17);
  assert.equal(result.metaLeads, 10);
  assert.equal(result.websiteConversions + result.metaLeads, 27);
  assert.equal(result.websiteClicks, 175);
  assert.equal(result.websiteCost, 1_750);
  assert.equal(result.websiteConversionRate, 17 / 175);
  assert.equal(result.websiteCostPerConversion, 1_750 / 17);
  assert.equal(result.metaLeadRate, 10 / 40);
  assert.equal(result.metaCostPerLead, 40);
});

test('returns zero rates and costs when a bucket has no conversions', () => {
  const result = buildNsiConversionBreakout([
    { ad_channel: 'Google', clicks: 10, cost: 100, conversions: 0 },
  ]);

  assert.equal(result.websiteConversionRate, 0);
  assert.equal(result.websiteCostPerConversion, 0);
  assert.equal(result.metaLeadRate, 0);
  assert.equal(result.metaCostPerLead, 0);
});

test('keeps website goals off blended total metrics', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');
  const totalCards = component.match(/title="Total Conversions"[\s\S]*?<\/KpiSection>/)?.[0] ?? '';

  assert.match(totalCards, /title="Blended Conversion Rate"/);
  assert.match(totalCards, /title="Blended Cost Per Conversion"/);
  assert.doesNotMatch(totalCards, /goal=\{NSI_H2_GOALS\.(?:submittals|submittalRate|costPerSubmittal)\}/);
  assert.match(component, /title="Cost Per Website Conversion"[\s\S]*?conversionBreakout\.websiteCostPerConversion/);
});
