-- PrePass Sales Overview: what kind of opportunity each person had. ADDITIVE and read-only.
-- Uses Marketo "Add to Opportunity" activity (custom types 100001 contact, 100004 account) already loaded in mk.activity.
-- The opportunity NAME is the only signal we have about who created it, so people are grouped by name family:
--   meeting   : "<date> - Meeting booked" or "Meeting set" (a sales rep booked a meeting)
--   proposal  : "LTA", "LTA Proposal"
--   expansion : Upgrade, Reactivation, Adoption (people who are already customers)
--   enroll    : "PrePass Enrollment", "New PrePass.com Enrollment" (self-enrollment record)
--   product   : "TO | n", "PP | n", "PPP | n", "... Tolls Only", Gateway deals (a deal record; the name does not say who made it)
--   other     : anything else
-- COVERAGE: before mid-July 2026 only about 1 to 3% of wins have an Add to Opportunity record; from July 2026 about 100% do.
-- The function starts at the first month where 90%+ of wins (and every later month) have one, so the view is never misleading.
-- A person is placed in the first family that applies, in the order above. This is a proxy, not proof: Marketo does not
-- record which human worked a lead. Needs mk.mv_person_funnel, mk.mv_person_opp. service_role only.
-- Rollback: drop function public.prepass_opportunity_paths(date, date); drop materialized view mk.mv_person_opp;

create materialized view if not exists mk.mv_person_opp as
select person_id,
       min(occurred_at) as first_opp_at,
       count(*) as n_adds,
       bool_or(fam = 'meeting') as has_meeting,
       bool_or(fam = 'proposal') as has_proposal,
       bool_or(fam = 'expansion') as has_expansion,
       bool_or(fam = 'enroll') as has_enroll,
       bool_or(fam = 'product') as has_product
from (
  select person_id, occurred_at,
         case when asset_name ~* 'meeting (booked|set)' then 'meeting'
              when asset_name ~* '(^lta|proposal)' then 'proposal'
              when asset_name ~* '(upgrade|reactivat|adoption)' then 'expansion'
              when asset_name ~* 'enrollment' then 'enroll'
              when asset_name ~* '(^(to|ppp?|pp\+) ?\||tolls only|\| ?to$|gateway)' then 'product'
              else 'other' end as fam
  from mk.activity
  where type_id in (100001, 100004) and person_id is not null
) x
group by person_id;
create unique index if not exists mv_person_opp_pk on mk.mv_person_opp (person_id);

create or replace function public.prepass_opportunity_paths(p_start date, p_end date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public', 'mk'
 set statement_timeout to '45s'
as $function$
declare
  v_cf timestamptz := (select min(window_start) from mk.sync_run where object = 'person_created' and status = 'ok');
  v_first date := case when extract(day from v_cf) > 1 then (date_trunc('month', v_cf) + interval '1 month')::date else date_trunc('month', v_cf)::date end;
  v_act_from date := coalesce((select min(m)::date from (select m, min(cov) over (order by m rows between current row and unbounded following) as mincov
      from (select date_trunc('month', f.created_at) as m, count(*) filter (where o.person_id is not null)::numeric / nullif(count(*), 0) as cov
            from mk.mv_person_funnel f left join mk.mv_person_opp o on o.person_id = f.id
            where f.days_created_to_won <= 60 and f.created_at >= '2025-06-01' group by 1) c) t where mincov >= 0.9), current_date);
  v_start date := greatest(p_start, v_first, v_act_from);
  v_end date := least(p_end, current_date - 60);
  result jsonb;
begin
  with base as (
    select f.id, f.created_at, f.channel, f.date_mql, f.date_sql, f.date_closed_won, f.days_created_to_won,
           o.first_opp_at,
           case when o.person_id is null then 'none'
                when o.has_meeting then 'meeting' when o.has_proposal then 'proposal' when o.has_expansion then 'expansion'
                when o.has_product then 'product' when o.has_enroll then 'enroll' else 'other' end as grp
    from mk.mv_person_funnel f left join mk.mv_person_opp o on o.person_id = f.id
    where f.created_at >= v_start and f.created_at < v_end + 1
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', v_start, 'end', v_end),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('grp', grp, 'people', n, 'mqls', mq, 'sqls', sq, 'wins60', w60, 'wins', ws,
                'median_days_to_opp', d_opp, 'median_days_to_win', d_win) order by n desc), '[]'::jsonb)
      from (select grp, count(*) n, count(date_mql) mq, count(date_sql) sq,
              count(*) filter (where days_created_to_won <= 60) w60, count(days_created_to_won) ws,
              round((percentile_cont(0.5) within group (order by extract(epoch from first_opp_at - created_at) / 86400))::numeric, 1) d_opp,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) d_win
            from base group by grp) x),
    'timing', (select coalesce(jsonb_agg(jsonb_build_object('grp', g, 'people', n, 'mqls', mq, 'wins60', w60, 'median_days_to_win', d_win) order by g), '[]'::jsonb)
      from (select case when first_opp_at is null then '0 none' when extract(epoch from first_opp_at - created_at) / 86400 <= 1 then '1 within a day' when extract(epoch from first_opp_at - created_at) / 86400 <= 14 then '2 one to 14 days' else '3 over 14 days' end as g,
              count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) d_win
            from base group by 1) x),
    'speed_by_channel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'wins60', w, 'd7', a, 'd30', b, 'd60', c) order by w desc), '[]'::jsonb)
      from (select channel, count(*) w, count(*) filter (where days_created_to_won <= 7) a, count(*) filter (where days_created_to_won > 7 and days_created_to_won <= 30) b,
              count(*) filter (where days_created_to_won > 30) c
            from base where days_created_to_won <= 60 group by channel) x),
    'by_channel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'wins60', w, 'meeting', m, 'proposal', pr, 'expansion', ex, 'product', pd, 'enroll', en, 'other', ot, 'none', no) order by w desc), '[]'::jsonb)
      from (select channel, count(*) w,
              count(*) filter (where grp = 'meeting') m, count(*) filter (where grp = 'proposal') pr, count(*) filter (where grp = 'expansion') ex,
              count(*) filter (where grp = 'product') pd, count(*) filter (where grp = 'enroll') en, count(*) filter (where grp = 'other') ot,
              count(*) filter (where grp = 'none') no
            from base where days_created_to_won <= 60 group by channel) x)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_opportunity_paths(date, date) from public, anon, authenticated;
grant execute on function public.prepass_opportunity_paths(date, date) to service_role;

-- Keep the new summary fresh with the others (adds mv_person_opp to the nightly list).
create or replace function mk.refresh_summaries() returns text
language plpgsql security definer
set search_path = pg_catalog, mk
set statement_timeout = '20min'
as $$
declare v_id bigint; v_obj text; v_ts timestamptz;
begin
  insert into mk.refresh_log default values returning id into v_id;
  foreach v_obj in array array['mv_person_funnel','mv_person_segments','mv_person_phone','mv_person_opp','mv_cohort','mv_stage_events'] loop
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
