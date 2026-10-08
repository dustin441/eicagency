-- Canonical PrePass leads with a reported fleet size above 100 trucks.
-- Source tables are existing Marketo-backed lead tables. One row is retained per
-- Marketo contact; MQL, SQL, and WON stay as separate event dates so dashboard
-- period filters apply to the selected stage instead of to lead creation.

begin;

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
        else medium_raw
      end as medium,
      case when lower(campaign_raw) in ('', '(none)', 'none', '(not set)', 'not set', 'unknown', 'undefined', 'null') then '' else campaign_raw end as campaign
    from raw
  )
  select case
    when source = '' and medium = '' and campaign = ''
      then 'Origin not identified'
    when lower(source) in ('direct', '(direct)', 'direct traffic') or lower(medium) = 'direct'
      then 'Direct access'
    else concat_ws(' · ', nullif(source, ''), nullif(medium, ''), nullif(campaign, ''))
  end
  from normalized;
$function$;

revoke all on function public.prepass_classify_origin(text, text, text, text) from public, anon, authenticated;
grant execute on function public.prepass_classify_origin(text, text, text, text) to service_role;

create table if not exists public.prepass_marketo_fleet_enrichment (
  id_marketo text primary key,
  fleet_size text check (fleet_size is null or fleet_size in ('101-500', '500+')),
  fleet_size_source text,
  raw_fleet_value text,
  fetched_at timestamptz not null default now()
);

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
  date_mql timestamptz,
  date_sql timestamptz,
  date_won timestamptz,
  origin_category text not null,
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

-- Earlier versions constrained origin_category to broad buckets. Detailed
-- source · medium · campaign labels require source-faithful values.
alter table public.prepass_qualified_fleet_leads
  drop constraint if exists prepass_qualified_fleet_leads_origin_category_check;

create index if not exists prepass_qualified_fleet_leads_mql_idx
  on public.prepass_qualified_fleet_leads(date_mql);
create index if not exists prepass_qualified_fleet_leads_sql_idx
  on public.prepass_qualified_fleet_leads(date_sql);
create index if not exists prepass_qualified_fleet_leads_won_idx
  on public.prepass_qualified_fleet_leads(date_won);
create index if not exists prepass_qualified_fleet_leads_origin_idx
  on public.prepass_qualified_fleet_leads(origin_category);

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

  create temporary table tmp_prepass_qualified_fleet_leads
  on commit drop
  as
  with all_leads as (
    select
      'ABM'::text as source_product,
      l.id_marketo, l.first_name, l.last_name, l.email, l.phone,
      coalesce(nullif(btrim(l.fleet_size), ''), e.fleet_size) as fleet_size,
      l.original_campaign, l.utm_campaign, l.utm_source, l.original_utm_medium, l.utm_medium,
      l.utm_content, l.utm_term, l.utm_campaign_id, l.utm_adset_id, l.utm_ad_id, l.fbclid,
      l.landing_page_url, l.date_mql, l.date_sql, l.date_closed_won as date_won, l.updated_at
    from public.leads_abm l
    left join public.prepass_marketo_fleet_enrichment e using (id_marketo)
    union all
    select
      'Mobile App',
      l.id_marketo, l.first_name, l.last_name, l.email, l.phone,
      coalesce(nullif(btrim(l.fleet_size), ''), e.fleet_size),
      l.original_campaign, l.utm_campaign, l.utm_source, l.original_utm_medium, l.utm_medium,
      l.utm_content, l.utm_term, l.utm_campaign_id, l.utm_adset_id, l.utm_ad_id, l.fbclid,
      l.landing_page_url, l.date_mql, l.date_sql, l.date_closed_won, l.updated_at
    from public.leads_mobileapp l
    left join public.prepass_marketo_fleet_enrichment e using (id_marketo)
    union all
    select
      'FD360',
      l.id_marketo, l.first_name, l.last_name, l.email, l.phone,
      coalesce(nullif(btrim(l.fleet_size), ''), e.fleet_size),
      l.original_campaign, l.utm_campaign, l.utm_source, l.original_utm_medium, l.utm_medium,
      l.utm_content, l.utm_term, l.utm_campaign_id, l.utm_adset_id, l.utm_ad_id, l.fbclid,
      l.landing_page_url, l.date_mql, l.date_sql, l.date_closed_won, l.updated_at
    from public.leads_fd360 l
    left join public.prepass_marketo_fleet_enrichment e using (id_marketo)
  ),
  qualified_ids as (
    select id_marketo
    from all_leads
    where nullif(btrim(id_marketo), '') is not null
    group by id_marketo
    having bool_or(fleet_size in ('101-500', '500+'))
  ),
  best_profile as (
    select distinct on (l.id_marketo)
      l.id_marketo, l.first_name, l.last_name, l.email, l.phone, l.fleet_size,
      l.landing_page_url
    from all_leads l
    join qualified_ids q using (id_marketo)
    order by l.id_marketo,
      (l.fleet_size in ('101-500', '500+')) desc,
      ((nullif(btrim(l.email), '') is not null)::int
        + (nullif(btrim(l.phone), '') is not null)::int
        + (nullif(btrim(l.first_name), '') is not null)::int
        + (nullif(btrim(l.last_name), '') is not null)::int) desc,
      l.updated_at desc nulls last,
      l.source_product
  ),
  best_attribution as (
    select distinct on (l.id_marketo)
      l.id_marketo, l.original_campaign, l.utm_campaign, l.utm_source,
      coalesce(nullif(btrim(l.utm_medium), ''), nullif(btrim(l.original_utm_medium), '')) as utm_medium,
      l.utm_content, l.utm_term, l.utm_campaign_id, l.utm_adset_id, l.utm_ad_id,
      l.fbclid, l.landing_page_url
    from all_leads l
    join qualified_ids q using (id_marketo)
    order by l.id_marketo,
      ((nullif(btrim(l.utm_campaign_id), '') is not null)::int * 3
        + (nullif(btrim(l.utm_campaign), '') is not null)::int * 2
        + (nullif(btrim(l.utm_source), '') is not null)::int
        + (nullif(btrim(l.utm_medium), '') is not null)::int
        + (nullif(btrim(l.original_utm_medium), '') is not null)::int
        + (nullif(btrim(l.original_campaign), '') is not null)::int) desc,
      l.updated_at desc nulls last,
      l.source_product
  ),
  lifecycle as (
    select
      l.id_marketo,
      min(l.date_mql) as date_mql,
      min(l.date_sql) as date_sql,
      min(l.date_won) as date_won,
      max(l.updated_at) as source_updated_at,
      string_agg(distinct l.source_product, ', ' order by l.source_product) as source_products
    from all_leads l
    join qualified_ids q using (id_marketo)
    group by l.id_marketo
  )
  select
    p.id_marketo,
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') as contact_name,
    p.first_name, p.last_name, p.email, p.phone,
    p.fleet_size,
    case
      when lc.date_won is not null then 'WON'
      when lc.date_sql is not null then 'SQL'
      when lc.date_mql is not null then 'MQL'
      else 'Lead'
    end as latest_stage,
    lc.date_mql, lc.date_sql, lc.date_won,
    public.prepass_classify_origin(
      a.utm_source,
      a.utm_medium,
      coalesce(nullif(btrim(a.utm_campaign), ''), nullif(btrim(a.original_campaign), '')),
      a.fbclid
    ) as origin_category,
    lc.source_products,
    a.original_campaign, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term,
    a.utm_campaign_id, a.utm_adset_id, a.utm_ad_id, a.fbclid,
    coalesce(a.landing_page_url, p.landing_page_url) as landing_page_url,
    lc.source_updated_at,
    now() as synced_at
  from best_profile p
  join lifecycle lc using (id_marketo)
  join best_attribution a using (id_marketo);

  delete from public.prepass_qualified_fleet_leads;
  insert into public.prepass_qualified_fleet_leads
  select * from tmp_prepass_qualified_fleet_leads;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.prepass_refresh_qualified_fleet_leads() from public, anon, authenticated;
grant execute on function public.prepass_refresh_qualified_fleet_leads() to service_role;

create or replace function public.prepass_refresh_qualified_fleet_leads_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.prepass_refresh_qualified_fleet_leads();
  return null;
end;
$function$;

revoke all on function public.prepass_refresh_qualified_fleet_leads_trigger() from public, anon, authenticated;

-- Marketo source syncs keep the derived table current after every batch statement.
do $block$
declare
  v_table text;
begin
  foreach v_table in array array['leads_abm', 'leads_mobileapp', 'leads_fd360']
  loop
    execute format('drop trigger if exists prepass_refresh_qualified_fleet_leads_dml on public.%I', v_table);
    execute format(
      'create trigger prepass_refresh_qualified_fleet_leads_dml after insert or update or delete on public.%I for each statement execute function public.prepass_refresh_qualified_fleet_leads_trigger()',
      v_table
    );
    execute format('drop trigger if exists prepass_refresh_qualified_fleet_leads_truncate on public.%I', v_table);
    execute format(
      'create trigger prepass_refresh_qualified_fleet_leads_truncate after truncate on public.%I for each statement execute function public.prepass_refresh_qualified_fleet_leads_trigger()',
      v_table
    );
  end loop;
end;
$block$;

create or replace function public.prepass_qualified_fleet_origin_funnel(
  p_start date,
  p_end date
)
returns table(origin text, mqls bigint, sqls bigint, won bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with bounds as (
    select
      greatest(p_start, date_trunc('year', current_date)::date) as start_date,
      least(p_end, (date_trunc('year', current_date) + interval '1 year - 1 day')::date) as end_date
  ),
  aggregated as (
    select
      l.origin_category as origin,
      count(l.id_marketo) filter (
        where (l.date_mql at time zone 'UTC')::date between b.start_date and b.end_date
      )::bigint as mqls,
      count(l.id_marketo) filter (
        where (l.date_sql at time zone 'UTC')::date between b.start_date and b.end_date
      )::bigint as sqls,
      count(l.id_marketo) filter (
        where (l.date_won at time zone 'UTC')::date between b.start_date and b.end_date
      )::bigint as won
    from public.prepass_qualified_fleet_leads l
    cross join bounds b
    group by l.origin_category
  )
  select origin, mqls, sqls, won
  from aggregated
  where mqls > 0 or sqls > 0 or won > 0
  order by greatest(mqls, sqls, won) desc, (mqls + sqls + won) desc, origin;
$function$;

revoke all on function public.prepass_qualified_fleet_origin_funnel(date, date) from public, anon, authenticated;
grant execute on function public.prepass_qualified_fleet_origin_funnel(date, date) to service_role;

select public.prepass_refresh_qualified_fleet_leads();
notify pgrst, 'reload schema';

commit;
