import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildElevateDashboardData, type ElevateDashboardData, type ElevateParams, type ElevatePerformanceRow } from './elevate-analytics-core';

export * from './elevate-analytics-core';

export async function fetchElevateData(params: ElevateParams): Promise<ElevateDashboardData> {
  const supabase = createServerSupabaseClient();
  const rows: ElevatePerformanceRow[] = [];
  const pageSize = 1000;
  let sourceError: { code: string; message: string } | null = null;

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('elevate_performance')
      .select('date,platform,account_id,campaign_id,campaign_name,creative_id,creative_name,impressions,clicks,spend,form_fills,preview_url,destination_url,metadata')
      .gte('date', params.start)
      .lte('date', params.end)
      .order('date', { ascending: true })
      .order('platform', { ascending: true })
      .order('creative_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (params.channel !== 'all') query = query.eq('platform', params.channel);
    const { data, error } = await query;
    if (error) {
      sourceError = { code: error.code, message: error.message };
      break;
    }
    rows.push(...((data ?? []) as ElevatePerformanceRow[]));
    if (!data || data.length < pageSize) break;
  }

  if (sourceError) {
    console.error('[Elevate] performance query failed', sourceError);
  }
  return buildElevateDashboardData(
    sourceError ? [] : rows,
    params,
    sourceError ? 'Elevate performance data is temporarily unavailable.' : null,
  );
}
