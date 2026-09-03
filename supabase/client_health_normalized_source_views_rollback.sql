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
      ('client_health_bloom_daily', '6721321962a35b8276920aabfb0db9bd3b51da7176022e68c4bb0cd3923940a7'),
      ('client_health_nsi_daily', '231de4061780e17fa09c1aa6a35757324d7d6ed29c592464701142000fa18623'),
      ('client_health_durodyne_daily', '7f19852c0673e5a6309a9f770bfaecce6e08076213601561ff5dd88355a054d1'),
      ('client_health_kinsey_daily', '785daf6b87ad62d332df2ed7ca78650061343e5956fca0d7c5d5933f819975d9'),
      ('client_health_arabella_daily', 'dced2da2251b1fe3e963b747953590ca6bce4efa5cbd46a7985ef2711d6f656b'),
      ('client_health_champagne_daily', '847e14a0fbf1fad3701e456c2f4ab634c791c2690e3c615634a8558c2cc713cf'),
      ('client_health_goodgame_ecommerce_daily', '623a9cb12eb690ac44317a4df3a66cd5f94abeb543429e882855e8cd60e9755f')
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
