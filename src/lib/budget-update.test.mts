import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_EDITABLE_BUDGET, updateSingleBudgetRow, validateEditableBudget } from './budget-update.ts';

test('budget validation rejects non-finite, non-positive, and excessive values', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1, MAX_EDITABLE_BUDGET + 1]) {
    assert.equal(validateEditableBudget(value), 'Invalid budget amount', String(value));
  }
});

test('budget validation accepts finite values inside the approved range', () => {
  for (const value of [0.01, 1, 50_000, MAX_EDITABLE_BUDGET]) {
    assert.equal(validateEditableBudget(value), null, String(value));
  }
});

function fakeBudgetDb(existing: { id: number }[], saved: { id: number; client: string; budget: number } | null) {
  const calls: Array<[string, unknown]> = [];
  const lookup = {
    select: (columns: string) => { calls.push(['lookup.select', columns]); return lookup; },
    eq: (column: string, value: unknown) => { calls.push([`lookup.eq.${column}`, value]); return lookup; },
    order: (column: string) => { calls.push(['lookup.order', column]); return lookup; },
    limit: async (count: number) => { calls.push(['lookup.limit', count]); return { data: existing, error: null }; },
  };
  const update = {
    eq: (column: string, value: unknown) => { calls.push([`update.eq.${column}`, value]); return update; },
    select: (columns: string) => { calls.push(['update.select', columns]); return update; },
    single: async () => ({ data: saved, error: null }),
  };
  const db = {
    from: (table: string) => {
      calls.push(['from', table]);
      return {
        ...lookup,
        update: (values: unknown) => { calls.push(['update.values', values]); return update; },
      };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

test('budget update refuses missing and duplicate rows before writing', async () => {
  for (const rows of [[], [{ id: 1 }, { id: 2 }]]) {
    const { db, calls } = fakeBudgetDb(rows, null);
    const error = await updateSingleBudgetRow(db, 'bloom', 5000);
    assert.match(error ?? '', rows.length === 0 ? /not configured/ : /Duplicate/);
    assert.equal(calls.some(([name]) => name === 'update.values'), false);
  }
});

test('budget update targets one exact id and client and verifies readback', async () => {
  const { db, calls } = fakeBudgetDb([{ id: 42 }], { id: 42, client: 'bloom', budget: 5000 });
  assert.equal(await updateSingleBudgetRow(db, 'bloom', 5000), null);
  assert.ok(calls.some(([name, value]) => name === 'update.eq.id' && value === 42));
  assert.ok(calls.some(([name, value]) => name === 'update.eq.client' && value === 'bloom'));
  assert.ok(calls.some(([name, value]) => name === 'update.select' && value === 'id,client,budget'));
});

test('budget update fails when the saved row does not match the requested value', async () => {
  const { db } = fakeBudgetDb([{ id: 42 }], { id: 42, client: 'bloom', budget: 4999 });
  assert.equal(await updateSingleBudgetRow(db, 'bloom', 5000), 'Budget update could not be verified');
});
