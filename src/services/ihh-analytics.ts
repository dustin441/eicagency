import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';
import { aggregateIhhFunnelRows, ihhArizonaRangeBounds } from '@/services/ihh-funnel-aggregation';
import type { IhhFunnelContactRow } from '@/services/ihh-funnel-aggregation';

export type IhhFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
};

export type IhhsSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  quizTakers: number;
  scheduledAppointments: number;
  conversionRate: number | null;
  costPerQuizTaker: number | null;
  costPerScheduledAppointment: number | null;
};

export type IhhTimePoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  quizTakers: number;
  scheduledAppointments: number;
};

export type IhhChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
};

export type IhhsCampaignRow = {
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
};

export type IhhAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  prevSpend: number;
  clicks: number;
  prevClicks: number;
  impressions: number;
  prevImpressions: number;
};

export type IhhsBudgetPacing = {
  budget: number | null;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type IhhWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string;
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type IhhsDashboardData = {
  filterParams: IhhFilterParams;
  summary: IhhsSummary;
  prevSummary: IhhsSummary;
  timeSeries: IhhTimePoint[];
  channelRows: IhhChannelRow[];
  campaignRows: IhhsCampaignRow[];
  adRows: IhhAdRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: IhhsBudgetPacing;
  weeklyReadout: IhhWeeklyReadout | null;
};

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
};

type AdRawRow = {
  id: number;
  ad_id?: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  preview_url: string;
};

type MetaCreativeRow = AdRawRow & {
  purchases: number;
  revenue: number;
  leads: number | null;
  final_creative_link: string | null;
  permanent_image_url: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  ad_status: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
};

type BudgetRow = {
  budget: number;
};

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

const MASTER_SELECT = 'date,campaign_name,ad_channel,impressions,clicks,cost';
const AD_SELECT = 'id,ad_name,adset_name,campaign_name,impressions,clicks,cost,preview_url';
const CREATIVE_SELECT = 'id,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url,leads,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,ad_status,is_video,video_id,video_url';

function summariseMedia(rows: MasterRow[]) {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

function combineSummary(rows: MasterRow[], funnelRows: IhhFunnelContactRow[]): IhhsSummary {
  const media = summariseMedia(rows);
  const funnel = aggregateIhhFunnelRows(funnelRows, media.spend);
  return {
    ...media,
    quizTakers: funnel.quizTakers,
    scheduledAppointments: funnel.scheduledAppointments,
    conversionRate: funnel.conversionRate,
    costPerQuizTaker: funnel.costPerQuizTaker,
    costPerScheduledAppointment: funnel.costPerScheduledAppointment,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

async function fetchPagedCreativeRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<MetaCreativeRow[]> {
  const rows: MetaCreativeRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_meta_ads_creatives')
      .select(CREATIVE_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH creative rows: ${error.message}`);

    const page = (data ?? []) as unknown as MetaCreativeRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchPagedMasterRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<MasterRow[]> {
  const rows: MasterRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_master')
      .select(MASTER_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('campaign_name', { ascending: true })
      .order('ad_channel', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH master rows: ${error.message}`);
    const page = (data ?? []) as unknown as MasterRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchPagedFunnelRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<IhhFunnelContactRow[]> {
  const rows: IhhFunnelContactRow[] = [];
  const pageSize = 1000;
  const bounds = ihhArizonaRangeBounds(start, end);

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_funnel_contacts')
      .select('contact_key,lead_at,quiz_taker,appointment_scheduled,appointment_at')
      .eq('quiz_taker', true)
      .gte('lead_at', bounds.start)
      .lt('lead_at', bounds.endExclusive)
      .order('lead_at', { ascending: true })
      .order('contact_key', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH funnel contacts: ${error.message}`);
    const page = (data ?? []) as unknown as IhhFunnelContactRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchPagedAdRows(
  db: ReturnType<typeof createSpartacoSupabaseClient>,
  start: string,
  end: string
): Promise<AdRawRow[]> {
  const rows: AdRawRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_meta_ads')
      .select(AD_SELECT)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH ad rows: ${error.message}`);
    const page = (data ?? []) as unknown as AdRawRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

// Maps raw ihh_meta_ads_creatives rows into MetaCreative[], deduped by
// ad_id/adset/campaign (fine-grained — a given ad running in two ad sets
// stays as two entries). Shared by the Performance tab (which additionally
// slices to top 30 by spend) and the Ad Analysis tab (which further
// aggregates by ad_name via aggregateMetaCreativesByName, no slice).
function buildIhhMetaCreatives(creativeRows: MetaCreativeRow[]): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of creativeRows) {
    const key = `${r.ad_id || r.ad_name}__${r.adset_name}__${r.campaign_name}`;
    const existing = creativeMap.get(key) ?? {
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name,
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: String(r.final_creative_link ?? ''),
      permanentImageUrl: String(r.permanent_image_url ?? ''),
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl: String(r.video_url ?? ''),
      previewUrl: String(r.preview_url ?? ''),
      sales: 0,
      revenue: 0,
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.leads += Number(r.leads ?? r.purchases ?? 0);
    existing.sales = (existing.sales ?? 0) + Number(r.purchases ?? 0);
    existing.revenue = (existing.revenue ?? 0) + Number(r.revenue ?? 0);
    // Rows arrive oldest-first, so overwriting (not ||=) on every non-empty
    // value means the LATEST row wins — important because Meta's signed
    // final_creative_link/video URLs expire after a few days, so keeping the
    // first-seen row's link (as ||= did) served stale/broken images once an
    // ad had been running for most of the date range.
    if (r.headline) existing.headline = String(r.headline);
    if (r.primary_text) existing.primaryText = String(r.primary_text);
    if (r.final_creative_link) existing.finalCreativeLink = String(r.final_creative_link);
    if (r.permanent_image_url) existing.permanentImageUrl = String(r.permanent_image_url);
    if (r.destination_url) existing.destinationUrl = String(r.destination_url);
    if (r.cta_type) existing.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) existing.isVideo = Boolean(r.is_video);
    if (r.video_id) existing.videoId = String(r.video_id);
    if (r.video_url) existing.videoUrl = String(r.video_url);
    if (r.preview_url) existing.previewUrl = String(r.preview_url);
    creativeMap.set(key, existing);
  }
  return Array.from(creativeMap.values())
    .filter(c => c.finalCreativeLink || c.primaryText || c.headline || c.isVideo);
}

export function ihhParamsFromSearch(p: Record<string, string | undefined>): IhhFilterParams {
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

export async function fetchIhhsDashboardData(params: IhhFilterParams): Promise<IhhsDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd } = params;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];

  const [currRows, prevRows, currFunnelRows, prevFunnelRows, rawAds, prevRawAds, creativeRows, budgetRes, pacingRows, readoutRes] = await Promise.all([
    fetchPagedMasterRows(db, start, end),
    fetchPagedMasterRows(db, compStart, compEnd),
    fetchPagedFunnelRows(db, start, end),
    fetchPagedFunnelRows(db, compStart, compEnd),
    fetchPagedAdRows(db, start, end),
    fetchPagedAdRows(db, compStart, compEnd),
    fetchPagedCreativeRows(db, start, end),
    db.from('budgets')
      .select('budget')
      .ilike('client', 'ihh')
      .order('period_start', { ascending: false })
      .limit(1),
    fetchPagedMasterRows(db, monthStart, monthEnd),
    db.from('ihh_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  if (budgetRes.error) throw new Error(`Failed to fetch IHH budget: ${budgetRes.error.message}`);
  if (readoutRes.error) throw new Error(`Failed to fetch IHH weekly readout: ${readoutRes.error.message}`);
  const budgetRows = (budgetRes.data ?? []) as unknown as BudgetRow[];
  const readoutRows = (readoutRes.data ?? []) as unknown as ReadoutRow[];

  const summary = combineSummary(currRows, currFunnelRows);
  const prevSummary = combineSummary(prevRows, prevFunnelRows);

  // Time series combines media delivery and lead-date cohort outcomes by day.
  const dateMap = new Map<string, IhhTimePoint>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { label: r.date, spend: 0, impressions: 0, clicks: 0, quizTakers: 0, scheduledAppointments: 0 };
    existing.spend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    dateMap.set(r.date, existing);
  }
  for (const funnelPoint of aggregateIhhFunnelRows(currFunnelRows, summary.spend).daily) {
    const existing = dateMap.get(funnelPoint.label) ?? { label: funnelPoint.label, spend: 0, impressions: 0, clicks: 0, quizTakers: 0, scheduledAppointments: 0 };
    existing.quizTakers = funnelPoint.quizTakers;
    existing.scheduledAppointments = funnelPoint.scheduledAppointments;
    dateMap.set(funnelPoint.label, existing);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Campaign and ad rows intentionally contain media metrics only. CRM outcomes
  // are a lead-date cohort and cannot be attributed to an individual ad here.
  const channels = ['Meta'];
  const channelRows: IhhChannelRow[] = channels.map(ch => {
    const curr = currRows.filter(r => r.ad_channel === ch);
    const prev = prevRows.filter(r => r.ad_channel === ch);
    return {
      channel: ch,
      spend: curr.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      prevSpend: prev.reduce((s, r) => s + Number(r.cost ?? 0), 0),
      impressions: curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      prevImpressions: prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      clicks: curr.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
      prevClicks: prev.reduce((s, r) => s + Number(r.clicks ?? 0), 0),
    };
  }).filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  type CampAccum = { campaign: string; channel: string; spend: number; impressions: number; clicks: number };
  const aggregateCampaigns = (rows: MasterRow[]) => {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const key = `${r.campaign_name}__${r.ad_channel}`;
      const existing = map.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, impressions: 0, clicks: 0 };
      existing.spend += Number(r.cost ?? 0);
      existing.impressions += Number(r.impressions ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      map.set(key, existing);
    }
    return map;
  };
  const campMap = aggregateCampaigns(currRows);
  const prevCampMap = aggregateCampaigns(prevRows);
  const campaignRows: IhhsCampaignRow[] = Array.from(campMap.values()).map(c => {
    const p = prevCampMap.get(`${c.campaign}__${c.channel}`) ?? { spend: 0, impressions: 0, clicks: 0 } as CampAccum;
    return {
      ...c,
      prevSpend: p.spend,
      prevImpressions: p.impressions,
      prevClicks: p.clicks,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 25);

  type AdAccum = { adName: string; adsetName: string; campaignName: string; previewUrl: string; spend: number; clicks: number; impressions: number };
  const aggregateAds = (rows: AdRawRow[]) => {
    const map = new Map<string, AdAccum>();
    for (const r of rows) {
      const key = `${r.ad_name}__${r.adset_name}`;
      const existing = map.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: '', spend: 0, clicks: 0, impressions: 0 };
      existing.spend += Number(r.cost ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      existing.impressions += Number(r.impressions ?? 0);
      existing.previewUrl ||= r.preview_url ?? '';
      map.set(key, existing);
    }
    return map;
  };
  const adMap = aggregateAds(rawAds);
  const prevAdMap = aggregateAds(prevRawAds);
  const adRows: IhhAdRow[] = Array.from(adMap.values()).map(a => {
    const p = prevAdMap.get(`${a.adName}__${a.adsetName}`) ?? { spend: 0, clicks: 0, impressions: 0 } as AdAccum;
    return { ...a, prevSpend: p.spend, prevClicks: p.clicks, prevImpressions: p.impressions };
  }).sort((a, b) => b.spend - a.spend).slice(0, 30);

  const metaCreatives: MetaCreative[] = buildIhhMetaCreatives(creativeRows)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 30);

  // Budget pacing
  const totalSpend = pacingRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: IhhsBudgetPacing = {
    budget: budgetRows[0] ? Number(budgetRows[0].budget) : null,
    totalSpend,
    monthStart,
    monthEnd,
  };

  const latestReadout = readoutRows[0];
  const weeklyReadout: IhhWeeklyReadout | null = latestReadout
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
    adRows,
    metaCreatives,
    budgetPacing,
    weeklyReadout,
  };
}

// Powers the "Ad Analysis" tab — same source rows as
// fetchIhhsDashboardData, but aggregated by ad NAME (one card per
// creative, merged across ad sets/campaigns) instead of the Performance
// tab's finer-grained key, and with no top-30 cap.
export async function fetchIhhCreativeAnalysis(params: IhhFilterParams): Promise<CreativeAnalysis> {
  const db = createSpartacoSupabaseClient();
  const creativeRows = await fetchPagedCreativeRows(db, params.start, params.end);
  const creatives = aggregateMetaCreativesByName(buildIhhMetaCreatives(creativeRows));
  return {
    creatives,
    summary: summarizeMetaCreatives(creatives),
    aiInsight: await fetchCreativeAiInsight(db, 'ihh_creative_ai_insights', 'IHH'),
  };
}
