begin;

-- Additive, EIC-only source contract. Apply as postgres; this migration does not
-- change source facts or activate any client-health configuration.
do $$
declare
  v_postgres_oid oid;
  v_source record;
  v_column record;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'client health source views require a direct postgres session';
  end if;

  select oid into v_postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'client health source views require the managed postgres owner role';
  end if;

  if to_regclass('public.master_spartaco') is null then
    raise exception 'client health source views must be applied to the EIC Clients project';
  end if;
  if exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) expected(role_name)
    where not exists (
      select 1 from pg_catalog.pg_roles r where r.rolname = expected.role_name
    )
  ) then
    raise exception 'client health source views require anon, authenticated, and service_role roles';
  end if;

  if to_regclass('public.client_health_bridgeway_daily') is not null
     or to_regclass('public.client_health_ihh_daily') is not null
     or to_regclass('public.client_health_cba_daily') is not null then
    raise exception 'client health source views preflight found a prior or conflicting installation';
  end if;

  for v_source in
    select * from (values
      ('bridgeway_google'),
      ('ihh_master'),
      ('cba_master')
    ) required(relation_name)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_source.relation_name)) is null
       or not exists (
         select 1
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = v_source.relation_name
           and c.relkind in ('r', 'p', 'v', 'm')
           and c.relowner = v_postgres_oid
       ) then
      raise exception 'client health source views require postgres-owned source relation public.%', v_source.relation_name;
    end if;
  end loop;

  for v_column in
    select * from (values
      ('bridgeway_google', 'date', 'date'),
      ('bridgeway_google', 'cost', 'numeric'),
      ('bridgeway_google', 'conversions', 'numeric'),
      ('ihh_master', 'date', 'date'),
      ('ihh_master', 'cost', 'numeric'),
      ('ihh_master', 'scheduled_appointments', 'numeric'),
      ('cba_master', 'date', 'date'),
      ('cba_master', 'cost', 'numeric'),
      ('cba_master', 'conversions', 'numeric')
    ) required(relation_name, column_name, type_kind)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_type t on t.oid = a.atttypid
      where n.nspname = 'public'
        and c.relname = v_column.relation_name
        and a.attname = v_column.column_name
        and a.attnum > 0
        and not a.attisdropped
        and (
          (v_column.type_kind = 'date' and a.atttypid = 'date'::pg_catalog.regtype)
          or (v_column.type_kind = 'numeric' and t.typcategory = 'N')
        )
    ) then
      raise exception 'client health source views require public.%.% with % type',
        v_column.relation_name, v_column.column_name, v_column.type_kind;
    end if;
  end loop;

  -- Null measures are contractually zero. Invalid dates, negative measures, and
  -- non-finite measures fail closed instead of being filtered or clamped.
  if exists (
    select 1 from public.bridgeway_google
    where date is null
       or pg_catalog.lower(cost::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or pg_catalog.lower(conversions::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or cost::numeric < 0 or conversions::numeric < 0
  ) then
    raise exception 'client health Bridgeway source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (
    select 1 from public.ihh_master
    where date is null
       or (date >= date '2026-08-19' and (
         pg_catalog.lower(cost::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
         or pg_catalog.lower(scheduled_appointments::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
         or cost::numeric < 0 or scheduled_appointments::numeric < 0
       ))
  ) then
    raise exception 'client health IHH source contains an invalid date or negative/non-finite in-contract measure';
  end if;
  if exists (
    select 1 from public.cba_master
    where date is null
       or pg_catalog.lower(cost::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or pg_catalog.lower(conversions::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or cost::numeric < 0 or conversions::numeric < 0
  ) then
    raise exception 'client health CBA source contains an invalid date or negative/non-finite measure';
  end if;
end
$$;

create view public.client_health_bridgeway_daily
with (security_invoker = false, security_barrier = true)
as
select
  pg_catalog.to_char(source.date, 'YYYY-MM-DD')::text as row_key,
  source.date::date as date,
  coalesce(pg_catalog.sum(coalesce(source.cost::numeric, 0::numeric)), 0::numeric)::numeric as spend,
  coalesce(pg_catalog.sum(coalesce(source.conversions::numeric, 0::numeric)), 0::numeric)::numeric as results
from public.bridgeway_google source
group by source.date;

create view public.client_health_ihh_daily
with (security_invoker = false, security_barrier = true)
as
select
  pg_catalog.to_char(source.date, 'YYYY-MM-DD')::text as row_key,
  source.date::date as date,
  coalesce(pg_catalog.sum(coalesce(source.cost::numeric, 0::numeric)), 0::numeric)::numeric as spend,
  coalesce(pg_catalog.sum(coalesce(source.scheduled_appointments::numeric, 0::numeric)), 0::numeric)::numeric as results
from public.ihh_master source
where source.date >= date '2026-08-19'
group by source.date;

create view public.client_health_cba_daily
with (security_invoker = false, security_barrier = true)
as
select
  pg_catalog.to_char(source.date, 'YYYY-MM-DD')::text as row_key,
  source.date::date as date,
  coalesce(pg_catalog.sum(coalesce(source.cost::numeric, 0::numeric)), 0::numeric)::numeric as spend,
  coalesce(pg_catalog.sum(coalesce(source.conversions::numeric, 0::numeric)), 0::numeric)::numeric as results
from public.cba_master source
group by source.date;

alter view public.client_health_bridgeway_daily owner to postgres;
alter view public.client_health_ihh_daily owner to postgres;
alter view public.client_health_cba_daily owner to postgres;

revoke all on table public.client_health_bridgeway_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_ihh_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_cba_daily from public, anon, authenticated, service_role;
grant select on table public.client_health_bridgeway_daily to service_role;
grant select on table public.client_health_ihh_daily to service_role;
grant select on table public.client_health_cba_daily to service_role;

comment on view public.client_health_bridgeway_daily is 'Service-role-only deterministic daily Bridgeway source contract aggregated from bridgeway_google.';
comment on column public.client_health_bridgeway_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_bridgeway_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_bridgeway_daily.results is 'Daily count of Google Ads conversions configured as calls lasting 60 seconds or longer.';

comment on view public.client_health_ihh_daily is 'Service-role-only deterministic daily IHH source contract; rows begin at the 2026-08-19 reliable pixel boundary.';
comment on column public.client_health_ihh_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_ihh_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_ihh_daily.results is 'Daily canonical scheduled appointment count (sum of ihh_master.scheduled_appointments), reliable on and after 2026-08-19.';

comment on view public.client_health_cba_daily is 'Service-role-only deterministic daily CBA source contract aggregated across the approved dashboard channels in cba_master.';
comment on column public.client_health_cba_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_cba_daily.spend is 'Daily paid-media spend in source currency across approved dashboard channels.';
comment on column public.client_health_cba_daily.results is 'Daily conversion count across the approved dashboard channels in cba_master.';

commit;
