import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Champagne budget edit scopes lookup to current month to preserve prior budgets', () => {
  const action = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8');
  const lookup = action.slice(action.indexOf('const { data: existing'), action.indexOf('if (lookupError)'));
  assert.match(lookup, /\.eq\('client', client\)/);
  assert.match(lookup, /\.eq\('period_start', periodStart\)/);
  assert.match(lookup, /\.limit\(2\)/);
  assert.match(action, /\.eq\('id', budgetId\)/);
  assert.match(action, /await requireBudgetAdmin\(\)/);
});
