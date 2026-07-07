-- Good Game Organic Social reporting tables
-- Apply in the EIC content Supabase project used by EIC_CONTENT_SUPABASE_URL.

create table if not exists public.goodgame_organic_social_imports (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  brand text,
  report_start_date date,
  report_end_date date,
  content_file_names text[] not null default '{}'::text[],
  profile_file_names text[] not null default '{}'::text[],
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.goodgame_organic_social_posts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.goodgame_organic_social_imports(id) on delete set null,
  brand text not null,
  platform text not null default 'Facebook',
  post_id text,
  page_id text,
  page_name text,
  title text,
  duration_seconds integer,
  publish_time timestamptz,
  publish_date date generated always as ((publish_time at time zone 'America/Phoenix')::date) stored,
  permalink text,
  post_type text,
  data_comment text,
  comments integer not null default 0,
  distribution numeric,
  approximate_earnings numeric not null default 0,
  content_monetization numeric not null default 0,
  in_stream_ads numeric not null default 0,
  stars numeric not null default 0,
  interactions integer not null default 0,
  net_follows integer not null default 0,
  reactions integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  viewers integer not null default 0,
  views integer not null default 0,
  impressions integer not null default 0,
  average_seconds_viewed numeric,
  seconds_viewed numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, page_id, post_id, publish_time)
);

create table if not exists public.goodgame_organic_social_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.goodgame_organic_social_imports(id) on delete set null,
  brand text not null,
  platform text not null default 'Facebook',
  page_id text,
  page_name text,
  metric_date date not null,
  data_comment text,
  approximate_earnings numeric not null default 0,
  content_monetization numeric not null default 0,
  in_stream_ads numeric not null default 0,
  stars numeric not null default 0,
  impressions integer not null default 0,
  interactions integer not null default 0,
  net_follows integer not null default 0,
  reactions integer not null default 0,
  shares integer not null default 0,
  comments_and_replies integer not null default 0,
  viewers integer not null default 0,
  views integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, page_id, metric_date)
);

create index if not exists goodgame_organic_social_posts_brand_date_idx on public.goodgame_organic_social_posts (brand, publish_date desc);
create index if not exists goodgame_organic_social_posts_post_type_idx on public.goodgame_organic_social_posts (post_type);
create index if not exists goodgame_organic_social_daily_brand_date_idx on public.goodgame_organic_social_daily_metrics (brand, metric_date desc);
create index if not exists goodgame_organic_social_imports_created_idx on public.goodgame_organic_social_imports (created_at desc);

alter table public.goodgame_organic_social_imports enable row level security;
alter table public.goodgame_organic_social_posts enable row level security;
alter table public.goodgame_organic_social_daily_metrics enable row level security;

-- Dashboard reads and CSV imports use the EIC_CONTENT service-role key server-side.
-- No anon/client RLS policies are created so rows are not visible through browser Supabase clients by default.

comment on table public.goodgame_organic_social_posts is 'Good Game organic social post-level reporting data uploaded from CSV exports.';
comment on table public.goodgame_organic_social_daily_metrics is 'Good Game organic social daily profile/account metrics uploaded from CSV exports.';
comment on table public.goodgame_organic_social_imports is 'Good Game organic social CSV import batches.';
