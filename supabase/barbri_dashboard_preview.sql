-- Additive BARBRI planning dashboard schema.
-- Service-role read only from the authenticated dashboard. No anonymous policies.

create table if not exists public.barbri_plan_snapshots (
  version text primary key,
  status text not null check (status in ('working','approved','archived')),
  source_cutoff date not null,
  forecast_start date not null,
  forecast_end date not null,
  current_modeled_roas numeric not null,
  target_roas numeric not null,
  forecast_spend numeric not null,
  forecast_revenue numeric not null,
  forecast_sales numeric not null,
  improvement_pct numeric not null,
  strategy_summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.barbri_performance_windows (
  snapshot_version text not null references public.barbri_plan_snapshots(version) on delete cascade,
  window_key text not null,
  window_label text not null,
  start_date date not null,
  end_date date not null,
  spend numeric not null,
  native_revenue numeric not null,
  native_roas numeric not null,
  ga4_revenue numeric not null,
  ga4_roas numeric not null,
  purchases numeric not null,
  aov numeric not null,
  sort_order integer not null,
  primary key (snapshot_version, window_key)
);

create table if not exists public.barbri_measurement_bridge (
  snapshot_version text not null references public.barbri_plan_snapshots(version) on delete cascade,
  metric_key text not null,
  label text not null,
  value numeric not null,
  unit text not null default 'x',
  evidence_type text not null,
  definition text not null,
  sort_order integer not null,
  primary key (snapshot_version, metric_key)
);

create table if not exists public.barbri_channel_plan (
  snapshot_version text not null references public.barbri_plan_snapshots(version) on delete cascade,
  channel_key text not null,
  channel_label text not null,
  current_roas numeric,
  forecast_roas numeric not null,
  spend numeric not null,
  revenue numeric not null,
  sales numeric not null,
  evidence_type text not null,
  role_in_plan text not null,
  sort_order integer not null,
  primary key (snapshot_version, channel_key)
);

create table if not exists public.barbri_monthly_plan (
  snapshot_version text not null references public.barbri_plan_snapshots(version) on delete cascade,
  month_key text not null,
  month_label text not null,
  date_range text not null,
  spend numeric not null,
  revenue numeric not null,
  sales numeric not null,
  roas numeric not null,
  sort_order integer not null,
  primary key (snapshot_version, month_key)
);

create table if not exists public.barbri_roadmap (
  snapshot_version text not null references public.barbri_plan_snapshots(version) on delete cascade,
  phase_key text not null,
  timing text not null,
  theme text not null,
  actions text not null,
  decision_gate text not null,
  primary_kpi text not null,
  owner_boundary text not null,
  sort_order integer not null,
  primary key (snapshot_version, phase_key)
);

alter table public.barbri_plan_snapshots enable row level security;
alter table public.barbri_performance_windows enable row level security;
alter table public.barbri_measurement_bridge enable row level security;
alter table public.barbri_channel_plan enable row level security;
alter table public.barbri_monthly_plan enable row level security;
alter table public.barbri_roadmap enable row level security;

comment on table public.barbri_plan_snapshots is 'Versioned client-safe BARBRI planning snapshots. Internal staffing and pricing are intentionally excluded.';
