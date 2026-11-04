import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { AuritMonthlyBudget } from './AuritMonthlyBudget.tsx';

const monthStart = '2026-11-01';

test('renders the explicit month, saved amounts, and independent Google Video-only plan scope', () => {
  const html = renderToStaticMarkup(createElement(AuritMonthlyBudget, {
    budget: { monthStart, meta: 6000, youtube: 2500, total: 8500 },
  }));
  for (const text of ['November 2026', '$6,000', '$2,500', '$8,500', 'Meta', 'YouTube (Google Video only)', 'Total',
    'independent of the selected performance dates and channel filter', 'not all Google Ads']) {
    assert.ok(html.includes(text), text);
  }
  assert.equal(html.includes('Unavailable'), false);
  assert.equal(html.includes('—'), false);
});

test('renders zero as currency and missing channel and total as unavailable', () => {
  const html = renderToStaticMarkup(createElement(AuritMonthlyBudget, {
    budget: { monthStart, meta: 0, youtube: null, total: null },
  }));
  assert.ok(html.includes('$0'));
  assert.equal(html.match(/Unavailable/g)?.length, 2);
});

test('Kinsey scaling guidance stays visible inside the budget card, including when not configured', () => {
  const source = readFileSync(new URL('./KinseyDesignDashboardClient.tsx', import.meta.url), 'utf8');
  const card = source.slice(source.indexOf('function BudgetPacing('), source.indexOf('const METRIC_LABELS'));
  assert.ok(card.includes('Base budget: $2,000/month. May scale to $2,500–$3,000/month only if ROAS exceeds 3x. No automatic increase.'));
  assert.match(card, /\)\}\s*<p className="mt-4 text-sm text-gray-600">\s*Base budget:/);
});
