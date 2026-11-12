import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchChampagnePerformanceCreatives } from './champagne-performance-creatives.ts';

const params = { start: '2026-10-01', end: '2026-11-11', channel: 'all' };
function database(rows: Record<string, unknown>[], failAt = -1) {
  const calls: unknown[][] = [];
  const db = {
    from(table: string) {
      calls.push(['from', table]);
      const query = {
        select(value: string) { calls.push(['select', value]); return query; },
        gte(column: string, value: string) { calls.push(['gte', column, value]); return query; },
        lte(column: string, value: string) { calls.push(['lte', column, value]); return query; },
        order(column: string, options: unknown) { calls.push(['order', column, options]); return query; },
        async range(from: number, to: number) {
          calls.push(['range', from, to]);
          return from === failAt ? { data: null, error: { message: 'page unavailable' } }
            : { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof fetchChampagnePerformanceCreatives>[0], calls };
}

test('loads every page with inclusive date bounds and stable date/id order, retaining all individual ads', async () => {
  const rows = Array.from({ length: 1380 }, (_, i) => ({
    id: i, date: '2026-10-01', ad_id: String(i % 65), ad_name: 'Same concept',
    campaign_name: i < 1000 ? 'Events A' : 'Events B', spend: 1, leads: 1, clicks: 2, impressions: 10,
  }));
  const { db, calls } = database(rows);
  const ads = await fetchChampagnePerformanceCreatives(db, params, 'events');
  assert.equal(ads.length, 65);
  assert.equal(ads.reduce((sum, ad) => sum + ad.spend, 0), 1380);
  assert.equal(ads.reduce((sum, ad) => sum + ad.leads, 0), 1380);
  assert.equal(ads.reduce((sum, ad) => sum + ad.clicks, 0), 2760);
  assert.ok(ads.every(ad => ad.finalCreativeLink === ''));
  assert.equal(ads.find(ad => ad.adId === '0')?.campaign, 'Events B');
  assert.equal(ads.find(ad => ad.adId === '0')?.name, 'Same concept');
  assert.deepEqual(calls.filter(call => call[0] === 'range'), [['range', 0, 999], ['range', 1000, 1999]]);
  assert.deepEqual(calls.filter(call => call[0] === 'gte'), [['gte', 'date', params.start], ['gte', 'date', params.start]]);
  assert.deepEqual(calls.filter(call => call[0] === 'lte'), [['lte', 'date', params.end], ['lte', 'date', params.end]]);
  assert.deepEqual(calls.filter(call => call[0] === 'order'), [
    ['order', 'date', { ascending: true }], ['order', 'id', { ascending: true }],
    ['order', 'date', { ascending: true }], ['order', 'id', { ascending: true }],
  ]);
});

test('honors channel without querying Meta for Google', async () => {
  const { db, calls } = database([]);
  assert.deepEqual(await fetchChampagnePerformanceCreatives(db, { ...params, channel: 'Google' }, 'events'), []);
  assert.deepEqual(calls, []);
});

test('separates Halloween from events and does not present broad clicks or leads as Halloween results', async () => {
  const { db } = database([
    { ad_id: 'event', campaign_name: 'Private Events', spend: 10, clicks: 5, leads: 2 },
    { ad_id: 'halloween', campaign_name: 'Fangs & Flutes', spend: 20, clicks: 8, leads: 4 },
  ]);
  assert.deepEqual((await fetchChampagnePerformanceCreatives(db, params, 'events')).map(ad => ad.adId), ['event']);
  const halloween = await fetchChampagnePerformanceCreatives(db, { ...params, channel: 'Meta' }, 'halloween');
  assert.equal(halloween.length, 1);
  assert.equal(halloween[0].adId, 'halloween');
  assert.equal(halloween[0].leads, 0);
  assert.equal(halloween[0].clicksAvailable, false);
  assert.equal(halloween[0].clicks, 0);
});

test('rejects failed later pages rather than returning partial results', async () => {
  const { db } = database(Array.from({ length: 1000 }, () => ({ ad_id: 'a', campaign_name: 'Events' })), 1000);
  await assert.rejects(fetchChampagnePerformanceCreatives(db, params, 'events'), /Unable to load Champagne Haus/);
});

test('refreshes creative metadata across days without dropping missing-image ads', async () => {
  const { db } = database([
    { ad_id: 'a', campaign_name: 'Events', final_creative_link: 'old.jpg', primary_text: 'Copy', is_video: true, video_url: 'old.mp4' },
    { ad_id: 'a', campaign_name: 'Events', final_creative_link: 'new.jpg', primary_text: '', video_url: 'new.mp4' },
    { ad_id: 'b', campaign_name: 'Events' },
  ]);
  const ads = await fetchChampagnePerformanceCreatives(db, params, 'events');
  assert.equal(ads.length, 2);
  assert.equal(ads[0].primaryText, 'Copy');
  assert.equal(ads[0].finalCreativeLink, 'new.jpg');
  assert.equal(ads[0].videoUrl, 'new.mp4');
  assert.equal(ads[0].isVideo, true);
  assert.equal(ads[1].name, 'b');
});

test('wires server-loaded individual creatives to the existing preview UI with honest conversion labels', () => {
  const service = readFileSync(new URL('./champagne-analytics.ts', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../components/ChampagneDashboardClient.tsx', import.meta.url), 'utf8');
  assert.match(service, /fetchChampagnePerformanceCreatives\(db, params, scope\)/);
  assert.match(service, /metaCreatives,/);
  assert.match(ui, /<MetaAdPreviews/);
  assert.match(ui, /creatives=\{data.metaCreatives\}/);
  assert.match(ui, /metricMode=\{isHalloween \? 'media' : 'leads'\}/);
  assert.match(ui, /conversion: 'Leads', cpa: 'Cost \/ Lead'/);
  assert.match(ui, /not CRM-verified/);
});
