import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuritBudgetPacing } from './AuritBudgetPacing.tsx';
import { buildAuritPacing } from '../lib/aurit-pacing.ts';

const budgets = { monthStart: '2026-11-01', meta: 900, youtube: 300, total: 1200 };
const rows = [
  { date: '2026-11-03', channel: 'Meta' as const, cost: 90, campaignType: null },
  { date: '2026-11-03', channel: 'Google' as const, cost: 30, campaignType: 'VIDEO' },
];
function render(pacing = buildAuritPacing(budgets, rows, '2026-11-04')) {
  return renderToStaticMarkup(createElement(AuritBudgetPacing, { pacing }));
}

test('mirrors Duro-style bars, compact amounts, date, status, ideal labels and channel boxes, not line charts', () => {
  const html = render();
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 3);
  for (const label of ['Overall Budget Pacing', 'Meta Budget Pacing', 'YouTube Budget Pacing', 'On Track', '10.0% spent', '10.0% ideal pace', 'bg-blue-50/60', 'bg-orange-50/60', '$1,200']) assert(html.includes(label), label);
  assert(!html.includes('<svg'));
  assert(!html.includes('Planned through cutoff'));
  assert(html.indexOf('data-pacing="overall"') < html.indexOf('data-pacing="meta"'));
  assert(html.indexOf('data-pacing="meta"') < html.indexOf('data-pacing="youtube"'));
  assert(html.includes('grid gap-4 lg:grid-cols-2'));
});

test('missing source remains unavailable, first-day label never reverses the dates', () => {
  const missing = render(buildAuritPacing(budgets, [], '2026-11-04'));
  assert(missing.includes('Unavailable'));
  assert(!missing.includes('aria-valuenow="0"'));
  const first = render(buildAuritPacing(budgets, [], '2026-11-01'));
  assert(first.includes('Awaiting completed-day data'));
  assert(!first.includes('2026-11-01 – 2026-10-31'));
});

test('caps visual fill but preserves actual percentage and exact currency tooltips', () => {
  const html = render(buildAuritPacing(budgets, [{ ...rows[0], cost: 1800 }, rows[1]], '2026-11-04'));
  assert(html.includes('200.0% spent'));
  assert(html.includes('width:100%'));
  assert(html.includes('title="$1,800.00"'));
  assert(!html.includes('aria-valuenow="200"'));
});
