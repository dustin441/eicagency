import test from 'node:test';
import assert from 'node:assert/strict';
import { conversionOptions, hasCurrentActivity, partitionActivity, totalConversions, yoyLabel } from './nsi-ytd-presentation.ts';

test('current activity includes zero-spend lead, conversion and onsite rows', () => {
  for (const field of ['metaLeads', 'conversions', 'productSubmittals', 'hubspotFormFills', 'sessions', 'engagedSessions', 'websiteConversions']) {
    assert.equal(hasCurrentActivity({ cost: 0, [field]: 0.25 }), true, field);
  }
  assert.equal(hasCurrentActivity({ cost: 0, impressions: 0, conversions: 0 }), false);
});

test('partition retains historical/inactive rows and never mutates or loses metrics', () => {
  const rows = [
    { cost: 0, prevCost: 75, conversions: 0, prevConversions: 2, label: 'Historical' },
    { cost: 0, prevCost: 0, conversions: 0.25, prevConversions: 0, label: 'Fractional, no spend' },
    { cost: 100, prevCost: 25, conversions: 3, prevConversions: 1, label: 'Current' },
    { cost: 0, prevCost: 0, conversions: 0, prevConversions: 0, label: 'Inactive' },
  ];
  const before = structuredClone(rows);
  const { active, inactive } = partitionActivity(rows);
  assert.deepEqual(rows, before);
  assert.deepEqual(active.map(row => row.label), ['Fractional, no spend', 'Current']);
  assert.deepEqual(inactive.map(row => row.label), ['Historical', 'Inactive']);
  for (const key of ['cost', 'prevCost', 'conversions', 'prevConversions'] as const) {
    assert.equal([...active, ...inactive].reduce((sum, row) => sum + row[key], 0), rows.reduce((sum, row) => sum + row[key], 0));
  }
});

test('column selections preserve fractional source totals for every option combination', () => {
  const row = { productSubmittals: 12.25, hubspotFormFills: 3.5, metaLeads: 7 };
  const before = structuredClone(row);
  const expected = row.productSubmittals + row.hubspotFormFills + row.metaLeads;
  for (let mask = 0; mask < 2 ** conversionOptions.length; mask++) {
    const selected = conversionOptions.filter((_, index) => mask & (1 << index));
    assert.ok(selected.length <= conversionOptions.length);
    assert.equal(totalConversions(row), expected);
    assert.deepEqual(row, before);
  }
});

test('YoY labels show direction without pretending unavailable history is zero', () => {
  assert.match(yoyLabel(120, 100), /^↑ Up /);
  assert.match(yoyLabel(80, 100), /^↓ Down /);
  assert.equal(yoyLabel(100, 100), 'Unchanged 0.0% YoY');
  for (const [current, previous] of [[null, 100], [100, null], [100, 0], [NaN, 100], [100, Infinity]] as const) {
    assert.equal(yoyLabel(current, previous), 'YoY not available');
  }
});
