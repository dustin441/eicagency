-- Good Game Shopify acquisition/LTV reporting views.
-- LTV and LTV ROAS use gross order revenue (current_total).
-- Refunds remain available separately and are not subtracted from these metrics.

create or replace view public.goodgame_shopify_customer_ltv as
with customer_base as (
  select
    customer_id,
    (array_agg(order_id order by created_at, order_id))[1] as first_order_id,
    min(created_at) as first_order_at
  from public.goodgame_shopify_orders
  where customer_id is not null
  group by customer_id
), order_value as (
  select
    b.customer_id,
    coalesce(a.first_order_id, b.first_order_id) as first_order_id,
    coalesce(a.first_order_at, b.first_order_at) as first_order_at,
    coalesce(a.platform, 'unattributed') as platform,
    a.source,
    a.medium,
    a.campaign_name,
    a.campaign_id,
    a.adset_id,
    a.ad_id,
    a.account,
    a.attribution_method,
    a.confidence,
    count(o.order_id)::integer as order_count,
    coalesce(sum(o.net_revenue), 0::numeric) as lifetime_net_revenue,
    coalesce(sum(o.total_refunded), 0::numeric) as lifetime_refunds,
    coalesce(sum(o.net_revenue) filter (where o.order_id = coalesce(a.first_order_id, b.first_order_id)), 0::numeric) as first_order_net_revenue,
    coalesce(sum(o.current_total) filter (where o.created_at <= coalesce(a.first_order_at, b.first_order_at) + interval '30 days'), 0::numeric) as ltv_30,
    coalesce(sum(o.current_total) filter (where o.created_at <= coalesce(a.first_order_at, b.first_order_at) + interval '60 days'), 0::numeric) as ltv_60,
    coalesce(sum(o.current_total) filter (where o.created_at <= coalesce(a.first_order_at, b.first_order_at) + interval '90 days'), 0::numeric) as ltv_90,
    coalesce(sum(o.current_total) filter (where o.created_at <= coalesce(a.first_order_at, b.first_order_at) + interval '180 days'), 0::numeric) as ltv_180,
    coalesce(sum(o.current_total) filter (where o.created_at <= coalesce(a.first_order_at, b.first_order_at) + interval '365 days'), 0::numeric) as ltv_365,
    max(o.created_at) as last_order_at,
    coalesce(sum(o.current_total), 0::numeric) as lifetime_total_revenue,
    coalesce(sum(o.current_total) filter (where o.order_id = coalesce(a.first_order_id, b.first_order_id)), 0::numeric) as first_order_total_revenue
  from customer_base b
  left join public.goodgame_customer_acquisition a on a.customer_id = b.customer_id
  join public.goodgame_shopify_orders o on o.customer_id = b.customer_id
  group by
    b.customer_id, b.first_order_id, b.first_order_at,
    a.first_order_id, a.first_order_at, a.platform, a.source,
    a.medium, a.campaign_name, a.campaign_id, a.adset_id, a.ad_id,
    a.account, a.attribution_method, a.confidence
)
select * from order_value;

-- One row per order activity, carrying the customer's complete known Shopify history.
-- Date filters applied to activity_date select anyone who bought in the requested period,
-- while lifetime values continue to include purchases outside that period.
create or replace view public.goodgame_shopify_customer_activity as
select
  o.order_id as activity_order_id,
  o.created_at as activity_at,
  l.customer_id,
  l.platform,
  l.order_count,
  l.lifetime_total_revenue,
  l.lifetime_refunds,
  (o.created_at at time zone 'America/New_York')::date as activity_date
from public.goodgame_shopify_orders o
join public.goodgame_shopify_customer_ltv l on l.customer_id = o.customer_id;

revoke all on table public.goodgame_shopify_customer_activity from public, anon, authenticated;
grant select on table public.goodgame_shopify_customer_activity to service_role;

create or replace view public.goodgame_shopify_attribution_daily as
with customer_value as (
  select * from public.goodgame_shopify_customer_ltv
), acquisition as (
  select
    (first_order_at at time zone 'America/New_York')::date as date,
    account,
    campaign_id,
    max(campaign_name) as campaign_name,
    adset_id,
    ad_id,
    platform,
    count(*)::integer as new_customers,
    sum(first_order_net_revenue) as first_order_net_revenue,
    sum(lifetime_net_revenue) as lifetime_net_revenue,
    sum(lifetime_refunds) as lifetime_refunds,
    sum(ltv_30) as ltv_30,
    sum(ltv_60) as ltv_60,
    sum(ltv_90) as ltv_90,
    sum(ltv_180) as ltv_180,
    sum(ltv_365) as ltv_365,
    sum(first_order_total_revenue) as first_order_total_revenue,
    sum(lifetime_total_revenue) as lifetime_total_revenue
  from customer_value
  group by
    (first_order_at at time zone 'America/New_York')::date,
    account, campaign_id, adset_id, ad_id, platform
), meta as (
  select
    date,
    account,
    campaign_id,
    max(campaign_name) as campaign_name,
    adset_id,
    max(adset_name) as adset_name,
    ad_id,
    max(ad_name) as ad_name,
    sum(cost) as media_spend,
    sum(purchases) as purchases,
    sum(revenue) as revenue
  from public.goodgame_meta_ads
  group by date, account, campaign_id, adset_id, ad_id
)
select
  coalesce(m.date, a.date) as date,
  coalesce(m.account, a.account) as account,
  coalesce(m.campaign_id, a.campaign_id) as campaign_id,
  coalesce(m.campaign_name, a.campaign_name) as campaign_name,
  coalesce(m.adset_id, a.adset_id) as adset_id,
  m.adset_name,
  coalesce(m.ad_id, a.ad_id) as ad_id,
  m.ad_name,
  coalesce(a.platform, 'meta') as platform,
  coalesce(m.media_spend, 0) as media_spend,
  coalesce(a.new_customers, 0) as new_customers,
  case when coalesce(a.new_customers, 0) > 0 then m.media_spend / a.new_customers else null end as cac,
  coalesce(a.first_order_net_revenue, 0) as shopify_first_order_revenue,
  coalesce(a.lifetime_net_revenue, 0) as shopify_lifetime_net_revenue,
  coalesce(a.lifetime_refunds, 0) as shopify_lifetime_refunds,
  case when coalesce(a.new_customers, 0) > 0 then a.lifetime_net_revenue / a.new_customers else null end as average_ltv,
  case when coalesce(m.media_spend, 0) > 0 then a.lifetime_net_revenue / m.media_spend else null end as ltv_cac,
  coalesce(a.ltv_30, 0) as ltv_30_revenue,
  coalesce(a.ltv_60, 0) as ltv_60_revenue,
  coalesce(a.ltv_90, 0) as ltv_90_revenue,
  coalesce(a.ltv_180, 0) as ltv_180_revenue,
  coalesce(a.ltv_365, 0) as ltv_365_revenue,
  coalesce(m.purchases, 0) as meta_reported_purchases,
  coalesce(m.revenue, 0) as meta_reported_revenue,
  coalesce(a.first_order_total_revenue, 0) as shopify_first_order_total_revenue,
  coalesce(a.lifetime_total_revenue, 0) as shopify_lifetime_total_revenue,
  case when coalesce(a.new_customers, 0) > 0 then a.lifetime_total_revenue / a.new_customers else null end as total_average_ltv,
  case when coalesce(m.media_spend, 0) > 0 then a.lifetime_total_revenue / m.media_spend else null end as ltv_roas
from meta m
full join acquisition a
  on m.date = a.date
 and not (m.account is distinct from a.account)
 and not (m.ad_id is distinct from a.ad_id);
