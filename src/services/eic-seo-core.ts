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

export type SeoQueryPerformance = SeoMetricSummary & {
  query: string;
  page: string;
  previousClicks: number;
  previousImpressions: number;
  previousCtr: number | null;
  previousPosition: number | null;
  positionChange: number | null;
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
  latestCompleteDate: string;
  opportunities: SeoQueryOpportunity[];
  queries: {
    brand: SeoQueryPerformance[];
    nonBrand: SeoQueryPerformance[];
  };
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

export type SeoPeriods = {
  periodStart: string;
  periodEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
};

export function defaultSeoPeriods(now = new Date()): SeoPeriods {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  today.setUTCDate(today.getUTCDate() - 3);
  const periodEnd = isoDate(today);
  const periodStart = addUtcDays(periodEnd, -29);
  const comparisonEnd = addUtcDays(periodStart, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -29);
  return { periodStart, periodEnd, comparisonStart, comparisonEnd };
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

export function periodsFromRange(start: string, end: string, now = new Date()): SeoPeriods {
  const fallback = defaultSeoPeriods(now);
  if (!validIsoDate(start) || !validIsoDate(end) || end > fallback.periodEnd || start > end) return fallback;
  const durationDays = Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  if (durationDays < 1 || durationDays > 366) return fallback;
  const comparisonEnd = addUtcDays(start, -1);
  const comparisonStart = addUtcDays(comparisonEnd, -(durationDays - 1));
  return { periodStart: start, periodEnd: end, comparisonStart, comparisonEnd };
}

export function periodsEndingOn(end: string, now = new Date()) {
  const fallback = defaultSeoPeriods(now);
  if (!validIsoDate(end) || end > fallback.periodEnd) return fallback;
  return periodsFromRange(addUtcDays(end, -29), end, now);
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
  return /(^|\s)(eic|eic agency|eic marketing|eicagency|eic\.agency|every impression counts)(\s|$)/i.test(query.trim());
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

function cleanPageByQuery(queryPageRows: SearchConsoleApiRow[]) {
  const pageByQuery = new Map<string, SearchConsoleApiRow>();
  for (const row of queryPageRows) {
    const query = row.keys?.[0] ?? '';
    const page = row.keys?.[1] ?? '';
    if (!query || !page || isLocalListingPage(page)) continue;
    const existing = pageByQuery.get(query);
    if (!existing || number(row.impressions) > number(existing.impressions)) pageByQuery.set(query, row);
  }
  return pageByQuery;
}

export function buildQueryPerformance(
  currentRows: SearchConsoleApiRow[],
  previousRows: SearchConsoleApiRow[],
  queryPageRows: SearchConsoleApiRow[]
) {
  const previous = new Map(previousRows.map(row => [rowKey(row), row]));
  const pageByQuery = cleanPageByQuery(queryPageRows);
  const rows = currentRows
    .filter(row => rowKey(row) && number(row.impressions) > 0 && pageByQuery.has(rowKey(row)))
    .map(row => {
      const query = rowKey(row);
      const prior = previous.get(query);
      const current = normalizeMetric(row);
      const previousPosition = prior && number(prior.impressions) >= 3 ? number(prior.position) : null;
      return {
        ...current,
        query,
        page: pageByQuery.get(query)?.keys?.[1] ?? '',
        previousClicks: prior ? number(prior.clicks) : 0,
        previousImpressions: prior ? number(prior.impressions) : 0,
        previousCtr: prior ? number(prior.ctr) : null,
        previousPosition,
        positionChange: previousPosition === null ? null : previousPosition - current.position,
      } satisfies SeoQueryPerformance;
    })
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.position - b.position);

  return {
    brand: rows.filter(row => isBrandQuery(row.query)).slice(0, 1_000),
    nonBrand: rows.filter(row => !isBrandQuery(row.query)).slice(0, 1_000),
  };
}

export function buildQueryOpportunities(
  currentRows: SearchConsoleApiRow[],
  previousRows: SearchConsoleApiRow[],
  queryPageRows: SearchConsoleApiRow[]
): SeoQueryOpportunity[] {
  const previous = new Map(previousRows.map(row => [rowKey(row), row]));
  const pageByQuery = cleanPageByQuery(queryPageRows);

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
        previousPosition: prior && prior.impressions >= 3 ? prior.position : null,
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
    latestCompleteDate: periods.periodEnd,
    opportunities: [],
    queries: { brand: [], nonBrand: [] },
    pages: [],
    trend: [],
    sitemap: { healthy: false, submitted: 0, errors: 0, warnings: 0, lastDownloaded: null },
  };
}
