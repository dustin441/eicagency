-- PrePass Sales Overview: how much of online enrollment can be tracked. ADDITIVE and read-only.
-- Compares Marketo "Online Enrollment" people (created per week) with the self-enrollment capture queue
-- (prepass_self_enrollment_attribution_queue): how many were captured, how many captures carried a click ID or
-- UTMs, and how many Marketo records now hold a click ID or UTM source. Also returns the queue outcomes.
-- Starts at the week the capture went live. Needs mk.mv_person_funnel. service_role only.
-- Rollback: drop function public.prepass_enrollment_tracking(date, date);

CREATE OR REPLACE FUNCTION public.prepass_enrollment_tracking(p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'mk'
 SET statement_timeout TO '45s'
AS $function$
declare
  v_cap_start date := (select min(first_captured_at)::date from public.prepass_self_enrollment_attribution_queue);
  v_start date := greatest(p_start, coalesce(date_trunc('week', (select min(first_captured_at) from public.prepass_self_enrollment_attribution_queue))::date, p_start));
  result jsonb;
begin
  with q as (
    select marketo_person_id::bigint as pid, status, last_error_code, first_captured_at, attribution,
           (nullif(attribution->>'gclid','') is not null or nullif(attribution->>'fbclid','') is not null
            or nullif(attribution->>'utm_source','') is not null or nullif(attribution->>'utm_campaign','') is not null) as has_attr
    from public.prepass_self_enrollment_attribution_queue
    where first_captured_at >= v_start and first_captured_at < p_end + 1
  ),
  e as (
    select f.id, f.created_at, date_trunc('week', f.created_at)::date as wk, f.utm_source, nullif(p.gclid, '') as gclid
    from mk.mv_person_funnel f join mk.person p on p.id = f.id
    where p.lead_source = 'Online Enrollment' and f.created_at >= v_start and f.created_at < p_end + 1
  ),
  weekly as (
    select e.wk,
      count(*) as enrollments,
      count(*) filter (where e.id in (select pid from q)) as captured,
      count(*) filter (where e.id in (select pid from q where has_attr)) as captured_with_attribution,
      count(*) filter (where e.gclid is not null) as has_click_id_now,
      count(*) filter (where e.gclid is not null or nullif(e.utm_source, '') is not null) as has_any_attribution_now
    from e group by e.wk
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', p_start, 'end', p_end),
    'capture_start', v_cap_start,
    'effective_start', v_start,
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'enrollments', enrollments, 'captured', captured,
        'captured_with_attribution', captured_with_attribution, 'has_click_id_now', has_click_id_now, 'has_any_attribution_now', has_any_attribution_now) order by wk), '[]'::jsonb) from weekly),
    'outcomes', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'code', code, 'n', n, 'with_click_id', with_click_id, 'with_attribution', with_attr) order by n desc), '[]'::jsonb)
      from (select status, coalesce(last_error_code, '') as code, count(*) as n,
              count(*) filter (where nullif(attribution->>'gclid', '') is not null) as with_click_id, count(*) filter (where has_attr) as with_attr
            from q group by 1, 2) o)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_enrollment_tracking(date, date) from public, anon, authenticated;
grant execute on function public.prepass_enrollment_tracking(date, date) to service_role;
