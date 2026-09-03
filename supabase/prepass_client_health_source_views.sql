begin;

-- Additive PrePass-only source contracts. Apply through a direct managed-postgres
-- session. Historical null dates are deliberately out of contract; every non-null
-- date in the three approved focuses must be canonical YYYY-MM-DD.
do $preflight$
declare
  v_postgres_oid oid;
  v_source_oid oid;
  v_linkedin_oid oid;
  v_column record;
  v_existing_count integer;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'PrePass Client Health source views require a direct postgres session';
  end if;

  select r.oid into v_postgres_oid
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres'
    and not r.rolsuper
    and r.rolcanlogin
    and r.rolbypassrls
    and r.rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'PrePass Client Health source views require the managed postgres owner role';
  end if;

  -- master_marketing_performance plus the undated PrePass budgets shape is the
  -- project sentinel. EIC budgets instead have period_start/period_end columns.
  v_source_oid := pg_catalog.to_regclass('public.master_marketing_performance');
  v_linkedin_oid := pg_catalog.to_regclass('public.linkedin_campaign_data');
  if v_source_oid is null
     or v_linkedin_oid is null
     or pg_catalog.to_regclass('public.budgets') is null
     or pg_catalog.to_regclass('public.master_spartaco') is not null
     or not exists (
       select 1 from pg_catalog.pg_attribute a
       where a.attrelid = 'public.budgets'::pg_catalog.regclass
         and a.attname = 'daily_budget' and a.attnum > 0 and not a.attisdropped
     )
     or exists (
       select 1 from pg_catalog.pg_attribute a
       where a.attrelid = 'public.budgets'::pg_catalog.regclass
         and a.attname in ('period_start', 'period_end')
         and a.attnum > 0 and not a.attisdropped
     ) then
    raise exception 'PrePass Client Health source views must be applied to the PrePass project';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.oid = v_source_oid
      and n.nspname = 'public'
      and c.relname = 'master_marketing_performance'
      and c.relkind = 'm'
      and c.relowner = v_postgres_oid
  ) then
    raise exception 'PrePass Client Health requires postgres-owned materialized view public.master_marketing_performance';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.oid = v_linkedin_oid and n.nspname = 'public'
      and c.relname = 'linkedin_campaign_data'
      and c.relkind in ('r', 'p', 'v', 'm') and c.relowner = v_postgres_oid
  ) then
    raise exception 'PrePass Client Health requires postgres-owned public.linkedin_campaign_data';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) expected(role_name)
    where not exists (select 1 from pg_catalog.pg_roles r where r.rolname = expected.role_name)
  ) then
    raise exception 'PrePass Client Health source views require anon, authenticated, and service_role roles';
  end if;

  select pg_catalog.count(*) into v_existing_count
  from (values ('client_health_prepass_sql_daily'), ('client_health_prepass_won_daily')) expected(view_name)
  where pg_catalog.to_regclass(pg_catalog.format('public.%I', expected.view_name)) is not null;
  if v_existing_count not in (0, 2) then
    raise exception 'PrePass Client Health source-view preflight found a partial installation';
  end if;
  if v_existing_count = 2 and exists (
    select 1
    from (values
      ('client_health_prepass_sql_daily', 'cb36f3c684ba87f8ce0f3da53a36c3f3639541ae53523c1d73967966cfb86a02'),
      ('client_health_prepass_won_daily', '0fa55d1e0848ead043c4a0a3a7f1fc394f8c3404da13ecb4e0b7021e7b6637a6')
    ) expected(view_name, definition_hash)
    left join pg_catalog.pg_class c
      on c.oid = pg_catalog.to_regclass(pg_catalog.format('public.%I', expected.view_name))
    where c.relkind <> 'v' or c.relowner <> v_postgres_oid
      or not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=false', 'security_barrier=true']
      or pg_catalog.encode(extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256'), 'hex') <> expected.definition_hash
  ) then
    raise exception 'PrePass Client Health source-view preflight found definition, owner, type, or security drift';
  end if;

  for v_column in
    select * from (values
      ('date', 'text'),
      ('focus', 'text'),
      ('spend', 'numeric'),
      ('sqls', 'numeric'),
      ('closed_won', 'numeric')
    ) required(column_name, type_kind)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_type t on t.oid = a.atttypid
      where a.attrelid = v_source_oid
        and a.attname = v_column.column_name
        and a.attnum > 0
        and not a.attisdropped
        and (
          (v_column.type_kind = 'text' and a.atttypid = 'text'::pg_catalog.regtype)
          or (v_column.type_kind = 'numeric' and t.typcategory = 'N')
        )
    ) then
      raise exception 'PrePass Client Health requires public.master_marketing_performance.% with % type',
        v_column.column_name, v_column.type_kind;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = v_linkedin_oid and a.attname = 'date'
      and a.atttypid = 'date'::pg_catalog.regtype and a.attnum > 0 and not a.attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute a
    join pg_catalog.pg_type t on t.oid = a.atttypid
    where a.attrelid = v_linkedin_oid and a.attname = 'spend'
      and t.typcategory = 'N' and a.attnum > 0 and not a.attisdropped
  ) then
    raise exception 'PrePass Client Health requires public.linkedin_campaign_data date and numeric spend columns';
  end if;

  if exists (
    select 1
    from public.master_marketing_performance source
    where source.focus in ('SMB', 'ABM', 'FD360')
      and source.date is not null
      and source.date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) then
    raise exception 'PrePass Client Health source contains a noncanonical non-null in-contract date';
  end if;

  -- The cast also rejects canonical-shaped but impossible calendar dates.
  begin
    if exists (
      select 1
      from public.master_marketing_performance source
      where source.focus in ('SMB', 'ABM', 'FD360')
        and source.date is not null
        and pg_catalog.to_char(source.date::date, 'YYYY-MM-DD') <> source.date
    ) then
      raise exception 'PrePass Client Health source contains a non-round-tripping in-contract date';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'PrePass Client Health source contains an impossible in-contract calendar date';
  end;

  -- Null measures retain the dashboard's established zero semantics. Every
  -- present measure in the consumed focus/date contract must be finite and >= 0.
  if exists (
    select 1
    from public.master_marketing_performance source
    where source.focus in ('SMB', 'ABM', 'FD360')
      and source.date is not null
      and (
        pg_catalog.lower(source.spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
        or pg_catalog.lower(source.sqls::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
        or pg_catalog.lower(source.closed_won::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
        or source.spend::numeric < 0
        or source.sqls::numeric < 0
        or source.closed_won::numeric < 0
      )
  ) then
    raise exception 'PrePass Client Health source contains a negative or non-finite in-contract measure';
  end if;
  if exists (
    select 1 from public.linkedin_campaign_data source
    where source.date is null
      or pg_catalog.lower(source.spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
      or source.spend::numeric < 0
  ) then
    raise exception 'PrePass Client Health LinkedIn source contains an invalid date or negative/non-finite spend';
  end if;
end
$preflight$;

create or replace view public.client_health_prepass_sql_daily
with (security_invoker = false, security_barrier = true)
as
with source as (
  select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
    coalesce(sqls::numeric, 0::numeric) as results
  from public.master_marketing_performance
  where focus in ('SMB', 'ABM', 'FD360') and date is not null
  union all
  select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
  from public.linkedin_campaign_data
)
select pg_catalog.to_char(date, 'YYYY-MM-DD')::text as row_key, date,
  pg_catalog.sum(spend)::numeric as spend, pg_catalog.sum(results)::numeric as results
from source group by date;

create or replace view public.client_health_prepass_won_daily
with (security_invoker = false, security_barrier = true)
as
with source as (
  select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
    coalesce(closed_won::numeric, 0::numeric) as results
  from public.master_marketing_performance
  where focus in ('SMB', 'ABM', 'FD360') and date is not null
  union all
  select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
  from public.linkedin_campaign_data
)
select pg_catalog.to_char(date, 'YYYY-MM-DD')::text as row_key, date,
  pg_catalog.sum(spend)::numeric as spend, pg_catalog.sum(results)::numeric as results
from source group by date;

alter view public.client_health_prepass_sql_daily owner to postgres;
alter view public.client_health_prepass_won_daily owner to postgres;

revoke all on table public.client_health_prepass_sql_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_prepass_won_daily from public, anon, authenticated, service_role;
grant select on table public.client_health_prepass_sql_daily to service_role;
grant select on table public.client_health_prepass_won_daily to service_role;

comment on view public.client_health_prepass_sql_daily is 'Service-role-only daily PrePass Cost per SQL source across SMB, ABM, FD360, and all-channel LinkedIn spend. Adapter configuration, not SQL, assigns monthSpend ownership.';
comment on view public.client_health_prepass_won_daily is 'Service-role-only daily PrePass Cost per Won source across SMB, ABM, FD360, and all-channel LinkedIn spend. Adapter configuration, not SQL, assigns monthSpend ownership.';
comment on column public.client_health_prepass_sql_daily.row_key is 'Canonical YYYY-MM-DD date text; unique within this view.';
comment on column public.client_health_prepass_won_daily.row_key is 'Canonical YYYY-MM-DD date text; unique within this view.';
comment on column public.client_health_prepass_sql_daily.spend is 'Daily total paid spend across SMB, ABM, FD360, and LinkedIn.';
comment on column public.client_health_prepass_won_daily.spend is 'Daily total paid spend across SMB, ABM, FD360, and LinkedIn.';
comment on column public.client_health_prepass_sql_daily.results is 'Daily SQL count across SMB, ABM, and FD360.';
comment on column public.client_health_prepass_won_daily.results is 'Daily closed-won count across SMB, ABM, and FD360.';

commit;
