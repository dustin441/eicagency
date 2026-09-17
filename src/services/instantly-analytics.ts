import 'server-only';

import {
  EMPTY_INSTANTLY_SUMMARY,
  buildInstantlyMonthlyGoal,
  isoDate,
  mergeInstantlyCampaignComparisons,
  normalizeInstantlyCampaigns,
  normalizeInstantlySummary,
  normalizeInstantlyTrend,
  utcMonthStart,
  type EicInstantlyPerformance,
  type InstantlyApiAnalytics,
  type InstantlyApiDailyAnalytics,
} from './instantly-analytics-core';

export type {
  EicInstantlyPerformance,
  InstantlyCampaignComparisonPerformance,
  InstantlyCampaignPerformance,
  InstantlyMetricSummary,
  InstantlyMonthlyGoal,
  InstantlyTrendPoint,
} from './instantly-analytics-core';

const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2/campaigns/analytics';
const INSTANTLY_TIMEOUT_MS = 8_000;

function emptyPerformance(
  start: string,
  end: string,
  comparisonStart: string,
  comparisonEnd: string,
  now: Date,
  error: string
): EicInstantlyPerformance {
  return {
    available: false,
    error,
    periodStart: start,
    periodEnd: end,
    comparisonStart,
    comparisonEnd,
    summary: { ...EMPTY_INSTANTLY_SUMMARY },
    comparisonSummary: { ...EMPTY_INSTANTLY_SUMMARY },
    campaigns: [],
    trend: [],
    monthlyGoal: buildInstantlyMonthlyGoal(EMPTY_INSTANTLY_SUMMARY, now),
  };
}

async function fetchInstantlyJson<T>(
  apiKey: string,
  path: '' | '/overview' | '/daily',
  start: string,
  end: string
): Promise<T> {
  const query = new URLSearchParams({ start_date: start, end_date: end });
  const response = await fetch(`${INSTANTLY_API_BASE}${path}?${query}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(INSTANTLY_TIMEOUT_MS),
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Instantly analytics request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchEicInstantlyPerformance(
  start: string,
  end: string,
  comparisonStart: string,
  comparisonEnd: string,
  now = new Date()
): Promise<EicInstantlyPerformance> {
  const apiKey = process.env.INSTANTLY_EIC_API_KEY?.trim();
  if (!apiKey) return emptyPerformance(start, end, comparisonStart, comparisonEnd, now, 'Instantly reporting is not configured.');

  const monthStart = utcMonthStart(now);
  const today = isoDate(now);

  try {
    const sameWindow = start === monthStart && end === today;
    const [campaignRows, periodOverview, comparisonCampaignRows, comparisonOverview, dailyRows, monthOverview] = await Promise.all([
      fetchInstantlyJson<InstantlyApiAnalytics[]>(apiKey, '', start, end),
      fetchInstantlyJson<InstantlyApiAnalytics>(apiKey, '/overview', start, end),
      fetchInstantlyJson<InstantlyApiAnalytics[]>(apiKey, '', comparisonStart, comparisonEnd),
      fetchInstantlyJson<InstantlyApiAnalytics>(apiKey, '/overview', comparisonStart, comparisonEnd),
      fetchInstantlyJson<InstantlyApiDailyAnalytics[]>(apiKey, '/daily', start, end),
      sameWindow
        ? Promise.resolve(null)
        : fetchInstantlyJson<InstantlyApiAnalytics>(apiKey, '/overview', monthStart, today),
    ]);

    if (!Array.isArray(campaignRows) || !Array.isArray(comparisonCampaignRows) || !Array.isArray(dailyRows)
      || !periodOverview || typeof periodOverview !== 'object'
      || !comparisonOverview || typeof comparisonOverview !== 'object') {
      throw new Error('Instantly analytics returned an unexpected response');
    }
    if (monthOverview !== null && typeof monthOverview !== 'object') {
      throw new Error('Instantly monthly analytics returned an unexpected response');
    }

    const summary = normalizeInstantlySummary(periodOverview);
    const monthSummary = sameWindow ? summary : normalizeInstantlySummary(monthOverview ?? {});

    return {
      available: true,
      error: null,
      periodStart: start,
      periodEnd: end,
      comparisonStart,
      comparisonEnd,
      summary,
      comparisonSummary: normalizeInstantlySummary(comparisonOverview),
      campaigns: mergeInstantlyCampaignComparisons(
        normalizeInstantlyCampaigns(campaignRows),
        normalizeInstantlyCampaigns(comparisonCampaignRows)
      ),
      trend: normalizeInstantlyTrend(dailyRows),
      monthlyGoal: buildInstantlyMonthlyGoal(monthSummary, now),
    };
  } catch (error) {
    console.error('Unable to load Instantly analytics', error);
    return emptyPerformance(start, end, comparisonStart, comparisonEnd, now, 'Instantly reporting is temporarily unavailable.');
  }
}
