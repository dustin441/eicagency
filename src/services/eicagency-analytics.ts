import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';
import type { MetaCreative } from '@/services/analytics';

export type EicAgencyFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Google' | 'Meta'
};

export type EicAgencySummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number; // north-star: Cost Per Lead / Cost Per Appointment
};

export type EicAgencyTimePoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export type EicAgencyChannelRow = {
  channel: string;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  leads: number;
  prevLeads: number;
};

export type EicAgencyCampaignRow = {
  campaign: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  landingPageViews: number;
  costPerLandingPageView: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  costPerEngagedSession: number;
  averageSessionDuration: number;
  leads: number;
  cpl: number;
};

export type EicAgencyAdSetRow = {
  adSet: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  landingPageViews: number;
  costPerLandingPageView: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  costPerEngagedSession: number;
  averageSessionDuration: number;
  leads: number;
  cpl: number;
};

export type EicAgencyBudgetPacing = {
  budget: number | null;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type EicAgencyWeeklyReadout = {
  periodStart: string;
  periodEnd: string;
  overallStory: string[];
  wins: string[];
  opportunities: string[];
  accomplishments: string[];
  focusNextWeek: string[];
  executionContext: string[];
};

export type EicAgencyDashboardData = {
  filterParams: EicAgencyFilterParams;
  summary: EicAgencySummary;
  prevSummary: EicAgencySummary;
  timeSeries: EicAgencyTimePoint[];
  channelRows: EicAgencyChannelRow[];
  campaignRows: EicAgencyCampaignRow[];
  adSetRows: EicAgencyAdSetRow[];
  metaCreatives: MetaCreative[];
  budgetPacing: EicAgencyBudgetPacing;
  weeklyReadout: EicAgencyWeeklyReadout | null;
};

// ── internal row types ───────────────────────────────────────────────────────

type MasterRow = {
  date: string;
  campaign_name: string;
  source: string;          // 'Meta' | 'Google'
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number | null; // both platforms store their conversion count here
  purchases: number | null;   // fallback for Meta rows
};

// eic_meta_ads uses `spend` (not `cost`) and `leads` (not `purchases`)
type EicAdRow = {
  date: string;
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  landing_page_views: number;
  leads: number;           // Meta conversion field
  final_creative_link: string | null;
  permanent_image_url: string | null;
  video_id: string | null;
  video_url: string | null;
  headline: string | null;
  primary_text: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
};

type EicGa4Row = {
  platform: string;
  session_medium: string;
  session_campaign_name: string;
  ad_id: string;
  sessions: number | string;
  engaged_sessions: number | string;
  average_session_duration: number | string;
};

type OnsiteMetricsBucket = {
  sessions: number;
  engagedSessions: number;
  weightedSessionDuration: number;
};

type WeeklyReadoutRow = {
  period_start: string;
  period_end: string;
  overall_story: unknown; // jsonb array
  wins: unknown;
  opportunities: unknown;
  accomplishments: unknown;
  focus_next_week: unknown;
  execution_context: unknown;
};

// ── helpers ──────────────────────────────────────────────────────────────────

// Normalises the conversion metric across platforms:
// Meta stores leads in `leads` (ad level) and `conversions` (master level).
// Google stores conversions in `conversions`.
function rowLeads(r: MasterRow): number {
  return Number(r.conversions ?? r.purchases ?? 0);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

// overall_story is stored as text (not jsonb) — wrap in single-item array
function textToArray(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return stringArray(value);
}

function summarise(rows: MasterRow[]): EicAgencySummary {
  const spend       = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks      = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const leads       = rows.reduce((s, r) => s + rowLeads(r), 0);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    leads,
    cpl: leads > 0 ? spend / leads : 0,
  };
}

function targetKey(...values: string[]) {
  return values
    .map(value => String(value ?? '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase())
    .join('\u0001');
}

function addOnsiteRow(bucket: OnsiteMetricsBucket, row: EicGa4Row) {
  const sessions = Number(row.sessions) || 0;
  bucket.sessions += sessions;
  bucket.engagedSessions += Number(row.engaged_sessions) || 0;
  bucket.weightedSessionDuration += (Number(row.average_session_duration) || 0) * sessions;
}

function summariseOnsite(bucket?: OnsiteMetricsBucket) {
  const sessions = bucket?.sessions ?? 0;
  const engagedSessions = bucket?.engagedSessions ?? 0;
  return {
    sessions,
    engagedSessions,
    engagementRate: sessions > 0 ? (engagedSessions / sessions) * 100 : 0,
    averageSessionDuration: sessions > 0
      ? (bucket?.weightedSessionDuration ?? 0) / sessions
      : 0,
  };
}

// Ad Library URLs are not playable inline — fall back to previewUrl
function resolveVideoUrls(rawVideoUrl: string | null, rawPreviewUrl: string | null) {
  const isAdLibrary = rawVideoUrl?.startsWith('https://www.facebook.com/ads/library/') ?? false;
  return {
    videoUrl:   !isAdLibrary && rawVideoUrl ? rawVideoUrl : '',
    previewUrl: isAdLibrary ? (rawVideoUrl ?? '') : (rawPreviewUrl ?? ''),
  };
}

// ── public API ───────────────────────────────────────────────────────────────

export function eicAgencyParamsFromSearch(p: Record<string, string | undefined>): EicAgencyFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end   = p.end   ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd:   p.comp_end   ?? compEnd,
    channel:   p.channel    ?? 'all',
  };
}

export async function fetchEicAgencyDashboardData(params: EicAgencyFilterParams): Promise<EicAgencyDashboardData> {
  const db = createSpartacoSupabaseClient();
  const { start, end, compStart, compEnd, channel } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyChannel(q: any) {
    return channel !== 'all' ? q.eq('source', channel) : q;
  }

  async function fetchMetaAds(): Promise<EicAdRow[]> {
    const pageSize = 1000;
    const rows: EicAdRow[] = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db
        .from('eic_meta_ads')
        .select('date,ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,landing_page_views,leads,final_creative_link,permanent_image_url,video_id,video_url,headline,primary_text,destination_url,cta_type,is_video')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('ad_id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = (data ?? []) as unknown as EicAdRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

  async function fetchGa4Rows(): Promise<EicGa4Row[]> {
    const pageSize = 1000;
    const rows: EicGa4Row[] = [];

    for (let from = 0; ; from += pageSize) {
      let query = db
        .from('eic_ga4_daily')
        .select('platform,session_medium,session_campaign_name,ad_id,sessions,engaged_sessions,average_session_duration')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('row_key', { ascending: true })
        .range(from, from + pageSize - 1);

      if (channel === 'Meta' || channel === 'Google') {
        query = query.eq('platform', channel);
      } else {
        query = query.in('platform', ['Meta', 'Google']);
      }

      const { data, error } = await query;
      if (error) throw error;

      const page = (data ?? []) as unknown as EicGa4Row[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

  const masterSelect = 'date,campaign_name,source,impressions,clicks,cost,conversions,purchases';

  const now        = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd   = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRows, ga4Rows, pacingRes, budgetRes, weeklyReadoutRes] = await Promise.all([
    applyChannel(
      db.from('eicagency_master').select(masterSelect).gte('date', start).lte('date', end)
    ),
    applyChannel(
      db.from('eicagency_master').select(masterSelect).gte('date', compStart).lte('date', compEnd)
    ),
    // Ad-set and creative performance share the same paginated Meta ad-level source.
    channel !== 'Google' ? fetchMetaAds() : Promise.resolve([] as EicAdRow[]),
    fetchGa4Rows(),
    // Budget pacing: always current calendar month, no channel filter
    db.from('eicagency_master').select('source,cost').gte('date', monthStart).lte('date', monthEnd),
    // Monthly budget from the shared budgets table
    db.from('budgets').select('budget').ilike('client', 'EICAgency').limit(1),
    db
      .from('eicagency_weekly_readout')
      .select('period_start,period_end,overall_story,wins,opportunities,accomplishments,focus_next_week,execution_context')
      .in('status', ['approved', 'published'])
      .order('generated_at', { ascending: false })
      .limit(1),
  ]);

  const currRows = (currRes.data ?? []) as unknown as MasterRow[];
  const prevRows = (prevRes.data ?? []) as unknown as MasterRow[];
  const rawAds   = adRows;

  // Resolve GA4 UTMs back to current Meta names through ad_id first. This keeps
  // renamed targets such as Custom Audiences → SayPrimer attached to the same
  // Meta row, with normalized campaign and ad-set names as the fallback.
  const metaAdById = new Map<string, EicAdRow>();
  const currentMetaTargets = new Map<string, { campaign: string; adSet: string }>();
  for (const ad of rawAds) {
    const adId = String(ad.ad_id ?? '').trim();
    const campaign = String(ad.campaign_name ?? '').trim();
    const adSet = String(ad.adset_name ?? '').trim();
    if (adId) metaAdById.set(adId, ad);
    if (campaign && adSet) currentMetaTargets.set(targetKey(campaign, adSet), { campaign, adSet });
  }

  const campaignOnsite = new Map<string, OnsiteMetricsBucket>();
  const adSetOnsite = new Map<string, OnsiteMetricsBucket>();
  for (const ga4 of ga4Rows) {
    const metaAd = metaAdById.get(String(ga4.ad_id ?? '').trim());
    const sourceChannel = metaAd
      ? 'Meta'
      : ga4.platform === 'Meta' || ga4.platform === 'Google'
        ? ga4.platform
        : '';
    let campaign = String(metaAd?.campaign_name ?? ga4.session_campaign_name ?? '').trim();
    let adSet = String(metaAd?.adset_name ?? ga4.session_medium ?? '').trim();

    if (!metaAd && sourceChannel === 'Meta' && campaign && adSet) {
      const directTarget = currentMetaTargets.get(targetKey(campaign, adSet));
      const primerTarget = currentMetaTargets.get(
        targetKey(campaign, adSet.replace(/\bcustom audiences\b/gi, 'SayPrimer'))
      );
      const resolvedTarget = directTarget ?? primerTarget;
      if (resolvedTarget) {
        campaign = resolvedTarget.campaign;
        adSet = resolvedTarget.adSet;
      }
    }

    if (!sourceChannel || !campaign) continue;

    const campaignKey = targetKey(campaign, sourceChannel);
    const campaignBucket = campaignOnsite.get(campaignKey) ?? {
      sessions: 0,
      engagedSessions: 0,
      weightedSessionDuration: 0,
    };
    addOnsiteRow(campaignBucket, ga4);
    campaignOnsite.set(campaignKey, campaignBucket);

    if (sourceChannel === 'Meta' && adSet) {
      const adSetKey = targetKey(campaign, adSet);
      const adSetBucket = adSetOnsite.get(adSetKey) ?? {
        sessions: 0,
        engagedSessions: 0,
        weightedSessionDuration: 0,
      };
      addOnsiteRow(adSetBucket, ga4);
      adSetOnsite.set(adSetKey, adSetBucket);
    }
  }

  const summary     = summarise(currRows);
  const prevSummary = summarise(prevRows);

  // Time series — group by date
  const dateMap = new Map<string, EicAgencyTimePoint>();
  for (const r of currRows) {
    const pt = dateMap.get(r.date) ?? { label: r.date, spend: 0, impressions: 0, clicks: 0, leads: 0 };
    pt.spend       += Number(r.cost ?? 0);
    pt.impressions += Number(r.impressions ?? 0);
    pt.clicks      += Number(r.clicks ?? 0);
    pt.leads       += rowLeads(r);
    dateMap.set(r.date, pt);
  }
  const timeSeries = Array.from(dateMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Channel breakdown
  const allChannels = channel === 'all' ? ['Meta', 'Google'] : [channel];
  const channelRows: EicAgencyChannelRow[] = allChannels
    .map(ch => {
      const curr = currRows.filter(r => r.source === ch);
      const prev = prevRows.filter(r => r.source === ch);
      return {
        channel: ch,
        spend:          curr.reduce((s, r) => s + Number(r.cost        ?? 0), 0),
        prevSpend:      prev.reduce((s, r) => s + Number(r.cost        ?? 0), 0),
        impressions:    curr.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
        prevImpressions:prev.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
        clicks:         curr.reduce((s, r) => s + Number(r.clicks      ?? 0), 0),
        prevClicks:     prev.reduce((s, r) => s + Number(r.clicks      ?? 0), 0),
        leads:          curr.reduce((s, r) => s + rowLeads(r), 0),
        prevLeads:      prev.reduce((s, r) => s + rowLeads(r), 0),
      };
    })
    .filter(ch => ch.spend > 0 || ch.prevSpend > 0);

  // Campaign breakdown — group by campaign + channel, top 25 by spend
  const campaignLandingPageViews = new Map<string, number>();
  for (const r of rawAds) {
    const campaign = String(r.campaign_name ?? '').trim();
    campaignLandingPageViews.set(
      campaign,
      (campaignLandingPageViews.get(campaign) ?? 0) + Number(r.landing_page_views ?? 0)
    );
  }

  const campMap = new Map<string, EicAgencyCampaignRow>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.source}`;
    const row = campMap.get(key) ?? {
      campaign: r.campaign_name,
      channel:  r.source,
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      landingPageViews: 0,
      costPerLandingPageView: 0,
      sessions: 0,
      engagedSessions: 0,
      engagementRate: 0,
      costPerEngagedSession: 0,
      averageSessionDuration: 0,
      leads: 0,
      cpl: 0,
    };
    row.spend       += Number(r.cost        ?? 0);
    row.impressions += Number(r.impressions ?? 0);
    row.clicks      += Number(r.clicks      ?? 0);
    row.leads       += rowLeads(r);
    campMap.set(key, row);
  }
  const campaignRows: EicAgencyCampaignRow[] = Array.from(campMap.values())
    .map(c => {
      const landingPageViews = c.channel === 'Meta'
        ? (campaignLandingPageViews.get(c.campaign) ?? 0)
        : 0;
      const onsite = summariseOnsite(campaignOnsite.get(targetKey(c.campaign, c.channel)));
      return {
        ...c,
        ...onsite,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        landingPageViews,
        costPerLandingPageView: landingPageViews > 0 ? c.spend / landingPageViews : 0,
        costPerEngagedSession: onsite.engagedSessions > 0 ? c.spend / onsite.engagedSessions : 0,
        cpl: c.leads > 0 ? c.spend / c.leads : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

  // Meta ad-set performance — aggregate ad-level daily rows by campaign + ad-set name.
  const adSetMap = new Map<string, EicAgencyAdSetRow>();
  for (const r of rawAds) {
    const adSet = String(r.adset_name ?? '').trim() || 'Unnamed ad set';
    const campaign = String(r.campaign_name ?? '').trim() || 'Unnamed campaign';
    const key = `${campaign}__${adSet}`;
    const row = adSetMap.get(key) ?? {
      adSet,
      campaign,
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      landingPageViews: 0,
      costPerLandingPageView: 0,
      sessions: 0,
      engagedSessions: 0,
      engagementRate: 0,
      costPerEngagedSession: 0,
      averageSessionDuration: 0,
      leads: 0,
      cpl: 0,
    };
    row.spend += Number(r.spend ?? 0);
    row.impressions += Number(r.impressions ?? 0);
    row.clicks += Number(r.clicks ?? 0);
    row.landingPageViews += Number(r.landing_page_views ?? 0);
    row.leads += Number(r.leads ?? 0);
    adSetMap.set(key, row);
  }
  const adSetRows: EicAgencyAdSetRow[] = Array.from(adSetMap.values())
    .map(row => {
      const onsite = summariseOnsite(adSetOnsite.get(targetKey(row.campaign, row.adSet)));
      return {
        ...row,
        ...onsite,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        costPerLandingPageView: row.landingPageViews > 0 ? row.spend / row.landingPageViews : 0,
        costPerEngagedSession: onsite.engagedSessions > 0 ? row.spend / onsite.engagedSessions : 0,
        cpl: row.leads > 0 ? row.spend / row.leads : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // Meta ad creatives — aggregate multiple date rows per ad_id client-side
  const adAgg = new Map<string, EicAdRow & { _spend: number; _leads: number; _clicks: number; _impressions: number }>();
  for (const r of rawAds) {
    const existing = adAgg.get(r.ad_id);
    if (!existing) {
      adAgg.set(r.ad_id, {
        ...r,
        _spend:       Number(r.spend       ?? 0),
        _leads:       Number(r.leads       ?? 0),
        _clicks:      Number(r.clicks      ?? 0),
        _impressions: Number(r.impressions ?? 0),
      });
    } else {
      existing._spend       += Number(r.spend       ?? 0);
      existing._leads       += Number(r.leads       ?? 0);
      existing._clicks      += Number(r.clicks      ?? 0);
      existing._impressions += Number(r.impressions ?? 0);
    }
  }
  const metaCreatives: MetaCreative[] = Array.from(adAgg.values())
    .sort((a, b) => b._spend - a._spend)
    .slice(0, 100)
    .map(r => {
      const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, null);
      return {
        name:                r.ad_name || r.headline || r.campaign_name,
        campaign:            r.campaign_name,
        adset:               r.adset_name,
        headline:            String(r.headline      ?? ''),
        primaryText:         String(r.primary_text  ?? ''),
        finalCreativeLink:   String(r.final_creative_link ?? ''),
        permanentImageUrl:   String(r.permanent_image_url ?? ''),
        destinationUrl:      String(r.destination_url ?? ''),
        ctaType:             String(r.cta_type      ?? ''),
        isVideo:             Boolean(r.is_video),
        videoId:             String(r.video_id      ?? ''),
        videoUrl,
        pageName:            '',
        pageProfileImageUrl: '',
        previewUrl,
        spend:       r._spend,
        leads:       r._leads,
        clicks:      r._clicks,
        impressions: r._impressions,
      };
    });

  // Budget pacing — always current calendar month, $1,800 default
  const budgetRows  = (budgetRes.data  ?? []) as unknown as { budget: number }[];
  const MONTHLY_BUDGET = budgetRows[0] ? Number(budgetRows[0].budget) : 1800;
  const pacingRows  = (pacingRes.data  ?? []) as unknown as { source: string; cost: number }[];
  const metaPacing   = pacingRows.filter(r => r.source === 'Meta').reduce((s, r)   => s + Number(r.cost ?? 0), 0);
  const googlePacing = pacingRows.filter(r => r.source === 'Google').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const budgetPacing: EicAgencyBudgetPacing = {
    budget:     MONTHLY_BUDGET,
    metaSpend:  metaPacing,
    googleSpend: googlePacing,
    totalSpend: metaPacing + googlePacing,
    monthStart,
    monthEnd,
  };

  // Latest weekly readout
  const weeklyRows  = (weeklyReadoutRes.data ?? []) as unknown as WeeklyReadoutRow[];
  const latestReadout = weeklyRows[0];
  const weeklyReadout: EicAgencyWeeklyReadout | null = latestReadout
    ? {
        periodStart:      latestReadout.period_start,
        periodEnd:        latestReadout.period_end,
        overallStory:     textToArray(latestReadout.overall_story),
        wins:             stringArray(latestReadout.wins),
        opportunities:    stringArray(latestReadout.opportunities),
        accomplishments:  stringArray(latestReadout.accomplishments),
        focusNextWeek:    stringArray(latestReadout.focus_next_week),
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
    adSetRows,
    metaCreatives,
    budgetPacing,
    weeklyReadout,
  };
}
