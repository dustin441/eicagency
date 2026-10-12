import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export type LargeFleetChannelRow = {
  primaryChannel: string;
  contacts: number;
  contactShare: number;
  mqls: number;
  sqls: number;
  won: number;
  fleets500Plus: number;
  paidInfluenced: number;
};

export type LargeFleetSourceRow = {
  primaryChannel: string;
  primarySource: string;
  contacts: number;
  contactShare: number;
  mqls: number;
  sqls: number;
  won: number;
};

export type LargeFleetContactRow = {
  marketoId: number;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  fleetSizeBand: string;
  fleetSizeValue: number | null;
  primaryChannel: string;
  primarySource: string;
  sourceDetail: string | null;
  dateMql: string | null;
  dateSql: string | null;
  dateClosedWon: string | null;
  lastActivityAt: string | null;
};

export type LargeFleetAnalysis = {
  start: string;
  end: string;
  channels: LargeFleetChannelRow[];
  sources: LargeFleetSourceRow[];
  contacts: LargeFleetContactRow[];
  totals: {
    contacts: number;
    mqls: number;
    sqls: number;
    won: number;
    fleets500Plus: number;
    paidInfluenced: number;
    unidentified: number;
  };
};

function toNumber(value: number | string | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function fetchPrepassLargeFleetAnalysis(start: string, end: string): Promise<LargeFleetAnalysis> {
  const supabase = createServerSupabaseClient();
  const [channelResult, sourceResult, contactResult] = await Promise.all([
    supabase.rpc('prepass_large_fleet_source_summary', { p_start: start, p_end: end }),
    supabase.rpc('prepass_large_fleet_source_detail', { p_start: start, p_end: end }),
    supabase.rpc('prepass_large_fleet_contact_detail', { p_start: start, p_end: end, p_limit: 1000 }),
  ]);

  if (channelResult.error) {
    console.error('[fetchPrepassLargeFleetAnalysis] channel summary failed', channelResult.error);
    throw new Error('Unable to load the large-fleet channel summary');
  }
  if (sourceResult.error) {
    console.error('[fetchPrepassLargeFleetAnalysis] source detail failed', sourceResult.error);
    throw new Error('Unable to load the large-fleet source detail');
  }
  if (contactResult.error) {
    console.error('[fetchPrepassLargeFleetAnalysis] contact detail failed', contactResult.error);
    throw new Error('Unable to load the large-fleet contact detail');
  }

  type ChannelRpcRow = {
    primary_channel?: string | null;
    contacts?: number | string | null;
    contact_share?: number | string | null;
    mqls?: number | string | null;
    sqls?: number | string | null;
    won?: number | string | null;
    fleets_500_plus?: number | string | null;
    paid_influenced?: number | string | null;
  };
  type SourceRpcRow = {
    primary_channel?: string | null;
    primary_source?: string | null;
    contacts?: number | string | null;
    contact_share?: number | string | null;
    mqls?: number | string | null;
    sqls?: number | string | null;
    won?: number | string | null;
  };

  type ContactRpcRow = {
    marketo_id?: number | string | null;
    email?: string | null;
    company?: string | null;
    job_title?: string | null;
    fleet_size_band?: string | null;
    fleet_size_value?: number | string | null;
    primary_channel?: string | null;
    primary_source?: string | null;
    source_detail?: string | null;
    date_mql?: string | null;
    date_sql?: string | null;
    date_closed_won?: string | null;
    last_activity_at?: string | null;
  };

  const channels: LargeFleetChannelRow[] = ((channelResult.data ?? []) as ChannelRpcRow[]).map((row) => ({
    primaryChannel: String(row.primary_channel ?? 'Unidentified'),
    contacts: toNumber(row.contacts),
    contactShare: toNumber(row.contact_share),
    mqls: toNumber(row.mqls),
    sqls: toNumber(row.sqls),
    won: toNumber(row.won),
    fleets500Plus: toNumber(row.fleets_500_plus),
    paidInfluenced: toNumber(row.paid_influenced),
  }));

  const sources: LargeFleetSourceRow[] = ((sourceResult.data ?? []) as SourceRpcRow[]).map((row) => ({
    primaryChannel: String(row.primary_channel ?? 'Unidentified'),
    primarySource: String(row.primary_source ?? 'Unidentified'),
    contacts: toNumber(row.contacts),
    contactShare: toNumber(row.contact_share),
    mqls: toNumber(row.mqls),
    sqls: toNumber(row.sqls),
    won: toNumber(row.won),
  }));

  const contacts: LargeFleetContactRow[] = ((contactResult.data ?? []) as ContactRpcRow[]).map((row) => ({
    marketoId: toNumber(row.marketo_id),
    email: row.email ?? null,
    company: row.company ?? null,
    jobTitle: row.job_title ?? null,
    fleetSizeBand: String(row.fleet_size_band ?? 'Unspecified'),
    fleetSizeValue: row.fleet_size_value == null ? null : toNumber(row.fleet_size_value),
    primaryChannel: String(row.primary_channel ?? 'Unidentified'),
    primarySource: String(row.primary_source ?? 'Unidentified'),
    sourceDetail: row.source_detail ?? null,
    dateMql: row.date_mql ?? null,
    dateSql: row.date_sql ?? null,
    dateClosedWon: row.date_closed_won ?? null,
    lastActivityAt: row.last_activity_at ?? null,
  }));

  const totals = channels.reduce((acc, row) => ({
    contacts: acc.contacts + row.contacts,
    mqls: acc.mqls + row.mqls,
    sqls: acc.sqls + row.sqls,
    won: acc.won + row.won,
    fleets500Plus: acc.fleets500Plus + row.fleets500Plus,
    paidInfluenced: acc.paidInfluenced + row.paidInfluenced,
    unidentified: acc.unidentified + (row.primaryChannel === 'Unidentified' ? row.contacts : 0),
  }), { contacts: 0, mqls: 0, sqls: 0, won: 0, fleets500Plus: 0, paidInfluenced: 0, unidentified: 0 });

  return { start, end, channels, sources, contacts, totals };
}
