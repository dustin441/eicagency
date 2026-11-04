import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildYtdRevenue, revenueValue, mediaFamily, isCompression, changePct, type YtdRevenueRow } from './nsi-ytd-core.ts';

const fixture: YtdRevenueRow[] = [];
for (const year of [2025, 2026]) for (let month = 1; month <= 10; month++) {
  for (const [campaign, amount] of [['CCF-CON-BPT2', 100], ['CON-CON-POL2', 50], ['CON-CON-CMP', 20]] as const) {
    fixture.push({ month_start: `${year}-${String(month).padStart(2, '0')}-01`, campaign, revenue: year === 2026 ? amount * 2 : amount });
  }
}
test('combined revenue never adds Compression a second time', () => {
  const result = buildYtdRevenue(fixture, []);
  assert.equal(result.monthly[0].currentRevenue, 300);
  assert.equal(result.revenueFamilies[2].current, 400);
  assert.equal(revenueValue(fixture, 2026, ['CCF-CON-BPT2', 'CON-CON-POL2']).value, 3000);
});
test('missing and null source months make YTD unavailable, observed zero remains valid', () => {
  const rows = fixture.filter(row => !(row.month_start === '2026-03-01' && row.campaign === 'CCF-CON-BPT2'));
  assert.equal(revenueValue(rows, 2026, ['CCF-CON-BPT2']).value, null);
  assert.equal(revenueValue(rows, 2026, ['CCF-CON-BPT2']).months, 9);
  assert.equal(buildYtdRevenue(rows, []).monthly[2].currentRevenue, null);
  assert.equal(revenueValue([{ month_start: '2026-01-01', campaign: 'x', revenue: null }], 2026, ['x'], 1).value, null);
  assert.equal(revenueValue([{ month_start: '2026-01-01', campaign: 'x', revenue: 0 }], 2026, ['x'], 1).value, 0);
});
test('duplicate source months fail closed rather than adding revisions', () => {
  const rows = [...fixture, fixture[0]];
  assert.equal(revenueValue(rows, 2025, ['CCF-CON-BPT2']).value, null);
  assert.equal(buildYtdRevenue(rows, []).monthly[0].previousRevenue, null);
});
test('OOPS and EZL roll into Bridgeport; CMP stays nested in Polaris; ambiguous rows stay other', () => {
  const row = (sub_campaign: string | null, campaign_name = '') => ({ date: '2026-10-01', cost: 10, sub_campaign, campaign_name });
  assert.equal(mediaFamily(row('CCF-END-OOPS')), 'BPT');
  assert.equal(mediaFamily(row('Default text if none found', 'CCF-END-OOPS | META')), 'BPT');
  assert.equal(mediaFamily(row('CCF-PEN-EZL')), 'BPT');
  assert.equal(mediaFamily(row('CON-END-CMP')), 'POL');
  assert.equal(isCompression(row('CON-END-CMP')), true);
  assert.equal(mediaFamily(row('NEL-END-360')), 'OTHER');
  assert.equal(mediaFamily(row(null, 'COMPLETE unknown')), 'OTHER');
  assert.equal(mediaFamily(row('NEL-END-360', 'CCF-END-OOPS')), 'OTHER');
});
test('multiple rows per month sum; family spend conserves portfolio excluding nested breakout', () => {
  const media = [
    { date: '2026-01-01', cost: 10, sub_campaign: 'CCF-END-OOPS', campaign_name: '' },
    { date: '2026-01-02', cost: 20, sub_campaign: 'CCF-END-EZL', campaign_name: '' },
    { date: '2026-01-03', cost: 40, sub_campaign: 'CON-END-CMP', campaign_name: '' },
    { date: '2026-01-04', cost: 5, sub_campaign: null, campaign_name: 'unknown' },
    { date: '2025-11-01', cost: 10000, sub_campaign: null, campaign_name: 'unknown' },
  ];
  const result = buildYtdRevenue(fixture, media);
  assert.equal(result.monthly[0].currentSpend, 75);
  assert.equal(result.revenueFamilies.filter(row => row.key !== 'CMP').reduce((sum, row) => sum + row.spend, 0), 75);
  assert.equal(result.revenueFamilies.find(row => row.key === 'CMP')!.spend, 40);
  assert.equal(result.monthly[0].previousSpend, 0);
});
test('null and zero prior comparisons are not fabricated growth', () => {
  assert.equal(changePct(100, null), null);
  assert.equal(changePct(100, 0), null);
  assert.equal(changePct(0, 100), -100);
});
