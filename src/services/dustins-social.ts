import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type DustinsSocialPost = {
  id: string;
  platform: string;
  post_id: string | null;
  page_name: string | null;
  title: string | null;
  publish_time: string | null;
  publish_date: string | null;
  permalink: string | null;
  post_type: string | null;
  comments: number;
  interactions: number;
  reactions: number;
  saves: number;
  shares: number;
  viewers: number;
  views: number;
  impressions: number;
  pillar: string | null;
  angle: string | null;
  planning_note: string | null;
};

export type DustinsSocialDailyMetric = {
  id: string;
  platform: string;
  page_name: string | null;
  metric_date: string;
  impressions: number;
  interactions: number;
  net_follows: number;
  reactions: number;
  comments_and_replies: number;
  viewers: number;
  views: number;
};

export type DustinsSocialImport = {
  id: string;
  source_label: string;
  report_start_date: string | null;
  report_end_date: string | null;
  content_file_name: string | null;
  profile_file_name: string | null;
  clickup_task_url: string | null;
  notes: string | null;
  created_at: string;
};

export type DustinsSocialDashboardData = {
  posts: DustinsSocialPost[];
  dailyMetrics: DustinsSocialDailyMetric[];
  imports: DustinsSocialImport[];
  setupRequired: boolean;
  setupMessage?: string;
};

function createDustinsSocialSupabaseClient() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

function isMissingTableError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST205');
}

export async function fetchDustinsSocialDashboardData(): Promise<DustinsSocialDashboardData> {
  const db = createDustinsSocialSupabaseClient();
  const [postsRes, dailyRes, importsRes] = await Promise.all([
    db.from('dustins_social_posts').select('*').order('publish_time', { ascending: false, nullsFirst: false }).limit(500),
    db.from('dustins_social_daily_metrics').select('*').order('metric_date', { ascending: false }).limit(500),
    db.from('dustins_social_imports').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  if (isMissingTableError(postsRes.error) || isMissingTableError(dailyRes.error) || isMissingTableError(importsRes.error)) {
    return {
      posts: [],
      dailyMetrics: [],
      imports: [],
      setupRequired: true,
      setupMessage: 'Apply supabase/dustins_social.sql in the EIC content Supabase project, then import the monthly social CSVs.',
    };
  }

  if (postsRes.error) throw postsRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (importsRes.error) throw importsRes.error;

  return {
    posts: (postsRes.data ?? []) as DustinsSocialPost[],
    dailyMetrics: (dailyRes.data ?? []) as DustinsSocialDailyMetric[],
    imports: (importsRes.data ?? []) as DustinsSocialImport[],
    setupRequired: false,
  };
}
