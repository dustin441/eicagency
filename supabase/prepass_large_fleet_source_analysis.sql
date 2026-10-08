-- Marketo-first PrePass analysis for every contact whose fleet size is 100 or more.
-- This dataset is intentionally independent of paid-media source tables.

begin;

create table if not exists public.prepass_large_fleet_contacts (
  marketo_id bigint primary key,
  email text,
  first_name text,
  last_name text,
  phone text,
  mobile_phone text,
  company text,
  title text,
  industry text,
  state text,
  country text,
  inferred_company text,
  inferred_state_region text,
  annual_revenue numeric,
  number_of_employees integer,

  fleet_size text,
  pp_fleet_size text,
  pp_number_of_vehicles integer,
  truck_count integer,
  pp_fleet_size_segment text,
  vehicles_enrolled integer,
  normalized_fleet_size integer,
  fleet_size_band text not null check (fleet_size_band in ('100-500', '500+')),
  fleet_size_source text not null,
  raw_fleet_value text not null,

  created_at timestamptz,
  updated_at timestamptz not null,
  acquisition_date timestamptz,
  date_mql date,
  date_sql date,
  date_closed_won date,
  lead_status text,
  lead_score integer,
  mql_score integer,

  acquisition_program_id text,
  lead_source text,
  lead_source_detail text,
  marketo_lead_source text,
  marketo_lead_source_detail text,
  marketing_channel text,
  marketing_channel_detail text,
  channel_partner text,
  is_partner boolean,
  referring_account_name text,
  referring_account_number text,
  registration_source_type text,
  registration_source_info text,
  original_source_type text,
  original_source_info text,
  original_referrer text,
  last_form_name text,
  last_form_url text,
  last_form_at timestamptz,
  source_campaign text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_campaign_name text,
  utm_content text,
  utm_term text,
  utm_campaign_id text,
  utm_adgroup_id text,
  utm_adgroup_name text,
  utm_adset_id text,
  utm_adset_name text,
  utm_ad_id text,
  utm_ad_name text,
  utm_history text,
  original_utm_source text,
  original_utm_medium text,
  original_utm_campaign text,
  original_utm_content text,
  original_utm_term text,

  primary_channel text not null,
  primary_source text not null,
  source_detail text,
  classification_reason text not null,
  has_paid_evidence boolean not null default false,
  has_event_evidence boolean not null default false,
  has_partner_evidence boolean not null default false,
  has_email_evidence boolean not null default false,

  raw_payload jsonb not null,
  source_export_id uuid,
  source_window_start timestamptz,
  source_window_end timestamptz,
  imported_at timestamptz not null default now()
);

create index if not exists prepass_large_fleet_contacts_channel_idx on public.prepass_large_fleet_contacts(primary_channel);
create index if not exists prepass_large_fleet_contacts_created_idx on public.prepass_large_fleet_contacts(created_at);
create index if not exists prepass_large_fleet_contacts_mql_idx on public.prepass_large_fleet_contacts(date_mql);
create index if not exists prepass_large_fleet_contacts_sql_idx on public.prepass_large_fleet_contacts(date_sql);
create index if not exists prepass_large_fleet_contacts_won_idx on public.prepass_large_fleet_contacts(date_closed_won);
create index if not exists prepass_large_fleet_contacts_company_idx on public.prepass_large_fleet_contacts(company);

alter table public.prepass_large_fleet_contacts enable row level security;
revoke all on public.prepass_large_fleet_contacts from public, anon, authenticated;
grant select, insert, update, delete on public.prepass_large_fleet_contacts to service_role;

create table if not exists public.prepass_large_fleet_sync_runs (
  export_id uuid primary key,
  mode text not null check (mode in ('backfill', 'incremental', 'snapshot', 'supplemental_sweep')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  state text not null check (state in ('created', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  provider_rows integer,
  qualified_rows integer,
  inserted_rows integer,
  updated_rows integer,
  excluded_rows integer,
  file_sha256 text,
  file_bytes bigint,
  provider_status jsonb,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint prepass_large_fleet_sync_window check (window_end > window_start and window_end - window_start <= interval '31 days')
);

alter table public.prepass_large_fleet_sync_runs
  drop constraint if exists prepass_large_fleet_sync_runs_mode_window_start_window_end_key;

alter table public.prepass_large_fleet_sync_runs
  drop constraint if exists prepass_large_fleet_sync_runs_mode_check;
alter table public.prepass_large_fleet_sync_runs
  add constraint prepass_large_fleet_sync_runs_mode_check
  check (mode in ('backfill', 'incremental', 'snapshot', 'supplemental_sweep'));

create table if not exists public.prepass_large_fleet_sync_state (
  singleton boolean primary key default true check (singleton),
  backfill_covered_until timestamptz not null default '2010-01-01T00:00:00Z',
  incremental_covered_until timestamptz,
  backfill_complete boolean not null default false,
  last_success_at timestamptz,
  last_export_id uuid,
  touched_at timestamptz not null default now()
);

insert into public.prepass_large_fleet_sync_state(singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.prepass_large_fleet_sync_runs enable row level security;
alter table public.prepass_large_fleet_sync_state enable row level security;
revoke all on public.prepass_large_fleet_sync_runs from public, anon, authenticated;
revoke all on public.prepass_large_fleet_sync_state from public, anon, authenticated;
grant select, insert, update, delete on public.prepass_large_fleet_sync_runs to service_role;
grant select, insert, update, delete on public.prepass_large_fleet_sync_state to service_role;

create or replace function public.prepass_large_fleet_normalize(p jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  value text;
  numeric_value numeric;
  field_name text;
begin
  foreach field_name in array array['pp_numberofvehicles', 'truckCount'] loop
    value := nullif(btrim(p ->> field_name), '');
    if value is not null and replace(value, ',', '') ~ '^\d+(\.\d+)?$' then
      numeric_value := replace(value, ',', '')::numeric;
      if numeric_value >= 100 then
        return jsonb_build_object(
          'qualified', true,
          'normalized', floor(numeric_value)::bigint,
          'band', case when numeric_value > 500 then '500+' else '100-500' end,
          'source', field_name,
          'raw', value
        );
      end if;
    end if;
  end loop;

  foreach field_name in array array['fleetSize', 'pp_fleetsize', 'pp_fleetsizesegment'] loop
    value := nullif(btrim(p ->> field_name), '');
    if value is null then continue; end if;
    if replace(value, ',', '') ~ '^\d+(\.\d+)?$' then
      numeric_value := replace(value, ',', '')::numeric;
      if numeric_value >= 100 then
        return jsonb_build_object('qualified', true, 'normalized', floor(numeric_value)::bigint,
          'band', case when numeric_value > 500 then '500+' else '100-500' end,
          'source', field_name, 'raw', value);
      end if;
    elsif lower(replace(value, ' ', '')) in ('100-499', '100-500', '101-500') then
      return jsonb_build_object('qualified', true, 'normalized', null,
        'band', '100-500', 'source', field_name, 'raw', value);
    elsif lower(replace(value, ' ', '')) in ('500+', '500plus', '500ormore') then
      return jsonb_build_object('qualified', true, 'normalized', 500,
        'band', '500+', 'source', field_name, 'raw', value);
    end if;
  end loop;

  return jsonb_build_object('qualified', false);
end;
$function$;

create or replace function public.prepass_large_fleet_classify(p jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  original_evidence text := lower(concat_ws(' | ',
    p ->> 'originalSourceType', p ->> 'originalSourceInfo', p ->> 'originalReferrer',
    p ->> 'leadSource', p ->> 'leadSourceDetail', p ->> 'pp_marketoleadsource',
    p ->> 'pp_marketoleadsourcedetail', p ->> 'pp_marketingchannelid',
    p ->> 'pp_marketingchanneldetailid', p ->> 'originalutmsource',
    p ->> 'originalutmmedium', p ->> 'originalutmcampaign', p ->> 'acquisitionProgramId'));
  current_evidence text := lower(concat_ws(' | ',
    p ->> 'utmsource', p ->> 'utmmedium', p ->> 'utmcampaign', p ->> 'utmcampaignname',
    p ->> 'campaignid', p ->> 'lastCompletedFormFormName', p ->> 'lastCompletedFormURL'));
  partner_evidence text := lower(concat_ws(' | ',
    p ->> 'pp_channelpartneraccountid', p ->> 'referringAccountName',
    p ->> 'referringAccountNumber'));
  evidence text;
  channel text;
  source_name text;
  reason text;
  paid boolean;
  event_flag boolean;
  partner_flag boolean;
  email_flag boolean;
begin
  evidence := concat_ws(' | ', original_evidence, current_evidence, partner_evidence,
    lower(concat_ws(' | ', p ->> 'registrationSourceType', p ->> 'registrationSourceInfo')));
  paid := evidence ~ '(cpc|ppc|paid social|paid_social|pmax|performance.?max|lead.?form|display|retarget|gclid|fbclid)'
    or nullif(btrim(p ->> 'utmcampaignid'), '') is not null
    or nullif(btrim(p ->> 'utmadsetid'), '') is not null
    or nullif(btrim(p ->> 'utmadid'), '') is not null;
  event_flag := evidence ~ '(event|trade.?show|conference|summit|convention|booth|expo|webinar|ibtta|tca |trimble insight|motive vision|women in trucking|future fleet)';
  partner_flag := lower(coalesce(p ->> 'mktoIsPartner', '')) = 'true'
    or partner_evidence !~ '^\s*(\|\s*)*$'
    or evidence ~ '(partner|referral|referred|affiliate)';
  email_flag := evidence ~ '(^|[^a-z])(email|newsletter|nurture|drip)([^a-z]|$)';

  if original_evidence ~ '(webinar)' then channel := 'Webinar'; reason := 'original source evidence';
  elsif original_evidence ~ '(event|trade.?show|conference|summit|convention|booth|expo|ibtta|tca |trimble insight|motive vision|women in trucking|future fleet)' then channel := 'Event / Trade Show'; reason := 'original source evidence';
  elsif partner_flag and partner_evidence !~ '^\s*(\|\s*)*$' then channel := 'Partner / Referral'; reason := 'partner or referring-account field';
  elsif original_evidence ~ '(partner|referral|referred|affiliate)' then channel := 'Partner / Referral'; reason := 'original source evidence';
  elsif original_evidence ~ '(^|[^a-z])(email|newsletter|nurture|drip)([^a-z]|$)' then channel := 'Email'; reason := 'original source evidence';
  elsif original_evidence ~ '(sales|outbound|cold.?call|telemarketing|bd r|sdr)' then channel := 'Sales / Outbound'; reason := 'original source evidence';
  elsif original_evidence ~ '(cpc|ppc|pmax|performance.?max|paid search|google.?ads|bing.?ads)' then channel := 'Paid Search'; reason := 'original UTM/source evidence';
  elsif original_evidence ~ '(paid social|paid_social|facebook|instagram|linkedin)' and original_evidence ~ '(paid|lead.?form|campaign)' then channel := 'Paid Social'; reason := 'original UTM/source evidence';
  elsif original_evidence ~ '(organic search|seo|google organic|bing organic)' then channel := 'Organic Search'; reason := 'original source evidence';
  elsif original_evidence ~ '(organic social)' then channel := 'Organic Social'; reason := 'original source evidence';
  elsif original_evidence ~ '(direct|direct traffic)' then channel := 'Direct'; reason := 'original source evidence';
  elsif current_evidence ~ '(webinar)' then channel := 'Webinar'; reason := 'current source evidence';
  elsif current_evidence ~ '(event|trade.?show|conference|summit|convention|booth|expo|ibtta|tca |trimble insight|motive vision|women in trucking|future fleet)' then channel := 'Event / Trade Show'; reason := 'current source evidence';
  elsif current_evidence ~ '(cpc|ppc|pmax|performance.?max|paid search|google.?ads|bing.?ads)' then channel := 'Paid Search'; reason := 'current UTM evidence';
  elsif paid and current_evidence ~ '(facebook|instagram|linkedin|lead.?form|paid social|paid_social)' then channel := 'Paid Social'; reason := 'current UTM/ad identifiers';
  elsif email_flag then channel := 'Email'; reason := 'available source evidence';
  elsif partner_flag then channel := 'Partner / Referral'; reason := 'available source evidence';
  elsif current_evidence ~ '(organic|seo)' then channel := 'Organic Search'; reason := 'current source evidence';
  elsif current_evidence ~ '(direct|direct traffic)' then channel := 'Direct'; reason := 'current source evidence';
  elsif evidence !~ '^\s*(\|\s*)*$' then channel := 'Other Known Source'; reason := 'identified source not yet mapped';
  else channel := 'Unidentified'; reason := 'no source evidence';
  end if;

  source_name := case
    when channel in ('Paid Search', 'Paid Social', 'Organic Search', 'Organic Social', 'Direct') then coalesce(
      nullif(btrim(p ->> 'originalutmsource'), ''),
      nullif(btrim(p ->> 'utmsource'), ''),
      nullif(btrim(p ->> 'originalSourceInfo'), ''),
      nullif(btrim(p ->> 'leadSourceDetail'), ''),
      channel
    )
    when channel in ('Event / Trade Show', 'Webinar') then coalesce(
      nullif(btrim(p ->> 'originalSourceInfo'), ''),
      nullif(btrim(p ->> 'pp_marketingchanneldetailid'), ''),
      nullif(btrim(p ->> 'leadSourceDetail'), ''),
      nullif(btrim(p ->> 'lastCompletedFormFormName'), ''),
      channel
    )
    when channel = 'Partner / Referral' then coalesce(
      nullif(btrim(p ->> 'referringAccountName'), ''),
      nullif(btrim(p ->> 'pp_channelpartneraccountid'), ''),
      nullif(btrim(p ->> 'originalSourceInfo'), ''),
      nullif(btrim(p ->> 'leadSourceDetail'), ''),
      channel
    )
    else coalesce(
      nullif(btrim(p ->> 'originalSourceInfo'), ''),
      nullif(btrim(p ->> 'originalSourceType'), ''),
      nullif(btrim(p ->> 'pp_marketingchanneldetailid'), ''),
      nullif(btrim(p ->> 'pp_marketingchannelid'), ''),
      nullif(btrim(p ->> 'pp_marketoleadsourcedetail'), ''),
      nullif(btrim(p ->> 'pp_marketoleadsource'), ''),
      nullif(btrim(p ->> 'leadSourceDetail'), ''),
      nullif(btrim(p ->> 'leadSource'), ''),
      nullif(btrim(p ->> 'originalutmsource'), ''),
      nullif(btrim(p ->> 'utmsource'), ''),
      channel
    )
  end;

  return jsonb_build_object(
    'channel', channel,
    'source', source_name,
    'detail', coalesce(nullif(btrim(p ->> 'originalutmcampaign'), ''), nullif(btrim(p ->> 'utmcampaign'), ''), nullif(btrim(p ->> 'lastCompletedFormFormName'), '')),
    'reason', reason,
    'paid', paid,
    'event', event_flag,
    'partner', partner_flag,
    'email', email_flag
  );
end;
$function$;

with classified as (
  select marketo_id, public.prepass_large_fleet_classify(raw_payload) source
  from public.prepass_large_fleet_contacts
)
update public.prepass_large_fleet_contacts target
set primary_channel = classified.source ->> 'channel',
    primary_source = classified.source ->> 'source',
    source_detail = nullif(classified.source ->> 'detail', ''),
    classification_reason = classified.source ->> 'reason',
    has_paid_evidence = (classified.source ->> 'paid')::boolean,
    has_event_evidence = (classified.source ->> 'event')::boolean,
    has_partner_evidence = (classified.source ->> 'partner')::boolean,
    has_email_evidence = (classified.source ->> 'email')::boolean
from classified
where target.marketo_id = classified.marketo_id;

create or replace function public.prepass_large_fleet_upsert_batch(
  p_rows jsonb,
  p_export_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_qualified integer;
  v_upserted integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  with raw as (
    select value p
    from jsonb_array_elements(p_rows)
  ), evaluated as (
    select p, public.prepass_large_fleet_normalize(p) fleet, public.prepass_large_fleet_classify(p) source
    from raw
  ), qualified as (
    select * from evaluated where coalesce((fleet ->> 'qualified')::boolean, false)
  ), upserted as (
    insert into public.prepass_large_fleet_contacts (
      marketo_id, email, first_name, last_name, phone, mobile_phone, company, title, industry, state, country,
      inferred_company, inferred_state_region, annual_revenue, number_of_employees,
      fleet_size, pp_fleet_size, pp_number_of_vehicles, truck_count, pp_fleet_size_segment, vehicles_enrolled,
      normalized_fleet_size, fleet_size_band, fleet_size_source, raw_fleet_value,
      created_at, updated_at, acquisition_date, date_mql, date_sql, date_closed_won, lead_status, lead_score, mql_score,
      acquisition_program_id, lead_source, lead_source_detail, marketo_lead_source, marketo_lead_source_detail,
      marketing_channel, marketing_channel_detail, channel_partner, is_partner, referring_account_name,
      referring_account_number, registration_source_type, registration_source_info, original_source_type,
      original_source_info, original_referrer, last_form_name, last_form_url, last_form_at, source_campaign,
      utm_source, utm_medium, utm_campaign, utm_campaign_name, utm_content, utm_term, utm_campaign_id,
      utm_adgroup_id, utm_adgroup_name, utm_adset_id, utm_adset_name, utm_ad_id, utm_ad_name, utm_history,
      original_utm_source, original_utm_medium, original_utm_campaign, original_utm_content, original_utm_term,
      primary_channel, primary_source, source_detail, classification_reason, has_paid_evidence,
      has_event_evidence, has_partner_evidence, has_email_evidence,
      raw_payload, source_export_id, source_window_start, source_window_end, imported_at
    )
    select
      (p ->> 'id')::bigint, nullif(p ->> 'email',''), nullif(p ->> 'firstName',''), nullif(p ->> 'lastName',''),
      nullif(p ->> 'phone',''), nullif(p ->> 'mobilePhone',''), nullif(p ->> 'company',''), nullif(p ->> 'title',''),
      nullif(p ->> 'industry',''), nullif(p ->> 'state',''), nullif(p ->> 'country',''),
      nullif(p ->> 'inferredCompany',''), nullif(p ->> 'inferredStateRegion',''),
      nullif(p ->> 'annualRevenue','')::numeric, nullif(p ->> 'numberOfEmployees','')::integer,
      nullif(p ->> 'fleetSize',''), nullif(p ->> 'pp_fleetsize',''), nullif(p ->> 'pp_numberofvehicles','')::integer,
      nullif(p ->> 'truckCount','')::integer, nullif(p ->> 'pp_fleetsizesegment',''), nullif(p ->> 'pp_vehiclesenrolled','')::integer,
      nullif(fleet ->> 'normalized','')::integer, fleet ->> 'band', fleet ->> 'source', fleet ->> 'raw',
      nullif(p ->> 'createdAt','')::timestamptz, (p ->> 'updatedAt')::timestamptz,
      nullif(p ->> 'mktoAcquisitionDate','')::timestamptz, nullif(p ->> 'dateMQL','')::date,
      nullif(p ->> 'dateSQL','')::date, nullif(p ->> 'dateClosedWon','')::date,
      nullif(p ->> 'leadStatus',''), nullif(p ->> 'leadScore','')::integer, nullif(p ->> 'mQLScore','')::integer,
      nullif(p ->> 'acquisitionProgramId',''), nullif(p ->> 'leadSource',''), nullif(p ->> 'leadSourceDetail',''),
      nullif(p ->> 'pp_marketoleadsource',''), nullif(p ->> 'pp_marketoleadsourcedetail',''),
      nullif(p ->> 'pp_marketingchannelid',''), nullif(p ->> 'pp_marketingchanneldetailid',''),
      nullif(p ->> 'pp_channelpartneraccountid',''), nullif(p ->> 'mktoIsPartner','')::boolean,
      nullif(p ->> 'referringAccountName',''), nullif(p ->> 'referringAccountNumber',''),
      nullif(p ->> 'registrationSourceType',''), nullif(p ->> 'registrationSourceInfo',''),
      nullif(p ->> 'originalSourceType',''), nullif(p ->> 'originalSourceInfo',''), nullif(p ->> 'originalReferrer',''),
      nullif(p ->> 'lastCompletedFormFormName',''), nullif(p ->> 'lastCompletedFormURL',''),
      nullif(p ->> 'lastCompletedFormDateTime','')::timestamptz, nullif(p ->> 'campaignid',''),
      nullif(p ->> 'utmsource',''), nullif(p ->> 'utmmedium',''), nullif(p ->> 'utmcampaign',''),
      nullif(p ->> 'utmcampaignname',''), nullif(p ->> 'utmcontent',''), nullif(p ->> 'utmterm',''),
      nullif(p ->> 'utmcampaignid',''), nullif(p ->> 'utmadgroupid',''), nullif(p ->> 'utmadgroupname',''),
      nullif(p ->> 'utmadsetid',''), nullif(p ->> 'utmadsetname',''), nullif(p ->> 'utmadid',''),
      nullif(p ->> 'utmadname',''), nullif(p ->> 'uTMHistory',''), nullif(p ->> 'originalutmsource',''),
      nullif(p ->> 'originalutmmedium',''), nullif(p ->> 'originalutmcampaign',''),
      nullif(p ->> 'originalutmcontent',''), nullif(p ->> 'originalutmterm',''),
      source ->> 'channel', source ->> 'source', nullif(source ->> 'detail',''), source ->> 'reason',
      (source ->> 'paid')::boolean, (source ->> 'event')::boolean, (source ->> 'partner')::boolean,
      (source ->> 'email')::boolean, p, p_export_id, p_window_start, p_window_end, now()
    from qualified
    where nullif(p ->> 'id','') is not null and nullif(p ->> 'updatedAt','') is not null
    on conflict (marketo_id) do update set
      email=excluded.email, first_name=excluded.first_name, last_name=excluded.last_name, phone=excluded.phone,
      mobile_phone=excluded.mobile_phone, company=excluded.company, title=excluded.title, industry=excluded.industry,
      state=excluded.state, country=excluded.country, inferred_company=excluded.inferred_company,
      inferred_state_region=excluded.inferred_state_region, annual_revenue=excluded.annual_revenue,
      number_of_employees=excluded.number_of_employees, fleet_size=excluded.fleet_size,
      pp_fleet_size=excluded.pp_fleet_size, pp_number_of_vehicles=excluded.pp_number_of_vehicles,
      truck_count=excluded.truck_count, pp_fleet_size_segment=excluded.pp_fleet_size_segment,
      vehicles_enrolled=excluded.vehicles_enrolled, normalized_fleet_size=excluded.normalized_fleet_size,
      fleet_size_band=excluded.fleet_size_band, fleet_size_source=excluded.fleet_size_source,
      raw_fleet_value=excluded.raw_fleet_value, created_at=excluded.created_at, updated_at=excluded.updated_at,
      acquisition_date=excluded.acquisition_date, date_mql=excluded.date_mql, date_sql=excluded.date_sql,
      date_closed_won=excluded.date_closed_won, lead_status=excluded.lead_status, lead_score=excluded.lead_score,
      mql_score=excluded.mql_score, acquisition_program_id=excluded.acquisition_program_id,
      lead_source=excluded.lead_source, lead_source_detail=excluded.lead_source_detail,
      marketo_lead_source=excluded.marketo_lead_source, marketo_lead_source_detail=excluded.marketo_lead_source_detail,
      marketing_channel=excluded.marketing_channel, marketing_channel_detail=excluded.marketing_channel_detail,
      channel_partner=excluded.channel_partner, is_partner=excluded.is_partner,
      referring_account_name=excluded.referring_account_name, referring_account_number=excluded.referring_account_number,
      registration_source_type=excluded.registration_source_type, registration_source_info=excluded.registration_source_info,
      original_source_type=excluded.original_source_type, original_source_info=excluded.original_source_info,
      original_referrer=excluded.original_referrer, last_form_name=excluded.last_form_name,
      last_form_url=excluded.last_form_url, last_form_at=excluded.last_form_at, source_campaign=excluded.source_campaign,
      utm_source=excluded.utm_source, utm_medium=excluded.utm_medium, utm_campaign=excluded.utm_campaign,
      utm_campaign_name=excluded.utm_campaign_name, utm_content=excluded.utm_content, utm_term=excluded.utm_term,
      utm_campaign_id=excluded.utm_campaign_id, utm_adgroup_id=excluded.utm_adgroup_id,
      utm_adgroup_name=excluded.utm_adgroup_name, utm_adset_id=excluded.utm_adset_id,
      utm_adset_name=excluded.utm_adset_name, utm_ad_id=excluded.utm_ad_id, utm_ad_name=excluded.utm_ad_name,
      utm_history=excluded.utm_history, original_utm_source=excluded.original_utm_source,
      original_utm_medium=excluded.original_utm_medium, original_utm_campaign=excluded.original_utm_campaign,
      original_utm_content=excluded.original_utm_content, original_utm_term=excluded.original_utm_term,
      primary_channel=excluded.primary_channel, primary_source=excluded.primary_source,
      source_detail=excluded.source_detail, classification_reason=excluded.classification_reason,
      has_paid_evidence=excluded.has_paid_evidence, has_event_evidence=excluded.has_event_evidence,
      has_partner_evidence=excluded.has_partner_evidence, has_email_evidence=excluded.has_email_evidence,
      raw_payload=excluded.raw_payload, source_export_id=excluded.source_export_id,
      source_window_start=excluded.source_window_start, source_window_end=excluded.source_window_end,
      imported_at=now()
    where excluded.updated_at >= prepass_large_fleet_contacts.updated_at
    returning marketo_id
  )
  select (select count(*) from qualified), (select count(*) from upserted)
  into v_qualified, v_upserted;

  return jsonb_build_object(
    'input_rows', jsonb_array_length(p_rows),
    'qualified_rows', v_qualified,
    'upserted_rows', v_upserted,
    'excluded_rows', jsonb_array_length(p_rows) - v_qualified
  );
end;
$function$;

create or replace function public.prepass_large_fleet_import_payload(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select public.prepass_large_fleet_upsert_batch(
    coalesce(p_payload -> 'rows', '[]'::jsonb),
    (p_payload ->> 'export_id')::uuid,
    (p_payload ->> 'window_start')::timestamptz,
    (p_payload ->> 'window_end')::timestamptz
  );
$function$;

create or replace function public.prepass_large_fleet_source_summary(p_start date, p_end date)
returns table(
  primary_channel text,
  contacts bigint,
  contact_share numeric,
  mqls bigint,
  sqls bigint,
  won bigint,
  fleets_500_plus bigint,
  paid_influenced bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with scoped as (
    select * from public.prepass_large_fleet_contacts
    where coalesce(created_at::date, acquisition_date::date, updated_at::date) between p_start and p_end
       or date_mql between p_start and p_end
       or date_sql between p_start and p_end
       or date_closed_won between p_start and p_end
  ), totals as (select count(*)::numeric total from scoped)
  select s.primary_channel,
    count(*)::bigint contacts,
    round(100 * count(*)::numeric / nullif(t.total, 0), 1) contact_share,
    count(*) filter (where s.date_mql between p_start and p_end)::bigint mqls,
    count(*) filter (where s.date_sql between p_start and p_end)::bigint sqls,
    count(*) filter (where s.date_closed_won between p_start and p_end)::bigint won,
    count(*) filter (where s.fleet_size_band = '500+')::bigint fleets_500_plus,
    count(*) filter (where s.has_paid_evidence)::bigint paid_influenced
  from scoped s cross join totals t
  group by s.primary_channel, t.total
  order by contacts desc, s.primary_channel;
$function$;

create or replace function public.prepass_large_fleet_source_detail(p_start date, p_end date)
returns table(primary_channel text, primary_source text, contacts bigint, contact_share numeric, mqls bigint, sqls bigint, won bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with scoped as (
    select * from public.prepass_large_fleet_contacts
    where coalesce(created_at::date, acquisition_date::date, updated_at::date) between p_start and p_end
       or date_mql between p_start and p_end
       or date_sql between p_start and p_end
       or date_closed_won between p_start and p_end
  ), totals as (select count(*)::numeric total from scoped)
  select s.primary_channel, s.primary_source, count(*)::bigint,
    round(100 * count(*)::numeric / nullif(t.total, 0), 1),
    count(*) filter (where s.date_mql between p_start and p_end)::bigint,
    count(*) filter (where s.date_sql between p_start and p_end)::bigint,
    count(*) filter (where s.date_closed_won between p_start and p_end)::bigint
  from scoped s cross join totals t
  group by s.primary_channel, s.primary_source, t.total
  order by count(*) desc, s.primary_channel, s.primary_source;
$function$;

revoke all on function public.prepass_large_fleet_normalize(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_classify(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_upsert_batch(jsonb, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_import_payload(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_source_summary(date, date) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_source_detail(date, date) from public, anon, authenticated;
grant execute on function public.prepass_large_fleet_normalize(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_classify(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_upsert_batch(jsonb, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.prepass_large_fleet_import_payload(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_source_summary(date, date) to service_role;
grant execute on function public.prepass_large_fleet_source_detail(date, date) to service_role;

notify pgrst, 'reload schema';
commit;
