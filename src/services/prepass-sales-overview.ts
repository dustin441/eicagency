import { createServerSupabaseClient } from '@/lib/supabase-server';

export type SalesOverviewStageTotals = { lead?: number; mql?: number; sql?: number; won?: number };

export type SalesOverviewChannelRow = { channel: string; leads: number; mqls: number; sqls: number; won: number };

export type SalesOverviewCohortRow = SalesOverviewChannelRow & {
  days_to_mql: number | null;
  days_mql_to_sql: number | null;
  days_sql_to_won: number | null;
  days_created_to_won: number | null;
};

export type SalesOverviewMonthlyRow = { month: string; channel: string; stage: 'lead' | 'mql' | 'sql' | 'won'; n: number };

export type SalesOverviewSourceRow = SalesOverviewChannelRow & { lead_source: string; utm_medium: string; utm_source: string };

export type SalesOverviewEventRow = { event: string; leads: number; mqls: number; sqls: number; won: number };

export type SalesOverviewSpendRow = {
  platform: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  first_day: string | null;
  last_day: string | null;
  days: number;
};

export type SalesOverviewCampaignRow = {
  platform: 'Meta' | 'Google';
  campaign: string;
  spend: number;
  clicks: number | null;
  impressions: number | null;
  leads: number;
  mqls: number;
  sqls: number;
  won: number;
};

export type SalesOverviewData = {
  window: { start: string; end: string };
  source: {
    people_loaded: number;
    complete_from: string | null;
    earliest_created: string | null;
    latest_created: string | null;
    data_through: string | null;
    last_sync: string | null;
  };
  totals: SalesOverviewStageTotals;
  by_channel: SalesOverviewChannelRow[];
  monthly: SalesOverviewMonthlyRow[];
  cohort: SalesOverviewCohortRow[];
  sources: SalesOverviewSourceRow[];
  events: SalesOverviewEventRow[];
  spend: SalesOverviewSpendRow[];
  campaigns: SalesOverviewCampaignRow[];
  match: {
    meta_people_matched: number;
    meta_people_total: number;
    google_people_matched: number;
    google_people_total: number;
    meta_spend_matched: number;
    google_spend_matched: number;
  };
};

export type SalesOverviewResult =
  | { available: true; data: SalesOverviewData }
  | { available: false; reason: string };

/**
 * Read-only summary of the Marketo mirror (schema mk) plus ad-platform spend already in the warehouse.
 * One database function does the aggregation so the page never scans people rows.
 */
export async function fetchPrepassSalesOverview(start: string, end: string): Promise<SalesOverviewResult> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_sales_overview', { p_start: start, p_end: end });
  if (error || !data) {
    return {
      available: false,
      reason: 'The Marketo sales overview source is not available right now. Existing PrePass reports are unaffected.',
    };
  }
  return { available: true, data: data as SalesOverviewData };
}

export type SalesYoYChannelRow = { channel: string; leads: number; won60: number; won_sofar: number };
export type SalesYoYMonthlyRow = { month: string; channel: string; leads: number; won60: number };
export type SalesYoYSpendRow = { month: string; meta: number; google: number };

export type SalesYoYData = {
  window: { start: string; end: string };
  effective_start: string;
  mature_through: string;
  prior_window: { start: string; end: string };
  first_complete_month: string;
  current: SalesYoYChannelRow[];
  prior: SalesYoYChannelRow[];
  monthly: SalesYoYMonthlyRow[];
  spend: SalesYoYSpendRow[];
};

/**
 * Closed-won year over year by source: people created in the window versus the same dates a year earlier,
 * wins counted within 60 days of creation so both years get equal time to convert.
 * Returns null if the source is unavailable so the rest of the page still renders.
 */
export async function fetchPrepassSalesYoY(start: string, end: string): Promise<SalesYoYData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_sales_yoy', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as SalesYoYData;
}

export type EnrollmentTrackingWeek = {
  week: string;
  enrollments: number;
  captured: number;
  captured_with_attribution: number;
  has_click_id_now: number;
  has_any_attribution_now: number;
};
export type EnrollmentTrackingOutcome = { status: string; code: string; n: number; with_click_id: number; with_attribution: number };
export type EnrollmentTrackingData = {
  window: { start: string; end: string };
  capture_start: string | null;
  effective_start: string;
  weekly: EnrollmentTrackingWeek[];
  outcomes: EnrollmentTrackingOutcome[];
};

/** How much of online enrollment the cookie capture reaches, and how much of it carries a click ID or UTMs. */
export async function fetchPrepassEnrollmentTracking(start: string, end: string): Promise<EnrollmentTrackingData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_enrollment_tracking', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as EnrollmentTrackingData;
}

export type SpendEnrollmentLag = { lag: number; google_enrollments: number | null; meta_enrollments: number | null; google_wins: number | null; meta_wins: number | null; n: number };
export type SpendEnrollmentData = {
  window: { start: string; end: string };
  weeks: number;
  weekly: { week: string; google: number; meta: number; enrollments: number; selfserve_wins: number }[];
  lags: SpendEnrollmentLag[];
  week_over_week: { google_wins: number | null; meta_wins: number | null; google_enrollments: number | null; meta_enrollments: number | null };
  ga4: {
    months: number;
    google_spend_vs_google_sessions: number | null;
    google_sessions_vs_wins: number | null;
    meta_spend_vs_meta_sessions: number | null;
    meta_sessions_vs_wins: number | null;
  };
  spend_share: { google: number | null; meta: number | null };
};

/** Weekly ad spend against new enrollments and enrollment-plus-organic wins, with correlations. A pattern, not proof of cause. */
export async function fetchPrepassSpendEnrollment(start: string, end: string): Promise<SpendEnrollmentData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_spend_vs_enrollment', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as SpendEnrollmentData;
}

export type ConversionPathRow = { path: string; leads: number; mqls: number; wins60: number; wins: number; median_days: number | null };
export type ConversionEntryRow = { entry: string; leads: number; mqls: number; wins60: number; wins: number; median_days: number | null };
export type ConversionFleetRow = {
  band: string; leads: number; mqls: number; sqls: number; wins60: number; wins: number; median_days: number | null; pct_paid: number; pct_selfserve: number;
};
export type ConversionPageRow = { page: string; leads: number; mqls: number; wins60: number; median_days: number | null };
export type ConversionFormRow = { form: string; leads: number; mqls: number; wins60: number };
export type ConversionListRow = { list: string; leads: number; mqls: number; wins60: number };
export type ConversionPathsData = {
  window: { start: string; end: string };
  path_window_start: string;
  paths: ConversionPathRow[];
  entry: ConversionEntryRow[];
  fleet: ConversionFleetRow[];
  pages: ConversionPageRow[];
  forms: ConversionFormRow[];
  lists: ConversionListRow[];
};

/** How people actually convert: phone vs self-enrollment, how they entered, fleet size, landing pages, forms and lists. */
export async function fetchPrepassConversionPaths(start: string, end: string): Promise<ConversionPathsData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_conversion_paths', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as ConversionPathsData;
}

export type CallCampaignRow = {
  campaign: string;
  calls: number;
  callers: number;
  matched_callers: number;
  mqls_after: number;
  wins_after: number;
  pct_over_60s: number;
  spend: number;
};
export type CallCampaignsData = {
  window: { start: string; end: string };
  tracking_started: string;
  campaigns: CallCampaignRow[];
  monthly: { month: string; calls: number }[];
};

/** Phone calls by Google campaign: volume, how many callers match a Marketo person, and wins after the first call. */
export async function fetchPrepassCallCampaigns(start: string, end: string): Promise<CallCampaignsData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_call_campaigns', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as CallCampaignsData;
}

export type SalesReadout = {
  id: number;
  generated_at: string;
  month_start: string;
  month_end: string;
  generated_by: string;
  summary: string[];
  working: string[];
  not_working: string[];
  tested: string[];
  do_next: string[];
  watch_out: string[];
};

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Latest monthly readout (written by the monthly AI workflow, or by hand until that exists). Null if none yet. */
export async function fetchPrepassSalesReadout(): Promise<SalesReadout | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('prepass_sales_readout')
    .select('id,generated_at,month_start,month_end,generated_by,summary,working,not_working,tested,do_next,watch_out')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: Number(r.id),
    generated_at: String(r.generated_at),
    month_start: String(r.month_start),
    month_end: String(r.month_end),
    generated_by: String(r.generated_by ?? ''),
    summary: asList(r.summary),
    working: asList(r.working),
    not_working: asList(r.not_working),
    tested: asList(r.tested),
    do_next: asList(r.do_next),
    watch_out: asList(r.watch_out),
  };
}

export type SalesNoteKind = 'test' | 'change' | 'note';
export type SalesNote = { id: number; note_date: string; kind: SalesNoteKind; body: string; author: string | null };

/** The team's own log of what was tested or changed. The monthly readout reads this. */
export async function fetchPrepassSalesNotes(limit = 15): Promise<SalesNote[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('prepass_sales_notes')
    .select('id,note_date,kind,body,author')
    .order('note_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as SalesNote[];
}

export type OppGroupRow = { grp: string; people: number; mqls: number; sqls: number; wins60: number; wins: number; median_days_to_opp: number | null; median_days_to_win: number | null };
export type OppTimingRow = { grp: string; people: number; mqls: number; wins60: number; median_days_to_win: number | null };
export type OppSpeedRow = { channel: string; wins60: number; d7: number; d30: number; d60: number };
export type OpportunityPathsData = {
  window: { start: string; end: string };
  groups: OppGroupRow[];
  timing: OppTimingRow[];
  speed_by_channel: OppSpeedRow[];
};

/** How wins arrive: when the opportunity appeared, how fast the win closed, and what the opportunity was named. */
export async function fetchPrepassOpportunityPaths(start: string, end: string): Promise<OpportunityPathsData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_opportunity_paths', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as OpportunityPathsData;
}

export type OppPipelineData = {
  window: { start: string; end: string };
  people_with_opportunity: number;
  paths: { path: 'sales' | 'auto'; people: number; won: number; lost: number; open: number; median_days_to_win: number | null }[];
  types: { type: string; people: number; won: number; lost: number; open: number }[];
  lost_reasons: { reason: string; people: number; sales_path: number }[];
  stage_days: { created_to_discovery: number | null; discovery_to_forecast: number | null; forecast_to_close: number | null };
};

/** Opportunity outcomes from Marketo opportunity updates: won, lost and open, by type, with why deals were lost. */
export async function fetchPrepassOpportunityPipeline(start: string, end: string): Promise<OppPipelineData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_opportunity_pipeline', { p_start: start, p_end: end });
  if (error || !data) return null;
  return data as OppPipelineData;
}
