-- PrePass Reporting v2: SMB / ABM / FD360 on the Marketo mirror (schema mk). ADDITIVE and read-only for existing reports.
-- 1) public.prepass_campaign_map: one row per way a campaign can be recognised (platform campaign id, normalised name, UTM text)
--    -> canonical campaign label + segment (SMB, ABM, FD360, Event, Unassigned). Seeded automatically from campaign name tags; edit rows to correct.
-- 2) public.prepass_segment_report(segment, start, end): one person, one segment, two perspectives.
--    Segment rule: fleet of 100+ vehicles => ABM (form band 101-500 or 500+, or a typed number from 100 to 50000), otherwise the segment of
--    the campaign the person came from (campaign id first, then name/UTM text). Nobody is counted in two segments.
--    "cohort"  = people CREATED in the window; MQL, SQL and won counted whenever they happened (so far).
--    "events"  = each stage counted on its OWN date inside the window, whenever the person was created.
--    Spend/platform conversions come from meta_campaigns and google_campaigns; spend is shown only against the campaign's own segment.
-- Call credit: a person with NO campaign tag whose phone (last 10 digits) matches a tracked Google ad call is credited to the campaign of their
--   first call, if they have not won yet or won within 60 days after that first call. Caller phones are only valid from the first month with 100+
--   valid-phone calls (Aug 2026). Tagged people always keep their tag; nobody is credited twice. Call-credited counts are shown separately too.
-- Reads the per-person assignment in mk.mv_person_assign (prepass_person_assign.sql), refreshed nightly. service_role only.
-- Rollback: drop function public.prepass_segment_report(text, date, date); drop table public.prepass_campaign_map;

create table if not exists public.prepass_campaign_map (
  id bigserial primary key,
  platform text not null,                 -- meta | google | utm
  match_key text not null,                -- campaign id as text, or normalised name (lowercase letters and digits only)
  label text not null,                    -- canonical campaign name shown on the dashboard
  segment text not null check (segment in ('SMB', 'ABM', 'FD360', 'Event', 'Unassigned')),
  status text not null default 'auto' check (status in ('auto', 'approved', 'rejected')),
  note text,
  updated_at timestamptz not null default now(),
  unique (platform, match_key)
);
alter table public.prepass_campaign_map enable row level security;
revoke all on public.prepass_campaign_map from public, anon, authenticated;

create or replace function public.prepass_campaign_segment(p_name text) returns text
 language sql immutable
as $$
  select case when p_name ilike '%fd360%' then 'FD360'
              when p_name ilike '%abm%' then 'ABM'
              when p_name ilike '%ata event%' or p_name ilike '%ata mce%' then 'Event'
              when p_name ilike '%smb%' or p_name ilike '%bypass%' or p_name ilike '%weigh station%' then 'SMB'
              else 'Unassigned' end
$$;

-- Seed: platform campaign ids and normalised names (ids from the ad tables, names from them and the old alias table).
insert into public.prepass_campaign_map (platform, match_key, label, segment, note)
select 'meta', campaign_id::text, max(campaign_name), public.prepass_campaign_segment(max(campaign_name)), 'auto: name tag'
from public.meta_campaigns where campaign_id is not null group by campaign_id
on conflict do nothing;
insert into public.prepass_campaign_map (platform, match_key, label, segment, note)
select 'google', campaign_id::text, max(campaign_name), public.prepass_campaign_segment(max(campaign_name)), 'auto: name tag'
from public.google_campaigns where campaign_id is not null group by campaign_id
on conflict do nothing;
insert into public.prepass_campaign_map (platform, match_key, label, segment, note)
select 'utm', lower(regexp_replace(max(campaign_name), '[^a-zA-Z0-9]', '', 'g')), max(campaign_name), public.prepass_campaign_segment(max(campaign_name)), 'auto: campaign name as UTM'
from (select campaign_name from public.meta_campaigns union all select campaign_name from public.google_campaigns) n
where campaign_name is not null group by lower(regexp_replace(campaign_name, '[^a-zA-Z0-9]', '', 'g'))
on conflict do nothing;
-- Meta ids that were renamed or recreated (old alias table): same segment as the canonical name.
insert into public.prepass_campaign_map (platform, match_key, label, segment, note)
select 'meta', a.campaign_id, max(a.canonical_name), public.prepass_campaign_segment(max(a.canonical_name)), 'auto: alias id'
from public.prepass_campaign_name_aliases a where a.platform ilike 'meta%' and a.campaign_id is not null group by a.campaign_id
on conflict do nothing;
-- UTM slugs seen in Marketo that do not look like the campaign name (checked by hand against the Google campaign list).
insert into public.prepass_campaign_map (platform, match_key, label, segment, status, note) values
 ('utm', 'abmbranddefense', 'Search | ABM | Brand Defense', 'ABM', 'auto', 'slug abm_brand_defense'),
 ('utm', 'searchabm', 'Search | ABM | High-Intent Keywords', 'ABM', 'auto', 'slug searchabm (older ABM search tag, confirm)'),
 ('utm', 'pmaxabmlargefleetsqualifiedmql', 'PMax | ABM | Large Fleets | Qualified MQL', 'ABM', 'auto', 'slug pmax_abm_large_fleets_qualified_mql'),
 ('utm', 'fleetmanagementpmax', 'Fleet Management Software and Tools | P.Max [SMB]', 'SMB', 'auto', 'slug FleetManagementPmax'),
 ('utm', 'fleetmanagementsoftwareandtoolspmaxsmb', 'Fleet Management Software and Tools | P.Max [SMB]', 'SMB', 'auto', 'slug without punctuation'),
 ('utm', 'atamce2026', 'ATA Event', 'Event', 'auto', 'slug ata_mce_2026')
on conflict do nothing;

create or replace function public.prepass_segment_report(p_segment text, p_start date, p_end date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public', 'mk'
 set statement_timeout to '45s'
as $function$
declare
  result jsonb;
  v_end timestamptz := (p_end + 1)::timestamptz;
  v_calls_from date := coalesce((select min(m) from (select date_trunc('month', created_at)::date m, count(*) n from public.call_google where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 group by 1) t where n >= 100), current_date + 1);
begin
  with lk as (select match_key, label, segment from public.prepass_campaign_map where status <> 'rejected'),
  seg as (
    select a.* from mk.mv_person_assign a
    where (a.created_at >= p_start and a.created_at < v_end)
       or (a.date_mql >= p_start and a.date_mql < v_end)
       or (a.date_sql >= p_start and a.date_sql < v_end)
       or (a.date_closed_won >= p_start and a.date_closed_won < v_end)
  ),
  sp as (
    select m.label, m.segment, sum(x.spend) as spend, sum(x.la) as lead_actions, sum(x.ca) as contact_actions, sum(x.conv) as conversions
    from (
      select campaign_id::text as cid, spend, lead_actions as la, contact_actions as ca, null::numeric as conv from public.meta_campaigns where date between p_start and p_end
      union all
      select campaign_id::text, cost, null, null, conversions from public.google_campaigns where date between p_start and p_end
    ) x
    left join lateral (select label, segment from lk where match_key = x.cid limit 1) m on true
    group by 1, 2
  ),
  ml as (
    select k.label, count(*) as meta_forms, count(*) filter (where x.found) as meta_found
    from mk.mv_meta_lead_match x
    join (select distinct on (match_key) match_key, label from lk order by match_key) k on k.match_key = x.cid
    where x.lead_created_at >= p_start and x.lead_created_at < v_end
    group by k.label
  ),
  agg as (
    select s.label, s.cs as cseg,
           count(*) filter (where s.via_call and s.created_at >= p_start and s.created_at < v_end) as call_leads,
           count(*) filter (where s.via_call and s.date_closed_won >= p_start and s.date_closed_won < v_end) as call_e_won,
           count(*) filter (where s.via_call and s.created_at >= p_start and s.created_at < v_end and s.date_closed_won is not null) as call_c_won,
           count(*) filter (where s.via_meta and s.created_at >= p_start and s.created_at < v_end) as meta_leads_credit,
           count(*) filter (where s.via_meta and s.date_closed_won >= p_start and s.date_closed_won < v_end) as meta_e_won,
           count(*) filter (where s.via_meta and s.created_at >= p_start and s.created_at < v_end and s.date_closed_won is not null) as meta_c_won,
           count(*) filter (where s.via_enroll and s.created_at >= p_start and s.created_at < v_end) as enroll_leads_credit,
           count(*) filter (where s.via_enroll and s.date_closed_won >= p_start and s.date_closed_won < v_end) as enroll_e_won,
           count(*) filter (where s.via_enroll and s.created_at >= p_start and s.created_at < v_end and s.date_closed_won is not null) as enroll_c_won,
           count(*) filter (where s.created_at >= p_start and s.created_at < v_end) as leads,
           count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_mql is not null) as c_mql,
           count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_sql is not null) as c_sql,
           count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_closed_won is not null) as c_won,
           count(*) filter (where s.date_mql >= p_start and s.date_mql < v_end) as e_mql,
           count(*) filter (where s.date_sql >= p_start and s.date_sql < v_end) as e_sql,
           count(*) filter (where s.date_closed_won >= p_start and s.date_closed_won < v_end) as e_won,
           count(*) filter (where s.fleet100 and s.created_at >= p_start and s.created_at < v_end) as fleet100_leads
    from seg s
    where s.segment = p_segment
    group by 1, 2
  )
  select jsonb_build_object(
    'segment', p_segment,
    'calls_valid_from', v_calls_from,
    'window', jsonb_build_object('start', p_start, 'end', p_end),
    'data_through', (select max(created_at) from mk.mv_person_funnel),
    'totals', (select jsonb_build_object('leads', coalesce(sum(leads), 0), 'c_mql', coalesce(sum(c_mql), 0), 'c_sql', coalesce(sum(c_sql), 0), 'c_won', coalesce(sum(c_won), 0),
                  'e_mql', coalesce(sum(e_mql), 0), 'e_sql', coalesce(sum(e_sql), 0), 'e_won', coalesce(sum(e_won), 0), 'fleet100_leads', coalesce(sum(fleet100_leads), 0),
                  'call_leads', coalesce(sum(call_leads), 0), 'call_e_won', coalesce(sum(call_e_won), 0), 'call_c_won', coalesce(sum(call_c_won), 0),
                  'meta_credit_leads', coalesce(sum(meta_leads_credit), 0), 'meta_e_won', coalesce(sum(meta_e_won), 0), 'meta_c_won', coalesce(sum(meta_c_won), 0),
                  'enroll_credit_leads', coalesce(sum(enroll_leads_credit), 0), 'enroll_e_won', coalesce(sum(enroll_e_won), 0), 'enroll_c_won', coalesce(sum(enroll_c_won), 0)) from agg),
    'meta_forms', (select jsonb_build_object('forms', coalesce(sum(ml.meta_forms), 0), 'found', coalesce(sum(ml.meta_found), 0)) from ml where ml.label in (select label from sp where segment = p_segment)),
    'segment_spend', (select coalesce(round(sum(spend)), 0) from sp where segment = p_segment),
    'campaigns', (select coalesce(jsonb_agg(row order by (row->>'leads')::int desc, (row->>'spend')::numeric desc nulls last), '[]'::jsonb) from (
        select jsonb_build_object('label', coalesce(a.label, sp.label), 'campaign_segment', coalesce(a.cseg, sp.segment),
                 'spend', case when coalesce(a.cseg, sp.segment) = p_segment then round(sp.spend) end,
                 'lead_actions', case when coalesce(a.cseg, sp.segment) = p_segment then sp.lead_actions end,
                 'contact_actions', case when coalesce(a.cseg, sp.segment) = p_segment then sp.contact_actions end,
                 'conversions', case when coalesce(a.cseg, sp.segment) = p_segment then round(sp.conversions) end,
                 'leads', coalesce(a.leads, 0), 'c_mql', coalesce(a.c_mql, 0), 'c_sql', coalesce(a.c_sql, 0), 'c_won', coalesce(a.c_won, 0),
                 'e_mql', coalesce(a.e_mql, 0), 'e_sql', coalesce(a.e_sql, 0), 'e_won', coalesce(a.e_won, 0), 'fleet100_leads', coalesce(a.fleet100_leads, 0),
                 'call_leads', coalesce(a.call_leads, 0), 'call_e_won', coalesce(a.call_e_won, 0), 'call_c_won', coalesce(a.call_c_won, 0),
                 'meta_e_won', coalesce(a.meta_e_won, 0), 'meta_c_won', coalesce(a.meta_c_won, 0),
                 'enroll_e_won', coalesce(a.enroll_e_won, 0), 'enroll_c_won', coalesce(a.enroll_c_won, 0),
                 'meta_forms', case when coalesce(a.cseg, sp.segment) = p_segment then ml.meta_forms end, 'meta_found', case when coalesce(a.cseg, sp.segment) = p_segment then ml.meta_found end) as row
        from agg a full join (select * from sp where segment = p_segment) sp on sp.label = a.label
        left join ml on ml.label = coalesce(a.label, sp.label)
        where coalesce(a.leads, 0) + coalesce(a.e_mql, 0) + coalesce(a.e_sql, 0) + coalesce(a.e_won, 0) > 0 or coalesce(sp.spend, 0) > 100
        limit 60) q),
    'channels', (select coalesce(jsonb_agg(row order by (row->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('channel', coalesce(s.channel, 'unattributed'),
                 'leads', count(*) filter (where s.created_at >= p_start and s.created_at < v_end),
                 'c_mql', count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_mql is not null),
                 'c_sql', count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_sql is not null),
                 'c_won', count(*) filter (where s.created_at >= p_start and s.created_at < v_end and s.date_closed_won is not null),
                 'e_mql', count(*) filter (where s.date_mql >= p_start and s.date_mql < v_end),
                 'e_sql', count(*) filter (where s.date_sql >= p_start and s.date_sql < v_end),
                 'e_won', count(*) filter (where s.date_closed_won >= p_start and s.date_closed_won < v_end)) as row
        from seg s where s.segment = p_segment group by coalesce(s.channel, 'unattributed')) q),
    'unmapped_spend', (select coalesce(jsonb_agg(jsonb_build_object('campaign', n, 'spend', round(sp2)) order by sp2 desc), '[]'::jsonb) from (
        select max(x.name) n, sum(x.spend) sp2 from (
          select campaign_id::text cid, campaign_name name, spend from public.meta_campaigns where date between p_start and p_end
          union all select campaign_id::text, campaign_name, cost from public.google_campaigns where date between p_start and p_end) x
        where not exists (select 1 from lk where match_key = x.cid) or exists (select 1 from lk where match_key = x.cid and segment = 'Unassigned')
        group by x.cid having sum(x.spend) > 200 order by 2 desc limit 8) u)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_segment_report(text, date, date) from public, anon, authenticated;
grant execute on function public.prepass_segment_report(text, date, date) to service_role;
