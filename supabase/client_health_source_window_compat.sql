-- Production compatibility correction for provider-specific source windows.
-- ClickUp is month-to-date; Supabase performance sources include the approved
-- 28-day current/previous comparison horizon when it starts before the month.

begin;

DO $preflight$
declare
  v_hash text;
begin
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash
  from pg_catalog.pg_proc where oid='public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)'::regprocedure;
  if v_hash not in ('ae055d139ba011be29d73c0338f40e2c2d54ddff1e698a497dff8362a4118c46','5f5adc97cf02b80de88952126d3b215c1dc902a90efe30f4db438923cf88bbfe') then
    raise exception 'client health source-window migration found unexpected create-source function source';
  end if;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash
  from pg_catalog.pg_proc where oid='public.client_health_assert_refresh_integrity(uuid)'::regprocedure;
  if v_hash not in ('e3fc7cc373f5d6835f39bcb0ce0779500ebcbf3ff56821a8cf6ac73618cc7a36','b0781c08d0abe35c075efdd40e68105189ab0202580e115c1f37a2d86850c2c5') then
    raise exception 'client health source-window migration found unexpected integrity function source';
  end if;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash
  from pg_catalog.pg_proc where oid='public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure;
  if v_hash not in (
    '6e3ea0f8b4b1a14fbca8c51dac5dbc4c6c64fc2444395dc5764d388e9a30e6eb',
    '5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955',
    '21a3c10da93b19af246e839e7f7c53ba5fd21d02c972a6214dfdd9ab01832d1d',
    '0dcefaeb3f7d272cabc7deb94bd5947b3099fccbb9b19ec2266c3a15411a1bb2'
  ) then raise exception 'client health source-window migration found unexpected public persistence function source'; end if;

  if to_regprocedure('private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)') is not null then
    select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash
    from pg_catalog.pg_proc where oid='private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)'::regprocedure;
    if v_hash not in ('6e3ea0f8b4b1a14fbca8c51dac5dbc4c6c64fc2444395dc5764d388e9a30e6eb','5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955') then
      raise exception 'client health source-window migration found unexpected private v2 persistence function source';
    end if;
  end if;
end
$preflight$;

create or replace function public.client_health_create_source_run(
  p_id uuid,
  p_refresh_run_id uuid,
  p_client_id uuid,
  p_source_key text,
  p_window_start date,
  p_window_end date,
  p_started_at timestamptz,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.client_health_source_runs%rowtype;
  v_run public.client_health_refresh_runs%rowtype;
  v_source_provider text;
  v_month_window_start date;
  v_comparison_window_start date;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'collecting' then
    raise exception 'client health source creation requires a collecting refresh';
  end if;
  if p_source_key is null or p_source_key !~ '^[a-z0-9][a-z0-9_.-]*$' or p_started_at is null
     or ((p_window_start is null) <> (p_window_end is null)) then
    raise exception 'client health source identity is malformed';
  end if;
  perform public.client_health_assert_config_revision(v_run.config_revision_id,v_run.config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_run.config_revision_id));
  if (select count(*)
      from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
      cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
      where cr.id=v_run.config_revision_id and cr.revision_hash=v_run.config_revision_hash
        and c->>'clientId'=p_client_id::text and x->>'sourceKey'=p_source_key) <> 1 then
    raise exception 'source client/key is not exactly authorized by run-pinned revision';
  end if;
  select x->>'provider' into strict v_source_provider
  from private.client_health_config_revisions cr
  cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
  cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
  where cr.id=v_run.config_revision_id and cr.revision_hash=v_run.config_revision_hash
    and c->>'clientId'=p_client_id::text and x->>'sourceKey'=p_source_key;
  v_month_window_start := pg_catalog.date_trunc('month',v_run.snapshot_date)::date;
  v_comparison_window_start := least(v_month_window_start, v_run.snapshot_date - 27);
  if v_source_provider not in ('supabase','clickup')
     or (v_source_provider='clickup' and p_window_start is distinct from v_month_window_start)
     or (v_source_provider='supabase'
       and p_window_start is distinct from v_month_window_start
       and p_window_start is distinct from v_comparison_window_start)
     or p_window_end is distinct from v_run.snapshot_date then
    raise exception 'source window does not match the run materialized date window';
  end if;
  insert into public.client_health_source_runs (
    id, refresh_run_id, client_id, source_key, run_status, window_start, window_end, started_at
  ) values (
    p_id, p_refresh_run_id, p_client_id, p_source_key, 'running', p_window_start, p_window_end, p_started_at
  ) on conflict (id) do nothing;
  select * into v_source from public.client_health_source_runs where id = p_id;
  if v_source.id is null or v_source.run_status <> 'running'
     or v_source.refresh_run_id <> p_refresh_run_id or v_source.client_id <> p_client_id
     or v_source.source_key <> p_source_key or v_source.window_start is distinct from p_window_start
     or v_source.window_end is distinct from p_window_end or v_source.started_at <> p_started_at then
    raise exception 'client health source caller ID exists with incompatible identity or state';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_source.id, 'status', v_source.run_status, 'refreshRunId', v_source.refresh_run_id,
    'clientId', v_source.client_id, 'sourceKey', v_source.source_key,
    'windowStart', v_source.window_start, 'windowEnd', v_source.window_end,
    'startedAt', pg_catalog.to_char(v_source.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$$;

DO $migration$
declare
  v_signature text;
  v_proc regprocedure;
  v_definition text;
  v_updated text;
  v_old constant text := $old$        and sr.window_start=pg_catalog.date_trunc('month',v_run.snapshot_date)::date and sr.window_end=v_run.snapshot_date$old$;
  v_new constant text := $new$        and sr.window_end=v_run.snapshot_date
        and (
          (binding->>'provider'='clickup' and sr.window_start=pg_catalog.date_trunc('month',v_run.snapshot_date)::date)
          or (binding->>'provider'='supabase' and sr.window_start in (
            pg_catalog.date_trunc('month',v_run.snapshot_date)::date,
            least(pg_catalog.date_trunc('month',v_run.snapshot_date)::date,v_run.snapshot_date-27)
          ))
        )$new$;
begin
  foreach v_signature in array array[
    'public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)',
    'public.client_health_assert_refresh_integrity(uuid)',
    'private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)'
  ] loop
    v_proc := to_regprocedure(v_signature);
    if v_proc is null then continue; end if;
    v_definition := pg_catalog.pg_get_functiondef(v_proc);
    if (pg_catalog.length(v_definition)-pg_catalog.length(pg_catalog.replace(v_definition,v_old,''))) = pg_catalog.length(v_old) then
      v_updated := pg_catalog.replace(v_definition,v_old,v_new);
      execute v_updated;
    elsif (pg_catalog.length(v_definition)-pg_catalog.length(pg_catalog.replace(v_definition,v_new,''))) <> pg_catalog.length(v_new) then
      raise exception 'client health source-window migration found unexpected source for %',v_proc;
    end if;
  end loop;
end
$migration$;

DO $postcondition$
declare
  v_hash text;
begin
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash from pg_catalog.pg_proc where oid='public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)'::regprocedure;
  if v_hash<>'5f5adc97cf02b80de88952126d3b215c1dc902a90efe30f4db438923cf88bbfe' then raise exception 'client health create-source postcondition mismatch'; end if;
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash from pg_catalog.pg_proc where oid='public.client_health_assert_refresh_integrity(uuid)'::regprocedure;
  if v_hash<>'b0781c08d0abe35c075efdd40e68105189ab0202580e115c1f37a2d86850c2c5' then raise exception 'client health integrity postcondition mismatch'; end if;
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash from pg_catalog.pg_proc where oid='public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure;
  if v_hash not in ('5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955','0dcefaeb3f7d272cabc7deb94bd5947b3099fccbb9b19ec2266c3a15411a1bb2') then raise exception 'client health public persistence postcondition mismatch'; end if;
  if to_regprocedure('private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)') is not null then
    select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict v_hash from pg_catalog.pg_proc where oid='private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)'::regprocedure;
    if v_hash<>'5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955' then raise exception 'client health private v2 persistence postcondition mismatch'; end if;
  end if;
end
$postcondition$;

alter function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) owner to postgres;
revoke all on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) from public, anon, authenticated, service_role;
grant execute on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) to service_role;

DO $$
declare
  v_proc pg_catalog.pg_proc%rowtype;
begin
  select p.* into strict v_proc
  from pg_catalog.pg_proc p
  where p.oid='public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)'::pg_catalog.regprocedure;
  if not v_proc.prosecdef
     or v_proc.proowner <> 'postgres'::pg_catalog.regrole
     or v_proc.proconfig is distinct from array['search_path=pg_catalog, public']::text[] then
    raise exception 'client_health_create_source_run security metadata mismatch';
  end if;
  if pg_catalog.has_function_privilege('anon', v_proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_proc.oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', v_proc.oid, 'EXECUTE') then
    raise exception 'client_health_create_source_run ACL mismatch';
  end if;
end
$$;

commit;
