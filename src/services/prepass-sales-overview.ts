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
