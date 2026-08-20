import { fetchClientHealthAnalyticsInputs } from '@/services/analytics';
import { fetchClickUpClientHealth, fetchCurrentMarginSheet } from '@/services/client-health-sources';
import {
  classifyBudgetPacing,
  classifyHoursPacing,
  classifyMargin,
  classifyNorthStarTrend,
  classifyOverdueTasks,
  scoreClientHealth,
  type HealthAssessments,
  type HealthStatus,
} from '@/lib/client-health-rating';

export type ClientHealthRow = {
  id: string;
  name: string;
  href: string;
  status: 'healthy' | 'moderate' | 'unhealthy';
  score: number;
  values: {
    budget: number | null;
    monthSpend: number | null;
    spendPercent: number | null;
    expectedPacePercent: number;
    northStarLabel: string;
    currentCostPerResult: number | null;
    previousCostPerResult: number | null;
    hoursUsed: number | null;
    hoursAllotted: number | null;
    overdueCount: number | null;
    marginPercent: number | null;
  };
  metrics: HealthAssessments;
  reasons: string[];
  fixes: string[];
  overdueTasks: { name: string; url: string; dueAt: string | null }[];
};

export type ClientHealthDashboardData = {
  generatedAt: string;
  periodLabel: string;
  rows: ClientHealthRow[];
  counts: Record<'healthy' | 'moderate' | 'unhealthy', number>;
  sourceStatus: {
    supabase: HealthStatus;
    clickup: HealthStatus;
    marginSheet: HealthStatus;
  };
};

export async function fetchClientHealthDashboard(now = new Date()): Promise<ClientHealthDashboardData> {
  const [analyticsResult, clickupResult, marginResult] = await Promise.allSettled([
    fetchClientHealthAnalyticsInputs(now),
    fetchClickUpClientHealth(process.env.CLICKUP_API, process.env.CLICKUP_TEAM_ID ?? '1229523', now),
    fetchCurrentMarginSheet(now),
  ]);
  if (analyticsResult.status === 'rejected') throw analyticsResult.reason;

  const clickup = clickupResult.status === 'fulfilled' ? clickupResult.value : new Map();
  const margins = marginResult.status === 'fulfilled' ? marginResult.value : new Map();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dataThroughDay = Math.max(0, now.getUTCDate() - 1);
  const budgetElapsedPercent = (dataThroughDay / daysInMonth) * 100;
  const hoursElapsedPercent = (now.getUTCDate() / daysInMonth) * 100;

  const rows = analyticsResult.value.clients.map((analytics): ClientHealthRow => {
    const clickupValue = clickup.get(analytics.id);
    const marginValue = margins.get(analytics.id);
    const spendPercent = analytics.budget && analytics.budget > 0 && analytics.monthSpend !== null
      ? (analytics.monthSpend / analytics.budget) * 100
      : null;
    const hoursUsed = clickupValue?.hoursUsed ?? marginValue?.sheetHours ?? null;
    const overdueCount = clickupValue?.overdueCount ?? analytics.syncedOverdueCount;
    const metrics: HealthAssessments = {
      budget: classifyBudgetPacing(spendPercent, budgetElapsedPercent),
      northStar: classifyNorthStarTrend(analytics.currentCostPerResult, analytics.previousCostPerResult),
      hours: classifyHoursPacing(hoursUsed, analytics.hoursAllotted, hoursElapsedPercent),
      overdue: classifyOverdueTasks(overdueCount),
      margin: classifyMargin(marginValue?.marginPercent ?? null),
    };
    const overall = scoreClientHealth(metrics);
    return {
      id: analytics.id,
      name: analytics.name,
      href: analytics.href,
      status: overall.status,
      score: overall.score,
      values: {
        budget: analytics.budget,
        monthSpend: analytics.monthSpend,
        spendPercent,
        expectedPacePercent: budgetElapsedPercent,
        northStarLabel: analytics.northStarLabel,
        currentCostPerResult: analytics.currentCostPerResult,
        previousCostPerResult: analytics.previousCostPerResult,
        hoursUsed,
        hoursAllotted: analytics.hoursAllotted,
        overdueCount,
        marginPercent: marginValue?.marginPercent ?? null,
      },
      metrics,
      reasons: (Object.values(metrics) as { status: HealthStatus; reason: string }[])
        .filter((metric) => metric.status !== 'healthy')
        .map((metric) => metric.reason),
      fixes: overall.fixes,
      overdueTasks: clickupValue?.overdueTasks ?? [],
    };
  }).sort((a, b) => {
    const rank = { unhealthy: 0, moderate: 1, healthy: 2 };
    return rank[a.status] - rank[b.status] || a.score - b.score || a.name.localeCompare(b.name);
  });

  return {
    generatedAt: now.toISOString(),
    periodLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    rows,
    counts: {
      healthy: rows.filter((row) => row.status === 'healthy').length,
      moderate: rows.filter((row) => row.status === 'moderate').length,
      unhealthy: rows.filter((row) => row.status === 'unhealthy').length,
    },
    sourceStatus: {
      supabase: analyticsResult.value.sourceHealthy ? 'healthy' : 'unknown',
      clickup: clickupResult.status === 'fulfilled' && process.env.CLICKUP_API ? 'healthy' : 'unknown',
      marginSheet: marginResult.status === 'fulfilled' ? 'healthy' : 'unknown',
    },
  };
}
