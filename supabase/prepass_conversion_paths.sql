-- PrePass Sales Overview: how people actually convert. ADDITIVE and read-only.
-- Returns, for people created in a window: (1) phone call vs self-enrollment vs everything else, (2) how they entered
-- Marketo (list, form, web page, API, CRM), (3) fleet size bands, (4) top landing pages, forms and lists.
-- A person counts as "Phone call" when their phone number matches a caller in call_google and the first call is near
-- or after they were created and before they became a customer. Phone matching only works from the month call
-- tracking reached 100 calls. The sales team cannot be separated here: Marketo does not record who handled a person.
-- Wins use a 60 day window for fair comparison; slow-closing large fleets are also returned as "wins so far".
-- Needs mk.mv_person_funnel, mk.mv_person_segments (fleet, entry, form fields from the person record) and
-- mk.mv_person_phone (last 10 digits of the phone number). service_role only.
-- Rollback: drop function public.prepass_conversion_paths(date, date);
--
-- mk.mv_person_phone (already applied):
--   create materialized view mk.mv_person_phone as
--   select p.id, nullif(right(regexp_replace(coalesce(nullif(p.phone,''), nullif(p.mobile_phone,'')), '\D', '', 'g'), 10), '') as phone10
--   from mk.person p where p.created_at >= '2025-06-01';

CREATE OR REPLACE FUNCTION public.prepass_conversion_paths(p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mk'
 SET statement_timeout TO '45s'
AS $function$
declare
  v_cf timestamptz := (select min(window_start) from mk.sync_run where object = 'person_created' and status = 'ok');
  v_first date := case when extract(day from v_cf) > 1 then (date_trunc('month', v_cf) + interval '1 month')::date else date_trunc('month', v_cf)::date end;
  v_start date := greatest(p_start, v_first);
  v_end date := least(p_end, current_date - 60);
  v_call_from date := coalesce((select min(m) from (select date_trunc('month', created_at)::date m, count(*) n from public.call_google where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 group by 1) t where n >= 100), current_date);
  v_path_from date := greatest(v_start, v_call_from);
  result jsonb;
begin
  with base as (
    select f.id, f.created_at, f.channel, f.lead_source, f.date_mql, f.date_sql, f.date_closed_won, f.days_created_to_won,
           s.source_info, s.last_form,
           coalesce(s.fleet_band, case when s.vehicles is null then null when s.vehicles <= 5 then '1-5' when s.vehicles <= 50 then '6-50' when s.vehicles <= 100 then '51-100' when s.vehicles <= 500 then '101-500' else '500+' end) as band
    from mk.mv_person_funnel f join mk.mv_person_segments s using (id)
    where f.created_at >= v_start and f.created_at < v_end + 1
  ),
  calls as (
    select right(regexp_replace(caller_phone_number, '\D', '', 'g'), 10) as ph, min(created_at) as first_call
    from public.call_google where length(regexp_replace(caller_phone_number, '\D', '', 'g')) >= 10 group by 1
  ),
  pathed as (
    select b.*, case
        when c.first_call is not null and c.first_call >= b.created_at - interval '1 day'
             and (b.date_closed_won is null or c.first_call <= b.date_closed_won + interval '1 day') then 'Phone call'
        when b.lead_source = 'Online Enrollment' then 'Self-enrollment'
        else 'Everything else' end as path
    from base b join mk.mv_person_phone p on p.id = b.id
    left join calls c on c.ph = p.phone10
    where b.created_at >= v_path_from
  ),
  entry as (
    select case when source_info like 'List:%' then 'Imported or targeted list' when source_info like 'Form:%' then 'Web form fill'
                when source_info like 'URL:%' then 'Web page visit' when source_info = 'Web service API' then 'System sign-up (API)'
                when source_info is null then 'Created in the CRM, no web entry' else 'Other' end as k, * from base
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', v_start, 'end', v_end), 'path_window_start', v_path_from,
    'paths', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'leads', n, 'mqls', mq, 'wins60', w60, 'wins', ws, 'median_days', md) order by n desc), '[]'::jsonb)
      from (select path, count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60, count(days_created_to_won) ws,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) md from pathed group by path) x),
    'entry', (select coalesce(jsonb_agg(jsonb_build_object('entry', k, 'leads', n, 'mqls', mq, 'wins60', w60, 'wins', ws, 'median_days', md) order by n desc), '[]'::jsonb)
      from (select k, count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60, count(days_created_to_won) ws,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) md from entry group by k) x),
    'fleet', (select coalesce(jsonb_agg(jsonb_build_object('band', coalesce(band, 'unknown'), 'leads', n, 'mqls', mq, 'sqls', sq, 'wins60', w60, 'wins', ws, 'median_days', md, 'pct_paid', pp, 'pct_selfserve', ps)
              order by case coalesce(band, 'unknown') when '1-5' then 1 when '6-50' then 2 when '51-100' then 3 when '101-500' then 4 when '500+' then 5 else 6 end), '[]'::jsonb)
      from (select band, count(*) n, count(date_mql) mq, count(date_sql) sq, count(*) filter (where days_created_to_won <= 60) w60, count(days_created_to_won) ws,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) md,
              round(100.0 * count(*) filter (where channel in ('paid_social', 'paid_search', 'paid_other')) / count(*)) pp,
              round(100.0 * count(*) filter (where channel in ('online_enrollment', 'organic_inbound')) / count(*)) ps from base group by band) x),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', pg, 'leads', n, 'mqls', mq, 'wins60', w60, 'median_days', md) order by n desc), '[]'::jsonb)
      from (select substr(source_info, 6) pg, count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) md from base where source_info like 'URL:%' group by 1 having count(*) >= 30 order by count(*) desc limit 15) x),
    'forms', (select coalesce(jsonb_agg(jsonb_build_object('form', fm, 'leads', n, 'mqls', mq, 'wins60', w60) order by n desc), '[]'::jsonb)
      from (select left(last_form, 70) fm, count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60 from base where last_form is not null group by 1 having count(*) >= 30 order by count(*) desc limit 12) x),
    'lists', (select coalesce(jsonb_agg(jsonb_build_object('list', ls, 'leads', n, 'mqls', mq, 'wins60', w60) order by n desc), '[]'::jsonb)
      from (select left(substr(source_info, 7), 80) ls, count(*) n, count(date_mql) mq, count(*) filter (where days_created_to_won <= 60) w60 from base where source_info like 'List:%' group by 1 having count(*) >= 200 order by count(*) desc limit 12) x)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_conversion_paths(date, date) from public, anon, authenticated;
grant execute on function public.prepass_conversion_paths(date, date) to service_role;
