import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

const H1_START = '2026-01-01';
const H1_END = '2026-06-30';
const H1_COMP_START = '2025-01-01';
const H1_COMP_END = '2025-06-30';

const FAMILY_DEFS = [
  {
    key: 'BPT',
    label: 'Bridgeport / BPT',
    shortLabel: 'BPT',
    campaigns: ['CCF-CON-BPT2'],
    story: 'Bridgeport remained the largest tracked revenue family and continued expanding at scale.',
  },
  {
    key: 'POL',
    label: 'Polaris Overall',
    shortLabel: 'Polaris',
    campaigns: ['CON-CON-POL2', 'CON-CON-CMP'],
    story: 'Polaris combines the broader POL2 family with the focused CMP compression campaign.',
  },
  {
    key: 'CMP',
    label: 'Compression / CMP',
    shortLabel: 'Compression',
    campaigns: ['CON-CON-CMP'],
    story: 'Compression is the data-center-aligned growth lane to keep unblocked and accelerate.',
    spotlight: true,
  },
] as const;

type MetricRow = {
  date: string;
  cost: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  conversions: number | string | null;
  sessions: number | string | null;
  engaged_sessions: number | string | null;
  total_users: number | string | null;
};

type RevenueRow = {
  month_start: string;
  campaign: string;
  revenue: number | string | null;
};

export type H1MetricSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  sessions: number;
  engagedSessions: number;
  users: number;
  submittals: number;
  ctr: number;
  cpc: number;
  engagementRate: number;
  costPerEngagedSession: number;
  costPerSubmittal: number;
};

export type H1RevenueFamily = {
  key: string;
  label: string;
  shortLabel: string;
  story: string;
  spotlight: boolean;
  current: number;
  previous: number;
  change: number;
  changePct: number | null;
  shareOfTrackedRevenue: number;
};

export type H1Readout = {
  id: string;
  generatedAt: string;
  overallStory: string;
  channelInsights: Record<string, string>;
  familyInsights: Record<string, string>;
  accomplishments: string[];
  focusNextHalf: string[];
  executionContext: string[];
};

export type NsiH1RecapData = {
  period: { start: string; end: string; label: string };
  comparison: { start: string; end: string; label: string };
  metrics: H1MetricSummary;
  prevMetrics: H1MetricSummary;
  trackedRevenue: number;
  prevTrackedRevenue: number;
  trackedRevenueChangePct: number | null;
  revenueFamilies: H1RevenueFamily[];
  readout: H1Readout | null;
};

const PAGE_SIZE = 1000;

async function fetchPaged<T>(build: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function num(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function summarizeMetrics(rows: MetricRow[]): H1MetricSummary {
  const base = rows.reduce(
    (acc, row) => {
      acc.spend += num(row.cost);
      acc.impressions += num(row.impressions);
      acc.clicks += num(row.clicks);
      acc.sessions += num(row.sessions);
      acc.engagedSessions += num(row.engaged_sessions);
      acc.users += num(row.total_users);
      acc.submittals += num(row.conversions);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, sessions: 0, engagedSessions: 0, users: 0, submittals: 0 }
  );

  return {
    ...base,
    ctr: base.impressions ? (base.clicks / base.impressions) * 100 : 0,
    cpc: base.clicks ? base.spend / base.clicks : 0,
    engagementRate: base.sessions ? (base.engagedSessions / base.sessions) * 100 : 0,
    costPerEngagedSession: base.engagedSessions ? base.spend / base.engagedSessions : 0,
    costPerSubmittal: base.submittals ? base.spend / base.submittals : 0,
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
    } catch {
      return trimmed.split('\n').map((item) => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    }
  }
  return [];
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, typeof val === 'string' ? val : String(val ?? '')] as const)
      .filter(([key, val]) => key.trim() && val.trim())
  );
}

function buildRevenueFamilies(rows: RevenueRow[], prevRows: RevenueRow[]): { families: H1RevenueFamily[]; total: number; prevTotal: number } {
  const revenueFor = (sourceRows: RevenueRow[], campaigns: readonly string[]) =>
    sourceRows
      .filter((row) => campaigns.includes(row.campaign))
      .reduce((sum, row) => sum + num(row.revenue), 0);

  const allCampaigns = Array.from(new Set(FAMILY_DEFS.flatMap((family) => [...family.campaigns])));
  const total = revenueFor(rows, allCampaigns);
  const prevTotal = revenueFor(prevRows, allCampaigns);

  return {
    total,
    prevTotal,
    families: FAMILY_DEFS.map((family) => {
      const current = revenueFor(rows, family.campaigns);
      const previous = revenueFor(prevRows, family.campaigns);
      return {
        key: family.key,
        label: family.label,
        shortLabel: family.shortLabel,
        story: family.story,
        spotlight: Boolean('spotlight' in family && family.spotlight),
        current,
        previous,
        change: current - previous,
        changePct: pctChange(current, previous),
        shareOfTrackedRevenue: total ? (current / total) * 100 : 0,
      };
    }),
  };
}

export async function fetchNsiH1RecapData(): Promise<NsiH1RecapData> {
  const supabase = createSpartacoSupabaseClient();
  const allCampaigns = Array.from(new Set(FAMILY_DEFS.flatMap((family) => [...family.campaigns])));

  const fetchMetrics = (start: string, end: string) =>
    fetchPaged<MetricRow>(async (from, to) =>
      supabase
        .from('nsi_master_campaign_daily')
        .select('date,cost,impressions,clicks,conversions,sessions,engaged_sessions,total_users')
        .gte('date', start)
        .lte('date', end)
        .range(from, to)
    );

  const fetchRevenue = (start: string, end: string) =>
    supabase
      .from('nsi_revenue')
      .select('month_start,campaign,revenue')
      .in('campaign', allCampaigns)
      .gte('month_start', start.slice(0, 7) + '-01')
      .lte('month_start', end.slice(0, 7) + '-01')
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as RevenueRow[];
      });

  const [metricsRows, prevMetricRows, revenueRows, prevRevenueRows, readoutRow] = await Promise.all([
    fetchMetrics(H1_START, H1_END),
    fetchMetrics(H1_COMP_START, H1_COMP_END),
    fetchRevenue(H1_START, H1_END),
    fetchRevenue(H1_COMP_START, H1_COMP_END),
    supabase
      .from('nsi_monthly_readout')
      .select('id,created_at,overall_story,channel_insights,sub_campaign_insights,accomplishments,focus_next_month,execution_context')
      .eq('month_start', H1_START)
      .eq('month_end', H1_END)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data),
  ]);

  const revenue = buildRevenueFamilies(revenueRows, prevRevenueRows);

  const readout = readoutRow
    ? {
        id: String(readoutRow.id),
        generatedAt: String(readoutRow.created_at),
        overallStory: typeof readoutRow.overall_story === 'string' ? readoutRow.overall_story : '',
        channelInsights: parseStringRecord(readoutRow.channel_insights),
        familyInsights: parseStringRecord(readoutRow.sub_campaign_insights),
        accomplishments: parseStringArray(readoutRow.accomplishments),
        focusNextHalf: parseStringArray(readoutRow.focus_next_month),
        executionContext: parseStringArray(readoutRow.execution_context),
      }
    : null;

  return {
    period: { start: H1_START, end: H1_END, label: 'Jan 1 – Jun 30, 2026' },
    comparison: { start: H1_COMP_START, end: H1_COMP_END, label: 'Jan 1 – Jun 30, 2025' },
    metrics: summarizeMetrics(metricsRows),
    prevMetrics: summarizeMetrics(prevMetricRows),
    trackedRevenue: revenue.total,
    prevTrackedRevenue: revenue.prevTotal,
    trackedRevenueChangePct: pctChange(revenue.total, revenue.prevTotal),
    revenueFamilies: revenue.families,
    readout,
  };
}

export const NSI_H1_RECAP_RANGE = {
  start: H1_START,
  end: H1_END,
  compStart: H1_COMP_START,
  compEnd: H1_COMP_END,
};
