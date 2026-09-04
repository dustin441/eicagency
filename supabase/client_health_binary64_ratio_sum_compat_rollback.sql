-- Roll back only when no active or materialized v3 state depends on the
-- ratio-sum compatibility behavior.

begin;

do $rollback$
declare
  p regprocedure := 'private.client_health_calculate_snapshot_v2(uuid,uuid,timestamp with time zone)'::regprocedure;
  d text;
  h text;
  new_text text := $new$perform public.client_health_binary64_json(cur_spend,'current spend sum');perform public.client_health_binary64_json(cur_results,'current results sum')$new$;
  old_text text := $old$perform public.client_health_binary64_json(cur_spend,'current spend sum',true);perform public.client_health_binary64_json(cur_results,'current results sum',true)$old$;
  new_previous text := $new$perform public.client_health_binary64_json(prev_spend,'previous spend sum');perform public.client_health_binary64_json(prev_results,'previous results sum')$new$;
  old_previous text := $old$perform public.client_health_binary64_json(prev_spend,'previous spend sum',true);perform public.client_health_binary64_json(prev_results,'previous results sum',true)$old$;
  new_final text := $new$'currentSpend',public.client_health_binary64_json(cur_spend,'currentSpend'),'currentResultCount',public.client_health_binary64_json(cur_results,'currentResultCount')$new$;
  old_final text := $old$'currentSpend',public.client_health_binary64_json(cur_spend,'currentSpend',true),'currentResultCount',public.client_health_binary64_json(cur_results,'currentResultCount',true)$old$;
  new_previous_final text := $new$'previousSpend',public.client_health_binary64_json(prev_spend,'previousSpend'),'previousResultCount',public.client_health_binary64_json(prev_results,'previousResultCount')$new$;
  old_previous_final text := $old$'previousSpend',public.client_health_binary64_json(prev_spend,'previousSpend',true),'previousResultCount',public.client_health_binary64_json(prev_results,'previousResultCount',true)$old$;
begin
  if current_user<>'postgres' or session_user<>'postgres' then raise exception 'binary64 ratio-sum rollback must run as postgres'; end if;
  if exists(select 1 from private.client_health_config_revision_activations a join private.client_health_config_revisions r on r.id=a.revision_id where r.revision->'schemaVersion'='3'::jsonb)
     or exists(select 1 from public.client_health_refresh_runs rr join private.client_health_config_revisions r on r.id=rr.config_revision_id where r.revision->'schemaVersion'='3'::jsonb)
     or exists(select 1 from public.client_health_snapshots s join private.client_health_config_revisions r on r.id=s.config_revision_id where r.revision->'schemaVersion'='3'::jsonb) then
    raise exception 'binary64 ratio-sum rollback refuses active or materialized v3 state';
  end if;
  select pg_catalog.pg_get_functiondef(p),pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict d,h from pg_catalog.pg_proc where oid=p;
  if h<>'b0eb39019d9aad6206c0a92e7d6c83d4af7d751ddcfa878984beb4bcee83ad5b'
     or not exists(select 1 from pg_catalog.pg_proc where oid=p and proowner='postgres'::regrole and prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog, public, private']::text[])
     or pg_catalog.has_function_privilege('public',p,'execute') or pg_catalog.has_function_privilege('anon',p,'execute')
     or pg_catalog.has_function_privilege('authenticated',p,'execute') or pg_catalog.has_function_privilege('service_role',p,'execute') then
    raise exception 'binary64 ratio-sum rollback found unexpected function drift';
  end if;
  if (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,new_text,'')))<>pg_catalog.length(new_text)
     or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,new_previous,'')))<>pg_catalog.length(new_previous)
     or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,new_final,'')))<>pg_catalog.length(new_final)
     or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,new_previous_final,'')))<>pg_catalog.length(new_previous_final) then
    raise exception 'binary64 ratio-sum rollback transformations are not unique';
  end if;
  execute pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(d,new_text,old_text),new_previous,old_previous),new_final,old_final),new_previous_final,old_previous_final);
  if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid=p)<>'70ccf159ba9cb29fc059b44fde09a68419b1d59c3db654eb1a3b986bef587271' then
    raise exception 'binary64 ratio-sum rollback postcondition failed';
  end if;
end
$rollback$;

commit;
