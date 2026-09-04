begin;

do $$
declare v_postgres oid;
begin
 if current_user<>'postgres' or session_user<>'postgres' then raise exception 'client health authoritative v3 rollback requires a direct postgres session';end if;
 select oid into v_postgres from pg_catalog.pg_roles where rolname='postgres' and rolbypassrls and rolcreaterole;
 if v_postgres is null
    or to_regprocedure('public.client_health_calculate_snapshot(uuid,uuid,timestamptz)') is null
    or to_regprocedure('private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz)') is null
    or to_regprocedure('private.client_health_calculate_snapshot_v3(uuid,uuid,timestamptz)') is null
    or to_regprocedure('public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)') is null
    or to_regprocedure('private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)') is null then
   raise exception 'client health authoritative v3 rollback requires the complete authoritative-v3 installation';
 end if;
 if exists(select 1 from public.client_health_refresh_runs rr join private.client_health_config_revisions cr on cr.id=rr.config_revision_id where cr.revision->'schemaVersion'='3'::jsonb)
    or exists(select 1 from public.client_health_snapshots s join private.client_health_config_revisions cr on cr.id=s.config_revision_id where cr.revision->'schemaVersion'='3'::jsonb) then
   raise exception 'client health authoritative v3 rollback refuses while any v3 refresh or snapshot exists';
 end if;
 if exists(select 1 from private.client_health_active_config_revision active join private.client_health_config_revision_activations a on a.id=active.activation_id join private.client_health_config_revisions cr on cr.id=a.revision_id where cr.revision->'schemaVersion'='3'::jsonb) then
   raise exception 'client health authoritative v3 rollback refuses while a v3 revision is active';
 end if;
 if exists(select 1 from pg_catalog.pg_proc fn where fn.oid in (
   'public.client_health_calculate_snapshot(uuid,uuid,timestamptz)'::regprocedure,
   'private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz)'::regprocedure,
   'private.client_health_calculate_snapshot_v3(uuid,uuid,timestamptz)'::regprocedure,
   'public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure,
   'private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)'::regprocedure)
   and (fn.proowner<>v_postgres or not fn.prosecdef or not exists(select 1 from pg_catalog.unnest(fn.proconfig) setting where setting like 'search_path=%'))) then
   raise exception 'client health authoritative v3 rollback refuses untrusted function ownership or search_path';
 end if;
end$$;

revoke all on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
drop function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint);
drop function public.client_health_calculate_snapshot(uuid,uuid,timestamptz);
drop function private.client_health_calculate_snapshot_v3(uuid,uuid,timestamptz);
drop function private.client_health_lane_display(numeric);
alter function private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz) rename to client_health_calculate_snapshot;
alter function private.client_health_calculate_snapshot(uuid,uuid,timestamptz) set schema public;
alter function private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint) rename to client_health_persist_snapshot_bundle;
alter function private.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) set schema public;
alter function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) owner to postgres;
alter function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) owner to postgres;
revoke all on function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) to service_role;
revoke all on schema private from public,anon,authenticated,service_role;

do $$
begin
 if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid='public.client_health_calculate_snapshot(uuid,uuid,timestamptz)'::regprocedure)<>'b0eb39019d9aad6206c0a92e7d6c83d4af7d751ddcfa878984beb4bcee83ad5b'
    or (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid='public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure)<>'5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955' then
   raise exception 'client health authoritative v3 rollback failed to restore exact approved v2 sources';
 end if;
 if pg_catalog.has_function_privilege('service_role','public.client_health_calculate_snapshot(uuid,uuid,timestamptz)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role','public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)','EXECUTE') then
   raise exception 'client health authoritative v3 rollback failed to restore exact v2 ACLs';
 end if;
end$$;

commit;
