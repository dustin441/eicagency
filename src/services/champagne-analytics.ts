import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import {
  CHAMPAGNE_SCOPE_CONFIG,
  champagneCampaignMatchesScope,
  champagneClicksForScope,
  type ChampagneCampaignScope,
} from '@/lib/champagne-campaign-scope';

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
  avgCpc: number;
  conversions: number;
  costPerLead: number;
};

export type ChampagneTimePoint = {
  label: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
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
  avgCpc: number;
  prevAvgCpc: number;
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
  avgCpc: number;
  prevAvgCpc: number;
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
  scope: ChampagneCampaignScope;
  title: string;
  subtitle: string;
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
  link_clicks: number | null;
  cost: number | null;
  conversions: number | null;
};

type BudgetRow = { budget: number };

const GOOGLE_ROW_SELECT = 'date,campaign_name,ad_channel,impressions,clicks,cost,conversions';
const META_ROW_SELECT = `${GOOGLE_ROW_SELECT},link_clicks`;

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
    avgCpc: clicks > 0 ? spend / clicks : 0,
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
      .select(table === 'champagne_meta' ? META_ROW_SELECT : GOOGLE_ROW_SELECT)
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

function scopeRows(rows: ChampagneRow[], scope: ChampagneCampaignScope): ChampagneRow[] {
  return rows
    .filter(row => champagneCampaignMatchesScope(row.campaign_name, scope))
    .map(row => ({
      ...row,
      clicks: champagneClicksForScope({
        scope,
        channel: normalizeChannel(row.ad_channel),
        clicks: row.clicks,
        linkClicks: row.link_clicks,
      }),
      conversions: scope === 'halloween' ? 0 : row.conversions,
    }));
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

export async function fetchChampagneDashboardData(
  params: ChampagneFilterParams,
  scope: ChampagneCampaignScope = 'events',
): Promise<ChampagneDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;
  const scopeConfig = CHAMPAGNE_SCOPE_CONFIG[scope];

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [unscopedCurrRows, unscopedPrevRows, budgetRes, legacyBudgetRes, pacingGoogleRes, pacingMetaRes] = await Promise.all([
    fetchBlendedRows(db, start, end),
    fetchBlendedRows(db, compStart, compEnd),
    db.from('budgets')
      .select('budget')
      .eq('client', scopeConfig.budgetClient)
      .order('period_start', { ascending: false })
      .limit(1),
    scope === 'events'
      ? db.from('budgets')
          .select('budget')
          .ilike('client', 'champagne')
          .order('period_start', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] as BudgetRow[] }),
    db.from('champagne_google')
      .select('campaign_name,cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('champagne_meta')
      .select('campaign_name,cost')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const legacyBudgetRows = (legacyBudgetRes.data ?? []) as unknown as BudgetRow[];
  const pacingGoogleRows = (pacingGoogleRes.data ?? []) as unknown as ChampagneRow[];
  const pacingMetaRows = (pacingMetaRes.data ?? []) as unknown as ChampagneRow[];
  const allCurrRows = scopeRows(unscopedCurrRows, scope);
  const allPrevRows = scopeRows(unscopedPrevRows, scope);

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
    .map(([label, d]) => ({
      label,
      ...d,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      avgCpc: d.clicks > 0 ? d.spend / d.clicks : 0,
      costPerLead: d.conversions > 0 ? d.spend / d.conversions : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown (Google vs Meta) — always both channels, independent of the filter above
  const channelRows: ChampagneChannelRow[] = ['Meta', 'Google'].map(ch => {
    const curr = allCurrRows.filter(r => normalizeChannel(r.ad_channel) === ch);
    const prev = allPrevRows.filter(r => normalizeChannel(r.ad_channel) === ch);
    const currSpend = curr.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const prevSpend = prev.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const currClicks = curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
    const prevClicks = prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
    const currConversions = curr.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
    const prevConversions = prev.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
    return {
      channel: ch,
      spend: currSpend,
      prevSpend,
      impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      clicks: currClicks,
      prevClicks,
      avgCpc: currClicks > 0 ? currSpend / currClicks : 0,
      prevAvgCpc: prevClicks > 0 ? prevSpend / prevClicks : 0,
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
        avgCpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        prevAvgCpc: p.clicks > 0 ? p.spend / p.clicks : 0,
        costPerLead: c.conversions > 0 ? c.spend / c.conversions : 0,
        prevCostPerLead: p.conversions > 0 ? p.spend / p.conversions : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  const totalSpend =
    pacingGoogleRows
      .filter(row => champagneCampaignMatchesScope(row.campaign_name, scope))
      .reduce((s, r) => s + Number(r.cost ?? 0), 0) +
    pacingMetaRows
      .filter(row => champagneCampaignMatchesScope(row.campaign_name, scope))
      .reduce((s, r) => s + Number(r.cost ?? 0), 0);

  return {
    scope,
    title: scopeConfig.title,
    subtitle: scopeConfig.subtitle,
    filterParams: params,
    summary,
    prevSummary,
    timeSeries,
    channelRows,
    campaignRows,
    budgetPacing: {
      budget: budgetRows[0]
        ? Number(budgetRows[0].budget)
        : legacyBudgetRows[0]
          ? Number(legacyBudgetRows[0].budget)
          : null,
      totalSpend,
      monthStart,
      monthEnd,
    },
    // The published weekly readout is account-wide and currently mixes the
    // Halloween flight with always-on lead generation. Suppress it on both
    // scoped pages until the source carries a campaign scope.
    weeklyReadout: null,
  };
}
