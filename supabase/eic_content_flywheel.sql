-- EIC Content Flywheel / Social Approval Hub
create table if not exists public.eic_content_episodes (id text primary key, title text not null, slug text, status text not null default 'draft', story_pillar text, story_arc text, transcript_drive_url text, full_video_drive_url text, output_folder_url text, main_blog_doc_url text, youtube_doc_url text, newsletter_doc_url text, source_file_id text, source_file_name text, dropped_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.eic_content_assets (id text primary key, episode_id text not null references public.eic_content_episodes(id) on delete cascade, asset_type text not null default 'clip', title text, file_name text, drive_file_id text, drive_url text, mime_type text, story_phase text, sort_order int default 0, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.eic_content_posts (id text primary key, episode_id text not null references public.eic_content_episodes(id) on delete cascade, asset_id text references public.eic_content_assets(id) on delete set null, platform text not null, post_type text not null, title text not null, story_phase text, scheduled_date date, scheduled_time text, status text not null default 'needs_review', approval_status text not null default 'needs_review', copy_doc_url text, asset_url text, destination_url text, ghl_status text not null default 'not_pushed', ghl_post_id text, approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null, pushed_to_ghl_at timestamptz, notes text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists eic_content_posts_episode_idx on public.eic_content_posts(episode_id);
create index if not exists eic_content_posts_platform_idx on public.eic_content_posts(platform);
create index if not exists eic_content_posts_status_idx on public.eic_content_posts(status);
create index if not exists eic_content_posts_schedule_idx on public.eic_content_posts(scheduled_date, scheduled_time);
create index if not exists eic_content_assets_episode_idx on public.eic_content_assets(episode_id);

-- Intake batches let the dashboard become the front door for podcast files.
-- The storage bucket is intentionally private; dashboard users access files via
-- generated signed URLs or downstream Google Drive copies created by automation.
insert into storage.buckets (id, name, public)
values ('eic-content-uploads', 'eic-content-uploads', false)
on conflict (id) do nothing;

create table if not exists public.eic_content_upload_batches (
  id uuid primary key default gen_random_uuid(),
  episode_id text references public.eic_content_episodes(id) on delete set null,
  episode_title text not null,
  recording_date date,
  source_type text default 'manual_drop',
  status text not null default 'uploaded',
  file_count int not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.eic_content_upload_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.eic_content_upload_batches(id) on delete cascade,
  episode_id text references public.eic_content_episodes(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  asset_type text not null default 'source_file',
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists eic_content_upload_batches_episode_idx on public.eic_content_upload_batches(episode_id);
create index if not exists eic_content_upload_batches_status_idx on public.eic_content_upload_batches(status);
create index if not exists eic_content_upload_files_batch_idx on public.eic_content_upload_files(batch_id);
