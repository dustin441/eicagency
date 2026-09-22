-- MedBrain creative analytics tables.
-- Server-side only: RLS blocks anonymous/authenticated browser access; service_role bypasses RLS.

create table if not exists public.medibrane_meta_ads_creatives (
  id bigint generated always as identity primary key,
  date date not null,
  ad_id text not null,
  ad_name text,
  adset_name text,
  campaign_name text,
  campaign_id text,
  impressions integer,
  clicks integer,
  spend numeric,
  leads integer,
  final_creative_link text,
  primary_text text,
  headline text,
  destination_url text,
  ad_status text,
  cta_type text,
  is_video boolean,
  video_id text,
  video_url text,
  creative_id text,
  image_hash text,
  permanent_image_url text,
  updated_at timestamptz not null default now(),
  unique (ad_id, date)
);

create index if not exists medibrane_meta_ads_creatives_date_idx
  on public.medibrane_meta_ads_creatives (date desc);
create index if not exists medibrane_meta_ads_creatives_ad_id_idx
  on public.medibrane_meta_ads_creatives (ad_id);

create table if not exists public.medibrane_creative_ai_insights (
  id bigint generated always as identity primary key,
  segment text not null,
  as_of_date date not null default current_date,
  period_start date,
  period_end date,
  model text,
  ads_analyzed integer not null default 0,
  has_data boolean not null default true,
  summary text,
  what_works jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  next_creative_brief text,
  next_tests jsonb not null default '[]'::jsonb,
  top_ads jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (segment, as_of_date)
);

create index if not exists medibrane_creative_ai_insights_as_of_idx
  on public.medibrane_creative_ai_insights (as_of_date desc);

create table if not exists public.medibrane_weekly_readout (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  week_of date not null,
  period_start date not null,
  period_end date not null,
  previous_start date,
  previous_end date,
  overall_story text,
  wins jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  accomplishments jsonb not null default '[]'::jsonb,
  focus_next_week jsonb not null default '[]'::jsonb,
  execution_context jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'approved', 'published')),
  raw_agent_output jsonb not null default '{}'::jsonb,
  unique (week_of)
);

alter table public.medibrane_meta_ads_creatives enable row level security;
alter table public.medibrane_creative_ai_insights enable row level security;
alter table public.medibrane_weekly_readout enable row level security;

revoke all on table public.medibrane_meta_ads_creatives from anon, authenticated;
revoke all on table public.medibrane_creative_ai_insights from anon, authenticated;
revoke all on table public.medibrane_weekly_readout from anon, authenticated;
grant all on table public.medibrane_meta_ads_creatives to service_role;
grant all on table public.medibrane_creative_ai_insights to service_role;
grant all on table public.medibrane_weekly_readout to service_role;
grant usage, select on sequence public.medibrane_meta_ads_creatives_id_seq to service_role;
grant usage, select on sequence public.medibrane_creative_ai_insights_id_seq to service_role;
grant usage, select on sequence public.medibrane_weekly_readout_id_seq to service_role;
