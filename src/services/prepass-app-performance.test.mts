import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPrepassAppPerformance,
  normalizePrepassAppRange,
  prepassAppCustomDateWindow,
  prepassAppDateWindow,
} from './prepass-app-performance.ts';

test('normalizes supported dashboard ranges and defaults to 30 days', () => {
  assert.equal(normalizePrepassAppRange('7'), 7);
  assert.equal(normalizePrepassAppRange('14'), 14);
  assert.equal(normalizePrepassAppRange(30), 30);
  assert.equal(normalizePrepassAppRange('90'), 30);
  assert.equal(normalizePrepassAppRange(undefined), 30);
});

test('uses complete days and creates an equal prior comparison window', () => {
  assert.deepEqual(prepassAppDateWindow(7, new Date('2026-09-18T21:00:00Z')), {
    rangeDays: 7,
    isCustomRange: false,
    maxDate: '2026-09-17',
    start: '2026-09-11',
    end: '2026-09-17',
    comparisonStart: '2026-09-04',
    comparisonEnd: '2026-09-10',
    queryStart: '2026-09-04',
  });
});

test('accepts validated custom dates and creates an equal prior period', () => {
  assert.deepEqual(prepassAppCustomDateWindow('2026-08-10', '2026-08-24', new Date('2026-09-18T21:00:00Z')), {
    rangeDays: 15,
    isCustomRange: true,
    maxDate: '2026-09-17',
    start: '2026-08-10',
    end: '2026-08-24',
    comparisonStart: '2026-07-26',
    comparisonEnd: '2026-08-09',
    queryStart: '2026-07-26',
  });
  assert.equal(prepassAppCustomDateWindow('2026-08-24', '2026-08-10'), null);
  assert.equal(prepassAppCustomDateWindow('2026-09-01', '2026-09-18', new Date('2026-09-18T21:00:00Z')), null);
  assert.equal(prepassAppCustomDateWindow('not-a-date', '2026-09-01'), null);
  assert.equal(prepassAppCustomDateWindow('2025-01-01', '2026-09-01', new Date('2026-09-18T21:00:00Z')), null);
});

test('combines named app screens with Android screen events and calculates the path', () => {
  const window = prepassAppDateWindow(7, new Date('2026-09-18T21:00:00Z'));
  const ios = {
    data: {
      values: {
        welcome_screen: { '2026-09-04': 80, '2026-09-11': 100, '2026-09-12': 120 },
        enrollment_services_and_pricing_screen: { '2026-09-04': 20, '2026-09-11': 25, '2026-09-12': 30 },
        enrollment_company_details_screen: { '2026-09-04': 4, '2026-09-11': 5, '2026-09-12': 7 },
        welcome_to_prepass_onboarding_screen: { '2026-09-04': 1, '2026-09-11': 2, '2026-09-12': 2 },
      },
    },
  };
  const android = {
    data: {
      values: {
        welcome_screen: { '2026-09-04': 20, '2026-09-11': 40, '2026-09-12': 40 },
        enrollment_services_and_pricing_screen: { '2026-09-04': 5, '2026-09-11': 10, '2026-09-12': 10 },
        enrollment_company_details_screen: { '2026-09-04': 1, '2026-09-11': 2, '2026-09-12': 1 },
        welcome_to_prepass_onboarding_screen: { '2026-09-04': 0, '2026-09-11': 1, '2026-09-12': 0 },
      },
    },
  };
  const request = { data: { values: { enrollment_request_success: { '2026-09-11': 2 } } } };
  const complete = { data: { values: { enrollment_flow_complete: { '2026-09-11': 3 } } } };

  const result = buildPrepassAppPerformance(window, ios, android, request, complete, '2026-09-18T21:00:00Z');
  const welcome = result.milestones.find((row) => row.key === 'welcome');
  const services = result.milestones.find((row) => row.key === 'services');
  const onboarding = result.milestones.find((row) => row.key === 'onboarding');

  assert.equal(result.daily.length, 7);
  assert.equal(result.daily[0].welcome, 140);
  assert.equal(result.daily[0].requestSuccess, 2);
  assert.equal(result.daily[0].flowComplete, 3);
  assert.equal(welcome?.value, 300);
  assert.equal(welcome?.previousValue, 100);
  assert.equal(welcome?.changePct, 200);
  assert.equal(services?.value, 75);
  assert.equal(services?.conversionFromPrevious, 0.25);
  assert.equal(onboarding?.value, 5);
  assert.equal(onboarding?.conversionFromWelcome, 5 / 300);
  assert.equal(result.completionSignals.find((row) => row.key === 'requestSuccess')?.value, 2);
  assert.equal(result.completionSignals.find((row) => row.key === 'flowComplete')?.value, 3);
  assert.equal(result.completionSignals.find((row) => row.key === 'flowComplete')?.conversionFromPrevious, null);
});
