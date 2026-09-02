import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyBudgetPacing,
  classifyHoursPacing,
  classifyMargin,
  classifyNorthStarTrend,
  classifyOverdueTasks,
  scoreClientHealth,
} from './client-health-rating.ts';

test('budget pacing is healthy within ten percentage points of calendar pace', () => {
  assert.equal(classifyBudgetPacing(62, 55).status, 'healthy');
  assert.equal(classifyBudgetPacing(45, 55).status, 'healthy');
});

test('budget pacing becomes moderate then unhealthy as variance grows', () => {
  assert.equal(classifyBudgetPacing(36, 55).status, 'moderate');
  assert.equal(classifyBudgetPacing(79, 55).status, 'unhealthy');
});

test('missing budget data is explicitly unknown rather than green', () => {
  const result = classifyBudgetPacing(null, 55);
  assert.equal(result.status, 'unknown');
  assert.match(result.reason, /missing/i);
});

test('lower north-star cost is better and deterioration thresholds are five and fifteen percent', () => {
  assert.equal(classifyNorthStarTrend(90, 100).status, 'healthy');
  assert.equal(classifyNorthStarTrend(108, 100).status, 'moderate');
  assert.equal(classifyNorthStarTrend(116, 100).status, 'unhealthy');
});

test('hours are judged by projected month-end use against allotment', () => {
  assert.equal(classifyHoursPacing(9, 20, 50).status, 'healthy');
  assert.equal(classifyHoursPacing(10, 20, 50).status, 'moderate');
  assert.equal(classifyHoursPacing(12, 20, 50).status, 'unhealthy');
});

test('overdue tasks are green at zero, yellow at one or two, and red at three', () => {
  assert.equal(classifyOverdueTasks(0).status, 'healthy');
  assert.equal(classifyOverdueTasks(2).status, 'moderate');
  assert.equal(classifyOverdueTasks(3).status, 'unhealthy');
});

test('margin is healthy at sixty percent, moderate at forty, and unhealthy below forty', () => {
  assert.equal(classifyMargin(60).status, 'healthy');
  assert.equal(classifyMargin(40).status, 'moderate');
  assert.equal(classifyMargin(39.9).status, 'unhealthy');
});

test('weighted score is healthy only with no red metrics and at most one unknown', () => {
  const result = scoreClientHealth({
    budget: { status: 'healthy', reason: '', fix: '' },
    northStar: { status: 'healthy', reason: '', fix: '' },
    hours: { status: 'healthy', reason: '', fix: '' },
    overdue: { status: 'healthy', reason: '', fix: '' },
    margin: { status: 'unknown', reason: 'Margin missing', fix: 'Update margin sheet' },
  });
  assert.equal(result.status, 'healthy');
  assert.equal(result.score, 93);
});

test('one red metric caps the overall result at moderate', () => {
  const result = scoreClientHealth({
    budget: { status: 'unhealthy', reason: 'Overspending', fix: 'Reduce spend' },
    northStar: { status: 'healthy', reason: '', fix: '' },
    hours: { status: 'healthy', reason: '', fix: '' },
    overdue: { status: 'healthy', reason: '', fix: '' },
    margin: { status: 'healthy', reason: '', fix: '' },
  });
  assert.equal(result.status, 'moderate');
  assert.deepEqual(result.reasons, ['Overspending']);
  assert.deepEqual(result.fixes, ['Reduce spend']);
});

test('two red metrics force an unhealthy overall result', () => {
  const result = scoreClientHealth({
    budget: { status: 'unhealthy', reason: 'Budget risk', fix: 'Reset budgets' },
    northStar: { status: 'unhealthy', reason: 'Cost is rising', fix: 'Review campaigns' },
    hours: { status: 'healthy', reason: '', fix: '' },
    overdue: { status: 'moderate', reason: 'One task overdue', fix: 'Clear task' },
    margin: { status: 'healthy', reason: '', fix: '' },
  });
  assert.equal(result.status, 'unhealthy');
  assert.ok(result.score < 50);
});
