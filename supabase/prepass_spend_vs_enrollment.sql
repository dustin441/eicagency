-- PrePass Sales Overview: does ad spend move with enrollment? ADDITIVE and read-only.
-- Weekly Google and Meta spend against new Online Enrollment people and enrollment-plus-organic closed-won, with
-- correlations at 0 to 6 week delays, week-over-week changes, and a monthly GA4 chain (platform spend -> that
-- platform's paid website sessions -> wins). Correlation is a pattern, not proof of cause. service_role only.
-- Needs mk.mv_person_funnel. Rollback: drop function public.prepass_spend_vs_enrollment(date, date);

CREATE OR REPLACE FUNCTION public.prepass_spend_vs_enrollment(p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mk'
 SET statement_timeout TO '45s'
AS $function$
declare
  v_loaded date := (select min(window_start)::date from mk.sync_run where object = 'person_created' and status = 'ok');
  v_from date := greatest(date_trunc('week', p_start)::date, date_trunc('week', v_loaded + 7)::date);
  v_to date := least(date_trunc('week', p_end)::date, date_trunc('week', current_date - 7)::date);
  v_mfrom date := date_trunc('month', v_from + 31)::date;
  v_mto date := (date_trunc('month', least(p_end, current_date)) - interval '1 month')::date;
  result jsonb;
begin
  with wk as (select generate_series(v_from, v_to, interval '7 days')::date w),
  g as (select date_trunc('week', date::date)::date w, sum(cost) v from public.google_campaigns where date::date >= v_from and date::date < v_to + 7 group by 1),
  m as (select date_trunc('week', date::date)::date w, sum(spend) v from public.meta_campaigns where date::date >= v_from and date::date < v_to + 7 group by 1),
  e as (select date_trunc('week', created_at)::date w, count(*) v from mk.person where lead_source = 'Online Enrollment' and created_at >= v_from and created_at < v_to + 7 group by 1),
  s as (select date_trunc('week', date_closed_won)::date w, count(*) v from mk.mv_person_funnel where channel in ('online_enrollment', 'organic_inbound') and date_closed_won >= v_from and date_closed_won < v_to + 7 group by 1),
  t as (select wk.w, coalesce(g.v, 0) g, coalesce(m.v, 0) m, coalesce(e.v, 0) e, coalesce(s.v, 0) s from wk left join g using (w) left join m using (w) left join e using (w) left join s using (w)),
  lagd as (select k, a.g, a.m, b.e, b.s from generate_series(0, 6) k join t a on true join t b on b.w = a.w + (k * 7)),
  lags as (select k, round(corr(g, e)::numeric, 2) g_e, round(corr(m, e)::numeric, 2) m_e, round(corr(g, s)::numeric, 2) g_s, round(corr(m, s)::numeric, 2) m_s, count(*) n from lagd group by k),
  d as (select g - lag(g) over (order by w) dg, m - lag(m) over (order by w) dm, s - lag(s) over (order by w) ds, e - lag(e) over (order by w) de from t),
  ga as (select date_trunc('month', date::date)::date mo,
           sum(sessions) filter (where session_default_channel_group in ('Paid Search', 'Cross-network')) gs,
           sum(sessions) filter (where session_default_channel_group = 'Paid Social') ms
         from public.prepass_ga4_daily where date::date >= v_mfrom and date::date < v_mto + 31 group by 1),
  gsp as (select date_trunc('month', date::date)::date mo, sum(cost) v from public.google_campaigns where date::date >= v_mfrom group by 1),
  msp as (select date_trunc('month', date::date)::date mo, sum(spend) v from public.meta_campaigns where date::date >= v_mfrom group by 1),
  sw as (select date_trunc('month', date_closed_won)::date mo, count(*) v from mk.mv_person_funnel where channel in ('online_enrollment', 'organic_inbound') and date_closed_won >= v_mfrom group by 1),
  mo as (select ga.mo, ga.gs, ga.ms, gsp.v gspend, msp.v mspend, sw.v wins from ga join gsp using (mo) join msp using (mo) join sw using (mo) where ga.mo between v_mfrom and v_mto)
  select jsonb_build_object(
    'window', jsonb_build_object('start', v_from, 'end', v_to),
    'weeks', (select count(*) from t),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'google', round(g), 'meta', round(m), 'enrollments', e, 'selfserve_wins', s) order by w), '[]'::jsonb) from t),
    'lags', (select coalesce(jsonb_agg(jsonb_build_object('lag', k, 'google_enrollments', g_e, 'meta_enrollments', m_e, 'google_wins', g_s, 'meta_wins', m_s, 'n', n) order by k), '[]'::jsonb) from lags),
    'week_over_week', (select jsonb_build_object('google_wins', round(corr(dg, ds)::numeric, 2), 'meta_wins', round(corr(dm, ds)::numeric, 2), 'google_enrollments', round(corr(dg, de)::numeric, 2), 'meta_enrollments', round(corr(dm, de)::numeric, 2)) from d),
    'ga4', (select jsonb_build_object('months', count(*),
        'google_spend_vs_google_sessions', round(corr(gspend, gs)::numeric, 2), 'google_sessions_vs_wins', round(corr(gs, wins)::numeric, 2),
        'meta_spend_vs_meta_sessions', round(corr(mspend, ms)::numeric, 2), 'meta_sessions_vs_wins', round(corr(ms, wins)::numeric, 2)) from mo),
    'spend_share', (select jsonb_build_object('google', round(sum(g)), 'meta', round(sum(m))) from t)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_spend_vs_enrollment(date, date) from public, anon, authenticated;
grant execute on function public.prepass_spend_vs_enrollment(date, date) to service_role;
