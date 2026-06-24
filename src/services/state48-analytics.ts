import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

// State Forty Eight is a Google Ads–only client. All data comes from the single
// `state48_google` Supabase table (populated by the "State48 Google Ads → Supabase"
// n8n workflow). There is no Meta / ad-level / weekly-readout data, so this service
// is a trimmed, Google-only version of the Kinsey analytics service.

export type State48FilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type State48Summary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type State48TimePoint = {
  label: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number;
};

export type State48CampaignRow = {
  campaign: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  ctr: number;
  prevCtr: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
  roas: number;
  prevRoas: number;
};

export type State48BudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type State48DashboardData = {
  filterParams: State48FilterParams;
  summary: State48Summary;
  prevSummary: State48Summary;
  timeSeries: State48TimePoint[];
  campaignRows: State48CampaignRow[];
  budgetPacing: State48BudgetPacing;
};

type GoogleRow = {
  date: string;
  campaign_name: string;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
  purchases: number | null;
  revenue: number | null;
};

type BudgetRow = { budget: number };

const ROW_SELECT = 'date,campaign_name,impressions,clicks,cost,conversions,purchases,revenue';

function rowSales(r: GoogleRow): number {
  return Number(r.purchases ?? r.conversions ?? 0);
}

function summarise(rows: GoogleRow[]): State48Summary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowSales(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

async function fetchPagedRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<GoogleRow[]> {
  const rows: GoogleRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('state48_google')
      .select(ROW_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return rows;

    const page = (data ?? []) as unknown as GoogleRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export function state48ParamsFromSearch(p: Record<string, string | undefined>): State48FilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
  };
}

export async function fetchState48DashboardData(params: State48FilterParams): Promise<State48DashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRows, prevRows, budgetRes, pacingRes] = await Promise.all([
    fetchPagedRows(db, start, end),
    fetchPagedRows(db, compStart, compEnd),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'state48')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('state48_google')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; purchases: number; impressions: number; clicks: number; revenue: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, purchases: 0, impressions: 0, clicks: 0, revenue: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.purchases += rowSales(r);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.revenue += Number(r.revenue ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries: State48TimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, roas: d.spend > 0 ? d.revenue / d.spend : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows — current + prev, keyed by campaign name
  type CampAccum = { campaign: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number };
  function accumulate(rows: GoogleRow[]): Map<string, CampAccum> {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const key = r.campaign_name;
      const e = map.get(key) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
      e.spend += Number(r.cost ?? 0);
      e.impressions += Number(r.impressions ?? 0);
      e.clicks += Number(r.clicks ?? 0);
      e.purchases += rowSales(r);
      e.revenue += Number(r.revenue ?? 0);
      map.set(key, e);
    }
    return map;
  }
  const campMap = accumulate(currRows);
  const prevCampMap = accumulate(prevRows);
  const campaignRows: State48CampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(c.campaign) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 } as CampAccum;
      return {
        ...c,
        prevSpend: p.spend, prevImpressions: p.impressions, prevClicks: p.clicks,
        prevPurchases: p.purchases, prevRevenue: p.revenue,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        prevRoas: p.spend > 0 ? p.revenue / p.spend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  return {
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    campaignRows,
    budgetPacing: {
      budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
      totalSpend,
      monthStart,
      monthEnd,
    },
  };
}
