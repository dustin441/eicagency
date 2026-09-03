begin;

-- Exact rollback for the two PrePass contracts. It refuses when a locally
-- installed Client Health active revision names either relation. Configuration
-- authoring/history is never changed.
do $rollback$
declare
  v_postgres_oid oid;
  v_view record;
  v_config_objects integer;
  v_referenced boolean := false;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'PrePass Client Health source-view rollback requires a direct postgres session';
  end if;

  select r.oid into v_postgres_oid
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres'
    and not r.rolsuper
    and r.rolcanlogin
    and r.rolbypassrls
    and r.rolcreaterole;
  if v_postgres_oid is null
     or pg_catalog.to_regclass('public.master_marketing_performance') is null
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
    raise exception 'PrePass Client Health source-view rollback requires the exact PrePass project and managed postgres role';
  end if;

  for v_view in
    select * from (values
      ('client_health_prepass_sql_daily'),
      ('client_health_prepass_won_daily')
    ) expected(view_name)
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
      raise exception 'PrePass Client Health source-view rollback requires the complete postgres-owned installation';
    end if;
  end loop;

  select pg_catalog.count(*) into v_config_objects
  from (values
    (pg_catalog.to_regclass('private.client_health_config_revisions')),
    (pg_catalog.to_regclass('private.client_health_config_revision_activations')),
    (pg_catalog.to_regclass('private.client_health_active_config_revision'))
  ) objects(object_oid)
  where object_oid is not null;

  if v_config_objects not in (0, 3) then
    raise exception 'PrePass Client Health source-view rollback refuses because active-config state is incomplete and cannot be proven safe';
  end if;

  if v_config_objects = 3 then
    execute $query$
      select pg_catalog.exists (
        select 1
        from private.client_health_active_config_revision active
        join private.client_health_config_revision_activations activation
          on activation.id = active.activation_id
        join private.client_health_config_revisions revision
          on revision.id = activation.revision_id
         and revision.revision_hash = activation.revision_hash
        where revision.revision @? '$.** ? (
          @ == "client_health_prepass_sql_daily" ||
          @ == "public.client_health_prepass_sql_daily" ||
          @ == "client_health_prepass_won_daily" ||
          @ == "public.client_health_prepass_won_daily"
        )'
      )
    $query$ into v_referenced;
  end if;

  if v_referenced then
    raise exception 'PrePass Client Health source-view rollback refuses while active configuration references a view';
  end if;
end
$rollback$;

drop view public.client_health_prepass_won_daily;
drop view public.client_health_prepass_sql_daily;

commit;
