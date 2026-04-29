import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, toIsoDate } from '@/lib/date-utils';

export type NsiFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  compMode: 'prev_period' | 'prev_year' | 'custom';
  channel: string;
  campaign: string;
  torpedo: string;
};

type NsiRow = {
  date: string;
  campaign_name: string;
  ad_channel: string | null;
  ad_type: string | null;
  type: string | null;
  torpedo: string | null;
  sub_campaign: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  sessions: number;
  engaged_sessions: number;
  total_users: number;
};

export type NsiSummary = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
  totalUsers: number;
  ctr: number;
  cpc: number;
  engagementRate: number;
  costPerEngagedSession: number;
  costPerConversion: number;
};

export type NsiTimePoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  ctr: number;
  engagementRate: number;
  costPerEngagedSession: number;
  costPerConversion: number;
};

export type NsiChannelRow = {
  channel: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  conversions: number;
  prevConversions: number;
  sessions: number;
  prevSessions: number;
  engagedSessions: number;
  prevEngagedSessions: number;
};

export type NsiCampaignRow = {
  campaign: string;
  channel: string;
  torpedo: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
};

export type NsiAudienceTypeRow = {
  audienceType: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  conversions: number;
  prevConversions: number;
  sessions: number;
  prevSessions: number;
  engagedSessions: number;
  prevEngagedSessions: number;
};

export type NsiCampaignTypeRow = {
  campaignType: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  conversions: number;
  prevConversions: number;
  sessions: number;
  prevSessions: number;
  engagedSessions: number;
  prevEngagedSessions: number;
};

export type NsiSubCampaignRow = {
  subCampaign: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  conversions: number;
  prevConversions: number;
  sessions: number;
  prevSessions: number;
  engagedSessions: number;
  prevEngagedSessions: number;
};

export type NsiDashboardData = {
  filterParams: NsiFilterParams;
  channels: string[];
  torpedoes: string[];
  campaigns: string[];
  summary: NsiSummary;
  prevSummary: NsiSummary;
  timeSeries: NsiTimePoint[];
  channelRows: NsiChannelRow[];
  audienceTypeRows: NsiAudienceTypeRow[];
  campaignTypeRows: NsiCampaignTypeRow[];
  subCampaignRows: NsiSubCampaignRow[];
  campaignRows: NsiCampaignRow[];
};

export function nsiParamsFromSearch(p: Record<string, string | undefined>): NsiFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const compMode = (p.comp_mode as NsiFilterParams['compMode']) ?? 'prev_period';

  let compStart: string;
  let compEnd: string;
  if (compMode === 'custom' && p.comp_start && p.comp_end) {
    compStart = p.comp_start;
    compEnd = p.comp_end;
  } else if (compMode === 'prev_year') {
    const computed = computeCompDates(start, end, 'prev_year');
    compStart = p.comp_start ?? computed.compStart;
    compEnd = p.comp_end ?? computed.compEnd;
  } else {
    const computed = computeCompDates(start, end, 'prev_period');
    compStart = p.comp_start ?? computed.compStart;
    compEnd = p.comp_end ?? computed.compEnd;
  }

  return {
    start,
    end,
    compStart,
    compEnd,
    compMode,
    channel: p.channel ?? 'all',
    campaign: p.campaign ?? 'all',
    torpedo: p.torpedo ?? 'all',
  };
}

const PAGE_SIZE = 1000;

async function fetchPaged<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? 'Query failed');
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function normalize(rows: NsiRow[]): NsiRow[] {
  return rows.map((r) => ({
    ...r,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    cost: Number(r.cost) || 0,
    conversions: Number(r.conversions) || 0,
    sessions: Number(r.sessions) || 0,
    engaged_sessions: Number(r.engaged_sessions) || 0,
    total_users: Number(r.total_users) || 0,
  }));
}

function summarize(rows: NsiRow[]): NsiSummary {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const sessions = rows.reduce((s, r) => s + r.sessions, 0);
  const engagedSessions = rows.reduce((s, r) => s + r.engaged_sessions, 0);
  const totalUsers = rows.reduce((s, r) => s + r.total_users, 0);
  return {
    impressions,
    clicks,
    cost,
    conversions,
    sessions,
    engagedSessions,
    totalUsers,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
    costPerEngagedSession: engagedSessions > 0 ? cost / engagedSessions : 0,
    costPerConversion: conversions > 0 ? cost / conversions : 0,
  };
}

function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function labelForBucket(bucket: string, grain: 'day' | 'week' | 'month'): string {
  if (grain === 'day') {
    return new Date(`${bucket}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (grain === 'week') {
    const s = new Date(`${bucket}T12:00:00`);
    const e = new Date(`${bucket}T12:00:00`);
    e.setDate(e.getDate() + 6);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return new Date(`${bucket}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildTimeSeries(rows: NsiRow[], start: string, end: string): NsiTimePoint[] {
  const span = Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  );
  const grain: 'day' | 'week' | 'month' = span <= 30 ? 'day' : span <= 90 ? 'week' : 'month';

  const map = new Map<string, NsiRow>();
  for (const row of rows) {
    const bucket =
      grain === 'day' ? row.date :
      grain === 'week' ? weekStart(row.date) :
      row.date.slice(0, 7);

    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, { ...row });
    } else {
      map.set(bucket, {
        ...existing,
        impressions: existing.impressions + row.impressions,
        clicks: existing.clicks + row.clicks,
        cost: existing.cost + row.cost,
        conversions: existing.conversions + row.conversions,
        sessions: existing.sessions + row.sessions,
        engaged_sessions: existing.engaged_sessions + row.engaged_sessions,
        total_users: existing.total_users + row.total_users,
      });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, agg]) => {
      const s = summarize([agg]);
      return {
        label: labelForBucket(bucket, grain),
        spend: agg.cost,
        impressions: agg.impressions,
        clicks: agg.clicks,
        sessions: agg.sessions,
        engagedSessions: agg.engaged_sessions,
        conversions: agg.conversions,
        ctr: s.ctr,
        engagementRate: s.engagementRate,
        costPerEngagedSession: s.costPerEngagedSession,
        costPerConversion: s.costPerConversion,
      };
    });
}

function buildChannelRows(current: NsiRow[], previous: NsiRow[]): NsiChannelRow[] {
  const map = new Map<string, NsiChannelRow>();

  function apply(rows: NsiRow[], isPrev: boolean) {
    for (const row of rows) {
      const ch = row.ad_channel ?? 'Unknown';
      const entry = map.get(ch) ?? {
        channel: ch,
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        conversions: 0, prevConversions: 0,
        sessions: 0, prevSessions: 0,
        engagedSessions: 0, prevEngagedSessions: 0,
      };
      if (isPrev) {
        entry.prevImpressions += row.impressions;
        entry.prevClicks += row.clicks;
        entry.prevCost += row.cost;
        entry.prevConversions += row.conversions;
        entry.prevSessions += row.sessions;
        entry.prevEngagedSessions += row.engaged_sessions;
      } else {
        entry.impressions += row.impressions;
        entry.clicks += row.clicks;
        entry.cost += row.cost;
        entry.conversions += row.conversions;
        entry.sessions += row.sessions;
        entry.engagedSessions += row.engaged_sessions;
      }
      map.set(ch, entry);
    }
  }

  apply(current, false);
  apply(previous, true);

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

const PLACEHOLDER = 'Default text if none found';

const AUDIENCE_TYPE_ORDER = ['Contractor', 'Distributor'];

function buildAudienceTypeRows(current: NsiRow[], previous: NsiRow[]): NsiAudienceTypeRow[] {
  const map = new Map<string, NsiAudienceTypeRow>();

  function apply(rows: NsiRow[], isPrev: boolean) {
    for (const row of rows) {
      const raw = row.type?.trim();
      if (!raw) continue;
      const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      const entry = map.get(label) ?? {
        audienceType: label,
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        conversions: 0, prevConversions: 0,
        sessions: 0, prevSessions: 0,
        engagedSessions: 0, prevEngagedSessions: 0,
      };
      if (isPrev) {
        entry.prevImpressions     += row.impressions;
        entry.prevClicks          += row.clicks;
        entry.prevCost            += row.cost;
        entry.prevConversions     += row.conversions;
        entry.prevSessions        += row.sessions;
        entry.prevEngagedSessions += row.engaged_sessions;
      } else {
        entry.impressions     += row.impressions;
        entry.clicks          += row.clicks;
        entry.cost            += row.cost;
        entry.conversions     += row.conversions;
        entry.sessions        += row.sessions;
        entry.engagedSessions += row.engaged_sessions;
      }
      map.set(label, entry);
    }
  }

  apply(current, false);
  apply(previous, true);

  // Fixed order first, then any unexpected values alphabetically
  const ordered = AUDIENCE_TYPE_ORDER.map((t) => map.get(t)).filter(Boolean) as NsiAudienceTypeRow[];
  const extra = Array.from(map.values()).filter((r) => !AUDIENCE_TYPE_ORDER.includes(r.audienceType));
  return [...ordered, ...extra];
}

const CAMPAIGN_TYPE_ORDER = [
  'Search',
  'Performance Max',
  'Display',
  'LinkedIn',
  'Facebook',
];

function getCampaignTypeLabel(adChannel: string | null, adType: string | null): string | null {
  if (adChannel === 'Google Pmax') return 'Performance Max';
  if (adChannel === 'Google' && adType === 'PPC') return 'Search';
  if (adChannel === 'Google' && adType === 'Banner') return 'Display';
  if (adChannel === 'LinkedIn') return 'LinkedIn';
  if (adChannel === 'Facebook') return 'Facebook';
  return null;
}

function buildCampaignTypeRows(current: NsiRow[], previous: NsiRow[]): NsiCampaignTypeRow[] {
  const map = new Map<string, NsiCampaignTypeRow>();

  function apply(rows: NsiRow[], isPrev: boolean) {
    for (const row of rows) {
      const label = getCampaignTypeLabel(row.ad_channel, row.ad_type);
      if (!label) continue;
      const entry = map.get(label) ?? {
        campaignType: label,
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        conversions: 0, prevConversions: 0,
        sessions: 0, prevSessions: 0,
        engagedSessions: 0, prevEngagedSessions: 0,
      };
      if (isPrev) {
        entry.prevImpressions     += row.impressions;
        entry.prevClicks          += row.clicks;
        entry.prevCost            += row.cost;
        entry.prevConversions     += row.conversions;
        entry.prevSessions        += row.sessions;
        entry.prevEngagedSessions += row.engaged_sessions;
      } else {
        entry.impressions     += row.impressions;
        entry.clicks          += row.clicks;
        entry.cost            += row.cost;
        entry.conversions     += row.conversions;
        entry.sessions        += row.sessions;
        entry.engagedSessions += row.engaged_sessions;
      }
      map.set(label, entry);
    }
  }

  apply(current, false);
  apply(previous, true);

  return CAMPAIGN_TYPE_ORDER
    .map((t) => map.get(t))
    .filter((r): r is NsiCampaignTypeRow => r !== undefined && r.cost > 0);
}

function buildSubCampaignRows(current: NsiRow[], previous: NsiRow[]): NsiSubCampaignRow[] {
  const map = new Map<string, NsiSubCampaignRow>();

  function apply(rows: NsiRow[], isPrev: boolean) {
    for (const row of rows) {
      const key = row.sub_campaign && row.sub_campaign !== PLACEHOLDER ? row.sub_campaign : null;
      if (!key) continue;
      const entry = map.get(key) ?? {
        subCampaign: key,
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        conversions: 0, prevConversions: 0,
        sessions: 0, prevSessions: 0,
        engagedSessions: 0, prevEngagedSessions: 0,
      };
      if (isPrev) {
        entry.prevImpressions    += row.impressions;
        entry.prevClicks         += row.clicks;
        entry.prevCost           += row.cost;
        entry.prevConversions    += row.conversions;
        entry.prevSessions       += row.sessions;
        entry.prevEngagedSessions += row.engaged_sessions;
      } else {
        entry.impressions    += row.impressions;
        entry.clicks         += row.clicks;
        entry.cost           += row.cost;
        entry.conversions    += row.conversions;
        entry.sessions       += row.sessions;
        entry.engagedSessions += row.engaged_sessions;
      }
      map.set(key, entry);
    }
  }

  apply(current, false);
  apply(previous, true);

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

function buildCampaignRows(rows: NsiRow[]): NsiCampaignRow[] {
  const map = new Map<string, NsiCampaignRow>();
  for (const row of rows) {
    const key = `${row.campaign_name}||${row.ad_channel ?? ''}`;
    const entry = map.get(key) ?? {
      campaign: row.campaign_name,
      channel: row.ad_channel ?? 'Unknown',
      torpedo: row.torpedo ?? '',
      impressions: 0, clicks: 0, cost: 0, conversions: 0,
      sessions: 0, engagedSessions: 0,
    };
    entry.impressions += row.impressions;
    entry.clicks += row.clicks;
    entry.cost += row.cost;
    entry.conversions += row.conversions;
    entry.sessions += row.sessions;
    entry.engagedSessions += row.engaged_sessions;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 30);
}

export async function fetchNsiDashboardData(params: NsiFilterParams): Promise<NsiDashboardData> {
  const supabase = createSpartacoSupabaseClient();
  const SELECT = 'date,campaign_name,ad_channel,ad_type,type,torpedo,sub_campaign,impressions,clicks,cost,conversions,sessions,engaged_sessions,total_users';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any): any {
    if (params.channel === 'Google') {
      q = q.in('ad_channel', ['Google', 'Google Pmax']);
    } else if (params.channel !== 'all') {
      q = q.eq('ad_channel', params.channel);
    }
    if (params.campaign !== 'all') q = q.eq('campaign_name', params.campaign);
    if (params.torpedo !== 'all') q = q.eq('torpedo', params.torpedo);
    return q;
  }

  const [current, previous, channelData, torpedoData, campaignData] = await Promise.all([
    fetchPaged<NsiRow>(async (from, to) =>
      applyFilters(
        supabase
          .from('nsi_master_campaign_daily')
          .select(SELECT)
          .gte('date', params.start)
          .lte('date', params.end)
          .order('date', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPaged<NsiRow>(async (from, to) =>
      applyFilters(
        supabase
          .from('nsi_master_campaign_daily')
          .select(SELECT)
          .gte('date', params.compStart)
          .lte('date', params.compEnd)
          .order('date', { ascending: true })
          .range(from, to)
      )
    ),
    supabase
      .from('nsi_master_campaign_daily')
      .select('ad_channel')
      .not('ad_channel', 'is', null),
    supabase
      .from('nsi_master_campaign_daily')
      .select('torpedo')
      .not('torpedo', 'is', null),
    supabase
      .from('nsi_master_campaign_daily')
      .select('campaign_name'),
  ]);

  const curr = normalize(current);
  const prev = normalize(previous);

  const PAID_CHANNEL_ORDER = ['Google', 'LinkedIn', 'Facebook'];
  const rawChannels = new Set(
    ((channelData.data ?? []) as unknown as { ad_channel: string }[])
      .map((r) => (r.ad_channel === 'Google Pmax' ? 'Google' : r.ad_channel))
      .filter(Boolean)
  );
  const channels = PAID_CHANNEL_ORDER.filter((ch) => rawChannels.has(ch));

  const torpedoes = [
    ...new Set(
      ((torpedoData.data ?? []) as unknown as { torpedo: string }[])
        .map((r) => r.torpedo)
        .filter((v) => Boolean(v) && v !== 'Default text if none found')
    ),
  ].sort();

  const campaigns = [
    ...new Set(
      ((campaignData.data ?? []) as unknown as { campaign_name: string }[])
        .map((r) => r.campaign_name)
        .filter(Boolean)
    ),
  ].sort();

  return {
    filterParams: params,
    channels,
    torpedoes,
    campaigns,
    summary: summarize(curr),
    prevSummary: summarize(prev),
    timeSeries: buildTimeSeries(curr, params.start, params.end),
    channelRows: buildChannelRows(curr, prev),
    audienceTypeRows: buildAudienceTypeRows(curr, prev),
    campaignTypeRows: buildCampaignTypeRows(curr, prev),
    subCampaignRows: buildSubCampaignRows(curr, prev),
    campaignRows: buildCampaignRows(curr),
  };
}
