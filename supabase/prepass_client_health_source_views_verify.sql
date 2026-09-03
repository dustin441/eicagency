begin;

-- pgTAP-independent, read-only verification for the applied PrePass views.
do $verify$
declare
  v_postgres_oid oid;
  v_source_oid oid;
  v_linkedin_oid oid;
  v_view record;
  v_columns text[];
  v_types text[];
  v_definition text;
begin
  if pg_catalog.current_setting('server_version_num')::integer < 170000
     or current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'VERIFY FAILED: PrePass source-view verification requires PostgreSQL 17+ and a direct postgres session';
  end if;

  select r.oid into v_postgres_oid
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres'
    and not r.rolsuper
    and r.rolcanlogin
    and r.rolbypassrls
    and r.rolcreaterole;
  v_source_oid := pg_catalog.to_regclass('public.master_marketing_performance');
  v_linkedin_oid := pg_catalog.to_regclass('public.linkedin_campaign_data');
  if v_postgres_oid is null
     or v_source_oid is null
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
    raise exception 'VERIFY FAILED: managed postgres or exact PrePass project identity is missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class c
    where c.oid = v_source_oid and c.relkind = 'm' and c.relowner = v_postgres_oid
  ) then
    raise exception 'VERIFY FAILED: source is not the postgres-owned PrePass materialized view';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
    where c.oid = v_linkedin_oid and c.relkind in ('r', 'p', 'v', 'm') and c.relowner = v_postgres_oid
  ) then
    raise exception 'VERIFY FAILED: LinkedIn source is not postgres-owned';
  end if;

  for v_view in
    select * from (values
      ('client_health_prepass_sql_daily', 'sqls'),
      ('client_health_prepass_won_daily', 'closed_won')
    ) expected(view_name, result_column)
  loop
    if pg_catalog.to_regclass(pg_catalog.format('public.%I', v_view.view_name)) is null
       or not exists (
         select 1
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = v_view.view_name
           and c.relkind = 'v'
           and c.relowner = v_postgres_oid
           and c.reloptions @> array['security_invoker=false', 'security_barrier=true']::text[]
       ) then
      raise exception 'VERIFY FAILED: public.% is not a postgres-owned fixed-option security-definer barrier view', v_view.view_name;
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
       or pg_catalog.has_table_privilege('service_role', pg_catalog.format('public.%I', v_view.view_name), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_table_privilege('public', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or exists (
         select 1
         from pg_catalog.pg_class c
         cross join lateral pg_catalog.aclexplode(c.relacl) acl
         where c.oid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and (
             acl.grantee = 0
             or acl.grantee not in (v_postgres_oid, (select oid from pg_catalog.pg_roles where rolname = 'service_role'))
             or (acl.grantee = (select oid from pg_catalog.pg_roles where rolname = 'service_role') and acl.privilege_type <> 'SELECT')
           )
       )
       or exists (
         select 1 from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and a.attnum > 0 and a.attacl is not null
       ) then
      raise exception 'VERIFY FAILED: public.% is not service-role-only SELECT', v_view.view_name;
    end if;

    v_definition := pg_catalog.pg_get_viewdef(pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass, true);
    if pg_catalog.strpos(v_definition, 'master_marketing_performance') = 0
       or pg_catalog.strpos(v_definition, 'linkedin_campaign_data') = 0
       or pg_catalog.strpos(v_definition, v_view.result_column) = 0
       or pg_catalog.strpos(v_definition, '''SMB''') = 0
       or pg_catalog.strpos(v_definition, '''ABM''') = 0
       or pg_catalog.strpos(v_definition, '''FD360''') = 0 then
      raise exception 'VERIFY FAILED: public.% source/focus/result definition is not exact', v_view.view_name;
    end if;
  end loop;

  if exists (
    select 1
    from public.client_health_prepass_sql_daily
    where row_key is null or date is null or spend is null or results is null
      or row_key <> pg_catalog.to_char(date, 'YYYY-MM-DD')
      or spend < 0 or results < 0
      or pg_catalog.lower(spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
      or pg_catalog.lower(results::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
  )
  or (select pg_catalog.count(*) from public.client_health_prepass_sql_daily)
     <> (select pg_catalog.count(distinct row_key) from public.client_health_prepass_sql_daily)
  or (select pg_catalog.count(*) from public.client_health_prepass_sql_daily)
     <> (select pg_catalog.count(distinct date) from public.client_health_prepass_sql_daily) then
    raise exception 'VERIFY FAILED: PrePass SQL view canonical/finite/nonnegative/unique contract failed';
  end if;

  if exists (
    select 1
    from public.client_health_prepass_won_daily
    where row_key is null or date is null or spend is null or results is null
      or row_key <> pg_catalog.to_char(date, 'YYYY-MM-DD')
      or spend < 0 or results < 0
      or pg_catalog.lower(spend::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
      or pg_catalog.lower(results::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')
  )
  or (select pg_catalog.count(*) from public.client_health_prepass_won_daily)
     <> (select pg_catalog.count(distinct row_key) from public.client_health_prepass_won_daily)
  or (select pg_catalog.count(*) from public.client_health_prepass_won_daily)
     <> (select pg_catalog.count(distinct date) from public.client_health_prepass_won_daily) then
    raise exception 'VERIFY FAILED: PrePass Won view canonical/finite/nonnegative/unique contract failed';
  end if;

  if exists (
    (select row_key, date, spend, results from public.client_health_prepass_sql_daily
     except all
     with source as (
       select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
         coalesce(sqls::numeric, 0::numeric) as results
       from public.master_marketing_performance
       where focus in ('SMB', 'ABM', 'FD360') and date is not null
       union all
       select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
       from public.linkedin_campaign_data
     )
     select pg_catalog.to_char(date, 'YYYY-MM-DD')::text, date,
       pg_catalog.sum(spend)::numeric, pg_catalog.sum(results)::numeric
     from source group by date)
    union all
    (with source as (
       select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
         coalesce(sqls::numeric, 0::numeric) as results
       from public.master_marketing_performance
       where focus in ('SMB', 'ABM', 'FD360') and date is not null
       union all
       select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
       from public.linkedin_campaign_data
     )
     select pg_catalog.to_char(date, 'YYYY-MM-DD')::text, date,
       pg_catalog.sum(spend)::numeric, pg_catalog.sum(results)::numeric
     from source group by date
     except all
     select row_key, date, spend, results from public.client_health_prepass_sql_daily)
  ) then
    raise exception 'VERIFY FAILED: PrePass SQL view does not exactly match source aggregates';
  end if;

  if exists (
    (select row_key, date, spend, results from public.client_health_prepass_won_daily
     except all
     with source as (
       select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
         coalesce(closed_won::numeric, 0::numeric) as results
       from public.master_marketing_performance
       where focus in ('SMB', 'ABM', 'FD360') and date is not null
       union all
       select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
       from public.linkedin_campaign_data
     )
     select pg_catalog.to_char(date, 'YYYY-MM-DD')::text, date,
       pg_catalog.sum(spend)::numeric, pg_catalog.sum(results)::numeric
     from source group by date)
    union all
    (with source as (
       select date::date as date, coalesce(spend::numeric, 0::numeric) as spend,
         coalesce(closed_won::numeric, 0::numeric) as results
       from public.master_marketing_performance
       where focus in ('SMB', 'ABM', 'FD360') and date is not null
       union all
       select date::date, coalesce(spend::numeric, 0::numeric), 0::numeric
       from public.linkedin_campaign_data
     )
     select pg_catalog.to_char(date, 'YYYY-MM-DD')::text, date,
       pg_catalog.sum(spend)::numeric, pg_catalog.sum(results)::numeric
     from source group by date
     except all
     select row_key, date, spend, results from public.client_health_prepass_won_daily)
  ) then
    raise exception 'VERIFY FAILED: PrePass Won view does not exactly match source aggregates';
  end if;

  raise notice 'prepass_client_health_source_views_verify: PostgreSQL 17 identity, parity, uniqueness, and ACL checks passed';
end
$verify$;

rollback;
