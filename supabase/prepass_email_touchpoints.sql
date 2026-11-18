-- PrePass Sales Overview: email touchpoints and nurture gaps. ADDITIVE and read-only.
-- Uses mk.email_touch (Marketo send/open/click/unsubscribe per person) and mk.mv_person_funnel.
-- Email families, from the Marketo program name (the part before the first dot):
--   blast    : "ES-..." one-off newsletters and announcements sent to large lists
--   nurture  : "ENG-..." engagement programs (new DOT authority, SMB, mobile enrollment reminders, contact request, 2026 Nurture) and "Tolls Email n"
--   other    : everything else
-- Cohort = people created inside the window that the email history fully covers (history loads newest first, so coverage
-- starts at the oldest loaded window). Outcomes are "so far", not a fixed horizon, and exposure only counts emails sent BEFORE the win.
-- No win-rate-by-exposure is returned on purpose: nurture goes to people who have NOT converted, so people with no nurture email look better
-- (fast sign-ups never need it) and the comparison would wrongly suggest nurture hurts. Measuring its effect needs a holdout test.
-- Opens are inflated by mail privacy features; clicks are the signal to trust. service_role only.
-- Rollback: drop function public.prepass_email_touchpoints(date, date);

create or replace function public.prepass_email_touchpoints(p_start date, p_end date)
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
  with e as (
    select person_id, type_id, occurred_at, email_name,
           case when email_name ~* '^es-' then 'blast'
                when email_name ~* '^(eng-|tolls email)' then 'nurture' else 'other' end as fam
    from mk.email_touch
    where occurred_at >= v_start and occurred_at < p_end + 1 and person_id is not null
  ),
  cohort as (
    select id, created_at, channel, date_mql, date_closed_won
    from mk.mv_person_funnel
    where created_at >= v_start and created_at < p_end + 1
  ),
  per as (
    select c.id, c.channel, c.created_at, c.date_mql, c.date_closed_won,
           count(*) filter (where x.type_id = 6 and x.fam = 'nurture' and (c.date_closed_won is null or x.occurred_at < c.date_closed_won)) as nurture_sends,
           count(*) filter (where x.type_id = 6 and x.fam = 'blast') as blast_sends,
           count(*) filter (where x.type_id = 11 and x.fam = 'nurture' and (c.date_closed_won is null or x.occurred_at < c.date_closed_won)) as nurture_clicks,
           min(x.occurred_at) filter (where x.type_id = 6 and x.fam = 'nurture') as first_nurture
    from cohort c left join e x on x.person_id = c.id
    group by c.id, c.channel, c.created_at, c.date_mql, c.date_closed_won
  )
  select jsonb_build_object(
    'available', true,
    'window', jsonb_build_object('start', v_start, 'end', p_end, 'history_from', v_from),
    'families', (select coalesce(jsonb_agg(jsonb_build_object('fam', fam, 'sends', s, 'people', p, 'opens', o, 'clicks', c, 'unsubs', u) order by s desc), '[]'::jsonb)
      from (select fam, count(*) filter (where type_id = 6) s, count(distinct person_id) filter (where type_id = 6) p,
              count(*) filter (where type_id = 10) o, count(*) filter (where type_id = 11) c, count(*) filter (where type_id = 9) u
            from e group by fam) x),
    'programs', (select coalesce(jsonb_agg(jsonb_build_object('program', program, 'sends', s, 'people', p, 'clicks', c, 'unsubs', u) order by s desc), '[]'::jsonb)
      from (select split_part(email_name, '.', 1) program, count(*) filter (where type_id = 6) s, count(distinct person_id) filter (where type_id = 6) p,
              count(*) filter (where type_id = 11) c, count(*) filter (where type_id = 9) u
            from e where fam = 'nurture' group by 1 having count(*) filter (where type_id = 6) > 0 order by 2 desc limit 12) x),
    'gaps_by_channel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'people', n, 'not_won', nw, 'not_won_no_nurture', nn, 'mqls_no_nurture', mn) order by nn desc), '[]'::jsonb)
      from (select channel, count(*) n, count(*) filter (where date_closed_won is null) nw,
              count(*) filter (where date_closed_won is null and nurture_sends = 0) nn,
              count(*) filter (where date_closed_won is null and date_mql is not null and nurture_sends = 0) mn
            from per group by channel) x),
    'first_touch', jsonb_build_object(
      'people_with_nurture', (select count(*) from per where nurture_sends > 0),
      'median_hours_to_first_nurture', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_nurture - created_at) / 3600))::numeric, 1) from per where first_nurture is not null),
      'people', (select count(*) from per))
  ) into result;
  return result;
end;
$function$;

revoke all on function public.prepass_email_touchpoints(date, date) from public, anon, authenticated;
grant execute on function public.prepass_email_touchpoints(date, date) to service_role;
