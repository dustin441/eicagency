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

alter table public.prepass_large_fleet_sync_runs
  add column if not exists segment_key text,
  add column if not exists smart_list_id integer;

alter table public.prepass_large_fleet_sync_runs
  drop constraint if exists prepass_large_fleet_sync_segment_manifest_check;
alter table public.prepass_large_fleet_sync_runs
  add constraint prepass_large_fleet_sync_segment_manifest_check check (
    (segment_key is null and smart_list_id is null)
    or (segment_key = 'fleet_51_100_supplement' and smart_list_id = 5874)
    or (segment_key = 'fleet_101_500' and smart_list_id = 5875)
    or (segment_key = 'fleet_500_plus' and smart_list_id = 5876)
  );

create unique index if not exists prepass_large_fleet_sync_snapshot_segment_uidx
  on public.prepass_large_fleet_sync_runs(window_end, segment_key)
  where mode = 'snapshot' and segment_key is not null;

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

create or replace function public.prepass_large_fleet_safe_numeric(p_value text)
returns numeric
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  cleaned text;
begin
  cleaned := regexp_replace(nullif(btrim(p_value), ''), '[,$%[:space:]]', '', 'g');
  if cleaned is null or cleaned !~ '^-?[0-9]+(\.[0-9]+)?$' then return null; end if;
  return cleaned::numeric;
exception when others then
  return null;
end;
$function$;

create or replace function public.prepass_large_fleet_safe_integer(p_value text)
returns integer
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public
as $function$
declare
  parsed numeric;
begin
  parsed := public.prepass_large_fleet_safe_numeric(p_value);
  if parsed is null or parsed < -2147483648 or parsed > 2147483647 then return null; end if;
  return trunc(parsed)::integer;
exception when others then
  return null;
end;
$function$;

create or replace function public.prepass_large_fleet_safe_bigint(p_value text)
returns bigint
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public
as $function$
declare
  parsed numeric;
begin
  parsed := public.prepass_large_fleet_safe_numeric(p_value);
  if parsed is null or parsed < -9223372036854775808 or parsed > 9223372036854775807 then return null; end if;
  return trunc(parsed)::bigint;
exception when others then
  return null;
end;
$function$;

create or replace function public.prepass_large_fleet_safe_boolean(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
begin
  case lower(nullif(btrim(p_value), ''))
    when 'true' then return true;
    when 't' then return true;
    when '1' then return true;
    when 'yes' then return true;
    when 'y' then return true;
    when 'false' then return false;
    when 'f' then return false;
    when '0' then return false;
    when 'no' then return false;
    when 'n' then return false;
    else return null;
  end case;
end;
$function$;

create or replace function public.prepass_large_fleet_safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $function$
begin
  if nullif(btrim(p_value), '') is null then return null; end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$function$;

create or replace function public.prepass_large_fleet_safe_date(p_value text)
returns date
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $function$
begin
  if nullif(btrim(p_value), '') is null then return null; end if;
  return p_value::date;
exception when others then
  return null;
end;
$function$;

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
          'band', case when numeric_value >= 500 then '500+' else '100-500' end,
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
          'band', case when numeric_value >= 500 then '500+' else '100-500' end,
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
  paid := evidence ~ '(cpc|ppc|paid social|paid_social|facebook lead ads|linkedin lead gen|pmax|performance.?max|display|retarget|gclid|fbclid)'
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
  elsif original_evidence ~ '(paid social|paid_social|facebook|instagram|linkedin)' and original_evidence ~ '(paid|lead.?form|lead ads|lead gen|campaign)' then channel := 'Paid Social'; reason := 'original UTM/source evidence';
  elsif original_evidence ~ '(organic search|seo|google organic|bing organic)' then channel := 'Organic Search'; reason := 'original source evidence';
  elsif original_evidence ~ '(organic social)' then channel := 'Organic Social'; reason := 'original source evidence';
  elsif original_evidence ~ '(direct|direct traffic)' then channel := 'Direct'; reason := 'original source evidence';
  elsif current_evidence ~ '(webinar)' then channel := 'Webinar'; reason := 'current source evidence';
  elsif current_evidence ~ '(event|trade.?show|conference|summit|convention|booth|expo|ibtta|tca |trimble insight|motive vision|women in trucking|future fleet)' then channel := 'Event / Trade Show'; reason := 'current source evidence';
  elsif current_evidence ~ '(cpc|ppc|pmax|performance.?max|paid search|google.?ads|bing.?ads)' then channel := 'Paid Search'; reason := 'current UTM evidence';
  elsif paid and current_evidence ~ '(facebook|instagram|linkedin|paid social|paid_social)' then channel := 'Paid Social'; reason := 'current UTM/ad identifiers';
  elsif email_flag then channel := 'Email'; reason := 'available source evidence';
  elsif partner_flag then channel := 'Partner / Referral'; reason := 'available source evidence';
  elsif current_evidence ~ '(organic social)' then channel := 'Organic Social'; reason := 'current source evidence';
  elsif current_evidence ~ '(organic search|seo|google organic|bing organic)' then channel := 'Organic Search'; reason := 'current source evidence';
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
      nullif(btrim(p ->> 'originalReferrer'), ''),
      nullif(btrim(p ->> 'lastCompletedFormURL'), ''),
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
      public.prepass_large_fleet_safe_bigint(p ->> 'id'), nullif(p ->> 'email',''), nullif(p ->> 'firstName',''), nullif(p ->> 'lastName',''),
      nullif(p ->> 'phone',''), nullif(p ->> 'mobilePhone',''), nullif(p ->> 'company',''), nullif(p ->> 'title',''),
      nullif(p ->> 'industry',''), nullif(p ->> 'state',''), nullif(p ->> 'country',''),
      nullif(p ->> 'inferredCompany',''), nullif(p ->> 'inferredStateRegion',''),
      public.prepass_large_fleet_safe_numeric(p ->> 'annualRevenue'), public.prepass_large_fleet_safe_integer(p ->> 'numberOfEmployees'),
      nullif(p ->> 'fleetSize',''), nullif(p ->> 'pp_fleetsize',''), public.prepass_large_fleet_safe_integer(p ->> 'pp_numberofvehicles'),
      public.prepass_large_fleet_safe_integer(p ->> 'truckCount'), nullif(p ->> 'pp_fleetsizesegment',''), public.prepass_large_fleet_safe_integer(p ->> 'pp_vehiclesenrolled'),
      public.prepass_large_fleet_safe_integer(fleet ->> 'normalized'), fleet ->> 'band', fleet ->> 'source', fleet ->> 'raw',
      public.prepass_large_fleet_safe_timestamptz(p ->> 'createdAt'), public.prepass_large_fleet_safe_timestamptz(p ->> 'updatedAt'),
      public.prepass_large_fleet_safe_timestamptz(p ->> 'mktoAcquisitionDate'), public.prepass_large_fleet_safe_date(p ->> 'dateMQL'),
      public.prepass_large_fleet_safe_date(p ->> 'dateSQL'), public.prepass_large_fleet_safe_date(p ->> 'dateClosedWon'),
      nullif(p ->> 'leadStatus',''), public.prepass_large_fleet_safe_integer(p ->> 'leadScore'), public.prepass_large_fleet_safe_integer(p ->> 'mQLScore'),
      nullif(p ->> 'acquisitionProgramId',''), nullif(p ->> 'leadSource',''), nullif(p ->> 'leadSourceDetail',''),
      nullif(p ->> 'pp_marketoleadsource',''), nullif(p ->> 'pp_marketoleadsourcedetail',''),
      nullif(p ->> 'pp_marketingchannelid',''), nullif(p ->> 'pp_marketingchanneldetailid',''),
      nullif(p ->> 'pp_channelpartneraccountid',''), public.prepass_large_fleet_safe_boolean(p ->> 'mktoIsPartner'),
      nullif(p ->> 'referringAccountName',''), nullif(p ->> 'referringAccountNumber',''),
      nullif(p ->> 'registrationSourceType',''), nullif(p ->> 'registrationSourceInfo',''),
      nullif(p ->> 'originalSourceType',''), nullif(p ->> 'originalSourceInfo',''), nullif(p ->> 'originalReferrer',''),
      nullif(p ->> 'lastCompletedFormFormName',''), nullif(p ->> 'lastCompletedFormURL',''),
      public.prepass_large_fleet_safe_timestamptz(p ->> 'lastCompletedFormDateTime'), nullif(p ->> 'campaignid',''),
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
    where public.prepass_large_fleet_safe_bigint(p ->> 'id') is not null
      and public.prepass_large_fleet_safe_timestamptz(p ->> 'updatedAt') is not null
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

create or replace function public.prepass_large_fleet_finalize_snapshot(p_window_end timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_deleted integer;
  v_remaining integer;
  v_completed_exports integer;
  v_distinct_segments integer;
  v_segments text[];
  v_rows_valid boolean;
  v_segment_rows_valid boolean;
  v_anomaly_count integer;
  v_last_export_id uuid;
begin
  if p_window_end is null then
    raise exception 'p_window_end is required';
  end if;

  select count(*), count(distinct segment_key), array_agg(segment_key order by segment_key),
    bool_and(provider_rows > 0 and qualified_rows between 0 and provider_rows and inserted_rows = qualified_rows),
    bool_and(case when segment_key in ('fleet_101_500', 'fleet_500_plus') then qualified_rows = provider_rows else true end)
  into v_completed_exports, v_distinct_segments, v_segments, v_rows_valid, v_segment_rows_valid
  from public.prepass_large_fleet_sync_runs
  where mode = 'snapshot' and state = 'completed' and window_end = p_window_end
    and segment_key is not null and smart_list_id is not null;

  if v_completed_exports <> 3
     or v_distinct_segments <> 3
     or v_segments is distinct from array['fleet_101_500', 'fleet_500_plus', 'fleet_51_100_supplement']::text[]
     or not coalesce(v_rows_valid, false)
     or not coalesce(v_segment_rows_valid, false) then
    raise exception 'snapshot manifest incomplete or invalid for %: count %, distinct %, segments %, rows_valid %, segment_rows_valid %',
      p_window_end, v_completed_exports, v_distinct_segments, v_segments, v_rows_valid, v_segment_rows_valid;
  end if;

  with current_manifest as (
    select segment_key, provider_rows
    from public.prepass_large_fleet_sync_runs
    where mode = 'snapshot' and state = 'completed' and window_end = p_window_end
  ), prior_manifest as (
    select c.segment_key, c.provider_rows current_rows,
      (select r.provider_rows
       from public.prepass_large_fleet_sync_runs r
       where r.mode = 'snapshot' and r.state = 'completed'
         and r.segment_key = c.segment_key and r.window_end < p_window_end
       order by r.window_end desc limit 1) prior_rows
    from current_manifest c
  )
  select count(*) into v_anomaly_count
  from prior_manifest
  where prior_rows is not null and current_rows < greatest(1, floor(prior_rows * 0.5));

  if v_anomaly_count > 0 then
    raise exception 'snapshot finalization blocked for % because % segment(s) fell below 50 percent of the prior completed snapshot',
      p_window_end, v_anomaly_count;
  end if;

  delete from public.prepass_large_fleet_contacts
  where source_window_end is null or source_window_end < p_window_end;
  get diagnostics v_deleted = row_count;

  select export_id into v_last_export_id
  from public.prepass_large_fleet_sync_runs
  where mode = 'snapshot' and state = 'completed' and window_end = p_window_end
  order by completed_at desc nulls last, export_id
  limit 1;

  update public.prepass_large_fleet_sync_state
  set backfill_complete = true,
      backfill_covered_until = p_window_end,
      incremental_covered_until = p_window_end,
      last_success_at = now(),
      last_export_id = v_last_export_id,
      touched_at = now()
  where singleton;

  select count(*) into v_remaining from public.prepass_large_fleet_contacts;
  return jsonb_build_object(
    'deleted_stale_rows', v_deleted,
    'current_rows', v_remaining,
    'snapshot_window_end', p_window_end,
    'segments', v_segments,
    'anomaly_count', v_anomaly_count
  );
end;
$function$;

update public.prepass_large_fleet_sync_state
set backfill_covered_until = incremental_covered_until,
    touched_at = now()
where incremental_covered_until is not null
  and backfill_covered_until > incremental_covered_until;

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

create or replace function public.prepass_large_fleet_contact_detail(
  p_start date,
  p_end date,
  p_limit integer default 1000
)
returns table(
  marketo_id bigint,
  email text,
  company text,
  job_title text,
  fleet_size_band text,
  fleet_size_value integer,
  primary_channel text,
  primary_source text,
  source_detail text,
  date_mql timestamptz,
  date_sql timestamptz,
  date_closed_won timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    c.marketo_id,
    c.email,
    c.company,
    c.title as job_title,
    c.fleet_size_band,
    c.normalized_fleet_size as fleet_size_value,
    c.primary_channel,
    c.primary_source,
    c.source_detail,
    c.date_mql,
    c.date_sql,
    c.date_closed_won,
    greatest(c.updated_at, c.created_at, c.acquisition_date) as last_activity_at
  from public.prepass_large_fleet_contacts c
  where coalesce(c.created_at, c.acquisition_date, c.updated_at) < (p_end + 1)::timestamptz
    and (
      coalesce(c.created_at, c.acquisition_date, c.updated_at) >= p_start::timestamptz
      or c.date_mql between p_start::timestamptz and (p_end + 1)::timestamptz
      or c.date_sql between p_start::timestamptz and (p_end + 1)::timestamptz
      or c.date_closed_won between p_start::timestamptz and (p_end + 1)::timestamptz
    )
  order by greatest(c.updated_at, c.created_at, c.acquisition_date) desc nulls last, c.marketo_id
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
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

revoke all on function public.prepass_large_fleet_safe_numeric(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_safe_integer(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_safe_bigint(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_safe_boolean(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_safe_timestamptz(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_safe_date(text) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_normalize(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_classify(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_upsert_batch(jsonb, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_import_payload(jsonb) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_finalize_snapshot(timestamptz) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_source_summary(date, date) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_contact_detail(date, date, integer) from public, anon, authenticated;
revoke all on function public.prepass_large_fleet_source_detail(date, date) from public, anon, authenticated;
grant execute on function public.prepass_large_fleet_normalize(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_classify(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_upsert_batch(jsonb, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.prepass_large_fleet_import_payload(jsonb) to service_role;
grant execute on function public.prepass_large_fleet_finalize_snapshot(timestamptz) to service_role;
grant execute on function public.prepass_large_fleet_source_summary(date, date) to service_role;
grant execute on function public.prepass_large_fleet_contact_detail(date, date, integer) to service_role;
grant execute on function public.prepass_large_fleet_source_detail(date, date) to service_role;

notify pgrst, 'reload schema';
commit;
