create table if not exists public.spartaco_clickup_tasks (
  clickup_task_id text primary key,
  list_id text not null default '901407399216',
  name text not null default '',
  status text,
  url text,
  assignees jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  business_focus text not null default 'general'
    check (business_focus in ('general', 'jameson', 'huskie', 'ronin')),
  due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc'::text, now()),
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists spartaco_clickup_tasks_list_id_idx
  on public.spartaco_clickup_tasks (list_id);

create index if not exists spartaco_clickup_tasks_business_focus_idx
  on public.spartaco_clickup_tasks (business_focus);

create table if not exists public.spartaco_clickup_comments (
  clickup_comment_id text primary key,
  clickup_task_id text not null references public.spartaco_clickup_tasks (clickup_task_id)
    on delete cascade,
  list_id text not null default '901407399216',
  comment_text text not null default '',
  commenter text,
  business_focus text not null default 'general'
    check (business_focus in ('general', 'jameson', 'huskie', 'ronin')),
  posted_at timestamptz,
  synced_at timestamptz not null default timezone('utc'::text, now()),
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists spartaco_clickup_comments_task_id_idx
  on public.spartaco_clickup_comments (clickup_task_id);

create index if not exists spartaco_clickup_comments_posted_at_idx
  on public.spartaco_clickup_comments (posted_at desc);

create index if not exists spartaco_clickup_comments_business_focus_idx
  on public.spartaco_clickup_comments (business_focus);

create table if not exists public.spartaco_weekly_readout (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  week_of date not null,
  period_start date not null,
  period_end date not null,
  previous_start date,
  previous_end date,
  overall_story text,
  focus_insights jsonb not null default '{
    "jameson": {"wins": [], "opportunities": [], "next_steps": []},
    "huskie": {"wins": [], "opportunities": [], "next_steps": []},
    "ronin": {"wins": [], "opportunities": [], "next_steps": []}
  }'::jsonb,
  wins jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  accomplishments jsonb not null default '[]'::jsonb,
  focus_next_week jsonb not null default '[]'::jsonb,
  execution_context jsonb not null default '[]'::jsonb,
  status text not null default 'published'
    check (status in ('draft', 'approved', 'published')),
  raw_agent_output jsonb not null default '{}'::jsonb
);

create unique index if not exists spartaco_weekly_readout_week_of_idx
  on public.spartaco_weekly_readout (week_of);

create index if not exists spartaco_weekly_readout_generated_at_idx
  on public.spartaco_weekly_readout (generated_at desc);

create index if not exists spartaco_weekly_readout_status_idx
  on public.spartaco_weekly_readout (status);
