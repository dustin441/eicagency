begin;

-- pgTAP-independent verification for an already-applied source-view migration.
-- Run as postgres in EIC on PostgreSQL 17. This script is read-only and rolls back.
do $$
declare
  v_postgres_oid oid;
  v_view record;
  v_columns text[];
  v_types text[];
  v_definition text;
  v_expected_source text;
begin
  if current_setting('server_version_num')::integer < 170000
     or current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'VERIFY FAILED: source-view verification requires PostgreSQL 17+ and a direct postgres session';
  end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles where rolname = 'postgres';
  if v_postgres_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'VERIFY FAILED: EIC sentinel or postgres owner role is missing';
  end if;

  for v_view in
    select * from (values
      ('client_health_bridgeway_daily', 'bridgeway_google'),
      ('client_health_ihh_daily', 'ihh_master'),
      ('client_health_cba_daily', 'cba_master')
    ) expected(view_name, source_name)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_view.view_name)) is null then
      raise exception 'VERIFY FAILED: public.% is missing', v_view.view_name;
    end if;
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view.view_name
        and c.relkind = 'v' and c.relowner = v_postgres_oid
        and c.reloptions @> array['security_invoker=false', 'security_barrier=true']::text[]
    ) then
      raise exception 'VERIFY FAILED: public.% is not a postgres-owned fixed-option security-definer view', v_view.view_name;
    end if;

    select pg_catalog.array_agg(a.attname order by a.attnum),
           pg_catalog.array_agg(pg_catalog.format_type(a.atttypid, a.atttypmod) order by a.attnum)
      into v_columns, v_types
    from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
      and a.attnum > 0 and not a.attisdropped;
    if v_columns <> array['row_key', 'date', 'spend', 'results']::text[]
       or v_types <> array['text', 'date', 'numeric', 'numeric']::text[] then
      raise exception 'VERIFY FAILED: public.% columns/types are %, %', v_view.view_name, v_columns, v_types;
    end if;

    if not pg_catalog.has_table_privilege('service_role', pg_catalog.format('public.%I', v_view.view_name), 'SELECT')
       or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or exists (
         select 1
         from pg_catalog.pg_class c
         cross join lateral pg_catalog.aclexplode(c.relacl) acl
         where c.oid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and (acl.grantee = 0
             or (acl.grantee not in (v_postgres_oid, (select oid from pg_catalog.pg_roles where rolname = 'service_role')))
             or (acl.grantee = (select oid from pg_catalog.pg_roles where rolname = 'service_role') and acl.privilege_type <> 'SELECT'))
       )
       or exists (
         select 1 from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and a.attnum > 0 and a.attacl is not null
       ) then
      raise exception 'VERIFY FAILED: public.% is not service-role-only SELECT', v_view.view_name;
    end if;

    v_definition := pg_catalog.pg_get_viewdef(pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass, true);
    if pg_catalog.strpos(v_definition, v_view.source_name) = 0 then
      raise exception 'VERIFY FAILED: public.% does not use required source %', v_view.view_name, v_view.source_name;
    end if;
    if v_view.view_name = 'client_health_bridgeway_daily'
       and pg_catalog.strpos(v_definition, 'bridgeway_master') > 0 then
      raise exception 'VERIFY FAILED: Bridgeway view uses union master instead of bridgeway_google';
    end if;
  end loop;

  if exists (
    select 1 from public.client_health_bridgeway_daily
    where row_key is null or date is null or spend is null or results is null
       or row_key <> pg_catalog.to_char(date, 'YYYY-MM-DD')
       or spend < 0 or results < 0
       or pg_catalog.lower(spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or pg_catalog.lower(results::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
  ) or (select count(*) from public.client_health_bridgeway_daily)
       <> (select count(distinct date) from public.client_health_bridgeway_daily) then
    raise exception 'VERIFY FAILED: Bridgeway null/canonical/finite/nonnegative/unique contract failed';
  end if;

  if exists (
    select 1 from public.client_health_ihh_daily
    where row_key is null or date is null or spend is null or results is null
       or row_key <> pg_catalog.to_char(date, 'YYYY-MM-DD')
       or date < date '2026-08-19' or spend < 0 or results < 0
       or pg_catalog.lower(spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or pg_catalog.lower(results::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
  ) or (select count(*) from public.client_health_ihh_daily)
       <> (select count(distinct date) from public.client_health_ihh_daily) then
    raise exception 'VERIFY FAILED: IHH cutoff/null/canonical/finite/nonnegative/unique contract failed';
  end if;

  if exists (
    select 1 from public.client_health_cba_daily
    where row_key is null or date is null or spend is null or results is null
       or row_key <> pg_catalog.to_char(date, 'YYYY-MM-DD')
       or spend < 0 or results < 0
       or pg_catalog.lower(spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
       or pg_catalog.lower(results::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
  ) or (select count(*) from public.client_health_cba_daily)
       <> (select count(distinct date) from public.client_health_cba_daily) then
    raise exception 'VERIFY FAILED: CBA null/canonical/finite/nonnegative/unique contract failed';
  end if;

  if exists (
    (select row_key, date, spend, results from public.client_health_bridgeway_daily
     except all
     select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(conversions::numeric, 0::numeric))::numeric
     from public.bridgeway_google group by date)
    union all
    (select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(conversions::numeric, 0::numeric))::numeric
     from public.bridgeway_google group by date
     except all
     select row_key, date, spend, results from public.client_health_bridgeway_daily)
  ) then
    raise exception 'VERIFY FAILED: Bridgeway results do not exactly match source aggregates';
  end if;

  if exists (
    (select row_key, date, spend, results from public.client_health_ihh_daily
     except all
     select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(scheduled_appointments::numeric, 0::numeric))::numeric
     from public.ihh_master where date >= date '2026-08-19' group by date)
    union all
    (select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(scheduled_appointments::numeric, 0::numeric))::numeric
     from public.ihh_master where date >= date '2026-08-19' group by date
     except all
     select row_key, date, spend, results from public.client_health_ihh_daily)
  ) then
    raise exception 'VERIFY FAILED: IHH results do not exactly match post-cutoff source aggregates';
  end if;

  if exists (
    (select row_key, date, spend, results from public.client_health_cba_daily
     except all
     select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(conversions::numeric, 0::numeric))::numeric
     from public.cba_master group by date)
    union all
    (select pg_catalog.to_char(date, 'YYYY-MM-DD'), date,
            sum(coalesce(cost::numeric, 0::numeric))::numeric,
            sum(coalesce(conversions::numeric, 0::numeric))::numeric
     from public.cba_master group by date
     except all
     select row_key, date, spend, results from public.client_health_cba_daily)
  ) then
    raise exception 'VERIFY FAILED: CBA results do not exactly match source aggregates';
  end if;

  raise notice 'client_health_source_views_verify: all PostgreSQL 17 source-view checks passed';
end
$$;

rollback;
