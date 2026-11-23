-- PrePass Reporting v2: (1) people a segment's campaigns produced that were counted in a different segment (fleet of 100+ => ABM),
-- (2) FD360 lead quality from Marketo's own lifecycle/lead status (leads go on to HubSpot, so MQL/SQL/won are not visible).
-- ADDITIVE and read-only. service_role only.
-- Rollback: drop function public.prepass_segment_crossover(text,date,date); drop function public.prepass_fd360_quality(date,date);

create or replace function public.prepass_segment_crossover(p_segment text, p_start date, p_end date)
 returns jsonb language sql stable security definer
 set search_path to 'pg_catalog','public','mk'
 set statement_timeout to '30s'
as $f$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select a.segment as counted_in, count(*) as leads,
           count(*) filter (where f.date_mql is not null) as mql,
           count(*) filter (where f.date_closed_won is not null) as won
    from mk.mv_person_assign a join mk.mv_person_funnel f on f.id = a.id
    where a.cs = p_segment and a.segment is distinct from p_segment
      and a.created_at >= p_start and a.created_at < p_end + 1
    group by a.segment
  ) r;
$f$;

create or replace function public.prepass_fd360_quality(p_start date, p_end date)
 returns jsonb language sql stable security definer
 set search_path to 'pg_catalog','public','mk'
 set statement_timeout to '30s'
as $f$
  with x as (
    select a.created_at, p.lifecycle_stage, p.lead_status, p.date_mql, p.date_sql, p.date_closed_won
    from mk.mv_person_assign a join mk.person p on p.id = a.id
    where a.segment = 'FD360' and a.created_at >= p_start and a.created_at < p_end + 1
  )
  select jsonb_build_object(
    'leads', count(*),
    'disqualified', count(*) filter (where lifecycle_stage = 'Disqualified' or lead_status = 'Disqualified'),
    'still_open', count(*) filter (where lifecycle_stage in ('MQL','MAL','Lead','Open') and coalesce(lead_status,'') <> 'Disqualified'),
    'advanced', count(*) filter (where date_sql is not null or date_closed_won is not null or lifecycle_stage in ('SQL','Closed Won','Closed Lost')),
    'won', count(*) filter (where date_closed_won is not null),
    'matured_leads', count(*) filter (where created_at < now() - interval '14 days'),
    'matured_disqualified', count(*) filter (where created_at < now() - interval '14 days' and (lifecycle_stage = 'Disqualified' or lead_status = 'Disqualified'))
  ) from x;
$f$;

revoke all on function public.prepass_segment_crossover(text,date,date) from public, anon, authenticated;
grant execute on function public.prepass_segment_crossover(text,date,date) to service_role;
revoke all on function public.prepass_fd360_quality(date,date) from public, anon, authenticated;
grant execute on function public.prepass_fd360_quality(date,date) to service_role;

-- How much of online enrollment can be tied to a campaign (cohort: people who enrolled online in the window).
create or replace function public.prepass_enrollment_tracking(p_start date, p_end date)
 returns jsonb language sql stable security definer
 set search_path to 'pg_catalog','public','mk'
 set statement_timeout to '30s'
as $f$
  with e as (
    select f.id, f.date_closed_won, a.segment
    from mk.mv_person_funnel f left join mk.mv_person_assign a on a.id = f.id
    where f.channel = 'online_enrollment' and f.created_at >= p_start and f.created_at < p_end + 1
  ),
  q as (
    select q.marketo_person_id::text as pid, bool_or(q.attribution is not null and q.attribution::text not in ('{}','null')) as has_attr
    from public.prepass_self_enrollment_attribution_queue q where q.marketo_person_id is not null group by 1
  )
  select jsonb_build_object(
    'enrollments', count(*), 'captured', count(q.pid), 'with_source_data', count(*) filter (where q.has_attr),
    'credited', count(*) filter (where e.segment is not null), 'won', count(*) filter (where e.date_closed_won is not null),
    'won_credited', count(*) filter (where e.date_closed_won is not null and e.segment is not null)
  ) from e left join q on q.pid = e.id::text;
$f$;
revoke all on function public.prepass_enrollment_tracking(date,date) from public, anon, authenticated;
grant execute on function public.prepass_enrollment_tracking(date,date) to service_role;
