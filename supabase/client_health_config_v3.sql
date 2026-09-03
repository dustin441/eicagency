begin;

-- Additive v3 configuration contract. This migration must be installed only after
-- the exact approved atomic-refresh v2 contract and never applies application data.
do $$
declare
  v_postgres_oid oid;
  v_revision record;
  v_expected_validator_sha constant text := 'b70f4e81ac62f29ae8e1f0c0ae957681e1173b94b83082a581ecaabfe2a758ae';
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'client health v3 requires a direct postgres session';
  end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles
  where rolname='postgres' and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'client health v3 requires postgres with BYPASSRLS and CREATEROLE';
  end if;
  if to_regclass('public.master_spartaco') is null
     or to_regclass('private.client_health_config_revisions') is null
     or to_regclass('private.client_health_config_revision_activations') is null
     or to_regclass('private.client_health_active_config_revision') is null
     or to_regprocedure('public.client_health_assert_config_revision(uuid,text,jsonb)') is null
     or to_regprocedure('private.client_health_stage_config_revision(uuid,text,jsonb)') is null
     or to_regprocedure('private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.client_health_get_active_config_revision()') is null then
    raise exception 'client health v3 requires the complete atomic-refresh v2 installation';
  end if;
  if to_regprocedure('public.client_health_stage_config_revision(uuid,text,jsonb)') is not null
     or to_regprocedure('public.client_health_activate_config_revision(uuid,uuid,text,text,uuid)') is not null
     or to_regprocedure('private.client_health_assert_config_revision_v2(uuid,text,jsonb)') is not null
     or to_regprocedure('private.client_health_assert_config_revision_v3(uuid,text,jsonb)') is not null then
    raise exception 'client health v3 found a partial or prior v3 installation';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname in ('client_health_config_revisions','client_health_config_revision_activations','client_health_active_config_revision')
      and c.relowner<>v_postgres_oid
  ) or exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where (n.nspname,p.proname) in (('public','client_health_assert_config_revision'),('private','client_health_stage_config_revision'),('private','client_health_activate_config_revision'),('public','client_health_get_active_config_revision'))
      and (p.proowner<>v_postgres_oid or not p.prosecdef or not exists(select 1 from pg_catalog.unnest(p.proconfig) x where x like 'search_path=%'))
  ) then
    raise exception 'client health v3 requires postgres-owned, fixed-search-path v2 trust objects';
  end if;
  if (select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p.prosrc,'UTF8'),'sha256'),'hex')
      from pg_catalog.pg_proc p where p.oid='public.client_health_assert_config_revision(uuid,text,jsonb)'::regprocedure)
     <> v_expected_validator_sha then
    raise exception 'client health v3 requires the exact approved v2 validator';
  end if;
  if pg_catalog.has_schema_privilege('anon','private','USAGE')
     or pg_catalog.has_schema_privilege('authenticated','private','USAGE')
     or pg_catalog.has_schema_privilege('service_role','private','USAGE')
     or pg_catalog.has_function_privilege('public','public.client_health_assert_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','public.client_health_assert_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.client_health_assert_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.client_health_assert_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('public','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('public','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('anon','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role','public.client_health_get_active_config_revision()','EXECUTE') then
    raise exception 'client health v3 requires the exact v2 API/private privilege boundary';
  end if;
  if to_regclass('public.profiles') is null
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and data_type='uuid')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role' and data_type in ('text','character varying'))
     or not exists(select 1 from pg_catalog.pg_index where indrelid='public.profiles'::regclass and indisunique and indkey::smallint[] @> array[(select attnum::smallint from pg_catalog.pg_attribute where attrelid='public.profiles'::regclass and attname='id')]::smallint[])
     or (select relowner from pg_catalog.pg_class where oid='public.profiles'::regclass)<>v_postgres_oid
     or to_regprocedure('auth.uid()') is null
     or (select prorettype from pg_catalog.pg_proc where oid='auth.uid()'::regprocedure)<>'uuid'::regtype then
    raise exception 'client health v3 cannot prove the postgres-owned public.profiles(id uuid unique, role text) and auth.uid() authorization contract';
  end if;
  for v_revision in select id,revision_hash,revision from private.client_health_config_revisions loop
    if v_revision.revision->'schemaVersion'<>'2'::jsonb then
      raise exception 'client health v3 preflight found a non-v2 stored revision';
    end if;
    perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  end loop;
end
$$;

-- Preserve the installed v2 validator byte-for-byte under a private name. The
-- public dispatcher below is additive; rollback moves this exact object back.
alter function public.client_health_assert_config_revision(uuid,text,jsonb) set schema private;
alter function private.client_health_assert_config_revision(uuid,text,jsonb) rename to client_health_assert_config_revision_v2;

create function private.client_health_assert_config_revision_v3(p_id uuid,p_hash text,p_revision jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  c jsonb; e jsonb; fixed jsonb; lane jsonb; projected_client jsonb; projected_clients jsonb:='[]'::jsonb;
  v record; v_hash text; v_ids text[]:='{}'; v_client_keys text[]:='{}'; v_lane_keys text[]; v_source_keys text[];
  v_lane_sources text[]; v_union text[]; v_values text[]; v_weight numeric:=0;
begin
  if p_revision is null or p_hash is null or p_hash!~'^[0-9a-f]{64}$' or p_id is null or p_id<>public.client_health_revision_id(p_hash) then
    raise exception 'configuration revision identity is malformed';
  end if;
  if pg_catalog.octet_length(p_revision::text)>1000000 then raise exception 'configuration revision is oversized'; end if;
  perform public.client_health_assert_safe_revision_json(p_revision,'revision');
  perform public.client_health_assert_exact_keys(p_revision,array['schemaVersion','calculationVersion','sourceContractVersion','clients'],'revision');
  if p_revision->'schemaVersion'<>'3'::jsonb
     or p_revision->>'calculationVersion'!~'^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(p_revision->>'calculationVersion')>128
     or p_revision->>'sourceContractVersion'!~'^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(p_revision->>'sourceContractVersion')>128
     or pg_catalog.jsonb_typeof(p_revision->'clients')<>'array' or pg_catalog.jsonb_array_length(p_revision->'clients') not between 1 and 100 then
    raise exception 'configuration revision v3 root is malformed';
  end if;
  for c in select value from pg_catalog.jsonb_array_elements(p_revision->'clients') loop
    perform public.client_health_assert_exact_keys(c,array['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','economics','fixedValues','northStarLanes','metrics','sources'],'revision.clients[]');
    e:=c->'economics'; fixed:=c->'fixedValues';
    perform public.client_health_assert_exact_keys(e,array['effectiveMonth','monthlyRetainer','deliveryModel','fulfillmentHourlyCost','targetMarginPercent'],'economics');
    perform public.client_health_assert_exact_keys(fixed,array['monthlyBudget'],'fixedValues');
    if pg_catalog.jsonb_typeof(e->'effectiveMonth')<>'string' or e->>'effectiveMonth'!~'^[0-9]{4}-(0[1-9]|1[0-2])-01$'
       or pg_catalog.jsonb_typeof(e->'monthlyRetainer') not in ('number','null')
       or (pg_catalog.jsonb_typeof(e->'monthlyRetainer')='number' and (e->>'monthlyRetainer')::numeric<0)
       or e->>'deliveryModel' not in ('custom','platform')
       or pg_catalog.jsonb_typeof(e->'fulfillmentHourlyCost')<>'number' or (e->>'fulfillmentHourlyCost')::numeric<=0
       or pg_catalog.jsonb_typeof(e->'targetMarginPercent')<>'number' or (e->>'targetMarginPercent')::numeric<0 or (e->>'targetMarginPercent')::numeric>=100
       or pg_catalog.jsonb_typeof(fixed->'monthlyBudget') not in ('number','null')
       or (pg_catalog.jsonb_typeof(fixed->'monthlyBudget')='number' and (fixed->>'monthlyBudget')::numeric not between 0 and 1000000000) then
      raise exception 'configuration revision v3 economics/fixed values are malformed';
    end if;
    if pg_catalog.jsonb_typeof(e->'monthlyRetainer')='number' then perform public.client_health_binary64_json((e->>'monthlyRetainer')::numeric,'monthlyRetainer'); end if;
    perform public.client_health_binary64_json((e->>'fulfillmentHourlyCost')::numeric,'fulfillmentHourlyCost');
    perform public.client_health_binary64_json((e->>'targetMarginPercent')::numeric,'targetMarginPercent');
    if pg_catalog.jsonb_typeof(fixed->'monthlyBudget')='number' then perform public.client_health_binary64_json((fixed->>'monthlyBudget')::numeric,'monthlyBudget'); end if;

    -- Reuse the exact v2 validator for display, metrics, and statically typed source
    -- bindings. Replace only v3-only fields and values whose v3 TS domain differs.
    projected_client := (c-'economics'-'northStarLanes'-'fixedValues')
      || pg_catalog.jsonb_build_object('fixedValues',pg_catalog.jsonb_build_object('monthlyBudget',fixed->'monthlyBudget','monthlyHoursAllotment',null));
    if c->>'configStatus'='approved' then
      projected_client:=pg_catalog.jsonb_set(projected_client,'{metrics}',(
        select pg_catalog.jsonb_agg((m-'weight'-'direction'-'greenThreshold'-'yellowThreshold')
          || '{"weight":1,"direction":"lower_is_better","greenThreshold":0,"yellowThreshold":0}'::jsonb order by ord)
        from pg_catalog.jsonb_array_elements(c->'metrics') with ordinality q(m,ord)));
    end if;
    projected_clients:=projected_clients||pg_catalog.jsonb_build_array(projected_client);

    if pg_catalog.jsonb_typeof(c->'northStarLanes')<>'array' then raise exception 'northStarLanes must be an array'; end if;
    select coalesce(pg_catalog.array_agg(value->>'key' order by ord),'{}') into v_lane_keys
      from pg_catalog.jsonb_array_elements(c->'northStarLanes') with ordinality q(value,ord);
    select coalesce(pg_catalog.array_agg(value->>'sourceKey' order by ord),'{}') into v_source_keys
      from pg_catalog.jsonb_array_elements(c->'sources') with ordinality q(value,ord);
    if c->>'configStatus'='configuration_required' then
      if fixed->'monthlyBudget'<>'null'::jsonb or e->'monthlyRetainer'<>'null'::jsonb
         or c->'metrics'<>'[]'::jsonb or c->'sources'<>'[]'::jsonb or c->'northStarLanes'<>'[]'::jsonb then
        raise exception 'configuration-required v3 client contains approved configuration';
      end if;
    elsif pg_catalog.jsonb_array_length(c->'northStarLanes') not between 1 and 4 then
      raise exception 'approved v3 client must contain between 1 and 4 North Star lanes';
    end if;
    if v_lane_keys<>(select coalesce(pg_catalog.array_agg(x order by x),'{}') from pg_catalog.unnest(v_lane_keys)x)
       or pg_catalog.cardinality(v_lane_keys)<>(select count(distinct x) from pg_catalog.unnest(v_lane_keys)x) then
      raise exception 'North Star lanes are duplicate or noncanonical';
    end if;
    v_weight:=0; v_union:='{}';
    for lane in select value from pg_catalog.jsonb_array_elements(c->'northStarLanes') loop
      perform public.client_health_assert_exact_keys(lane,array['key','label','formula','evaluation','required','weight','direction','greenThreshold','yellowThreshold','sourceKeys'],'northStarLane');
      select coalesce(pg_catalog.array_agg(x#>>'{}' order by ord),'{}') into v_lane_sources
        from pg_catalog.jsonb_array_elements(lane->'sourceKeys') with ordinality q(x,ord);
      if lane->>'key'!~'^[a-z0-9]+([-_][a-z0-9]+)*$' or pg_catalog.length(lane->>'key')>64
         or pg_catalog.jsonb_typeof(lane->'label')<>'string' or lane->>'label'='' or lane->>'label'<>pg_catalog.btrim(lane->>'label') or pg_catalog.length(lane->>'label')>120
         or pg_catalog.jsonb_typeof(lane->'required')<>'boolean'
         or pg_catalog.jsonb_typeof(lane->'weight')<>'number' or (lane->>'weight')::numeric<=0 or (lane->>'weight')::numeric>100
         or pg_catalog.jsonb_typeof(lane->'greenThreshold')<>'number' or pg_catalog.jsonb_typeof(lane->'yellowThreshold')<>'number'
         or not ((lane->>'formula'='cost_per_result' and lane->>'evaluation'='period_over_period_change' and lane->>'direction'='lower_is_better')
              or (lane->>'formula'='roas' and lane->>'evaluation' in ('absolute_target','period_over_period_change') and lane->>'direction'='higher_is_better'))
         or (lane->>'direction'='lower_is_better' and (lane->>'greenThreshold')::numeric>(lane->>'yellowThreshold')::numeric)
         or (lane->>'direction'='higher_is_better' and (lane->>'greenThreshold')::numeric<(lane->>'yellowThreshold')::numeric)
         or pg_catalog.cardinality(v_lane_sources)<1
         or exists(select 1 from pg_catalog.unnest(v_lane_sources)x where x!~'^[a-z0-9]+([-_][a-z0-9]+)*$')
         or v_lane_sources<>(select coalesce(pg_catalog.array_agg(x order by x),'{}') from pg_catalog.unnest(v_lane_sources)x)
         or pg_catalog.cardinality(v_lane_sources)<>(select count(distinct x) from pg_catalog.unnest(v_lane_sources)x)
         or exists(select 1 from pg_catalog.unnest(v_lane_sources)x where not (x=any(v_source_keys))) then
        raise exception 'configuration revision North Star lane is malformed';
      end if;
      perform public.client_health_binary64_json((lane->>'weight')::numeric,'northStarLane.weight');
      perform public.client_health_binary64_json((lane->>'greenThreshold')::numeric,'northStarLane.greenThreshold');
      perform public.client_health_binary64_json((lane->>'yellowThreshold')::numeric,'northStarLane.yellowThreshold');
      if exists(
        select 1 from pg_catalog.unnest(v_lane_sources) source_key
        where not exists(select 1 from pg_catalog.jsonb_array_elements(c->'sources') s
          where s->>'sourceKey'=source_key and s->'permittedFactFields' ? 'currentRows'
            and (lane->>'evaluation'<>'period_over_period_change' or s->'permittedFactFields' ? 'previousRows'))
      ) then raise exception 'North Star lane source lacks formula-required permitted fact fields'; end if;
      v_weight:=v_weight+(lane->>'weight')::numeric;
      v_union:=v_union||v_lane_sources;
    end loop;
    if v_weight>100 then raise exception 'total North Star lane weight must not exceed 100'; end if;
    select coalesce(pg_catalog.array_agg(distinct x order by x),'{}') into v_union from pg_catalog.unnest(v_union)x;
    select coalesce(pg_catalog.array_agg(x#>>'{}' order by ord),'{}') into v_values
      from pg_catalog.jsonb_array_elements((select value->'sourceKeys' from pg_catalog.jsonb_array_elements(c->'metrics') where value->>'key'='north_star')) with ordinality q(x,ord);
    if c->>'configStatus'='approved' and v_values<>v_union then
      raise exception 'north_star metric sourceKeys must equal the North Star lane source union';
    end if;
    v_ids:=pg_catalog.array_append(v_ids,c->>'clientId'); v_client_keys:=pg_catalog.array_append(v_client_keys,c->>'clientKey');
  end loop;
  if v_ids<>(select pg_catalog.array_agg(x order by x) from pg_catalog.unnest(v_ids)x)
     or pg_catalog.cardinality(v_ids)<>(select count(distinct x) from pg_catalog.unnest(v_ids)x)
     or pg_catalog.cardinality(v_client_keys)<>(select count(distinct x) from pg_catalog.unnest(v_client_keys)x) then
    raise exception 'configuration revision clients are duplicate or noncanonical';
  end if;
  -- The projection hash is intentionally irrelevant; give the preserved v2 validator
  -- its own exact canonical identity solely to reuse validation semantics.
  v_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object(
    'schemaVersion',2,'calculationVersion',p_revision->'calculationVersion','sourceContractVersion',p_revision->'sourceContractVersion','clients',projected_clients
  )),'UTF8'),'sha256'),'hex');
  perform private.client_health_assert_config_revision_v2(public.client_health_revision_id(v_hash),v_hash,pg_catalog.jsonb_build_object(
    'schemaVersion',2,'calculationVersion',p_revision->'calculationVersion','sourceContractVersion',p_revision->'sourceContractVersion','clients',projected_clients));
  v_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(p_revision),'UTF8'),'sha256'),'hex');
  if v_hash<>p_hash then raise exception 'configuration revision hash mismatch'; end if;
end
$$;

create or replace function public.client_health_assert_config_revision(p_id uuid,p_hash text,p_revision jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if p_revision->'schemaVersion'='2'::jsonb then
    perform private.client_health_assert_config_revision_v2(p_id,p_hash,p_revision);
  elsif p_revision->'schemaVersion'='3'::jsonb then
    perform private.client_health_assert_config_revision_v3(p_id,p_hash,p_revision);
  else
    raise exception 'revision.schemaVersion must be 2 or 3';
  end if;
end
$$;

create function public.client_health_stage_config_revision(p_id uuid,p_revision_hash text,p_revision jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_uid uuid;
begin
  v_uid:=auth.uid();
  if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role in ('agency','super_admin')) then
    raise exception 'agency or super_admin authorization required' using errcode='42501';
  end if;
  return private.client_health_stage_config_revision(p_id,p_revision_hash,p_revision);
end
$$;

create function public.client_health_activate_config_revision(p_activation_id uuid,p_revision_id uuid,p_reviewed_commit_sha text,p_reason text,p_expected_current_activation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_uid uuid;
begin
  v_uid:=auth.uid();
  if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role in ('agency','super_admin')) then
    raise exception 'agency or super_admin authorization required' using errcode='42501';
  end if;
  return private.client_health_activate_config_revision(p_activation_id,p_revision_id,p_reviewed_commit_sha,v_uid::text,p_reason,p_expected_current_activation_id);
end
$$;

alter function private.client_health_assert_config_revision_v2(uuid,text,jsonb) owner to postgres;
alter function private.client_health_assert_config_revision_v3(uuid,text,jsonb) owner to postgres;
alter function public.client_health_assert_config_revision(uuid,text,jsonb) owner to postgres;
alter function public.client_health_stage_config_revision(uuid,text,jsonb) owner to postgres;
alter function public.client_health_activate_config_revision(uuid,uuid,text,text,uuid) owner to postgres;

revoke all on function private.client_health_assert_config_revision_v2(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.client_health_assert_config_revision_v3(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.client_health_assert_config_revision(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.client_health_stage_config_revision(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.client_health_activate_config_revision(uuid,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.client_health_stage_config_revision(uuid,text,jsonb) to authenticated;
grant execute on function public.client_health_activate_config_revision(uuid,uuid,text,text,uuid) to authenticated;

revoke all on schema private from public,anon,authenticated,service_role;
revoke all on function private.client_health_stage_config_revision(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid) from public,anon,authenticated,service_role;

commit;