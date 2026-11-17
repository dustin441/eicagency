-- PrePass Sales Overview: phone calls by Google campaign. ADDITIVE and read-only.
-- For callers whose first tracked call falls in the window: how many calls and callers each Google campaign drove,
-- how many callers match a person in Marketo (last 10 digits of the phone number), how many of those people reached
-- MQL or closed-won AFTER their first call, and what Google spent on the campaign in the same window.
-- Limits: Marketo people are only mirrored from mid 2025, so older contacts show as unmatched. A caller can be an
-- existing customer; a win only counts if the first call came before the win date. Caller phone numbers are only recorded from Aug 2026, so the view starts there.
-- Needs mk.mv_person_funnel and mk.mv_person_phone. service_role only.
-- Rollback: drop function public.prepass_call_campaigns(date, date);

CREATE OR REPLACE FUNCTION public.prepass_call_campaigns(p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mk'
 SET statement_timeout TO '45s'
AS $function$
declare
  v_first date := coalesce((select min(m) from (select date_trunc('month', created_at)::date m, count(*) n from public.call_google where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 group by 1) t where n >= 100), current_date);
  v_start date := greatest(p_start, v_first);
  result jsonb;
begin
  with calls as (
    select right(regexp_replace(caller_phone_number, '\D', '', 'g'), 10) as ph, campaign, created_at, coalesce(duration_seconds, 0) as dur
    from public.call_google
    where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10
      and created_at >= v_start and created_at < p_end + 1
  ),
  calls_all as (
    select campaign, coalesce(duration_seconds, 0) as dur from public.call_google where created_at >= v_start and created_at < p_end + 1
  ),
  firstc as (
    select distinct on (ph) ph, campaign, created_at as first_call from calls order by ph, created_at
  ),
  ppl as (
    select f.id, f.created_at, f.date_mql, f.date_closed_won, p.phone10
    from mk.mv_person_funnel f join mk.mv_person_phone p using (id) where p.phone10 is not null
  ),
  joined as (
    select fc.campaign, fc.ph, fc.first_call, pp.id, pp.created_at as person_created,
           (pp.date_mql is not null and pp.date_mql >= fc.first_call - interval '1 day') as mql_after,
           (pp.date_closed_won is not null and fc.first_call >= pp.created_at - interval '1 day' and fc.first_call <= pp.date_closed_won + interval '1 day') as won_after
    from firstc fc left join ppl pp on pp.phone10 = fc.ph
  ),
  per_campaign as (
    select campaign, count(distinct ph) as callers, count(distinct ph) filter (where id is not null) as matched_callers,
           count(distinct id) filter (where mql_after) as mqls_after, count(distinct id) filter (where won_after) as wins_after
    from joined group by campaign
  ),
  call_tot as (
    select campaign, count(*) as calls, round(100.0 * count(*) filter (where dur >= 60) / count(*)) as pct_over_60s
    from calls_all group by campaign
  ),
  goog as (
    select lower(regexp_replace(campaign_name, '[^a-zA-Z0-9]', '', 'g')) as k, sum(cost)::numeric as spend
    from public.google_campaigns where date between v_start and p_end group by 1
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', v_start, 'end', p_end),
    'tracking_started', v_first,
    'campaigns', (select coalesce(jsonb_agg(jsonb_build_object(
        'campaign', c.campaign, 'calls', t.calls, 'callers', c.callers, 'matched_callers', c.matched_callers,
        'mqls_after', c.mqls_after, 'wins_after', c.wins_after, 'pct_over_60s', t.pct_over_60s,
        'spend', round(coalesce(g.spend, 0))) order by t.calls desc), '[]'::jsonb)
      from per_campaign c join call_tot t using (campaign)
      left join goog g on g.k = lower(regexp_replace(c.campaign, '[^a-zA-Z0-9]', '', 'g'))),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', mo, 'calls', n) order by mo), '[]'::jsonb)
      from (select to_char(date_trunc('month', created_at), 'YYYY-MM') as mo, count(*) as n from public.call_google where created_at >= v_start and created_at < p_end + 1 group by 1) x)
  ) into result;
  return result;
end;
$function$;

REVOKE ALL ON FUNCTION public.prepass_call_campaigns(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepass_call_campaigns(date, date) TO service_role;
