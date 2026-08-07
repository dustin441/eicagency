import assert from 'node:assert/strict';
import { calculatePaidAdsAov } from '../src/lib/kinsey-aov.ts';

assert.equal(calculatePaidAdsAov(7617.76, 72), 7617.76 / 72);
assert.equal(calculatePaidAdsAov(0, 0), null);
assert.equal(calculatePaidAdsAov(125, 0), null);

const rows = [
  { revenue: 100, purchases: 1 },
  { revenue: 300, purchases: 2 },
];
const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
const purchases = rows.reduce((sum, row) => sum + row.purchases, 0);
assert.equal(calculatePaidAdsAov(revenue, purchases), 400 / 3);
assert.notEqual(
  calculatePaidAdsAov(revenue, purchases),
  rows.reduce((sum, row) => sum + calculatePaidAdsAov(row.revenue, row.purchases), 0) / rows.length,
  'AOV must be weighted from summed revenue and purchases, not averaged from row-level AOVs',
);

console.log('Kinsey paid-ads AOV math: PASS');
