-- PrePass Reporting v2: one stored answer to "which segment and campaign does each person belong to?". ADDITIVE.
-- mk.mv_person_assign holds, for every Marketo person, the segment (SMB/ABM/FD360), campaign label, whether the credit came from a
-- matched Google ad call, and the fleet band. The segment report and the extras (trend, timing, fleet) all read from it, so every
-- tab agrees and pages stay fast. Refreshed nightly with the other mk summaries (add: mk.refresh_summaries below).
-- Rules are unchanged from prepass_segment_report.sql: fleet of 100+ => ABM; else the campaign's segment (campaign id first, then name/UTM text);
-- untagged people credited to the campaign of their first matching Google ad call (valid from the first month with 100+ valid-phone calls),
-- if they had not won yet or won within 60 days after that call.
-- Editing public.prepass_campaign_map shows up after the next refresh (nightly, or: refresh materialized view concurrently mk.mv_person_assign).
-- Credit order for a person: (1) their own campaign tag, (2) the Meta lead form they submitted (prepass_meta_lead_identity matched by exact
-- Marketo id or by email), (3) their first matching Google ad call. Nobody is credited twice.
-- mk.mv_meta_lead_match: every Meta lead form lead, with the Marketo person found for it (by id or email hash) or none.
-- Rollback: drop function public.prepass_segment_extras(text, date, date); drop materialized view mk.mv_person_assign; drop materialized view mk.mv_meta_lead_match;

set statement_timeout = '20min';
drop materialized view if exists mk.mv_person_assign;
drop materialized view if exists mk.mv_meta_lead_match;
create materialized view mk.mv_meta_lead_match as
with l as (
  select lead_id, campaign_id::text as cid, lead_created_at, id_marketo::bigint as idm, email_sha256
  from public.prepass_meta_lead_identity
),
p as (select id, created_at, encode(sha256(convert_to(lower(trim(email)), 'UTF8')), 'hex') as eh from mk.person where email is not null),
cand as (
  select l.lead_id, p.id as person_id, true as exact, abs(extract(epoch from p.created_at - l.lead_created_at)) as gap
  from l join p on p.id = l.idm
  union all
  select l.lead_id, p.id, false, abs(extract(epoch from p.created_at - l.lead_created_at))
  from l join p on p.eh = l.email_sha256
),
best as (select distinct on (lead_id) lead_id, person_id, exact from cand order by lead_id, exact desc, gap)
select l.lead_id, l.cid, l.lead_created_at, b.person_id, (b.person_id is not null) as found, coalesce(b.exact, false) as exact
from l left join best b using (lead_id);
create unique index mv_meta_lead_match_pk on mk.mv_meta_lead_match (lead_id);
create index mv_meta_lead_match_person on mk.mv_meta_lead_match (person_id);

create materialized view mk.mv_person_assign as
with lk0 as (
  select match_key, label, segment,
         case platform when 'meta' then 1 when 'google' then 2 else 3 end as pr
  from public.prepass_campaign_map where status <> 'rejected'
),
lk as (select distinct on (match_key) match_key, label, segment from lk0 order by match_key, pr),
v as (
  select coalesce((select min(m) from (select date_trunc('month', created_at)::date m, count(*) n from public.call_google
                    where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 group by 1) t where n >= 100), current_date + 1) as calls_from
),
calls as (
  select right(regexp_replace(caller_phone_number, '\D', '', 'g'), 10) as ph, campaign, created_at
  from public.call_google, v
  where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 and created_at >= v.calls_from and campaign is not null
),
firstc as (select distinct on (ph) ph, campaign, created_at as first_call from calls order by ph, created_at),
pcall as (
  select distinct on (pp.id) pp.id, fc.first_call, lower(regexp_replace(fc.campaign, '[^a-zA-Z0-9]', '', 'g')) as cnm
  from firstc fc join mk.mv_person_phone pp on pp.phone10 = fc.ph order by pp.id, fc.first_call
),
mc as (
  select distinct on (person_id) person_id, cid, lead_created_at from mk.mv_meta_lead_match where person_id is not null order by person_id, lead_created_at
),
base as (
  select f.id, f.created_at, f.date_mql, f.date_sql, f.date_closed_won, f.channel,
         f.utm_campaign_id::text as cid,
         lower(regexp_replace(coalesce(f.utm_campaign, ''), '[^a-zA-Z0-9]', '', 'g')) as nm,
         nullif(f.utm_campaign, '') as utm_campaign,
         s.fleet_band,
         coalesce((s.fleet_band in ('101-500', '500+')) or (s.vehicles between 100 and 50000), false) as fleet100
  from mk.mv_person_funnel f left join mk.mv_person_segments s using (id)
),
res as (
  select b.*,
         coalesce(l1.label, l2.label) as map_label, coalesce(l1.segment, l2.segment) as cseg,
         mc.lead_created_at as meta_at, ml.label as meta_label, ml.segment as meta_seg,
         pc.first_call, cl.label as call_label, cl.segment as call_seg
  from base b
  left join lk l1 on l1.match_key = b.cid
  left join lk l2 on b.nm <> '' and l2.match_key = b.nm
  left join mc on mc.person_id = b.id and l1.label is null and l2.label is null
  left join lk ml on ml.match_key = mc.cid
  left join pcall pc on pc.id = b.id and l1.label is null and l2.label is null
  left join lk cl on cl.match_key = pc.cnm
),
seg0 as (
  select r.*,
         (r.map_label is null and r.meta_label is not null and (r.date_closed_won is null or r.meta_at <= r.date_closed_won + interval '1 day')) as via_meta
  from res r
),
seg1 as (
  select r.*,
         (not r.via_meta and r.map_label is null and r.call_label is not null and r.first_call is not null
          and (r.date_closed_won is null or (r.first_call <= r.date_closed_won + interval '1 day' and r.date_closed_won <= r.first_call + interval '60 days'))) as via_call
  from seg0 r
)
select id, created_at, date_mql, date_sql, date_closed_won, channel, fleet_band, fleet100, via_call, via_meta,
       case when fleet100 then 'ABM'
            when coalesce(case when via_meta then meta_seg when via_call then call_seg else cseg end, '') in ('SMB', 'ABM', 'FD360')
                 then case when via_meta then meta_seg when via_call then call_seg else cseg end
            else null end as segment,
       coalesce(case when via_meta then meta_label when via_call then call_label else map_label end, utm_campaign, '(no campaign tag)') as label,
       case when via_meta then meta_seg when via_call then call_seg else cseg end as cs
from seg1;
create unique index mv_person_assign_pk on mk.mv_person_assign (id);
create index mv_person_assign_seg_idx on mk.mv_person_assign (segment, created_at);

-- Keep it fresh with the other summaries (appended to the existing list, order matters: it reads funnel, segments and phone).
create or replace function mk.refresh_summaries() returns text
language plpgsql security definer
set search_path = pg_catalog, mk
set statement_timeout = '20min'
as $$
declare v_id bigint; v_obj text; v_ts timestamptz;
begin
  insert into mk.refresh_log default values returning id into v_id;
  foreach v_obj in array array['mv_person_funnel','mv_person_segments','mv_person_phone','mv_person_opp','mv_person_pipeline','mv_cohort','mv_stage_events','mv_meta_lead_match','mv_person_assign'] loop
    v_ts := clock_timestamp();
    execute format('refresh materialized view concurrently mk.%I', v_obj);
    update mk.refresh_log set detail = coalesce(detail || ', ', '') || v_obj || ' ' || round(extract(epoch from clock_timestamp() - v_ts)::numeric, 1) || 's' where id = v_id;
  end loop;
  update mk.refresh_log set status = 'ok', finished_at = now() where id = v_id;
  return 'ok';
exception when others then
  update mk.refresh_log set status = 'failed', finished_at = now(), detail = coalesce(detail || ' | ', '') || sqlerrm where id = v_id;
  raise;
end $$;
revoke all on function mk.refresh_summaries() from public, anon, authenticated;

-- Trend, stage timing, fleet size and platform split for one segment.
create or replace function public.prepass_segment_extras(p_segment text, p_start date, p_end date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public', 'mk'
 set statement_timeout to '45s'
as $function$
declare
  result jsonb;
  v_end timestamptz := (p_end + 1)::timestamptz;
begin
  with a as (select * from mk.mv_person_assign where segment = p_segment),
  days as (select generate_series(p_start, p_end, interval '1 day')::date as d),
  ev as (
    select a.created_at::date as d, 'leads' as k, count(*) as n from a where a.created_at >= p_start and a.created_at < v_end group by 1
    union all select a.date_mql::date, 'mql', count(*) from a where a.date_mql >= p_start and a.date_mql < v_end group by 1
    union all select a.date_sql::date, 'sql', count(*) from a where a.date_sql >= p_start and a.date_sql < v_end group by 1
    union all select a.date_closed_won::date, 'won', count(*) from a where a.date_closed_won >= p_start and a.date_closed_won < v_end group by 1
  ),
  camp as (select match_key, segment from public.prepass_campaign_map where status <> 'rejected' and platform in ('meta', 'google')),
  spd as (
    select x.d, sum(x.spend) as spend, sum(x.clicks) as clicks, sum(x.impr) as impr, x.platform
    from (
      select date as d, spend, clicks, impressions as impr, 'Meta' as platform, campaign_id::text as cid from public.meta_campaigns where date between p_start and p_end
      union all select date, cost, clicks, impressions, 'Google', campaign_id::text from public.google_campaigns where date between p_start and p_end
    ) x
    where exists (select 1 from camp c where c.match_key = x.cid and c.segment = p_segment)
    group by x.d, x.platform
  )
  select jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', days.d,
                'leads', coalesce((select sum(n) from ev where ev.d = days.d and k = 'leads'), 0),
                'mql', coalesce((select sum(n) from ev where ev.d = days.d and k = 'mql'), 0),
                'sql', coalesce((select sum(n) from ev where ev.d = days.d and k = 'sql'), 0),
                'won', coalesce((select sum(n) from ev where ev.d = days.d and k = 'won'), 0),
                'spend', coalesce(round((select sum(spend) from spd where spd.d = days.d)), 0)) order by days.d), '[]'::jsonb) from days),
    'timing', (select jsonb_build_object(
        'lead_to_mql', round((percentile_cont(0.5) within group (order by greatest(0, extract(epoch from date_mql - created_at) / 86400)) filter (where date_mql >= p_start and date_mql < v_end))::numeric, 1),
        'mql_to_sql', round((percentile_cont(0.5) within group (order by greatest(0, extract(epoch from date_sql - date_mql) / 86400)) filter (where date_sql >= p_start and date_sql < v_end and date_mql is not null))::numeric, 1),
        'sql_to_won', round((percentile_cont(0.5) within group (order by greatest(0, extract(epoch from date_closed_won - date_sql) / 86400)) filter (where date_closed_won >= p_start and date_closed_won < v_end and date_sql is not null))::numeric, 1),
        'lead_to_won', round((percentile_cont(0.5) within group (order by greatest(0, extract(epoch from date_closed_won - created_at) / 86400)) filter (where date_closed_won >= p_start and date_closed_won < v_end))::numeric, 1))
      from a),
    'fleet', (select coalesce(jsonb_agg(jsonb_build_object('band', coalesce(fleet_band, 'Not given'), 'leads', n, 'mql', mq, 'sql', sq, 'won', w) order by n desc), '[]'::jsonb) from (
        select fleet_band, count(*) n, count(date_mql) mq, count(date_sql) sq, count(date_closed_won) w
        from a where created_at >= p_start and created_at < v_end group by fleet_band) f),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'spend', round(s), 'clicks', c, 'impressions', i) order by s desc), '[]'::jsonb) from (
        select platform, sum(spend) s, sum(clicks) c, sum(impr) i from spd group by platform) p)
  ) into result;
  return result;
end;
$function$;
revoke all on function public.prepass_segment_extras(text, date, date) from public, anon, authenticated;
grant execute on function public.prepass_segment_extras(text, date, date) to service_role;
