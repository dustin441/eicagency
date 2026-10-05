begin;
select pg_advisory_xact_lock(hashtext('prepass_utm_attribution_2026_ytd'));

create schema if not exists prepass_utm_attribution_20261003;

-- This is an evidence policy, not permission to map an aggregate row by name.
-- A row is resolved only through prepass_resolve_paid_attribution with independent
-- caller/UTM/ad evidence. The aggregate MMP source has none of those fields, so it
-- deliberately remains unchanged below.
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
 ('abm_brand_defense','Google','Search | ABM | Brand Defense','ABM',false,'Requires validated Google caller, gclid, or google paid UTM evidence'),
 ('ABMDEMANDGENEWCONVERSION','Google','ABM | Demand Gen | NEW CONVERSION','ABM',false,'Requires validated Google caller, gclid, or google paid UTM evidence'),
 ('MOBILEAPPRETARGETDEMANDGEN','Google','MOBILE APP DOWNLOAD | RETARGET | Demand Gen [SMB]','SMB',false,'Requires validated Google caller, gclid, or google paid UTM evidence'),
 ('Awareness | Display | FD360','Google','Awareness | Display | FD360','FD360',false,'Requires validated Google caller, gclid, or google paid UTM evidence'),
 ('Lead Ads | Open | FD360','Meta','Lead Ads | Open | FD360','FD360',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('120240070477450438','Meta','Lead Ads | Open | FD360','FD360',false,'Meta campaign ID plus validated Meta paid evidence'),
 ('ABM | PrePass | ABM NEW ADS | Website leads','Meta','ABM | PrePass | ABM NEW ADS | Website leads','ABM',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('boosted-posts','Meta','Boosted Posts - Bypass - Retargeting','SMB',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('Lead Ads - NEW FORM UTMS J&M New Videos | Retarget & LL | Cbo [SMB]','Meta','Lead Ads - J&M New Videos | Retarget & LL | Cbo [SMB] NEW FORM','SMB',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('Lead | VIDEOS | FD360 | Interests - NEW LP','Meta','Lead | VIDEOS | FD360 | Interests - NEW LP','FD360',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('Lead | VIDEOS | FD360 | LL SQL - NEW LP','Meta','Lead | VIDEOS | FD360 | LL SQL - NEW LP','FD360',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('Website - APP | RETARGET | Cbo [SMB]','Meta','Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB]','SMB',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB] - NEW CONVERSION','Meta','Website - MOBILE APP DOWNLOAD | RETARGET | Cbo [SMB] - NEW CONVERSION','SMB',false,'Requires validated Meta caller, fbclid, or Meta paid UTM evidence'),
 ('regInvite?utm_source=b2c,regInvite','Email','Registration invite','SMB',false,'Requires email/b2c source and email medium'),
 ('new-entrant','Email','New entrant email','SMB',false,'Requires email source and email medium'),
 ('tempRegistrationCode','Unattributed','tempRegistrationCode','SMB',true,'Technical registration code; intentionally never paid')
on conflict (source_campaign) do update set
 target_platform=excluded.target_platform,
 canonical_campaign=excluded.canonical_campaign,
 focus=excluded.focus,
 is_technical=excluded.is_technical,
 evidence=excluded.evidence,
 updated_at=now();

create or replace function public.prepass_resolve_paid_attribution(
  p_source_campaign text,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_gclid text default null,
  p_fbclid text default null,
  p_validated_caller_platform text default null
)
returns table(target_platform text, canonical_campaign text, focus text, evidence_kind text)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with candidate as (
    select m.*,
      lower(btrim(coalesce(p_utm_source, ''))) as source_value,
      lower(btrim(coalesce(p_utm_medium, ''))) as medium_value,
      nullif(lower(btrim(coalesce(p_validated_caller_platform, ''))), '') as caller_platform
    from public.prepass_utm_campaign_attribution m
    where m.source_norm = regexp_replace(lower(coalesce(p_source_campaign, '')), '[^a-z0-9]', '', 'g')
  ), proven as (
    select c.*,
      case
        when c.is_technical then 'technical-unattributed'
        when c.caller_platform = lower(c.target_platform) then 'validated-caller'
        when c.target_platform = 'Google' and nullif(btrim(coalesce(p_gclid, '')), '') is not null then 'gclid'
        when c.target_platform = 'Meta' and nullif(btrim(coalesce(p_fbclid, '')), '') is not null then 'fbclid'
        when c.target_platform = 'Google'
          and c.source_value in ('google','googleads','adwords')
          and c.medium_value in ('cpc','ppc','paid','paid_search','paid-search') then 'paid-utm'
        when c.target_platform = 'Meta'
          and c.source_value in ('meta','facebook','fb','instagram','ig')
          and c.medium_value in ('cpc','ppc','paid','paid_social','paid-social','lead_form','lead-form') then 'paid-utm'
        when c.target_platform = 'Email'
          and c.source_value in ('email','b2c')
          and c.medium_value in ('email','e-mail') then 'email-utm'
        else null
      end as proof
    from candidate c
  )
  select p.target_platform, p.canonical_campaign, p.focus, p.proof
  from proven p
  where p.proof is not null;
$$;

revoke all on function public.prepass_resolve_paid_attribution(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.prepass_resolve_paid_attribution(text,text,text,text,text,text) to service_role;
comment on function public.prepass_resolve_paid_attribution(text,text,text,text,text,text) is
  'Fail-closed PrePass attribution resolver. Campaign name selects a policy candidate but never proves paid attribution.';

-- Freeze the pre-correction source definition once. If an earlier unsafe release is
-- already present, its raw_mmp_source is the immutable pre-correction baseline.
do $$
declare v_def text;
begin
 if to_regclass('prepass_utm_attribution_20261003.raw_mmp_source') is null then
   select pg_get_viewdef('public._mmp_source'::regclass,true) into v_def;
   execute 'create view prepass_utm_attribution_20261003.raw_mmp_source as ' || v_def;
 end if;
end $$;

-- No aggregate row is renamed or moved: spend/impressions/clicks/conversions and
-- lifecycle counts cannot be safely split without row-level evidence. Future
-- event-level work must invoke the resolver above and preserve lifecycle dates.
create or replace view prepass_utm_attribution_20261003.corrected_source as
select date,platform,campaign_name,focus,spend,impressions,clicks,platform_conversions,
 mqls,sqls,closed_won,product,call_mqls,call_sqls,call_won,
 enrollment_mqls,enrollment_sqls,enrollment_won
from prepass_utm_attribution_20261003.raw_mmp_source;

-- Keep the prior internal contracts available, but fail closed. The rolling cache
-- begins on 2026-09-10 and cannot prove January-forward parity.
create or replace view prepass_utm_attribution_20261003.mapped_events as
select e.event_date,e.platform,e.campaign_name,e.focus,
 e.platform as original_platform,e.campaign_name as original_campaign_name,e.focus as original_focus,
 e.canonical_id,e.unit_id,e.route,e.stage
from prepass_reporting_20260910.forward_events_cache e;

create or replace view prepass_utm_attribution_20261003.incremental_corrections as
select null::text as date,null::text as platform,null::text as campaign_name,null::text as focus,
 null::text as stage,0::numeric as excess,0::numeric as call_excess,0::numeric as enrollment_excess
where false;

create or replace view public._mmp_source as
select date,platform,campaign_name,focus,spend,impressions,clicks,platform_conversions,
 mqls,sqls,closed_won,product,call_mqls,call_sqls,call_won,enrollment_mqls,enrollment_sqls,enrollment_won
from prepass_utm_attribution_20261003.corrected_source;

refresh materialized view public.master_marketing_performance;
commit;
