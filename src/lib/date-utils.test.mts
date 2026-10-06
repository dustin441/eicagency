import assert from 'node:assert/strict';
import test from 'node:test';

import { getPresetDates, lastCompleteMonthEnd, snapToMonthEnd } from './date-utils.ts';

test('month-end helpers are stable across time zones', () => {
  assert.equal(snapToMonthEnd('2026-09-15'), '2026-09-30');

  const now = new Date();
  const expected = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .split('T')[0];
  assert.equal(lastCompleteMonthEnd(), expected);
});

test('trailing12 contains exactly 12 complete calendar months', () => {
  const range = getPresetDates('trailing12');
  assert.ok(range);

  const start = new Date(`${range.start}T12:00:00Z`);
  const end = new Date(`${range.end}T12:00:00Z`);
  const inclusiveMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1;

  assert.equal(start.getUTCDate(), 1);
  assert.equal(inclusiveMonths, 12);
  assert.equal(
    end.getUTCDate(),
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate(),
  );
});