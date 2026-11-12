import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBloomDashboardData, fetchBloomCreativeAnalysis } from './bloom-analytics.ts';
import { fetchArabellasDashboardData, fetchArabellaCreativeAnalysis } from './arabella-analytics.ts';
import { fetchKinseyDashboardData, fetchKinseyCreativeAnalysis } from './kinsey-analytics.ts';

const params = { start: '2026-10-01', end: '2026-10-31', compStart: '2026-09-01', compEnd: '2026-09-30' };
const loaders = {
  bloom: fetchBloomDashboardData,
  arabella: fetchArabellasDashboardData,
  kinsey: fetchKinseyDashboardData,
};

for (const client of ['bloom', 'arabella', 'kinsey'] as const) {
  test(`${client} Performance retains every Meta ad ID across pages, including missing previews, for the selected dates`, async t => {
    process.env.SPARTACO_SUPABASE_URL = 'https://scott-gallery-test.invalid';
    process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    // Identical names and media must not collapse distinct immutable ad IDs.
    const row = (id: number, adId: string, date = params.start) => ({
      id, date, ad_id: adId, ad_name: 'Same name', adset_name: 'Same ad set', campaign_name: 'Meta campaign',
      ad_channel: 'Meta', cost: 1, impressions: 10, clicks: 2, website_chats: 1, purchases: 1, revenue: 3,
      final_creative_link: 'https://example.invalid/shared.jpg', permanent_image_url: '',
      primary_text: '', headline: '', preview_url: '', is_video: false,
    });
    const source = Array.from({ length: 1000 }, (_, i) => row(i + 1, `ad-${i % 40}`));
    source.push({ ...row(1001, 'missing-preview', params.end), final_creative_link: '' });
    source.push({ ...row(1002, 'permanent-only', params.end), final_creative_link: '', permanent_image_url: 'https://example.invalid/permanent.jpg' });
    source.push({ ...row(1003, 'ad-0', params.end), adset_name: 'Renamed ad set', campaign_name: 'Renamed campaign', final_creative_link: 'https://example.invalid/latest.jpg' });
    const creativeTable = client === 'bloom' ? 'bloom_meta_ads' : `${client}_meta_ads_creatives`;
    const requests: URL[] = [];
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(init?.method ?? 'GET', 'GET');
      const url = new URL(String(input));
      const table = url.pathname.split('/').at(-1);
      const dates = url.searchParams.getAll('date');
      const current = dates.includes(`gte.${params.start}`) && dates.includes(`lte.${params.end}`);
      let data: unknown[] = [];
      if (table === creativeTable && current) {
        requests.push(url);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 1000);
        data = source.slice(offset, offset + limit);
      } else if (table === `${client}_meta_ads` && current) {
        data = Array.from({ length: 40 }, (_, i) => ({ ...row(i + 1, `ad-${i}`), ad_name: `Table ad ${i}` }));
      } else if (table === `${client}_master` && current) {
        data = [{ ...row(1, 'master-meta'), cost: source.length },
          ...(client === 'kinsey' ? [{ ...row(2, 'master-google'), ad_channel: 'Google', cost: 77 }] : [])];
      }
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    });

    const result = await loaders[client](params);
    const creatives = result.metaCreatives;
    assert.equal(creatives.length, 42, 'must not silently cap at 30 or drop preview-less ads');
    assert.deepEqual(new Set(creatives.map(c => c.adId)), new Set(source.map(r => r.ad_id)));
    assert.equal(creatives.reduce((sum, c) => sum + c.spend, 0), source.length);
    assert.equal(creatives.find(c => c.adId === 'ad-0')?.spend, 26);
    // Preserve the existing quality-ranked media selection for equal-quality URLs.
    assert.equal(creatives.find(c => c.adId === 'ad-0')?.finalCreativeLink, 'https://example.invalid/shared.jpg');
    const missing = creatives.find(c => c.adId === 'missing-preview');
    assert.ok(missing, 'fallback card must retain identity and metrics without a preview');
    assert.equal(missing.finalCreativeLink, '');
    assert.equal(missing.primaryText, '');
    assert.equal(missing.spend, 1);
    assert.equal(creatives.find(c => c.adId === 'permanent-only')?.permanentImageUrl, 'https://example.invalid/permanent.jpg');
    assert.ok(creatives.every((c, i) => i === 0 || creatives[i - 1].spend >= c.spend));
    assert.deepEqual(result.filterParams, params);
    assert.equal(result.prevSummary.spend, 0);
    assert.equal(result.summary.spend, source.length + (client === 'kinsey' ? 77 : 0));
    if ('channelRows' in result) {
      assert.equal(result.channelRows.find(c => c.channel === 'Meta')?.spend, source.length);
      if (client === 'kinsey') assert.equal(result.channelRows.find(c => c.channel === 'Google')?.spend, 77);
    }
    assert.deepEqual(requests.map(url => url.searchParams.get('offset')), ['0', '1000']);
    for (const url of requests) {
      assert.deepEqual(url.searchParams.getAll('date'), [`gte.${params.start}`, `lte.${params.end}`]);
      assert.equal(url.searchParams.get('limit'), '1000');
      assert.equal(url.searchParams.get('order'), client === 'bloom' ? 'date.asc,id.asc' : 'date.asc,ad_id.asc');
      assert.ok(url.searchParams.get('select')?.split(',').includes('ad_id'));
    }
    if ('adRows' in result) assert.equal(result.adRows.length, 30, 'ad table keeps its intentional limit');

    const analysisLoaders = { bloom: fetchBloomCreativeAnalysis, arabella: fetchArabellaCreativeAnalysis, kinsey: fetchKinseyCreativeAnalysis };
    const analysis = await analysisLoaders[client](params);
    // Performance must not broaden Ad Analysis eligibility or change its identity grouping.
    const analysisSource = client === 'bloom' ? source : source.filter(r => r.final_creative_link);
    assert.deepEqual(new Set(analysis.creatives.map(c => c.adId)), new Set(analysisSource.map(r => r.ad_id)));
    assert.equal(analysis.creatives.reduce((sum, c) => sum + c.spend, 0), analysisSource.length);
  });
}
