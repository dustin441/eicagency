-- PrePass campaign rename verification (read only)

select platform, count(*) as alias_rows, count(distinct campaign_id) as campaigns
from public.prepass_campaign_name_aliases
group by platform
order by platform;

-- Must return zero: every alias must point at the latest source name for its
-- immutable platform campaign ID.
with latest as (
  select distinct on (platform, campaign_id)
    platform, campaign_id, canonical_name
  from (
    select 'Meta'::text as platform, campaign_id::text as campaign_id,
           campaign_name as canonical_name, date
    from public.meta_campaigns
    union all
    select 'Google', campaign_id::text, campaign_name, date
    from public.google_campaigns
  ) source
  where campaign_id is not null and nullif(btrim(canonical_name), '') is not null
  order by platform, campaign_id, date desc, canonical_name desc
)
select a.*
from public.prepass_campaign_name_aliases a
join latest l using (platform, campaign_id)
where a.canonical_name is distinct from l.canonical_name;

-- Must return exactly one row with the new name.
select platform, campaign_id, alias_name, canonical_name
from public.prepass_campaign_name_aliases
where platform = 'Meta'
  and campaign_id = '120249350732760438'
  and alias_name = 'ABM | PrePass | Website leads - FMCSA 200+ & BEST INTERESTS';

-- Rename-capture triggers must exist before rolling upserts overwrite old names.
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'capture_prepass_campaign_name_change'
order by event_object_table;

-- Must return zero: blank identity values are rejected.
select count(*) as invalid_identity_rows
from public.prepass_campaign_name_aliases
where nullif(btrim(campaign_id), '') is null
   or nullif(btrim(alias_name), '') is null
   or nullif(btrim(canonical_name), '') is null;

-- SECURITY DEFINER functions must list only the owner and service_role.
select proname, coalesce(proacl::text, '') as acl
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where nspname = 'public'
  and proname in ('capture_prepass_campaign_name_change', 'sync_prepass_campaign_name_aliases')
order by proname;

-- Diagnostic: any returned rows are deliberately left unmapped for platformless
-- CRM UTMs because they refer to more than one stable campaign identity.
select lower(regexp_replace(alias_name, '[^a-zA-Z0-9]', '', 'g')) as normalized_alias,
       count(distinct (platform, campaign_id)) as campaign_identities,
       count(distinct canonical_name) as canonical_names
from public.prepass_campaign_name_aliases
group by lower(regexp_replace(alias_name, '[^a-zA-Z0-9]', '', 'g'))
having count(distinct (platform, campaign_id)) > 1;

-- Reconciled incident: the old and new labels must collapse into one current
-- campaign identity while preserving the literal MMP totals.
select
  coalesce(a.canonical_name, m.campaign_name) as reconciled_campaign_name,
  sum(m.spend) as spend,
  sum(m.mqls) as mqls,
  sum(m.sqls) as sqls,
  sum(m.closed_won) as won
from public.master_marketing_performance m
left join public.prepass_campaign_name_aliases a
  on a.platform = 'Meta'
 and lower(regexp_replace(a.alias_name, '[^a-zA-Z0-9]', '', 'g')) =
     lower(regexp_replace(m.campaign_name, '[^a-zA-Z0-9]', '', 'g'))
where lower(regexp_replace(m.campaign_name, '[^a-zA-Z0-9]', '', 'g')) in (
  lower(regexp_replace('ABM | PrePass | Website leads - FMCSA 200+ & BEST INTERESTS', '[^a-zA-Z0-9]', '', 'g')),
  lower(regexp_replace('ABM | PrePass | Website leads - BEST INTERESTS', '[^a-zA-Z0-9]', '', 'g'))
)
group by coalesce(a.canonical_name, m.campaign_name)
order by reconciled_campaign_name;
