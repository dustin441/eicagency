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

// eicagency_meta_ads uses `spend` (not `cost`) and `leads` (not `purchases`)
type EicAdRow = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;           // Meta conversion field
  final_creative_link: string | null;
  video_id: string | null;
  video_url: string | null;
  headline: string | null;
  primary_text: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
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

// overall_story is stored as a JSON-encoded array string — parse it if possible
function textToArray(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item ?? '').trim()).filter(Boolean);
        }
      } catch {
        // fall through
      }
    }
    return [trimmed];
  }
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

  const masterSelect = 'date,campaign_name,source,impressions,clicks,cost,conversions,purchases';

  const now        = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd   = now.toISOString().split('T')[0];

  const [currRes, prevRes, adRes, pacingRes, budgetRes, weeklyReadoutRes] = await Promise.all([
    applyChannel(
      db.from('eicagency_master').select(masterSelect).gte('date', start).lte('date', end)
    ),
    applyChannel(
      db.from('eicagency_master').select(masterSelect).gte('date', compStart).lte('date', compEnd)
    ),
    // Creatives: aggregate ad-level rows from eicagency_meta_ads.
    // NOTE: Supabase caps .select() at 1,000 rows — create an eicagency_creative_rollup RPC
    // if ad count grows beyond that threshold.
    channel !== 'Google'
      ? db
          .from('eicagency_meta_ads')
          .select('ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,leads,final_creative_link,video_id,video_url,headline,primary_text,destination_url,cta_type,is_video')
          .gte('date', start)
          .lte('date', end)
          .order('spend', { ascending: false })
      : Promise.resolve({ data: [] }),
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
  const rawAds   = (adRes.data  ?? []) as unknown as EicAdRow[];

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
  const campMap = new Map<string, EicAgencyCampaignRow>();
  for (const r of currRows) {
    const key = `${r.campaign_name}__${r.source}`;
    const row = campMap.get(key) ?? {
      campaign: r.campaign_name,
      channel:  r.source,
      spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: 0,
    };
    row.spend       += Number(r.cost        ?? 0);
    row.impressions += Number(r.impressions ?? 0);
    row.clicks      += Number(r.clicks      ?? 0);
    row.leads       += rowLeads(r);
    campMap.set(key, row);
  }
  const campaignRows: EicAgencyCampaignRow[] = Array.from(campMap.values())
    .map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpl: c.leads > 0 ? c.spend / c.leads : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25);

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
    metaCreatives,
    budgetPacing,
    weeklyReadout,
  };
}
