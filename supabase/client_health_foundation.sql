begin;

-- Safety guard: this foundation belongs only in the EIC Clients project.
do $$
begin
  if to_regclass('public.master_spartaco') is null then
    raise exception 'client health foundation must be applied to the EIC Clients project';
  end if;
end
$$;

create table public.client_health_clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  display_name text not null,
  dashboard_href text,
  active boolean not null default false,
  config_status text not null default 'configuration_required',
  reporting_timezone text not null default 'America/Phoenix',
  monthly_hours_allotment numeric,
  clickup_list_ids text[] not null default '{}'::text[],
  margin_aliases text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_health_clients_key_format
    check (client_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint client_health_clients_href_format
    check (dashboard_href is null or dashboard_href like '/%'),
  constraint client_health_clients_config_status
    check (config_status in ('approved', 'configuration_required', 'inactive')),
  constraint client_health_clients_hours_nonnegative
    check (
      monthly_hours_allotment is null
      or (
        monthly_hours_allotment::text not in ('NaN', 'Infinity', '-Infinity')
        and monthly_hours_allotment >= 0
      )
    ),
  constraint client_health_clients_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table public.client_health_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  run_status text not null default 'collecting',
  calculation_version text not null,
  source_contract_version text not null,
  started_at timestamptz not null default now(),
  validated_at timestamptz,
  published_at timestamptz,
  finished_at timestamptz,
  evidence_hash text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint client_health_refresh_runs_status
    check (run_status in ('collecting', 'validated', 'published', 'failed')),
  constraint client_health_refresh_runs_times
    check (
      (validated_at is null or validated_at >= started_at)
      and (published_at is null or published_at >= started_at)
      and (finished_at is null or finished_at >= started_at)
    ),
  constraint client_health_refresh_runs_publish_state
    check (
      run_status <> 'published'
      or (
        validated_at is not null
        and published_at is not null
        and evidence_hash ~ '^[0-9a-f]{64}$'
      )
    ),
  constraint client_health_refresh_runs_validate_state
    check (run_status not in ('validated', 'published') or validated_at is not null),
  constraint client_health_refresh_runs_id_date unique (id, snapshot_date)
);

create table public.client_health_metric_config (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client_health_clients(id) on delete cascade,
  metric_key text not null,
  label text not null,
  adapter_key text not null,
  required boolean not null default true,
  weight numeric not null,
  direction text not null,
  green_threshold numeric not null,
  yellow_threshold numeric not null,
  source_config jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_health_metric_config_unique unique (client_id, metric_key),
  constraint client_health_metric_config_key
    check (metric_key in ('budget_pacing', 'north_star', 'hours', 'overdue_tasks', 'margin')),
  constraint client_health_metric_config_adapter_format
    check (adapter_key ~ '^[a-z0-9][a-z0-9_.-]*$'),
  constraint client_health_metric_config_weight
    check (weight::text not in ('NaN', 'Infinity', '-Infinity') and weight >= 0 and weight <= 100),
  constraint client_health_metric_config_direction
    check (direction in ('lower_is_better', 'higher_is_better')),
  constraint client_health_metric_config_thresholds_finite
    check (
      green_threshold::text not in ('NaN', 'Infinity', '-Infinity')
      and yellow_threshold::text not in ('NaN', 'Infinity', '-Infinity')
    ),
  constraint client_health_metric_config_threshold_order
    check (
      (direction = 'lower_is_better' and green_threshold <= yellow_threshold)
      or (direction = 'higher_is_better' and green_threshold >= yellow_threshold)
    ),
  constraint client_health_metric_config_source_object
    check (jsonb_typeof(source_config) = 'object')
);

create table public.client_health_source_runs (
  id uuid primary key default gen_random_uuid(),
  refresh_run_id uuid not null references public.client_health_refresh_runs(id) on delete cascade,
  client_id uuid not null references public.client_health_clients(id) on delete cascade,
  source_key text not null,
  run_status text not null,
  window_start date,
  window_end date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  data_through timestamptz,
  row_count bigint,
  request_fingerprint text,
  evidence jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint client_health_source_runs_unique unique (refresh_run_id, client_id, source_key),
  constraint client_health_source_runs_source_format
    check (source_key ~ '^[a-z0-9][a-z0-9_.-]*$'),
  constraint client_health_source_runs_status
    check (run_status in ('running', 'succeeded', 'partial', 'failed')),
  constraint client_health_source_runs_window
    check (window_start is null or window_end is null or window_start <= window_end),
  constraint client_health_source_runs_finished
    check (finished_at is null or finished_at >= started_at),
  constraint client_health_source_runs_rows
    check (row_count is null or row_count >= 0),
  constraint client_health_source_runs_evidence_object
    check (jsonb_typeof(evidence) = 'object')
);

create table public.client_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  refresh_run_id uuid not null,
  client_id uuid not null references public.client_health_clients(id) on delete cascade,
  snapshot_date date not null,
  data_through timestamptz,
  budget numeric,
  month_spend numeric,
  expected_spend numeric,
  current_window_start date,
  current_window_end date,
  current_spend numeric,
  current_result_count numeric,
  current_cost_per_result numeric,
  previous_window_start date,
  previous_window_end date,
  previous_spend numeric,
  previous_result_count numeric,
  previous_cost_per_result numeric,
  hours_used numeric,
  hours_allotted numeric,
  projected_hours numeric,
  overdue_task_count integer,
  revenue numeric,
  fulfillment_cost numeric,
  margin_percent numeric,
  dimension_statuses jsonb not null default '{}'::jsonb,
  source_statuses jsonb not null default '{}'::jsonb,
  overall_status text not null,
  overall_score numeric,
  reasons jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_health_snapshots_unique unique (refresh_run_id, client_id),
  constraint client_health_snapshots_refresh_date_fk
    foreign key (refresh_run_id, snapshot_date)
    references public.client_health_refresh_runs(id, snapshot_date)
    on delete cascade,
  constraint client_health_snapshots_current_window
    check (current_window_start is null or current_window_end is null or current_window_start <= current_window_end),
  constraint client_health_snapshots_previous_window
    check (previous_window_start is null or previous_window_end is null or previous_window_start <= previous_window_end),
  constraint client_health_snapshots_overall_status
    check (overall_status in ('healthy', 'watch', 'at_risk', 'incomplete', 'configuration_required')),
  constraint client_health_snapshots_score
    check (
      overall_score is null
      or (
        overall_score::text not in ('NaN', 'Infinity', '-Infinity')
        and overall_score >= 0
        and overall_score <= 100
      )
    ),
  constraint client_health_snapshots_finite
    check (
      (budget is null or budget::text not in ('NaN', 'Infinity', '-Infinity'))
      and (month_spend is null or month_spend::text not in ('NaN', 'Infinity', '-Infinity'))
      and (expected_spend is null or expected_spend::text not in ('NaN', 'Infinity', '-Infinity'))
      and (current_spend is null or current_spend::text not in ('NaN', 'Infinity', '-Infinity'))
      and (current_result_count is null or current_result_count::text not in ('NaN', 'Infinity', '-Infinity'))
      and (current_cost_per_result is null or current_cost_per_result::text not in ('NaN', 'Infinity', '-Infinity'))
      and (previous_spend is null or previous_spend::text not in ('NaN', 'Infinity', '-Infinity'))
      and (previous_result_count is null or previous_result_count::text not in ('NaN', 'Infinity', '-Infinity'))
      and (previous_cost_per_result is null or previous_cost_per_result::text not in ('NaN', 'Infinity', '-Infinity'))
      and (hours_used is null or hours_used::text not in ('NaN', 'Infinity', '-Infinity'))
      and (hours_allotted is null or hours_allotted::text not in ('NaN', 'Infinity', '-Infinity'))
      and (projected_hours is null or projected_hours::text not in ('NaN', 'Infinity', '-Infinity'))
      and (revenue is null or revenue::text not in ('NaN', 'Infinity', '-Infinity'))
      and (fulfillment_cost is null or fulfillment_cost::text not in ('NaN', 'Infinity', '-Infinity'))
      and (margin_percent is null or margin_percent::text not in ('NaN', 'Infinity', '-Infinity'))
    ),
  constraint client_health_snapshots_nonnegative
    check (
      (budget is null or budget >= 0)
      and (month_spend is null or month_spend >= 0)
      and (expected_spend is null or expected_spend >= 0)
      and (current_spend is null or current_spend >= 0)
      and (current_result_count is null or current_result_count >= 0)
      and (current_cost_per_result is null or current_cost_per_result >= 0)
      and (previous_spend is null or previous_spend >= 0)
      and (previous_result_count is null or previous_result_count >= 0)
      and (previous_cost_per_result is null or previous_cost_per_result >= 0)
      and (hours_used is null or hours_used >= 0)
      and (hours_allotted is null or hours_allotted >= 0)
      and (projected_hours is null or projected_hours >= 0)
      and (overdue_task_count is null or overdue_task_count >= 0)
      and (revenue is null or revenue >= 0)
      and (fulfillment_cost is null or fulfillment_cost >= 0)
    ),
  constraint client_health_snapshots_dimension_object
    check (jsonb_typeof(dimension_statuses) = 'object'),
  constraint client_health_snapshots_source_object
    check (jsonb_typeof(source_statuses) = 'object'),
  constraint client_health_snapshots_reasons_array
    check (jsonb_typeof(reasons) = 'array')
);

create table public.client_health_snapshot_tasks (
  snapshot_id uuid not null references public.client_health_snapshots(id) on delete cascade,
  clickup_task_id text not null,
  list_id text not null,
  task_name text not null,
  task_url text not null,
  due_at timestamptz,
  display_rank smallint not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, clickup_task_id),
  constraint client_health_snapshot_tasks_unique_rank unique (snapshot_id, display_rank),
  constraint client_health_snapshot_tasks_rank check (display_rank between 1 and 5),
  constraint client_health_snapshot_tasks_url check (task_url like 'https://%')
);

create function public.client_health_guard_refresh_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.run_status = 'published' then
    raise exception 'published client health refreshes are immutable';
  end if;

  if tg_op = 'UPDATE' and new.run_status = 'published' then
    if not exists (
      select 1
      from public.client_health_snapshots s
      where s.refresh_run_id = new.id
    ) then
      raise exception 'a client health refresh cannot publish without snapshots';
    end if;

    if exists (
      select 1
      from public.client_health_clients c
      where c.active = true
        and not exists (
          select 1
          from public.client_health_snapshots s
          where s.refresh_run_id = new.id
            and s.client_id = c.id
        )
    ) then
      raise exception 'a client health refresh cannot publish without a snapshot for every active client';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create function public.client_health_guard_refresh_child_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_refresh_id uuid;
  new_refresh_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_refresh_id := old.refresh_run_id;
    if exists (
      select 1 from public.client_health_refresh_runs r
      where r.id = old_refresh_id and r.run_status = 'published'
    ) then
      raise exception 'children of a published client health refresh are immutable';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_refresh_id := new.refresh_run_id;
    if exists (
      select 1 from public.client_health_refresh_runs r
      where r.id = new_refresh_id and r.run_status = 'published'
    ) then
      raise exception 'children cannot be added to or moved into a published client health refresh';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create function public.client_health_guard_snapshot_task_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_snapshot_id uuid;
  new_snapshot_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_snapshot_id := old.snapshot_id;
    if exists (
      select 1
      from public.client_health_snapshots s
      join public.client_health_refresh_runs r on r.id = s.refresh_run_id
      where s.id = old_snapshot_id and r.run_status = 'published'
    ) then
      raise exception 'tasks belonging to a published client health refresh are immutable';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_snapshot_id := new.snapshot_id;
    if exists (
      select 1
      from public.client_health_snapshots s
      join public.client_health_refresh_runs r on r.id = s.refresh_run_id
      where s.id = new_snapshot_id and r.run_status = 'published'
    ) then
      raise exception 'tasks cannot be added to or moved into a published client health refresh';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger client_health_refresh_runs_immutable
before update or delete on public.client_health_refresh_runs
for each row execute function public.client_health_guard_refresh_run_immutable();

create trigger client_health_source_runs_immutable
before insert or update or delete on public.client_health_source_runs
for each row execute function public.client_health_guard_refresh_child_immutable();

create trigger client_health_snapshots_immutable
before insert or update or delete on public.client_health_snapshots
for each row execute function public.client_health_guard_refresh_child_immutable();

create trigger client_health_snapshot_tasks_immutable
before insert or update or delete on public.client_health_snapshot_tasks
for each row execute function public.client_health_guard_snapshot_task_immutable();

revoke all on function public.client_health_guard_refresh_run_immutable() from public, anon, authenticated;
revoke all on function public.client_health_guard_refresh_child_immutable() from public, anon, authenticated;
revoke all on function public.client_health_guard_snapshot_task_immutable() from public, anon, authenticated;

create index client_health_clients_active_idx
  on public.client_health_clients (active, display_name);

create index client_health_refresh_runs_publish_idx
  on public.client_health_refresh_runs (run_status, snapshot_date desc, published_at desc);

create unique index client_health_refresh_runs_evidence_idx
  on public.client_health_refresh_runs (snapshot_date, calculation_version, source_contract_version, evidence_hash)
  where evidence_hash is not null;

create index client_health_metric_config_client_idx
  on public.client_health_metric_config (client_id, required, metric_key);

create index client_health_source_runs_lookup_idx
  on public.client_health_source_runs (refresh_run_id, client_id, source_key, started_at desc);

create index client_health_source_runs_status_idx
  on public.client_health_source_runs (run_status, started_at desc);

create index client_health_snapshots_latest_idx
  on public.client_health_snapshots (client_id, snapshot_date desc, calculated_at desc, id);

create index client_health_snapshot_tasks_rank_idx
  on public.client_health_snapshot_tasks (snapshot_id, display_rank);

create view public.client_health_latest
with (security_invoker = true)
as
select distinct on (s.client_id)
  s.*,
  r.calculation_version,
  r.source_contract_version,
  r.evidence_hash
from public.client_health_snapshots s
join public.client_health_clients c on c.id = s.client_id
join public.client_health_refresh_runs r on r.id = s.refresh_run_id
where c.active = true
  and r.run_status = 'published'
order by s.client_id, r.snapshot_date desc, r.published_at desc, r.id desc, s.id desc;

alter table public.client_health_clients enable row level security;
alter table public.client_health_refresh_runs enable row level security;
alter table public.client_health_metric_config enable row level security;
alter table public.client_health_source_runs enable row level security;
alter table public.client_health_snapshots enable row level security;
alter table public.client_health_snapshot_tasks enable row level security;

revoke all on table public.client_health_clients from public, anon, authenticated;
revoke all on table public.client_health_refresh_runs from public, anon, authenticated;
revoke all on table public.client_health_metric_config from public, anon, authenticated;
revoke all on table public.client_health_source_runs from public, anon, authenticated;
revoke all on table public.client_health_snapshots from public, anon, authenticated;
revoke all on table public.client_health_snapshot_tasks from public, anon, authenticated;
revoke all on table public.client_health_latest from public, anon, authenticated;

grant select, insert, update, delete on table public.client_health_clients to service_role;
grant select, insert, update, delete on table public.client_health_refresh_runs to service_role;
grant select, insert, update, delete on table public.client_health_metric_config to service_role;
grant select, insert, update, delete on table public.client_health_source_runs to service_role;
grant select, insert, update, delete on table public.client_health_snapshots to service_role;
grant select, insert, update, delete on table public.client_health_snapshot_tasks to service_role;
grant select on table public.client_health_latest to service_role;

comment on table public.client_health_clients is 'Approved internal EIC client-health configuration. No credentials or executable SQL.';
comment on table public.client_health_refresh_runs is 'Atomic collection, validation, and publication boundary for immutable client-health snapshots.';
comment on table public.client_health_metric_config is 'Approved metric definitions, thresholds, and typed adapter configuration.';
comment on table public.client_health_source_runs is 'Auditable source collection status and sanitized evidence metadata.';
comment on table public.client_health_snapshots is 'Daily deterministic client-health calculation inputs and outputs.';
comment on table public.client_health_snapshot_tasks is 'Top overdue ClickUp task references for an internal snapshot.';
comment on view public.client_health_latest is 'Latest published snapshot for each active configured client.';

commit;
