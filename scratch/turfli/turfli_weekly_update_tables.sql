create table if not exists public.turfli_clickup_tasks (
  clickup_task_id text primary key,
  list_id text not null default '901414768474',
  name text not null default '',
  status text,
  url text,
  assignees jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  funnel_focus text not null default 'general'
    check (funnel_focus in ('general', 'creative', 'traffic', 'conversion', 'measurement')),
  due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc'::text, now()),
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists turfli_clickup_tasks_list_id_idx
  on public.turfli_clickup_tasks (list_id);

create index if not exists turfli_clickup_tasks_funnel_focus_idx
  on public.turfli_clickup_tasks (funnel_focus);

create table if not exists public.turfli_clickup_comments (
  clickup_comment_id text primary key,
  clickup_task_id text not null references public.turfli_clickup_tasks (clickup_task_id)
    on delete cascade,
  list_id text not null default '901414768474',
  comment_text text not null default '',
  commenter text,
  funnel_focus text not null default 'general'
    check (funnel_focus in ('general', 'creative', 'traffic', 'conversion', 'measurement')),
  posted_at timestamptz,
  synced_at timestamptz not null default timezone('utc'::text, now()),
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists turfli_clickup_comments_task_id_idx
  on public.turfli_clickup_comments (clickup_task_id);

create index if not exists turfli_clickup_comments_posted_at_idx
  on public.turfli_clickup_comments (posted_at desc);

create index if not exists turfli_clickup_comments_funnel_focus_idx
  on public.turfli_clickup_comments (funnel_focus);

create table if not exists public.turfli_weekly_readout (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc'::text, now()),
  period_start date not null,
  period_end date not null,
  overall_story text,
  wins jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  accomplishments jsonb not null default '[]'::jsonb,
  focus_next_week jsonb not null default '[]'::jsonb,
  execution_context jsonb not null default '[]'::jsonb
);

create index if not exists turfli_weekly_readout_created_at_idx
  on public.turfli_weekly_readout (created_at desc);
