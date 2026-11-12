import 'server-only';
import { requireClientAccess as assertClientAccess } from '@/lib/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { parseFilters, type DatabaseFilters } from './prepass-marketo-database-math';
export type DatabaseCounts = { people: number; mql: number; sql: number; won: number };
export type MarketoDatabaseReport = {
  available: boolean; reason?: string; completed_at?: string; freshness_hours?: number; field_count?: number;
  lifetime?: DatabaseCounts;
  cohort?: DatabaseCounts & { mql_sql: number; sql_won: number; unknown_source: number; missing_lead_date: number; invalid_transitions: number; lead_dates: number; mql_dates: number; sql_dates: number; won_dates: number };
  fields?: { mql: boolean; sql: boolean; won: boolean };
  sources?: { label: string; people: number; mql: number; sql: number; won: number; median_won_days: number | null; won_pairs: number }[];
  latest_sources?: { label: string; people: number }[];
  source_options?: string[]; segment_options?: string[];
  velocity?: { label: string; n: number; median_days: number | null }[];
  aging?: { stage: string; people: number; valid_dates: number; median_days: number | null; over_90_days: number }[];
  missing_acquisition_dates?: number;
};
export async function fetchMarketoDatabase(params: Record<string, string | undefined>): Promise<{ report: MarketoDatabaseReport; filters: DatabaseFilters }> {
  // Guard lives in the service too, so future callers cannot bypass the route guard.
  await assertClientAccess('prepass');
  let filters: DatabaseFilters;
  try { filters = parseFilters(params); }
  catch (error) { return { filters: { start: null, end: null, source: null, segment: null, sourceField: 'leadSource' }, report: { available: false, reason: error instanceof Error ? error.message : 'Invalid filters.' } }; }
  try {
    const { data, error } = await createServerSupabaseClient().rpc('prepass_marketo_database_report', {
      p_start: filters.start, p_end: filters.end, p_source: filters.source, p_segment: filters.segment, p_source_field: filters.sourceField,
    });
    if (error || !data) return { filters, report: { available: false, reason: 'Full-database aggregate reporting is unavailable. The reporting migration and verified full snapshot must both be published. No restricted-mirror fallback is used.' } };
    return { filters, report: data as MarketoDatabaseReport };
  } catch {
    return { filters, report: { available: false, reason: 'Full-database reporting connection is unavailable. No Marketo counts can be verified.' } };
  }
}
