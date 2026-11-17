-- PrePass Sales Overview: total closed-won year over year, by source. ADDITIVE and read-only.
-- Compares people created in a window with people created on the same dates one year earlier,
-- counting a win only if it closed within 60 days of creation, so both years get equal time to convert.
-- Needs mk.mv_person_funnel. Reads only existing ad-platform spend tables. service_role only.
-- The Marketo mirror holds people created since a known date, so the comparison starts one year after that date.
-- Rollback: drop function public.prepass_sales_yoy(date, date);

CREATE OR REPLACE FUNCTION public.prepass_sales_yoy(p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mk'
 SET statement_timeout TO '45s'
AS $function$
declare
  v_cf timestamptz := (select min(window_start) from mk.sync_run where object = 'person_created' and status = 'ok');
  v_first date := case when extract(day from v_cf) > 1 then (date_trunc('month', v_cf) + interval '1 month')::date else date_trunc('month', v_cf)::date end;
  v_start date := greatest(p_start, (v_first + interval '1 year')::date);
  v_mature date := least(p_end, current_date - 60);
  result jsonb;
begin
  with pf as (
    select channel, created_at, days_created_to_won from mk.mv_person_funnel
  ),
  cur as (
    select channel, count(*) as leads, count(*) filter (where days_created_to_won <= 60) as won60, count(*) filter (where days_created_to_won is not null) as won_sofar
    from pf where created_at >= v_start and created_at < v_mature + 1 group by channel
  ),
  prev as (
    select channel, count(*) as leads, count(*) filter (where days_created_to_won <= 60) as won60, count(*) filter (where days_created_to_won is not null) as won_sofar
    from pf where created_at >= (v_start - interval '1 year') and created_at < ((v_mature - interval '1 year')::date + 1) group by channel
  ),
  monthly as (
    select date_trunc('month', created_at)::date as m, channel, count(*) as leads, count(*) filter (where days_created_to_won <= 60) as won60
    from pf where created_at >= v_first group by 1, 2
  ),
  spend as (
    select m, sum(meta) as meta, sum(google) as google from (
      select date_trunc('month', date::date)::date as m, sum(spend) as meta, 0::numeric as google from public.meta_campaigns where date::date >= v_first group by 1
      union all
      select date_trunc('month', date::date)::date, 0::numeric, sum(cost) from public.google_campaigns where date::date >= v_first group by 1
    ) s group by m
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', p_start, 'end', p_end), 'effective_start', v_start,
    'mature_through', v_mature,
    'prior_window', jsonb_build_object('start', (v_start - interval '1 year')::date, 'end', (v_mature - interval '1 year')::date),
    'first_complete_month', v_first,
    'current', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'leads', leads, 'won60', won60, 'won_sofar', won_sofar)), '[]'::jsonb) from cur),
    'prior', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'leads', leads, 'won60', won60, 'won_sofar', won_sofar)), '[]'::jsonb) from prev),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'channel', channel, 'leads', leads, 'won60', won60) order by m, channel), '[]'::jsonb) from monthly),
    'spend', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'meta', round(meta), 'google', round(google)) order by m), '[]'::jsonb) from spend)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_sales_yoy(date, date) from public, anon, authenticated;
grant execute on function public.prepass_sales_yoy(date, date) to service_role;
