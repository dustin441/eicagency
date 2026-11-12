import type { MetaCreative } from '@/services/analytics';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, snapToMonthStart, today } from '@/lib/date-utils';
import { mapAuritMonthlyBudget, type AuritBudgetRow, type AuritMonthlyBudget } from '@/lib/aurit-budgets';
import { buildAuritPacing, type AuritPacing, type AuritPacingDay } from '@/lib/aurit-pacing';
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
  metaCreatives: MetaCreative[];
  monthlyBudget: AuritMonthlyBudget;
  pacing: AuritPacing;
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

async function fetchPacingDays(db: Db, channel: AuritChannel, start: string, todayDate: string): Promise<AuritPacingDay[]> {
  const table = channel === 'Meta' ? 'aurit_meta' : 'aurit_google';
  const rows = await fetchAllPages<Pick<PerfRow, 'date' | 'cost' | 'campaign_type'>>(`${channel} pacing`, (from, to) => {
    let query = db.from(table)
      .select(channel === 'Meta' ? 'date,cost' : 'date,cost,campaign_type')
      .gte('date', start).lt('date', todayDate)
      .order('date', { ascending: true }).order('campaign_id', { ascending: true });
    if (channel === 'Google') query = query.eq('campaign_type', 'VIDEO');
    return query.range(from, to);
  });
  return rows.map(row => {
    if (row.cost === null || String(row.cost).trim() === '' || !Number.isFinite(Number(row.cost))) {
      throw new Error('Invalid Aurit pacing spend');
    }
    return { date: row.date, channel, cost: Number(row.cost), campaignType: row.campaign_type ?? null };
  });
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

// Performance is one row per ad ID, not the concept identity rollup used by Ad Analysis.
async function fetchPerformanceCreatives(db: Db, params: AuritFilterParams): Promise<MetaCreative[]> {
  if (params.channel === 'Google') return [];
  type CreativeRow = {
    ad_id: string; ad_name: string | null; campaign_name: string | null; adset_name: string | null;
    spend: number | string | null; leads: number | string | null;
    clicks: number | string | null; impressions: number | string | null;
    final_creative_link: string | null; permanent_image_url: string | null;
    primary_text: string | null; headline: string | null; destination_url: string | null;
    cta_type: string | null; is_video: boolean | null; video_id: string | null; video_url: string | null;
  };
  const rows = await fetchAllPages<CreativeRow>('performance creatives', (from, to) => db.from('aurit_meta_ads_creatives')
    .select('date,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,leads,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url')
    .gte('date', params.start).lte('date', params.end)
    .order('date', { ascending: true }).order('ad_id', { ascending: true }).range(from, to));
  const ads = new Map<string, MetaCreative>();
  for (const row of rows) {
    const ad = ads.get(row.ad_id) ?? {
      adId: row.ad_id, name: row.ad_id, campaign: '', adset: '', headline: '', primaryText: '',
      finalCreativeLink: '', permanentImageUrl: '', destinationUrl: '', ctaType: '',
      isVideo: false, videoId: '', videoUrl: '', previewUrl: `https://www.facebook.com/ads/library/?id=${row.ad_id}`,
      spend: 0, leads: 0, clicks: 0, impressions: 0,
    };
    ad.spend += Number(row.spend ?? 0);
    ad.leads += Number(row.leads ?? 0);
    ad.clicks += Number(row.clicks ?? 0);
    ad.impressions += Number(row.impressions ?? 0);
    ad.name = row.ad_name || ad.name;
    ad.campaign = row.campaign_name || ad.campaign;
    ad.adset = row.adset_name || ad.adset;
    ad.headline = row.headline || ad.headline;
    ad.primaryText = row.primary_text || ad.primaryText;
    ad.finalCreativeLink = row.final_creative_link || ad.finalCreativeLink;
    ad.permanentImageUrl = row.permanent_image_url || ad.permanentImageUrl;
    ad.destinationUrl = row.destination_url || ad.destinationUrl;
    ad.ctaType = row.cta_type || ad.ctaType;
    ad.isVideo = row.is_video ?? ad.isVideo;
    ad.videoId = row.video_id || ad.videoId;
    ad.videoUrl = row.video_url || ad.videoUrl;
    ads.set(row.ad_id, ad);
  }
  return Array.from(ads.values()).sort((a, b) => b.spend - a.spend || String(a.adId ?? '').localeCompare(String(b.adId ?? '')));
}

export async function fetchAuritDashboardData(params: AuritFilterParams): Promise<AuritDashboardData> {
  const db = createSpartacoSupabaseClient();
  const todayDate = today();
  const monthStart = snapToMonthStart(todayDate);
  const channels: AuritChannel[] = params.channel === 'all' ? ['Meta', 'Google'] : [params.channel];

  const [metaCreatives, metaPacing, youtubePacing, current, previous, lastMeta, lastGoogle, weeklyReadoutRes, budgetRows] = await Promise.all([
    fetchPerformanceCreatives(db, params),
    fetchPacingDays(db, 'Meta', monthStart, todayDate),
    fetchPacingDays(db, 'Google', monthStart, todayDate),
    fetchPeriod(db, channels, params.start, params.end),
    fetchPeriod(db, channels, params.compStart, params.compEnd),
    db.from('aurit_meta').select('date').order('date', { ascending: false }).limit(1),
    db.from('aurit_google').select('date').order('date', { ascending: false }).limit(1),
    db.from('aurit_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .eq('status', 'published')
      .order('generated_at', { ascending: false })
      .limit(1),
    fetchAllPages<AuritBudgetRow>('monthly budgets', (from, to) => db.from('budgets')
      .select('client,budget,period_start')
      .in('client', ['aurit_meta', 'aurit_youtube'])
      .lte('period_start', monthStart)
      .order('period_start', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)),
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

  const monthlyBudget = mapAuritMonthlyBudget(budgetRows, monthStart);
  return {
    ...aggregates,
    metaCreatives,
    monthlyBudget,
    pacing: buildAuritPacing(monthlyBudget, [...metaPacing, ...youtubePacing], todayDate),
    channelRows: aggregates.channelRows.filter(row => channels.includes(row.channel)),
    filterParams: params,
    lastSyncedDate,
    weeklyReadout,
  };
}
