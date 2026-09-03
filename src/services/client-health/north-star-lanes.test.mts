import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateNorthStarLanes,
  reduceNorthStarLanes,
  type NorthStarLane,
  type NorthStarRowsBySource,
} from './north-star-lanes.ts';

const cplLane = (overrides: Partial<NorthStarLane> = {}): NorthStarLane => ({
  key: 'cpl', label: 'Cost per lead trend', formula: 'cost_per_result',
  evaluation: 'period_over_period_change', required: true, weight: 100,
  direction: 'lower_is_better', greenThreshold: 5, yellowThreshold: 15,
  sourceKeys: ['leads'], ...overrides,
});

const roasLane = (overrides: Partial<NorthStarLane> = {}): NorthStarLane => ({
  key: 'roas', label: 'Return on ad spend', formula: 'roas',
  evaluation: 'absolute_target', required: true, weight: 100,
  direction: 'higher_is_better', greenThreshold: 4, yellowThreshold: 2,
  sourceKeys: ['sales'], ...overrides,
});

test('CPL lane uses ratio-of-sums by configured source and scores period-over-period change', () => {
  const rows: NorthStarRowsBySource = {
    leads: {
      currentRows: [{ spend: 100, results: 1 }, { spend: 300, results: 9 }],
      previousRows: [{ spend: 200, results: 4 }, { spend: 200, results: 4 }],
    },
    unrelated: {
      currentRows: [{ spend: 1_000_000, results: 1 }],
      previousRows: [{ spend: 1, results: 1_000_000 }],
    },
  };

  assert.deepEqual(calculateNorthStarLanes([cplLane()], rows), [{
    key: 'cpl', required: true, weight: 100,
    currentValue: 40, previousValue: 50, evaluationValue: -20,
    status: 'healthy', reason: 'Cost per lead trend improved by 20% period over period.',
  }]);
});

test('CPL lane supports an absolute lower-is-better target without requiring previous rows', () => {
  const lane = cplLane({
    key: 'cps', label: 'Cost per Submittal', evaluation: 'absolute_target',
    greenThreshold: 155, yellowThreshold: 175,
  });
  for (const [spend, expectedStatus] of [[150, 'healthy'], [160, 'watch'], [180, 'at_risk']] as const) {
    const evidence = calculateNorthStarLanes([lane], {
      leads: { currentRows: [{ spend, results: 1 }], previousRows: null },
    })[0];
    assert.equal(evidence.currentValue, spend);
    assert.equal(evidence.previousValue, null);
    assert.equal(evidence.evaluationValue, spend);
    assert.equal(evidence.status, expectedStatus);
    assert.equal(evidence.reason, `Cost per Submittal is ${spend} against a healthy threshold of 155.`);
  }
});

test('Spartaco dual lanes keep incompatible CPL and ROAS sources and units separate', () => {
  const lanes = [cplLane({ weight: 50, sourceKeys: ['lead_ads'] }), roasLane({ weight: 50, sourceKeys: ['shopify'] })];
  const evidence = calculateNorthStarLanes(lanes, {
    lead_ads: { currentRows: [{ spend: 550, results: 10 }], previousRows: [{ spend: 500, results: 10 }] },
    shopify: { currentRows: [{ spend: 100, results: 450 }], previousRows: [{ spend: 80, results: 240 }] },
  });

  assert.deepEqual(evidence.map(({ key, currentValue, previousValue, evaluationValue, status }) => (
    { key, currentValue, previousValue, evaluationValue, status }
  )), [
    { key: 'cpl', currentValue: 55, previousValue: 50, evaluationValue: 10, status: 'watch' },
    { key: 'roas', currentValue: 4.5, previousValue: 3, evaluationValue: 4.5, status: 'healthy' },
  ]);
  assert.deepEqual(reduceNorthStarLanes(evidence), {
    status: 'watch', value: null,
    reason: 'Required North Star lane cpl is watch.',
  });
});

test('CPL missing windows are incomplete and verified zero denominators fail closed without invented values', () => {
  const missing = calculateNorthStarLanes([cplLane()], {
    leads: { currentRows: [{ spend: 100, results: 2 }], previousRows: null },
  })[0];
  assert.deepEqual(missing, {
    key: 'cpl', required: true, weight: 100,
    currentValue: 50, previousValue: null, evaluationValue: null,
    status: 'incomplete', reason: 'Cost per lead trend previous rows are missing for source leads.',
  });

  const partiallyMissingPrevious = calculateNorthStarLanes([
    cplLane({ sourceKeys: ['first', 'second'] }),
  ], {
    first: { currentRows: [{ spend: 100, results: 1 }], previousRows: [{ spend: 100, results: 2 }] },
    second: { currentRows: [{ spend: 300, results: 9 }], previousRows: null },
  })[0];
  assert.equal(partiallyMissingPrevious.currentValue, 40);
  assert.equal(partiallyMissingPrevious.previousValue, null);
  assert.equal(partiallyMissingPrevious.status, 'incomplete');

  for (const [name, rows, reason] of [
    ['current results', { currentRows: [{ spend: 100, results: 0 }], previousRows: [{ spend: 100, results: 2 }] }, /current window has zero verified results/i],
    ['previous results', { currentRows: [{ spend: 100, results: 2 }], previousRows: [{ spend: 100, results: 0 }] }, /previous window has zero verified results/i],
    ['previous spend', { currentRows: [{ spend: 100, results: 2 }], previousRows: [{ spend: 0, results: 2 }] }, /previous window has zero verified spend/i],
  ] as const) {
    const result = calculateNorthStarLanes([cplLane()], { leads: rows })[0];
    assert.equal(result.status, 'at_risk', name);
    assert.equal(result.evaluationValue, null, name);
    assert.match(result.reason, reason, name);
  }
});

test('ROAS uses revenue over spend, allows previous display to be absent, and handles zero explicitly', () => {
  const withoutPrevious = calculateNorthStarLanes([roasLane()], {
    sales: { currentRows: [{ spend: 25, results: 100 }, { spend: 75, results: 300 }], previousRows: null },
  })[0];
  assert.equal(withoutPrevious.currentValue, 4);
  assert.equal(withoutPrevious.previousValue, null);
  assert.equal(withoutPrevious.evaluationValue, 4);
  assert.equal(withoutPrevious.status, 'healthy');

  const zeroRevenue = calculateNorthStarLanes([roasLane()], {
    sales: { currentRows: [{ spend: 100, results: 0 }], previousRows: [] },
  })[0];
  assert.equal(zeroRevenue.currentValue, 0);
  assert.equal(zeroRevenue.evaluationValue, 0);
  assert.equal(zeroRevenue.status, 'at_risk');

  const zeroSpend = calculateNorthStarLanes([roasLane()], {
    sales: { currentRows: [{ spend: 0, results: 100 }], previousRows: [] },
  })[0];
  assert.equal(zeroSpend.currentValue, null);
  assert.equal(zeroSpend.evaluationValue, null);
  assert.equal(zeroSpend.status, 'incomplete');
  assert.match(zeroSpend.reason, /zero verified spend/i);
});

test('ROAS period-over-period uses higher-is-better percentage change and requires both windows', () => {
  const lane = roasLane({ evaluation: 'period_over_period_change', greenThreshold: 5, yellowThreshold: -5 });
  const improved = calculateNorthStarLanes([lane], {
    sales: { currentRows: [{ spend: 100, results: 300 }], previousRows: [{ spend: 100, results: 200 }] },
  })[0];
  assert.deepEqual(improved, {
    key: 'roas', required: true, weight: 100,
    currentValue: 3, previousValue: 2, evaluationValue: 50,
    status: 'healthy', reason: 'Return on ad spend improved by 50% period over period.',
  });

  const worsened = calculateNorthStarLanes([lane], {
    sales: { currentRows: [{ spend: 100, results: 150 }], previousRows: [{ spend: 100, results: 200 }] },
  })[0];
  assert.equal(worsened.evaluationValue, -25);
  assert.equal(worsened.status, 'at_risk');
  assert.equal(worsened.reason, 'Return on ad spend worsened by 25% period over period.');

  const missing = calculateNorthStarLanes([lane], {
    sales: { currentRows: [{ spend: 100, results: 300 }], previousRows: null },
  })[0];
  assert.equal(missing.status, 'incomplete');
  assert.equal(missing.evaluationValue, null);
});

test('parent reducer uses required-lane precedence, ignores optional unavailable lanes, and never averages units', () => {
  const optional = cplLane({ key: 'optional-cpl', required: false, weight: 20 });
  const required = roasLane({ weight: 80 });
  const evidence = calculateNorthStarLanes([optional, required], {
    sales: { currentRows: [{ spend: 100, results: 300 }], previousRows: null },
  });
  assert.equal(evidence[0].status, 'unavailable');
  assert.deepEqual(reduceNorthStarLanes(evidence), {
    status: 'watch', value: null, reason: 'Required North Star lane roas is watch.',
  });

  const single = calculateNorthStarLanes([required], {
    sales: { currentRows: [{ spend: 100, results: 400 }], previousRows: null },
  });
  assert.deepEqual(reduceNorthStarLanes(single), {
    status: 'healthy', value: 4, reason: 'All required North Star lanes are healthy.',
  });
});

test('rejects malformed, unsupported, or incompatible lane contracts and ratio rows', () => {
  assert.throws(() => calculateNorthStarLanes([cplLane({ direction: 'higher_is_better' })], {}), /direction.*formula/i);
  assert.throws(() => calculateNorthStarLanes([cplLane(), cplLane()], {}), /duplicate lane key/i);
  assert.throws(() => calculateNorthStarLanes([cplLane({ sourceKeys: [] })], {}), /sourceKeys.*at least one/i);
  assert.throws(() => calculateNorthStarLanes([cplLane()], {
    leads: { currentRows: [{ spend: -1, results: 1 }], previousRows: [] },
  }), /nonnegative/i);
});