import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModeledRoas, modeledRoas, MODELED_ROAS_LABEL, conversionOptions, hasCurrentActivity, partitionActivity, totalConversions, yoyLabel } from './nsi-ytd-presentation.ts';

// All financial examples in this file are synthetic, not client reporting data.
test('modeled ROAS applies exactly the 1% revenue assumption without rounding', () => {
  assert.equal(MODELED_ROAS_LABEL, 'Modeled ROAS, 1% revenue assumption');
  assert.equal(modeledRoas(12345.67, 89.123), 0.01 * 12345.67 / 89.123);
  assert.equal(modeledRoas(10000, 100), 1);
  for (const unavailable of [null, undefined, 0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(modeledRoas(unavailable, 100), null);
    assert.equal(modeledRoas(10000, unavailable), null);
  }
  assert.equal(modeledRoas(Number.MAX_VALUE, Number.MIN_VALUE), null);
});

const syntheticFamilies = () => [
  { key: 'BPT', current: 12000.25, previous: 9000.5, spend: 100.125, previousSpend: 90.25 },
  { key: 'POL', current: 18000.75, previous: 15000.5, spend: 200.375, previousSpend: 160.25 },
  { key: 'CMP', current: 7000, previous: 6000, spend: 80, previousSpend: 60 },
  { key: 'OTHER', current: null, previous: null, spend: 900, previousSpend: 700 },
];

test('combined model uses BPT + POL matching spend only, never nested CMP or other media', () => {
  const families = syntheticFamilies();
  const before = structuredClone(families);
  const model = buildModeledRoas(families);
  assert.deepEqual(model.combined, {
    current: 0.01 * (12000.25 + 18000.75) / (100.125 + 200.375),
    previous: 0.01 * (9000.5 + 15000.5) / (90.25 + 160.25),
  });
  assert.deepEqual(model.byFamily.CMP, { current: 0.875, previous: 1 });
  assert.deepEqual(model.byFamily.OTHER, { current: null, previous: null });
  assert.equal(model.byFamily.BPT.current, modeledRoas(families[0].current, families[0].spend));
  assert.equal(model.byFamily.POL.previous, modeledRoas(families[1].previous, families[1].previousSpend));
  assert.deepEqual(families, before);
});

test('each model period independently fails closed for missing, invalid or zero components', () => {
  for (const field of ['current', 'spend'] as const) {
    for (const missing of [null, undefined, 0, NaN, Infinity, -1]) {
      const families = syntheticFamilies().map(row => row.key === 'POL' ? { ...row, [field]: missing } : row);
      const model = buildModeledRoas(families);
      assert.equal(model.combined.current, null);
      assert.equal(model.byFamily.POL.current, null);
      assert.notEqual(model.combined.previous, null);
      assert.notEqual(model.byFamily.BPT.current, null);
    }
  }
  const priorUnavailable = buildModeledRoas(syntheticFamilies().map(row => ({ ...row, previousSpend: 0 })));
  assert.equal(priorUnavailable.combined.previous, null);
  assert.notEqual(priorUnavailable.combined.current, null);
  assert.deepEqual(buildModeledRoas([]).combined, { current: null, previous: null });
  assert.equal(buildModeledRoas(syntheticFamilies().filter(row => row.key !== 'BPT')).combined.current, null);
});

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
