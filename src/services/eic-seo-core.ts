export type SearchConsoleApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type SeoMetricSummary = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoQueryOpportunity = SeoMetricSummary & {
  query: string;
  page: string | null;
  previousClicks: number;
  previousImpressions: number;
  previousCtr: number | null;
  previousPosition: number | null;
  positionChange: number | null;
  impressionChange: number | null;
  category: 'Protect' | 'Quick win' | 'Build authority';
};

export type SeoPagePerformance = SeoMetricSummary & {
  page: string;
  previousClicks: number;
  previousImpressions: number;
  previousCtr: number | null;
  previousPosition: number | null;
};

export type SeoTrendPoint = SeoMetricSummary & { date: string };

export type SeoDashboardData = {
  available: boolean;
  error: string | null;
  property: string;
  periodStart: string;
  periodEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  summary: SeoMetricSummary;
  comparisonSummary: SeoMetricSummary;
  visibleNonBrand: SeoMetricSummary;
  comparisonVisibleNonBrand: SeoMetricSummary;
  opportunities: SeoQueryOpportunity[];
  pages: SeoPagePerformance[];
  trend: SeoTrendPoint[];
  sitemap: {
    healthy: boolean;
    submitted: number;
    errors: number;
    warnings: number;
    lastDownloaded: string | null;
  };
};

const ZERO_SUMMARY: SeoMetricSummary = { clicks: 0, impressions: 0, ctr: 0, position: 0 };

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function defaultSeoPeriods(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  today.setUTCDate(today.getUTCDate() - 3);
  const periodEnd = isoDate(today);
  const periodStart = addUtcDays(periodEnd, -27);
  const comparisonEnd = addUtcDays(periodStart, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -27);
  return { periodStart, periodEnd, comparisonStart, comparisonEnd };
}

export function periodsEndingOn(end: string, now = new Date()) {
  const fallback = defaultSeoPeriods(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return fallback;
  const parsed = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== end || end > fallback.periodEnd) return fallback;
  const periodStart = addUtcDays(end, -27);
  const comparisonEnd = addUtcDays(periodStart, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -27);
  return { periodStart, periodEnd: end, comparisonStart, comparisonEnd };
}

export function normalizeMetric(row?: SearchConsoleApiRow): SeoMetricSummary {
  return {
    clicks: number(row?.clicks),
    impressions: number(row?.impressions),
    ctr: number(row?.ctr),
    position: number(row?.position),
  };
}

export function isBrandQuery(query: string) {
  return /(^|\s)(eic|eic agency|eic marketing|every impression counts)(\s|$)/i.test(query.trim());
}

export function aggregateRows(rows: SearchConsoleApiRow[]): SeoMetricSummary {
  const clicks = rows.reduce((sum, row) => sum + number(row.clicks), 0);
  const impressions = rows.reduce((sum, row) => sum + number(row.impressions), 0);
  const weightedPosition = rows.reduce((sum, row) => sum + number(row.position) * number(row.impressions), 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : 0,
  };
}

function canonicalPage(value: string) {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function isLocalListingPage(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get('utm_medium') === 'local';
  } catch {
    return false;
  }
}

function rowKey(row: SearchConsoleApiRow) {
  return row.keys?.[0] ?? '';
}

export function buildQueryOpportunities(
  currentRows: SearchConsoleApiRow[],
  previousRows: SearchConsoleApiRow[],
  queryPageRows: SearchConsoleApiRow[]
): SeoQueryOpportunity[] {
  const previous = new Map(previousRows.map(row => [rowKey(row), row]));
  const pageByQuery = new Map<string, SearchConsoleApiRow>();
  for (const row of queryPageRows) {
    const query = row.keys?.[0] ?? '';
    const page = row.keys?.[1] ?? '';
    if (!query || !page || isLocalListingPage(page)) continue;
    const existing = pageByQuery.get(query);
    if (!existing || number(row.impressions) > number(existing.impressions)) pageByQuery.set(query, row);
  }

  return currentRows
    .filter(row => {
      const query = rowKey(row);
      const position = number(row.position);
      return query && pageByQuery.has(query) && !isBrandQuery(query) && number(row.impressions) >= 3 && position >= 1 && position <= 40;
    })
    .map(row => {
      const query = rowKey(row);
      const prior = previous.get(query);
      const current = normalizeMetric(row);
      const previousPosition = prior && number(prior.impressions) >= 3 ? number(prior.position) : null;
      const positionChange = previousPosition === null ? null : previousPosition - current.position;
      let category: SeoQueryOpportunity['category'] = current.position <= 20 ? 'Quick win' : 'Build authority';
      if (current.position <= 10 && positionChange !== null && positionChange <= -2) category = 'Protect';
      return {
        ...current,
        query,
        page: pageByQuery.get(query)?.keys?.[1] ?? null,
        previousClicks: prior ? number(prior.clicks) : 0,
        previousImpressions: prior ? number(prior.impressions) : 0,
        previousCtr: prior ? number(prior.ctr) : null,
        previousPosition,
        positionChange,
        impressionChange: prior ? current.impressions - number(prior.impressions) : null,
        category,
      };
    })
    .sort((a, b) => {
      const priority = { Protect: 0, 'Quick win': 1, 'Build authority': 2 };
      return priority[a.category] - priority[b.category]
        || b.impressions - a.impressions
        || a.position - b.position;
    })
    .slice(0, 20);
}

export function buildPagePerformance(currentRows: SearchConsoleApiRow[], previousRows: SearchConsoleApiRow[]) {
  const aggregatePages = (rows: SearchConsoleApiRow[]) => {
    const grouped = new Map<string, SearchConsoleApiRow[]>();
    for (const row of rows) {
      const page = canonicalPage(rowKey(row));
      if (!page) continue;
      grouped.set(page, [...(grouped.get(page) ?? []), row]);
    }
    return new Map(Array.from(grouped, ([page, groupedRows]) => [page, aggregateRows(groupedRows)]));
  };

  const current = aggregatePages(currentRows);
  const previous = aggregatePages(previousRows);
  return Array.from(current)
    .map(([page, metrics]) => {
      const prior = previous.get(page);
      return {
        ...metrics,
        page,
        previousClicks: prior?.clicks ?? 0,
        previousImpressions: prior?.impressions ?? 0,
        previousCtr: prior?.ctr ?? null,
        previousPosition: prior?.position ?? null,
      } satisfies SeoPagePerformance;
    })
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 12);
}

export function emptySeoDashboard(periods: ReturnType<typeof defaultSeoPeriods>, error: string): SeoDashboardData {
  return {
    available: false,
    error,
    property: 'https://eic.agency/',
    ...periods,
    summary: { ...ZERO_SUMMARY },
    comparisonSummary: { ...ZERO_SUMMARY },
    visibleNonBrand: { ...ZERO_SUMMARY },
    comparisonVisibleNonBrand: { ...ZERO_SUMMARY },
    opportunities: [],
    pages: [],
    trend: [],
    sitemap: { healthy: false, submitted: 0, errors: 0, warnings: 0, lastDownloaded: null },
  };
}
