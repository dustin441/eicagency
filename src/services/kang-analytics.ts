import 'server-only';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { aggregateKangRows, fetchKangPages, type KangRow } from './kang-metrics';
import { buildKangCreatives, KANG_ACCOUNT_ID, type KangCreativeMetadata } from './kang-creatives';
import type { TrafficMetaCreative as MetaCreative } from '../lib/creative-traffic';

export type KangParams = { start: string; end: string };
export type KangDashboardData = ReturnType<typeof aggregateKangRows> & {
  params: KangParams;
  status: 'ready' | 'empty' | 'unavailable';
  creatives: MetaCreative[];
  creativeMetadataStatus: 'ready' | 'unavailable';
};

// The reporting client uses SPARTACO_SUPABASE_* for lozgnyxixzfxokllevtb.
// Auth is enforced by the page before calling this service. Never use the auth/anon client here.
export async function fetchKangData(params: KangParams): Promise<KangDashboardData> {
  try {
    const client = createEicSupabaseClient();
    const rows = await fetchKangPages(async (from, to) => {
      const { data, error } = await client.from('kang_meta_daily')
        .select('account_id,date,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,link_clicks,cost,landing_page_views,updated_at')
        .eq('account_id', KANG_ACCOUNT_ID)
        .gte('date', params.start).lte('date', params.end)
        .order('date', { ascending: true }).order('ad_id', { ascending: true })
        .order('account_id', { ascending: true }) // Complete PK tie-breaker if multiple accounts exist.
        .range(from, to);
      return { data: data as unknown as KangRow[] | null, error };
    });
    // Metadata failure must not change fact totals or reporting availability.
    let metadata: KangCreativeMetadata[] = [];
    let creativeMetadataStatus: 'ready' | 'unavailable' = 'ready';
    try {
      const adIds = [...new Set(rows.map(row => row.ad_id))];
      // Bound IN queries and stay below the API response cap. PK guarantees one row per ad.
      for (let from = 0; from < adIds.length; from += 100) {
        const { data, error } = await client.from('kang_meta_creatives')
          .select('account_id,ad_id,creative_id,ad_name,headline,primary_text,image_url,video_url,video_id,destination_url,cta_type,page_name,page_profile_image_url,preview_url,updated_at')
          .eq('account_id', KANG_ACCOUNT_ID).in('ad_id', adIds.slice(from, from + 100));
        if (error || !data) throw new Error('Creative metadata unavailable');
        metadata.push(...data as unknown as KangCreativeMetadata[]);
      }
    } catch {
      metadata = [];
      creativeMetadataStatus = 'unavailable';
      console.error('[kang] Creative metadata unavailable. Traffic facts remain unchanged.');
    }
    return { ...aggregateKangRows(rows), creatives: buildKangCreatives(rows, metadata), creativeMetadataStatus, params, status: rows.length ? 'ready' : 'empty' };
  } catch {
    // A missing table/config or any failed page is unavailable, never a zero or partial result.
    console.error('[kang] Reporting source unavailable. Check configuration and kang_meta_daily ingestion.');
    return { ...aggregateKangRows([]), creatives: [], creativeMetadataStatus: 'unavailable', params, status: 'unavailable' };
  }
}
