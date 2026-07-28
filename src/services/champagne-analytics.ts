import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

// Champagne House is a Google + Meta client (same blended-channel model as
// Kinsey: two separate ad-level tables — `champagne_google` and
// `champagne_meta` — summed together in JS rather than a unified DB view).
//
// Unlike Kinsey/State48 (ecommerce, purchases/revenue/ROAS), Champagne House
// tracks lead conversions — the conversion model here is conversions /
// cost-per-lead, same as the Duro Dyne Google leads model. Both
// `champagne_google` and `champagne_meta` already store the same
// `conversions` column name, so no purchases/conversions reconciliation is
// needed (Kinsey's `rowPurchases()` helper has no equivalent here).

export type ChampagneFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Google' | 'Meta' — matches FilterBar's default channel options
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

export type ChampagneChannelRow = {
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

export type ChampagneCampaignRow = {
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
  channelRows: ChampagneChannelRow[];
  campaignRows: ChampagneCampaignRow[];
  budgetPacing: ChampagneBudgetPacing;
  weeklyReadout: ChampagneWeeklyReadout | null;
};

type ChampagneRow = {
  date: string;
  campaign_name: string;
  ad_channel: string | null;
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

const ROW_SELECT = 'date,campaign_name,ad_channel,impressions,clicks,cost,conversions';

// `champagne_google` tags PMax campaigns as ad_channel='Google Pmax' — fold
// that into 'Google' for channel-level grouping (Meta vs Google), same as
// Kinsey groups only on ['Meta','Google'].
function normalizeChannel(ad_channel: string | null): string {
  return ad_channel && ad_channel.startsWith('Google') ? 'Google' : (ad_channel || 'Google');
}

function summarise(rows: ChampagneRow[]): ChampagneSummary {
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
  table: 'champagne_google' | 'champagne_meta',
  start: string,
  end: string
): Promise<ChampagneRow[]> {
  const rows: ChampagneRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table)
      .select(ROW_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return rows;

    const page = (data ?? []) as unknown as ChampagneRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchBlendedRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<ChampagneRow[]> {
  const [google, meta] = await Promise.all([
    fetchPagedRows(db, 'champagne_google', start, end),
    fetchPagedRows(db, 'champagne_meta', start, end),
  ]);
  return [...google, ...meta.map(r => ({ ...r, ad_channel: r.ad_channel || 'Meta' }))];
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
    channel: p.channel ?? 'all',
  };
}

export async function fetchChampagneDashboardData(params: ChampagneFilterParams): Promise<ChampagneDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [allCurrRows, allPrevRows, budgetRes, pacingGoogleRes, pacingMetaRes, readoutRes] = await Promise.all([
    fetchBlendedRows(db, start, end),
    fetchBlendedRows(db, compStart, compEnd),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'champagne')
      .order('period_start', { ascending: false })
      .limit(1),
    db.from('champagne_google')
      .select('cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('champagne_meta')
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
  const pacingGoogleRows = (pacingGoogleRes.data ?? []) as unknown as { cost: number }[];
  const pacingMetaRows = (pacingMetaRes.data ?? []) as unknown as { cost: number }[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  // Summary/time-series/campaign table respect the selected channel filter;
  // the Channel Breakdown table always compares both channels regardless of
  // the filter (so switching to "Meta" doesn't hide the Google row entirely).
  const currRows = channel === 'all' ? allCurrRows : allCurrRows.filter(r => normalizeChannel(r.ad_channel) === channel);
  const prevRows = channel === 'all' ? allPrevRows : allPrevRows.filter(r => normalizeChannel(r.ad_channel) === channel);

  const summary = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date (blended across channels)
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

  // Channel breakdown (Google vs Meta) — always both channels, independent of the filter above
  const channelRows: ChampagneChannelRow[] = ['Meta', 'Google'].map(ch => {
    const curr = allCurrRows.filter(r => normalizeChannel(r.ad_channel) === ch);
    const prev = allPrevRows.filter(r => normalizeChannel(r.ad_channel) === ch);
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

  // Campaign rows — current + prev, keyed by campaign name + channel
  type CampAccum = { campaign: string; channel: string; spend: number; impressions: number; clicks: number; conversions: number };
  function accumulate(rows: ChampagneRow[]): Map<string, CampAccum> {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const channel = normalizeChannel(r.ad_channel);
      const key = `${r.campaign_name}__${channel}`;
      const e = map.get(key) ?? { campaign: r.campaign_name, channel, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
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
  const campaignRows: ChampagneCampaignRow[] = Array.from(campMap.entries())
    .map(([key, c]) => {
      const p = prevCampMap.get(key) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 } as CampAccum;
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

  const totalSpend =
    pacingGoogleRows.reduce((s, r) => s + Number(r.cost ?? 0), 0) +
    pacingMetaRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);

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
