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

export type LargeFleetAnalysis = {
  start: string;
  end: string;
  channels: LargeFleetChannelRow[];
  sources: LargeFleetSourceRow[];
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
  const [channelResult, sourceResult] = await Promise.all([
    supabase.rpc('prepass_large_fleet_source_summary', { p_start: start, p_end: end }),
    supabase.rpc('prepass_large_fleet_source_detail', { p_start: start, p_end: end }),
  ]);

  if (channelResult.error) {
    console.error('[fetchPrepassLargeFleetAnalysis] channel summary failed', channelResult.error);
    throw new Error('Unable to load the large-fleet channel summary');
  }
  if (sourceResult.error) {
    console.error('[fetchPrepassLargeFleetAnalysis] source detail failed', sourceResult.error);
    throw new Error('Unable to load the large-fleet source detail');
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

  const totals = channels.reduce((acc, row) => ({
    contacts: acc.contacts + row.contacts,
    mqls: acc.mqls + row.mqls,
    sqls: acc.sqls + row.sqls,
    won: acc.won + row.won,
    fleets500Plus: acc.fleets500Plus + row.fleets500Plus,
    paidInfluenced: acc.paidInfluenced + row.paidInfluenced,
    unidentified: acc.unidentified + (row.primaryChannel === 'Unidentified' ? row.contacts : 0),
  }), { contacts: 0, mqls: 0, sqls: 0, won: 0, fleets500Plus: 0, paidInfluenced: 0, unidentified: 0 });

  return { start, end, channels, sources, totals };
}
