begin;
select pg_advisory_xact_lock(hashtext('prepass_utm_attribution_2026_ytd'));

create schema if not exists prepass_utm_attribution_20261003;

create table if not exists public.prepass_utm_campaign_attribution (
  source_campaign text primary key,
  source_norm text generated always as (regexp_replace(lower(source_campaign), '[^a-z0-9]', '', 'g')) stored,
  target_platform text not null check (target_platform in ('Google','Meta','Email','Unattributed')),
  canonical_campaign text not null,
  focus text not null check (focus in ('ABM','SMB','FD360')),
  is_technical boolean not null default false,
  evidence text not null,
  updated_at timestamptz not null default now(),
  unique (source_norm)
);

alter table public.prepass_utm_campaign_attribution enable row level security;
revoke all on public.prepass_utm_campaign_attribution from public, anon, authenticated;
grant select on public.prepass_utm_campaign_attribution to service_role;

insert into public.prepass_utm_campaign_attribution
  (source_campaign,target_platform,canonical_campaign,focus,is_technical,evidence)
values
 ('abm_brand_defense','Google','Search | ABM | Brand Defense','ABM',false,'Business-confirmed Search-only UTM; source google/cpc or gclid'),
 ('ABMDEMANDGENEWCONVERSION','Google','ABM | Demand Gen | NEW CONVERSION','ABM',false,'Exact normalized Google campaign match'),
 ('MOBILEAPPRETARGETDEMANDGEN','Google','MOBILE APP DOWNLOAD | RETARGET | Demand Gen [SMB]','SMB',false,'Exact normalized Google campaign match'),
 ('Awareness | Display | FD360','Google','Awareness | Display | FD360','FD360',false,'Exact Google campaign match'),
 ('Lead Ads | Open | FD360','Meta','Lead Ads | Open | FD360','FD360',false,'Exact Meta campaign match'),
 ('120240070477450438','Meta','Lead Ads | Open | FD360','FD360',false,'Exact Meta campaign ID'),
 ('ABM | PrePass | ABM NEW ADS | Website leads','Meta','ABM | PrePass | ABM NEW ADS | Website leads','ABM',false,'Exact Meta campaign match and ad-ID evidence'),
 ('boosted-posts','Meta','Boosted Posts - Bypass - Retargeting','SMB',false,'Meta ad 120215571434190438 resolves to campaign'),
 ('Lead Ads - NEW FORM UTMS J&M New Videos | Retarget & LL | Cbo [SMB]','Meta','Lead Ads - J&M New Videos | Retarget & LL | Cbo [SMB] NEW FORM','SMB',false,'Historical/current Meta campaign identity'),
 ('Lead | VIDEOS | FD360 | Interests - NEW LP','Meta','Lead | VIDEOS | FD360 | Interests - NEW LP','FD360',false,'Exact Meta campaign and ad-ID evidence'),
 ('Lead | VIDEOS | FD360 | LL SQL - NEW LP','Meta','Lead | VIDEOS | FD360 | LL SQL - NEW LP','FD360',false,'Exact Meta campaign and ad-ID evidence'),
 ('Website - APP | RETARGET | Cbo [SMB]','Meta','Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB]','SMB',false,'Historical Meta campaign; adset/term lineage'),
 ('Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB] - NEW CONVERSION','Meta','Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB] - NEW CONVERSION','SMB',false,'Exact Meta campaign match'),
 ('regInvite?utm_source=b2c,regInvite','Email','Registration invite','SMB',false,'utm_source=b2c and utm_medium=email'),
 ('new-entrant','Email','New entrant email','SMB',false,'utm_source=email'),
 ('tempRegistrationCode','Unattributed','tempRegistrationCode','SMB',true,'Technical registration code; intentionally not a traffic campaign')
on conflict (source_campaign) do update set
 target_platform=excluded.target_platform,
 canonical_campaign=excluded.canonical_campaign,
 focus=excluded.focus,
 is_technical=excluded.is_technical,
 evidence=excluded.evidence,
 updated_at=now();

-- Freeze the pre-correction source definition once. Reruns never snapshot the wrapper.
do $$
declare v_def text;
begin
 if to_regclass('prepass_utm_attribution_20261003.raw_mmp_source') is null then
   select pg_get_viewdef('public._mmp_source'::regclass,true) into v_def;
   execute 'create view prepass_utm_attribution_20261003.raw_mmp_source as ' || v_def;
 end if;
end $$;

-- The maintained cache covers the event-level period used for incremental
-- deduplication. Historical rows are still mapped from 2026-01-01 onward.
create or replace view prepass_utm_attribution_20261003.mapped_events as
select
 e.event_date,
 coalesce(m.target_platform,e.platform) as platform,
 coalesce(m.canonical_campaign,e.campaign_name) as campaign_name,
 coalesce(m.focus,e.focus) as focus,
 e.platform as original_platform,
 e.campaign_name as original_campaign_name,
 e.focus as original_focus,
 e.canonical_id,e.unit_id,e.route,e.stage
from prepass_reporting_20260910.forward_events_cache e
left join public.prepass_utm_campaign_attribution m
  on regexp_replace(lower(coalesce(e.campaign_name,'')), '[^a-z0-9]', '', 'g')=m.source_norm;

create or replace view prepass_utm_attribution_20261003.incremental_corrections as
with old_identity as (
 select event_date,canonical_id,stage,
  count(distinct row(original_platform,original_campaign_name,original_focus)) buckets
 from prepass_utm_attribution_20261003.mapped_events
 where canonical_id is not null
 group by 1,2,3
), old_groups as (
 select e.event_date,e.original_platform platform,e.original_campaign_name campaign_name,e.original_focus focus,e.canonical_id,e.stage,
  count(*)-1 excess,
  count(*) filter(where route='calls')-
   case when (array_agg(route order by case when route like 'leads_%' then 1 when route='enrollment' then 2 else 3 end,unit_id nulls last))[1]='calls' then 1 else 0 end call_excess,
  count(*) filter(where route='enrollment')-
   case when (array_agg(route order by case when route like 'leads_%' then 1 when route='enrollment' then 2 else 3 end,unit_id nulls last))[1]='enrollment' then 1 else 0 end enrollment_excess
 from prepass_utm_attribution_20261003.mapped_events e
 join old_identity i using(event_date,canonical_id,stage)
 where i.buckets=1
 group by 1,2,3,4,5,6
), old_correction as (
 select o.event_date::text date,coalesce(m.target_platform,o.platform) platform,
  coalesce(m.canonical_campaign,o.campaign_name) campaign_name,coalesce(m.focus,o.focus) focus,o.stage,
  sum(o.excess) excess,sum(o.call_excess) call_excess,sum(o.enrollment_excess) enrollment_excess
 from old_groups o
 left join public.prepass_utm_campaign_attribution m
  on regexp_replace(lower(coalesce(o.campaign_name,'')), '[^a-z0-9]', '', 'g')=m.source_norm
 group by 1,2,3,4,5
), new_identity as (
 select event_date,canonical_id,stage,count(distinct row(platform,campaign_name,focus)) buckets
 from prepass_utm_attribution_20261003.mapped_events
 where canonical_id is not null
 group by 1,2,3
), new_groups as (
 select e.event_date,e.platform,e.campaign_name,e.focus,e.canonical_id,e.stage,
  count(*)-1 excess,
  count(*) filter(where route='calls')-
   case when (array_agg(route order by case when route like 'leads_%' then 1 when route='enrollment' then 2 else 3 end,unit_id nulls last))[1]='calls' then 1 else 0 end call_excess,
  count(*) filter(where route='enrollment')-
   case when (array_agg(route order by case when route like 'leads_%' then 1 when route='enrollment' then 2 else 3 end,unit_id nulls last))[1]='enrollment' then 1 else 0 end enrollment_excess
 from prepass_utm_attribution_20261003.mapped_events e
 join new_identity i using(event_date,canonical_id,stage)
 where i.buckets=1
 group by 1,2,3,4,5,6
), new_correction as (
 select event_date::text date,platform,campaign_name,focus,stage,
  sum(excess) excess,sum(call_excess) call_excess,sum(enrollment_excess) enrollment_excess
 from new_groups group by 1,2,3,4,5
)
select n.date,n.platform,n.campaign_name,n.focus,n.stage,
 greatest(n.excess-coalesce(o.excess,0),0)::numeric excess,
 greatest(n.call_excess-coalesce(o.call_excess,0),0)::numeric call_excess,
 greatest(n.enrollment_excess-coalesce(o.enrollment_excess,0),0)::numeric enrollment_excess
from new_correction n
left join old_correction o using(date,platform,campaign_name,focus,stage)
where n.excess>coalesce(o.excess,0)
   or n.call_excess>coalesce(o.call_excess,0)
   or n.enrollment_excess>coalesce(o.enrollment_excess,0);

create or replace view prepass_utm_attribution_20261003.corrected_source as
with mapped as (
 select r.date,
  case when r.date::date>=date '2026-01-01' then coalesce(m.target_platform,r.platform) else r.platform end platform,
  case when r.date::date>=date '2026-01-01' then coalesce(m.canonical_campaign,r.campaign_name) else r.campaign_name end campaign_name,
  case when r.date::date>=date '2026-01-01' then coalesce(m.focus,r.focus) else r.focus end focus,
  r.spend,r.impressions,r.clicks,r.platform_conversions,r.mqls,r.sqls,r.closed_won,r.product,
  r.call_mqls,r.call_sqls,r.call_won,r.enrollment_mqls,r.enrollment_sqls,r.enrollment_won
 from prepass_utm_attribution_20261003.raw_mmp_source r
 left join public.prepass_utm_campaign_attribution m
  on r.date::date>=date '2026-01-01'
 and regexp_replace(lower(coalesce(r.campaign_name,'')), '[^a-z0-9]', '', 'g')=m.source_norm
), grouped as (
 select date,platform,campaign_name,focus,
  sum(spend) spend,sum(impressions) impressions,sum(clicks) clicks,sum(platform_conversions) platform_conversions,
  sum(mqls) mqls,sum(sqls) sqls,sum(closed_won) closed_won,max(product) product,
  sum(call_mqls) call_mqls,sum(call_sqls) call_sqls,sum(call_won) call_won,
  sum(enrollment_mqls) enrollment_mqls,sum(enrollment_sqls) enrollment_sqls,sum(enrollment_won) enrollment_won
 from mapped group by 1,2,3,4
), correction as (
 select date,platform,campaign_name,focus,
  sum(excess) filter(where stage='MQL') mqls,
  sum(excess) filter(where stage='SQL') sqls,
  sum(excess) filter(where stage='WON') won,
  sum(call_excess) filter(where stage='MQL') call_mqls,
  sum(call_excess) filter(where stage='SQL') call_sqls,
  sum(call_excess) filter(where stage='WON') call_won,
  sum(enrollment_excess) filter(where stage='MQL') enrollment_mqls,
  sum(enrollment_excess) filter(where stage='SQL') enrollment_sqls,
  sum(enrollment_excess) filter(where stage='WON') enrollment_won
 from prepass_utm_attribution_20261003.incremental_corrections group by 1,2,3,4
)
select g.date,g.platform,g.campaign_name,g.focus,g.spend,g.impressions,g.clicks,g.platform_conversions,
 greatest(g.mqls-coalesce(c.mqls,0),0) mqls,
 greatest(g.sqls-coalesce(c.sqls,0),0) sqls,
 greatest(g.closed_won-coalesce(c.won,0),0) closed_won,g.product,
 greatest(g.call_mqls-coalesce(c.call_mqls,0),0) call_mqls,
 greatest(g.call_sqls-coalesce(c.call_sqls,0),0) call_sqls,
 greatest(g.call_won-coalesce(c.call_won,0),0) call_won,
 greatest(g.enrollment_mqls-coalesce(c.enrollment_mqls,0),0) enrollment_mqls,
 greatest(g.enrollment_sqls-coalesce(c.enrollment_sqls,0),0) enrollment_sqls,
 greatest(g.enrollment_won-coalesce(c.enrollment_won,0),0) enrollment_won
from grouped g left join correction c using(date,platform,campaign_name,focus);

create or replace view public._mmp_source as
select date,platform,campaign_name,focus,spend,impressions,clicks,platform_conversions,
 mqls,sqls,closed_won,product,call_mqls,call_sqls,call_won,enrollment_mqls,enrollment_sqls,enrollment_won
from prepass_utm_attribution_20261003.corrected_source;

refresh materialized view public.master_marketing_performance;
commit;
