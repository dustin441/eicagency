import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type GoodGameOrganicSocialPost = {
  id: string;
  brand: string;
  platform: string;
  post_id: string | null;
  page_id: string | null;
  page_name: string | null;
  title: string | null;
  duration_seconds: number | null;
  publish_time: string | null;
  publish_date: string | null;
  permalink: string | null;
  post_type: string | null;
  comments: number;
  interactions: number;
  net_follows: number;
  reactions: number;
  saves: number;
  shares: number;
  viewers: number;
  views: number;
  impressions: number;
  approximate_earnings: number;
  average_seconds_viewed: number | null;
  seconds_viewed: number | null;
};

export type GoodGameOrganicSocialDailyMetric = {
  id: string;
  brand: string;
  platform: string;
  page_id: string | null;
  page_name: string | null;
  metric_date: string;
  approximate_earnings: number;
  impressions: number;
  interactions: number;
  net_follows: number;
  reactions: number;
  shares: number;
  comments_and_replies: number;
  viewers: number;
  views: number;
};

export type GoodGameOrganicSocialImport = {
  id: string;
  source_label: string;
  brand: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  content_file_names: string[] | null;
  profile_file_names: string[] | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type GoodGameOrganicSocialDashboardData = {
  posts: GoodGameOrganicSocialPost[];
  dailyMetrics: GoodGameOrganicSocialDailyMetric[];
  imports: GoodGameOrganicSocialImport[];
  brands: string[];
  selectedBrand: string;
  setupRequired: boolean;
  setupMessage?: string;
};

export type GoodGameOrganicSocialFilters = {
  brand?: string;
  start?: string | null;
  end?: string | null;
};

export function createGoodGameOrganicSocialSupabaseClient() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

function isMissingTableError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST205');
}

export async function fetchGoodGameOrganicSocialDashboardData(filters: GoodGameOrganicSocialFilters | string = 'all'): Promise<GoodGameOrganicSocialDashboardData> {
  const db = createGoodGameOrganicSocialSupabaseClient();
  const selectedBrand = typeof filters === 'string' ? filters : (filters.brand ?? 'all');
  const start = typeof filters === 'string' ? null : filters.start;
  const end = typeof filters === 'string' ? null : filters.end;

  const brandsRes = await db
    .from('goodgame_organic_social_posts')
    .select('brand')
    .order('brand', { ascending: true });

  if (isMissingTableError(brandsRes.error)) {
    return {
      posts: [],
      dailyMetrics: [],
      imports: [],
      brands: [],
      selectedBrand: 'all',
      setupRequired: true,
      setupMessage: 'Apply supabase/goodgame_organic_social.sql in the EIC content Supabase project, then upload the Good Game organic social CSV exports.',
    };
  }
  if (brandsRes.error) throw brandsRes.error;

  const brands = Array.from(new Set((brandsRes.data ?? []).map((row) => row.brand).filter(Boolean) as string[]));
  const brand = selectedBrand !== 'all' && brands.includes(selectedBrand) ? selectedBrand : 'all';

  let postsQuery = db.from('goodgame_organic_social_posts').select('*').order('publish_time', { ascending: false, nullsFirst: false }).limit(1000);
  let dailyQuery = db.from('goodgame_organic_social_daily_metrics').select('*').order('metric_date', { ascending: false }).limit(1000);
  let importsQuery = db.from('goodgame_organic_social_imports').select('*').order('created_at', { ascending: false }).limit(30);

  if (brand !== 'all') {
    postsQuery = postsQuery.eq('brand', brand);
    dailyQuery = dailyQuery.eq('brand', brand);
    importsQuery = importsQuery.eq('brand', brand);
  }

  if (start) {
    postsQuery = postsQuery.gte('publish_date', start);
    dailyQuery = dailyQuery.gte('metric_date', start);
  }

  if (end) {
    postsQuery = postsQuery.lte('publish_date', end);
    dailyQuery = dailyQuery.lte('metric_date', end);
  }

  const [postsRes, dailyRes, importsRes] = await Promise.all([postsQuery, dailyQuery, importsQuery]);
  if (postsRes.error) throw postsRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (importsRes.error) throw importsRes.error;

  return {
    posts: (postsRes.data ?? []) as GoodGameOrganicSocialPost[],
    dailyMetrics: (dailyRes.data ?? []) as GoodGameOrganicSocialDailyMetric[],
    imports: (importsRes.data ?? []) as GoodGameOrganicSocialImport[],
    brands,
    selectedBrand: brand,
    setupRequired: false,
  };
}
