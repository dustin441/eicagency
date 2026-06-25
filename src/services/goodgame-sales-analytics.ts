import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, toIsoDate } from '@/lib/date-utils';

// ─── Good Game — Sales (eCommerce) tab ─────────────────────────────────────────
// Mirrors the Spartaco eCommerce tab (purchases + revenue → ROAS), but scoped to
// Good Game's [SALES] campaigns only (Meta + Google) and with NO brand/product
// dimension — Good Game is a single brand. Data comes from the `goodgame_master`
// UNION view in the EIC Clients Supabase project (lozgnyxixzfxokllevtb).
//
// Sales campaigns are identified by the literal "[SALES]" marker in the campaign
// name (e.g. "[SALES] Purchase | Prospect | Limited Offer"). Google stores its
// conversions/value in `conversions` / `revenue` (purchases is NULL for Google in
// the master view), so `rowPurchases()` falls back to `conversions`.

export type GoodGameSalesFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Google' | 'Meta'
};

export type GoodGameSalesSummary = {
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  ctr: number;   // ratio (clicks / impressions) — fmtPercent multiplies by 100
  cpc: number;
  roas: number;
  aov: number;   // revenue / purchases
  costPerPurchase: number;
};

export type GoodGameSalesChartPoint = {
  label: string;
  spend: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type GoodGameSalesBreakdownRow = {
  label: string;
  secondaryLabel?: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
};

export type GoodGameSalesDashboardData = {
  filterParams: GoodGameSalesFilterParams;
  summary: GoodGameSalesSummary;
  previousSummary: GoodGameSalesSummary;
  daily: GoodGameSalesChartPoint[];
  weekly: GoodGameSalesChartPoint[];
  monthly: GoodGameSalesChartPoint[];
  channelRows: GoodGameSalesBreakdownRow[];
  campaignRows: GoodGameSalesBreakdownRow[];
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number | null;
  purchases: number | null;
  revenue: number;
};

const SALES_MARKER = '%[SALES]%';
const SUPABASE_PAGE_SIZE = 1000;

// Google stores conversions in `conversions`; Meta stores purchases in `purchases`.
function rowPurchases(r: MasterRow): number {
  return Number(r.purchases ?? r.conversions ?? 0);
}

async function fetchPagedRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

export function goodgameSalesParamsFromSearch(
  p: Record<string, string | undefined>
): GoodGameSalesFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
    channel: p.channel ?? 'all',
  };
}

function summarise(rows: MasterRow[]): GoodGameSalesSummary {
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const cost = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowPurchases(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    impressions,
    clicks,
    cost,
    purchases,
    revenue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    roas: cost > 0 ? revenue / cost : 0,
    aov: purchases > 0 ? revenue / purchases : 0,
    costPerPurchase: purchases > 0 ? cost / purchases : 0,
  };
}

function weekStart(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function labelForBucket(bucket: string, grain: 'day' | 'week' | 'month') {
  if (grain === 'day') {
    return new Date(`${bucket}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (grain === 'week') {
    const start = new Date(`${bucket}T12:00:00`);
    const end = new Date(`${bucket}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return new Date(`${bucket}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function aggregateTime(rows: MasterRow[], grain: 'day' | 'week' | 'month'): GoodGameSalesChartPoint[] {
  const bucketMap = new Map<string, { spend: number; clicks: number; purchases: number; revenue: number }>();
  for (const row of rows) {
    const bucket =
      grain === 'day' ? row.date :
      grain === 'week' ? weekStart(row.date) :
      row.date.slice(0, 7);
    const entry = bucketMap.get(bucket) ?? { spend: 0, clicks: 0, purchases: 0, revenue: 0 };
    entry.spend += Number(row.cost ?? 0);
    entry.clicks += Number(row.clicks ?? 0);
    entry.purchases += rowPurchases(row);
    entry.revenue += Number(row.revenue ?? 0);
    bucketMap.set(bucket, entry);
  }
  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      label: labelForBucket(bucket, grain),
      spend: v.spend,
      clicks: v.clicks,
      purchases: v.purchases,
      revenue: v.revenue,
      roas: v.spend > 0 ? v.revenue / v.spend : 0,
    }));
}

function aggregateBreakdown(
  currentRows: MasterRow[],
  prevRows: MasterRow[],
  keyFn: (row: MasterRow) => string,
  secondaryFn?: (row: MasterRow) => string | undefined
): GoodGameSalesBreakdownRow[] {
  const map = new Map<string, GoodGameSalesBreakdownRow>();

  function apply(rows: MasterRow[], isPrev: boolean) {
    for (const row of rows) {
      const key = keyFn(row);
      const entry = map.get(key) ?? {
        label: keyFn(row),
        secondaryLabel: secondaryFn?.(row),
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        purchases: 0, prevPurchases: 0,
        revenue: 0, prevRevenue: 0,
      };
      if (isPrev) {
        entry.prevImpressions += Number(row.impressions ?? 0);
        entry.prevClicks += Number(row.clicks ?? 0);
        entry.prevCost += Number(row.cost ?? 0);
        entry.prevPurchases += rowPurchases(row);
        entry.prevRevenue += Number(row.revenue ?? 0);
      } else {
        entry.impressions += Number(row.impressions ?? 0);
        entry.clicks += Number(row.clicks ?? 0);
        entry.cost += Number(row.cost ?? 0);
        entry.purchases += rowPurchases(row);
        entry.revenue += Number(row.revenue ?? 0);
      }
      map.set(key, entry);
    }
  }

  apply(currentRows, false);
  apply(prevRows, true);

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export async function fetchGoodGameSalesData(
  params: GoodGameSalesFilterParams
): Promise<GoodGameSalesDashboardData> {
  const db = createSpartacoSupabaseClient();
  const select = 'date,campaign_name,ad_channel,impressions,clicks,cost,conversions,purchases,revenue';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    let next = q.ilike('campaign_name', SALES_MARKER);
    if (params.channel !== 'all') next = next.eq('ad_channel', params.channel);
    return next;
  }

  const [currentRows, prevRows] = await Promise.all([
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyFilters(
        db.from('goodgame_master').select(select).gte('date', params.start).lte('date', params.end)
      ).order('date', { ascending: true }).range(from, to)
    ),
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyFilters(
        db.from('goodgame_master').select(select).gte('date', params.compStart).lte('date', params.compEnd)
      ).order('date', { ascending: true }).range(from, to)
    ),
  ]);

  return {
    filterParams: params,
    summary: summarise(currentRows),
    previousSummary: summarise(prevRows),
    daily: aggregateTime(currentRows, 'day'),
    weekly: aggregateTime(currentRows, 'week'),
    monthly: aggregateTime(currentRows, 'month'),
    channelRows: aggregateBreakdown(currentRows, prevRows, (row) => row.ad_channel),
    campaignRows: aggregateBreakdown(
      currentRows,
      prevRows,
      (row) => `${row.campaign_name}||${row.ad_channel}`,
      (row) => row.ad_channel
    ),
  };
}
