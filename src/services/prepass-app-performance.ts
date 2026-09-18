import { unstable_cache } from 'next/cache.js';

export const PREPASS_APP_RANGE_OPTIONS = [7, 30, 90] as const;
export type PrepassAppRangeDays = (typeof PREPASS_APP_RANGE_OPTIONS)[number];

export type PrepassAppMetricKey =
  | 'welcome'
  | 'services'
  | 'about'
  | 'fleet'
  | 'verification'
  | 'company'
  | 'vehicles'
  | 'payment'
  | 'review'
  | 'onboarding'
  | 'requestSuccess'
  | 'flowComplete';

export type PrepassAppDailyMetric = {
  date: string;
} & Record<PrepassAppMetricKey, number>;

export type PrepassAppMilestone = {
  key: PrepassAppMetricKey;
  label: string;
  shortLabel: string;
  value: number;
  previousValue: number;
  changePct: number | null;
  conversionFromPrevious: number | null;
  conversionFromWelcome: number | null;
};

export type PrepassAppPerformance = {
  configured: boolean;
  warning: string | null;
  rangeDays: number;
  isCustomRange: boolean;
  maxDate: string;
  start: string;
  end: string;
  comparisonStart: string;
  comparisonEnd: string;
  generatedAt: string;
  daily: PrepassAppDailyMetric[];
  milestones: PrepassAppMilestone[];
  completionSignals: PrepassAppMilestone[];
  metricLabels: Record<PrepassAppMetricKey, string>;
};

type SegmentationResponse = {
  data?: {
    series?: string[];
    values?: Record<string, Record<string, number>>;
  };
  error?: string;
};

type DateWindow = {
  rangeDays: number;
  isCustomRange: boolean;
  maxDate: string;
  start: string;
  end: string;
  comparisonStart: string;
  comparisonEnd: string;
  queryStart: string;
};

export const PREPASS_APP_METRIC_LABELS: Record<PrepassAppMetricKey, string> = {
  welcome: 'Welcome screen',
  services: 'Services & pricing',
  about: 'About yourself',
  fleet: 'Fleet information',
  verification: 'Verification',
  company: 'Company details',
  vehicles: 'Vehicles',
  payment: 'Payment method',
  review: 'Review signup',
  onboarding: 'Onboarding reached',
  requestSuccess: 'Enrollment request success',
  flowComplete: 'Enrollment flow complete',
};

const SCREEN_METRICS: ReadonlyArray<{
  key: Exclude<PrepassAppMetricKey, 'requestSuccess' | 'flowComplete'>;
  screen: string;
  shortLabel: string;
}> = [
  { key: 'welcome', screen: 'welcome_screen', shortLabel: 'App audience' },
  { key: 'services', screen: 'enrollment_services_and_pricing_screen', shortLabel: 'Enrollment starts' },
  { key: 'about', screen: 'enrollment_tell_us_about_yourself_screen', shortLabel: 'About yourself' },
  { key: 'fleet', screen: 'enrollment_fleet_information_screen', shortLabel: 'Fleet information' },
  { key: 'verification', screen: 'enrollment_send_verification_screen', shortLabel: 'Verification' },
  { key: 'company', screen: 'enrollment_company_details_screen', shortLabel: 'Company details' },
  { key: 'vehicles', screen: 'enrollment_your_vehicles_screen', shortLabel: 'Vehicles' },
  { key: 'payment', screen: 'enrollment_add_payment_method_screen', shortLabel: 'Payment' },
  { key: 'review', screen: 'enrollment_review_sign_up_screen', shortLabel: 'Review' },
  { key: 'onboarding', screen: 'welcome_to_prepass_onboarding_screen', shortLabel: 'Onboarding' },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function normalizePrepassAppRange(value: string | number | undefined): PrepassAppRangeDays {
  const parsed = Number(value);
  return PREPASS_APP_RANGE_OPTIONS.includes(parsed as PrepassAppRangeDays)
    ? (parsed as PrepassAppRangeDays)
    : 30;
}

export function prepassAppDateWindow(rangeDays: PrepassAppRangeDays, now = new Date()): DateWindow {
  const yesterday = new Date(now);
  yesterday.setUTCHours(12, 0, 0, 0);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const end = isoDate(yesterday);
  const start = addUtcDays(end, -(rangeDays - 1));
  const comparisonEnd = addUtcDays(start, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -(rangeDays - 1));
  return { rangeDays, isCustomRange: false, maxDate: end, start, end, comparisonStart, comparisonEnd, queryStart: comparisonStart };
}

function validIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

export function prepassAppCustomDateWindow(
  start: string | undefined,
  end: string | undefined,
  now = new Date(),
): DateWindow | null {
  if (!validIsoDate(start) || !validIsoDate(end) || start > end) return null;
  const yesterday = new Date(now);
  yesterday.setUTCHours(12, 0, 0, 0);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const maxDate = isoDate(yesterday);
  if (end > maxDate) return null;

  const startTime = new Date(`${start}T12:00:00Z`).getTime();
  const endTime = new Date(`${end}T12:00:00Z`).getTime();
  const rangeDays = Math.floor((endTime - startTime) / 86_400_000) + 1;
  if (rangeDays < 1 || rangeDays > 366) return null;

  const comparisonEnd = addUtcDays(start, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -(rangeDays - 1));
  return {
    rangeDays,
    isCustomRange: true,
    maxDate,
    start,
    end,
    comparisonStart,
    comparisonEnd,
    queryStart: comparisonStart,
  };
}

function emptyDaily(date: string): PrepassAppDailyMetric {
  return {
    date,
    welcome: 0,
    services: 0,
    about: 0,
    fleet: 0,
    verification: 0,
    company: 0,
    vehicles: 0,
    payment: 0,
    review: 0,
    onboarding: 0,
    requestSuccess: 0,
    flowComplete: 0,
  };
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addUtcDays(date, 1)) dates.push(date);
  return dates;
}

function seriesFor(response: SegmentationResponse, valueKey: string): Record<string, number> {
  return response.data?.values?.[valueKey] ?? {};
}

function addSeries(
  rows: Map<string, PrepassAppDailyMetric>,
  metric: PrepassAppMetricKey,
  series: Record<string, number>,
) {
  for (const [date, value] of Object.entries(series)) {
    const row = rows.get(date);
    if (row) row[metric] += Number(value) || 0;
  }
}

function sumMetric(rows: PrepassAppDailyMetric[], metric: PrepassAppMetricKey): number {
  return rows.reduce((sum, row) => sum + row[metric], 0);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildPrepassAppPerformance(
  window: DateWindow,
  iosScreens: SegmentationResponse,
  androidScreens: SegmentationResponse,
  requestSuccess: SegmentationResponse,
  flowComplete: SegmentationResponse,
  generatedAt = new Date().toISOString(),
): PrepassAppPerformance {
  const allRows = new Map(
    datesBetween(window.queryStart, window.end).map((date) => [date, emptyDaily(date)]),
  );

  for (const metric of SCREEN_METRICS) {
    addSeries(allRows, metric.key, seriesFor(iosScreens, metric.screen));
    addSeries(allRows, metric.key, seriesFor(androidScreens, metric.screen));
  }
  addSeries(allRows, 'requestSuccess', seriesFor(requestSuccess, 'enrollment_request_success'));
  addSeries(allRows, 'flowComplete', seriesFor(flowComplete, 'enrollment_flow_complete'));

  const current = Array.from(allRows.values()).filter((row) => row.date >= window.start && row.date <= window.end);
  const previous = Array.from(allRows.values()).filter((row) => row.date >= window.comparisonStart && row.date <= window.comparisonEnd);

  const pathKeys = SCREEN_METRICS.map((metric) => metric.key);
  const milestones = SCREEN_METRICS.map((metric, index): PrepassAppMilestone => {
    const value = sumMetric(current, metric.key);
    const previousValue = sumMetric(previous, metric.key);
    const previousStepValue = index === 0 ? 0 : sumMetric(current, pathKeys[index - 1]);
    const welcomeValue = sumMetric(current, 'welcome');
    return {
      key: metric.key,
      label: PREPASS_APP_METRIC_LABELS[metric.key],
      shortLabel: metric.shortLabel,
      value,
      previousValue,
      changePct: changePct(value, previousValue),
      conversionFromPrevious: index === 0 ? null : ratio(value, previousStepValue),
      conversionFromWelcome: index === 0 ? null : ratio(value, welcomeValue),
    };
  });

  const welcomeValue = sumMetric(current, 'welcome');
  const completionSignals = ([
    { key: 'requestSuccess', shortLabel: 'Successful requests' },
    { key: 'flowComplete', shortLabel: 'Flow completions' },
  ] as const).map(({ key, shortLabel }): PrepassAppMilestone => {
    const value = sumMetric(current, key);
    const previousValue = sumMetric(previous, key);
    return {
      key,
      label: PREPASS_APP_METRIC_LABELS[key],
      shortLabel,
      value,
      previousValue,
      changePct: changePct(value, previousValue),
      conversionFromPrevious: null,
      conversionFromWelcome: ratio(value, welcomeValue),
    };
  });

  return {
    configured: true,
    warning: null,
    rangeDays: window.rangeDays,
    isCustomRange: window.isCustomRange,
    maxDate: window.maxDate,
    start: window.start,
    end: window.end,
    comparisonStart: window.comparisonStart,
    comparisonEnd: window.comparisonEnd,
    generatedAt,
    daily: current,
    milestones,
    completionSignals,
    metricLabels: PREPASS_APP_METRIC_LABELS,
  };
}

function unconfigured(window: DateWindow, warning: string): PrepassAppPerformance {
  return {
    configured: false,
    warning,
    rangeDays: window.rangeDays,
    isCustomRange: window.isCustomRange,
    maxDate: window.maxDate,
    start: window.start,
    end: window.end,
    comparisonStart: window.comparisonStart,
    comparisonEnd: window.comparisonEnd,
    generatedAt: new Date().toISOString(),
    daily: datesBetween(window.start, window.end).map(emptyDaily),
    milestones: SCREEN_METRICS.map((metric, index) => ({
      key: metric.key,
      label: PREPASS_APP_METRIC_LABELS[metric.key],
      shortLabel: metric.shortLabel,
      value: 0,
      previousValue: 0,
      changePct: 0,
      conversionFromPrevious: index === 0 ? null : 0,
      conversionFromWelcome: index === 0 ? null : 0,
    })),
    completionSignals: ([
      { key: 'requestSuccess', shortLabel: 'Successful requests' },
      { key: 'flowComplete', shortLabel: 'Flow completions' },
    ] as const).map(({ key, shortLabel }) => ({
      key,
      label: PREPASS_APP_METRIC_LABELS[key],
      shortLabel,
      value: 0,
      previousValue: 0,
      changePct: 0,
      conversionFromPrevious: null,
      conversionFromWelcome: 0,
    })),
    metricLabels: PREPASS_APP_METRIC_LABELS,
  };
}

async function querySegmentation(
  username: string,
  secret: string,
  projectId: string,
  window: DateWindow,
  event: string,
  on?: string,
  where?: string,
): Promise<SegmentationResponse> {
  const params = new URLSearchParams({
    project_id: projectId,
    event,
    from_date: window.queryStart,
    to_date: window.end,
    unit: 'day',
    type: 'unique',
  });
  if (on) params.set('on', on);
  if (where) params.set('where', where);

  const response = await fetch(`https://mixpanel.com/api/2.0/segmentation?${params}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString('base64')}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  if (!response.ok) {
    let detail = body.slice(0, 240);
    try { detail = (JSON.parse(body) as SegmentationResponse).error ?? detail; } catch { /* keep text */ }
    throw new Error(`Mixpanel ${event} query failed (${response.status}): ${detail}`);
  }
  return JSON.parse(body) as SegmentationResponse;
}

async function fetchConfiguredPrepassAppPerformance(
  rangeDays: PrepassAppRangeDays,
  customStart?: string,
  customEnd?: string,
): Promise<PrepassAppPerformance> {
  const window = prepassAppCustomDateWindow(customStart, customEnd) ?? prepassAppDateWindow(rangeDays);
  const username = process.env.PREPASS_MIXPANEL_SERVICE_ACCOUNT_USERNAME?.trim();
  const secret = process.env.PREPASS_MIXPANEL_SERVICE_ACCOUNT_SECRET?.trim();
  const projectId = process.env.PREPASS_MIXPANEL_PROJECT_ID?.trim() || '3991098';
  if (!username || !secret) return unconfigured(window, 'Mixpanel reporting is not configured in this environment.');

  const [iosScreens, androidScreens, requestSuccess, flowComplete] = await Promise.all([
    querySegmentation(username, secret, projectId, window, 'app_screen_view', 'properties["curr_screen"]'),
    querySegmentation(
      username,
      secret,
      projectId,
      window,
      'screen_view',
      'properties["screen_name"]',
      'properties["$os"] == "Android"',
    ),
    querySegmentation(username, secret, projectId, window, 'enrollment_request_success'),
    querySegmentation(username, secret, projectId, window, 'enrollment_flow_complete'),
  ]);
  return buildPrepassAppPerformance(window, iosScreens, androidScreens, requestSuccess, flowComplete);
}

const cachedFetch = unstable_cache(
  fetchConfiguredPrepassAppPerformance,
  ['prepass-app-performance-v1'],
  { revalidate: 3600, tags: ['prepass-app-performance'] },
);

export async function fetchPrepassAppPerformance(
  rangeDays: PrepassAppRangeDays,
  customStart?: string,
  customEnd?: string,
): Promise<PrepassAppPerformance> {
  try {
    return await cachedFetch(rangeDays, customStart, customEnd);
  } catch (error) {
    console.error('PrePass Mixpanel reporting failed', error);
    const window = prepassAppCustomDateWindow(customStart, customEnd) ?? prepassAppDateWindow(rangeDays);
    return unconfigured(
      window,
      'App reporting is temporarily unavailable. Please try again shortly.',
    );
  }
}
