import assert from 'node:assert/strict';
import test from 'node:test';

import { getPresetDates } from './date-utils.ts';

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