import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKangCreatives, type KangCreativeMetadata } from './kang-creatives.ts';
import { aggregateKangRows, type KangRow } from './kang-metrics.ts';
const row = (overrides: Partial<KangRow> = {}): KangRow => ({ account_id: '1683292242584249', date: '2026-11-19', campaign_id: 'c', campaign_name: 'Campaign', adset_id: 's', adset_name: 'Set', ad_id: 'a', ad_name: 'Same name', impressions: 100, clicks: 999, link_clicks: 10, cost: 1.25, landing_page_views: 5, updated_at: null, ...overrides });
const metadata = (ad_id: string, extra: Partial<KangCreativeMetadata> = {}): KangCreativeMetadata => ({ account_id: '1683292242584249', ad_id, ...extra });
test('duplicate names join by immutable ad ID and account, never name', () => {
  const ads = buildKangCreatives([row(), row({ ad_id: 'b' })], [metadata('a', { headline: 'A' }), metadata('b', { headline: 'B' }), metadata('a', { account_id: 'other', headline: 'Wrong' })]);
  assert.equal(ads.length, 2);
  assert.equal(ads.find(a => a.adId === 'a')?.headline, 'A');
  assert.equal(ads.find(a => a.adId === 'b')?.headline, 'B');
});
test('selected dates aggregate traffic using summed numerators and denominators', () => {
  const rows = [row(), row({ date: '2026-11-20', cost: 3.75, impressions: 900, link_clicks: 20, landing_page_views: 15 }), row({ date: '2026-11-21', cost: 999 })];
  const [ad] = buildKangCreatives(rows.filter(r => r.date >= '2026-11-19' && r.date <= '2026-11-20'), []);
  assert.equal(ad.traffic?.spend, 5);
  assert.equal(ad.traffic?.linkClicks, 30);
  assert.equal(ad.traffic?.linkCtr, 3);
  assert.equal(ad.traffic?.linkCpc, 5 / 30);
  assert.equal(ad.traffic?.landingPageViews, 20);
  assert.equal(ad.traffic?.costPerLpv, .25);
});
test('missing metadata never removes performance and metadata-only ads never add performance', () => {
  const rows = [row(), row({ ad_id: 'b', cost: 2 })];
  const before = aggregateKangRows(rows);
  const without = buildKangCreatives(rows, []);
  const withMetadata = buildKangCreatives(rows, [metadata('a', { image_url: 'https://example.com/a.jpg' }), metadata('orphan')]);
  assert.equal(without.length, 2);
  assert.equal(withMetadata.length, 2);
  assert.equal(without.reduce((sum, ad) => sum + ad.spend, 0), before.summary.cost);
  assert.deepEqual(withMetadata.map(a => a.traffic), without.map(a => a.traffic));
  assert.deepEqual(aggregateKangRows(rows), before);
  assert.deepEqual(buildKangCreatives([], [metadata('orphan')]), []);
});
test('missing fact metrics and zero denominators remain unavailable, actual zero spend stays zero', () => {
  const [missing] = buildKangCreatives([row({ cost: null, link_clicks: null })], []);
  assert.equal(missing.traffic?.spend, null);
  assert.equal(missing.traffic?.linkClicks, null);
  assert.equal(missing.traffic?.linkCpc, null);
  const [zero] = buildKangCreatives([row({ cost: 0, impressions: 0, link_clicks: 0, landing_page_views: 0 })], []);
  assert.equal(zero.traffic?.spend, 0);
  assert.equal(zero.traffic?.linkCtr, null);
  assert.equal(zero.traffic?.linkCpc, null);
  assert.equal(zero.traffic?.costPerLpv, null);
});
