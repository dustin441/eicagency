import 'server-only';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { aggregateKangRows, fetchKangPages, type KangRow } from './kang-metrics';

export type KangParams = { start: string; end: string };
export type KangDashboardData = ReturnType<typeof aggregateKangRows> & {
  params: KangParams;
  status: 'ready' | 'empty' | 'unavailable';
};

// The reporting client uses SPARTACO_SUPABASE_* for lozgnyxixzfxokllevtb.
// Auth is enforced by the page before calling this service. Never use the auth/anon client here.
export async function fetchKangData(params: KangParams): Promise<KangDashboardData> {
  try {
    const client = createEicSupabaseClient();
    const rows = await fetchKangPages(async (from, to) => {
      const { data, error } = await client.from('kang_meta_daily')
        .select('account_id,date,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,link_clicks,cost,landing_page_views,updated_at')
        .gte('date', params.start).lte('date', params.end)
        .order('date', { ascending: true }).order('ad_id', { ascending: true })
        .order('account_id', { ascending: true }) // Complete PK tie-breaker if multiple accounts exist.
        .range(from, to);
      return { data: data as unknown as KangRow[] | null, error };
    });
    return { ...aggregateKangRows(rows), params, status: rows.length ? 'ready' : 'empty' };
  } catch {
    // A missing table/config or any failed page is unavailable, never a zero or partial result.
    console.error('[kang] Reporting source unavailable. Check configuration and kang_meta_daily ingestion.');
    return { ...aggregateKangRows([]), params, status: 'unavailable' };
  }
}
