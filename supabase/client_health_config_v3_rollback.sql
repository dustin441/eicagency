begin;

do $$
declare v_postgres_oid oid;
begin
  if current_user<>'postgres' or session_user<>'postgres' then raise exception 'client health v3 rollback requires a direct postgres session'; end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles where rolname='postgres' and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null then raise exception 'client health v3 rollback requires postgres with BYPASSRLS and CREATEROLE'; end if;
  if to_regprocedure('public.client_health_assert_config_revision(uuid,text,jsonb)') is null
     or to_regprocedure('private.client_health_assert_config_revision_v2(uuid,text,jsonb)') is null
     or to_regprocedure('private.client_health_assert_config_revision_v3(uuid,text,jsonb)') is null then
    raise exception 'client health v3 rollback requires the complete v3 installation';
  end if;
  if exists(select 1 from private.client_health_config_revisions where revision->'schemaVersion'='3'::jsonb)
     or exists(select 1 from private.client_health_config_revision_activations a join private.client_health_config_revisions r on r.id=a.revision_id where r.revision->'schemaVersion'='3'::jsonb) then
    raise exception 'client health v3 rollback refuses while v3 revisions or activations exist';
  end if;
end
$$;

drop function public.client_health_assert_config_revision(uuid,text,jsonb);
drop function private.client_health_assert_config_revision_v3(uuid,text,jsonb);
alter function private.client_health_assert_config_revision_v2(uuid,text,jsonb) rename to client_health_assert_config_revision;
alter function private.client_health_assert_config_revision(uuid,text,jsonb) set schema public;
alter function public.client_health_assert_config_revision(uuid,text,jsonb) owner to postgres;
revoke all on function public.client_health_assert_config_revision(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on schema private from public,anon,authenticated,service_role;
revoke all on function private.client_health_stage_config_revision(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.client_health_get_active_config_revision() to service_role;

commit;