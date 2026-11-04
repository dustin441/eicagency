import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuritPacing } from './aurit-pacing.ts';

const budgets = { monthStart: '2026-11-01', meta: 900, youtube: 300, total: 1200 };
const rows = [
  { date: '2026-11-01', channel: 'Meta' as const, cost: 25, campaignType: null },
  { date: '2026-11-03', channel: 'Meta' as const, cost: 50, campaignType: null },
  { date: '2026-11-03', channel: 'Google' as const, cost: 15, campaignType: 'VIDEO' },
  { date: '2026-11-03', channel: 'Google' as const, cost: 999, campaignType: 'SEARCH' },
  { date: '2026-11-04', channel: 'Meta' as const, cost: 999, campaignType: null },
];

test('overall is the sum of Meta and VIDEO only, through yesterday, with full-month planned lines', () => {
  const p = buildAuritPacing(budgets, rows, '2026-11-04');
  assert.equal(p.cutoff, '2026-11-03');
  assert.equal(p.meta.spend, 75);
  assert.equal(p.youtube.spend, 15);
  assert.equal(p.overall.spend, 90);
  assert.equal(p.overall.expected, 120);
  assert.equal(p.overall.remaining, 1110);
  assert.equal(p.overall.status, 'Behind pace');
  assert.equal(p.overall.points.length, 30);
  assert.equal(p.overall.points[2].actual, 90);
  assert.equal(p.overall.points[3].actual, null);
  assert.equal(p.overall.points[29].planned, 1200);
  assert.equal(p.meta.points[1].actual, 25);
});

test('stale channels use a common cutoff and warn instead of a healthy pacing status', () => {
  const p = buildAuritPacing(budgets, [...rows.filter(r => r.channel !== 'Google'),
    { date: '2026-11-01', channel: 'Google', cost: 10, campaignType: 'VIDEO' },
  ], '2026-11-04');
  assert.equal(p.cutoff, '2026-11-01');
  assert.equal(p.meta.spend, 25);
  assert.equal(p.overall.spend, 35);
  assert.equal(p.overall.expected, 40);
  assert.equal(p.overall.status, 'Data delayed');
});

test('missing source is unavailable, never zero or a partial overall total', () => {
  const p = buildAuritPacing(budgets, rows.filter(r => r.channel === 'Meta'), '2026-11-04');
  assert.equal(p.youtube.spend, null);
  assert.equal(p.overall.spend, null);
  assert.equal(p.youtube.status, 'Unavailable');
  assert.equal(p.meta.spend, 75);
});

test('missing budget preserves actual but suppresses planned pace, zero budget stays valid', () => {
  const p = buildAuritPacing({ ...budgets, meta: null, youtube: 0, total: null }, rows, '2026-11-04');
  assert.equal(p.meta.spend, 75);
  assert.equal(p.meta.expected, null);
  assert.equal(p.overall.budget, null);
  assert.equal(p.youtube.budget, 0);
  assert.equal(p.youtube.status, 'No active budget');
});

test('first day does not divide by zero or include prior month/current day spend', () => {
  const p = buildAuritPacing(budgets, rows, '2026-11-01');
  assert.equal(p.cutoff, null);
  assert.equal(p.overall.spend, null);
  assert.equal(p.overall.status, 'Awaiting completed day');
  assert(p.overall.points.every(x => x.actual === null));
});

test('leap month and ahead/on-pace comparisons use the actual month length', () => {
  const b = { monthStart: '2028-02-01', meta: 290, youtube: 290, total: 580 };
  const r = [{ date: '2028-02-02', channel: 'Meta' as const, cost: 40, campaignType: null }, { date: '2028-02-02', channel: 'Google' as const, cost: 20, campaignType: 'VIDEO' }];
  const p = buildAuritPacing(b, r, '2028-02-03');
  assert.equal(p.meta.points.length, 29);
  assert.equal(p.meta.status, 'Ahead of pace');
  assert.equal(p.youtube.status, 'On pace');
  assert.equal(p.overall.expected, 40);
});

test('invalid spend fails rather than silently making a healthy zero', () => {
  assert.throws(() => buildAuritPacing(budgets, [{ ...rows[0], cost: NaN }], '2026-11-04'), /Invalid Aurit pacing spend/);
});
