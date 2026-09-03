begin;

-- PROPOSAL ONLY. Destructive rollback is permitted only before any publication exists.
-- No CASCADE is used: unexpected dependencies abort rather than being removed implicitly.
do $$
declare
  v_postgres_oid oid;
  v_wrong_owner text[];
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'PrePass monthly publication rollback requires a direct postgres session (current_user and session_user must both be postgres)';
  end if;

  select r.oid into v_postgres_oid
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres'
    and r.rolbypassrls
    and r.rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'PrePass monthly publication rollback requires managed Supabase postgres with BYPASSRLS and CREATEROLE';
  end if;

  if not pg_catalog.has_schema_privilege('postgres', 'public', 'USAGE')
     or not pg_catalog.has_schema_privilege('postgres', 'public', 'CREATE') then
    raise exception 'PrePass monthly publication rollback requires postgres USAGE and CREATE on public';
  end if;

  if pg_catalog.to_regclass('public.prepass_monthly_publications') is null
     or pg_catalog.to_regclass('public.prepass_monthly_publication_active') is null
     or pg_catalog.to_regclass('public.prepass_monthly_publications_active') is null
     or pg_catalog.to_regprocedure('public.prepass_guard_monthly_publication_immutable()') is null
     or pg_catalog.to_regprocedure('public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text)') is null
     or not exists (
       select 1
       from pg_catalog.pg_trigger
       where tgrelid = 'public.prepass_monthly_publications'::regclass
         and tgname = 'prepass_monthly_publications_immutable'
         and not tgisinternal
     ) then
    raise exception 'rollback requires the exact complete PrePass monthly publication installation';
  end if;

  select pg_catalog.array_agg(object_name order by object_name)
  into v_wrong_owner
  from (
    select pg_catalog.format('%I.%I', n.nspname, c.relname) as object_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.oid = any(array[
      'public.prepass_monthly_publications'::regclass,
      'public.prepass_monthly_publication_active'::regclass,
      'public.prepass_monthly_publications_active'::regclass
    ]::oid[])
      and c.relowner <> v_postgres_oid
    union all
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    where p.oid = any(array[
      'public.prepass_guard_monthly_publication_immutable()'::regprocedure,
      'public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text)'::regprocedure
    ]::oid[])
      and p.proowner <> v_postgres_oid
  ) untrusted;
  if v_wrong_owner is not null then
    raise exception 'PrePass monthly publication rollback requires postgres-owned objects; wrong owner: %', v_wrong_owner;
  end if;

  lock table public.prepass_monthly_publication_active in share mode;
  lock table public.prepass_monthly_publications in share mode;

  if exists (select 1 from public.prepass_monthly_publication_active) then
    raise exception 'rollback refuses to delete published monthly history: active publication pointers exist';
  end if;
  if exists (select 1 from public.prepass_monthly_publications) then
    raise exception 'rollback refuses to delete published monthly history: immutable publications exist';
  end if;
end
$$;

revoke all on function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.prepass_guard_monthly_publication_immutable() from public, anon, authenticated, service_role;
revoke all on table public.prepass_monthly_publications_active from public, anon, authenticated, service_role;
revoke all on table public.prepass_monthly_publication_active from public, anon, authenticated, service_role;
revoke all on table public.prepass_monthly_publications from public, anon, authenticated, service_role;

-- Drop callers and dependants before their dependencies. Each statement is intentionally exact.
drop view public.prepass_monthly_publications_active;
drop function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text);
drop trigger prepass_monthly_publications_immutable on public.prepass_monthly_publications;
drop function public.prepass_guard_monthly_publication_immutable();
drop table public.prepass_monthly_publication_active;
drop table public.prepass_monthly_publications;

commit;
