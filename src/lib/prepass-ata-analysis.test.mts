import assert from 'node:assert/strict';
import test from 'node:test';
import { ATA_EVENT_ANALYSIS } from './prepass-ata-analysis.ts';

function sum<T>(rows: readonly T[], field: keyof T): number {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

test('pre-event and activation phases reconcile to the final all-channel delivery', () => {
  const [preEvent, activation] = ATA_EVENT_ANALYSIS.phases;
  const preSpend = sum(preEvent.rows, 'spend') + ATA_EVENT_ANALYSIS.groundTruth.preEvent.spend;
  const activationSpend = sum(activation.rows, 'spend') + ATA_EVENT_ANALYSIS.groundTruth.duringEvent.spend;
  const preImpressions = sum(preEvent.rows, 'impressions') + ATA_EVENT_ANALYSIS.groundTruth.preEvent.impressions;
  const activationImpressions = sum(activation.rows, 'impressions') + ATA_EVENT_ANALYSIS.groundTruth.duringEvent.impressions;
  const preClicks = sum(preEvent.rows, 'clicks') + ATA_EVENT_ANALYSIS.groundTruth.preEvent.clicks;
  const activationClicks = sum(activation.rows, 'clicks') + ATA_EVENT_ANALYSIS.groundTruth.duringEvent.clicks;
  const platformConversions = sum(preEvent.rows, 'conversions') + sum(activation.rows, 'conversions');

  assert.equal(Number((preSpend + activationSpend).toFixed(6)), 15814.361637);
  assert.equal(preImpressions + activationImpressions, 754593);
  assert.equal(preClicks + activationClicks, 4825);
  assert.equal(Number(platformConversions.toFixed(6)), 18.422554);
});

test('GroundTruth location summaries preserve venue and geofence detail', () => {
  const mobile = ATA_EVENT_ANALYSIS.groundTruth.mobileLocations;
  const dooh = ATA_EVENT_ANALYSIS.groundTruth.doohVenues;

  assert.equal(Number(sum(mobile, 'spend').toFixed(2)), 380.60);
  assert.equal(sum(mobile, 'impressions'), 10874);
  assert.equal(sum(mobile, 'clicks'), 112);
  assert.equal(sum(dooh, 'impressions'), 370183);
  assert.equal(sum(dooh, 'reportedScreens'), 108);
  assert.equal(ATA_EVENT_ANALYSIS.groundTruth.totalSpend, 6326.93);
  assert.match(ATA_EVENT_ANALYSIS.groundTruth.note, /\$0\.01 higher from rounding/);
});
