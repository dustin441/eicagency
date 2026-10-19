import test from 'node:test';
import assert from 'node:assert/strict';
import { buildElevateDashboardData, type ElevatePerformanceRow } from './elevate-analytics-core.ts';

const rows: ElevatePerformanceRow[] = [
  { date: '2026-10-15', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 1000, clicks: 50, spend: 25, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: {} },
  { date: '2026-10-16', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 500, clicks: 20, spend: 10, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: {} },
  { date: '2026-10-16', platform: 'Google Search', account_id: '2', campaign_id: 'g1', campaign_name: 'Elevate Search', creative_id: 'g-ad', creative_name: 'Responsive search ad', impressions: 200, clicks: 10, spend: 30, form_fills: 2, preview_url: null, destination_url: 'https://example.com', metadata: {} },
];

test('aggregates selected rows and keeps creative-level performance', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.equal(data.totalSpend, 65);
  assert.equal(data.totalImpressions, 1700);
  assert.equal(data.totalClicks, 80);
  assert.equal(data.ctr, 80 / 1700 * 100);
  assert.equal(data.formFills, 2);
  assert.equal(data.formFillCoverage, 'partial');
  assert.equal(data.creatives.length, 2);
  const meta = data.creatives.find(row => row.creativeId === 'a1');
  assert.equal(meta?.spend, 35);
  assert.equal(meta?.impressions, 1500);
  assert.equal(meta?.formFills, null);
});

test('filters by channel without converting unavailable form fills to zero', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'Meta' });
  assert.equal(data.totalSpend, 35);
  assert.equal(data.formFills, null);
  assert.equal(data.formFillCoverage, 'unavailable');
});

test('represents every required channel and documents unavailable sources', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.deepEqual(data.channels.map(channel => channel.platform), ['Google Search', 'Meta', 'LinkedIn', 'GroundTruth']);
  assert.equal(data.channels.find(channel => channel.platform === 'Meta')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'Google Search')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'LinkedIn')?.status, 'represented');
  assert.match(data.channels.find(channel => channel.platform === 'GroundTruth')?.limitation ?? '', /manually/i);
});

test('fails closed on a source error and rejects unsafe creative URLs', () => {
  const unsafeRows: ElevatePerformanceRow[] = [
    { ...rows[0], preview_url: 'javascript:alert(1)', destination_url: 'data:text/html,unsafe' },
  ];
  const data = buildElevateDashboardData(unsafeRows, { start: '2026-10-14', end: '2026-10-18', channel: 'all' }, 'Source unavailable');
  const meta = data.channels.find(channel => channel.platform === 'Meta');
  assert.equal(meta?.status, 'represented');
  assert.equal(meta?.spend, null);
  assert.match(meta?.limitation ?? '', /temporarily unavailable/i);
  assert.equal(data.creatives[0].previewUrl, null);
  assert.equal(data.creatives[0].destinationUrl, null);
});

test('marks a selected channel without source rows as unavailable instead of measured zero', () => {
  const metaOnly = rows.filter(row => row.platform === 'Meta');
  const data = buildElevateDashboardData(metaOnly, { start: '2026-10-15', end: '2026-10-16', channel: 'Google Search' });
  assert.equal(data.selectionUnavailable, true);
  assert.equal(data.channels.find(channel => channel.platform === 'Google Search')?.status, 'represented');
});
