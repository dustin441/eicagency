import assert from 'node:assert/strict';
import { calculateGoogleAdsAov } from '../src/lib/state48-aov.ts';

assert.equal(calculateGoogleAdsAov(7617.76, 72), 7617.76 / 72);
assert.equal(calculateGoogleAdsAov(0, 0), null);
assert.equal(calculateGoogleAdsAov(125, 0), null);

const rows = [
  { revenue: 100, purchases: 1 },
  { revenue: 300, purchases: 2 },
];
const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
const purchases = rows.reduce((sum, row) => sum + row.purchases, 0);
assert.equal(calculateGoogleAdsAov(revenue, purchases), 400 / 3);
assert.notEqual(
  calculateGoogleAdsAov(revenue, purchases),
  rows.reduce((sum, row) => sum + calculateGoogleAdsAov(row.revenue, row.purchases), 0) / rows.length,
  'AOV must be weighted from summed Google Ads revenue and purchases, not averaged from row-level AOVs',
);

console.log('State Forty Eight Google Ads AOV math: PASS');
