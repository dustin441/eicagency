begin;

-- Exact rollback for the three source-contract views. It never changes facts or
-- configuration and refuses while any staged/active private revision names one
-- of these relations (including a schema-qualified relation/adapter value).
do $$
declare
  v_postgres_oid oid;
  v_referenced boolean := false;
  v_view record;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'client health source views rollback requires a direct postgres session';
  end if;
  select oid into v_postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'client health source views rollback requires the EIC Clients project and postgres owner role';
  end if;

  for v_view in
    select * from (values
      ('client_health_bridgeway_daily'),
      ('client_health_ihh_daily'),
      ('client_health_cba_daily')
    ) expected(view_name)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_view.view_name)) is null
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
      raise exception 'client health source views rollback requires the complete postgres-owned installation';
    end if;
  end loop;

  if to_regclass('private.client_health_config_revisions') is not null then
    execute $query$
      select exists (
        select 1
        from private.client_health_config_revisions
        where revision @? '$.** ? (
          @ == "client_health_bridgeway_daily" || @ == "public.client_health_bridgeway_daily" ||
          @ == "client_health_ihh_daily" || @ == "public.client_health_ihh_daily" ||
          @ == "client_health_cba_daily" || @ == "public.client_health_cba_daily"
        )'
      )
    $query$ into v_referenced;
  end if;
  if v_referenced then
    raise exception 'client health source views rollback refuses while private staged/active configuration references a source view';
  end if;
end
$$;

drop view public.client_health_bridgeway_daily;
drop view public.client_health_ihh_daily;
drop view public.client_health_cba_daily;

commit;
