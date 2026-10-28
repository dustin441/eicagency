import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildNsiConversionBreakout, isNsiMetaLeadRow, splitNsiConversions } from './nsi-conversion-metrics.ts';

test('separates Meta lead ads from all website conversions and reconciles the total', () => {
  const result = buildNsiConversionBreakout([
    { ad_channel: 'Google', clicks: 100, cost: 1_000, conversions: 8, hubspot_conversions: 3 },
    { ad_channel: 'Google Pmax', clicks: 50, cost: 500, conversions: 7, hubspot_conversions: 1 },
    { ad_channel: 'LinkedIn', clicks: 25, cost: 250, conversions: 2, hubspot_conversions: 0 },
    { ad_channel: 'Facebook', clicks: 40, cost: 400, conversions: 10, hubspot_conversions: 0 },
  ]);

  assert.equal(result.productSubmittals, 13);
  assert.equal(result.hubspotFormFills, 4);
  assert.equal(result.websiteConversions, result.productSubmittals + result.hubspotFormFills);
  assert.equal(result.totalConversions, result.productSubmittals + result.hubspotFormFills + result.metaLeads);
  assert.equal(result.totalConversions, 27);

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
    { ad_channel: 'Google', clicks: 10, cost: 100, conversions: 0, hubspot_conversions: 0 },
  ]);

  assert.equal(result.websiteConversionRate, 0);
  assert.equal(result.websiteCostPerConversion, 0);
  assert.equal(result.metaLeadRate, 0);
  assert.equal(result.metaCostPerLead, 0);
});

test('keeps website goals off blended total metrics', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');
  const totalCards = component.match(/title="Total Conversions"\s*value=\{fmtInt\(s\.conversions\)\}[\s\S]*?<\/KpiSection>/)?.[0] ?? '';

  assert.match(totalCards, /title="Blended Conversion Rate"/);
  assert.match(totalCards, /title="Blended Cost Per Conversion"/);
  assert.doesNotMatch(totalCards, /goal=\{NSI_H2_GOALS\.(?:submittals|submittalRate|costPerSubmittal)\}/);
  assert.match(component, /title="Cost Per Website Conversion"[\s\S]*?conversionBreakout\.websiteCostPerConversion/);
});

test('uses one channel classifier for website conversions and Meta leads', () => {
  assert.equal(isNsiMetaLeadRow({ ad_channel: 'Facebook' }), true);
  assert.equal(isNsiMetaLeadRow({ ad_channel: 'Google' }), false);
  assert.equal(isNsiMetaLeadRow({ ad_channel: 'LinkedIn' }), false);
  assert.equal(isNsiMetaLeadRow({ ad_channel: null }), false);
});

test('offers breakout count, rate, and cost as optional columns across performance tables', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');

  assert.match(component, /Optional table columns/);
  assert.match(component, /Website conversion metrics/);
  for (const option of ['Product Submittals', 'HubSpot Form Fills', 'Meta Leads']) {
    assert.match(component, new RegExp(`key: '[a-zA-Z]+', label: '${option}'`));
  }
  assert.match(component, /useState<Set<ConversionTableMetricGroup>>\(\(\) => new Set\(\)\)/);
  for (const label of [
    'Product Submittals',
    'HubSpot Form Fills',
    'Website Conversions',
    'Website Conversion Rate',
    'Cost Per Website Conversion',
    'Meta Leads',
    'Meta Lead Rate',
    'Cost Per Meta Lead',
  ]) {
    assert.match(component, new RegExp(`label: '${label}'`));
  }
  assert.equal((component.match(/conversionMetrics=\{tableConversionMetrics\}/g) ?? []).length, 4);
});

test('puts every conversion in exactly one subtype', () => {
  assert.deepEqual(
    splitNsiConversions({ ad_channel: 'Google', conversions: 12.5, hubspot_conversions: 2 }),
    { productSubmittals: 10.5, hubspotFormFills: 2, metaLeads: 0 },
  );
  assert.deepEqual(
    splitNsiConversions({ ad_channel: 'Facebook', conversions: 4, hubspot_conversions: 0 }),
    { productSubmittals: 0, hubspotFormFills: 0, metaLeads: 4 },
  );
  // HubSpot can never exceed the row's conversions, so submittals never go negative.
  assert.deepEqual(
    splitNsiConversions({ ad_channel: 'Google Pmax', conversions: 1, hubspot_conversions: 3 }),
    { productSubmittals: 0, hubspotFormFills: 1, metaLeads: 0 },
  );
});

test('does not offer per-subtype rate or cost for website conversions', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');

  assert.doesNotMatch(component, /label: '(?:Product Submittal|HubSpot Form Fill)s? (?:Rate|Cost)/);
  assert.doesNotMatch(component, /label: 'Cost Per (?:Product Submittal|HubSpot Form Fill)/);
});
