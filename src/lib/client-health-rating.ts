export type HealthStatus = 'healthy' | 'moderate' | 'unhealthy' | 'unknown';

export type MetricAssessment = {
  status: HealthStatus;
  reason: string;
  fix: string;
};

export type HealthMetricKey = 'budget' | 'northStar' | 'hours' | 'overdue' | 'margin';
export type HealthAssessments = Record<HealthMetricKey, MetricAssessment>;

const WEIGHTS: Record<HealthMetricKey, number> = {
  budget: 25,
  northStar: 25,
  hours: 20,
  overdue: 15,
  margin: 15,
};

const STATUS_VALUE: Record<HealthStatus, number> = {
  healthy: 1,
  moderate: 0.5,
  unknown: 0.5,
  unhealthy: 0,
};

function missing(metric: string, fix: string): MetricAssessment {
  return {
    status: 'unknown',
    reason: `${metric} data is missing.`,
    fix,
  };
}

export function classifyBudgetPacing(
  spendPercent: number | null,
  elapsedPercent: number,
): MetricAssessment {
  if (spendPercent === null || !Number.isFinite(spendPercent)) {
    return missing('Budget pacing', 'Confirm the monthly budget and current-month spend sync.');
  }
  const variance = spendPercent - elapsedPercent;
  const absoluteVariance = Math.abs(variance);
  if (absoluteVariance <= 10) {
    return {
      status: 'healthy',
      reason: `Spend is ${Math.abs(variance).toFixed(0)} points ${variance >= 0 ? 'ahead of' : 'behind'} calendar pace.`,
      fix: '',
    };
  }
  if (absoluteVariance <= 20) {
    return {
      status: 'moderate',
      reason: `Spend is ${absoluteVariance.toFixed(0)} points ${variance >= 0 ? 'ahead of' : 'behind'} calendar pace.`,
      fix: variance >= 0 ? 'Trim daily budgets or shift spend to the strongest campaigns.' : 'Increase delivery or confirm campaigns are active and tracking.',
    };
  }
  return {
    status: 'unhealthy',
    reason: `Spend is ${absoluteVariance.toFixed(0)} points ${variance >= 0 ? 'ahead of' : 'behind'} calendar pace.`,
    fix: variance >= 0 ? 'Reduce spend immediately and reset the remaining daily budget.' : 'Resolve delivery blockers and create a catch-up pacing plan.',
  };
}

export function classifyNorthStarTrend(
  currentCost: number | null,
  previousCost: number | null,
): MetricAssessment {
  if (currentCost === null || previousCost === null || previousCost <= 0) {
    return missing('North-star cost trend', 'Confirm the client north-star metric and its conversion data.');
  }
  const changePercent = ((currentCost - previousCost) / previousCost) * 100;
  if (changePercent <= 5) {
    return {
      status: 'healthy',
      reason: changePercent <= 0
        ? `North-star cost improved ${Math.abs(changePercent).toFixed(0)}%.`
        : `North-star cost increased only ${changePercent.toFixed(0)}%.`,
      fix: '',
    };
  }
  if (changePercent <= 15) {
    return {
      status: 'moderate',
      reason: `North-star cost increased ${changePercent.toFixed(0)}%.`,
      fix: 'Review campaign, audience, and creative contributors to the cost increase.',
    };
  }
  return {
    status: 'unhealthy',
    reason: `North-star cost increased ${changePercent.toFixed(0)}%.`,
    fix: 'Pause inefficient spend and launch a recovery plan around the best-converting segments.',
  };
}

export function classifyHoursPacing(
  hoursUsed: number | null,
  hoursAllotted: number | null,
  elapsedPercent: number,
): MetricAssessment {
  if (hoursUsed === null || hoursAllotted === null || hoursAllotted <= 0 || elapsedPercent <= 0) {
    return missing('Hours pacing', 'Set the monthly hour allotment and confirm ClickUp time tracking.');
  }
  const projectedHours = hoursUsed / (elapsedPercent / 100);
  const projectedUsePercent = (projectedHours / hoursAllotted) * 100;
  if (projectedUsePercent <= 90) {
    return {
      status: 'healthy',
      reason: `Hours project to ${projectedUsePercent.toFixed(0)}% of the monthly allotment.`,
      fix: '',
    };
  }
  if (projectedUsePercent <= 110) {
    return {
      status: 'moderate',
      reason: `Hours project to ${projectedUsePercent.toFixed(0)}% of the monthly allotment.`,
      fix: 'Review remaining scope and reserve hours for the highest-priority work.',
    };
  }
  return {
    status: 'unhealthy',
    reason: `Hours project to ${projectedUsePercent.toFixed(0)}% of the monthly allotment.`,
    fix: 'Reduce or re-scope work, correct time allocation, or approve additional hours.',
  };
}

export function classifyOverdueTasks(overdueCount: number | null): MetricAssessment {
  if (overdueCount === null) {
    return missing('ClickUp overdue-task', 'Confirm the ClickUp connection and client-list mapping.');
  }
  if (overdueCount === 0) {
    return { status: 'healthy', reason: 'No overdue ClickUp tasks.', fix: '' };
  }
  if (overdueCount <= 2) {
    return {
      status: 'moderate',
      reason: `${overdueCount} ClickUp task${overdueCount === 1 ? ' is' : 's are'} overdue.`,
      fix: 'Assign an owner and updated due date to each overdue task.',
    };
  }
  return {
    status: 'unhealthy',
    reason: `${overdueCount} ClickUp tasks are overdue.`,
    fix: 'Triage the overdue queue today; close stale items and escalate blocked work.',
  };
}

export function classifyMargin(marginPercent: number | null): MetricAssessment {
  if (marginPercent === null || !Number.isFinite(marginPercent)) {
    return missing('Margin', 'Update the current-month margin sheet with hours and fulfillment cost.');
  }
  if (marginPercent >= 60) {
    return { status: 'healthy', reason: `Margin is ${marginPercent.toFixed(0)}%.`, fix: '' };
  }
  if (marginPercent >= 40) {
    return {
      status: 'moderate',
      reason: `Margin is ${marginPercent.toFixed(0)}%.`,
      fix: 'Review fulfillment hours, contractor cost, and low-margin scope.',
    };
  }
  return {
    status: 'unhealthy',
    reason: `Margin is ${marginPercent.toFixed(0)}%.`,
    fix: 'Re-scope or reprice the account and reduce fulfillment cost immediately.',
  };
}

export function scoreClientHealth(assessments: HealthAssessments): {
  status: Exclude<HealthStatus, 'unknown'>;
  score: number;
  reasons: string[];
  fixes: string[];
} {
  const entries = Object.entries(assessments) as [HealthMetricKey, MetricAssessment][];
  const score = Math.round(entries.reduce(
    (total, [key, assessment]) => total + WEIGHTS[key] * STATUS_VALUE[assessment.status],
    0,
  ));
  const redCount = entries.filter(([, assessment]) => assessment.status === 'unhealthy').length;
  const unknownCount = entries.filter(([, assessment]) => assessment.status === 'unknown').length;

  let status: 'healthy' | 'moderate' | 'unhealthy';
  if (redCount >= 2 || score < 50) status = 'unhealthy';
  else if (redCount > 0 || score < 80 || unknownCount > 1) status = 'moderate';
  else status = 'healthy';

  return {
    status,
    score,
    reasons: entries.map(([, assessment]) => assessment.reason).filter(Boolean),
    fixes: [...new Set(entries.map(([, assessment]) => assessment.fix).filter(Boolean))],
  };
}
