begin;

do $migration$
declare
  p regprocedure := 'public.client_health_binary64_json(numeric,text,boolean)'::regprocedure;
  d text := pg_get_functiondef(p);
  h text := encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex');
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'binary64 GUC compatibility migration must run as postgres';
  end if;
  if h not in (
    '9a4c9d9e65d6fe4786a8e75daaca6d1cfb86cb11d18608f48b06e34f1dcfaaf8',
    'ff01306e9c15547b32e90dcbf930e9d128b08c5196f47d02e67a28ce95a05eaf'
  ) then
    raise exception 'binary64 GUC compatibility migration refuses unexpected function drift: %',h;
  end if;
  if h='9a4c9d9e65d6fe4786a8e75daaca6d1cfb86cb11d18608f48b06e34f1dcfaaf8' then
    alter function public.client_health_binary64_json(numeric,text,boolean) set extra_float_digits to '3';
  end if;
end
$migration$;

do $verify$
declare
  p regprocedure := 'public.client_health_binary64_json(numeric,text,boolean)'::regprocedure;
  d text := pg_get_functiondef(p);
begin
  if encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex') <> 'ff01306e9c15547b32e90dcbf930e9d128b08c5196f47d02e67a28ce95a05eaf'
     or not (select proisstrict=false and provolatile='i' and prosecdef from pg_proc where oid=p)
     or (select proconfig from pg_proc where oid=p) is distinct from array['search_path=pg_catalog','extra_float_digits=3']
     or (select r.rolname from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid=p) <> 'postgres'
     or has_function_privilege('public',p,'execute')
     or has_function_privilege('anon',p,'execute')
     or has_function_privilege('authenticated',p,'execute')
     or has_function_privilege('service_role',p,'execute') then
    raise exception 'binary64 GUC compatibility postcondition failed: %',
      encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex');
  end if;
  perform pg_catalog.set_config('extra_float_digits','0',true);
  if public.client_health_binary64_json(0.16666666666666666,'binary64 GUC verification',true)
       is distinct from '0.16666666666666666'::jsonb then
    raise exception 'binary64 GUC compatibility behavior verification failed';
  end if;
end
$verify$;

commit;
