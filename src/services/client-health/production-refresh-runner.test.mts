import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCTION_REFRESH_LIMITS } from './production-refresh-runner.ts';

test('production refresh lease covers the full deadline and reconciliation sequence', () => {
  assert.ok(PRODUCTION_REFRESH_LIMITS.deadlineMs > 0);
  assert.ok(PRODUCTION_REFRESH_LIMITS.leaseDurationMs <= 600_000);
  assert.ok(
    PRODUCTION_REFRESH_LIMITS.leaseDurationMs >= 4 * PRODUCTION_REFRESH_LIMITS.deadlineMs + 1_000,
    'lease must cover four operation/reconciliation deadlines plus the safety margin',
  );
});
