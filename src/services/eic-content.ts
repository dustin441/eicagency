import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type EicContentEpisode = { id: string; title: string; slug: string | null; status: string; story_pillar: string | null; story_arc: string | null; output_folder_url: string | null; main_blog_doc_url: string | null; youtube_doc_url: string | null; newsletter_doc_url: string | null; created_at: string; updated_at: string; };
export type EicContentAsset = { id: string; episode_id: string; asset_type: string; title: string | null; file_name: string | null; drive_file_id: string | null; drive_url: string | null; mime_type: string | null; story_phase: string | null; sort_order: number | null; };
export type EicContentPost = { id: string; episode_id: string; asset_id: string | null; platform: string; post_type: string; title: string; story_phase: string | null; scheduled_date: string | null; scheduled_time: string | null; status: string; approval_status: string; copy_doc_url: string | null; asset_url: string | null; destination_url: string | null; ghl_status: string; ghl_post_id: string | null; notes: string | null; created_at: string; updated_at: string; };
export type EicContentDashboardData = { episodes: EicContentEpisode[]; assets: EicContentAsset[]; posts: EicContentPost[]; setupRequired: boolean; setupMessage?: string; };

function isMissingTableError(error: unknown) { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST205'); }
function createEicContentSupabaseClient() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

export async function fetchEicContentDashboardData(): Promise<EicContentDashboardData> {
  const db = createEicContentSupabaseClient();
  const [episodesRes, assetsRes, postsRes] = await Promise.all([
    db.from('eic_content_episodes').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('eic_content_assets').select('*').order('sort_order', { ascending: true }),
    db.from('eic_content_posts').select('*').order('scheduled_date', { ascending: true, nullsFirst: false }).order('scheduled_time', { ascending: true, nullsFirst: false }),
  ]);
  if (isMissingTableError(episodesRes.error) || isMissingTableError(assetsRes.error) || isMissingTableError(postsRes.error)) return { episodes: [], assets: [], posts: [], setupRequired: true, setupMessage: 'Apply supabase/eic_content_flywheel.sql and sync content rows.' };
  if (episodesRes.error) throw episodesRes.error;
  if (assetsRes.error) throw assetsRes.error;
  if (postsRes.error) throw postsRes.error;
  return { episodes: (episodesRes.data ?? []) as EicContentEpisode[], assets: (assetsRes.data ?? []) as EicContentAsset[], posts: (postsRes.data ?? []) as EicContentPost[], setupRequired: false };
}
