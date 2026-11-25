// Pure reporting math. No auth, credentials or database access in this module.
type SourceNumber = number | string | null;
export type KangRow = {
  account_id: string; date: string;
  campaign_id: string; campaign_name: string;
  adset_id: string; adset_name: string; ad_id: string; ad_name: string;
  impressions: SourceNumber; clicks: SourceNumber; link_clicks: SourceNumber;
  cost: SourceNumber; landing_page_views: SourceNumber; updated_at: string | null;
};
const fields = ['cost', 'impressions', 'link_clicks', 'landing_page_views'] as const;
type Field = typeof fields[number];
export type KangMetrics = Record<Field, number | null> & {
  linkCtr: number | null; linkCpc: number | null; costPerLpv: number | null;
};
export type KangPerformance = KangMetrics & { id: string; name: string; parent: string; accountId: string; adId: string; campaign: string; adset: string };

function number(value: SourceNumber): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function summarize(rows: KangRow[]): KangMetrics {
  const totals = Object.fromEntries(fields.map(field => {
    const values = rows.map(row => number(row[field]));
    return [field, !values.length || values.includes(null) ? null : values.reduce<number>((a, b) => a + b!, 0)];
  })) as Record<Field, number | null>;
  const ratio = (a: number | null, b: number | null, scale = 1) => a !== null && b !== null && b > 0 ? a / b * scale : null;
  return { ...totals, linkCtr: ratio(totals.link_clicks, totals.impressions, 100), linkCpc: ratio(totals.cost, totals.link_clicks), costPerLpv: ratio(totals.cost, totals.landing_page_views) };
}
export function aggregateKangRows(rows: KangRow[]) {
  function group(level: 'campaign' | 'adset' | 'ad'): KangPerformance[] {
    const groups = new Map<string, KangRow[]>();
    for (const row of rows) {
      const key = JSON.stringify([row.account_id, row.campaign_id, ...(level === 'campaign' ? [] : [row.adset_id]), ...(level === 'ad' ? [row.ad_id] : [])]);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups].map(([id, items]) => {
      const latest = [...items].sort((a, b) => b.date.localeCompare(a.date))[0];
      const name = level === 'campaign' ? latest.campaign_name : level === 'adset' ? latest.adset_name : latest.ad_name;
      return { id, accountId: latest.account_id, adId: latest.ad_id, campaign: latest.campaign_name, adset: latest.adset_name, name: name || `Unnamed ${level}`, parent: level === 'campaign' ? '' : level === 'adset' ? latest.campaign_name : `${latest.campaign_name} / ${latest.adset_name}`, ...summarize(items) };
    }).sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || a.id.localeCompare(b.id));
  }
  const dates = [...new Set(rows.map(row => row.date))].sort();
  const timestamps = rows.map(row => row.updated_at).filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)));
  return {
    summary: summarize(rows), campaigns: group('campaign'), adsets: group('adset'), ads: group('ad'),
    daily: dates.map(date => ({ date, ...summarize(rows.filter(row => row.date === date)) })),
    updatedAt: timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    rowCount: rows.length,
  };
}

export const KANG_CAMPAIGN_START = '2026-11-19';
export const KANG_TIME_ZONE = 'America/Los_Angeles';
function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
}
export function kangDateRange(raw: { start?: string; end?: string }, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: KANG_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const yesterday = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const defaultEnd = yesterday.toISOString().slice(0, 10);
  const start = validDate(raw.start) ? raw.start : KANG_CAMPAIGN_START;
  const end = validDate(raw.end) ? raw.end : defaultEnd;
  return start <= end ? { start, end } : { start: KANG_CAMPAIGN_START, end: defaultEnd < KANG_CAMPAIGN_START ? KANG_CAMPAIGN_START : defaultEnd };
}

export async function fetchKangPages(fetchPage: (from: number, to: number) => Promise<{ data: KangRow[] | null; error: unknown }>, pageSize = 1000): Promise<KangRow[]> {
  const rows: KangRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data) throw new Error('Kang source query failed');
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
