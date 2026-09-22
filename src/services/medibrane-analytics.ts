import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

// Medibrane currently reports Meta Ads only. Its business objective is lead
// generation, so the primary outcome is Meta lead actions and the efficiency
// metric is cost per lead. Currency is ILS, matching the ad account.

export type MedibraneFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type MedibraneSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerLead: number;
};

export type MedibraneTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  costPerLead: number;
};

export type MedibraneChannelRow = {
  channel: string;
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
};

export type MedibraneCampaignRow = {
  campaignId: string;
  campaign: string;
  channel: string;
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
  ad_channel: string | null;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
};

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

const ROW_SELECT = 'date,campaign_id,campaign_name,ad_channel,impressions,clicks,cost,conversions';

function normalizeChannel(ad_channel: string | null): string {
  return ad_channel || 'Meta';
}

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
  table: 'medibrane_meta',
  start: string,
  end: string
): Promise<MedibraneRow[]> {
  const rows: MedibraneRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table)
      .select(ROW_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('campaign_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch MediBraine Meta rows: ${error.message}`);

    const page = (data ?? []) as unknown as MedibraneRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchMetaRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<MedibraneRow[]> {
  const rows = await fetchPagedRows(db, 'medibrane_meta', start, end);
  return rows.map(row => ({ ...row, ad_channel: 'Meta' }));
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
    fetchMetaRows(db, start, end),
    fetchMetaRows(db, compStart, compEnd),
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

  // Time series — group the Meta campaign rows by reporting date.
  const dateMap = new Map<string, { spend: number; conversions: number; impressions: number; clicks: number }>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.conversions += Number(r.conversions ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, existing);
  }
  const timeSeries: MedibraneTimePoint[] = Array.from(dateMap.entries())
    .map(([label, d]) => ({ label, ...d, costPerLead: d.conversions > 0 ? d.spend / d.conversions : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Preserve the reference dashboard's channel breakdown with one Meta row.
  const channelRows: MedibraneChannelRow[] = ['Meta'].map(ch => {
    const curr = currRows;
    const prev = prevRows;
    const currSpend = curr.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const prevSpend = prev.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const currConversions = curr.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
    const prevConversions = prev.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
    return {
      channel: ch,
      spend: currSpend,
      prevSpend,
      impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      clicks: curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      conversions: currConversions,
      prevConversions,
      costPerLead: currConversions > 0 ? currSpend / currConversions : 0,
      prevCostPerLead: prevConversions > 0 ? prevSpend / prevConversions : 0,
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign rows — current + prev, keyed by immutable campaign ID + channel.
  type CampAccum = { campaignId: string; campaign: string; channel: string; spend: number; impressions: number; clicks: number; conversions: number };
  function accumulate(rows: MedibraneRow[]): Map<string, CampAccum> {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const channel = normalizeChannel(r.ad_channel);
      const key = `${r.campaign_id}__${channel}`;
      const e = map.get(key) ?? { campaignId: r.campaign_id, campaign: r.campaign_name, channel, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      // Rows are ordered by date, so this keeps the latest name after a rename
      // while comparisons continue to use the immutable campaign ID.
      e.campaign = r.campaign_name;
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
  const campaignRows: MedibraneCampaignRow[] = Array.from(campMap.entries())
    .map(([key, c]) => {
      const p = prevCampMap.get(key) ?? { campaignId: c.campaignId, campaign: c.campaign, channel: c.channel, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      return {
        campaignId: c.campaignId,
        campaign: c.campaign,
        channel: c.channel,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
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
