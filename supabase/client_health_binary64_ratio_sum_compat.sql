-- Permit finite binary64 row aggregates whose exact decimal sum is not itself
-- the shortest JSON representation of the resulting binary64 number.
-- Row/scalar inputs remain exact; only aggregate checks and derived outputs change.

begin;

do $preflight$
declare
  p regprocedure := 'private.client_health_calculate_snapshot_v2(uuid,uuid,timestamp with time zone)'::regprocedure;
  h text;
begin
  if current_user<>'postgres' or session_user<>'postgres' then
    raise exception 'binary64 ratio-sum compatibility migration must run as postgres';
  end if;
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') into strict h
  from pg_catalog.pg_proc where oid=p;
  if h not in ('70ccf159ba9cb29fc059b44fde09a68419b1d59c3db654eb1a3b986bef587271','b0eb39019d9aad6206c0a92e7d6c83d4af7d751ddcfa878984beb4bcee83ad5b')
     or not exists(select 1 from pg_catalog.pg_proc where oid=p and proowner='postgres'::regrole and prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog, public, private']::text[])
     or pg_catalog.has_function_privilege('public',p,'execute')
     or pg_catalog.has_function_privilege('anon',p,'execute')
     or pg_catalog.has_function_privilege('authenticated',p,'execute')
     or pg_catalog.has_function_privilege('service_role',p,'execute') then
    raise exception 'binary64 ratio-sum compatibility preflight found unexpected function drift';
  end if;
end
$preflight$;

do $migration$
declare
  p regprocedure := 'private.client_health_calculate_snapshot_v2(uuid,uuid,timestamp with time zone)'::regprocedure;
  d text;
  h text;
  old_text text := $old$perform public.client_health_binary64_json(cur_spend,'current spend sum',true);perform public.client_health_binary64_json(cur_results,'current results sum',true)$old$;
  new_text text := $new$perform public.client_health_binary64_json(cur_spend,'current spend sum');perform public.client_health_binary64_json(cur_results,'current results sum')$new$;
  old_previous text := $old$perform public.client_health_binary64_json(prev_spend,'previous spend sum',true);perform public.client_health_binary64_json(prev_results,'previous results sum',true)$old$;
  new_previous text := $new$perform public.client_health_binary64_json(prev_spend,'previous spend sum');perform public.client_health_binary64_json(prev_results,'previous results sum')$new$;
  old_final text := $old$'currentSpend',public.client_health_binary64_json(cur_spend,'currentSpend',true),'currentResultCount',public.client_health_binary64_json(cur_results,'currentResultCount',true)$old$;
  new_final text := $new$'currentSpend',public.client_health_binary64_json(cur_spend,'currentSpend'),'currentResultCount',public.client_health_binary64_json(cur_results,'currentResultCount')$new$;
  old_previous_final text := $old$'previousSpend',public.client_health_binary64_json(prev_spend,'previousSpend',true),'previousResultCount',public.client_health_binary64_json(prev_results,'previousResultCount',true)$old$;
  new_previous_final text := $new$'previousSpend',public.client_health_binary64_json(prev_spend,'previousSpend'),'previousResultCount',public.client_health_binary64_json(prev_results,'previousResultCount')$new$;
begin
  select pg_catalog.pg_get_functiondef(p),pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex')
    into strict d,h from pg_catalog.pg_proc where oid=p;
  if h='70ccf159ba9cb29fc059b44fde09a68419b1d59c3db654eb1a3b986bef587271' then
    if (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,old_text,'')))<>pg_catalog.length(old_text)
       or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,old_previous,'')))<>pg_catalog.length(old_previous)
       or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,old_final,'')))<>pg_catalog.length(old_final)
       or (pg_catalog.length(d)-pg_catalog.length(pg_catalog.replace(d,old_previous_final,'')))<>pg_catalog.length(old_previous_final) then
      raise exception 'binary64 ratio-sum transformations are not unique';
    end if;
    execute pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(d,old_text,new_text),old_previous,new_previous),old_final,new_final),old_previous_final,new_previous_final);
  end if;
end
$migration$;

do $postcondition$
declare
  p regprocedure := 'private.client_health_calculate_snapshot_v2(uuid,uuid,timestamp with time zone)'::regprocedure;
begin
  if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid=p)<>'b0eb39019d9aad6206c0a92e7d6c83d4af7d751ddcfa878984beb4bcee83ad5b'
     or not exists(select 1 from pg_catalog.pg_proc where oid=p and proowner='postgres'::regrole and prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog, public, private']::text[])
     or pg_catalog.has_function_privilege('public',p,'execute')
     or pg_catalog.has_function_privilege('anon',p,'execute')
     or pg_catalog.has_function_privilege('authenticated',p,'execute')
     or pg_catalog.has_function_privilege('service_role',p,'execute') then
    raise exception 'binary64 ratio-sum compatibility postcondition failed';
  end if;
end
$postcondition$;

commit;
