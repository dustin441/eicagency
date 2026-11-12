import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAuritDashboardData } from './aurit-analytics.ts';

const params = { start: '2026-11-01', end: '2026-11-10', compStart: '2026-10-01', compEnd: '2026-10-10', channel: 'all' as const };

test('loads every creative page in the selected dates, keeps separate ad IDs and missing previews, and sums daily metrics', async t => {
  process.env.SPARTACO_SUPABASE_URL = 'https://creative-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const requests: URL[] = [];
  const rows = Array.from({ length: 1001 }, (_, i) => ({ date: '2026-11-01', ad_id: String(i), ad_name: 'Same concept', campaign_name: `Campaign ${i}`, adset_name: `Ad set ${i}`, spend: '2', leads: '3', clicks: 4, impressions: 100, final_creative_link: null }));
  rows.push({ ...rows[0], date: '2026-11-02' });
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith('/aurit_meta_ads_creatives')) return new Response('[]');
    requests.push(url);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return new Response(JSON.stringify(rows.slice(offset, offset + 1000)), { headers: { 'Content-Type': 'application/json' } });
  });
  const data = await fetchAuritDashboardData(params);
  assert.equal(data.metaCreatives.length, 1001);
  assert.equal(requests.length, 2);
  for (const url of requests) {
    assert.deepEqual(url.searchParams.getAll('date'), ['gte.2026-11-01', 'lte.2026-11-10']);
    assert.equal(url.searchParams.get('order'), 'date.asc,ad_id.asc');
  }
  const ad = data.metaCreatives.find(ad => ad.adId === '0')!;
  assert.equal(ad.spend, 4);
  assert.equal(ad.leads, 6);
  assert.equal(ad.impressions, 200);
  assert.equal(ad.clicks, 8);
  assert.equal(ad.campaign, 'Campaign 0');
  assert.equal(ad.adset, 'Ad set 0');
  assert.equal(ad.finalCreativeLink, '');
});

test('Google-only filters do not query or fabricate Meta creatives', async t => {
  process.env.SPARTACO_SUPABASE_URL = 'https://creative-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    assert(!String(input).includes('aurit_meta_ads_creatives'));
    return new Response('[]');
  });
  const data = await fetchAuritDashboardData({ ...params, channel: 'Google' });
  assert.deepEqual(data.metaCreatives, []);
});

test('creative query failures are surfaced rather than presented as empty data', async t => {
  process.env.SPARTACO_SUPABASE_URL = 'https://creative-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => String(input).includes('aurit_meta_ads_creatives')
    ? new Response(JSON.stringify({ message: 'creative unavailable' }), { status: 400 }) : new Response('[]'));
  await assert.rejects(fetchAuritDashboardData(params), /Failed to fetch Aurit performance creatives: creative unavailable/);
});
