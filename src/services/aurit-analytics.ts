import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import {
  buildAuritAggregates,
  type AuritAggregates,
  type AuritCampaignDay,
  type AuritChannel,
  type AuritConversionDay,
} from '@/lib/aurit-metrics';

// Aurit Mediation (Scott Social client). Data: aurit_meta / aurit_google (campaign/day)
// and aurit_conversions (per conversion type), written by n8n workflows
// DSMl03VyH6GjDNS6 (Meta) and 1pq7rhDMsecy6f5s (Google). All values are USD.

export type AuritChannelFilter = 'all' | AuritChannel;

export type AuritFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: AuritChannelFilter;
};

export type AuritWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type AuritDashboardData = AuritAggregates & {
  filterParams: AuritFilterParams;
  lastSyncedDate: string | null;
  weeklyReadout: AuritWeeklyReadout | null;
};

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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

type Db = ReturnType<typeof createSpartacoSupabaseClient>;

type PerfRow = {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number | string | null;
  clicks: number | string | null;
  cost: number | string | null;
  campaign_type?: string | null;
};

type ConversionRow = {
  date: string;
  platform: AuritChannel;
  campaign_id: string;
  conversion_type: string;
  conversion_label: string;
  conversions: number | string | null;
};

const PAGE_SIZE = 1000;

// Supabase silently caps selects at 1,000 rows, so every read is paginated.
async function fetchAllPages<T>(label: string, page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch Aurit ${label}: ${error.message}`);
    const chunk = (data ?? []) as unknown as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchCampaignDays(db: Db, channel: AuritChannel, start: string, end: string): Promise<AuritCampaignDay[]> {
  const table = channel === 'Meta' ? 'aurit_meta' : 'aurit_google';
  const select = channel === 'Meta'
    ? 'date,campaign_id,campaign_name,impressions,clicks,cost'
    : 'date,campaign_id,campaign_name,campaign_type,impressions,clicks,cost';
  const rows = await fetchAllPages<PerfRow>(`${channel} rows`, (from, to) => db.from(table)
    .select(select)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .order('campaign_id', { ascending: true })
    .range(from, to));
  return rows.map(row => ({
    date: row.date,
    channel,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    campaignType: row.campaign_type ?? null,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    cost: Number(row.cost ?? 0),
  }));
}

async function fetchConversions(db: Db, channels: AuritChannel[], start: string, end: string): Promise<AuritConversionDay[]> {
  const rows = await fetchAllPages<ConversionRow>('conversions', (from, to) => db.from('aurit_conversions')
    .select('date,platform,campaign_id,conversion_type,conversion_label,conversions')
    .in('platform', channels)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to));
  return rows.map(row => ({
    date: row.date,
    channel: row.platform,
    campaignId: row.campaign_id,
    conversionType: row.conversion_type,
    conversionLabel: row.conversion_label,
    conversions: Number(row.conversions ?? 0),
  }));
}

async function fetchPeriod(db: Db, channels: AuritChannel[], start: string, end: string) {
  const [days, conversions] = await Promise.all([
    Promise.all(channels.map(channel => fetchCampaignDays(db, channel, start, end))).then(parts => parts.flat()),
    fetchConversions(db, channels, start, end),
  ]);
  return { days, conversions };
}

export function auritParamsFromSearch(p: Record<string, string | undefined>): AuritFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  const channel: AuritChannelFilter = p.channel === 'Meta' || p.channel === 'Google' ? p.channel : 'all';
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
    channel,
  };
}

export async function fetchAuritDashboardData(params: AuritFilterParams): Promise<AuritDashboardData> {
  const db = createSpartacoSupabaseClient();
  const channels: AuritChannel[] = params.channel === 'all' ? ['Meta', 'Google'] : [params.channel];

  const [current, previous, lastMeta, lastGoogle, weeklyReadoutRes] = await Promise.all([
    fetchPeriod(db, channels, params.start, params.end),
    fetchPeriod(db, channels, params.compStart, params.compEnd),
    db.from('aurit_meta').select('date').order('date', { ascending: false }).limit(1),
    db.from('aurit_google').select('date').order('date', { ascending: false }).limit(1),
    db.from('aurit_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .eq('status', 'published')
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);
  if (weeklyReadoutRes.error) throw new Error(`Failed to fetch Aurit weekly readout: ${weeklyReadoutRes.error.message}`);
  const latestReadout = ((weeklyReadoutRes.data ?? []) as unknown as WeeklyReadoutRow[])[0];
  const weeklyReadout: AuritWeeklyReadout | null = latestReadout
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

  const latestDates = [lastMeta.data, lastGoogle.data]
    .flatMap(rows => ((rows ?? []) as unknown as { date: string }[]).map(row => row.date));
  const lastSyncedDate = latestDates.length ? latestDates.sort().at(-1)! : null;

  const aggregates = buildAuritAggregates({
    current: current.days,
    previous: previous.days,
    currentConversions: current.conversions,
    previousConversions: previous.conversions,
  });

  return {
    ...aggregates,
    channelRows: aggregates.channelRows.filter(row => channels.includes(row.channel)),
    filterParams: params,
    lastSyncedDate,
    weeklyReadout,
  };
}
