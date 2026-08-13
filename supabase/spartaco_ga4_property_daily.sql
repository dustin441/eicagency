-- Spartaco Brand Health P0: authoritative GA4 property-level daily facts.
-- Production procedure: execute each numbered section separately in Supabase SQL Editor.
-- Do not activate the n8n writer until Sections 1-3 all pass.

-- 1. PREFLIGHT (read-only)
select
  to_regclass('public.spartaco_ga4_property_daily') as existing_property_fact,
  to_regclass('public.ga4_spartaco') as existing_ga4_spartaco,
  to_regclass('public.ga4_ronin_channels') as existing_ga4_ronin_channels;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('spartaco_ga4_property_daily', 'ga4_spartaco', 'ga4_ronin_channels')
order by table_name, ordinal_position;

-- 2. AUTHORITATIVE PROPERTY FACT (DDL)
create table if not exists public.spartaco_ga4_property_daily (
  brand text not null,
  property_id text not null,
  property_timezone text not null,
  date date not null,
  sessions bigint not null check (sessions >= 0),
  engaged_sessions bigint not null check (engaged_sessions >= 0),
  total_users bigint not null check (total_users >= 0),
  total_revenue numeric(20, 6) not null,
  source_execution_id text,
  loaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spartaco_ga4_property_daily_pkey primary key (brand, date),
  constraint spartaco_ga4_property_daily_property_date_key unique (property_id, date),
  constraint spartaco_ga4_property_daily_mapping_check check (
    (brand = 'Jameson' and property_id = '308605008' and property_timezone = 'America/New_York')
    or (brand = 'Huskie' and property_id = '350749822' and property_timezone = 'America/Chicago')
    or (brand = 'Ronin' and property_id = '257371483' and property_timezone = 'America/Los_Angeles')
    or (brand = 'Tiiger' and property_id = '424516364' and property_timezone = 'America/New_York')
  )
);

-- Harden existing installations created by an earlier P0 draft. Required
-- metrics must be supplied explicitly so omitted values cannot become zero.
alter table public.spartaco_ga4_property_daily
  alter column sessions drop default,
  alter column engaged_sessions drop default,
  alter column total_users drop default,
  alter column total_revenue drop default;

comment on table public.spartaco_ga4_property_daily is
  'Authoritative dimensionless GA4 property totals by local property date for Spartaco Brand Health headline metrics.';
comment on column public.spartaco_ga4_property_daily.total_users is
  'Daily diagnostic only. Never sum this column into a multi-day distinct-user KPI.';

create index if not exists spartaco_ga4_property_daily_date_idx
  on public.spartaco_ga4_property_daily (date desc);

alter table public.spartaco_ga4_property_daily enable row level security;
revoke all on table public.spartaco_ga4_property_daily from public, anon, authenticated;
grant select, insert, update, delete on table public.spartaco_ga4_property_daily to service_role;

-- 3. AUTHORITATIVE FACT POSTFLIGHT (read-only)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'spartaco_ga4_property_daily'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.spartaco_ga4_property_daily'::regclass
order by conname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'spartaco_ga4_property_daily'
order by grantee, privilege_type;

select brand, property_id, property_timezone, count(*) as row_count,
       min(date) as first_date, max(date) as last_date
from public.spartaco_ga4_property_daily
group by brand, property_id, property_timezone
order by brand;

select brand, date, count(*) as duplicate_rows
from public.spartaco_ga4_property_daily
group by brand, date
having count(*) > 1;

-- 4. LEGACY WRITER PREFLIGHT (read-only)
-- The current n8n upsert keys are:
--   ga4_spartaco: (date, page_path)
--   ga4_ronin_channels: (date, landing_page, source, medium, session_campaign_name)
-- Inspect duplicates and null match keys before adding constraints.
select date, page_path, count(*) as duplicate_rows
from public.ga4_spartaco
group by date, page_path
having count(*) > 1
order by duplicate_rows desc, date desc
limit 100;

select
  count(*) filter (where date is null) as null_date,
  count(*) filter (where page_path is null) as null_page_path
from public.ga4_spartaco;

select date, landing_page, source, medium, session_campaign_name, count(*) as duplicate_rows
from public.ga4_ronin_channels
group by date, landing_page, source, medium, session_campaign_name
having count(*) > 1
order by duplicate_rows desc, date desc
limit 100;

select
  count(*) filter (where date is null) as null_date,
  count(*) filter (where landing_page is null) as null_landing_page,
  count(*) filter (where source is null) as null_source,
  count(*) filter (where medium is null) as null_medium,
  count(*) filter (where session_campaign_name is null) as null_campaign
from public.ga4_ronin_channels;

-- 5. LEGACY CONSTRAINT REPAIR (DDL, RUN ONLY IF SECTION 4 RETURNS NO DUPLICATES/NULLS)
-- These constraints make the existing n8n upserts valid. They do not make the
-- legacy page/channel facts authoritative for Brand Health headline totals.
alter table public.ga4_spartaco
  add constraint ga4_spartaco_date_page_path_key unique (date, page_path);

alter table public.ga4_ronin_channels
  add constraint ga4_ronin_channels_match_key unique
  (date, landing_page, source, medium, session_campaign_name);

-- 6. LEGACY CONSTRAINT POSTFLIGHT (read-only)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.ga4_spartaco'::regclass, 'public.ga4_ronin_channels'::regclass)
  and conname in ('ga4_spartaco_date_page_path_key', 'ga4_ronin_channels_match_key')
order by table_name::text, conname;
