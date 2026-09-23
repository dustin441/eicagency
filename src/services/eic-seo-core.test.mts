import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateRows,
  buildPagePerformance,
  buildQueryOpportunities,
  buildQueryPerformance,
  defaultSeoPeriods,
  isBrandQuery,
  periodsFromRange,
  periodsEndingOn,
} from './eic-seo-core.ts';

test('defaults to the latest complete 30 days with a three-day Search Console lag', () => {
  assert.deepEqual(defaultSeoPeriods(new Date('2026-09-22T18:00:00Z')), {
    periodStart: '2026-08-21',
    periodEnd: '2026-09-19',
    comparisonStart: '2026-07-22',
    comparisonEnd: '2026-08-20',
  });
});

test('accepts historical end dates but rejects future or malformed dates', () => {
  const now = new Date('2026-09-22T18:00:00Z');
  assert.equal(periodsEndingOn('2026-08-31', now).periodStart, '2026-08-02');
  assert.equal(periodsEndingOn('2026-09-20', now).periodEnd, '2026-09-19');
  assert.equal(periodsEndingOn('not-a-date', now).periodEnd, '2026-09-19');
});

test('builds an equal-length preceding comparison for adjustable start and end dates', () => {
  const now = new Date('2026-09-22T18:00:00Z');
  assert.deepEqual(periodsFromRange('2026-09-01', '2026-09-19', now), {
    periodStart: '2026-09-01',
    periodEnd: '2026-09-19',
    comparisonStart: '2026-08-13',
    comparisonEnd: '2026-08-31',
  });
});

test('rejects incomplete, reversed, malformed, and overly long custom ranges', () => {
  const now = new Date('2026-09-22T18:00:00Z');
  const fallback = defaultSeoPeriods(now);
  assert.deepEqual(periodsFromRange('', '2026-09-19', now), fallback);
  assert.deepEqual(periodsFromRange('2026-09-20', '2026-09-19', now), fallback);
  assert.deepEqual(periodsFromRange('2026-09-01', '2026-09-20', now), fallback);
  assert.deepEqual(periodsFromRange('2024-01-01', '2026-09-19', now), fallback);
});

test('classifies EIC names as branded without treating generic agency searches as brand', () => {
  assert.equal(isBrandQuery('eic agency'), true);
  assert.equal(isBrandQuery('eicagency'), true);
  assert.equal(isBrandQuery('eic.agency reporting'), true);
  assert.equal(isBrandQuery('Every Impression Counts marketing'), true);
  assert.equal(isBrandQuery('white label ppc agency'), false);
});

test('aggregates visible nonbrand rows using weighted position and recomputed CTR', () => {
  const summary = aggregateRows([
    { clicks: 2, impressions: 10, ctr: 0.2, position: 5 },
    { clicks: 1, impressions: 30, ctr: 1 / 30, position: 15 },
  ]);
  assert.equal(summary.clicks, 3);
  assert.equal(summary.impressions, 40);
  assert.equal(summary.ctr, 0.075);
  assert.equal(summary.position, 12.5);
});

test('builds deterministic focus keywords and selects the highest-impression landing page', () => {
  const opportunities = buildQueryOpportunities(
    [
      { keys: ['eic agency'], impressions: 30, clicks: 10, ctr: 1 / 3, position: 3 },
      { keys: ['white label ppc'], impressions: 12, clicks: 0, ctr: 0, position: 8 },
      { keys: ['agency paid media partner'], impressions: 8, clicks: 0, ctr: 0, position: 24 },
      { keys: ['irrelevant local query'], impressions: 20, clicks: 0, ctr: 0, position: 2 },
      { keys: ['one impression query'], impressions: 1, clicks: 0, ctr: 0, position: 7 },
    ],
    [
      { keys: ['white label ppc'], impressions: 8, clicks: 1, ctr: 0.125, position: 5 },
      { keys: ['agency paid media partner'], impressions: 4, clicks: 0, ctr: 0, position: 35 },
    ],
    [
      { keys: ['white label ppc', 'https://eic.agency/'], impressions: 2 },
      { keys: ['white label ppc', 'https://eic.agency/white-label-ppc-management'], impressions: 10 },
      { keys: ['agency paid media partner', 'https://eic.agency/resources/agency-partner'], impressions: 8 },
      { keys: ['irrelevant local query', 'https://eic.agency/?utm_source=google&utm_medium=local'], impressions: 20 },
    ]
  );

  assert.deepEqual(opportunities.map(row => row.query), ['white label ppc', 'agency paid media partner']);
  assert.equal(opportunities[0].category, 'Protect');
  assert.equal(opportunities[0].positionChange, -3);
  assert.equal(opportunities[0].page, 'https://eic.agency/white-label-ppc-management');
  assert.equal(opportunities[1].category, 'Build authority');
  assert.equal(opportunities[1].positionChange, 11);
});

test('builds separate brand and nonbrand query tables with prior metrics and clean landing pages', () => {
  const queries = buildQueryPerformance(
    [
      { keys: ['eic agency'], impressions: 30, clicks: 10, ctr: 1 / 3, position: 2 },
      { keys: ['white label ppc'], impressions: 50, clicks: 2, ctr: 0.04, position: 8 },
      { keys: ['local-only query'], impressions: 40, clicks: 1, ctr: 0.025, position: 3 },
    ],
    [
      { keys: ['eic agency'], impressions: 20, clicks: 8, ctr: 0.4, position: 2.5 },
      { keys: ['white label ppc'], impressions: 25, clicks: 1, ctr: 0.04, position: 12 },
    ],
    [
      { keys: ['eic agency', 'https://eic.agency/'], impressions: 30 },
      { keys: ['white label ppc', 'https://eic.agency/white-label-ppc-management'], impressions: 50 },
      { keys: ['local-only query', 'https://eic.agency/?utm_medium=local'], impressions: 40 },
    ]
  );

  assert.deepEqual(queries.brand.map(row => row.query), ['eic agency']);
  assert.deepEqual(queries.nonBrand.map(row => row.query), ['white label ppc']);
  assert.equal(queries.nonBrand[0].page, 'https://eic.agency/white-label-ppc-management');
  assert.equal(queries.nonBrand[0].previousImpressions, 25);
  assert.equal(queries.nonBrand[0].previousPosition, 12);
  assert.equal(queries.nonBrand[0].positionChange, 4);
});

test('canonicalizes tracking variants before comparing top pages', () => {
  const pages = buildPagePerformance(
    [
      { keys: ['https://eic.agency/'], clicks: 2, impressions: 10, ctr: 0.2, position: 5 },
      { keys: ['https://eic.agency/?utm_source=google&utm_medium=local'], clicks: 1, impressions: 30, ctr: 1 / 30, position: 15 },
    ],
    [{ keys: ['https://eic.agency/?utm_source=google&utm_medium=local'], clicks: 1, impressions: 20, ctr: 0.05, position: 10 }]
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].page, 'https://eic.agency/');
  assert.equal(pages[0].clicks, 3);
  assert.equal(pages[0].impressions, 40);
  assert.equal(pages[0].position, 12.5);
  assert.equal(pages[0].previousImpressions, 20);
});

test('compares top pages and keeps current click and impression ordering', () => {
  const pages = buildPagePerformance(
    [
      { keys: ['https://eic.agency/a'], clicks: 1, impressions: 20, ctr: 0.05, position: 8 },
      { keys: ['https://eic.agency/b'], clicks: 2, impressions: 10, ctr: 0.2, position: 4 },
    ],
    [{ keys: ['https://eic.agency/b'], clicks: 1, impressions: 5, ctr: 0.2, position: 6 }]
  );
  assert.deepEqual(pages.map(row => row.page), ['https://eic.agency/b', 'https://eic.agency/a']);
  assert.equal(pages[0].previousClicks, 1);
  assert.equal(pages[1].previousClicks, 0);
});
