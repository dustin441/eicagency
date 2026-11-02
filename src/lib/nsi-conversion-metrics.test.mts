import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

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

test('optional columns never filter any of the four performance tables', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');
  assert.doesNotMatch(component, /rowsForConversionMetrics|googleCost|focusesGoogleSubtypes/);
  for (const name of ['ChannelTable', 'AudienceTypeTable', 'SubCampaignTable', 'CampaignTypeTable']) {
    const start = component.indexOf(`function ${name}(`);
    const end = component.indexOf('\nfunction ', start + 1);
    const body = component.slice(start, end < 0 ? undefined : end);
    assert.match(body, /rows\.map\(/);
    assert.doesNotMatch(body, /rows\.filter\(/);
  }
});

test('campaign-type aggregation retains zero-spend conversions and previous-only groups', () => {
  const service = readFileSync('src/services/nsi-analytics.ts', 'utf8');
  const helpers = service.slice(service.indexOf('function emptyConversionTableFields('), service.indexOf('function buildChannelRows('));
  const aggregate = service.slice(service.indexOf('const CAMPAIGN_TYPE_ORDER ='), service.indexOf('function buildSubCampaignRows('));
  const js = ts.transpileModule(`${helpers}\n${aggregate}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const buildRows = new Function('splitNsiConversions', 'isNsiMetaLeadRow', `${js}; return buildCampaignTypeRows;`)(splitNsiConversions, isNsiMetaLeadRow) as
    (current: Record<string, unknown>[], previous: Record<string, unknown>[]) => Record<string, number | string>[];
  const row = { ad_channel: 'Google', ad_type: 'PPC', clicks: 0, cost: 0, conversions: 2, hubspot_conversions: 1, impressions: 0, sessions: 0, engaged_sessions: 0 };
  const current = buildRows([row], []);
  assert.equal(current.length, 1);
  assert.equal(current[0].conversions, 2);
  assert.equal(current[0].productSubmittals, 1);
  assert.equal(current[0].hubspotFormFills, 1);
  const previous = buildRows([], [row]);
  assert.equal(previous.length, 1);
  assert.equal(previous[0].conversions, 0);
  assert.equal(previous[0].prevConversions, 2);
  assert.equal(previous[0].prevProductSubmittals, 1);
  assert.equal(previous[0].prevHubspotFormFills, 1);
});

test('every optional column combination preserves current and previous total conversions', () => {
  const component = readFileSync('src/components/NsiDashboardClient.tsx', 'utf8');
  const start = component.indexOf('function periodCols<');
  const end = component.indexOf('\nfunction pctDelta', start);
  assert.ok(start >= 0 && end > start);
  const js = ts.transpileModule(component.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const identity = (value: number) => String(value);
  const periodCols = new Function('fmtCompact', 'fmtInt', 'fmtPct', 'fmtDollar', 'fmtCents',
    `${js}; return periodCols;`)(identity, identity, identity, identity, identity) as
    (selected: Set<string>) => { label: string; curr: (row: Record<string, number>) => number; prev: (row: Record<string, number>) => number }[];
  // Includes a conversion-bearing Google row with zero spend, plus non-Google rows.
  const rows: Record<string, number>[] = [
    { conversions: 2, prevConversions: 1, productSubmittals: 2, prevProductSubmittals: 1, cost: 0 },
    { conversions: 8, prevConversions: 4, productSubmittals: 6, prevProductSubmittals: 3, hubspotFormFills: 2, prevHubspotFormFills: 1, cost: 100 },
    { conversions: 4, prevConversions: 3, metaLeads: 4, prevMetaLeads: 3, cost: 40 },
    { conversions: 0, prevConversions: 0, cost: 25 },
  ];
  const options = ['productSubmittals', 'hubspotFormFills', 'meta', 'website'];
  for (let mask = 0; mask < 16; mask++) {
    const selected = new Set(options.filter((_, i) => mask & (1 << i)));
    const cols = periodCols(selected);
    const total = cols.find(col => col.label === 'Total Conversions');
    assert.ok(total);
    assert.equal(rows.reduce((sum, row) => sum + total.curr(row), 0), 14);
    assert.equal(rows.reduce((sum, row) => sum + total.prev(row), 0), 8);
    assert.equal(cols.some(col => col.label === 'Product Submittals'), selected.has('productSubmittals'));
    assert.equal(cols.some(col => col.label === 'HubSpot Form Fills'), selected.has('hubspotFormFills'));
    assert.equal(cols.some(col => col.label === 'Meta Leads'), selected.has('meta'));
    assert.equal(cols.some(col => col.label === 'Website Conversions'), selected.has('website'));
    assert.equal(cols.some(col => /Cost Per (Product Submittal|HubSpot Form Fill)/.test(col.label)), false);
  }
});
