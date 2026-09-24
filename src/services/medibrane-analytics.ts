import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

export type MedibraneCurrency = 'ILS' | 'USD';

export type MedibraneFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

// Cross-channel summaries intentionally contain only additive, non-monetary metrics.
export type MedibraneSummary = {
  impressions: number;
  clicks: number;
  ctr: number;
};

export type MedibraneTimePoint = {
  label: string;
  impressions: number;
  clicks: number;
};

export type MedibraneChannelRow = {
  channel: 'Meta' | 'Google';
  currency: MedibraneCurrency;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  conversions: number;
  prevConversions: number;
  costPerLead: number;
  prevCostPerLead: number;
  hasCurrentData: boolean;
  hasPreviousData: boolean;
};

export type MedibraneCampaignRow = {
  campaignId: string;
  campaign: string;
  channel: 'Meta' | 'Google';
  currency: MedibraneCurrency;
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

export type MedibraneBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type MedibraneWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type MedibraneDashboardData = {
  filterParams: MedibraneFilterParams;
  summary: MedibraneSummary;
  prevSummary: MedibraneSummary;
  timeSeries: MedibraneTimePoint[];
  channelRows: MedibraneChannelRow[];
  campaignRows: MedibraneCampaignRow[];
  budgetPacing: MedibraneBudgetPacing;
  weeklyReadout: MedibraneWeeklyReadout | null;
};

type MedibraneRow = {
  date: string;
  campaign_id: string;
  campaign_name: string;
  ad_channel: 'Meta' | 'Google';
  currency: MedibraneCurrency;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
};

type SourceRow = Omit<MedibraneRow, 'ad_channel' | 'currency'>;
type MedibraneTable = 'medibrane_meta' | 'medibrane_google';
type BudgetRow = { budget: number };
type WeeklyReadoutRow = {
  period_start: string;
  period_end: string;
  overall_story: string | null;
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

const ROW_SELECT = 'date,campaign_id,campaign_name,impressions,clicks,cost,conversions';

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

function jerusalemDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function summarise(rows: MedibraneRow[]): MedibraneSummary {
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

async function fetchPagedRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  table: MedibraneTable,
  start: string,
  end: string,
): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table)
      .select(ROW_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('campaign_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch MediBraine ${table === 'medibrane_meta' ? 'Meta' : 'Google'} rows: ${error.message}`);

    const page = (data ?? []) as unknown as SourceRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchMetaRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string,
): Promise<MedibraneRow[]> {
  const rows = await fetchPagedRows(db, 'medibrane_meta', start, end);
  return rows.map(row => ({ ...row, ad_channel: 'Meta', currency: 'ILS' }));
}

async function fetchGoogleRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string,
): Promise<MedibraneRow[]> {
  const rows = await fetchPagedRows(db, 'medibrane_google', start, end);
  return rows.map(row => ({ ...row, ad_channel: 'Google', currency: 'USD' }));
}

async function fetchAllRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string,
): Promise<MedibraneRow[]> {
  const [metaRows, googleRows] = await Promise.all([
    fetchMetaRows(db, start, end),
    fetchGoogleRows(db, start, end),
  ]);
  return [...metaRows, ...googleRows];
}

export function medibraneParamsFromSearch(p: Record<string, string | undefined>): MedibraneFilterParams {
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

export async function fetchMedibraneDashboardData(params: MedibraneFilterParams): Promise<MedibraneDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;
  const monthEnd = jerusalemDate();
  const monthStart = `${monthEnd.slice(0, 7)}-01`;

  const [currRows, prevRows, budgetRes, pacingRows, weeklyReadoutRes] = await Promise.all([
    fetchAllRows(db, start, end),
    fetchAllRows(db, compStart, compEnd),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'medibrane')
      .order('period_start', { ascending: false, nullsFirst: false })
      .limit(1),
    fetchMetaRows(db, monthStart, monthEnd),
    db.from('medibrane_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .eq('status', 'published')
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  if (budgetRes.error) throw new Error(`Failed to fetch MediBraine budget: ${budgetRes.error.message}`);
  if (weeklyReadoutRes.error) throw new Error(`Failed to fetch MediBraine weekly readout: ${weeklyReadoutRes.error.message}`);
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Monetary values are excluded: ILS and USD must never be summed into one trend.
  const dateMap = new Map<string, Omit<MedibraneTimePoint, 'label'>>();
  for (const row of currRows) {
    const existing = dateMap.get(row.date) ?? { impressions: 0, clicks: 0 };
    existing.impressions += Number(row.impressions ?? 0);
    existing.clicks += Number(row.clicks ?? 0);
    dateMap.set(row.date, existing);
  }
  const timeSeries: MedibraneTimePoint[] = Array.from(dateMap.entries())
    .map(([label, values]) => ({ label, ...values }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const channelDefinitions = [
    { channel: 'Meta' as const, currency: 'ILS' as const },
    { channel: 'Google' as const, currency: 'USD' as const },
  ];
  const channelRows: MedibraneChannelRow[] = channelDefinitions.map(({ channel, currency }) => {
    const curr = currRows.filter(row => row.ad_channel === channel);
    const prev = prevRows.filter(row => row.ad_channel === channel);
    const spend = curr.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
    const prevSpend = prev.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
    const conversions = curr.reduce((sum, row) => sum + Number(row.conversions ?? 0), 0);
    const prevConversions = prev.reduce((sum, row) => sum + Number(row.conversions ?? 0), 0);
    return {
      channel,
      currency,
      spend,
      prevSpend,
      impressions: curr.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0),
      prevImpressions: prev.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0),
      clicks: curr.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0),
      prevClicks: prev.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0),
      conversions,
      prevConversions,
      costPerLead: conversions > 0 ? spend / conversions : 0,
      prevCostPerLead: prevConversions > 0 ? prevSpend / prevConversions : 0,
      hasCurrentData: curr.length > 0,
      hasPreviousData: prev.length > 0,
    };
  });

  type CampAccum = {
    campaignId: string;
    campaign: string;
    channel: 'Meta' | 'Google';
    currency: MedibraneCurrency;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
  function accumulate(rows: MedibraneRow[]): Map<string, CampAccum> {
    const map = new Map<string, CampAccum>();
    for (const row of rows) {
      const key = `${row.campaign_id}__${row.ad_channel}`;
      const existing = map.get(key) ?? {
        campaignId: row.campaign_id,
        campaign: row.campaign_name,
        channel: row.ad_channel,
        currency: row.currency,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };
      existing.campaign = row.campaign_name;
      existing.spend += Number(row.cost ?? 0);
      existing.impressions += Number(row.impressions ?? 0);
      existing.clicks += Number(row.clicks ?? 0);
      existing.conversions += Number(row.conversions ?? 0);
      map.set(key, existing);
    }
    return map;
  }

  const campMap = accumulate(currRows);
  const prevCampMap = accumulate(prevRows);
  const campaignRows: MedibraneCampaignRow[] = Array.from(campMap.entries()).map(([key, current]) => {
    const previous = prevCampMap.get(key) ?? { ...current, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    return {
      campaignId: current.campaignId,
      campaign: current.campaign,
      channel: current.channel,
      currency: current.currency,
      spend: current.spend,
      prevSpend: previous.spend,
      impressions: current.impressions,
      prevImpressions: previous.impressions,
      clicks: current.clicks,
      prevClicks: previous.clicks,
      ctr: current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0,
      prevCtr: previous.impressions > 0 ? (previous.clicks / previous.impressions) * 100 : 0,
      conversions: current.conversions,
      prevConversions: previous.conversions,
      costPerLead: current.conversions > 0 ? current.spend / current.conversions : 0,
      prevCostPerLead: previous.conversions > 0 ? previous.spend / previous.conversions : 0,
    };
  });

  const totalSpend = pacingRows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const weeklyRows = (weeklyReadoutRes.data ?? []) as unknown as WeeklyReadoutRow[];
  const latestReadout = weeklyRows[0];
  const weeklyReadout: MedibraneWeeklyReadout | null = latestReadout
    ? {
        periodStart: latestReadout.period_start,
        periodEnd: latestReadout.period_end,
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
    channelRows,
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
