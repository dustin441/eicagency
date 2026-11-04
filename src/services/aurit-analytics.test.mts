import test from 'node:test';
import assert from 'node:assert/strict';
import { snapToMonthStart, today } from '../lib/date-utils.ts';
import { fetchAuritDashboardData } from './aurit-analytics.ts';

const params = { start: '2026-09-01', end: '2026-09-30', compStart: '2026-08-01', compEnd: '2026-08-31', channel: 'Meta' as const };

// Supabase HTTP is mocked: no real database access or writes.
test('loads both saved budget keys for the current month despite historical dates and a Meta-only filter', async t => {
  process.env.SPARTACO_SUPABASE_URL = 'https://budget-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const monthStart = snapToMonthStart(today());
  const budgetRequests: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method ?? 'GET', 'GET');
    const url = new URL(String(input));
    if (url.pathname.endsWith('/budgets')) {
      budgetRequests.push(url);
      return new Response(JSON.stringify([
        { client: 'aurit_meta', budget: 6000, period_start: monthStart },
        { client: 'aurit_youtube', budget: 2500, period_start: monthStart },
      ]), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  });
  const data = await fetchAuritDashboardData(params);
  assert.deepEqual(data.monthlyBudget, { monthStart, meta: 6000, youtube: 2500, total: 8500 });
  assert.equal(budgetRequests.length, 1);
  assert.equal(budgetRequests[0].searchParams.get('client'), 'in.(aurit_meta,aurit_youtube)');
  assert.equal(budgetRequests[0].searchParams.get('period_start'), `lte.${monthStart}`);
  assert.equal(budgetRequests[0].searchParams.get('order'), 'period_start.desc,id.desc');
});

test('fails the dashboard request on budget query errors rather than displaying an unavailable plan', async t => {
  process.env.SPARTACO_SUPABASE_URL = 'https://budget-test.invalid';
  process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const failed = new URL(String(input)).pathname.endsWith('/budgets');
    return new Response(failed ? JSON.stringify({ message: 'budget query failed' }) : '[]', {
      status: failed ? 400 : 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  await assert.rejects(fetchAuritDashboardData(params), /Failed to fetch Aurit monthly budgets: budget query failed/);
});
