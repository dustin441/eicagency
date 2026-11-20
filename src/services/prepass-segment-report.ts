import { unstable_cache } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type SegmentName = 'SMB' | 'ABM' | 'FD360';

export type SegmentCounts = {
  leads: number;
  c_mql: number;
  c_sql: number;
  c_won: number;
  e_mql: number;
  e_sql: number;
  e_won: number;
};

export type SegmentCallCounts = { call_leads: number; call_e_won: number; call_c_won: number };

export type SegmentCampaignRow = SegmentCounts & SegmentCallCounts & {
  label: string;
  campaign_segment: string | null;
  spend: number | null;
  lead_actions: number | null;
  contact_actions: number | null;
  conversions: number | null;
  fleet100_leads: number;
};

export type SegmentChannelRow = SegmentCounts & { channel: string };

export type SegmentReportData = {
  segment: SegmentName;
  window: { start: string; end: string };
  data_through: string | null;
  calls_valid_from: string;
  totals: SegmentCounts & SegmentCallCounts & { fleet100_leads: number };
  segment_spend: number;
  campaigns: SegmentCampaignRow[];
  channels: SegmentChannelRow[];
  unmapped_spend: { campaign: string; spend: number }[];
};

/** Marketo summaries change nightly; each segment report is cached for 30 minutes per date range. Errors are never cached. */
const cachedReport = unstable_cache(
  async (segment: string, start: string, end: string) => {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_segment_report', { p_segment: segment, p_start: start, p_end: end });
    if (error || data == null) throw new Error(error?.message ?? 'empty result');
    return data as unknown;
  },
  ['prepass-segment-report-v1'],
  { revalidate: 1800, tags: ['prepass-segment-report'] },
);

/** One person, one segment: a fleet of 100+ vehicles is ABM, otherwise the segment of the campaign they came from. */
export async function fetchPrepassSegmentReport(segment: SegmentName, start: string, end: string): Promise<SegmentReportData | null> {
  try {
    return (await cachedReport(segment, start, end)) as SegmentReportData;
  } catch {
    return null;
  }
}
