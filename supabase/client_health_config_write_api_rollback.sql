begin;

do $$
declare v_postgres_oid oid;
begin
  if current_user<>'postgres' or session_user<>'postgres' then
    raise exception 'client health config write API rollback requires a direct postgres session';
  end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles
  where rolname='postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'client health config write API rollback requires EIC Clients and managed postgres';
  end if;
  if to_regclass('private.client_health_config_write_secrets') is null
     or to_regclass('private.client_health_config_write_nonces') is null
     or to_regprocedure('private.client_health_set_config_write_secret(text)') is null
     or to_regprocedure('public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)') is null then
    raise exception 'client health config write API rollback requires the complete installation';
  end if;
  if exists(select 1 from private.client_health_config_write_nonces) then
    raise exception 'client health config write API rollback refuses after a signed mutation was consumed';
  end if;
end
$$;

revoke all on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) from public,anon,authenticated,service_role;
drop function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text);
revoke all on function private.client_health_set_config_write_secret(text) from public,anon,authenticated,service_role;
drop function private.client_health_set_config_write_secret(text);
drop table private.client_health_config_write_nonces;
drop table private.client_health_config_write_secrets;
revoke all on schema private from public,anon,authenticated,service_role;

commit;
