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

create table if not exists public.prepass_marketo_mirror_runs (
  run_id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('incremental','full_snapshot')),
  status text not null default 'staging' check (status in ('staging','completed','failed','blocked')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  provider_export_ids text[] not null default '{}',
  provider_count bigint,
  parsed_count bigint,
  staged_count bigint,
  changed_count bigint,
  source_checksum text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  check (window_end > window_start)
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
  marketo_id bigint primary key check (marketo_id > 0),
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
  mirror_run_id uuid not null references public.prepass_marketo_mirror_runs(run_id),
  mirrored_at timestamptz not null default now(),
  is_present boolean not null default true
);

create table if not exists public.prepass_marketo_mirror_history (
  history_id bigint generated always as identity primary key,
  marketo_id bigint not null,
  source_updated_at timestamptz not null,
  payload_sha256 text not null,
  payload jsonb not null,
  mirror_run_id uuid not null references public.prepass_marketo_mirror_runs(run_id),
  observed_at timestamptz not null default now(),
  unique (marketo_id, payload_sha256)
);

create table if not exists public.prepass_marketo_campaign_map (
  mapping_id bigint generated always as identity primary key,
  platform text not null check (platform in ('Google','Meta','LinkedIn','StackAdapt','Other')),
  campaign_id text,
  campaign_alias text not null,
  campaign_norm text generated always as (regexp_replace(lower(campaign_alias), '[^a-z0-9]', '', 'g')) stored,
  canonical_campaign text not null,
  focus text check (focus in ('SMB','ABM','FD360')),
  mapping_status text not null default 'approved' check (mapping_status in ('approved','review','retired')),
  evidence text not null,
  valid_from date,
  valid_to date,
  updated_at timestamptz not null default now()
);
create unique index if not exists prepass_marketo_campaign_map_platform_alias_uq
  on public.prepass_marketo_campaign_map(platform, campaign_norm)
  where mapping_status='approved';
create unique index if not exists prepass_marketo_campaign_map_platform_id_uq
  on public.prepass_marketo_campaign_map(platform, campaign_id)
  where campaign_id is not null and mapping_status='approved';

create table if not exists public.prepass_marketo_attribution_evidence (
  evidence_id bigint generated always as identity primary key,
  marketo_id bigint not null,
  route text not null check (route in ('validated_call','validated_enrollment','manual_review')),
  platform text not null check (platform in ('Google','Meta','LinkedIn','StackAdapt','Other')),
  focus text check (focus in ('SMB','ABM','FD360')),
  campaign_id text,
  campaign_name text,
  evidence_kind text not null,
  evidence_key text not null,
  valid_from date,
  valid_to date,
  active boolean not null default true,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route, evidence_key)
);

create index if not exists prepass_marketo_contacts_mql_date_idx
  on public.prepass_marketo_mirror_contacts(date_mql) where is_present and date_mql is not null;
create index if not exists prepass_marketo_contacts_sql_date_idx
  on public.prepass_marketo_mirror_contacts(date_sql) where is_present and date_sql is not null;
create index if not exists prepass_marketo_contacts_won_date_idx
  on public.prepass_marketo_mirror_contacts(date_won) where is_present and date_won is not null;
create index if not exists prepass_marketo_contacts_updated_idx
  on public.prepass_marketo_mirror_contacts(source_updated_at,marketo_id);
create index if not exists prepass_marketo_evidence_person_idx
  on public.prepass_marketo_attribution_evidence(marketo_id,active);

alter table public.prepass_marketo_mirror_runs enable row level security;
alter table public.prepass_marketo_mirror_staging enable row level security;
alter table public.prepass_marketo_mirror_contacts enable row level security;
alter table public.prepass_marketo_mirror_history enable row level security;
alter table public.prepass_marketo_campaign_map enable row level security;
alter table public.prepass_marketo_attribution_evidence enable row level security;

revoke all on public.prepass_marketo_mirror_runs from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_staging from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_contacts from public,anon,authenticated;
revoke all on public.prepass_marketo_mirror_history from public,anon,authenticated;
revoke all on public.prepass_marketo_campaign_map from public,anon,authenticated;
revoke all on public.prepass_marketo_attribution_evidence from public,anon,authenticated;
grant select,insert,update on public.prepass_marketo_mirror_runs to service_role;
grant select,insert,update,delete on public.prepass_marketo_mirror_staging to service_role;
grant select on public.prepass_marketo_mirror_contacts,public.prepass_marketo_mirror_history to service_role;
grant select,insert,update on public.prepass_marketo_campaign_map,public.prepass_marketo_attribution_evidence to service_role;
grant usage,select on all sequences in schema public to service_role;

create or replace function public.prepass_stage_marketo_mirror_rows(p_run_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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

create or replace function public.prepass_finalize_marketo_mirror_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_run public.prepass_marketo_mirror_runs%rowtype; v_staged bigint; v_changed bigint;
begin
  select * into v_run from public.prepass_marketo_mirror_runs where run_id=p_run_id for update;
  if v_run.run_id is null then raise exception 'unknown mirror run %',p_run_id; end if;
  if v_run.status <> 'staging' then raise exception 'run % is not staging',p_run_id; end if;
  select count(*) into v_staged from public.prepass_marketo_mirror_staging where run_id=p_run_id;
  if v_run.provider_count is null or v_run.parsed_count is null or nullif(v_run.source_checksum,'') is null then
    raise exception 'run % lacks provider count, parsed count, or checksum',p_run_id;
  end if;
  if v_run.provider_count<>v_run.parsed_count or v_run.parsed_count<>v_staged then
    update public.prepass_marketo_mirror_runs set status='blocked',error_code='COUNT_MISMATCH',
      error_detail=format('provider=%s parsed=%s staged=%s',v_run.provider_count,v_run.parsed_count,v_staged),completed_at=now()
    where run_id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','blocked','error_code','COUNT_MISMATCH',
      'provider_count',v_run.provider_count,'parsed_count',v_run.parsed_count,'staged_count',v_staged);
  end if;
  insert into public.prepass_marketo_mirror_history(marketo_id,source_updated_at,payload_sha256,payload,mirror_run_id)
  select s.marketo_id,s.source_updated_at,s.payload_sha256,s.payload,p_run_id
  from public.prepass_marketo_mirror_staging s
  left join public.prepass_marketo_mirror_contacts c using(marketo_id)
  where s.run_id=p_run_id and (c.marketo_id is null or c.payload_sha256<>s.payload_sha256)
  on conflict(marketo_id,payload_sha256) do nothing;
  get diagnostics v_changed=row_count;
  insert into public.prepass_marketo_mirror_contacts(
    marketo_id,source_created_at,source_updated_at,acquisition_date,acquisition_program_id,annual_revenue,
    date_mql,date_sql,date_won,date_closed_lost,email,phone,lead_source,lead_source_detail,lead_status,lifecycle_stage,
    lead_revenue_stage_id,marketo_lead_source,marketo_lead_source_detail,marketo_lifecycle_status,
    registration_source_type,registration_source_info,status_reason,original_source_type,original_source_info,
    original_utm_source,original_utm_medium,original_utm_campaign,original_utm_content,original_utm_term,
    utm_source,utm_medium,utm_campaign,utm_campaign_name,utm_campaign_id,utm_adset_id,utm_adset_name,
    utm_ad_id,utm_ad_name,utm_content,utm_term,utm_history,gclid,fbclid,fleet_size,fleet_size_segment,
    payload,payload_sha256,mirror_run_id,mirrored_at,is_present)
  select s.marketo_id,public.prepass_marketo_safe_timestamptz(s.payload->>'createdAt'),s.source_updated_at,
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
    nullif(btrim(s.payload->>'gclid'),''),nullif(btrim(s.payload->>'fbclid'),''),
    coalesce(nullif(btrim(s.payload->>'pp_fleetsize'),''),nullif(btrim(s.payload->>'fleetSize'),'')),
    nullif(btrim(s.payload->>'pp_fleetsizesegment'),''),s.payload,s.payload_sha256,p_run_id,now(),true
  from public.prepass_marketo_mirror_staging s where s.run_id=p_run_id
  on conflict(marketo_id) do update set
    source_created_at=excluded.source_created_at,source_updated_at=excluded.source_updated_at,
    acquisition_date=excluded.acquisition_date,acquisition_program_id=excluded.acquisition_program_id,
    annual_revenue=excluded.annual_revenue,date_mql=excluded.date_mql,date_sql=excluded.date_sql,date_won=excluded.date_won,
    date_closed_lost=excluded.date_closed_lost,email=excluded.email,phone=excluded.phone,lead_source=excluded.lead_source,
    lead_source_detail=excluded.lead_source_detail,lead_status=excluded.lead_status,lifecycle_stage=excluded.lifecycle_stage,
    lead_revenue_stage_id=excluded.lead_revenue_stage_id,marketo_lead_source=excluded.marketo_lead_source,
    marketo_lead_source_detail=excluded.marketo_lead_source_detail,marketo_lifecycle_status=excluded.marketo_lifecycle_status,
    registration_source_type=excluded.registration_source_type,registration_source_info=excluded.registration_source_info,
    status_reason=excluded.status_reason,original_source_type=excluded.original_source_type,
    original_source_info=excluded.original_source_info,original_utm_source=excluded.original_utm_source,
    original_utm_medium=excluded.original_utm_medium,original_utm_campaign=excluded.original_utm_campaign,
    original_utm_content=excluded.original_utm_content,original_utm_term=excluded.original_utm_term,
    utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,utm_campaign=excluded.utm_campaign,
    utm_campaign_name=excluded.utm_campaign_name,utm_campaign_id=excluded.utm_campaign_id,
    utm_adset_id=excluded.utm_adset_id,utm_adset_name=excluded.utm_adset_name,utm_ad_id=excluded.utm_ad_id,
    utm_ad_name=excluded.utm_ad_name,utm_content=excluded.utm_content,utm_term=excluded.utm_term,
    utm_history=excluded.utm_history,gclid=excluded.gclid,fbclid=excluded.fbclid,fleet_size=excluded.fleet_size,
    fleet_size_segment=excluded.fleet_size_segment,payload=excluded.payload,payload_sha256=excluded.payload_sha256,
    mirror_run_id=excluded.mirror_run_id,mirrored_at=excluded.mirrored_at,is_present=true
  where excluded.source_updated_at >= public.prepass_marketo_mirror_contacts.source_updated_at;
  if v_run.run_kind='full_snapshot' then
    update public.prepass_marketo_mirror_contacts c set is_present=false,mirrored_at=now(),mirror_run_id=p_run_id
    where c.is_present and not exists(select 1 from public.prepass_marketo_mirror_staging s where s.run_id=p_run_id and s.marketo_id=c.marketo_id);
  end if;
  update public.prepass_marketo_mirror_runs set status='completed',staged_count=v_staged,changed_count=v_changed,completed_at=now(),error_code=null,error_detail=null
  where run_id=p_run_id;
  return jsonb_build_object('run_id',p_run_id,'status','completed','staged',v_staged,'changed',v_changed);
end $$;

revoke all on function public.prepass_stage_marketo_mirror_rows(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.prepass_finalize_marketo_mirror_run(uuid) from public,anon,authenticated;
grant execute on function public.prepass_stage_marketo_mirror_rows(uuid,jsonb) to service_role;
grant execute on function public.prepass_finalize_marketo_mirror_run(uuid) to service_role;

create or replace view public.prepass_marketo_lifecycle_events as
select marketo_id,'MQL'::text stage,date_mql stage_date from public.prepass_marketo_mirror_contacts where is_present and date_mql is not null
union all select marketo_id,'SQL',date_sql from public.prepass_marketo_mirror_contacts where is_present and date_sql is not null
union all select marketo_id,'WON',date_won from public.prepass_marketo_mirror_contacts where is_present and date_won is not null;

create or replace view public.prepass_marketo_person_attribution as
with evidence as (
 select c.*,
   coalesce(nullif(lower(btrim(c.utm_source)),''),nullif(lower(btrim(c.original_utm_source)),'')) source_value,
   coalesce(nullif(lower(btrim(c.utm_medium)),''),nullif(lower(btrim(c.original_utm_medium)),'')) medium_value,
   coalesce(nullif(btrim(c.utm_campaign),''),nullif(btrim(c.utm_campaign_name),''),nullif(btrim(c.original_utm_campaign),'')) source_campaign
 from public.prepass_marketo_mirror_contacts c where c.is_present
), classified as (
 select e.*,case
   when nullif(btrim(e.gclid),'') is not null then 'Google'
   when nullif(btrim(e.fbclid),'') is not null then 'Meta'
   when e.source_value in ('google','googleads','adwords') and e.medium_value in ('cpc','ppc','paid','paid_search','paid-search','pmax','search') then 'Google'
   when e.source_value in ('meta','facebook','fb','instagram','ig') and e.medium_value in ('cpc','ppc','paid','paid_social','paid-social','lead_form','lead-form') then 'Meta'
   when e.source_value in ('linkedin','linked_in','li') and e.medium_value in ('cpc','ppc','paid','paid_social','paid-social','lead_gen','lead-gen') then 'LinkedIn'
   when e.source_value in ('stackadapt','stack_adapt','programmatic') and e.medium_value in ('cpc','cpm','paid','display','paid_display','paid-display','programmatic') then 'StackAdapt'
   else null end paid_platform
 from evidence e
), mapped as (
 select c.*,m.canonical_campaign,m.focus,m.mapping_id,
   case when c.gclid is not null then 'gclid' when c.fbclid is not null then 'fbclid'
        when c.paid_platform is not null then 'paid_utm' else null end evidence_kind
 from classified c
 left join lateral (
   select x.* from public.prepass_marketo_campaign_map x
   where x.mapping_status='approved' and x.platform=c.paid_platform
     and (x.campaign_id is not null and x.campaign_id=c.utm_campaign_id
       or x.campaign_norm=regexp_replace(lower(coalesce(c.source_campaign,'')),'[^a-z0-9]','','g'))
     and (x.valid_from is null or x.valid_from<=coalesce(c.date_mql,c.source_created_at::date))
     and (x.valid_to is null or x.valid_to>=coalesce(c.date_mql,c.source_created_at::date))
   order by (x.campaign_id is not null and x.campaign_id=c.utm_campaign_id) desc,x.updated_at desc limit 1
 ) m on true
)
select marketo_id,paid_platform,source_campaign,utm_campaign_id,canonical_campaign,focus,evidence_kind,
 case when paid_platform is null then 'not_paid' when mapping_id is null then 'paid_unmapped' else 'paid_mapped' end attribution_status
from mapped;

create or replace view public.prepass_marketo_paid_lifecycle_events as
with call_evidence as (
 select distinct on (marketo_id) marketo_id,platform,focus,campaign_id,campaign_name,evidence_kind,valid_from,valid_to
 from public.prepass_marketo_attribution_evidence
 where active and route='validated_call'
 order by marketo_id,source_updated_at desc,evidence_id desc
)
select e.marketo_id,e.stage,e.stage_date,
 case when a.paid_platform is not null then a.paid_platform else c.platform end platform,
 case when a.paid_platform is not null then a.focus else c.focus end focus,
 case when a.paid_platform is not null then a.utm_campaign_id else c.campaign_id end campaign_id,
 case when a.paid_platform is not null then coalesce(a.canonical_campaign,a.source_campaign) else c.campaign_name end campaign_name,
 case when a.paid_platform is not null then a.evidence_kind else c.evidence_kind end evidence_kind,
 case when a.paid_platform is not null and a.focus is null then 'paid_unmapped'
      when a.paid_platform is not null or c.platform is not null then 'paid_mapped' else 'not_paid' end attribution_status
from public.prepass_marketo_lifecycle_events e
join public.prepass_marketo_mirror_contacts mc on mc.marketo_id=e.marketo_id
left join public.prepass_marketo_person_attribution a on a.marketo_id=e.marketo_id
left join call_evidence c on c.marketo_id=e.marketo_id
  and (c.valid_from is null or e.stage_date>=c.valid_from)
  and (c.valid_to is null or e.stage_date<=c.valid_to)
where a.paid_platform is not null or c.marketo_id is not null;

create or replace function public.prepass_marketo_mirror_comparison(p_start date,p_end date)
returns table(stage text,marketo_crm bigint,mirror_paid bigint,mirror_paid_unmapped bigint,legacy_mmp numeric,variance bigint)
language sql stable security definer set search_path=pg_catalog,public as $$
 with stages(stage) as (values('MQL'::text),('SQL'),('WON')),
 crm as (select stage,count(distinct marketo_id) n from public.prepass_marketo_lifecycle_events where stage_date between p_start and p_end group by stage),
 paid as (select stage,count(distinct marketo_id) n,count(distinct marketo_id) filter(where attribution_status='paid_unmapped') unmapped from public.prepass_marketo_paid_lifecycle_events where stage_date between p_start and p_end group by stage),
 legacy as (
   select 'MQL'::text stage,coalesce(sum(mqls),0)::numeric n from public.master_marketing_performance where date::date between p_start and p_end
   union all select 'SQL',coalesce(sum(sqls),0)::numeric from public.master_marketing_performance where date::date between p_start and p_end
   union all select 'WON',coalesce(sum(closed_won),0)::numeric from public.master_marketing_performance where date::date between p_start and p_end)
 select s.stage,coalesce(c.n,0),coalesce(p.n,0),coalesce(p.unmapped,0),coalesce(l.n,0),coalesce(l.n,0)::bigint-coalesce(p.n,0)
 from stages s left join crm c using(stage) left join paid p using(stage) left join legacy l using(stage);
$$;

create or replace function public.prepass_marketo_focus_comparison(p_start date,p_end date)
returns table(focus text,stage text,mirror_paid bigint,legacy_mmp numeric,variance bigint)
language sql stable security definer set search_path=pg_catalog,public as $$
 with focuses(focus) as (values('SMB'::text),('ABM'),('FD360'),('PAID_UNMAPPED')),
 stages(stage) as (values('MQL'::text),('SQL'),('WON')),
 paid as (select coalesce(focus,'PAID_UNMAPPED') focus,stage,count(distinct marketo_id) n from public.prepass_marketo_paid_lifecycle_events where stage_date between p_start and p_end group by 1,2),
 legacy as (
   select focus,'MQL'::text stage,coalesce(sum(mqls),0)::numeric n from public.master_marketing_performance where date::date between p_start and p_end group by focus
   union all select focus,'SQL',coalesce(sum(sqls),0)::numeric from public.master_marketing_performance where date::date between p_start and p_end group by focus
   union all select focus,'WON',coalesce(sum(closed_won),0)::numeric from public.master_marketing_performance where date::date between p_start and p_end group by focus)
 select f.focus,s.stage,coalesce(p.n,0),coalesce(l.n,0),coalesce(l.n,0)::bigint-coalesce(p.n,0)
 from focuses f cross join stages s left join paid p on p.focus=f.focus and p.stage=s.stage left join legacy l on l.focus=f.focus and l.stage=s.stage;
$$;

revoke all on public.prepass_marketo_lifecycle_events,public.prepass_marketo_person_attribution,public.prepass_marketo_paid_lifecycle_events from public,anon,authenticated;
grant select on public.prepass_marketo_lifecycle_events,public.prepass_marketo_person_attribution,public.prepass_marketo_paid_lifecycle_events to service_role;
revoke all on function public.prepass_marketo_mirror_comparison(date,date),public.prepass_marketo_focus_comparison(date,date) from public,anon,authenticated;
grant execute on function public.prepass_marketo_mirror_comparison(date,date),public.prepass_marketo_focus_comparison(date,date) to service_role;

comment on table public.prepass_marketo_mirror_contacts is 'Faithful current-state Marketo mirror. Never filter ingestion by paid attribution.';
comment on view public.prepass_marketo_lifecycle_events is 'One authoritative lifecycle event per Marketo person and stage, dated by the Marketo stage date.';
comment on view public.prepass_marketo_paid_lifecycle_events is 'Lifecycle outcomes attributed only by paid Marketo evidence or validated call evidence; paid-unmapped remains visible.';

commit;
