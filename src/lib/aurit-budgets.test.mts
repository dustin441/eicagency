import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAuritMonthlyBudget } from './aurit-budgets.ts';

const monthStart = '2026-11-01';
const row = (client: string, budget: number | string | null, period_start = monthStart) => ({ client, budget, period_start });

test('maps saved November budgets and their combined total', () => {
  assert.deepEqual(mapAuritMonthlyBudget([
    row('aurit_meta', '6000'), row('aurit_youtube', 2500), row('other', 100),
  ], monthStart), { monthStart, meta: 6000, youtube: 2500, total: 8500 });
});

test('missing budgets stay unavailable, including the total when either channel is missing', () => {
  assert.deepEqual(mapAuritMonthlyBudget([], monthStart), { monthStart, meta: null, youtube: null, total: null });
  assert.deepEqual(mapAuritMonthlyBudget([row('aurit_meta', 6000)], monthStart), { monthStart, meta: 6000, youtube: null, total: null });
  assert.equal(mapAuritMonthlyBudget([row('aurit_youtube', 2500)], monthStart).total, null);
});

test('zero is a saved budget, not an unavailable value', () => {
  assert.deepEqual(mapAuritMonthlyBudget([row('aurit_meta', 0), row('aurit_youtube', '0')], monthStart), {
    monthStart, meta: 0, youtube: 0, total: 0,
  });
});

test('chooses the latest effective row per channel regardless of ordering, ignoring future rows', () => {
  assert.deepEqual(mapAuritMonthlyBudget([
    row('aurit_meta', 9000, '2026-12-01'), row('aurit_meta', 6000),
    row('aurit_youtube', 2500, '2026-10-01'), row('aurit_meta', 4000, '2026-09-01'),
    row('aurit_youtube', 3000, '2026-11-02'),
  ], monthStart), { monthStart, meta: 6000, youtube: 2500, total: 8500 });
  assert.equal(mapAuritMonthlyBudget([row('aurit_meta', 6000, '2026-12-01')], monthStart).meta, null);
});

test('invalid latest values are unavailable without falling back to an old budget', () => {
  for (const budget of [null, '', 'invalid', -1, Infinity]) {
    const mapped = mapAuritMonthlyBudget([
      row('aurit_meta', 6000, '2026-10-01'), row('aurit_meta', budget), row('aurit_youtube', 2500),
    ], monthStart);
    assert.equal(mapped.meta, null);
    assert.equal(mapped.total, null);
  }
});
