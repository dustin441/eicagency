import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPrepassMonthlyPublication,
  canonicalHash,
  reportMonthWindow,
  type PublicationBuildDependencies,
} from './prepass-monthly-publication.ts';
import type { MonthlyReadout, MonthlyReportStats, PrepassMonthlySourceBundle } from './analytics.ts';

const emptyStats = (focus: string): MonthlyReportStats => ({
  currentMonthLabel: 'August 2026', prevMonthLabel: 'July 2026',
  currentMonthStart: '2026-08-01', currentMonthEnd: '2026-08-31', focus,
  totalSpend: focus === 'all' ? 60 : focus === 'SMB' ? 10 : focus === 'ABM' ? 20 : 30,
  prevSpend: 0, totalImpressions: 0, prevImpressions: 0, totalClicks: 0, prevClicks: 0,
  platformConversions: 0, prevConversions: 0, totalMqls: 0, prevMqls: 0,
  totalSqls: 0, prevSqls: 0, totalWon: 0, prevWon: 0,
  avgDaysMqlToSql: 0, avgDaysSqlToWon: 0, focusRows: [], channelRows: [], productRows: [],
  monthlyTrend: [], campaigns: [], metaCreatives: [], googleCreatives: [], sourceRowCount: 12,
});

const readout: MonthlyReadout = {
  monthStart: '2026-08-01', monthEnd: '2026-08-31', overallStory: ['August'],
  kpiInsights: { smb: [], abm: [], fd360: [] }, accomplishments: [],
  focusNextMonth: [], executionContext: [],
};

const sourceBundle: PrepassMonthlySourceBundle = {
  capturedAt: '2026-09-03T12:00:00.000Z',
  monthStart: '2026-08-01', monthEnd: '2026-08-31',
  previousMonthStart: '2026-07-01', previousMonthEnd: '2026-07-31', trendStart: '2026-03-01',
  mmpRows: [], enrollmentRows: [], enrollmentWonRows: [], metaCreativeRows: [], googleCreativeRows: [],
  adConversionCounts: {}, sourceRowCount: 12,
};

function dependencies(order: string[] = []): PublicationBuildDependencies {
  let fetchedBundle: PrepassMonthlySourceBundle | undefined;
  return {
    now: () => new Date('2026-09-03T12:00:00.000Z'),
    fetchSourceBundle: async (monthStart, capturedAt) => {
      order.push(`bundle:${monthStart}:${capturedAt.toISOString()}`);
      fetchedBundle = sourceBundle;
      return sourceBundle;
    },
    deriveReport: (bundle, focus) => {
      assert.equal(bundle, fetchedBundle, 'every variant must use the one fetched bundle instance');
      order.push(`derive:${focus}`);
      return emptyStats(focus);
    },
    fetchReadout: async (monthStart) => {
      order.push(`readout:${monthStart}`);
      return readout;
    },
  };
}

test('validates an exact, completed UTC report month', () => {
  assert.deepEqual(reportMonthWindow('2026-08-01', new Date('2026-09-03T12:00:00Z')), {
    monthStart: '2026-08-01', monthEnd: '2026-08-31', previousMonthStart: '2026-07-01',
    previousMonthEnd: '2026-07-31', trendStart: '2026-03-01',
  });
  for (const value of ['2026-08-02', '2026-8-01', 'bad', '2026-02-30', '2026-09-01', '2026-10-01']) {
    assert.throws(() => reportMonthWindow(value, new Date('2026-09-03T12:00:00Z')), /monthStart/i, value);
  }
});

test('canonical hashes are stable across object key order and reject unsupported values', () => {
  assert.equal(canonicalHash({ b: 2, a: [{ z: 1, y: 'x' }] }), canonicalHash({ a: [{ y: 'x', z: 1 }], b: 2 }));
  assert.match(canonicalHash({ value: 1 }), /^[a-f0-9]{64}$/);
  assert.throws(() => canonicalHash({ value: Number.NaN }), /finite/i);
  assert.throws(() => canonicalHash({ value: undefined }), /unsupported/i);
});

test('builds all four focus payloads with an exact-month narrative and stable hashes', async () => {
  const calls: string[] = [];
  const first = await buildPrepassMonthlyPublication('2026-08-01', dependencies(calls));
  const second = await buildPrepassMonthlyPublication('2026-08-01', dependencies());
  assert.deepEqual(calls.sort(), [
    'bundle:2026-08-01:2026-09-03T12:00:00.000Z',
    'derive:ABM', 'derive:FD360', 'derive:SMB', 'derive:all', 'readout:2026-08-01',
  ].sort());
  assert.deepEqual(Object.keys(first.payload.variants), ['all', 'SMB', 'ABM', 'FD360']);
  assert.equal(first.payload.readout.monthStart, '2026-08-01');
  assert.equal(first.sourceHash, second.sourceHash);
  assert.equal(first.payloadHash, second.payloadHash);
  assert.notEqual(first.sourceHash, first.payloadHash);

  const later = dependencies();
  later.now = () => new Date('2026-09-20T18:30:00.000Z');
  later.fetchSourceBundle = async () => ({ ...sourceBundle, capturedAt: '2026-09-20T18:30:00.000Z' });
  later.deriveReport = (_bundle, focus) => emptyStats(focus);
  const retriedLater = await buildPrepassMonthlyPublication('2026-08-01', later);
  assert.equal(first.sourceCutoff, '2026-09-03T12:00:00.000Z');
  assert.equal(retriedLater.sourceCutoff, '2026-09-20T18:30:00.000Z');
  assert.equal(retriedLater.sourceHash, first.sourceHash);
  assert.equal(retriedLater.payloadHash, first.payloadHash);
});

test('source hash covers the shared raw bundle independently of derived payloads', async () => {
  const baseline = dependencies();
  const changed = dependencies();
  changed.fetchSourceBundle = async () => ({
    ...sourceBundle,
    sourceRowCount: 13,
    enrollmentRows: [{ date_mql: '2026-08-01', date_sql: '2026-08-02' }],
  });
  changed.deriveReport = (_bundle, focus) => emptyStats(focus);
  const first = await buildPrepassMonthlyPublication('2026-08-01', baseline);
  const second = await buildPrepassMonthlyPublication('2026-08-01', changed);
  assert.notEqual(second.sourceHash, first.sourceHash);
  assert.equal(second.payloadHash, first.payloadHash);
  assert.equal(second.sourceRowCount, 13);
});

test('fails when report variants or narrative do not match the requested month', async () => {
  const badStats = dependencies();
  badStats.deriveReport = (_bundle, focus) => ({ ...emptyStats(focus), currentMonthStart: '2026-07-01' });
  await assert.rejects(buildPrepassMonthlyPublication('2026-08-01', badStats), /report month/i);

  const badReadout = dependencies();
  badReadout.fetchReadout = async () => ({ ...readout, monthStart: '2026-07-01' });
  await assert.rejects(buildPrepassMonthlyPublication('2026-08-01', badReadout), /narrative month/i);
});
