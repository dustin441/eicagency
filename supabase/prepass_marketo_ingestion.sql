-- Ingestion-only foundation. Explicit production SQL approval required.
-- Excludes campaign maps, call evidence, paid classification and reporting.
begin;
select pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));

create extension if not exists pgcrypto;

create or replace function public.prepass_marketo_safe_date(p_value text)
returns date language plpgsql immutable as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then return null; end if;
  return substring(p_value from 1 for 10)::date;
exception when others then return null;
end $$;

create or replace function public.prepass_marketo_safe_timestamptz(p_value text)
returns timestamptz language plpgsql immutable as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then return null; end if;
  return p_value::timestamptz;
exception when others then return null;
end $$;

create table if not exists public.prepass_marketo_source_contract (
  singleton boolean primary key default true check (singleton),
  smart_list_id bigint not null check (smart_list_id > 0),
  smart_list_name text not null check (btrim(smart_list_name) <> ''),
  smart_list_rules_checksum text not null check (smart_list_rules_checksum ~ '^[0-9a-f]{64}$'),
  minimum_provider_count bigint not null check (minimum_provider_count > 0),
  maximum_drop_fraction numeric(5,4) not null default 0.2000 check (maximum_drop_fraction >= 0 and maximum_drop_fraction < 1),
  approved_by text not null check (btrim(approved_by) <> ''),
  approved_at timestamptz not null default now(),
  notes text
);

create table if not exists public.prepass_marketo_mirror_runs (
  run_id uuid primary key default gen_random_uuid(),
  status text not null default 'staging' check (status in ('staging','completed','failed','blocked')),
  smart_list_id bigint not null check (smart_list_id > 0),
  smart_list_name text,
  smart_list_rules_checksum text check (smart_list_rules_checksum is null or smart_list_rules_checksum ~ '^[0-9a-f]{64}$'),
  field_count integer check (field_count is null or field_count > 0),
  field_dictionary_checksum text check (field_dictionary_checksum is null or field_dictionary_checksum ~ '^[0-9a-f]{64}$'),
  provider_export_id text,
  provider_count bigint check (provider_count is null or provider_count >= 0),
  parsed_count bigint check (parsed_count is null or parsed_count >= 0),
  unique_count bigint check (unique_count is null or unique_count >= 0),
  staged_count bigint check (staged_count is null or staged_count >= 0),
  source_checksum text check (source_checksum is null or source_checksum ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_detail text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists prepass_marketo_one_staging_run_uq
  on public.prepass_marketo_mirror_runs(status)
  where status='staging';

create table if not exists public.prepass_marketo_mirror_staging (
  run_id uuid not null references public.prepass_marketo_mirror_runs(run_id) on delete cascade,
  marketo_id bigint not null check (marketo_id > 0),
  source_updated_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  staged_at timestamptz not null default now(),
  primary key (run_id, marketo_id)
);

create table if not exists public.prepass_marketo_mirror_contacts (
  run_id uuid not null references public.prepass_marketo_mirror_runs(run_id) on delete restrict,
  marketo_id bigint not null check (marketo_id > 0),
  source_created_at timestamptz,
  source_updated_at timestamptz not null,
  acquisition_date timestamptz,
  acquisition_program_id text,
  annual_revenue text,
  date_mql date,
  date_sql date,
  date_won date,
  date_closed_lost date,
  email text,
  phone text,
  lead_source text,
  lead_source_detail text,
  lead_status text,
  lifecycle_stage text,
  lead_revenue_stage_id text,
  marketo_lead_source text,
  marketo_lead_source_detail text,
  marketo_lifecycle_status text,
  registration_source_type text,
  registration_source_info text,
  status_reason text,
  original_source_type text,
  original_source_info text,
  original_utm_source text,
  original_utm_medium text,
  original_utm_campaign text,
  original_utm_content text,
  original_utm_term text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_campaign_name text,
  utm_campaign_id text,
  utm_adset_id text,
  utm_adset_name text,
  utm_ad_id text,
  utm_ad_name text,
  utm_content text,
  utm_term text,
  utm_history text,
  gclid text,
  fbclid text,
  fleet_size text,
  fleet_size_segment text,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  mirrored_at timestamptz not null default now(),
  primary key (run_id, marketo_id)
);

create table if not exists public.prepass_marketo_mirror_history (
  history_id bigint generated always as identity primary key,
  run_id uuid not null references public.prepass_marketo_mirror_runs(run_id) on delete restrict,
  marketo_id bigint not null check (marketo_id > 0),
  change_type text not null check (change_type in ('added','changed','removed')),
  previous_payload_sha256 text check (previous_payload_sha256 is null or previous_payload_sha256 ~ '^[0-9a-f]{64}$'),
  current_payload_sha256 text check (current_payload_sha256 is null or current_payload_sha256 ~ '^[0-9a-f]{64}$'),
  previous_payload jsonb,
  current_payload jsonb,
  recorded_at timestamptz not null default now(),
  unique (run_id, marketo_id)
);

create table if not exists public.prepass_marketo_active_snapshot (
  singleton boolean primary key default true check (singleton),
  active_run_id uuid not null unique references public.prepass_marketo_mirror_runs(run_id) on delete restrict,
  activated_at timestamptz not null default now()
);

create or replace function public.prepass_marketo_reject_snapshot_mutation()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception 'published Marketo snapshot rows are immutable';
end $$;

drop trigger if exists prepass_marketo_snapshot_immutable on public.prepass_marketo_mirror_contacts;
create trigger prepass_marketo_snapshot_immutable
before update on public.prepass_marketo_mirror_contacts
for each row execute function public.prepass_marketo_reject_snapshot_mutation();

create or replace function public.prepass_marketo_reject_history_mutation()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception 'Marketo payload history rows are immutable';
end $$;

drop trigger if exists prepass_marketo_history_immutable on public.prepass_marketo_mirror_history;
create trigger prepass_marketo_history_immutable
before update or delete on public.prepass_marketo_mirror_history
for each row execute function public.prepass_marketo_reject_history_mutation();


create index if not exists prepass_marketo_contacts_mql_date_idx
  on public.prepass_marketo_mirror_contacts(run_id,date_mql) where date_mql is not null;
create index if not exists prepass_marketo_contacts_sql_date_idx
  on public.prepass_marketo_mirror_contacts(run_id,date_sql) where date_sql is not null;
create index if not exists prepass_marketo_contacts_won_date_idx
  on public.prepass_marketo_mirror_contacts(run_id,date_won) where date_won is not null;
create index if not exists prepass_marketo_contacts_updated_idx
  on public.prepass_marketo_mirror_contacts(run_id,source_updated_at,marketo_id);

alter table public.prepass_marketo_source_contract enable row level security;
alter table public.prepass_marketo_mirror_runs enable row level security;
alter table public.prepass_marketo_mirror_staging enable row level security;
alter table public.prepass_marketo_mirror_contacts enable row level security;
alter table public.prepass_marketo_mirror_history enable row level security;
alter table public.prepass_marketo_active_snapshot enable row level security;

revoke all on public.prepass_marketo_source_contract from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_runs from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_staging from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_contacts from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_history from public,anon,authenticated;
revoke all on public.prepass_marketo_active_snapshot from public,anon,authenticated;

revoke all on public.prepass_marketo_source_contract from service_role;
revoke all on public.prepass_marketo_mirror_runs from service_role;
revoke all on public.prepass_marketo_mirror_staging from service_role;
revoke all on public.prepass_marketo_mirror_contacts from service_role;
revoke all on public.prepass_marketo_mirror_history from service_role;
revoke all on public.prepass_marketo_active_snapshot from service_role;
grant select on public.prepass_marketo_source_contract to service_role;
grant select on public.prepass_marketo_mirror_runs to service_role;
grant select on public.prepass_marketo_mirror_staging to service_role;
grant select on public.prepass_marketo_mirror_contacts,public.prepass_marketo_mirror_history,public.prepass_marketo_active_snapshot to service_role;

create or replace function public.prepass_begin_marketo_mirror_run(
  p_smart_list_id bigint,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_run_id uuid;
  v_contract public.prepass_marketo_source_contract%rowtype;
begin
  if p_smart_list_id is null or p_smart_list_id <= 0 then raise exception 'smart-list ID must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));
  select * into v_contract from public.prepass_marketo_source_contract where singleton for share;
  if v_contract.singleton is null then raise exception 'approved Marketo source contract is not configured'; end if;
  if p_smart_list_id <> v_contract.smart_list_id then
    raise exception 'smart-list ID % does not match approved source contract %',p_smart_list_id,v_contract.smart_list_id;
  end if;
  with reclaimed as (
    update public.prepass_marketo_mirror_runs
    set status='failed',completed_at=now(),error_code='STALE_LEASE',error_detail='Staging lease exceeded two hours and was reclaimed.'
    where status='staging' and started_at<now()-interval '2 hours'
    returning run_id
  )
  delete from public.prepass_marketo_mirror_staging s using reclaimed r where s.run_id=r.run_id;
  insert into public.prepass_marketo_mirror_runs(smart_list_id,metadata)
  values(p_smart_list_id,coalesce(p_metadata,'{}'::jsonb)) returning run_id into v_run_id;
  return v_run_id;
end $$;

create or replace function public.prepass_stage_marketo_mirror_rows(p_run_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions,public as $$
declare v_status text; v_received bigint; v_staged bigint;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows must be a JSON array'; end if;
  select status into v_status from public.prepass_marketo_mirror_runs where run_id=p_run_id for update;
  if v_status is distinct from 'staging' then raise exception 'run % is not staging',p_run_id; end if;
  select count(*) into v_received from jsonb_array_elements(p_rows);
  if exists(select 1 from jsonb_array_elements(p_rows) r where coalesce(r->>'id','') !~ '^[1-9][0-9]*$') then
    raise exception 'invalid Marketo ID in staged rows';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where public.prepass_marketo_safe_timestamptz(r->>'updatedAt') is null) then
    raise exception 'missing or invalid updatedAt in staged rows';
  end if;
  insert into public.prepass_marketo_mirror_staging(run_id,marketo_id,source_updated_at,payload_sha256,payload)
  select p_run_id,(r->>'id')::bigint,public.prepass_marketo_safe_timestamptz(r->>'updatedAt'),
         encode(digest(convert_to(r::text,'UTF8'),'sha256'),'hex'),r
  from jsonb_array_elements(p_rows) r
  on conflict(run_id,marketo_id) do update set
    source_updated_at=excluded.source_updated_at,payload_sha256=excluded.payload_sha256,payload=excluded.payload,staged_at=now()
  where excluded.source_updated_at >= public.prepass_marketo_mirror_staging.source_updated_at;
  select count(*) into v_staged from public.prepass_marketo_mirror_staging where run_id=p_run_id;
  update public.prepass_marketo_mirror_runs set staged_count=v_staged where run_id=p_run_id;
  return jsonb_build_object('received',v_received,'staged',v_staged);
end $$;

create or replace function public.prepass_record_marketo_mirror_receipt(
  p_run_id uuid,
  p_smart_list_name text,
  p_smart_list_rules_checksum text,
  p_field_count integer,
  p_field_dictionary_checksum text,
  p_provider_export_id text,
  p_provider_count bigint,
  p_parsed_count bigint,
  p_unique_count bigint,
  p_source_checksum text,
  p_metadata jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_status text;
begin
  select status into v_status from public.prepass_marketo_mirror_runs where run_id=p_run_id for update;
  if v_status is distinct from 'staging' then raise exception 'run % is not staging',p_run_id; end if;
  update public.prepass_marketo_mirror_runs set
    smart_list_name=p_smart_list_name,
    smart_list_rules_checksum=p_smart_list_rules_checksum,
    field_count=p_field_count,
    field_dictionary_checksum=p_field_dictionary_checksum,
    provider_export_id=p_provider_export_id,
    provider_count=p_provider_count,
    parsed_count=p_parsed_count,
    unique_count=p_unique_count,
    source_checksum=p_source_checksum,
    metadata=coalesce(p_metadata,'{}'::jsonb)
  where run_id=p_run_id;
end $$;

create or replace function public.prepass_fail_marketo_mirror_run(
  p_run_id uuid,p_error_code text,p_error_detail text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  with failed as (
    update public.prepass_marketo_mirror_runs set
      status='failed',completed_at=now(),
      error_code=left(coalesce(nullif(btrim(p_error_code),''),'WRITER_FAILURE'),100),
      error_detail=left(coalesce(p_error_detail,''),1000)
    where run_id=p_run_id and status='staging'
    returning run_id
  )
  delete from public.prepass_marketo_mirror_staging s using failed f where s.run_id=f.run_id;
end $$;

create or replace function public.prepass_finalize_marketo_mirror_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_run public.prepass_marketo_mirror_runs%rowtype;
  v_contract public.prepass_marketo_source_contract%rowtype;
  v_staged bigint;
  v_prior_provider_count bigint;
  v_prior_run_id uuid;
  v_minimum_from_prior bigint;
begin
  select * into v_run from public.prepass_marketo_mirror_runs where run_id=p_run_id for update;
  if v_run.run_id is null then raise exception 'unknown mirror run %',p_run_id; end if;
  if v_run.status <> 'staging' then raise exception 'run % is not staging',p_run_id; end if;
  select * into v_contract from public.prepass_marketo_source_contract where singleton for share;
  if v_contract.singleton is null then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='SOURCE_CONTRACT_MISSING',
      error_detail='approved Marketo source contract is not configured',completed_at=now()
    where run_id=p_run_id;
    delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','SOURCE_CONTRACT_MISSING');
  end if;
  select count(*) into v_staged from public.prepass_marketo_mirror_staging where run_id=p_run_id;
  if v_run.smart_list_name is null or btrim(v_run.smart_list_name) = ''
     or v_run.smart_list_rules_checksum is null or v_run.smart_list_rules_checksum !~ '^[0-9a-f]{64}$'
     or v_run.field_count is null or v_run.field_count <= 0
     or v_run.field_dictionary_checksum is null or v_run.field_dictionary_checksum !~ '^[0-9a-f]{64}$'
     or v_run.provider_export_id is null or btrim(v_run.provider_export_id) = ''
     or v_run.provider_count is null or v_run.parsed_count is null or v_run.unique_count is null
     or v_run.source_checksum is null or v_run.source_checksum !~ '^[0-9a-f]{64}$' then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='SOURCE_RECEIPT_MISSING',
      error_detail='smart-list identity and rules checksum, field dictionary receipt, provider export ID, counts, and source SHA-256 checksum are required',completed_at=now()
    where run_id=p_run_id;
    delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','SOURCE_RECEIPT_MISSING');
  end if;
  if v_run.smart_list_id <> v_contract.smart_list_id
     or v_run.smart_list_name <> v_contract.smart_list_name
     or v_run.smart_list_rules_checksum <> v_contract.smart_list_rules_checksum then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='SOURCE_CONTRACT_MISMATCH',
      error_detail=format('run list=%s name=%s rules=%s; approved list=%s name=%s rules=%s',
        v_run.smart_list_id,v_run.smart_list_name,v_run.smart_list_rules_checksum,
        v_contract.smart_list_id,v_contract.smart_list_name,v_contract.smart_list_rules_checksum),completed_at=now()
    where run_id=p_run_id;
    delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','SOURCE_CONTRACT_MISMATCH');
  end if;
  if v_run.provider_count<>v_run.parsed_count or v_run.parsed_count<>v_run.unique_count or v_run.unique_count<>v_staged then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='COUNT_MISMATCH',
      error_detail=format('provider=%s parsed=%s unique=%s staged=%s',v_run.provider_count,v_run.parsed_count,v_run.unique_count,v_staged),completed_at=now()
    where run_id=p_run_id;
    delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','COUNT_MISMATCH',
      'provider_count',v_run.provider_count,'parsed_count',v_run.parsed_count,'unique_count',v_run.unique_count,'staged_count',v_staged);
  end if;
  if v_run.provider_count < v_contract.minimum_provider_count or v_staged = 0 then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='POPULATION_TOO_SMALL',
      error_detail=format('provider=%s staged=%s approved_minimum=%s',v_run.provider_count,v_staged,v_contract.minimum_provider_count),completed_at=now()
    where run_id=p_run_id;
    delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','POPULATION_TOO_SMALL',
      'provider_count',v_run.provider_count,'minimum_provider_count',v_contract.minimum_provider_count);
  end if;
  select provider_count into v_prior_provider_count
  from public.prepass_marketo_mirror_runs
  where status='completed' and provider_count is not null
  order by completed_at desc,started_at desc limit 1;
  if v_prior_provider_count is not null then
    v_minimum_from_prior:=ceil(v_prior_provider_count*(1-v_contract.maximum_drop_fraction))::bigint;
    if v_run.provider_count < v_minimum_from_prior then
      update public.prepass_marketo_mirror_runs set status='blocked',error_code='POPULATION_DROP_EXCEEDED',
        error_detail=format('provider=%s prior=%s allowed_drop_fraction=%s minimum=%s',
          v_run.provider_count,v_prior_provider_count,v_contract.maximum_drop_fraction,v_minimum_from_prior),completed_at=now()
      where run_id=p_run_id;
      delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
      return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','POPULATION_DROP_EXCEEDED',
        'provider_count',v_run.provider_count,'prior_provider_count',v_prior_provider_count,'minimum_provider_count',v_minimum_from_prior);
    end if;
  end if;
  select active_run_id into v_prior_run_id from public.prepass_marketo_active_snapshot where singleton;
  insert into public.prepass_marketo_mirror_contacts(
    run_id,marketo_id,source_created_at,source_updated_at,acquisition_date,acquisition_program_id,annual_revenue,
    date_mql,date_sql,date_won,date_closed_lost,email,phone,lead_source,lead_source_detail,lead_status,lifecycle_stage,
    lead_revenue_stage_id,marketo_lead_source,marketo_lead_source_detail,marketo_lifecycle_status,
    registration_source_type,registration_source_info,status_reason,original_source_type,original_source_info,
    original_utm_source,original_utm_medium,original_utm_campaign,original_utm_content,original_utm_term,
    utm_source,utm_medium,utm_campaign,utm_campaign_name,utm_campaign_id,utm_adset_id,utm_adset_name,
    utm_ad_id,utm_ad_name,utm_content,utm_term,utm_history,gclid,fbclid,fleet_size,fleet_size_segment,
    payload,payload_sha256,mirrored_at)
  select p_run_id,s.marketo_id,public.prepass_marketo_safe_timestamptz(s.payload->>'createdAt'),s.source_updated_at,
    public.prepass_marketo_safe_timestamptz(s.payload->>'mktoAcquisitionDate'),
    nullif(btrim(s.payload->>'acquisitionProgramId'),''),nullif(btrim(s.payload->>'annualRevenue'),''),
    public.prepass_marketo_safe_date(s.payload->>'dateMQL'),public.prepass_marketo_safe_date(s.payload->>'dateSQL'),
    public.prepass_marketo_safe_date(s.payload->>'dateClosedWon'),public.prepass_marketo_safe_date(s.payload->>'dateClosedLost'),
    nullif(btrim(s.payload->>'email'),''),nullif(btrim(s.payload->>'phone'),''),nullif(btrim(s.payload->>'leadSource'),''),
    nullif(btrim(s.payload->>'leadSourceDetail'),''),nullif(btrim(s.payload->>'leadStatus'),''),
    nullif(btrim(s.payload->>'lifecycleStage'),''),nullif(btrim(s.payload->>'leadRevenueStageId'),''),
    nullif(btrim(s.payload->>'pp_marketoleadsource'),''),nullif(btrim(s.payload->>'pp_marketoleadsourcedetail'),''),
    nullif(btrim(s.payload->>'pp_marketolifecyclestatus'),''),nullif(btrim(s.payload->>'registrationSourceType'),''),
    nullif(btrim(s.payload->>'registrationSourceInfo'),''),nullif(btrim(s.payload->>'statuscode'),''),
    nullif(btrim(s.payload->>'originalSourceType'),''),nullif(btrim(s.payload->>'originalSourceInfo'),''),
    nullif(btrim(s.payload->>'originalutmsource'),''),nullif(btrim(s.payload->>'originalutmmedium'),''),
    nullif(btrim(s.payload->>'originalutmcampaign'),''),nullif(btrim(s.payload->>'originalutmcontent'),''),
    nullif(btrim(s.payload->>'originalutmterm'),''),nullif(btrim(s.payload->>'utmsource'),''),
    nullif(btrim(s.payload->>'utmmedium'),''),nullif(btrim(s.payload->>'utmcampaign'),''),
    nullif(btrim(s.payload->>'utmcampaignname'),''),nullif(btrim(s.payload->>'utmcampaignid'),''),
    nullif(btrim(s.payload->>'utmadsetid'),''),nullif(btrim(s.payload->>'utmadsetname'),''),
    nullif(btrim(s.payload->>'utmadid'),''),nullif(btrim(s.payload->>'utmadname'),''),
    nullif(btrim(s.payload->>'utmcontent'),''),nullif(btrim(s.payload->>'utmterm'),''),nullif(btrim(s.payload->>'uTMHistory'),''),
    nullif(btrim(s.payload->>'gclid'),''),nullif(btrim(s.payload->>'FBCLID'),''),
    coalesce(nullif(btrim(s.payload->>'pp_fleetsize'),''),nullif(btrim(s.payload->>'fleetSize'),'')),
    nullif(btrim(s.payload->>'pp_fleetsizesegment'),''),s.payload,s.payload_sha256,now()
  from public.prepass_marketo_mirror_staging s where s.run_id=p_run_id;
  if v_prior_run_id is not null then
    insert into public.prepass_marketo_mirror_history(
      run_id,marketo_id,change_type,previous_payload_sha256,current_payload_sha256,previous_payload,current_payload)
    select p_run_id,coalesce(n.marketo_id,o.marketo_id),
      case when o.marketo_id is null then 'added' when n.marketo_id is null then 'removed' else 'changed' end,
      o.payload_sha256,n.payload_sha256,o.payload,n.payload
    from (select marketo_id,payload_sha256,payload from public.prepass_marketo_mirror_contacts where run_id=v_prior_run_id) o
    full join (select marketo_id,payload_sha256,payload from public.prepass_marketo_mirror_contacts where run_id=p_run_id) n
      on n.marketo_id=o.marketo_id
    where o.payload_sha256 is distinct from n.payload_sha256;
  end if;
  insert into public.prepass_marketo_active_snapshot(singleton,active_run_id,activated_at)
  values(true,p_run_id,now())
  on conflict(singleton) do update set active_run_id=excluded.active_run_id,activated_at=excluded.activated_at;
  delete from public.prepass_marketo_mirror_contacts where run_id<>p_run_id;
  delete from public.prepass_marketo_mirror_staging where run_id=p_run_id;
  update public.prepass_marketo_mirror_runs set status='completed',staged_count=v_staged,completed_at=now(),error_code=null,error_detail=null
  where run_id=p_run_id;
  return jsonb_build_object('run_id',p_run_id,'status','completed','staged',v_staged);
end $$;

revoke all on function public.prepass_begin_marketo_mirror_run(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.prepass_stage_marketo_mirror_rows(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.prepass_record_marketo_mirror_receipt(uuid,text,text,integer,text,text,bigint,bigint,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.prepass_fail_marketo_mirror_run(uuid,text,text) from public,anon,authenticated;
revoke all on function public.prepass_finalize_marketo_mirror_run(uuid) from public,anon,authenticated;
grant execute on function public.prepass_begin_marketo_mirror_run(bigint,jsonb) to service_role;
grant execute on function public.prepass_stage_marketo_mirror_rows(uuid,jsonb) to service_role;
grant execute on function public.prepass_record_marketo_mirror_receipt(uuid,text,text,integer,text,text,bigint,bigint,bigint,text,jsonb) to service_role;
grant execute on function public.prepass_fail_marketo_mirror_run(uuid,text,text) to service_role;
grant execute on function public.prepass_finalize_marketo_mirror_run(uuid) to service_role;

create or replace view public.prepass_marketo_active_contacts as
select c.*
from public.prepass_marketo_mirror_contacts c
join public.prepass_marketo_active_snapshot a on a.active_run_id=c.run_id and a.singleton;


revoke all on public.prepass_marketo_active_contacts from public,anon,authenticated;
grant select on public.prepass_marketo_active_contacts to service_role;
commit;
