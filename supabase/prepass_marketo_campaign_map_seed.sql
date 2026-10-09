begin;
select pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));

with unique_mmp_identity as (
  select
    platform,
    regexp_replace(lower(coalesce(campaign_name,'')),'[^a-z0-9]','','g') campaign_norm,
    min(campaign_name) canonical_campaign,
    min(focus) focus
  from public.master_marketing_performance
  where platform in ('Google','Meta','LinkedIn','StackAdapt')
    and focus in ('SMB','ABM','FD360')
    and nullif(btrim(campaign_name),'') is not null
  group by platform,regexp_replace(lower(coalesce(campaign_name,'')),'[^a-z0-9]','','g')
  having count(distinct focus)=1
), candidates as (
  select platform,null::text campaign_id,canonical_campaign campaign_alias,canonical_campaign,focus,
    'Unique platform + normalized campaign identity from legacy reporting labels; counts were not imported.'::text evidence
  from unique_mmp_identity
  union all
  select a.platform,a.campaign_id,a.alias_name campaign_alias,m.canonical_campaign,m.focus,
    'Campaign-name alias registry joined to a unique legacy campaign focus; counts were not imported.'::text evidence
  from public.prepass_campaign_name_aliases a
  join unique_mmp_identity m
    on m.platform=a.platform
   and m.campaign_norm=regexp_replace(lower(coalesce(a.canonical_name,'')),'[^a-z0-9]','','g')
  where a.platform in ('Google','Meta','LinkedIn','StackAdapt')
    and nullif(btrim(a.alias_name),'') is not null
)
insert into public.prepass_marketo_campaign_map(platform,campaign_id,campaign_alias,canonical_campaign,focus,evidence)
select distinct platform,nullif(btrim(campaign_id),''),campaign_alias,canonical_campaign,focus,evidence
from candidates
on conflict do nothing;

commit;
