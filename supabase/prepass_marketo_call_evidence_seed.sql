begin;
select pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));

update public.prepass_marketo_attribution_evidence
set active=false,updated_at=now()
where route='validated_call'
  and evidence_key like 'prepass_daily_match:%';

with active_matches as (
  select distinct on (s.canonical_id)
    s.canonical_id,
    min(s.event_date) over (partition by s.canonical_id) valid_from,
    s.event_date,
    s.campaign_id,
    s.campaign_name,
    s.focus,
    s.source_updated_at,
    s.updated_at
  from prepass_daily_match_20261001.stage_matches s
  where s.publication_disposition='ACTIVE'
    and s.canonical_id ~ '^[1-9][0-9]*$'
  order by s.canonical_id,s.event_date desc,s.source_updated_at desc nulls last,s.updated_at desc
), resolved as (
  select a.*,m.platform,coalesce(a.focus,m.focus) resolved_focus,
    coalesce(m.canonical_campaign,a.campaign_name) resolved_campaign
  from active_matches a
  join lateral (
    select x.*
    from public.prepass_marketo_campaign_map x
    where x.mapping_status='approved'
      and ((x.campaign_id is not null and x.campaign_id=a.campaign_id)
        or x.campaign_norm=regexp_replace(lower(coalesce(a.campaign_name,'')),'[^a-z0-9]','','g'))
    order by (x.campaign_id is not null and x.campaign_id=a.campaign_id) desc,x.updated_at desc
    limit 1
  ) m on true
)
insert into public.prepass_marketo_attribution_evidence(
  marketo_id,route,platform,focus,campaign_id,campaign_name,evidence_kind,evidence_key,
  valid_from,active,source_updated_at,updated_at)
select canonical_id::bigint,'validated_call',platform,resolved_focus,campaign_id,resolved_campaign,
  'validated_originating_call','prepass_daily_match:'||canonical_id,valid_from,true,
  coalesce(source_updated_at,updated_at,now()),now()
from resolved
on conflict(route,evidence_key) do update set
  platform=excluded.platform,focus=excluded.focus,campaign_id=excluded.campaign_id,
  campaign_name=excluded.campaign_name,evidence_kind=excluded.evidence_kind,
  valid_from=excluded.valid_from,active=true,source_updated_at=excluded.source_updated_at,updated_at=now();

commit;
