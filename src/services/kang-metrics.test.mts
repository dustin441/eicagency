import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateKangRows, kangDateRange, fetchKangPages, type KangRow } from './kang-metrics.ts';

const row = (overrides: Partial<KangRow> = {}): KangRow => ({
  account_id: 'a', date: '2026-11-19', campaign_id: 'c', campaign_name: 'Traffic',
  adset_id: 's', adset_name: 'Local', ad_id: '1', ad_name: 'Wings',
  impressions: 100, clicks: 30, link_clicks: 10, cost: '20.50', landing_page_views: 5,
  updated_at: '2026-11-24T09:00:00Z', ...overrides,
});

test('aggregates weighted link metrics, not all clicks or averages of rates', () => {
  const result = aggregateKangRows([row(), row({ date: '2026-11-20', impressions: 900, link_clicks: 20, cost: '39.50', landing_page_views: 15 })]);
  assert.equal(result.summary.cost, 60);
  assert.equal(result.summary.link_clicks, 30);
  assert.equal(result.summary.linkCtr, 3);
  assert.equal(result.summary.linkCpc, 2);
  assert.equal(result.summary.landing_page_views, 20);
  assert.equal(result.summary.costPerLpv, 3);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.adsets.length, 1);
  assert.equal(result.ads.length, 1);
  assert.equal(result.daily.length, 2);
});

test('distinguishes missing source, real zero delivery and undefined rates', () => {
  assert.equal(aggregateKangRows([]).summary.cost, null);
  const zero = aggregateKangRows([row({ cost: 0, impressions: 0, link_clicks: 0, landing_page_views: 0 })]);
  assert.equal(zero.summary.cost, 0);
  assert.equal(zero.summary.linkCtr, null);
  assert.equal(zero.summary.costPerLpv, null);
  assert.equal(aggregateKangRows([row(), row({ landing_page_views: null })]).summary.landing_page_views, null);
});

test('groups by hierarchy IDs, not duplicate names, and reports newest source update', () => {
  const result = aggregateKangRows([row(), row({ campaign_id: 'other', updated_at: '2026-11-24T12:00:00Z' }), row({ account_id: 'other-account' })]);
  assert.equal(result.campaigns.length, 3);
  assert.equal(result.adsets.length, 3);
  assert.equal(result.ads.length, 3);
  assert.equal(result.updatedAt, '2026-11-24T12:00:00Z');
});

test('default cutoff is yesterday in Los Angeles, including DST boundaries', () => {
  assert.deepEqual(kangDateRange({}, new Date('2026-11-24T07:00:00Z')), { start: '2026-11-19', end: '2026-11-22' });
  assert.deepEqual(kangDateRange({}, new Date('2026-11-24T09:00:00Z')), { start: '2026-11-19', end: '2026-11-23' });
  assert.deepEqual(kangDateRange({ start: '2026-10-01' }, new Date('2026-11-01T08:00:00Z')), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(kangDateRange({ start: '2026-02-30', end: 'garbage' }, new Date('2026-11-24T12:00:00Z')), { start: '2026-11-19', end: '2026-11-23' });
  assert.deepEqual(kangDateRange({ start: '2026-11-20', end: '2026-11-21' }), { start: '2026-11-20', end: '2026-11-21' });
  assert.deepEqual(kangDateRange({ start: '2026-12-01', end: '2026-11-01' }, new Date('2026-11-24T12:00:00Z')), { start: '2026-11-19', end: '2026-11-23' });
});

test('pagination reads beyond 1000 rows and exact-size last pages', async () => {
  const source = Array.from({ length: 2000 }, (_, i) => row({ ad_id: String(i) }));
  const calls: number[][] = [];
  const rows = await fetchKangPages(async (from, to) => {
    calls.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  });
  assert.equal(rows.length, 2000);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.equal(aggregateKangRows(rows).summary.link_clicks, 20000);
});

test('a later page failure rejects partial totals', async () => {
  await assert.rejects(fetchKangPages(async (from) => from === 0
    ? { data: [row(), row()], error: null }
    : { data: null, error: new Error('offline') }, 2), /source query failed/);
});
