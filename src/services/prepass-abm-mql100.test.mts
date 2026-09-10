import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachMql100PlusTrend,
  buildMql100PlusWindows,
  sumMql100Plus,
} from './prepass-abm-mql100.ts';

test('builds one exact daily query window per chart day for short date ranges', () => {
  assert.deepEqual(buildMql100PlusWindows('2026-09-01', '2026-09-03'), [
    { start: '2026-09-01', end: '2026-09-01' },
    { start: '2026-09-02', end: '2026-09-02' },
    { start: '2026-09-03', end: '2026-09-03' },
  ]);
});

test('uses the chart weekly granularity for date ranges from 30 through 90 days', () => {
  assert.deepEqual(buildMql100PlusWindows('2026-08-01', '2026-08-30'), [
    { start: '2026-08-01', end: '2026-08-02' },
    { start: '2026-08-03', end: '2026-08-09' },
    { start: '2026-08-10', end: '2026-08-16' },
    { start: '2026-08-17', end: '2026-08-23' },
    { start: '2026-08-24', end: '2026-08-30' },
  ]);
});

test('counts only MQLs from the two canonical fleet bands strictly above 100 trucks', () => {
  assert.equal(sumMql100Plus([
    { fleet_size: '51-100', mqls: 9 },
    { fleet_size: '101-500', mqls: '4' },
    { fleet_size: '500+', mqls: 3 },
    { fleet_size: '250-499', mqls: 8 },
    { fleet_size: '101 vehicles', mqls: 6 },
    { fleet_size: '(not answered)', mqls: 12 },
  ]), 7);
});

test('refuses to create an unbounded number of Supabase query windows', () => {
  assert.deepEqual(buildMql100PlusWindows('1926-01-01', '2026-01-01'), []);
});

test('attaches each qualified cohort count to the matching visual chart bucket', () => {
  const dailyData = [
    { date: '2026-09-01', mql: 5 },
    { date: '2026-09-02', mql: 6 },
    { date: '2026-09-03', mql: 7 },
  ];

  assert.deepEqual(attachMql100PlusTrend(dailyData, [
    { window: { start: '2026-09-01', end: '2026-09-01' }, mql100Plus: 2 },
    { window: { start: '2026-09-02', end: '2026-09-02' }, mql100Plus: 0 },
    { window: { start: '2026-09-03', end: '2026-09-03' }, mql100Plus: 1 },
  ]), [
    { date: '2026-09-01', mql: 5, mql100Plus: 2 },
    { date: '2026-09-02', mql: 6, mql100Plus: 0 },
    { date: '2026-09-03', mql: 7, mql100Plus: 1 },
  ]);
});
