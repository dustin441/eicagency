import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

// Champagne Haus is a Google Ads–only client. All data comes from the single
// `champagne_google` Supabase table (populated by the "Champagne Haus Google Ads →
// Supabase" n8n workflow). There is no Meta / ad-level / weekly-readout data, so
// this service is a trimmed, Google-only version of the Kinsey analytics service.
//
// Unlike State48 (ecommerce, purchases/revenue/ROAS), Champagne Haus tracks lead
// conversions — the conversion model here is conversions / cost-per-lead, same as
// the Duro Dyne / Kinsey Google leads model. There is no purchases/revenue/roas.

export type ChampagneFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type ChampagneSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerLead: number;
};

export type ChampagneTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  costPerLead: number;
};

export type ChampagneCampaignRow = {
  campaign: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  ctr: number;
  prevCtr: number;
  conversions: number;
  prevConversions: number;
  costPerLead: number;
  prevCostPerLead: number;
};

export type ChampagneBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type ChampagneWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type ChampagneDashboardData = {
  filterParams: ChampagneFilterParams;
  summary: ChampagneSummary;
  prevSummary: ChampagneSummary;
  timeSeries: ChampagneTimePoint[];
  campaignRows: ChampagneCampaignRow[];
  budgetPacing: ChampagneBudgetPacing;
  weeklyReadout: ChampagneWeeklyReadout | null;
};

type GoogleRow = {
  date: string;
  campaign_name: string;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
};

type BudgetRow = { budget: number };

type ReadoutRow = {
  period_start: string | null;
  period_end: string | null;
  overall_story: string | null;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

const ROW_SELECT = 'date,campaign_name,impressions,clicks,cost,conversions';

function summarise(rows: GoogleRow[]): ChampagneSummary {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    conversions,
    costPerLead: conversions > 0 ? spend / conversions : 0,
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
    const { data, error } = await db.from('champagne_google')
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

export function champagneParamsFromSearch(p: Record<string, string | undefined>): ChampagneFilterParams {
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

export async function fetchChampagneDashboardData(params: ChampagneFilterParams): Promise<ChampagneDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRows, prevRows, budgetRes, pacingRes, readoutRes] = await Promise.all([
    fetchPagedRows(db, start, end),
    fetchPagedRows(db, compStart, compEnd),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'champagne')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('champagne_google')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('champagne_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingRows = (pacingRes.data ?? []) as unknown as { cost: number }[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, { spend: number; conversions: number; impressions: number; clicks: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.conversions += Number(r.conversions ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries: ChampagneTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, costPerLead: d.conversions > 0 ? d.spend / d.conversions : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Campaign rows — current + prev, keyed by campaign name
  type CampAccum = { campaign: string; spend: number; impressions: number; clicks: number; conversions: number };
  function accumulate(rows: GoogleRow[]): Map<string, CampAccum> {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const key = r.campaign_name;
      const e = map.get(key) ?? { campaign: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      e.spend += Number(r.cost ?? 0);
      e.impressions += Number(r.impressions ?? 0);
      e.clicks += Number(r.clicks ?? 0);
      e.conversions += Number(r.conversions ?? 0);
      map.set(key, e);
    }
    return map;
  }
  const campMap = accumulate(currRows);
  const prevCampMap = accumulate(prevRows);
  const campaignRows: ChampagneCampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const p = prevCampMap.get(c.campaign) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 } as CampAccum;
      return {
        ...c,
        prevSpend: p.spend, prevImpressions: p.impressions, prevClicks: p.clicks,
        prevConversions: p.conversions,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        costPerLead: c.conversions > 0 ? c.spend / c.conversions : 0,
        prevCostPerLead: p.conversions > 0 ? p.spend / p.conversions : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  const latestReadout = readoutRows[0];
  const weeklyReadout: ChampagneWeeklyReadout | null = latestReadout
    ? {
        periodStart: latestReadout.period_start ?? '',
        periodEnd: latestReadout.period_end ?? '',
        overallStory: latestReadout.overall_story ?? '',
        wins: stringArray(latestReadout.wins),
        opportunities: stringArray(latestReadout.opportunities),
        accomplishments: stringArray(latestReadout.accomplishments),
        focusNextWeek: stringArray(latestReadout.focus_next_week),
        executionContext: stringArray(latestReadout.execution_context),
      }
    : null;

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
    weeklyReadout,
  };
}
