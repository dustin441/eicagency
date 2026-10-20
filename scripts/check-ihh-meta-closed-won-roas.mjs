import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  aggregateIhhMetaClosedWonRows,
  IHH_META_CLOSED_WON_ACTION_TYPE,
  IHH_META_CLOSED_WON_ATTRIBUTION_LABEL,
  IHH_META_CLOSED_WON_RELIABLE_START,
} from '../src/services/ihh-meta-closed-won-aggregation.ts';

assert.equal(IHH_META_CLOSED_WON_ACTION_TYPE, 'offsite_conversion.custom.1060284470313134');
assert.equal(IHH_META_CLOSED_WON_ATTRIBUTION_LABEL, '7-day click and 1-day view');
assert.equal(IHH_META_CLOSED_WON_RELIABLE_START, '2026-10-05');

const rows = [
  { date: '2026-10-04', cost: 100, purchases: null, revenue: null },
  { date: '2026-10-05', cost: 300, purchases: 1, revenue: 9800 },
  { date: '2026-10-06', cost: 450, purchases: 0, revenue: 0 },
  { date: '2026-10-07', cost: 250, purchases: 0, revenue: 0 },
];

const positive = aggregateIhhMetaClosedWonRows(rows, '2026-10-05', '2026-10-07');
assert.equal(positive.coverage, 'full');
assert.equal(positive.available, true);
assert.equal(positive.closedWon, 1);
assert.equal(positive.revenue, 9800);
assert.equal(positive.spend, 1000);
assert.equal(positive.costPerClosedWon, 1000);
assert.equal(positive.roas, 9.8);

const zero = aggregateIhhMetaClosedWonRows(rows, '2026-10-06', '2026-10-07');
assert.equal(zero.closedWon, 0);
assert.equal(zero.revenue, 0);
assert.equal(zero.costPerClosedWon, null);
assert.equal(zero.roas, 0);
assert.equal(zero.available, true);

// A value-bearing conversion with no selected-period spend has real value but
// undefined ROAS. The UI must not describe this as "No revenue."
const noSpend = aggregateIhhMetaClosedWonRows([
  { date: '2026-10-05', cost: 0, purchases: 1, revenue: 9800 },
], '2026-10-05', '2026-10-05');
assert.equal(noSpend.closedWon, 1);
assert.equal(noSpend.revenue, 9800);
assert.equal(noSpend.roas, null);

const missing = aggregateIhhMetaClosedWonRows([
  { date: '2026-10-05', cost: 123, purchases: null, revenue: null },
], '2026-10-05', '2026-10-05');
assert.equal(missing.available, false);
assert.equal(missing.closedWon, null);
assert.equal(missing.revenue, null);
assert.equal(missing.roas, null);

const unavailable = aggregateIhhMetaClosedWonRows(rows, '2026-10-04', '2026-10-04');
assert.equal(unavailable.coverage, 'none');
assert.equal(unavailable.closedWon, null);
assert.equal(unavailable.revenue, null);

const partial = aggregateIhhMetaClosedWonRows(rows, '2026-10-04', '2026-10-06');
assert.equal(partial.coverage, 'partial');
assert.equal(partial.spend, 850);
assert.equal(partial.closedWon, 1);
assert.equal(partial.revenue, 9800);
assert.equal(partial.costPerClosedWon, 850);
assert.equal(partial.roas, 9800 / 850);

const root = path.resolve(import.meta.dirname, '..');
const consumers = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(absolute, 'utf8');
      if (content.includes('ihh-meta-closed-won-aggregation')) consumers.push(path.relative(root, absolute));
    }
  }
};
walk(path.join(root, 'src'));
assert.deepEqual(consumers.sort(), [
  'src/components/IhhDashboardClient.tsx',
  'src/services/ihh-analytics.ts',
]);

console.log('IHH Meta Closed Won ROAS checks passed');
