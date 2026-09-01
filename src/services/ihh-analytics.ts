import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';
import { aggregateMetaCreativesByName, summarizeMetaCreatives } from '@/services/analytics';
import { fetchCreativeAiInsight } from '@/services/creative-ai-insights';
import type { CreativeAnalysis } from '@/services/creative-analysis-types';
import {
  IHH_PIXEL_RELIABLE_START,
  aggregateIhhPixelRows,
  ihhPixelCoverage,
} from '@/services/ihh-pixel-aggregation';
import type { IhhPixelCoverage } from '@/services/ihh-pixel-aggregation';

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
  linkClicks: number;
  linkCtr: number | null;
  leads: number | null;
  scheduledAppointments: number | null;
  conversionRate: number | null;
  costPerLead: number | null;
  costPerScheduledAppointment: number | null;
  trackingSpend: number | null;
  trackingCoverage: IhhPixelCoverage;
  trackingStart: string;
};

export type IhhTimePoint = {
  label: string;
  spend: number;
  trackingSpend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number | null;
  scheduledAppointments: number | null;
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
  trackingSpend: number;
  prevTrackingSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  linkClicks: number;
  prevLinkClicks: number;
  linkCtr: number | null;
  prevLinkCtr: number | null;
  ctr: number;
  prevCtr: number;
  leads: number | null;
  prevLeads: number | null;
  costPerQuizTaker: number | null;
  prevCostPerQuizTaker: number | null;
  scheduledAppointments: number | null;
  prevScheduledAppointments: number | null;
  costPerScheduledAppointment: number | null;
  prevCostPerScheduledAppointment: number | null;
};

export type IhhAdRow = {
  adName: string;
  adsetName: string;
  campaignName: string;
  previewUrl: string;
  spend: number;
  prevSpend: number;
  trackingSpend: number;
  prevTrackingSpend: number;
  clicks: number;
  prevClicks: number;
  linkClicks: number;
  prevLinkClicks: number;
  linkCtr: number | null;
  prevLinkCtr: number | null;
  impressions: number;
  prevImpressions: number;
  leads: number | null;
  prevLeads: number | null;
  costPerQuizTaker: number | null;
  prevCostPerQuizTaker: number | null;
  scheduledAppointments: number | null;
  prevScheduledAppointments: number | null;
  costPerScheduledAppointment: number | null;
  prevCostPerScheduledAppointment: number | null;
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
  link_clicks: number;
  cost: number;
  conversions: number | null;
  scheduled_appointments: number | null;
};

type AdRawRow = {
  id: number;
  date: string;
  ad_id?: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  link_clicks?: number;
  cost: number;
  preview_url: string;
  leads: number | null;
  scheduled_appointments: number | null;
};

type MetaCreativeRow = AdRawRow & {
  purchases: number;
  revenue: number;
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

const MASTER_SELECT = 'date,campaign_name,ad_channel,impressions,clicks,link_clicks,cost,conversions,scheduled_appointments';
const AD_SELECT = 'id,date,ad_name,adset_name,campaign_name,impressions,clicks,link_clicks,cost,preview_url,leads,scheduled_appointments';
const CREATIVE_SELECT = 'id,date,ad_id,ad_name,adset_name,campaign_name,impressions,clicks,cost,purchases,revenue,preview_url,leads,scheduled_appointments,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,ad_status,is_video,video_id,video_url';

function summariseMedia(rows: MasterRow[]) {
  const spend = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const linkClicks = rows.reduce((s, r) => s + Number(r.link_clicks ?? 0), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    linkClicks,
    linkCtr: impressions > 0 ? (linkClicks / impressions) * 100 : null,
  };
}

function combineSummary(rows: MasterRow[], start: string, end: string): IhhsSummary {
  const media = summariseMedia(rows);
  const pixel = aggregateIhhPixelRows(rows, start, end);
  return {
    ...media,
    leads: pixel.leads,
    scheduledAppointments: pixel.scheduledAppointments,
    conversionRate: pixel.conversionRate,
    costPerLead: pixel.costPerLead,
    costPerScheduledAppointment: pixel.costPerScheduledAppointment,
    trackingSpend: pixel.trackingSpend,
    trackingCoverage: pixel.coverage,
    trackingStart: pixel.trackingStart,
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
    if (r.date >= IHH_PIXEL_RELIABLE_START) existing.leads += Number(r.leads ?? 0);
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

  const [currRows, prevRows, rawAds, prevRawAds, creativeRows, budgetRes, pacingRows, readoutRes] = await Promise.all([
    fetchPagedMasterRows(db, start, end),
    fetchPagedMasterRows(db, compStart, compEnd),
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

  const summary = combineSummary(currRows, start, end);
  const prevSummary = combineSummary(prevRows, compStart, compEnd);

  // Pixel outcomes use Meta account reporting dates. Dates before the reliable
  // configuration start remain null so charts show a tracking gap, not zeros.
  const dateMap = new Map<string, IhhTimePoint>();
  for (const r of currRows) {
    const existing = dateMap.get(r.date) ?? { label: r.date, spend: 0, trackingSpend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: null, scheduledAppointments: null };
    existing.spend += Number(r.cost ?? 0);
    if (r.date >= IHH_PIXEL_RELIABLE_START) existing.trackingSpend += Number(r.cost ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.clicks += Number(r.clicks ?? 0);
    existing.linkClicks += Number(r.link_clicks ?? 0);
    dateMap.set(r.date, existing);
  }
  for (const pixelPoint of aggregateIhhPixelRows(currRows, start, end).daily) {
    const existing = dateMap.get(pixelPoint.label) ?? { label: pixelPoint.label, spend: 0, trackingSpend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: null, scheduledAppointments: null };
    existing.leads = pixelPoint.leads;
    existing.scheduledAppointments = pixelPoint.scheduledAppointments;
    dateMap.set(pixelPoint.label, existing);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

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

  type CampAccum = { campaign: string; channel: string; spend: number; trackingSpend: number; impressions: number; clicks: number; linkClicks: number; leads: number; scheduledAppointments: number };
  const aggregateCampaigns = (rows: MasterRow[]) => {
    const map = new Map<string, CampAccum>();
    for (const r of rows) {
      const key = `${r.campaign_name}__${r.ad_channel}`;
      const existing = map.get(key) ?? { campaign: r.campaign_name, channel: r.ad_channel, spend: 0, trackingSpend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, scheduledAppointments: 0 };
      existing.spend += Number(r.cost ?? 0);
      existing.impressions += Number(r.impressions ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      existing.linkClicks += Number(r.link_clicks ?? 0);
      if (r.date >= IHH_PIXEL_RELIABLE_START) {
        existing.trackingSpend += Number(r.cost ?? 0);
        existing.leads += Number(r.conversions ?? 0);
        existing.scheduledAppointments += Number(r.scheduled_appointments ?? 0);
      }
      map.set(key, existing);
    }
    return map;
  };
  const campMap = aggregateCampaigns(currRows);
  const prevCampMap = aggregateCampaigns(prevRows);
  const campCoverage = ihhPixelCoverage(start, end);
  const prevCampCoverage = ihhPixelCoverage(compStart, compEnd);
  const campaignRows: IhhsCampaignRow[] = Array.from(campMap.values()).map(c => {
    const p = prevCampMap.get(`${c.campaign}__${c.channel}`) ?? { spend: 0, trackingSpend: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, scheduledAppointments: 0 } as CampAccum;
    return {
      ...c,
      prevSpend: p.spend,
      prevTrackingSpend: p.trackingSpend,
      prevImpressions: p.impressions,
      prevClicks: p.clicks,
      linkClicks: c.linkClicks,
      prevLinkClicks: p.linkClicks,
      linkCtr: c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : null,
      prevLinkCtr: p.impressions > 0 ? (p.linkClicks / p.impressions) * 100 : null,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      prevCtr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      leads: campCoverage === 'none' ? null : c.leads,
      prevLeads: prevCampCoverage === 'none' ? null : p.leads,
      costPerQuizTaker: campCoverage !== 'none' && c.leads > 0 ? c.trackingSpend / c.leads : null,
      prevCostPerQuizTaker: prevCampCoverage !== 'none' && p.leads > 0 ? p.trackingSpend / p.leads : null,
      scheduledAppointments: campCoverage === 'none' ? null : c.scheduledAppointments,
      prevScheduledAppointments: prevCampCoverage === 'none' ? null : p.scheduledAppointments,
      costPerScheduledAppointment: campCoverage !== 'none' && c.scheduledAppointments > 0 ? c.trackingSpend / c.scheduledAppointments : null,
      prevCostPerScheduledAppointment: prevCampCoverage !== 'none' && p.scheduledAppointments > 0 ? p.trackingSpend / p.scheduledAppointments : null,
    };
  }).sort((a, b) => b.spend - a.spend);

  type AdAccum = { adName: string; adsetName: string; campaignName: string; previewUrl: string; spend: number; trackingSpend: number; clicks: number; linkClicks: number; impressions: number; leads: number; scheduledAppointments: number };
  const aggregateAds = (rows: AdRawRow[]) => {
    const map = new Map<string, AdAccum>();
    for (const r of rows) {
      const key = `${r.ad_name}__${r.adset_name}`;
      const existing = map.get(key) ?? { adName: r.ad_name || r.campaign_name, adsetName: r.adset_name, campaignName: r.campaign_name, previewUrl: '', spend: 0, trackingSpend: 0, clicks: 0, linkClicks: 0, impressions: 0, leads: 0, scheduledAppointments: 0 };
      existing.spend += Number(r.cost ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      existing.linkClicks += Number(r.link_clicks ?? 0);
      existing.impressions += Number(r.impressions ?? 0);
      if (r.date >= IHH_PIXEL_RELIABLE_START) {
        existing.trackingSpend += Number(r.cost ?? 0);
        existing.leads += Number(r.leads ?? 0);
        existing.scheduledAppointments += Number(r.scheduled_appointments ?? 0);
      }
      existing.previewUrl ||= r.preview_url ?? '';
      map.set(key, existing);
    }
    return map;
  };
  const adMap = aggregateAds(rawAds);
  const prevAdMap = aggregateAds(prevRawAds);
  const adCoverage = ihhPixelCoverage(start, end);
  const prevAdCoverage = ihhPixelCoverage(compStart, compEnd);
  const adRows: IhhAdRow[] = Array.from(adMap.values()).map(a => {
    const p = prevAdMap.get(`${a.adName}__${a.adsetName}`) ?? { spend: 0, trackingSpend: 0, clicks: 0, linkClicks: 0, impressions: 0, leads: 0, scheduledAppointments: 0 } as AdAccum;
    return {
      ...a,
      prevSpend: p.spend,
      prevTrackingSpend: p.trackingSpend,
      prevClicks: p.clicks,
      linkClicks: a.linkClicks,
      prevLinkClicks: p.linkClicks,
      linkCtr: a.impressions > 0 ? (a.linkClicks / a.impressions) * 100 : null,
      prevLinkCtr: p.impressions > 0 ? (p.linkClicks / p.impressions) * 100 : null,
      prevImpressions: p.impressions,
      leads: adCoverage === 'none' ? null : a.leads,
      prevLeads: prevAdCoverage === 'none' ? null : p.leads,
      costPerQuizTaker: adCoverage !== 'none' && a.leads > 0 ? a.trackingSpend / a.leads : null,
      prevCostPerQuizTaker: prevAdCoverage !== 'none' && p.leads > 0 ? p.trackingSpend / p.leads : null,
      scheduledAppointments: adCoverage === 'none' ? null : a.scheduledAppointments,
      prevScheduledAppointments: prevAdCoverage === 'none' ? null : p.scheduledAppointments,
      costPerScheduledAppointment: adCoverage !== 'none' && a.scheduledAppointments > 0 ? a.trackingSpend / a.scheduledAppointments : null,
      prevCostPerScheduledAppointment: prevAdCoverage !== 'none' && p.scheduledAppointments > 0 ? p.trackingSpend / p.scheduledAppointments : null,
    };
  }).sort((a, b) => b.spend - a.spend);

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
