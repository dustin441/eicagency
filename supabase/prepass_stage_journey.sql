-- PrePass Sales Overview: the journey between stages (Lead -> MQL -> SQL -> Closed-won). ADDITIVE and read-only.
-- For each stage entry in the window: how many advanced, how fast, how many advanced on their own within a day (self-serve),
-- and for everyone else (the people who needed follow-up) how many DIFFERENT nurture emails they received in the first 7 days.
-- Only people with at least 7 days since entering the stage are counted for touches, so every person had the same time to be reached.
-- Nurture email = Marketo program starting "ENG-" or "Tolls Email"; one-off blasts ("ES-") are not counted as follow-up.
-- Marketo holds NO sales rep emails, calls or meetings (checked every window from May 2025), so only the automated side is measured.
-- Window starts where the email history starts. Needs mk.mv_person_funnel and mk.email_touch. service_role only.
-- Rollback: drop function public.prepass_stage_journey(date, date);

create or replace function public.prepass_stage_journey(p_start date, p_end date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public', 'mk'
 set statement_timeout to '45s'
as $function$
declare
  v_from date := (select min(window_start)::date from mk.sync_run where object = 'email_touch' and status = 'ok');
  v_start date := greatest(p_start, coalesce(v_from, current_date));
  result jsonb;
begin
  if v_from is null then return jsonb_build_object('available', false); end if;
  with f as (
    select id, created_at, date_mql, date_sql, date_closed_won,
           case when channel like 'paid%' then 'Paid ads'
                when channel = 'online_enrollment' then 'Online enrollment'
                when channel = 'organic_inbound' then 'Organic and inbound'
                when channel in ('event', 'sales_outbound') then 'Events and sales outbound'
                when channel = 'referral_partner' then 'Referral and partner'
                else 'Other' end as grp
    from mk.mv_person_funnel
    where created_at >= v_start - 1 or date_mql >= v_start or date_sql >= v_start
  ),
  base as (
    select 'lead' as stage, id, grp, created_at as t0, date_mql as t1 from f where created_at >= v_start and created_at < p_end + 1
    union all
    select 'mql', id, grp, date_mql, date_sql from f where date_mql >= v_start and date_mql < p_end + 1 and date_mql <= now() - interval '7 days'
    union all
    select 'sql', id, grp, date_sql, date_closed_won from f where date_sql >= v_start and date_sql < p_end + 1 and date_sql <= now() - interval '7 days'
  ),
  scored as (
    select b.stage, b.grp, b.t0, b.t1,
           (b.t1 is not null) as adv,
           greatest(0, extract(epoch from b.t1 - b.t0) / 86400) as days,
           case when b.stage = 'lead' then 0 else (
             select count(distinct e.email_name) from mk.email_touch e
             where e.person_id = b.id and e.type_id = 6 and e.email_name ~* '^(eng-|tolls email)'
               and e.occurred_at >= b.t0 and e.occurred_at < b.t0 + interval '7 days') end as n_nurt
    from base b
  )
  select jsonb_build_object(
    'available', true,
    'window', jsonb_build_object('start', v_start, 'end', p_end, 'history_from', v_from),
    'rows', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
      select jsonb_build_object(
        'stage', stage, 'grp', coalesce(grp, 'All'),
        'people', count(*), 'advanced', count(*) filter (where adv),
        'self_serve', count(*) filter (where adv and days <= 1),
        'needs', count(*) filter (where not (adv and days <= 1)),
        'needs_advanced', count(*) filter (where adv and days > 1),
        'zero', count(*) filter (where stage <> 'lead' and not (adv and days <= 1) and n_nurt = 0),
        'one_two', count(*) filter (where stage <> 'lead' and not (adv and days <= 1) and n_nurt between 1 and 2),
        'three_plus', count(*) filter (where stage <> 'lead' and not (adv and days <= 1) and n_nurt >= 3),
        'advanced_three_plus', count(*) filter (where stage <> 'lead' and adv and days > 1 and n_nurt >= 3),
        'advanced_low', count(*) filter (where stage <> 'lead' and adv and days > 1 and n_nurt <= 2),
        'median_days', round((percentile_cont(0.5) within group (order by days) filter (where adv))::numeric, 1)
      ) as r
      from scored group by grouping sets ((stage, grp), (stage))
    ) x)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_stage_journey(date, date) from public, anon, authenticated;
grant execute on function public.prepass_stage_journey(date, date) to service_role;
