import 'server-only';

import {
  EMPTY_INSTANTLY_SUMMARY,
  buildInstantlyMonthlyGoal,
  isoDate,
  normalizeInstantlyCampaigns,
  normalizeInstantlySummary,
  utcMonthStart,
  type EicInstantlyPerformance,
  type InstantlyApiAnalytics,
} from './instantly-analytics-core';

export type {
  EicInstantlyPerformance,
  InstantlyCampaignPerformance,
  InstantlyMetricSummary,
  InstantlyMonthlyGoal,
} from './instantly-analytics-core';

const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2/campaigns/analytics';
const INSTANTLY_TIMEOUT_MS = 8_000;

function emptyPerformance(start: string, end: string, now: Date, error: string): EicInstantlyPerformance {
  return {
    available: false,
    error,
    periodStart: start,
    periodEnd: end,
    summary: { ...EMPTY_INSTANTLY_SUMMARY },
    campaigns: [],
    monthlyGoal: buildInstantlyMonthlyGoal(EMPTY_INSTANTLY_SUMMARY, now),
  };
}

async function fetchInstantlyJson<T>(
  apiKey: string,
  path: '' | '/overview',
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
  now = new Date()
): Promise<EicInstantlyPerformance> {
  const apiKey = process.env.INSTANTLY_EIC_API_KEY?.trim();
  if (!apiKey) return emptyPerformance(start, end, now, 'Instantly reporting is not configured.');

  const monthStart = utcMonthStart(now);
  const today = isoDate(now);

  try {
    const sameWindow = start === monthStart && end === today;
    const [campaignRows, periodOverview, monthOverview] = await Promise.all([
      fetchInstantlyJson<InstantlyApiAnalytics[]>(apiKey, '', start, end),
      fetchInstantlyJson<InstantlyApiAnalytics>(apiKey, '/overview', start, end),
      sameWindow
        ? Promise.resolve(null)
        : fetchInstantlyJson<InstantlyApiAnalytics>(apiKey, '/overview', monthStart, today),
    ]);

    if (!Array.isArray(campaignRows) || !periodOverview || typeof periodOverview !== 'object') {
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
      summary,
      campaigns: normalizeInstantlyCampaigns(campaignRows),
      monthlyGoal: buildInstantlyMonthlyGoal(monthSummary, now),
    };
  } catch (error) {
    console.error('Unable to load Instantly analytics', error);
    return emptyPerformance(start, end, now, 'Instantly reporting is temporarily unavailable.');
  }
}
