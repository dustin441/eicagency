import 'server-only';

import { unstable_cache } from 'next/cache';
import {
  aggregateRows,
  buildPagePerformance,
  buildQueryOpportunities,
  emptySeoDashboard,
  normalizeMetric,
  periodsEndingOn,
  type SearchConsoleApiRow,
  type SeoDashboardData,
} from './eic-seo-core';

export type { SeoDashboardData, SeoMetricSummary, SeoPagePerformance, SeoQueryOpportunity, SeoTrendPoint } from './eic-seo-core';

const PROPERTY = 'https://eic.agency/';
const API_BASE = 'https://www.googleapis.com/webmasters/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REQUEST_TIMEOUT_MS = 12_000;

type SearchAnalyticsResponse = { rows?: SearchConsoleApiRow[] };
type SitemapResponse = {
  sitemap?: Array<{
    path?: string;
    errors?: string;
    warnings?: string;
    lastDownloaded?: string;
    contents?: Array<{ submitted?: string }>;
  }>;
};

function googleCredentials() {
  const clientId = process.env.GSC_CLIENT_ID?.trim();
  const clientSecret = process.env.GSC_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GSC_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

async function accessToken() {
  const credentials = googleCredentials();
  if (!credentials) throw new Error('Google Search Console reporting is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google OAuth refresh failed with HTTP ${response.status}`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('Google OAuth refresh returned no access token.');
  return payload.access_token;
}

async function searchAnalytics(
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = []
): Promise<SearchConsoleApiRow[]> {
  const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit: dimensions.length ? 25_000 : 1,
      dataState: 'final',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Search Console query failed with HTTP ${response.status}`);
  const payload = await response.json() as SearchAnalyticsResponse;
  return payload.rows ?? [];
}

async function sitemaps(token: string): Promise<SitemapResponse> {
  const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(PROPERTY)}/sitemaps`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Search Console sitemap request failed with HTTP ${response.status}`);
  return response.json() as Promise<SitemapResponse>;
}

async function loadSeoDashboard(periodEnd: string): Promise<SeoDashboardData> {
  const periods = periodsEndingOn(periodEnd);
  const token = await accessToken();
  const [
    currentTotals,
    comparisonTotals,
    currentQueries,
    comparisonQueries,
    currentPages,
    comparisonPages,
    queryPages,
    daily,
    sitemapPayload,
  ] = await Promise.all([
    searchAnalytics(token, periods.periodStart, periods.periodEnd),
    searchAnalytics(token, periods.comparisonStart, periods.comparisonEnd),
    searchAnalytics(token, periods.periodStart, periods.periodEnd, ['query']),
    searchAnalytics(token, periods.comparisonStart, periods.comparisonEnd, ['query']),
    searchAnalytics(token, periods.periodStart, periods.periodEnd, ['page']),
    searchAnalytics(token, periods.comparisonStart, periods.comparisonEnd, ['page']),
    searchAnalytics(token, periods.periodStart, periods.periodEnd, ['query', 'page']),
    searchAnalytics(token, periods.periodStart, periods.periodEnd, ['date']),
    sitemaps(token),
  ]);

  const visibleNonBrandRows = currentQueries.filter(row => !/^(eic|eic agency|eic marketing|every impression counts)(\s|$)/i.test(row.keys?.[0]?.trim() ?? ''));
  const comparisonVisibleNonBrandRows = comparisonQueries.filter(row => !/^(eic|eic agency|eic marketing|every impression counts)(\s|$)/i.test(row.keys?.[0]?.trim() ?? ''));
  const sitemap = sitemapPayload.sitemap?.find(item => item.path === `${PROPERTY}sitemap.xml`) ?? sitemapPayload.sitemap?.[0];
  const errors = Number(sitemap?.errors ?? 0) || 0;
  const warnings = Number(sitemap?.warnings ?? 0) || 0;

  return {
    available: true,
    error: null,
    property: PROPERTY,
    ...periods,
    summary: normalizeMetric(currentTotals[0]),
    comparisonSummary: normalizeMetric(comparisonTotals[0]),
    visibleNonBrand: aggregateRows(visibleNonBrandRows),
    comparisonVisibleNonBrand: aggregateRows(comparisonVisibleNonBrandRows),
    opportunities: buildQueryOpportunities(currentQueries, comparisonQueries, queryPages),
    pages: buildPagePerformance(currentPages, comparisonPages),
    trend: daily.map(row => ({ date: row.keys?.[0] ?? '', ...normalizeMetric(row) })).filter(row => row.date),
    sitemap: {
      healthy: Boolean(sitemap) && errors === 0 && warnings === 0,
      submitted: sitemap?.contents?.reduce((sum, item) => sum + (Number(item.submitted ?? 0) || 0), 0) ?? 0,
      errors,
      warnings,
      lastDownloaded: sitemap?.lastDownloaded ?? null,
    },
  };
}

const cachedSeoDashboard = unstable_cache(loadSeoDashboard, ['eic-seo-dashboard-v1'], { revalidate: 21_600 });

export async function fetchEicSeoDashboard(end?: string, now = new Date()): Promise<SeoDashboardData> {
  const periods = periodsEndingOn(end ?? '', now);
  try {
    return await cachedSeoDashboard(periods.periodEnd);
  } catch (error) {
    console.error('Unable to load EIC Search Console dashboard', error);
    const message = googleCredentials()
      ? 'Search Console is temporarily unavailable. Please retry later.'
      : 'Google Search Console reporting is not configured.';
    return emptySeoDashboard(periods, message);
  }
}
