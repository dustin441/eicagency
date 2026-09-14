import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  aggregateIhhMetaCloserRows,
  IHH_META_CLOSER_ACTION_TYPE,
  IHH_META_CLOSER_ATTRIBUTION_LABEL,
  IHH_META_CLOSER_RELIABLE_START,
} from '../src/services/ihh-meta-closer-aggregation.ts';

assert.equal(IHH_META_CLOSER_ACTION_TYPE, 'offsite_conversion.custom.1794339368427062');
assert.equal(IHH_META_CLOSER_ATTRIBUTION_LABEL, '7-day click and 1-day view');
assert.equal(IHH_META_CLOSER_RELIABLE_START, '2026-09-11');

const rows = [
  { date: '2026-09-10', cost: 100, closer_appointments: null },
  { date: '2026-09-11', cost: 300, closer_appointments: 1 },
  { date: '2026-09-12', cost: 450, closer_appointments: 2 },
  { date: '2026-09-13', cost: 250, closer_appointments: 0 },
  { date: '2026-09-14', cost: 900, closer_appointments: 9 },
];

// Positive count and exact selected-period cost calculation.
const positive = aggregateIhhMetaCloserRows(rows, '2026-09-11', '2026-09-13');
assert.equal(positive.coverage, 'full');
assert.equal(positive.available, true);
assert.equal(positive.closerAppointments, 3);
assert.equal(positive.spend, 1000);
assert.equal(positive.costPerCloserAppointment, 1000 / 3);

// Zero conversions are observed zero, while cost is unavailable rather than divided by zero.
const zero = aggregateIhhMetaCloserRows(rows, '2026-09-13', '2026-09-13');
assert.equal(zero.closerAppointments, 0);
assert.equal(zero.costPerCloserAppointment, null);
assert.equal(zero.available, true);

// Missing conversion data remains unavailable and is not coerced to zero.
const missing = aggregateIhhMetaCloserRows([
  { date: '2026-09-12', cost: 123, closer_appointments: null },
], '2026-09-12', '2026-09-12');
assert.equal(missing.available, false);
assert.equal(missing.closerAppointments, null);
assert.equal(missing.costPerCloserAppointment, null);

// A pre-availability range stays unavailable.
const unavailable = aggregateIhhMetaCloserRows(rows, '2026-09-10', '2026-09-10');
assert.equal(unavailable.coverage, 'none');
assert.equal(unavailable.closerAppointments, null);

// Date-filter propagation excludes rows outside the selected range.
assert.deepEqual(
  positive.daily.map(point => [point.label, point.closerAppointments]),
  [
    ['2026-09-11', 1],
    ['2026-09-12', 2],
    ['2026-09-13', 0],
  ],
);

// A partial range uses the exact full-range spend while counting only dates on
// which the custom conversion existed, matching native Ads Manager semantics.
const partial = aggregateIhhMetaCloserRows(rows, '2026-09-10', '2026-09-12');
assert.equal(partial.coverage, 'partial');
assert.equal(partial.spend, 850);
assert.equal(partial.closerAppointments, 3);
assert.equal(partial.costPerCloserAppointment, 850 / 3);

// Isolation guard: only the IHH service and IHH dashboard may consume this module.
const root = path.resolve(import.meta.dirname, '..');
const consumers = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(absolute, 'utf8');
      if (content.includes('ihh-meta-closer-aggregation')) consumers.push(path.relative(root, absolute));
    }
  }
};
walk(path.join(root, 'src'));
assert.deepEqual(consumers.sort(), [
  'src/components/IhhDashboardClient.tsx',
  'src/services/ihh-analytics.ts',
]);
const migration = fs.readFileSync(path.join(root, 'supabase/ihh_meta_closer_appointments.sql'), 'utf8');
assert.match(migration, /ALTER TABLE public\.ihh_meta/);
assert.doesNotMatch(migration, /ALTER TABLE public\.(?!ihh_meta\b)/);

console.log('IHH Meta closer appointment checks passed');
