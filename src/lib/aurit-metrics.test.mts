import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuritAggregates, conversionKey, sumSelected } from './aurit-metrics.ts';

const day = (date: string, channel: 'Meta' | 'Google', campaignId: string, cost: number, extra: Partial<{ impressions: number; clicks: number; name: string }> = {}) => ({
  date, channel, campaignId, campaignName: extra.name ?? `C${campaignId}`, campaignType: channel === 'Google' ? 'SEARCH' : null,
  impressions: extra.impressions ?? 100, clicks: extra.clicks ?? 10, cost,
});
const conv = (date: string, channel: 'Meta' | 'Google', campaignId: string, type: string, label: string, conversions: number) => ({
  date, channel, campaignId, conversionType: type, conversionLabel: label, conversions,
});

test('keeps each conversion type separate per platform and lets any selection be summed', () => {
  const agg = buildAuritAggregates({
    current: [day('2026-10-01', 'Google', '1', 50), day('2026-10-01', 'Meta', '9', 20)],
    previous: [],
    currentConversions: [
      conv('2026-10-01', 'Google', '1', '111', 'Phone Call', 3),
      conv('2026-10-01', 'Google', '1', '222', 'Consultation Scheduled', 1),
      conv('2026-10-01', 'Meta', '9', 'offsite_conversion.fb_pixel_lead', 'Website Leads', 2),
    ],
    previousConversions: [],
  });

  assert.deepEqual(agg.conversionTypes.map(t => [t.key, t.conversions]), [
    ['Google|111', 3],
    ['Google|222', 1],
    ['Meta|offsite_conversion.fb_pixel_lead', 2],
  ]);

  const google = agg.campaignRows.find(r => r.channel === 'Google')!;
  const allTypes = new Set(agg.conversionTypes.map(t => t.key));
  assert.equal(sumSelected(google.conversionsByType, allTypes), 4);
  assert.equal(sumSelected(google.conversionsByType, new Set([conversionKey('Google', '222')])), 1);
  // A Meta-only selection never counts Google conversions.
  assert.equal(sumSelected(google.conversionsByType, new Set(['Meta|offsite_conversion.fb_pixel_lead'])), 0);
});

test('separates current and comparison periods and totals spend by channel', () => {
  const agg = buildAuritAggregates({
    current: [day('2026-10-02', 'Google', '1', 30), day('2026-10-03', 'Google', '1', 70)],
    previous: [day('2026-09-02', 'Google', '1', 40)],
    currentConversions: [conv('2026-10-02', 'Google', '1', '111', 'Phone Call', 2)],
    previousConversions: [conv('2026-09-02', 'Google', '1', '111', 'Phone Call', 5)],
  });

  const google = agg.channelRows.find(r => r.channel === 'Google')!;
  assert.equal(google.spend, 100);
  assert.equal(google.prevSpend, 40);
  assert.equal(agg.channelRows.find(r => r.channel === 'Meta')!.spend, 0);

  const type = agg.conversionTypes[0];
  assert.equal(type.conversions, 2);
  assert.equal(type.prevConversions, 5);

  const campaign = agg.campaignRows[0];
  assert.equal(campaign.prevSpend, 40);
  assert.equal(campaign.prevConversionsByType['Google|111'], 5);
  assert.deepEqual(agg.timeSeries.map(p => [p.label, p.spend]), [['2026-10-02', 30], ['2026-10-03', 70]]);
});

test('uses the latest label for a renamed conversion action and drops idle campaigns', () => {
  const agg = buildAuritAggregates({
    current: [day('2026-10-01', 'Google', '1', 10), day('2026-10-01', 'Google', '2', 0, { impressions: 0, clicks: 0 })],
    previous: [],
    currentConversions: [
      conv('2026-10-01', 'Google', '1', '111', 'Phone Call - old', 1),
      conv('2026-10-05', 'Google', '1', '111', 'Phone Call', 1),
    ],
    previousConversions: [],
  });
  assert.equal(agg.conversionTypes[0].label, 'Phone Call');
  assert.equal(agg.conversionTypes[0].conversions, 2);
  assert.deepEqual(agg.campaignRows.map(r => r.campaignId), ['1']);
});
