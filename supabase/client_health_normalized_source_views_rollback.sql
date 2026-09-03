begin;

-- Exact rollback for normalized source views. It never changes source facts or
-- configuration and refuses while the active immutable revision references one.
do $$
declare
  v_postgres_oid oid;
  v_referenced boolean := false;
  v_view record;
  v_config_object_count integer;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'normalized client health source views rollback requires a direct postgres session';
  end if;
  select oid into v_postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'normalized client health source views rollback requires the EIC Clients project and postgres owner role';
  end if;

  for v_view in
    select * from (values
      ('client_health_bloom_daily', 'b4ae22a97d7a7d73079e4148f62bda7c9ab1a090da5a4919a055b9737bc7e83e'),
      ('client_health_nsi_daily', '61d7256e6f2f3eb8fdf5786e8ad1974613c1818f379d5c38cd477a8acc84ec75'),
      ('client_health_durodyne_daily', 'bf0a5b8dc68dfab0a0efdee5ef25e7f310bc30bdc8b58c8d77f9ce782334f505'),
      ('client_health_kinsey_daily', '17a2c0efefd6ff4719ba7eedfbb4a2bf58e6b21886f260ea722ac27b834517ed'),
      ('client_health_arabella_daily', 'c8a486ad40581c25709f11898e3f44005a685259946be172fe2fa287cf1d81e0'),
      ('client_health_champagne_daily', '174680e28f690746ac03ce4cc832650f1ddeaa50cbf42067edc82410a922dc10'),
      ('client_health_goodgame_ecommerce_daily', '8b4acdfdb45b7c2715f3cfaf9edda9e7b4a66f13262e757fe2edc1fc4a31978b')
    ) expected(view_name, definition_hash)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_view.view_name)) is null
       or not exists (
         select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = v_view.view_name and c.relkind = 'v'
           and c.relowner = v_postgres_oid
           and c.reloptions @> array['security_invoker=false', 'security_barrier=true']::text[]
           and pg_catalog.encode(extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256'), 'hex') = v_view.definition_hash
       ) then
      raise exception 'normalized client health source views rollback requires the complete postgres-owned installation';
    end if;
  end loop;

  select count(*) into v_config_object_count
  from (values
    (to_regclass('private.client_health_config_revisions')),
    (to_regclass('private.client_health_config_revision_activations')),
    (to_regclass('private.client_health_active_config_revision'))
  ) objects(object_oid)
  where object_oid is not null;
  if v_config_object_count not in (0, 3) then
    raise exception 'normalized client health source views rollback refuses with a partial active-config installation';
  end if;

  if v_config_object_count = 3 then
    execute 'lock table private.client_health_active_config_revision in share mode';
    execute $query$
      select exists (
        select 1
        from private.client_health_active_config_revision active
        join private.client_health_config_revision_activations activation on activation.id = active.activation_id
        join private.client_health_config_revisions revision_row on revision_row.id = activation.revision_id
        where revision_row.revision @? '$.** ? (
          @ == "client_health_bloom_daily" || @ == "public.client_health_bloom_daily" ||
          @ == "client_health_nsi_daily" || @ == "public.client_health_nsi_daily" ||
          @ == "client_health_durodyne_daily" || @ == "public.client_health_durodyne_daily" ||
          @ == "client_health_kinsey_daily" || @ == "public.client_health_kinsey_daily" ||
          @ == "client_health_arabella_daily" || @ == "public.client_health_arabella_daily" ||
          @ == "client_health_champagne_daily" || @ == "public.client_health_champagne_daily" ||
          @ == "client_health_goodgame_ecommerce_daily" || @ == "public.client_health_goodgame_ecommerce_daily"
        )'
      )
    $query$ into v_referenced;
  end if;
  if v_referenced then
    raise exception 'normalized client health source views rollback refuses while the active configuration revision references a source view';
  end if;
end
$$;

drop view public.client_health_bloom_daily;
drop view public.client_health_nsi_daily;
drop view public.client_health_durodyne_daily;
drop view public.client_health_kinsey_daily;
drop view public.client_health_arabella_daily;
drop view public.client_health_champagne_daily;
drop view public.client_health_goodgame_ecommerce_daily;

commit;
