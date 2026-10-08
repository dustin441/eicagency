-- Canonical PrePass contacts with a reported fleet size strictly above 100 trucks.
-- Inclusion is contact-based, never gated by form, list, campaign, product, or channel.
-- Every source is reconciled by id_marketo and the canonical table keeps one row per contact.

begin;

create or replace function public.prepass_canonical_fleet_size(p_value text)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  v text := btrim(coalesce(p_value, ''));
  n numeric;
begin
  if v = '500+' then return '500+'; end if;
  if v = '101-500' then return '101-500'; end if;
  -- Ambiguous bands such as 100-499 do not prove strictly more than 100.
  if v ~ '^\d+(\.\d+)?$' then
    n := v::numeric;
    if n > 500 then return '500+'; end if;
    if n > 100 then return '101-500'; end if;
  end if;
  return null;
end;
$function$;

create or replace function public.prepass_classify_origin(
  p_utm_source text,
  p_utm_medium text,
  p_campaign text,
  p_fbclid text
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  -- p_fbclid is retained only for migration compatibility and is intentionally
  -- not used to infer origin.
  with raw as (
    select
      btrim(coalesce(p_utm_source, '')) as source_raw,
      btrim(coalesce(p_utm_medium, '')) as medium_raw,
      btrim(coalesce(p_campaign, '')) as campaign_raw
  ),
  normalized as (
    select
      case
        when lower(source_raw) in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null') then ''
        when lower(source_raw) = 'google' then 'Google'
        when lower(source_raw) in ('facebook', 'fb') then 'Facebook'
        when lower(source_raw) in ('instagram', 'ig') then 'Instagram'
        when lower(source_raw) = 'facebook_mobile_feed' then 'Facebook Mobile Feed'
        else source_raw
      end as source,
      case
        when lower(medium_raw) in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null') then ''
        when lower(medium_raw) = 'pmax' then 'PMax'
        when lower(medium_raw) = 'cpc' then 'CPC'
        when lower(medium_raw) = 'ppc' then 'PPC'
        when lower(medium_raw) = 'lead_form' then 'Lead Form'
        when lower(medium_raw) = 'paid' then 'Paid'
        when lower(medium_raw) = 'search' then 'Search'
        when lower(medium_raw) = 'organic' then 'Organic'
        else medium_raw
      end as medium,
      case when lower(campaign_raw) in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null') then '' else campaign_raw end as campaign
    from raw
  )
  select case
    when source = '' and medium = '' and campaign = '' then 'Origin not identified'
    when lower(source) in ('direct', '(direct)', 'direct traffic') or lower(medium) = 'direct' then 'Direct access'
    else concat_ws(' · ', nullif(source, ''), nullif(medium, ''), nullif(campaign, ''))
  end
  from normalized;
$function$;

create or replace function public.prepass_classify_traffic_type(
  p_utm_source text,
  p_utm_medium text,
  p_campaign text,
  p_paid_evidence boolean
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when coalesce(p_paid_evidence, false) then 'Paid Traffic'
    when lower(btrim(coalesce(p_utm_medium, ''))) in (
      'cpc', 'ppc', 'paid', 'paid social', 'paid_social', 'pmax', 'performance max',
      'performancemax', 'lead_form', 'display', 'retargeting', 'search'
    ) then 'Paid Traffic'
    when lower(btrim(coalesce(p_utm_medium, ''))) like '%pixel%' then 'Paid Traffic'
    when lower(btrim(coalesce(p_utm_source, ''))) in (
      'facebook', 'fb', 'instagram', 'ig', 'facebook_mobile_feed'
    ) and lower(btrim(coalesce(p_campaign, ''))) not in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null')
      then 'Paid Traffic'
    when lower(btrim(coalesce(p_utm_source, ''))) not in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null')
      or lower(btrim(coalesce(p_utm_medium, ''))) not in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null')
      or lower(btrim(coalesce(p_campaign, ''))) not in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null')
      then 'Organic'
    else 'Unidentified'
  end;
$function$;

revoke all on function public.prepass_canonical_fleet_size(text) from public, anon, authenticated;
revoke all on function public.prepass_classify_origin(text, text, text, text) from public, anon, authenticated;
revoke all on function public.prepass_classify_traffic_type(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.prepass_canonical_fleet_size(text) to service_role;
grant execute on function public.prepass_classify_origin(text, text, text, text) to service_role;
grant execute on function public.prepass_classify_traffic_type(text, text, text, boolean) to service_role;

create table if not exists public.prepass_marketo_fleet_enrichment (
  id_marketo text primary key,
  fleet_size text check (fleet_size is null or fleet_size in ('101-500', '500+')),
  fleet_size_source text,
  raw_fleet_value text,
  date_lead timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  original_utm_source text,
  original_utm_medium text,
  original_utm_campaign text,
  fetched_at timestamptz not null default now()
);

alter table public.prepass_marketo_fleet_enrichment
  add column if not exists date_lead timestamptz,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists original_utm_source text,
  add column if not exists original_utm_medium text,
  add column if not exists original_utm_campaign text;

alter table public.prepass_marketo_fleet_enrichment enable row level security;
revoke all on public.prepass_marketo_fleet_enrichment from public, anon, authenticated;
grant select, insert, update, delete on public.prepass_marketo_fleet_enrichment to service_role;

create table if not exists public.prepass_qualified_fleet_leads (
  id_marketo text not null,
  contact_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  fleet_size text not null check (fleet_size in ('101-500', '500+')),
  latest_stage text not null check (latest_stage in ('Lead', 'MQL', 'SQL', 'WON')),
  date_lead timestamptz,
  date_mql timestamptz,
  date_sql timestamptz,
  date_won timestamptz,
  origin_category text not null,
  traffic_type text not null check (traffic_type in ('Paid Traffic', 'Organic', 'Unidentified')),
  source_products text not null,
  original_campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_campaign_id text,
  utm_adset_id text,
  utm_ad_id text,
  fbclid text,
  landing_page_url text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (id_marketo)
);

alter table public.prepass_qualified_fleet_leads
  add column if not exists date_lead timestamptz,
  add column if not exists traffic_type text;
update public.prepass_qualified_fleet_leads
set traffic_type = public.prepass_classify_traffic_type(utm_source, utm_medium, utm_campaign, false)
where traffic_type is null;
alter table public.prepass_qualified_fleet_leads
  alter column traffic_type set not null;
alter table public.prepass_qualified_fleet_leads
  drop constraint if exists prepass_qualified_fleet_leads_origin_category_check;
alter table public.prepass_qualified_fleet_leads
  drop constraint if exists prepass_qualified_fleet_leads_traffic_type_check;
alter table public.prepass_qualified_fleet_leads
  add constraint prepass_qualified_fleet_leads_traffic_type_check
  check (traffic_type in ('Paid Traffic', 'Organic', 'Unidentified'));

create index if not exists prepass_qualified_fleet_leads_lead_idx on public.prepass_qualified_fleet_leads(date_lead);
create index if not exists prepass_qualified_fleet_leads_mql_idx on public.prepass_qualified_fleet_leads(date_mql);
create index if not exists prepass_qualified_fleet_leads_sql_idx on public.prepass_qualified_fleet_leads(date_sql);
create index if not exists prepass_qualified_fleet_leads_won_idx on public.prepass_qualified_fleet_leads(date_won);
create index if not exists prepass_qualified_fleet_leads_origin_idx on public.prepass_qualified_fleet_leads(origin_category);
create index if not exists prepass_qualified_fleet_leads_traffic_idx on public.prepass_qualified_fleet_leads(traffic_type);

alter table public.prepass_qualified_fleet_leads enable row level security;
revoke all on public.prepass_qualified_fleet_leads from public, anon, authenticated;
grant select, insert, update, delete on public.prepass_qualified_fleet_leads to service_role;

create or replace function public.prepass_refresh_qualified_fleet_leads()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('prepass_refresh_qualified_fleet_leads'));
  drop table if exists pg_temp.tmp_prepass_qualified_fleet_leads;

  create temporary table tmp_prepass_qualified_fleet_leads on commit drop as
  with fleet_candidates as (
    select id_marketo, fleet_size, updated_at as observed_at, 'Google MQL'::text as source_name from public."Google MQL"
    union all select id_marketo, fleet_size, updated_at, 'Meta MQL' from public."Meta MQL"
    union all select id_marketo, fleet_size, updated_at, 'leads_abm' from public.leads_abm
    union all select id_marketo, fleet_size, updated_at, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, fleet_size, updated_at, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, fleet_size, updated_at, 'campaign_leads' from public.campaign_leads
    union all select id_marketo, fleet_size, updated_at, 'prepass_abm_form_submissions' from public.prepass_abm_form_submissions
    union all select id_marketo, fleet_size, updated_at, 'prepass_smb_form_submissions' from public.prepass_smb_form_submissions
    union all select id_marketo, fleet_size, fetched_at, 'prepass_marketo_fleet_enrichment' from public.prepass_marketo_fleet_enrichment
  ),
  normalized_fleet as (
    select nullif(btrim(id_marketo), '') as id_marketo,
      public.prepass_canonical_fleet_size(fleet_size) as fleet_size,
      observed_at, source_name
    from fleet_candidates
    where nullif(btrim(id_marketo), '') is not null
  ),
  qualified_ids as (
    select id_marketo,
      case when bool_or(fleet_size = '500+') then '500+' else '101-500' end as fleet_size
    from normalized_fleet
    where fleet_size is not null
    group by id_marketo
  ),
  profile_candidates as (
    select id_marketo, first_name, last_name, email, phone, updated_at as observed_at, 'Google MQL'::text source_name from public."Google MQL"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'Google SQL' from public."Google SQL"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'Google WON' from public."Google WON"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'Meta MQL' from public."Meta MQL"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'Meta SQL' from public."Meta SQL"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'Meta WON' from public."Meta WON"
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'leads_abm' from public.leads_abm
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, first_name, last_name, email, phone, updated_at, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, first_name, last_name, email, phone, updated_at at time zone 'UTC', 'calls' from public.calls
    union all select id_marketo, first_name, last_name, email, phone, updated_at at time zone 'UTC', 'calls_won' from public.calls_won
    union all select id_marketo, "firstName", "lastName", email, phone, "updatedAt", 'enrollment' from public.enrollment
    union all select id_marketo, first_name, last_name, email, phone, updated_at at time zone 'UTC', 'enrollment_won' from public.enrollment_won
    union all select id_marketo, null, null, email, phone, updated_at, 'campaign_leads' from public.campaign_leads
    union all select id_marketo, first_name, last_name, email, phone, lead_created_at at time zone 'UTC', 'master_won_leads_details' from public.master_won_leads_details
  ),
  best_profile as (
    select distinct on (p.id_marketo)
      p.id_marketo, p.first_name, p.last_name, p.email, p.phone
    from profile_candidates p
    join qualified_ids q using (id_marketo)
    order by p.id_marketo,
      ((nullif(btrim(p.email), '') is not null)::int
       + (nullif(btrim(p.phone), '') is not null)::int
       + (nullif(btrim(p.first_name), '') is not null)::int
       + (nullif(btrim(p.last_name), '') is not null)::int) desc,
      p.observed_at desc nulls last, p.source_name
  ),
  attribution_candidates as (
    select id_marketo, original_campaign, utm_campaign, utm_source,
      coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')) utm_medium,
      utm_content, utm_term, null::text utm_campaign_id, null::text utm_adset_id, null::text utm_ad_id,
      null::text fbclid, null::text landing_page_url, updated_at observed_at, false paid_evidence, 'Google MQL'::text source_name
    from public."Google MQL"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, null, null, null, fbclid, null, updated_at, false, 'Google SQL' from public."Google SQL"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, null, null, null, fbclid, null, updated_at, false, 'Google WON' from public."Google WON"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, null, updated_at, (nullif(btrim(utm_campaign_id), '') is not null or nullif(btrim(utm_adset_id), '') is not null or nullif(btrim(utm_ad_id), '') is not null), 'Meta MQL' from public."Meta MQL"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, null, updated_at, (nullif(btrim(utm_campaign_id), '') is not null or nullif(btrim(utm_adset_id), '') is not null or nullif(btrim(utm_ad_id), '') is not null), 'Meta SQL' from public."Meta SQL"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, null, updated_at, (nullif(btrim(utm_campaign_id), '') is not null or nullif(btrim(utm_adset_id), '') is not null or nullif(btrim(utm_ad_id), '') is not null), 'Meta WON' from public."Meta WON"
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, landing_page_url, updated_at, false, 'leads_abm' from public.leads_abm
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, landing_page_url, updated_at, false, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, landing_page_url, updated_at, false, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, null, utm_campaign, utm_source, utm_medium, utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, null, landing_page, updated_at, false, 'prepass_abm_form_submissions' from public.prepass_abm_form_submissions
    union all select id_marketo, null, utm_campaign, utm_source, utm_medium, utm_content, utm_term, utm_campaign_id, utm_adset_id, utm_ad_id, null, landing_page, updated_at, false, 'prepass_smb_form_submissions' from public.prepass_smb_form_submissions
    union all select id_marketo, original_utm_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, null, null, null, fbclid, null, updated_at at time zone 'UTC', false, 'calls' from public.calls
    union all select id_marketo, original_utm_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, null, null, null, fbclid, null, updated_at at time zone 'UTC', false, 'calls_won' from public.calls_won
    union all select id_marketo, originalutmcampaign, utmcampaign, utmsource, coalesce(nullif(btrim(utmmedium), ''), nullif(btrim(originalutmmedium), '')), utmcontent, utmterm, null, null, null, "FBCLID", null, "updatedAt", false, 'enrollment' from public.enrollment
    union all select id_marketo, original_campaign, utm_campaign, utm_source, coalesce(nullif(btrim(utm_medium), ''), nullif(btrim(original_utm_medium), '')), utm_content, utm_term, null, null, null, fbclid, null, updated_at at time zone 'UTC', false, 'enrollment_won' from public.enrollment_won
    union all select id_marketo, null, utm_campaign, null, null, null, null, utm_campaign_id, utm_adset_id, utm_ad_id, null, null, updated_at, true, 'campaign_leads' from public.campaign_leads
    union all select id_marketo, original_utm_campaign,
      coalesce(nullif(btrim(original_utm_campaign), ''), nullif(btrim(utm_campaign), '')),
      coalesce(nullif(btrim(original_utm_source), ''), nullif(btrim(utm_source), '')),
      coalesce(nullif(btrim(original_utm_medium), ''), nullif(btrim(utm_medium), '')),
      null, null, null, null, null, null, null, fetched_at, false, 'prepass_marketo_fleet_enrichment'
    from public.prepass_marketo_fleet_enrichment
  ),
  best_attribution as (
    select distinct on (a.id_marketo) a.*
    from attribution_candidates a
    join qualified_ids q using (id_marketo)
    order by a.id_marketo,
      case a.source_name
        when 'prepass_marketo_fleet_enrichment' then 100
        when 'prepass_abm_form_submissions' then 80
        when 'prepass_smb_form_submissions' then 80
        when 'leads_abm' then 60
        when 'leads_mobileapp' then 60
        when 'leads_fd360' then 60
        when 'calls' then 50
        when 'calls_won' then 50
        when 'enrollment' then 50
        when 'enrollment_won' then 50
        when 'campaign_leads' then 20
        else 40
      end desc,
      ((nullif(btrim(a.utm_source), '') is not null)::int * 4
       + (nullif(btrim(a.utm_medium), '') is not null)::int * 4
       + (nullif(btrim(a.utm_campaign), '') is not null)::int * 2
       + (nullif(btrim(a.original_campaign), '') is not null)::int
       + (nullif(btrim(a.utm_campaign_id), '') is not null)::int * 2
       + (nullif(btrim(a.utm_adset_id), '') is not null)::int
       + (nullif(btrim(a.utm_ad_id), '') is not null)::int) desc,
      a.observed_at desc nulls last, a.source_name
  ),
  stage_events as (
    select id_marketo, 'MQL'::text stage, date_mql::date::timestamp at time zone 'UTC' event_at, 'Google MQL'::text source_name from public."Google MQL" where nullif(btrim(date_mql), '') is not null
    union all select id_marketo, 'MQL', date_mql::date::timestamp at time zone 'UTC', 'Meta MQL' from public."Meta MQL" where nullif(btrim(date_mql), '') is not null
    union all select id_marketo, 'SQL', date_sql::date::timestamp at time zone 'UTC', 'Google SQL' from public."Google SQL" where nullif(btrim(date_sql), '') is not null
    union all select id_marketo, 'SQL', date_sql::date::timestamp at time zone 'UTC', 'Meta SQL' from public."Meta SQL" where nullif(btrim(date_sql), '') is not null
    union all select id_marketo, 'WON', date_won::date::timestamp at time zone 'UTC', 'Google WON' from public."Google WON" where nullif(btrim(date_won), '') is not null
    union all select id_marketo, 'WON', date_won::date::timestamp at time zone 'UTC', 'Meta WON' from public."Meta WON" where nullif(btrim(date_won), '') is not null
    union all select id_marketo, 'MQL', date_mql, 'leads_abm' from public.leads_abm
    union all select id_marketo, 'SQL', date_sql, 'leads_abm' from public.leads_abm
    union all select id_marketo, 'WON', date_closed_won, 'leads_abm' from public.leads_abm
    union all select id_marketo, 'MQL', date_mql, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, 'SQL', date_sql, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, 'WON', date_closed_won, 'leads_mobileapp' from public.leads_mobileapp
    union all select id_marketo, 'MQL', date_mql, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, 'SQL', date_sql, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, 'WON', date_closed_won, 'leads_fd360' from public.leads_fd360
    union all select id_marketo, 'MQL', date_mql at time zone 'UTC', 'calls' from public.calls
    union all select id_marketo, 'SQL', date_sql at time zone 'UTC', 'calls' from public.calls
    union all select id_marketo, 'WON', date_closed_won at time zone 'UTC', 'calls' from public.calls
    union all select id_marketo, 'MQL', date_mql at time zone 'UTC', 'calls_won' from public.calls_won
    union all select id_marketo, 'SQL', date_sql at time zone 'UTC', 'calls_won' from public.calls_won
    union all select id_marketo, 'WON', date_closed_won at time zone 'UTC', 'calls_won' from public.calls_won
    union all select id_marketo, 'MQL', date_mql at time zone 'UTC', 'enrollment' from public.enrollment
    union all select id_marketo, 'SQL', date_sql at time zone 'UTC', 'enrollment' from public.enrollment
    union all select id_marketo, 'WON', "dateClosedWon", 'enrollment' from public.enrollment
    union all select id_marketo, 'MQL', date_mql at time zone 'UTC', 'enrollment_won' from public.enrollment_won
    union all select id_marketo, 'SQL', date_sql at time zone 'UTC', 'enrollment_won' from public.enrollment_won
    union all select id_marketo, 'WON', date_won at time zone 'UTC', 'enrollment_won' from public.enrollment_won
  ),
  lead_events as (
    select id_marketo, date_lead event_at, 'prepass_marketo_fleet_enrichment'::text source_name
    from public.prepass_marketo_fleet_enrichment
    where date_lead is not null
  ),
  lead_lifecycle as (
    select id_marketo, min(event_at) as date_lead
    from lead_events
    where nullif(btrim(id_marketo), '') is not null and event_at is not null
    group by id_marketo
  ),
  stage_lifecycle as (
    select id_marketo,
      min(event_at) filter (where stage = 'MQL') as date_mql,
      min(event_at) filter (where stage = 'SQL') as date_sql,
      min(event_at) filter (where stage = 'WON') as date_won
    from stage_events
    where nullif(btrim(id_marketo), '') is not null and event_at is not null
    group by id_marketo
  ),
  lifecycle as (
    select q.id_marketo,
      le.date_lead,
      se.date_mql,
      se.date_sql,
      se.date_won
    from qualified_ids q
    left join lead_lifecycle le using (id_marketo)
    left join stage_lifecycle se using (id_marketo)
  ),
  lineage_rows as (
    select id_marketo, source_name from normalized_fleet where fleet_size is not null
    union select id_marketo, source_name from profile_candidates
    union select id_marketo, source_name from attribution_candidates
    union select id_marketo, source_name from stage_events where event_at is not null
    union select id_marketo, source_name from lead_events where event_at is not null
  ),
  lineage as (
    select id_marketo, string_agg(distinct source_name, ', ' order by source_name) source_products
    from lineage_rows
    group by id_marketo
  ),
  freshness as (
    select id_marketo, max(observed_at) source_updated_at
    from (
      select id_marketo, observed_at from normalized_fleet
      union all select id_marketo, observed_at from profile_candidates
      union all select id_marketo, observed_at from attribution_candidates
    ) x
    group by id_marketo
  )
  select
    q.id_marketo,
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') contact_name,
    p.first_name, p.last_name, p.email, p.phone,
    q.fleet_size,
    case when lc.date_won is not null then 'WON'
         when lc.date_sql is not null then 'SQL'
         when lc.date_mql is not null then 'MQL'
         else 'Lead' end latest_stage,
    lc.date_lead, lc.date_mql, lc.date_sql, lc.date_won,
    public.prepass_classify_origin(a.utm_source, a.utm_medium,
      coalesce(nullif(btrim(a.utm_campaign), ''), nullif(btrim(a.original_campaign), '')), a.fbclid) origin_category,
    public.prepass_classify_traffic_type(a.utm_source, a.utm_medium,
      coalesce(nullif(btrim(a.utm_campaign), ''), nullif(btrim(a.original_campaign), '')), a.paid_evidence) traffic_type,
    coalesce(li.source_products, 'prepass_marketo_fleet_enrichment') source_products,
    a.original_campaign, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term,
    a.utm_campaign_id, a.utm_adset_id, a.utm_ad_id, a.fbclid, a.landing_page_url,
    f.source_updated_at, now() synced_at
  from qualified_ids q
  left join best_profile p using (id_marketo)
  left join lifecycle lc using (id_marketo)
  left join best_attribution a using (id_marketo)
  left join lineage li using (id_marketo)
  left join freshness f using (id_marketo);

  delete from public.prepass_qualified_fleet_leads;
  insert into public.prepass_qualified_fleet_leads (
    id_marketo, contact_name, first_name, last_name, email, phone, fleet_size, latest_stage,
    date_lead, date_mql, date_sql, date_won, origin_category, traffic_type, source_products,
    original_campaign, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    utm_campaign_id, utm_adset_id, utm_ad_id, fbclid, landing_page_url,
    source_updated_at, synced_at
  ) select * from tmp_prepass_qualified_fleet_leads;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.prepass_refresh_qualified_fleet_leads() from public, anon, authenticated;
grant execute on function public.prepass_refresh_qualified_fleet_leads() to service_role;

-- The canonical table refreshes once after the daily Marketo batch. Remove every
-- legacy per-source trigger so unrelated source writes cannot rebuild this table.
do $block$
declare
  v_trigger record;
begin
  for v_trigger in
    select n.nspname, c.relname, t.tgname
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and t.tgname in (
        'prepass_refresh_qualified_fleet_leads_dml',
        'prepass_refresh_qualified_fleet_leads_truncate'
      )
  loop
    execute format('drop trigger if exists %I on %I.%I',
      v_trigger.tgname, v_trigger.nspname, v_trigger.relname);
  end loop;
end;
$block$;

drop function if exists public.prepass_refresh_qualified_fleet_leads_trigger();

drop function if exists public.prepass_qualified_fleet_origin_funnel(date, date);
create function public.prepass_qualified_fleet_origin_funnel(
  p_start date,
  p_end date
)
returns table(origin text, traffic_type text, leads bigint, mqls bigint, sqls bigint, won bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with bounds as (
    select greatest(p_start, date_trunc('year', current_date)::date) start_date,
      least(p_end, (date_trunc('year', current_date) + interval '1 year - 1 day')::date) end_date
  ), period_contacts as (
    select l.*, b.start_date, b.end_date
    from public.prepass_qualified_fleet_leads l
    cross join bounds b
    where (l.date_lead at time zone 'UTC')::date between b.start_date and b.end_date
       or (l.date_mql at time zone 'UTC')::date between b.start_date and b.end_date
       or (l.date_sql at time zone 'UTC')::date between b.start_date and b.end_date
       or (l.date_won at time zone 'UTC')::date between b.start_date and b.end_date
  ), aggregated as (
    select l.origin_category origin, l.traffic_type,
      count(l.id_marketo)::bigint leads,
      count(l.id_marketo) filter (where (l.date_mql at time zone 'UTC')::date between l.start_date and l.end_date)::bigint mqls,
      count(l.id_marketo) filter (where (l.date_sql at time zone 'UTC')::date between l.start_date and l.end_date)::bigint sqls,
      count(l.id_marketo) filter (where (l.date_won at time zone 'UTC')::date between l.start_date and l.end_date)::bigint won
    from period_contacts l
    group by l.origin_category, l.traffic_type
  )
  select origin, traffic_type, leads, mqls, sqls, won
  from aggregated
  where leads > 0 or mqls > 0 or sqls > 0 or won > 0
  order by greatest(leads, mqls, sqls, won) desc, (leads + mqls + sqls + won) desc, origin;
$function$;

revoke all on function public.prepass_qualified_fleet_origin_funnel(date, date) from public, anon, authenticated;
grant execute on function public.prepass_qualified_fleet_origin_funnel(date, date) to service_role;

select public.prepass_refresh_qualified_fleet_leads();
notify pgrst, 'reload schema';

commit;
