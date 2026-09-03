begin;

do $migration$
declare
  p regprocedure := 'public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text)'::regprocedure;
  v_def text;
  v_hash text;
  v_old constant text := ') ordered where previous>canonical';
  v_new constant text := ') ordered where previous collate "C" > canonical collate "C"';
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'source fact order compatibility migration must run as postgres';
  end if;

  select pg_get_functiondef(p),
         encode(extensions.digest(convert_to(pg_get_functiondef(p),'UTF8'),'sha256'),'hex')
    into v_def,v_hash;

  if v_hash not in (
    '4720def5873508692b2880578a42c66114e9278552b2dcf2980e4493f2a4aa09',
    '42febf7ed7250367509fdf0c3b04ce5fbeffda955d1dcc89bc323fe743d2fdae'
  ) then
    raise exception 'source fact order compatibility migration refuses unexpected function drift: %',v_hash;
  end if;

  if v_hash='4720def5873508692b2880578a42c66114e9278552b2dcf2980e4493f2a4aa09' then
    if strpos(v_def,v_old)=0 or strpos(replace(v_def,v_old,''),v_old)>0 or strpos(v_def,v_new)>0 then
      raise exception 'source fact order compatibility anchor is missing, duplicated, or already mixed';
    end if;
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;
end
$migration$;

do $verify$
declare
  p regprocedure := 'public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text)'::regprocedure;
  d text := pg_get_functiondef(p);
begin
  if encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex') <> '42febf7ed7250367509fdf0c3b04ce5fbeffda955d1dcc89bc323fe743d2fdae'
     or not (select prosecdef from pg_proc where oid=p)
     or (select proconfig from pg_proc where oid=p) is distinct from array['search_path=pg_catalog, public']
     or (select r.rolname from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid=p) <> 'postgres'
     or has_function_privilege('public',p,'execute')
     or has_function_privilege('anon',p,'execute')
     or has_function_privilege('authenticated',p,'execute')
     or has_function_privilege('service_role',p,'execute')
     or strpos(d,') ordered where previous collate "C" > canonical collate "C"')=0
     or strpos(d,') ordered where previous>canonical')>0 then
    raise exception 'source fact order compatibility postcondition failed: %',
      encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex');
  end if;
end
$verify$;

commit;
