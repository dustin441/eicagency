begin;

-- Database-authoritative v3 calculator. Apply only after client_health_config_v3.sql.
do $$
declare
  v_postgres oid;
  v_calc_sha constant text := '70ccf159ba9cb29fc059b44fde09a68419b1d59c3db654eb1a3b986bef587271';
  v_persist_sha constant text := '5abd2b32d8bf2ca76782cba4025f8e980a70c1cd5389fab31bffee0045078955';
begin
  if current_user<>'postgres' or session_user<>'postgres' then raise exception 'client health authoritative v3 requires a direct postgres session'; end if;
  select oid into v_postgres from pg_catalog.pg_roles where rolname='postgres' and rolbypassrls and rolcreaterole;
  if v_postgres is null or to_regclass('public.master_spartaco') is null then raise exception 'client health authoritative v3 requires the EIC managed postgres owner'; end if;
  if to_regprocedure('private.client_health_assert_config_revision_v3(uuid,text,jsonb)') is null
     or to_regprocedure('public.client_health_calculate_snapshot(uuid,uuid,timestamptz)') is null
     or to_regprocedure('public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)') is null
     or to_regprocedure('private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz)') is not null
     or to_regprocedure('private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint)') is not null then
    raise exception 'client health authoritative v3 requires exact config-v3 over atomic-v2 and no prior calculator installation';
  end if;
  if exists(select 1 from private.client_health_config_revision_activations a join private.client_health_config_revisions r on r.id=a.revision_id where r.revision->'schemaVersion'='3'::jsonb)
     or exists(select 1 from public.client_health_refresh_runs rr join private.client_health_config_revisions r on r.id=rr.config_revision_id where r.revision->'schemaVersion'='3'::jsonb)
     or exists(select 1 from public.client_health_snapshots s join private.client_health_config_revisions r on r.id=s.config_revision_id where r.revision->'schemaVersion'='3'::jsonb) then
    raise exception 'client health authoritative v3 refuses unsafe active or materialized v3 state';
  end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.oid in ('public.client_health_calculate_snapshot(uuid,uuid,timestamptz)'::regprocedure,'public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure)
      and (p.proowner<>v_postgres or not p.prosecdef
        or p.provolatile<>case when p.proname='client_health_calculate_snapshot' then 's'::"char" else 'v'::"char" end
        or p.proconfig is distinct from array[case when p.proname='client_health_calculate_snapshot' then 'search_path=pg_catalog, public, private' else 'search_path=pg_catalog, public' end])) then
    raise exception 'client health authoritative v3 function owner/security/search_path contract differs';
  end if;
  if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid='public.client_health_calculate_snapshot(uuid,uuid,timestamptz)'::regprocedure)<>v_calc_sha
     or (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(prosrc,'UTF8'),'sha256'),'hex') from pg_catalog.pg_proc where oid='public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure)<>v_persist_sha then
    raise exception 'client health authoritative v3 requires exact approved atomic-v2 function sources';
  end if;
  if pg_catalog.has_function_privilege('public','public.client_health_calculate_snapshot(uuid,uuid,timestamptz)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','public.client_health_calculate_snapshot(uuid,uuid,timestamptz)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.client_health_calculate_snapshot(uuid,uuid,timestamptz)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.client_health_calculate_snapshot(uuid,uuid,timestamptz)','EXECUTE')
     or pg_catalog.has_function_privilege('public','public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role','public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)','EXECUTE') then
    raise exception 'client health authoritative v3 requires exact approved atomic-v2 ACLs';
  end if;
end$$;

alter function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) set schema private;
alter function private.client_health_calculate_snapshot(uuid,uuid,timestamptz) rename to client_health_calculate_snapshot_v2;
alter function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) set schema private;
alter function private.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) rename to client_health_persist_snapshot_bundle_v2;

create function private.client_health_lane_display(p_value numeric) returns text language plpgsql immutable strict security definer set search_path=pg_catalog as $$
declare t text;begin t:=pg_catalog.round(p_value,6)::text;if pg_catalog.strpos(t,'.')>0 then t:=pg_catalog.rtrim(pg_catalog.rtrim(t,'0'),'.');end if;if t='-0' then t:='0';end if;return t;end$$;

create function private.client_health_calculate_snapshot_v3(p_refresh_run_id uuid,p_client_id uuid,p_calculated_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
#variable_conflict use_variable
declare
 r public.client_health_refresh_runs%rowtype; rev private.client_health_config_revisions%rowtype; c jsonb; lane jsonb; m jsonb;
 base jsonb; snap jsonb; ds jsonb; facts jsonb:='[]'; ev jsonb; proof jsonb; proof_hash text; snapshot_id uuid; idem text;
 source_key text; problem text; status text; reason text; parent_status text; parent_reason text; label text; direction text;
 required boolean; weight numeric; green numeric; yellow numeric; current_spend numeric; current_results numeric; previous_spend numeric; previous_results numeric;
 current_value numeric; previous_value numeric; evaluation_value numeric; hours_used numeric; hours_allotted numeric; projected numeric; projected_pct numeric;
 revenue numeric; cost numeric; margin numeric; val numeric; score numeric; tw numeric; points numeric; data_through text; authoritative_at timestamptz;
 required_incomplete boolean:=false; required_risk boolean:=false; critical boolean:=false; previous_available boolean; overall text; missing_source text; missing_window text;
 lane_count integer; required_count integer;
begin
 select * into r from public.client_health_refresh_runs where id=p_refresh_run_id;if not found then raise exception 'calculation refresh not found';end if;
 select * into rev from private.client_health_config_revisions where id=r.config_revision_id and revision_hash=r.config_revision_hash;
 if rev.revision->'schemaVersion'<>'3'::jsonb then raise exception 'v3 calculator requires a v3 revision';end if;
 perform public.client_health_assert_config_revision(rev.id,rev.revision_hash,rev.revision);
 select value into c from pg_catalog.jsonb_array_elements(rev.revision->'clients') where value->>'clientId'=p_client_id::text;if c is null then raise exception 'calculation client unauthorized';end if;
 base:=private.client_health_calculate_snapshot_v2(p_refresh_run_id,p_client_id,p_calculated_at);
 if c->>'configStatus'='configuration_required' then return base;end if;
 if (c->'economics'->>'effectiveMonth')::date<>pg_catalog.date_trunc('month',r.snapshot_date)::date then raise exception 'v3 economics effectiveMonth must equal refresh snapshot month';end if;
 snap:=base->'snapshot';ds:=snap->'dimensionStatuses';
 select pg_catalog.date_trunc('milliseconds',greatest(r.started_at,coalesce(pg_catalog.max(finished_at),r.started_at))) into authoritative_at from public.client_health_source_runs where refresh_run_id=r.id and client_id=p_client_id;
 hours_used:=nullif(snap->>'hoursUsed','')::numeric;
 revenue:=nullif(c->'economics'->>'monthlyRetainer','')::numeric;
 hours_allotted:=case when revenue is null then null else revenue*(100-(c->'economics'->>'targetMarginPercent')::numeric)/100/(c->'economics'->>'fulfillmentHourlyCost')::numeric end;
 projected:=case when hours_used is null then null else hours_used*extract(day from(pg_catalog.date_trunc('month',r.snapshot_date)+interval '1 month'-interval '1 day'))/extract(day from r.snapshot_date) end;
 projected_pct:=case when projected is null or hours_allotted is null or hours_allotted=0 then null else projected*100/hours_allotted end;
 cost:=case when projected is null then null else projected*(c->'economics'->>'fulfillmentHourlyCost')::numeric end;
 margin:=case when revenue is null or cost is null or revenue=0 then null else (revenue-cost)*100/revenue end;

 for lane in select value from pg_catalog.jsonb_array_elements(c->'northStarLanes') order by value->>'key' loop
  label:=lane->>'label';required:=(lane->>'required')::boolean;weight:=(lane->>'weight')::numeric;green:=(lane->>'greenThreshold')::numeric;yellow:=(lane->>'yellowThreshold')::numeric;direction:=lane->>'direction';
  current_spend:=0;current_results:=0;previous_spend:=0;previous_results:=0;current_value:=null;previous_value:=null;evaluation_value:=null;missing_source:=null;missing_window:=null;previous_available:=true;
  for source_key in select x from pg_catalog.jsonb_array_elements_text(lane->'sourceKeys') x order by x loop
   if not exists(select 1 from public.client_health_source_runs s join lateral(select value b from pg_catalog.jsonb_array_elements(c->'sources') where value->>'sourceKey'=s.source_key) z on true
      where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key and s.run_status='succeeded' and s.data_through is not null
        and r.snapshot_date-(s.data_through at time zone 'UTC')::date <= (b->'freshnessPolicy'->>'maximumLagDays')::integer
        and pg_catalog.jsonb_typeof(s.facts->'currentRows')='array') then missing_source:=source_key;missing_window:='current';exit;end if;
   select current_spend+coalesce(pg_catalog.sum((x->>'spend')::numeric),0),current_results+coalesce(pg_catalog.sum((x->>'results')::numeric),0)
    into current_spend,current_results from public.client_health_source_runs s cross join lateral pg_catalog.jsonb_array_elements(s.facts->'currentRows') x
    where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=source_key;
  end loop;
  if missing_source is null then
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
  end if;
  if missing_source is not null and (missing_window='current' or lane->>'evaluation'='period_over_period_change') then
   status:=case when required then'incomplete'else'unavailable'end;reason:=label||' '||missing_window||' rows are missing for source '||missing_source||'.';current_value:=case when missing_window='current' then null else current_value end;previous_value:=null;evaluation_value:=null;
  elsif lane->>'formula'='cost_per_result' then
   previous_value:=case when previous_available and previous_results<>0 then previous_spend/previous_results else null end;
   if current_results=0 then status:='at_risk';reason:=label||' current window has zero verified results.';
   elsif lane->>'evaluation'='absolute_target' then evaluation_value:=current_value;status:=case when current_value<=green then'healthy'when current_value<=yellow then'watch'else'at_risk'end;reason:=label||' is '||private.client_health_lane_display(current_value)||' against a healthy threshold of '||private.client_health_lane_display(green)||'.';
   elsif previous_results=0 then status:='at_risk';reason:=label||' previous window has zero verified results.';
   elsif previous_spend=0 or previous_value=0 then status:='at_risk';reason:=label||' previous window has zero verified spend.';
   else evaluation_value:=(current_value-previous_value)*100/previous_value;status:=case when evaluation_value<=green then'healthy'when evaluation_value<=yellow then'watch'else'at_risk'end;
    reason:=label||' '||case when evaluation_value<0 then'improved by '||private.client_health_lane_display(abs(evaluation_value))||'%'when evaluation_value>0 then'worsened by '||private.client_health_lane_display(evaluation_value)||'%'else'was unchanged'end||' period over period.';end if;
  else
   previous_value:=case when missing_source is null and previous_available and previous_spend<>0 then previous_results/previous_spend else null end;
   if current_spend=0 then status:='incomplete';reason:=label||' current window has zero verified spend.';
   elsif lane->>'evaluation'='period_over_period_change' and previous_spend=0 then status:='at_risk';reason:=label||' previous window has zero verified spend.';
   elsif lane->>'evaluation'='period_over_period_change' and previous_value=0 then status:='at_risk';reason:=label||' previous window has zero verified ROAS.';
   elsif lane->>'evaluation'='period_over_period_change' then evaluation_value:=(current_value-previous_value)*100/previous_value;status:=case when evaluation_value>=green then'healthy'when evaluation_value>=yellow then'watch'else'at_risk'end;
    reason:=label||' '||case when evaluation_value>0 then'improved by '||private.client_health_lane_display(evaluation_value)||'%'when evaluation_value<0 then'worsened by '||private.client_health_lane_display(abs(evaluation_value))||'%'else'was unchanged'end||' period over period.';
   else evaluation_value:=current_value;status:=case when current_value>=green then'healthy'when current_value>=yellow then'watch'else'at_risk'end;reason:=label||' is '||private.client_health_lane_display(current_value)||' against a healthy threshold of '||private.client_health_lane_display(green)||'.';end if;
  end if;
  ev:=pg_catalog.jsonb_build_object('key',lane->>'key','label',label,'formula',lane->>'formula','evaluation',lane->>'evaluation','required',required,'weight',public.client_health_binary64_json(weight,'lane weight',true),'currentValue',public.client_health_binary64_json(current_value,'lane currentValue'),'previousValue',public.client_health_binary64_json(previous_value,'lane previousValue'),'evaluationValue',public.client_health_binary64_json(evaluation_value,'lane evaluationValue'),'status',status,'reason',reason);
  facts:=facts||pg_catalog.jsonb_build_array(ev);
 end loop;
 lane_count:=pg_catalog.jsonb_array_length(facts);select count(*) into required_count from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean;
 if required_count=0 then parent_status:='unavailable';parent_reason:='No required North Star lanes are configured.';val:=null;
 else
  select value into ev from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean and x->>'status'='incomplete' order by x->>'key' limit 1;
  if ev is null then select value into ev from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean and x->>'status'='at_risk' order by x->>'key' limit 1;end if;
  if ev is null then select value into ev from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean and x->>'status'='watch' order by x->>'key' limit 1;end if;
  if ev is not null then parent_status:=ev->>'status';parent_reason:='Required North Star lane '||(ev->>'key')||' is '||parent_status||'.';val:=case when lane_count=1 then nullif(ev->>'evaluationValue','')::numeric else null end;
  else select value into ev from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean and x->>'status'='unavailable' order by x->>'key' limit 1;
   if ev is not null then parent_status:='incomplete';parent_reason:='Required North Star lane '||(ev->>'key')||' is unavailable.';val:=case when lane_count=1 then nullif(ev->>'evaluationValue','')::numeric else null end;
   else parent_status:='healthy';parent_reason:='All required North Star lanes are healthy.';select value into ev from pg_catalog.jsonb_array_elements(facts) x where(x->>'required')::boolean order by x->>'key' limit 1;val:=case when lane_count=1 then nullif(ev->>'evaluationValue','')::numeric else null end;end if;
  end if;
 end if;
 select value into m from pg_catalog.jsonb_array_elements(c->'metrics') where value->>'key'='north_star';
 ds:=pg_catalog.jsonb_set(ds,'{north_star}',pg_catalog.jsonb_build_object('status',parent_status,'value',public.client_health_binary64_json(val,'north_star value'),'reason',parent_reason,'required',(m->>'required')::boolean,'weight',public.client_health_binary64_json((m->>'weight')::numeric,'north_star weight',true),'facts',pg_catalog.jsonb_build_object('lanes',facts)));

 foreach source_key in array array['hours','margin'] loop
  problem:=null;
  select value into m from pg_catalog.jsonb_array_elements(c->'metrics') where value->>'key'=source_key;required:=(m->>'required')::boolean;weight:=(m->>'weight')::numeric;green:=(m->>'greenThreshold')::numeric;yellow:=(m->>'yellowThreshold')::numeric;direction:=m->>'direction';label:=case source_key when'hours'then'Hours utilization'else'Margin'end;
  select label||' source '||sk||' is missing.' into problem
   from pg_catalog.jsonb_array_elements_text(m->'sourceKeys') sk
   where not exists(select 1 from public.client_health_source_runs s where s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=sk)
   order by sk limit 1;
  if problem is null then
   select case when s.run_status<>'succeeded'then label||' source '||sk||' is '||s.run_status||'.'when s.data_through is null then label||' source '||sk||' has no data-through date.'else label||' source '||sk||' is stale.'end into problem
    from pg_catalog.jsonb_array_elements_text(m->'sourceKeys') sk join public.client_health_source_runs s on s.refresh_run_id=r.id and s.client_id=p_client_id and s.source_key=sk join lateral(select value b from pg_catalog.jsonb_array_elements(c->'sources')where value->>'sourceKey'=sk)z on true
    where s.run_status<>'succeeded'or s.data_through is null or r.snapshot_date-(s.data_through at time zone'UTC')::date>(b->'freshnessPolicy'->>'maximumLagDays')::int order by sk limit 1;
  end if;
  val:=case source_key when'hours'then projected_pct else margin end;
  if problem is not null then status:=case when required then'incomplete'else'unavailable'end;val:=null;reason:=problem;
  elsif source_key='hours'and hours_allotted=0 and hours_used is not null then status:='at_risk';reason:='Hours utilization is at risk because the verified monthly allotment is zero.';
  elsif source_key='margin'and revenue=0 and cost is not null then status:='at_risk';reason:='Margin is at risk because verified revenue is zero.';
  elsif val is null then status:=case when required then'incomplete'else'unavailable'end;reason:=case source_key when'hours'then'Hours used or monthly allotment is missing.'else'Margin revenue or fulfillment cost is missing.'end;
  else status:=case when direction='lower_is_better'then case when val<=green then'healthy'when val<=yellow then'watch'else'at_risk'end else case when val>=green then'healthy'when val>=yellow then'watch'else'at_risk'end end;reason:=label||' is '||public.client_health_display_number((public.client_health_binary64_json(val,source_key||' value')#>>'{}')::numeric)||' ('||pg_catalog.replace(status,'_',' ')||').';end if;
  ds:=pg_catalog.jsonb_set(ds,array[source_key],pg_catalog.jsonb_build_object('status',status,'value',public.client_health_binary64_json(val,source_key||' value'),'reason',reason,'required',required,'weight',public.client_health_binary64_json(weight,source_key||' weight',true)));
 end loop;
 required_incomplete:=false;required_risk:=false;critical:=false;
 foreach source_key in array array['budget_pacing','north_star','hours','overdue_tasks','margin'] loop
  ev:=ds->source_key;if(ev->>'required')::boolean and ev->>'status'='incomplete'then required_incomplete:=true;end if;if(ev->>'required')::boolean and ev->>'status'='at_risk'then required_risk:=true;if source_key in('north_star','margin')then critical:=true;end if;end if;
 end loop;
 if required_incomplete then overall:='incomplete';score:=null;else select pg_catalog.sum((value->>'weight')::numeric),pg_catalog.sum((value->>'weight')::numeric*case value->>'status'when'healthy'then 100 when'watch'then 50 else 0 end) into tw,points from pg_catalog.jsonb_each(ds);score:=points/tw;overall:=case when score>=80 then'healthy'when score>=50 then'watch'else'at_risk'end;if critical then overall:='at_risk';elsif overall='healthy'and required_risk then overall:='watch';end if;end if;
 snap:=snap||pg_catalog.jsonb_build_object('currentSpend',null,'currentResultCount',null,'currentCostPerResult',null,'previousSpend',null,'previousResultCount',null,'previousCostPerResult',null,'hoursAllotted',public.client_health_binary64_json(hours_allotted,'hoursAllotted'),'projectedHours',public.client_health_binary64_json(projected,'projectedHours'),'revenue',public.client_health_binary64_json(revenue,'revenue',true),'fulfillmentCost',public.client_health_binary64_json(cost,'fulfillmentCost'),'marginPercent',public.client_health_binary64_json(margin,'marginPercent'),'dimensionStatuses',ds,'overallStatus',overall,'overallScore',public.client_health_binary64_json(score,'overallScore'),'reasons',pg_catalog.jsonb_build_array(ds->'budget_pacing'->>'reason',ds->'north_star'->>'reason',ds->'hours'->>'reason',ds->'overdue_tasks'->>'reason',ds->'margin'->>'reason'),'calculatedAt',pg_catalog.to_char(authoritative_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 proof:=pg_catalog.jsonb_build_object('proofVersion','client-health-persistence-proof-v1','configRevisionId',rev.id::text,'configRevisionHash',rev.revision_hash,'run',pg_catalog.jsonb_build_object('refreshRunId',r.id::text,'refreshIdentityHash',r.refresh_identity_hash,'runAttemptId',r.run_attempt_id::text,'configRevisionActivationId',r.config_revision_activation_id::text,'snapshotDate',r.snapshot_date::text,'calculationVersion',r.calculation_version,'sourceContractVersion',r.source_contract_version,'startedAt',pg_catalog.to_char(r.started_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),'clientConfig',c,'sources',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sourceKey',s.source_key,'status',s.run_status,'finishedAt',case when s.finished_at is null then null else pg_catalog.to_char(s.finished_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')end,'dataThrough',case when s.data_through is null then null else pg_catalog.to_char(s.data_through at time zone'UTC','YYYY-MM-DD')end,'rowCount',s.row_count,'requestFingerprint',s.request_fingerprint,'evidence',s.evidence,'facts',s.facts)order by s.source_key)from public.client_health_source_runs s where s.refresh_run_id=r.id and s.client_id=p_client_id),'[]'),'calculatedSnapshot',snap);
 proof_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(proof),'UTF8'),'sha256'),'hex');snapshot_id:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('type','client-health-snapshot-v1','refreshRunId',r.id::text,'clientId',p_client_id::text,'proofHash',proof_hash)),'UTF8'),'sha256'),'hex'));idem:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('type','client-health-persistence-v1','refreshRunId',r.id::text,'clientId',p_client_id::text,'snapshotId',snapshot_id::text,'proofHash',proof_hash)),'UTF8'),'sha256'),'hex');
 return pg_catalog.jsonb_build_object('snapshot',snap||pg_catalog.jsonb_build_object('evidenceHash',proof_hash),'proof',proof,'proofHash',proof_hash,'snapshotId',snapshot_id::text,'idempotencyKey',idem);
end$$;

create function public.client_health_calculate_snapshot(p_refresh_run_id uuid,p_client_id uuid,p_calculated_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v_schema integer;begin
 select (cr.revision->>'schemaVersion')::integer into v_schema from public.client_health_refresh_runs r join private.client_health_config_revisions cr on cr.id=r.config_revision_id and cr.revision_hash=r.config_revision_hash where r.id=p_refresh_run_id;
 if v_schema=2 then return private.client_health_calculate_snapshot_v2(p_refresh_run_id,p_client_id,p_calculated_at);elsif v_schema=3 then return private.client_health_calculate_snapshot_v3(p_refresh_run_id,p_client_id,p_calculated_at);else raise exception 'calculation refresh revision schema is unsupported';end if;
end$$;

create function public.client_health_persist_snapshot_bundle(
  p_bundle jsonb,
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
  v_snapshot jsonb;
  v_tasks jsonb;
  v_task jsonb;
  v_dimensions jsonb;
  v_sources jsonb;
  v_item record;
  v_refresh_id uuid;
  v_config_revision_id uuid;
  v_config_revision_hash text;
  v_run public.client_health_refresh_runs%rowtype;
  v_client_id uuid;
  v_snapshot_id uuid;
  v_requested_snapshot_id uuid;
  v_snapshot_date date;
  v_existing public.client_health_snapshots%rowtype;
  v_task_count integer;
  v_has_committed_task_facts boolean := false;
  v_inserted boolean := false;
  v_computed_idempotency_key text;
  v_calculation jsonb;
begin
  perform public.client_health_assert_exact_keys(p_bundle,
    array['configRevisionId','configRevisionHash','idempotencyKey','evidenceHash','snapshotId','snapshot','tasks'], 'bundle');
  v_snapshot := p_bundle->'snapshot';
  v_tasks := p_bundle->'tasks';
  perform public.client_health_assert_exact_keys(v_snapshot, array[
    'refreshRunId','clientId','snapshotDate','dataThrough','budget','monthSpend','expectedSpend',
    'currentWindowStart','currentWindowEnd','currentSpend','currentResultCount','currentCostPerResult',
    'previousWindowStart','previousWindowEnd','previousSpend','previousResultCount','previousCostPerResult',
    'hoursUsed','hoursAllotted','projectedHours','overdueTaskCount','revenue','fulfillmentCost','marginPercent',
    'dimensionStatuses','sourceStatuses','overallStatus','overallScore','reasons','calculatedAt','evidenceHash'
  ], 'bundle.snapshot');
  if pg_catalog.jsonb_typeof(v_tasks) <> 'array' then raise exception 'bundle.tasks must be an array'; end if;
  if (p_bundle->>'evidenceHash') !~ '^[0-9a-f]{64}$'
     or (p_bundle->>'idempotencyKey') !~ '^[0-9a-f]{64}$' then
    raise exception 'bundle hashes must be lowercase SHA-256';
  end if;
  if v_snapshot->>'evidenceHash' is distinct from p_bundle->>'evidenceHash' then
    raise exception 'bundle snapshot evidenceHash does not match bundle evidenceHash';
  end if;
  -- The caller hash is only an assertion. The database derives the authoritative
  -- proof, snapshot UUID, and idempotency key after run/client identity is parsed.
  begin
    v_refresh_id := (v_snapshot->>'refreshRunId')::uuid;
    v_config_revision_id := (p_bundle->>'configRevisionId')::uuid;
    v_config_revision_hash := p_bundle->>'configRevisionHash';
    v_client_id := (v_snapshot->>'clientId')::uuid;
    v_requested_snapshot_id := (p_bundle->>'snapshotId')::uuid;
    v_snapshot_date := (v_snapshot->>'snapshotDate')::date;
  exception when others then
    raise exception 'bundle identity fields are malformed';
  end;
  if v_snapshot->>'snapshotDate' <> pg_catalog.to_char(v_snapshot_date, 'YYYY-MM-DD') then
    raise exception 'bundle snapshotDate is not canonical';
  end if;
  v_run := public.client_health_assert_owned_lease(v_refresh_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'collecting' then
    raise exception 'client health snapshot persistence requires a collecting refresh';
  end if;
  if v_run.config_revision_id <> v_config_revision_id or v_run.config_revision_hash <> v_config_revision_hash then raise exception 'snapshot revision does not match refresh revision'; end if;
  perform public.client_health_assert_config_revision(v_config_revision_id,v_config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_config_revision_id));
  if not exists (select 1 from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
    where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text) then raise exception 'snapshot client is not authorized by revision'; end if;

  -- Caller calculation fields and identities are untrusted preview assertions. Persist
  -- only the database-derived calculation and return its authoritative receipt.
  v_calculation := public.client_health_calculate_snapshot(v_refresh_id, v_client_id, null);
  v_snapshot := v_calculation->'snapshot';
  v_snapshot_id := (v_calculation->>'snapshotId')::uuid;
  v_snapshot_date := (v_snapshot->>'snapshotDate')::date;
  v_computed_idempotency_key := v_calculation->>'idempotencyKey';
  select exists (
    select 1 from public.client_health_source_runs sr
    join private.client_health_config_revisions cr on cr.id=v_config_revision_id and cr.revision_hash=v_config_revision_hash
    cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
    join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
      on binding->>'sourceKey'=sr.source_key
    where sr.refresh_run_id=v_refresh_id and sr.client_id=v_client_id and sr.run_status='succeeded'
      and client->>'clientId'=v_client_id::text and binding->>'provider'='clickup'
      and (binding->>'permitsTasks')::boolean and sr.facts ? 'topTasks'
  ) into v_has_committed_task_facts;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'refreshRunId',v_refresh_id::text,'snapshotId',v_snapshot_id::text,
    'clickupTaskId',ranked.task->>'id','listId',ranked.task->>'listId',
    'taskName',ranked.task->>'name','taskUrl',ranked.task->>'url',
    'dueAt',ranked.task->'dueAt','displayRank',ranked.display_rank
  ) order by ranked.display_rank),'[]'::jsonb) into v_tasks
  from (
    select task,pg_catalog.row_number() over(order by task->>'dueAt',task->>'id') display_rank
    from public.client_health_source_runs sr
    cross join lateral pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(sr.facts->'topTasks')='array' then sr.facts->'topTasks' else '[]'::jsonb end) task
    where sr.refresh_run_id=v_refresh_id and sr.client_id=v_client_id and sr.run_status='succeeded'
    order by task->>'dueAt',task->>'id' limit 5
  ) ranked;

  -- Exact scalar JSON types; SQL casts below are allowed only after this allowlist passes.
  for v_item in select * from (values
    ('budget'),('monthSpend'),('expectedSpend'),('currentSpend'),('currentResultCount'),('currentCostPerResult'),
    ('previousSpend'),('previousResultCount'),('previousCostPerResult'),('hoursUsed'),('hoursAllotted'),
    ('projectedHours'),('overdueTaskCount'),('revenue'),('fulfillmentCost'),('marginPercent'),('overallScore')
  ) fields(key) loop
    if pg_catalog.jsonb_typeof(v_snapshot->v_item.key) not in ('number','null') then
      raise exception 'bundle.snapshot.% must be a number or null', v_item.key;
    end if;
  end loop;
  for v_item in select * from (values
    ('dataThrough'),('currentWindowStart'),('currentWindowEnd'),('previousWindowStart'),('previousWindowEnd')
  ) fields(key) loop
    if pg_catalog.jsonb_typeof(v_snapshot->v_item.key) not in ('string','null') then
      raise exception 'bundle.snapshot.% must be a string or null', v_item.key;
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(v_snapshot->'overallStatus') <> 'string'
     or pg_catalog.jsonb_typeof(v_snapshot->'calculatedAt') <> 'string'
     or pg_catalog.jsonb_typeof(v_snapshot->'reasons') <> 'array' then
    raise exception 'bundle snapshot string/array fields are malformed';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_snapshot->'reasons') x
             where pg_catalog.jsonb_typeof(x) <> 'string' or x #>> '{}' = '' or x #>> '{}' <> pg_catalog.btrim(x #>> '{}')) then
    raise exception 'bundle.snapshot.reasons must contain trimmed nonempty strings';
  end if;

  v_dimensions := v_snapshot->'dimensionStatuses';
  perform public.client_health_assert_exact_keys(v_dimensions,
    array['budget_pacing','north_star','hours','overdue_tasks','margin'], 'bundle.snapshot.dimensionStatuses');
  for v_item in select key, value from pg_catalog.jsonb_each(v_dimensions) loop
    if v_item.key='north_star'
       and (select revision->'schemaVersion' from private.client_health_config_revisions where id=v_config_revision_id)='3'::jsonb
       and exists (
         select 1 from private.client_health_config_revisions cr
         cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
         where cr.id=v_config_revision_id and client->>'clientId'=v_client_id::text
           and client->>'configStatus'='approved'
       ) then
      perform public.client_health_assert_exact_keys(v_item.value,
        array['status','value','reason','required','weight','facts'], 'bundle.snapshot.dimensionStatuses.north_star');
      perform public.client_health_assert_exact_keys(v_item.value->'facts',array['lanes'],'bundle.snapshot.dimensionStatuses.north_star.facts');
      if pg_catalog.jsonb_typeof(v_item.value->'facts'->'lanes')<>'array'
         or pg_catalog.jsonb_array_length(v_item.value->'facts'->'lanes') not between 1 and 4
         or exists (
           select 1 from pg_catalog.jsonb_array_elements(v_item.value->'facts'->'lanes') with ordinality lane(value,ord)
           where pg_catalog.jsonb_typeof(value)<>'object'
              or (select coalesce(pg_catalog.array_agg(key order by key),'{}') from pg_catalog.jsonb_object_keys(value) keys(key))
                 <> array['currentValue','evaluation','evaluationValue','formula','key','label','previousValue','reason','required','status','weight']::text[]
              or value->>'key'!~'^[a-z0-9]+([-_][a-z0-9]+)*$' or pg_catalog.length(value->>'key')>64
              or pg_catalog.jsonb_typeof(value->'label')<>'string' or value->>'label'='' or value->>'label'<>pg_catalog.btrim(value->>'label') or pg_catalog.length(value->>'label')>120
              or value->>'formula' not in ('cost_per_result','roas') or value->>'evaluation' not in ('period_over_period_change','absolute_target')
              or pg_catalog.jsonb_typeof(value->'required')<>'boolean'
              or pg_catalog.jsonb_typeof(value->'weight')<>'number' or (value->>'weight')::numeric<=0 or (value->>'weight')::numeric>100
              or pg_catalog.jsonb_typeof(value->'currentValue') not in ('number','null')
              or pg_catalog.jsonb_typeof(value->'previousValue') not in ('number','null')
              or pg_catalog.jsonb_typeof(value->'evaluationValue') not in ('number','null')
              or value->>'status' not in ('healthy','watch','at_risk','incomplete','unavailable')
              or pg_catalog.jsonb_typeof(value->'reason')<>'string' or value->>'reason'='' or value->>'reason'<>pg_catalog.btrim(value->>'reason') or pg_catalog.length(value->>'reason')>512
              or (ord>1 and value->>'key' <= (v_item.value->'facts'->'lanes'->(ord::integer-2))->>'key')
         ) then raise exception 'bundle snapshot v3 North Star lane facts are malformed'; end if;
    else
      perform public.client_health_assert_exact_keys(v_item.value,
        array['status','value','reason','required','weight'], 'bundle.snapshot.dimensionStatuses.' || v_item.key);
    end if;
    if pg_catalog.jsonb_typeof(v_item.value->'status') <> 'string'
       or v_item.value->>'status' not in ('healthy','watch','at_risk','incomplete','unavailable','configuration_required')
       or pg_catalog.jsonb_typeof(v_item.value->'value') not in ('number','null')
       or pg_catalog.jsonb_typeof(v_item.value->'reason') <> 'string'
       or v_item.value->>'reason' = '' or v_item.value->>'reason' <> pg_catalog.btrim(v_item.value->>'reason')
       or pg_catalog.jsonb_typeof(v_item.value->'required') <> 'boolean'
       or pg_catalog.jsonb_typeof(v_item.value->'weight') not in ('number','null') then
      raise exception 'bundle snapshot dimension content is malformed';
    end if;
  end loop;

  v_sources := v_snapshot->'sourceStatuses';
  if pg_catalog.jsonb_typeof(v_sources) <> 'object' then raise exception 'bundle.snapshot.sourceStatuses must be an object'; end if;
  for v_item in select key, value from pg_catalog.jsonb_each(v_sources) loop
    if v_item.key !~ '^[a-z0-9][a-z0-9_.-]*$' then raise exception 'bundle source key is malformed'; end if;
    perform public.client_health_assert_exact_keys(v_item.value,
      array['status','dataThrough','stale','rowCount'], 'bundle.snapshot.sourceStatuses.' || v_item.key);
    if pg_catalog.jsonb_typeof(v_item.value->'status') <> 'string'
       or v_item.value->>'status' not in ('succeeded','partial','failed','missing')
       or pg_catalog.jsonb_typeof(v_item.value->'dataThrough') not in ('string','null')
       or pg_catalog.jsonb_typeof(v_item.value->'stale') <> 'boolean'
       or pg_catalog.jsonb_typeof(v_item.value->'rowCount') not in ('number','null')
       or (pg_catalog.jsonb_typeof(v_item.value->'rowCount') = 'number'
           and ((v_item.value->>'rowCount')::numeric < 0 or (v_item.value->>'rowCount')::numeric > 9223372036854775807
             or pg_catalog.trunc((v_item.value->>'rowCount')::numeric) <> (v_item.value->>'rowCount')::numeric)) then
      raise exception 'bundle snapshot source content is malformed';
    end if;
  end loop;
  if (select coalesce(pg_catalog.array_agg(source_key order by source_key),'{}') from pg_catalog.jsonb_object_keys(v_sources) keys(source_key)) <>
     (select coalesce(pg_catalog.array_agg(x->>'sourceKey' order by x->>'sourceKey'),'{}')
      from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
      cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
      where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text) then
    raise exception 'snapshot sources do not exactly match revision authorization: presented %, authorized %',
      (select coalesce(pg_catalog.array_agg(source_key order by source_key),'{}') from pg_catalog.jsonb_object_keys(v_sources) keys(source_key)),
      (select coalesce(pg_catalog.array_agg(x->>'sourceKey' order by x->>'sourceKey'),'{}')
       from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
       cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
       where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text);
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_each(v_sources) presented(source_key, source_status)
    where not exists (
      select 1
      from public.client_health_source_runs sr
      join private.client_health_config_revisions cr on cr.id=v_config_revision_id and cr.revision_hash=v_config_revision_hash
      cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
      cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
      where sr.refresh_run_id=v_refresh_id and sr.client_id=v_client_id and sr.source_key=presented.source_key
        and client->>'clientId'=v_client_id::text and binding->>'sourceKey'=sr.source_key
        and sr.window_end=v_run.snapshot_date
        and (
          (binding->>'provider'='clickup' and sr.window_start=pg_catalog.date_trunc('month',v_run.snapshot_date)::date)
          or (binding->>'provider'='supabase' and sr.window_start in (
            pg_catalog.date_trunc('month',v_run.snapshot_date)::date,
            least(pg_catalog.date_trunc('month',v_run.snapshot_date)::date,v_run.snapshot_date-27)
          ))
        )
        and presented.source_status->>'status'=sr.run_status
        and presented.source_status->>'dataThrough' is not distinct from case when sr.data_through is null then null else pg_catalog.to_char(sr.data_through at time zone 'UTC','YYYY-MM-DD') end
        and presented.source_status->>'rowCount' is not distinct from case when sr.row_count is null then null else sr.row_count::text end
        and (presented.source_status->>'stale')::boolean = case when sr.data_through is null then true else v_run.snapshot_date-(sr.data_through at time zone 'UTC')::date > (binding->'freshnessPolicy'->>'maximumLagDays')::integer end
    )
  ) then raise exception 'snapshot source status/dataThrough/rowCount/stale does not reconcile to committed source run'; end if;

  v_task_count := pg_catalog.jsonb_array_length(v_tasks);
  if v_task_count > 5 then raise exception 'bundle.tasks cannot exceed five rows'; end if;
  for v_task in select value from pg_catalog.jsonb_array_elements(v_tasks) loop
    perform public.client_health_assert_exact_keys(v_task, array[
      'refreshRunId','snapshotId','clickupTaskId','listId','taskName','taskUrl','dueAt','displayRank'
    ], 'bundle.tasks[]');
    if pg_catalog.jsonb_typeof(v_task->'refreshRunId') <> 'string'
       or pg_catalog.jsonb_typeof(v_task->'snapshotId') <> 'string'
       or pg_catalog.jsonb_typeof(v_task->'clickupTaskId') <> 'string'
       or (v_task->>'clickupTaskId') !~ '^[A-Za-z0-9]+$' or pg_catalog.length(v_task->>'clickupTaskId')>128
       or pg_catalog.jsonb_typeof(v_task->'listId') <> 'string' or (v_task->>'listId') !~ '^[1-9][0-9]*$' or pg_catalog.length(v_task->>'listId')>64
       or pg_catalog.jsonb_typeof(v_task->'taskName') <> 'string' or v_task->>'taskName' = '' or pg_catalog.length(v_task->>'taskName')>500
       or v_task->>'taskName' <> pg_catalog.btrim(v_task->>'taskName')
       or pg_catalog.jsonb_typeof(v_task->'taskUrl') <> 'string'
       or v_task->>'taskUrl' <> 'https://app.clickup.com/t/' || (v_task->>'clickupTaskId')
       or pg_catalog.jsonb_typeof(v_task->'dueAt') not in ('string','null')
       or pg_catalog.jsonb_typeof(v_task->'displayRank') <> 'number'
       or pg_catalog.trunc((v_task->>'displayRank')::numeric) <> (v_task->>'displayRank')::numeric
       or (v_task->>'displayRank')::integer not between 1 and 5
       or (v_task->>'refreshRunId')::uuid <> v_refresh_id or (v_task->>'snapshotId')::uuid <> v_snapshot_id then
      raise exception 'bundle task content is malformed';
    end if;
    perform public.client_health_assert_task_authorized(
      (select revision from private.client_health_config_revisions where id=v_config_revision_id and revision_hash=v_config_revision_hash),
      v_refresh_id,v_client_id,v_task->>'listId'
    );
  end loop;
  if v_task_count <> (case when v_has_committed_task_facts
     then coalesce(least((v_snapshot->>'overdueTaskCount')::integer, 5), 0) else 0 end)
     or exists (
       select 1 from pg_catalog.generate_series(1, v_task_count) rank
       where not exists (select 1 from pg_catalog.jsonb_array_elements(v_tasks) t where (t->>'displayRank')::integer = rank)
     ) then
    raise exception 'bundle task count/ranks do not match overdueTaskCount';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_tasks) task
    group by task->>'clickupTaskId'
    having count(*) > 1
  ) then
    raise exception 'bundle tasks contain a duplicate clickupTaskId';
  end if;

  select * into v_existing from public.client_health_snapshots
  where id = v_snapshot_id or (refresh_run_id = v_refresh_id and client_id = v_client_id)
  for update;

  if not found then
    insert into public.client_health_snapshots (
      id, refresh_run_id, client_id, snapshot_date, data_through, budget, month_spend, expected_spend,
      current_window_start, current_window_end, current_spend, current_result_count, current_cost_per_result,
      previous_window_start, previous_window_end, previous_spend, previous_result_count, previous_cost_per_result,
      hours_used, hours_allotted, projected_hours, overdue_task_count, revenue, fulfillment_cost, margin_percent,
      dimension_statuses, source_statuses, overall_status, overall_score, reasons, calculated_at,
      config_revision_id, config_revision_hash, persistence_evidence_hash, persistence_idempotency_key
    ) values (
      v_snapshot_id, v_refresh_id, v_client_id, v_snapshot_date,
      ((v_snapshot->>'dataThrough')::date::timestamp at time zone 'UTC'),
      (v_snapshot->>'budget')::numeric, (v_snapshot->>'monthSpend')::numeric, (v_snapshot->>'expectedSpend')::numeric,
      (v_snapshot->>'currentWindowStart')::date, (v_snapshot->>'currentWindowEnd')::date,
      (v_snapshot->>'currentSpend')::numeric, (v_snapshot->>'currentResultCount')::numeric, (v_snapshot->>'currentCostPerResult')::numeric,
      (v_snapshot->>'previousWindowStart')::date, (v_snapshot->>'previousWindowEnd')::date,
      (v_snapshot->>'previousSpend')::numeric, (v_snapshot->>'previousResultCount')::numeric, (v_snapshot->>'previousCostPerResult')::numeric,
      (v_snapshot->>'hoursUsed')::numeric, (v_snapshot->>'hoursAllotted')::numeric, (v_snapshot->>'projectedHours')::numeric,
      (v_snapshot->>'overdueTaskCount')::integer, (v_snapshot->>'revenue')::numeric,
      (v_snapshot->>'fulfillmentCost')::numeric, (v_snapshot->>'marginPercent')::numeric,
      v_dimensions, v_sources, v_snapshot->>'overallStatus', (v_snapshot->>'overallScore')::numeric,
      v_snapshot->'reasons', (v_snapshot->>'calculatedAt')::timestamptz,
      v_config_revision_id, v_config_revision_hash, v_calculation->>'proofHash', v_computed_idempotency_key
    );
    v_inserted := true;
    for v_task in select value from pg_catalog.jsonb_array_elements(v_tasks) loop
      insert into public.client_health_snapshot_tasks (
        refresh_run_id, snapshot_id, clickup_task_id, list_id, task_name, task_url, due_at, display_rank
      ) values (
        v_refresh_id, v_snapshot_id, v_task->>'clickupTaskId', v_task->>'listId', v_task->>'taskName',
        v_task->>'taskUrl', (v_task->>'dueAt')::timestamptz, (v_task->>'displayRank')::smallint
      );
    end loop;
  else
    if v_existing.id <> v_snapshot_id or v_existing.refresh_run_id <> v_refresh_id or v_existing.client_id <> v_client_id
       or v_existing.config_revision_id <> v_config_revision_id or v_existing.config_revision_hash <> v_config_revision_hash
       or v_existing.snapshot_date <> v_snapshot_date
       or v_existing.data_through is distinct from ((v_snapshot->>'dataThrough')::date::timestamp at time zone 'UTC')
       or v_existing.budget is distinct from (v_snapshot->>'budget')::numeric
       or v_existing.month_spend is distinct from (v_snapshot->>'monthSpend')::numeric
       or v_existing.expected_spend is distinct from (v_snapshot->>'expectedSpend')::numeric
       or v_existing.current_window_start is distinct from (v_snapshot->>'currentWindowStart')::date
       or v_existing.current_window_end is distinct from (v_snapshot->>'currentWindowEnd')::date
       or v_existing.current_spend is distinct from (v_snapshot->>'currentSpend')::numeric
       or v_existing.current_result_count is distinct from (v_snapshot->>'currentResultCount')::numeric
       or v_existing.current_cost_per_result is distinct from (v_snapshot->>'currentCostPerResult')::numeric
       or v_existing.previous_window_start is distinct from (v_snapshot->>'previousWindowStart')::date
       or v_existing.previous_window_end is distinct from (v_snapshot->>'previousWindowEnd')::date
       or v_existing.previous_spend is distinct from (v_snapshot->>'previousSpend')::numeric
       or v_existing.previous_result_count is distinct from (v_snapshot->>'previousResultCount')::numeric
       or v_existing.previous_cost_per_result is distinct from (v_snapshot->>'previousCostPerResult')::numeric
       or v_existing.hours_used is distinct from (v_snapshot->>'hoursUsed')::numeric
       or v_existing.hours_allotted is distinct from (v_snapshot->>'hoursAllotted')::numeric
       or v_existing.projected_hours is distinct from (v_snapshot->>'projectedHours')::numeric
       or v_existing.overdue_task_count is distinct from (v_snapshot->>'overdueTaskCount')::integer
       or v_existing.revenue is distinct from (v_snapshot->>'revenue')::numeric
       or v_existing.fulfillment_cost is distinct from (v_snapshot->>'fulfillmentCost')::numeric
       or v_existing.margin_percent is distinct from (v_snapshot->>'marginPercent')::numeric
       or v_existing.dimension_statuses <> v_dimensions or v_existing.source_statuses <> v_sources
       or v_existing.overall_status <> v_snapshot->>'overallStatus'
       or v_existing.overall_score is distinct from (v_snapshot->>'overallScore')::numeric
       or v_existing.reasons <> v_snapshot->'reasons'
       or v_existing.calculated_at <> (v_snapshot->>'calculatedAt')::timestamptz
       or v_existing.persistence_evidence_hash <> v_calculation->>'proofHash'
       or v_existing.persistence_idempotency_key <> v_computed_idempotency_key then
      raise exception 'client health snapshot retry differs from committed content';
    end if;
  end if;

  if not v_inserted then
    if (select count(*) from public.client_health_snapshot_tasks where snapshot_id = v_snapshot_id) <> v_task_count
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(v_tasks) t
         where not exists (
           select 1 from public.client_health_snapshot_tasks st
           where st.snapshot_id = v_snapshot_id and st.refresh_run_id = v_refresh_id
             and st.clickup_task_id = t->>'clickupTaskId' and st.list_id = t->>'listId'
             and st.task_name = t->>'taskName' and st.task_url = t->>'taskUrl'
             and st.due_at is not distinct from (t->>'dueAt')::timestamptz
             and st.display_rank = (t->>'displayRank')::smallint
         )
       ) then
      raise exception 'client health snapshot task retry differs from committed content';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'refreshRunId', v_refresh_id, 'configRevisionId',v_config_revision_id,'configRevisionHash',v_config_revision_hash,
    'clientId', v_client_id, 'snapshotId', v_snapshot_id,
    'taskCount', v_task_count, 'evidenceHash', v_calculation->>'proofHash',
    'idempotencyKey', v_computed_idempotency_key
  );
end
$$;

alter function private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz) owner to postgres;
alter function private.client_health_calculate_snapshot_v3(uuid,uuid,timestamptz) owner to postgres;
alter function private.client_health_lane_display(numeric) owner to postgres;
alter function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) owner to postgres;
alter function private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) owner to postgres;
revoke all on function private.client_health_calculate_snapshot_v2(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.client_health_calculate_snapshot_v3(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.client_health_lane_display(numeric) from public,anon,authenticated,service_role;
revoke all on function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.client_health_persist_snapshot_bundle_v2(jsonb,uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) to service_role;
revoke all on schema private from public,anon,authenticated,service_role;
comment on function public.client_health_calculate_snapshot(uuid,uuid,timestamptz) is 'Schema-version dispatcher for exact v2 and database-authoritative v3 client-health calculations.';
comment on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) is 'Fenced database-authoritative v2/v3 persistence; caller snapshot calculations and North Star lane facts are ignored.';
commit;
