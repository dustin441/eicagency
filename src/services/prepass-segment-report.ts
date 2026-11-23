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

export type SegmentCallCounts = { call_leads: number; call_e_won: number; call_c_won: number; meta_e_won: number; meta_c_won: number; enroll_e_won: number; enroll_c_won: number };

export type SegmentCampaignRow = SegmentCounts & SegmentCallCounts & {
  label: string;
  campaign_segment: string | null;
  spend: number | null;
  lead_actions: number | null;
  contact_actions: number | null;
  conversions: number | null;
  fleet100_leads: number;
  meta_forms: number | null;
  meta_found: number | null;
};

export type SegmentChannelRow = SegmentCounts & { channel: string };

export type SegmentReportData = {
  segment: SegmentName;
  window: { start: string; end: string };
  data_through: string | null;
  calls_valid_from: string;
  totals: SegmentCounts & SegmentCallCounts & { fleet100_leads: number; meta_credit_leads: number };
  meta_forms: { forms: number; found: number };
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

export type SegmentExtras = {
  daily: { d: string; leads: number; mql: number; sql: number; won: number; spend: number }[];
  timing: { lead_to_mql: number | null; mql_to_sql: number | null; sql_to_won: number | null; lead_to_won: number | null };
  fleet: { band: string; leads: number; mql: number; sql: number; won: number }[];
  platforms: { platform: string; spend: number; clicks: number; impressions: number }[];
};

const cachedExtras = unstable_cache(
  async (segment: string, start: string, end: string) => {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_segment_extras', { p_segment: segment, p_start: start, p_end: end });
    if (error || data == null) throw new Error(error?.message ?? 'empty result');
    return data as unknown;
  },
  ['prepass-segment-extras-v1'],
  { revalidate: 1800, tags: ['prepass-segment-report'] },
);

/** Daily trend, stage timing, fleet size and platform split for one segment. */
export async function fetchPrepassSegmentExtras(segment: SegmentName, start: string, end: string): Promise<SegmentExtras | null> {
  try {
    return (await cachedExtras(segment, start, end)) as SegmentExtras;
  } catch {
    return null;
  }
}

// ── Budget pacing: this month's spend by platform against the editable monthly budget ──
export type SegmentBudget = {
  focus: string;
  budget: number;
  googleBudgetSpent: number;
  metaBudgetSpent: number;
  stackadaptBudgetSpent: number;
};

export async function fetchPrepassSegmentBudget(segment: 'SMB' | 'ABM' | 'FD360'): Promise<SegmentBudget | null> {
  try {
    const db = createServerSupabaseClient();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const yday = new Date(now);
    yday.setDate(yday.getDate() - 1);
    const ydayStr = yday.toISOString().split('T')[0];
    const monthEnd = ydayStr < monthStart ? monthStart : ydayStr;
    const { data: b } = await db.from('budgets').select('budget').eq('client', segment).single();
    const spend: Record<string, number> = {};
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('master_marketing_performance')
        .select('platform,spend')
        .eq('focus', segment)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date').order('platform').order('campaign_name').order('product')
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      (data ?? []).forEach((r: { platform: string | null; spend: number | null }) => {
        const k = r.platform ?? '';
        spend[k] = (spend[k] ?? 0) + Number(r.spend ?? 0);
      });
      if ((data ?? []).length < 1000) break;
    }
    return {
      focus: segment,
      budget: Number((b as { budget?: number } | null)?.budget ?? 0),
      googleBudgetSpent: spend['Google'] ?? 0,
      metaBudgetSpent: spend['Meta'] ?? 0,
      stackadaptBudgetSpent: spend['StackAdapt'] ?? 0,
    };
  } catch {
    return null;
  }
}

// ── People a segment's campaigns produced that were counted in another segment (fleet of 100+ => ABM) ──
export type SegmentCrossover = { counted_in: string; leads: number; mql: number; won: number };

export async function fetchPrepassSegmentCrossover(segment: SegmentName, start: string, end: string): Promise<SegmentCrossover[]> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_segment_crossover', { p_segment: segment, p_start: start, p_end: end });
    if (error) return [];
    return (data ?? []) as SegmentCrossover[];
  } catch {
    return [];
  }
}

// ── FD360 lead quality from Marketo's own status (leads move on to HubSpot, where stages are not visible) ──
export type Fd360Quality = {
  leads: number; disqualified: number; still_open: number; advanced: number; won: number;
  matured_leads: number; matured_disqualified: number;
};

export async function fetchPrepassFd360Quality(start: string, end: string): Promise<Fd360Quality | null> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_fd360_quality', { p_start: start, p_end: end });
    if (error || !data) return null;
    return data as Fd360Quality;
  } catch {
    return null;
  }
}

// ── How much of online enrollment can be tied to a campaign ──
export type EnrollmentTracking = { enrollments: number; captured: number; with_source_data: number; credited: number; won: number; won_credited: number };

export async function fetchPrepassEnrollmentTracking(start: string, end: string): Promise<EnrollmentTracking | null> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_enrollment_tracking', { p_start: start, p_end: end });
    if (error || !data) return null;
    return data as EnrollmentTracking;
  } catch {
    return null;
  }
}
