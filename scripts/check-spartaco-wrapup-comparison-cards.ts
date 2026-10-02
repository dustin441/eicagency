import assert from 'node:assert/strict';
import { buildWrapupMetricComparison } from '../src/lib/spartaco-wrapup-comparison';

const zeroBaselineTraffic = buildWrapupMetricComparison(0, 937, 35);
assert.equal(zeroBaselineTraffic.campaignMode, 'share');
assert.equal(Number(zeroBaselineTraffic.campaignValue?.toFixed(4)), 0.964);
assert.equal(Number(zeroBaselineTraffic.afterChange?.toFixed(4)), -0.9626);

const zeroBaselineEngagement = buildWrapupMetricComparison(0, 448, 11);
assert.equal(zeroBaselineEngagement.campaignMode, 'share');
assert.equal(Number(zeroBaselineEngagement.campaignValue?.toFixed(4)), 0.976);
assert.equal(Number(zeroBaselineEngagement.afterChange?.toFixed(4)), -0.9754);

const normalBaseline = buildWrapupMetricComparison(100, 250, 75);
assert.equal(normalBaseline.campaignMode, 'lift');
assert.equal(normalBaseline.campaignValue, 1.5);
assert.equal(normalBaseline.afterChange, -0.7);

const noActivity = buildWrapupMetricComparison(0, 0, 0);
assert.equal(noActivity.campaignMode, 'share');
assert.equal(noActivity.campaignValue, null);
assert.equal(noActivity.afterChange, null);

console.log('Spartaco wrap-up comparison-card checks passed');
