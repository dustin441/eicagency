import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TENANTS } from './tenant.ts';

const sources = [
  '../app/dashboard/layout.tsx',
  '../app/dashboard/arabella/creatives/page.tsx',
  '../components/ArabellaHotelsDashboardClient.tsx',
  '../services/analytics.ts',
];

for (const path of sources) {
  test(`Arabella uses the approved singular display name in ${path}`, () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(source.includes('Arabella Hotel'), 'Expected the approved display name');
    assert.ok(!source.includes('Arabella Hotels'), 'The old plural display name must not be rendered');
  });
}

test('Scott client display name changes without changing client identity', () => {
  const scott = TENANTS['scott-social'];
  assert.equal(scott.clientLabels?.arabella, 'Arabella Hotel');
  assert.ok(scott.allowedClients?.includes('arabella'));
});
