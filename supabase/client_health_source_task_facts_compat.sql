begin;

do $migration$
declare
  p regprocedure:='public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text)'::regprocedure;
  v_def text;
  v_hash text;
  v_old text;
  v_new text;
begin
  if current_user<>'postgres' or session_user<>'postgres' then raise exception 'source task facts compatibility migration must run as postgres'; end if;
  select pg_get_functiondef(p),encode(extensions.digest(convert_to(pg_get_functiondef(p),'UTF8'),'sha256'),'hex') into v_def,v_hash;
  if v_hash not in (
    '9986832b3f4c76a07363aa7f655694b8cbf826951b9d69c2127e0e1b7a38c920',
    '4720def5873508692b2880578a42c66114e9278552b2dcf2980e4493f2a4aa09'
  ) then
    raise exception 'source task facts compatibility migration refuses unexpected function drift: %',v_hash;
  end if;
  if v_hash='9986832b3f4c76a07363aa7f655694b8cbf826951b9d69c2127e0e1b7a38c920' then
    v_old:=$old$  into v_permitted_fields from pg_catalog.jsonb_array_elements(v_binding->'permittedFactFields') value;
  perform public.client_health_assert_exact_keys(p_facts,v_permitted_fields,'source facts');$old$;
    v_new:=$new$  into v_permitted_fields from pg_catalog.jsonb_array_elements(v_binding->'permittedFactFields') value;
  -- topTasks was added after the original v2 runner shipped. Keep it optional at
  -- the RPC boundary so an application rollback can still finish an in-flight
  -- refresh; when supplied, the validation below remains exact and fail-closed.
  if v_provider='clickup' and (v_binding->>'permitsTasks')::boolean and p_facts ? 'topTasks' then
    v_permitted_fields:=pg_catalog.array_append(v_permitted_fields,'topTasks');
    select pg_catalog.array_agg(x order by x) into v_permitted_fields from pg_catalog.unnest(v_permitted_fields)x;
  end if;
  perform public.client_health_assert_exact_keys(p_facts,v_permitted_fields,'source facts');$new$;
    if pg_catalog.strpos(v_def,v_old)=0 then raise exception 'source task facts compatibility permitted-fields anchor is missing'; end if;
    v_def:=pg_catalog.replace(v_def,v_old,v_new);

    v_old:=$old$    else raise exception 'source fact key is unsupported'; end if;$old$;
    v_new:=$new$    elsif v_fact.key='topTasks' then
      if v_provider<>'clickup' or not (v_binding->>'permitsTasks')::boolean
         or pg_catalog.jsonb_typeof(v_fact.value) not in ('array','null')
         or (pg_catalog.jsonb_typeof(v_fact.value)='array' and pg_catalog.jsonb_array_length(v_fact.value)>5) then
        raise exception 'source topTasks fact is not authorized or bounded';
      end if;
      if pg_catalog.jsonb_typeof(v_fact.value)='array' and exists (
        select 1 from pg_catalog.jsonb_array_elements(v_fact.value) task
        where pg_catalog.jsonb_typeof(task)<>'object'
           or (select coalesce(pg_catalog.array_agg(key order by key),'{}') from pg_catalog.jsonb_object_keys(task) keys(key))<>array['dueAt','id','listId','name','url']::text[]
           or pg_catalog.jsonb_typeof(task->'id')<>'string' or task->>'id' !~ '^[A-Za-z0-9]+$' or pg_catalog.length(task->>'id')>128
           or pg_catalog.jsonb_typeof(task->'listId')<>'string' or task->>'listId' !~ '^[1-9][0-9]*$' or pg_catalog.length(task->>'listId')>64
           or not (v_binding->'allowedListIds' ? (task->>'listId'))
           or pg_catalog.jsonb_typeof(task->'name')<>'string' or task->>'name'='' or task->>'name'<>pg_catalog.btrim(task->>'name') or pg_catalog.length(task->>'name')>500
           or pg_catalog.jsonb_typeof(task->'url')<>'string' or task->>'url'<>'https://app.clickup.com/t/'||(task->>'id')
           or pg_catalog.jsonb_typeof(task->'dueAt')<>'string'
           or task->>'dueAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
           or not pg_catalog.isfinite((task->>'dueAt')::timestamptz)
           or pg_catalog.to_char((task->>'dueAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>task->>'dueAt'
           or (task->>'dueAt')::timestamptz>=((v_run.snapshot_date+1)::timestamp at time zone 'America/Phoenix')
      ) then raise exception 'source topTasks fact rows are malformed or unauthorized'; end if;
      if pg_catalog.jsonb_typeof(v_fact.value)='array' and exists (
        select 1 from (
          select task->>'dueAt' due_at,task->>'id' id,
            pg_catalog.lag(task->>'dueAt') over(order by ordinality) previous_due_at,
            pg_catalog.lag(task->>'id') over(order by ordinality) previous_id
          from pg_catalog.jsonb_array_elements(v_fact.value) with ordinality item(task,ordinality)
        ) ordered where previous_due_at>due_at or (previous_due_at=due_at and previous_id>id)
      ) then raise exception 'source topTasks facts are not in canonical order'; end if;
    else raise exception 'source fact key is unsupported'; end if;$new$;
    if pg_catalog.strpos(v_def,v_old)=0 then raise exception 'source task facts compatibility validation anchor is missing'; end if;
    v_def:=pg_catalog.replace(v_def,v_old,v_new);

    v_old:=$old$    else v_count:=null; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs') not in ('string','null')$old$;
    v_new:=$new$    else v_count:=null; end if;
    if p_status='succeeded' and (v_binding->>'permitsTasks')::boolean and p_facts ? 'topTasks' and (
         pg_catalog.jsonb_typeof(p_facts->'overdueTaskCount')<>'number'
         or (p_facts->>'overdueTaskCount')::numeric<>(p_evidence->>'overdueTaskCount')::numeric
         or pg_catalog.jsonb_typeof(p_facts->'topTasks')<>'array'
         or pg_catalog.jsonb_array_length(p_facts->'topTasks')<>least((p_evidence->>'overdueTaskCount')::integer,5)
       ) then raise exception 'ClickUp overdue facts or topTasks do not match overdueTaskCount evidence'; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs') not in ('string','null')$new$;
    if pg_catalog.strpos(v_def,v_old)=0 then raise exception 'source task facts compatibility count anchor is missing'; end if;
    v_def:=pg_catalog.replace(v_def,v_old,v_new);
    execute v_def;
  end if;
end
$migration$;

alter function public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text) owner to postgres;
revoke all on function public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text) from public,anon,authenticated,service_role;

do $verify$
declare p regprocedure:='public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text)'::regprocedure; d text:=pg_get_functiondef(p);
begin
  if not (select prosecdef from pg_proc where oid=p)
     or encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex')<>'4720def5873508692b2880578a42c66114e9278552b2dcf2980e4493f2a4aa09'
     or (select proconfig from pg_proc where oid=p) is distinct from array['search_path=pg_catalog, public']
     or (select r.rolname from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid=p)<>'postgres'
     or has_function_privilege('public',p,'execute') or has_function_privilege('anon',p,'execute')
     or has_function_privilege('authenticated',p,'execute') or has_function_privilege('service_role',p,'execute')
     or pg_catalog.strpos(d,'''topTasks''')=0
     or pg_catalog.strpos(d,'source topTasks facts are not in canonical order')=0
     or pg_catalog.strpos(d,'ClickUp overdue facts or topTasks do not match overdueTaskCount evidence')=0 then
    raise exception 'source task facts compatibility postcondition failed: %',encode(extensions.digest(convert_to(d,'UTF8'),'sha256'),'hex');
  end if;
end
$verify$;

commit;
