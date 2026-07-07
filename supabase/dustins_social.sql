-- Dustin's Social monthly reporting tables
-- Apply in the EIC content Supabase project used by EIC_CONTENT_SUPABASE_URL.

create table if not exists public.dustins_social_imports (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  report_start_date date,
  report_end_date date,
  content_file_name text,
  profile_file_name text,
  clickup_task_url text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.dustins_social_posts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.dustins_social_imports(id) on delete set null,
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
  distribution integer not null default 0,
  interactions integer not null default 0,
  reactions integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  viewers integer not null default 0,
  views integer not null default 0,
  impressions integer not null default 0,
  pillar text,
  angle text,
  format_notes text,
  planning_note text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, post_id, publish_time)
);

create table if not exists public.dustins_social_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.dustins_social_imports(id) on delete set null,
  platform text not null default 'Facebook',
  page_id text,
  page_name text,
  metric_date date not null,
  impressions integer not null default 0,
  interactions integer not null default 0,
  net_follows integer not null default 0,
  reactions integer not null default 0,
  comments_and_replies integer not null default 0,
  viewers integer not null default 0,
  views integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, page_id, metric_date)
);

create index if not exists dustins_social_posts_publish_date_idx on public.dustins_social_posts (publish_date desc);
create index if not exists dustins_social_posts_post_type_idx on public.dustins_social_posts (post_type);
create index if not exists dustins_social_posts_pillar_idx on public.dustins_social_posts (pillar);
create index if not exists dustins_social_daily_metrics_date_idx on public.dustins_social_daily_metrics (metric_date desc);

alter table public.dustins_social_imports enable row level security;
alter table public.dustins_social_posts enable row level security;
alter table public.dustins_social_daily_metrics enable row level security;

-- Dashboard reads currently use the EIC_CONTENT service-role key server-side.
-- No anon/client RLS policies are created so these rows are not visible through browser Supabase clients by default.

comment on table public.dustins_social_posts is 'Dustin''s Social post-level monthly reporting data.';
comment on table public.dustins_social_daily_metrics is 'Dustin''s Social daily profile/account metrics.';
comment on table public.dustins_social_imports is 'Dustin''s Social CSV import batches.';
