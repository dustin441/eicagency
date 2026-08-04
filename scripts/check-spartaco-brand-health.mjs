import assert from 'node:assert/strict';
import {
  availableMonthAverage,
  availableSourceTotal,
  benchmarkDelta,
  canonicalProductName,
  completedMonthRange,
  safeRate,
  sourceMonthCoverage,
  weightedRate,
} from '../src/services/spartaco-brand-health-math.ts';

assert.equal(safeRate(25, 100), 0.25);
assert.equal(safeRate(1, 0), null);

const months = [
  { opens: 90, sent: 100 },
  { opens: 10, sent: 900 },
];
assert.equal(weightedRate(months, row => row.opens, row => row.sent), 0.1);
assert.notEqual(weightedRate(months, row => row.opens / row.sent, () => 1), 0.1);

assert.equal(benchmarkDelta(80, 100, 'higher'), -0.2);
assert.equal(benchmarkDelta(80, 100, 'lower'), 0.2);
assert.equal(benchmarkDelta(null, 100, 'higher'), null);

const sourceRows = [
  { date: '2026-01-01', value: 4 },
  { date: '2026-01-01', value: 6 },
  { date: '2026-03-01', value: 20 },
];
assert.equal(availableMonthAverage(sourceRows, row => row.value), 15);
assert.equal(availableMonthAverage([], row => row.value), null);
assert.equal(availableSourceTotal([{ value: 0 }], row => row.value), 0);
assert.equal(availableSourceTotal([], row => row.value), null);
assert.deepEqual(sourceMonthCoverage(sourceRows, ['2026-01', '2026-02', '2026-03']), {
  monthsAvailable: 2,
  monthsExpected: 3,
  firstMonth: '2026-01',
  lastMonth: '2026-03',
  missingMonths: ['2026-02'],
});

assert.equal(canonicalProductName('Fiber Drivers', 'Air Boost', 'Fiber Driver'), 'Fiber Drivers');
assert.equal(canonicalProductName('Rodders', 'Fishtape / Little Buddy', 'Little Buddy'), 'Rodders');
assert.equal(canonicalProductName('Other', 'Tree Tools', 'Long Handled Tools'), 'Tree Tools');
assert.equal(canonicalProductName('Other', 'Other', 'Long Handled Tools'), 'Long Handled Tools');
assert.equal(canonicalProductName('Other', 'Other', 'Shopping'), null);

const range = completedMonthRange(new Date('2026-07-23T12:00:00Z'));
assert.deepEqual(range, {
  start: '2024-07-01',
  end: '2026-06-30',
  latestMonth: '2026-06',
  monthKeys: [
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  ],
});

console.log('Spartaco Brand Health math checks passed');