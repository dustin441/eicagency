-- Spartaco Brand Health P0: exact-window GA4 property snapshots.
-- Run each numbered section separately in the Spartaco production Supabase SQL Editor.

-- 1. PREFLIGHT (read-only)
select
  to_regclass('public.spartaco_ga4_property_daily') as existing_daily_fact,
  to_regclass('public.spartaco_ga4_property_period') as existing_period_fact;

-- 2. EXACT-WINDOW PROPERTY FACT (DDL)
create table if not exists public.spartaco_ga4_property_period (
  brand text not null,
  property_id text not null,
  property_timezone text not null,
  period_grain text not null check (period_grain in ('month', 'rolling_12')),
  start_date date not null,
  end_date date not null,
  sessions bigint not null check (sessions >= 0),
  engaged_sessions bigint not null check (engaged_sessions >= 0),
  total_users bigint not null check (total_users >= 0),
  engagement_rate numeric(20, 12) not null check (engagement_rate >= 0 and engagement_rate <= 1),
  total_revenue numeric(20, 6) not null,
  source_execution_id text,
  loaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spartaco_ga4_property_period_pkey primary key (brand, start_date, end_date),
  constraint spartaco_ga4_property_period_property_dates_key unique (property_id, start_date, end_date),
  constraint spartaco_ga4_property_period_dates_check check (end_date >= start_date),
  constraint spartaco_ga4_property_period_grain_dates_check check (
    (period_grain = 'month'
      and start_date = date_trunc('month', start_date)::date
      and end_date = (date_trunc('month', start_date) + interval '1 month' - interval '1 day')::date)
    or
    (period_grain = 'rolling_12'
      and start_date = date_trunc('month', start_date)::date
      and end_date = (start_date + interval '1 year' - interval '1 day')::date)
  ),
  constraint spartaco_ga4_property_period_mapping_check check (
    (brand = 'Jameson' and property_id = '308605008' and property_timezone = 'America/New_York')
    or (brand = 'Huskie' and property_id = '350749822' and property_timezone = 'America/Chicago')
    or (brand = 'Ronin' and property_id = '257371483' and property_timezone = 'America/Los_Angeles')
    or (brand = 'Tiiger' and property_id = '424516364' and property_timezone = 'America/New_York')
  )
);

-- Harden existing installations created by an earlier P0 draft. Required
-- metrics must be supplied explicitly so omitted values cannot become zero.
alter table public.spartaco_ga4_property_period
  alter column sessions drop default,
  alter column engaged_sessions drop default,
  alter column total_users drop default,
  alter column engagement_rate drop default,
  alter column total_revenue drop default;

comment on table public.spartaco_ga4_property_period is
  'Dimensionless native GA4 property totals queried at the exact dashboard window. Use for headline scorecards and monthly trend snapshots.';

create index if not exists spartaco_ga4_property_period_end_date_idx
  on public.spartaco_ga4_property_period (end_date desc, period_grain, brand);

alter table public.spartaco_ga4_property_period enable row level security;
revoke all on table public.spartaco_ga4_property_period from public, anon, authenticated;
grant select, insert, update, delete on table public.spartaco_ga4_property_period to service_role;

-- 3. POSTFLIGHT (read-only)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'spartaco_ga4_property_period'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.spartaco_ga4_property_period'::regclass
order by conname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'spartaco_ga4_property_period'
order by grantee, privilege_type;

select brand, period_grain, count(*) as rows,
       min(start_date) as first_start, max(end_date) as last_end
from public.spartaco_ga4_property_period
group by brand, period_grain
order by brand, period_grain;

select brand, start_date, end_date, count(*) as duplicate_rows
from public.spartaco_ga4_property_period
group by brand, start_date, end_date
having count(*) > 1;
