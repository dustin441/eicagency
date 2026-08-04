create or replace function public.spartaco_brand_health_rollup(
  p_start date,
  p_end date
)
returns table (
  date date,
  source text,
  brand text,
  product text,
  monday_product text,
  parent_product text,
  campaign_name text,
  email_name text,
  ad_channel text,
  ad_origem text,
  ad_impressions numeric,
  ad_clicks numeric,
  ad_cost numeric,
  ad_conversions numeric,
  ad_purchases numeric,
  ad_revenue numeric,
  ga4_sessions numeric,
  ga4_engaged_sessions numeric,
  ga4_pageviews numeric,
  ga4_total_users numeric,
  ga4_purchases numeric,
  ga4_total_revenue numeric,
  ga4_add_to_carts numeric,
  ga4_checkouts numeric,
  email_total_sent numeric,
  email_opens numeric,
  email_clicks numeric,
  gsc_clicks numeric,
  gsc_impressions numeric,
  gsc_position numeric,
  gsc_query text,
  page_path text,
  social_impressions numeric,
  social_engagement numeric,
  social_interactions numeric,
  social_post_id text,
  ga4_source text,
  ga4_medium text,
  ga4_default_channel_group text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('month', smp.date)::date as date,
    smp.source,
    smp.brand,
    smp.product,
    smp.monday_product,
    smp.parent_product,
    smp.campaign_name,
    smp.email_name,
    smp.ad_channel,
    smp.ad_origem,
    sum(coalesce(smp.ad_impressions, 0))::numeric as ad_impressions,
    sum(coalesce(smp.ad_clicks, 0))::numeric as ad_clicks,
    sum(coalesce(smp.ad_cost, 0))::numeric as ad_cost,
    sum(coalesce(smp.ad_conversions, 0))::numeric as ad_conversions,
    sum(coalesce(smp.ad_purchases, 0))::numeric as ad_purchases,
    sum(coalesce(smp.ad_revenue, 0))::numeric as ad_revenue,
    sum(coalesce(smp.ga4_sessions, 0))::numeric as ga4_sessions,
    sum(coalesce(smp.ga4_engaged_sessions, 0))::numeric as ga4_engaged_sessions,
    sum(coalesce(smp.ga4_pageviews, 0))::numeric as ga4_pageviews,
    sum(coalesce(smp.ga4_total_users, 0))::numeric as ga4_total_users,
    sum(coalesce(smp.ga4_purchases, 0))::numeric as ga4_purchases,
    sum(coalesce(smp.ga4_total_revenue, 0))::numeric as ga4_total_revenue,
    sum(coalesce(smp.ga4_add_to_carts, 0))::numeric as ga4_add_to_carts,
    sum(coalesce(smp.ga4_checkouts, 0))::numeric as ga4_checkouts,
    sum(coalesce(smp.email_total_sent, 0))::numeric as email_total_sent,
    sum(coalesce(smp.email_opens, 0))::numeric as email_opens,
    sum(coalesce(smp.email_clicks, 0))::numeric as email_clicks,
    sum(coalesce(smp.gsc_clicks, 0))::numeric as gsc_clicks,
    sum(coalesce(smp.gsc_impressions, 0))::numeric as gsc_impressions,
    case
      when sum(coalesce(smp.gsc_impressions, 0)) > 0 then
        sum(coalesce(smp.gsc_position, 0) * coalesce(smp.gsc_impressions, 0))
          / sum(coalesce(smp.gsc_impressions, 0))
      else 0
    end::numeric as gsc_position,
    null::text as gsc_query,
    smp.page_path,
    sum(coalesce(smp.social_impressions, 0))::numeric as social_impressions,
    sum(coalesce(smp.social_engagement, 0))::numeric as social_engagement,
    sum(coalesce(smp.social_interactions, 0))::numeric as social_interactions,
    null::text as social_post_id,
    smp.ga4_source,
    smp.ga4_medium,
    smp.ga4_default_channel_group
  from public.spartaco_master_products smp
  where smp.date >= p_start
    and smp.date <= p_end
    and p_end >= p_start
    and p_end < (p_start + interval '25 months')
    and (smp.product <> 'Other' or smp.source in ('ads', 'email'))
  group by
    date_trunc('month', smp.date)::date,
    smp.source,
    smp.brand,
    smp.product,
    smp.monday_product,
    smp.parent_product,
    smp.campaign_name,
    smp.email_name,
    smp.ad_channel,
    smp.ad_origem,
    smp.page_path,
    smp.ga4_source,
    smp.ga4_medium,
    smp.ga4_default_channel_group
  order by 1, 3, 4, 2;
$$;

revoke all on function public.spartaco_brand_health_rollup(date, date) from public;
revoke all on function public.spartaco_brand_health_rollup(date, date) from anon, authenticated;
grant execute on function public.spartaco_brand_health_rollup(date, date) to service_role;

create or replace function public.spartaco_brand_health_rollup_json(
  p_start date,
  p_end date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(rollup)), '[]'::jsonb)
  from public.spartaco_brand_health_rollup(p_start, p_end) rollup;
$$;

revoke all on function public.spartaco_brand_health_rollup_json(date, date) from public;
revoke all on function public.spartaco_brand_health_rollup_json(date, date) from anon, authenticated;
grant execute on function public.spartaco_brand_health_rollup_json(date, date) to service_role;

create or replace function public.spartaco_brand_health_totals_rollup(
  p_start date,
  p_end date
)
returns table (
  date date,
  source text,
  brand text,
  product text,
  monday_product text,
  parent_product text,
  campaign_name text,
  email_name text,
  ad_channel text,
  ad_origem text,
  ad_impressions numeric,
  ad_clicks numeric,
  ad_cost numeric,
  ad_conversions numeric,
  ad_purchases numeric,
  ad_revenue numeric,
  ga4_sessions numeric,
  ga4_engaged_sessions numeric,
  ga4_pageviews numeric,
  ga4_total_users numeric,
  ga4_purchases numeric,
  ga4_total_revenue numeric,
  ga4_add_to_carts numeric,
  ga4_checkouts numeric,
  email_total_sent numeric,
  email_opens numeric,
  email_clicks numeric,
  gsc_clicks numeric,
  gsc_impressions numeric,
  gsc_position numeric,
  gsc_query text,
  page_path text,
  social_impressions numeric,
  social_engagement numeric,
  social_interactions numeric,
  social_post_id text,
  ga4_source text,
  ga4_medium text,
  ga4_default_channel_group text
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      smp.*,
      case
        when smp.brand = 'Huskie' and smp.product in ('Pole Puller', 'Pole Maintenance') then 'Tiiger'
        when smp.product = 'Other' and (
          (smp.source = 'ads' and lower(coalesce(smp.campaign_name, '')) like '%tiiger%')
          or (smp.source = 'email' and lower(coalesce(smp.email_name, '')) like any (array['%tiiger%', '%pole puller%', '%pole maintenance%', '%utility pole%']))
          or (smp.source = 'ga4' and lower(coalesce(smp.page_path, '')) like any (array['%utility-pole-maintenance%', '%pole-maintenance%']))
        ) then 'Tiiger'
        when smp.brand is null and smp.source = 'email' then
          case
            when lower(coalesce(smp.email_name, '')) like '%ronin%' then 'Ronin'
            when lower(coalesce(smp.email_name, '')) like '%huskie%' then 'Huskie'
            when lower(coalesce(smp.email_name, '')) like '%jameson%' then 'Jameson'
            when lower(coalesce(smp.email_name, '')) like any (array['%tiiger%', '%pole puller%', '%pole maintenance%', '%utility pole%']) then 'Tiiger'
            when smp.product in ('Material Lifting', 'Ascenders') then 'Ronin'
            when smp.product in ('Pole Maintenance', 'Pole Puller') then 'Tiiger'
            when smp.product in ('Cut/Crimp Tools', 'New Cutting Tools', 'Battery Tools: SLA 725', 'Huskie 60-100 Ton Presses') then 'Huskie'
            when smp.product in ('Hot-Stick', 'Tree Tools', 'Aluminum Poles', 'Rodders', 'Fiber Driver', 'Fiber Drivers', 'Cable Benders', 'Vine Pullers', 'Little Buddy', 'Long Handled Tools') then 'Jameson'
            else 'Unassigned'
          end
        else smp.brand
      end as health_brand
    from public.spartaco_master_products smp
    where smp.date >= p_start
      and smp.date <= p_end
      and p_end >= p_start
      and p_end < (p_start + interval '25 months')
      and (smp.brand is not null or smp.source = 'email')
  )
  select
    date_trunc('month', normalized.date)::date as date,
    normalized.source,
    normalized.health_brand as brand,
    'Brand'::text as product,
    'Brand'::text as monday_product,
    'Brand'::text as parent_product,
    null::text as campaign_name,
    null::text as email_name,
    null::text as ad_channel,
    null::text as ad_origem,
    sum(coalesce(normalized.ad_impressions, 0))::numeric,
    sum(coalesce(normalized.ad_clicks, 0))::numeric,
    sum(coalesce(normalized.ad_cost, 0))::numeric,
    sum(coalesce(normalized.ad_conversions, 0))::numeric,
    sum(coalesce(normalized.ad_purchases, 0))::numeric,
    sum(coalesce(normalized.ad_revenue, 0))::numeric,
    sum(coalesce(normalized.ga4_sessions, 0))::numeric,
    sum(coalesce(normalized.ga4_engaged_sessions, 0))::numeric,
    sum(coalesce(normalized.ga4_pageviews, 0))::numeric,
    sum(coalesce(normalized.ga4_total_users, 0))::numeric,
    sum(coalesce(normalized.ga4_purchases, 0))::numeric,
    sum(coalesce(normalized.ga4_total_revenue, 0))::numeric,
    sum(coalesce(normalized.ga4_add_to_carts, 0))::numeric,
    sum(coalesce(normalized.ga4_checkouts, 0))::numeric,
    sum(coalesce(normalized.email_total_sent, 0))::numeric,
    sum(coalesce(normalized.email_opens, 0))::numeric,
    sum(coalesce(normalized.email_clicks, 0))::numeric,
    sum(coalesce(normalized.gsc_clicks, 0))::numeric,
    sum(coalesce(normalized.gsc_impressions, 0))::numeric,
    case
      when sum(coalesce(normalized.gsc_impressions, 0)) > 0 then
        sum(coalesce(normalized.gsc_position, 0) * coalesce(normalized.gsc_impressions, 0))
          / sum(coalesce(normalized.gsc_impressions, 0))
      else 0
    end::numeric as gsc_position,
    null::text as gsc_query,
    null::text as page_path,
    sum(coalesce(normalized.social_impressions, 0))::numeric,
    sum(coalesce(normalized.social_engagement, 0))::numeric,
    sum(coalesce(normalized.social_interactions, 0))::numeric,
    null::text as social_post_id,
    null::text as ga4_source,
    null::text as ga4_medium,
    normalized.ga4_default_channel_group
  from normalized
  group by
    date_trunc('month', normalized.date)::date,
    normalized.source,
    normalized.health_brand,
    normalized.ga4_default_channel_group
  order by 1, 3, 2, 39;
$$;

revoke all on function public.spartaco_brand_health_totals_rollup(date, date) from public;
revoke all on function public.spartaco_brand_health_totals_rollup(date, date) from anon, authenticated;
grant execute on function public.spartaco_brand_health_totals_rollup(date, date) to service_role;

create or replace function public.spartaco_brand_health_totals_rollup_json(
  p_start date,
  p_end date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(rollup)), '[]'::jsonb)
  from public.spartaco_brand_health_totals_rollup(p_start, p_end) rollup;
$$;

revoke all on function public.spartaco_brand_health_totals_rollup_json(date, date) from public;
revoke all on function public.spartaco_brand_health_totals_rollup_json(date, date) from anon, authenticated;
grant execute on function public.spartaco_brand_health_totals_rollup_json(date, date) to service_role;
