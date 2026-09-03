-- Add absolute cost-per-result target support to the v3 configuration validator
-- and authoritative calculator. This migration upgrades only exact reviewed
-- function definitions and is safe to replay.

begin;

DO $preflight$
declare
  v_proc regprocedure;
  v_hash text;
  v_signature text;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'absolute CPR compatibility migration must run as postgres';
  end if;
  foreach v_signature in array array[
    'private.client_health_assert_config_revision_v3(uuid,text,jsonb)',
    'private.client_health_calculate_snapshot_v3(uuid,uuid,timestamp with time zone)'
  ] loop
    v_proc := v_signature::regprocedure;
    select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p.prosrc,'UTF8'),'sha256'),'hex')
      into strict v_hash from pg_catalog.pg_proc p where p.oid=v_proc;
    if (v_signature like '%assert_config_revision_v3%' and v_hash not in (
          '4c2e784fcfa3e341e6a5cbd010d03c25c487cd0e6efea5fc504065e0896b65c4',
          '7c65c745bae5eae393e4e7d310e58fe3628313f8cc28d92fbab2fb24cd3093c7'
        ))
       or (v_signature like '%calculate_snapshot_v3%' and v_hash not in (
          '009f6b1324288f2dad0587fd967b08455774e72ade42a4c5456d260d02296a7f',
          '81712067cf5ceaf86d62b1dd9fc54ddee524e9824f3152236896f24d1033ba94'
        ))
       or not exists (
         select 1 from pg_catalog.pg_proc p
         where p.oid=v_proc and p.proowner='postgres'::regrole and p.prosecdef
           and p.proconfig=array['search_path=pg_catalog, public, private']::text[]
           and ((v_signature like '%assert_config_revision_v3%' and p.provolatile='v')
             or (v_signature like '%calculate_snapshot_v3%' and p.provolatile='s'))
       )
       or pg_catalog.has_function_privilege('public',v_proc,'execute')
       or pg_catalog.has_function_privilege('anon',v_proc,'execute')
       or pg_catalog.has_function_privilege('authenticated',v_proc,'execute')
       or pg_catalog.has_function_privilege('service_role',v_proc,'execute') then
      raise exception 'absolute CPR compatibility preflight found unexpected function drift: %',v_signature;
    end if;
  end loop;
end
$preflight$;

DO $migration$
declare
  v_proc regprocedure;
  v_definition text;
  v_updated text;
  v_hash text;
  v_old text;
  v_new text;
begin
  v_proc := 'private.client_health_assert_config_revision_v3(uuid,text,jsonb)'::regprocedure;
  select pg_catalog.pg_get_functiondef(v_proc),
         pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex')
    into strict v_definition,v_hash from pg_catalog.pg_proc where oid=v_proc;
  if v_hash='4c2e784fcfa3e341e6a5cbd010d03c25c487cd0e6efea5fc504065e0896b65c4' then
    v_old := $old$         or not ((lane->>'formula'='cost_per_result' and lane->>'evaluation'='period_over_period_change' and lane->>'direction'='lower_is_better')$old$;
    v_new := $new$         or pg_catalog.abs((lane->>'greenThreshold')::numeric)>1000000000 or pg_catalog.abs((lane->>'yellowThreshold')::numeric)>1000000000
         or not ((lane->>'formula'='cost_per_result' and lane->>'evaluation' in ('absolute_target','period_over_period_change') and lane->>'direction'='lower_is_better')$new$;
    if (pg_catalog.length(v_definition)-pg_catalog.length(pg_catalog.replace(v_definition,v_old,'')))<>pg_catalog.length(v_old) then
      raise exception 'absolute CPR validator transformation is not unique';
    end if;
    execute pg_catalog.replace(v_definition,v_old,v_new);
  end if;

  v_proc := 'private.client_health_calculate_snapshot_v3(uuid,uuid,timestamp with time zone)'::regprocedure;
  select pg_catalog.pg_get_functiondef(v_proc),
         pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex')
    into strict v_definition,v_hash from pg_catalog.pg_proc where oid=v_proc;
  if v_hash='009f6b1324288f2dad0587fd967b08455774e72ade42a4c5456d260d02296a7f' then
    v_updated := v_definition;

    v_old := $old$ required_incomplete boolean:=false; required_risk boolean:=false; critical boolean:=false; overall text; missing_source text; missing_window text;$old$;
    v_new := $new$ required_incomplete boolean:=false; required_risk boolean:=false; critical boolean:=false; previous_available boolean; overall text; missing_source text; missing_window text;$new$;
    if (pg_catalog.length(v_updated)-pg_catalog.length(pg_catalog.replace(v_updated,v_old,'')))<>pg_catalog.length(v_old) then raise exception 'absolute CPR availability declaration transformation is not unique'; end if;
    v_updated := pg_catalog.replace(v_updated,v_old,v_new);

    v_old := $old$  current_spend:=0;current_results:=0;previous_spend:=0;previous_results:=0;current_value:=null;previous_value:=null;evaluation_value:=null;missing_source:=null;missing_window:=null;$old$;
    v_new := $new$  current_spend:=0;current_results:=0;previous_spend:=0;previous_results:=0;current_value:=null;previous_value:=null;evaluation_value:=null;missing_source:=null;missing_window:=null;previous_available:=true;$new$;
    if (pg_catalog.length(v_updated)-pg_catalog.length(pg_catalog.replace(v_updated,v_old,'')))<>pg_catalog.length(v_old) then raise exception 'absolute CPR availability reset transformation is not unique'; end if;
    v_updated := pg_catalog.replace(v_updated,v_old,v_new);

    v_old := $old$  if missing_source is null then
   current_value:=case when lane->>'formula'='cost_per_result' then case when current_results=0 then null else current_spend/current_results end else case when current_spend=0 then null else current_results/current_spend end end;
   for source_key in select x from pg_catalog.jsonb_array_elements_text(lane->'sourceKeys') x order by x loop
    if not exists(select 1 from public.client_health_source_runs s join lateral(select value b from pg_catalog.jsonb_array_elements(c->'sources') where value->>'sourceKey'=s.source_key) z on true
      where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key and s.run_status='succeeded' and s.data_through is not null
        and r.snapshot_date-(s.data_through at time zone 'UTC')::date <= (b->'freshnessPolicy'->>'maximumLagDays')::integer
        and pg_catalog.jsonb_typeof(s.facts->'previousRows')='array') then missing_source:=source_key;missing_window:='previous';exit;end if;
    select previous_spend+coalesce(pg_catalog.sum((x->>'spend')::numeric),0),previous_results+coalesce(pg_catalog.sum((x->>'results')::numeric),0)
     into previous_spend,previous_results from public.client_health_source_runs s cross join lateral pg_catalog.jsonb_array_elements(s.facts->'previousRows') x
     where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key;
   end loop;
  end if;$old$;
    v_new := $new$  if missing_source is null then
   current_value:=case when lane->>'formula'='cost_per_result' then case when current_results=0 then null else current_spend/current_results end else case when current_spend=0 then null else current_results/current_spend end end;
   for source_key in select x from pg_catalog.jsonb_array_elements_text(lane->'sourceKeys') x order by x loop
    if not exists(select 1 from public.client_health_source_runs s join lateral(select value b from pg_catalog.jsonb_array_elements(c->'sources') where value->>'sourceKey'=s.source_key) z on true
      where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key and s.run_status='succeeded' and s.data_through is not null
        and r.snapshot_date-(s.data_through at time zone 'UTC')::date <= (b->'freshnessPolicy'->>'maximumLagDays')::integer
        and pg_catalog.jsonb_typeof(s.facts->'previousRows')='array') then
     previous_available:=false;
     if lane->>'evaluation'='period_over_period_change' then missing_source:=source_key;missing_window:='previous';end if;
     exit;
    end if;
    select previous_spend+coalesce(pg_catalog.sum((x->>'spend')::numeric),0),previous_results+coalesce(pg_catalog.sum((x->>'results')::numeric),0)
     into previous_spend,previous_results from public.client_health_source_runs s cross join lateral pg_catalog.jsonb_array_elements(s.facts->'previousRows') x
     where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key;
   end loop;
  end if;$new$;
    if (pg_catalog.length(v_updated)-pg_catalog.length(pg_catalog.replace(v_updated,v_old,'')))<>pg_catalog.length(v_old) then raise exception 'absolute CPR optional previous transformation is not unique'; end if;
    v_updated := pg_catalog.replace(v_updated,v_old,v_new);

    v_old := $old$   previous_value:=case when previous_results=0 then null else previous_spend/previous_results end;
   if current_results=0 then status:='at_risk';reason:=label||' current window has zero verified results.';
   elsif previous_results=0 then$old$;
    v_new := $new$   previous_value:=case when previous_available and previous_results<>0 then previous_spend/previous_results else null end;
   if current_results=0 then status:='at_risk';reason:=label||' current window has zero verified results.';
   elsif lane->>'evaluation'='absolute_target' then evaluation_value:=current_value;status:=case when current_value<=green then'healthy'when current_value<=yellow then'watch'else'at_risk'end;reason:=label||' is '||private.client_health_lane_display(current_value)||' against a healthy threshold of '||private.client_health_lane_display(green)||'.';
   elsif previous_results=0 then$new$;
    if (pg_catalog.length(v_updated)-pg_catalog.length(pg_catalog.replace(v_updated,v_old,'')))<>pg_catalog.length(v_old) then raise exception 'absolute CPR evaluation transformation is not unique'; end if;
    v_updated := pg_catalog.replace(v_updated,v_old,v_new);

    v_old := $old$   previous_value:=case when missing_source is null and previous_spend<>0 then previous_results/previous_spend else null end;$old$;
    v_new := $new$   previous_value:=case when missing_source is null and previous_available and previous_spend<>0 then previous_results/previous_spend else null end;$new$;
    if (pg_catalog.length(v_updated)-pg_catalog.length(pg_catalog.replace(v_updated,v_old,'')))<>pg_catalog.length(v_old) then raise exception 'absolute ROAS previous-value transformation is not unique'; end if;
    execute pg_catalog.replace(v_updated,v_old,v_new);
  end if;
end
$migration$;

DO $postcondition$
declare
  v_assert regprocedure := 'private.client_health_assert_config_revision_v3(uuid,text,jsonb)'::regprocedure;
  v_calculate regprocedure := 'private.client_health_calculate_snapshot_v3(uuid,uuid,timestamp with time zone)'::regprocedure;
begin
  if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid=v_assert)
       <> '7c65c745bae5eae393e4e7d310e58fe3628313f8cc28d92fbab2fb24cd3093c7'
     or (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid=v_calculate)
       <> '81712067cf5ceaf86d62b1dd9fc54ddee524e9824f3152236896f24d1033ba94' then
    raise exception 'absolute CPR compatibility postcondition hash mismatch';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p where p.oid in (v_assert,v_calculate)
      and (p.proowner<>'postgres'::regrole or not p.prosecdef
        or p.proconfig<>array['search_path=pg_catalog, public, private']::text[])
  )
  or pg_catalog.has_function_privilege('public',v_assert,'execute')
  or pg_catalog.has_function_privilege('anon',v_assert,'execute')
  or pg_catalog.has_function_privilege('authenticated',v_assert,'execute')
  or pg_catalog.has_function_privilege('service_role',v_assert,'execute')
  or pg_catalog.has_function_privilege('public',v_calculate,'execute')
  or pg_catalog.has_function_privilege('anon',v_calculate,'execute')
  or pg_catalog.has_function_privilege('authenticated',v_calculate,'execute')
  or pg_catalog.has_function_privilege('service_role',v_calculate,'execute') then
    raise exception 'absolute CPR compatibility security postcondition failed';
  end if;
end
$postcondition$;

commit;
