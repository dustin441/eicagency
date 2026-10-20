import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  buildElevateDashboardData,
  ELEVATE_CAMPAIGN_START,
  ELEVATE_EVENT_DATE,
  type ElevateDashboardData,
  type ElevateParams,
  type ElevatePerformanceRow,
} from './elevate-analytics-core';

export * from './elevate-analytics-core';

const PAGE_SIZE = 1000;
const FIELDS = 'date,platform,account_id,campaign_id,campaign_name,creative_id,creative_name,impressions,clicks,spend,form_fills,preview_url,destination_url,metadata';

async function fetchRows(start: string, end: string, channel: string = 'all') {
  const supabase = createServerSupabaseClient();
  const rows: ElevatePerformanceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('elevate_performance')
      .select(FIELDS)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('platform', { ascending: true })
      .order('creative_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (channel !== 'all') query = query.eq('platform', channel);
    const { data, error } = await query;
    if (error) return { rows: [] as ElevatePerformanceRow[], error: { code: error.code, message: error.message } };
    rows.push(...((data ?? []) as ElevatePerformanceRow[]));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

export async function fetchElevateData(params: ElevateParams): Promise<ElevateDashboardData> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const eventEve = new Date(`${ELEVATE_EVENT_DATE}T00:00:00Z`);
  eventEve.setUTCDate(eventEve.getUTCDate() - 1);
  const pacingEnd = [yesterday.toISOString().slice(0, 10), eventEve.toISOString().slice(0, 10)].sort()[0];
  const [selection, pacing] = await Promise.all([
    fetchRows(params.start, params.end, params.channel),
    fetchRows(ELEVATE_CAMPAIGN_START, pacingEnd),
  ]);

  if (selection.error) console.error('[Elevate] performance query failed', selection.error);
  if (pacing.error) console.error('[Elevate] pacing query failed', pacing.error);

  return buildElevateDashboardData(
    selection.error ? [] : selection.rows,
    params,
    selection.error ? 'Elevate performance data is temporarily unavailable.' : null,
    pacing.error ? [] : pacing.rows,
    pacing.error ? 'Budget pacing data is temporarily unavailable.' : null,
  );
}
