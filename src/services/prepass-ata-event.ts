import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  ATA_BUDGET_MONTH_END,
  ATA_BUDGET_MONTH_LABEL,
  ATA_BUDGET_MONTH_START,
  ATA_EVENT_CAMPAIGN_PREFIX,
  ATA_GOOGLE_CAMPAIGNS,
} from '@/lib/prepass-ata-scope';

export type AtaFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel?: string;
  focus?: string;
};

const PAGE_SIZE = 1000;

type Platform = 'Google' | 'Meta' | 'LinkedIn';

type EventRow = {
  date: string;
  platform: Platform;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type OutcomeRow = {
  date: string;
  platform: string;
  campaign_name: string;
  mqls: number | string | null;
  sqls: number | string | null;
  closed_won: number | string | null;
};

export type AtaCampaignPerformance = {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  channel: string;
  status: string;
  dataAvailable: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type AtaDailyPerformance = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type AtaEventDashboardData = {
  filterParams: AtaFilterParams;
  budget: number;
  budgetMonth: string;
  budgetCutoff: string;
  daysInMonth: number;
  completedDays: number;
  remainingDays: number;
  expectedSpend: number;
  monthlySpend: number;
  remainingBudget: number;
  dailyNeeded: number;
  sourceLatestDate: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalMqls: number;
  totalSqls: number;
  totalWon: number;
  previousSpend: number;
  previousImpressions: number;
  previousClicks: number;
  previousConversions: number;
  platformSpend: Record<Platform, number>;
  campaigns: AtaCampaignPerformance[];
  daily: AtaDailyPerformance[];
};

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateWindow(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const eventStart = new Date(`${ATA_BUDGET_MONTH_START}T00:00:00.000Z`);
  const eventEnd = new Date(`${ATA_BUDGET_MONTH_END}T00:00:00.000Z`);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const cutoff = yesterday < eventStart ? new Date(eventStart) : yesterday > eventEnd ? new Date(eventEnd) : yesterday;
  const daysInMonth = eventEnd.getUTCDate();
  const completedDays = yesterday < eventStart ? 0 : Math.min(daysInMonth, cutoff.getUTCDate());
  return {
    monthStart: ATA_BUDGET_MONTH_START,
    monthEnd: ATA_BUDGET_MONTH_END,
    cutoff: isoDate(cutoff),
    completedDays,
    daysInMonth,
    remainingDays: Math.max(0, daysInMonth - completedDays),
    monthLabel: ATA_BUDGET_MONTH_LABEL,
  };
}

async function fetchPaged<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 100_000; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || 'Unable to load ATA event performance data');
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error('ATA event performance pagination limit exceeded');
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function outcomeMatchesPlatform(platform: string, selectedPlatform: string | null): boolean {
  if (!selectedPlatform) return true;
  const normalized = platform.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (selectedPlatform === 'Google') return normalized === 'google';
  if (selectedPlatform === 'LinkedIn') return normalized === 'linkedin';
  return ['meta', 'fb', 'facebook', 'ig', 'instagram'].includes(normalized);
}

function sumRows(rows: EventRow[]) {
  return rows.reduce((totals, row) => ({
    spend: totals.spend + row.spend,
    impressions: totals.impressions + row.impressions,
    clicks: totals.clicks + row.clicks,
    conversions: totals.conversions + row.conversions,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
}

export function buildAtaEventDashboardData({
  rows,
  outcomes,
  budget,
  params,
  now = new Date(),
}: {
  rows: EventRow[];
  outcomes: OutcomeRow[];
  budget: number;
  params: AtaFilterParams;
  now?: Date;
}): AtaEventDashboardData {
  const window = dateWindow(now);
  const requestedChannel = params.channel && params.channel !== 'all' ? params.channel : null;
  const selectedPlatform: Platform | null = requestedChannel && ['Google', 'Meta', 'LinkedIn'].includes(requestedChannel)
    ? requestedChannel as Platform
    : null;
  const matchesPlatform = (row: EventRow) => !selectedPlatform || row.platform === selectedPlatform;
  const currentRows = rows.filter(row => inRange(row.date, params.start, params.end) && matchesPlatform(row));
  const previousRows = rows.filter(row => inRange(row.date, params.compStart, params.compEnd) && matchesPlatform(row));
  const monthlyRows = rows.filter(row => inRange(row.date, window.monthStart, window.cutoff));
  const current = sumRows(currentRows);
  const previous = sumRows(previousRows);
  const monthlySpend = sumRows(monthlyRows).spend;
  const expectedSpend = budget * (window.completedDays / window.daysInMonth);
  const remainingBudget = budget - monthlySpend;
  const dailyNeeded = window.remainingDays > 0 ? Math.max(0, remainingBudget) / window.remainingDays : 0;

  const campaignMap = new Map<string, AtaCampaignPerformance>();
  for (const row of currentRows) {
    const key = `${row.platform}:${row.campaignId}`;
    const existing = campaignMap.get(key) ?? {
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      platform: row.platform,
      channel: row.campaignName.split('|').at(-1)?.trim() || row.platform,
      status: row.status,
      dataAvailable: true,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    };
    existing.spend += row.spend;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.conversions += row.conversions;
    existing.status = row.status || existing.status;
    campaignMap.set(key, existing);
  }
  for (const expected of ATA_GOOGLE_CAMPAIGNS) {
    const key = `Google:${expected.id}`;
    if (!campaignMap.has(key) && (!selectedPlatform || selectedPlatform === 'Google')) {
      campaignMap.set(key, {
        campaignId: expected.id,
        campaignName: expected.name,
        platform: 'Google',
        channel: expected.channel,
        status: 'No period data',
        dataAvailable: false,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      });
    }
  }

  const dailyMap = new Map<string, AtaDailyPerformance>();
  for (const row of currentRows) {
    const daily = dailyMap.get(row.date) ?? { date: row.date, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    daily.spend += row.spend;
    daily.impressions += row.impressions;
    daily.clicks += row.clicks;
    daily.conversions += row.conversions;
    dailyMap.set(row.date, daily);
  }

  const outcomeRows = outcomes.filter(row =>
    inRange(row.date, params.start, params.end)
    && outcomeMatchesPlatform(row.platform, selectedPlatform)
  );
  const platformSpend: Record<Platform, number> = { Google: 0, Meta: 0, LinkedIn: 0 };
  for (const row of monthlyRows) platformSpend[row.platform] += row.spend;

  return {
    filterParams: params,
    budget,
    budgetMonth: window.monthLabel,
    budgetCutoff: window.cutoff,
    daysInMonth: window.daysInMonth,
    completedDays: window.completedDays,
    remainingDays: window.remainingDays,
    expectedSpend,
    monthlySpend,
    remainingBudget,
    dailyNeeded,
    sourceLatestDate: currentRows.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null),
    totalSpend: current.spend,
    totalImpressions: current.impressions,
    totalClicks: current.clicks,
    totalConversions: current.conversions,
    totalMqls: outcomeRows.reduce((sum, row) => sum + number(row.mqls), 0),
    totalSqls: outcomeRows.reduce((sum, row) => sum + number(row.sqls), 0),
    totalWon: outcomeRows.reduce((sum, row) => sum + number(row.closed_won), 0),
    previousSpend: previous.spend,
    previousImpressions: previous.impressions,
    previousClicks: previous.clicks,
    previousConversions: previous.conversions,
    platformSpend,
    campaigns: [...campaignMap.values()].sort((a, b) => b.spend - a.spend || a.campaignName.localeCompare(b.campaignName)),
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function fetchAtaEventData(params: AtaFilterParams): Promise<AtaEventDashboardData> {
  const db = createServerSupabaseClient();
  const window = dateWindow();
  const queryStart = [params.start, params.compStart, window.monthStart].sort()[0];
  const queryEnd = [params.end, params.compEnd, window.cutoff].sort().at(-1)!;
  const googleIds = ATA_GOOGLE_CAMPAIGNS.map(campaign => campaign.id);

  const [budgetResponse, googleRows, metaRows, linkedinRows, outcomes] = await Promise.all([
    db.from('budgets').select('budget').eq('client', 'ATA').single(),
    fetchPaged<Record<string, unknown>>(async (from, to) => {
      const response = await db.from('google_campaigns')
        .select('date,campaign_id,campaign_name,campaign_status,cost,impressions,clicks,conversions')
        .in('campaign_id', googleIds)
        .gte('date', queryStart).lte('date', queryEnd)
        .order('date', { ascending: true }).order('campaign_id', { ascending: true }).range(from, to);
      return { data: response.data as Record<string, unknown>[] | null, error: response.error };
    }),
    fetchPaged<Record<string, unknown>>(async (from, to) => {
      const response = await db.from('meta_campaigns')
        .select('id,date,campaign_id,campaign_name,status,spend,impressions,clicks,leads')
        .like('campaign_name', `${ATA_EVENT_CAMPAIGN_PREFIX}%`)
        .gte('date', queryStart).lte('date', queryEnd)
        .order('date', { ascending: true }).order('campaign_id', { ascending: true }).order('id', { ascending: true }).range(from, to);
      return { data: response.data as Record<string, unknown>[] | null, error: response.error };
    }),
    fetchPaged<Record<string, unknown>>(async (from, to) => {
      const response = await db.from('linkedin_campaign_data')
        .select('id,date,campaign_id,campaign_name,status,spend,impressions,clicks,leads')
        .like('campaign_name', `${ATA_EVENT_CAMPAIGN_PREFIX}%`)
        .gte('date', queryStart).lte('date', queryEnd)
        .order('date', { ascending: true }).order('campaign_id', { ascending: true }).order('id', { ascending: true }).range(from, to);
      return { data: response.data as Record<string, unknown>[] | null, error: response.error };
    }),
    fetchPaged<OutcomeRow>(async (from, to) => {
      const response = await db.from('master_marketing_performance')
        .select('date,platform,campaign_name,mqls,sqls,closed_won')
        .like('campaign_name', `${ATA_EVENT_CAMPAIGN_PREFIX}%`)
        .gte('date', params.start).lte('date', params.end)
        .order('date', { ascending: true }).order('campaign_name', { ascending: true }).order('platform', { ascending: true }).range(from, to);
      return { data: response.data as OutcomeRow[] | null, error: response.error };
    }),
  ]);

  if (budgetResponse.error || !budgetResponse.data) {
    throw new Error(budgetResponse.error?.message || 'ATA event budget is not configured');
  }

  const rows: EventRow[] = [
    ...googleRows.map(row => ({
      date: String(row.date), platform: 'Google' as const, campaignId: String(row.campaign_id),
      campaignName: String(row.campaign_name), status: String(row.campaign_status ?? ''),
      spend: number(row.cost), impressions: number(row.impressions), clicks: number(row.clicks), conversions: number(row.conversions),
    })),
    ...metaRows.map(row => ({
      date: String(row.date), platform: 'Meta' as const, campaignId: String(row.campaign_id),
      campaignName: String(row.campaign_name), status: String(row.status ?? ''),
      spend: number(row.spend), impressions: number(row.impressions), clicks: number(row.clicks), conversions: number(row.leads),
    })),
    ...linkedinRows.map(row => ({
      date: String(row.date), platform: 'LinkedIn' as const, campaignId: String(row.campaign_id),
      campaignName: String(row.campaign_name), status: String(row.status ?? ''),
      spend: number(row.spend), impressions: number(row.impressions), clicks: number(row.clicks), conversions: number(row.leads),
    })),
  ];

  return buildAtaEventDashboardData({ rows, outcomes, budget: number(budgetResponse.data.budget), params });
}
