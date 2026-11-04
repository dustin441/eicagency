import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAuritDashboardData } from './aurit-analytics.ts';

const params = { start: '2026-09-01', end: '2026-09-30', compStart: '2026-08-01', compEnd: '2026-08-31', channel: 'Meta' as const };
function setup(t: TestContext) {
  process.env.SPARTACO_SUPABASE_URL = 'https://pacing-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T12:00:00Z') });
}

test('pacing uses both current-month channels independent of selected date/channel, Google VIDEO only, all pages', async t => {
  setup(t);
  const calls: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const select = url.searchParams.get('select');
    let rows: unknown[] = [];
    if (url.pathname.endsWith('/budgets')) rows = [{ client: 'aurit_meta', budget: 900, period_start: '2026-11-01' }, { client: 'aurit_youtube', budget: 300, period_start: '2026-11-01' }];
    if (select === 'date,cost' || select === 'date,cost,campaign_type') {
      calls.push(url);
      assert.equal(url.searchParams.get('date'), 'gte.2026-11-01');
      assert(url.search.includes('lt.2026-11-04'));
      assert.equal(url.searchParams.get('order'), 'date.asc,campaign_id.asc');
      if (url.pathname.endsWith('/aurit_meta')) rows = Number(url.searchParams.get('offset')) === 0 ? Array.from({ length: 1000 }, () => ({ date: '2026-11-03', cost: 1 })) : [{ date: '2026-11-03', cost: 1 }];
      else {
        assert.equal(url.searchParams.get('campaign_type'), 'eq.VIDEO');
        rows = [{ date: '2026-11-03', cost: 5, campaign_type: 'VIDEO' }];
      }
    }
    return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
  });
  const data = await fetchAuritDashboardData(params);
  assert.equal(calls.length, 3);
  assert.equal(data.pacing.meta.spend, 1001);
  assert.equal(data.pacing.youtube.spend, 5);
  assert.equal(data.pacing.overall.spend, 1006);
  assert.equal(data.pacing.cutoff, '2026-11-03');
});

test('pacing page errors fail closed and never return partial spend', async t => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/aurit_meta') && url.searchParams.get('select') === 'date,cost') {
      if (Number(url.searchParams.get('offset')) === 0) return new Response(JSON.stringify(Array.from({ length: 1000 }, () => ({ date: '2026-11-03', cost: 1 }))), { headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ message: 'pacing page failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  });
  await assert.rejects(fetchAuritDashboardData(params), /Meta pacing: pacing page failed/);
});
