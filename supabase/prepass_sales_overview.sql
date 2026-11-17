-- PrePass Sales Overview (Reporting v2 tab). ADDITIVE and read-only.
-- Reads the Marketo mirror in schema mk (people, channel mapping) and the ad-platform tables already in public.
-- Requires mk.mv_person_funnel (narrow summary; refresh it after each Marketo load).
-- Does not modify, replace or depend on any existing PrePass table, view, workflow or the legacy master_marketing_performance.
-- Called only by the Next.js server through the service role. anon/authenticated cannot execute it.
-- Rollback: drop function public.prepass_sales_overview(date, date);

create or replace function public.prepass_sales_overview(p_start date, p_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, mk
set statement_timeout = '45s'
as $$
declare
  v_end_excl date := p_end + 1;
  result jsonb;
begin
  with pf as (
    select * from mk.mv_person_funnel
  ),
  ev as (   -- every stage counted on the date it happened (outcome-period basis)
    select 'lead'::text as stage, created_at as ts, channel from pf where created_at >= p_start and created_at < v_end_excl
    union all select 'mql', date_mql, channel from pf where date_mql >= p_start and date_mql < v_end_excl
    union all select 'sql', date_sql, channel from pf where date_sql >= p_start and date_sql < v_end_excl
    union all select 'won', date_closed_won, channel from pf where date_closed_won >= p_start and date_closed_won < v_end_excl
  ),
  coh as (  -- people created in the window (acquisition-cohort basis)
    select * from pf where created_at >= p_start and created_at < v_end_excl
  ),
  meta_s as (
    select campaign_id::text as cid, max(campaign_name) as campaign,
           sum(spend)::numeric as spend, sum(clicks)::bigint as clicks, sum(impressions)::bigint as impressions
    from public.meta_campaigns where date between p_start and p_end group by 1
  ),
  meta_f as (
    select utm_campaign_id as cid, count(*) as leads, count(date_mql) as mqls, count(date_sql) as sqls, count(date_closed_won) as won
    from coh where utm_campaign_id is not null group by 1
  ),
  goog_s as (
    select lower(regexp_replace(campaign_name, '[^a-zA-Z0-9]', '', 'g')) as k, max(campaign_name) as campaign,
           sum(cost)::numeric as spend, sum(clicks)::bigint as clicks, sum(impressions)::bigint as impressions
    from public.google_campaigns where date between p_start and p_end group by 1
  ),
  goog_f as (
    select campaign_key as k, count(*) as leads, count(date_mql) as mqls, count(date_sql) as sqls, count(date_closed_won) as won
    from coh where channel = 'paid_search' and campaign_key <> '' group by 1
  ),
  spend_all as (
    select 'Meta'::text as platform, sum(spend)::numeric as spend, sum(impressions)::bigint as impressions, sum(clicks)::bigint as clicks,
           min(date) as first_day, max(date) as last_day, count(distinct date) as days
    from public.meta_campaigns where date between p_start and p_end
    union all
    select 'Google', sum(cost), sum(impressions)::bigint, sum(clicks)::bigint, min(date), max(date), count(distinct date)
    from public.google_campaigns where date between p_start and p_end
    union all
    select 'LinkedIn', sum(spend), sum(impressions)::bigint, sum(clicks)::bigint, min(date), max(date), count(distinct date)
    from public.linkedin_campaign_data where date between p_start and p_end
    union all
    select 'StackAdapt', sum(spend), sum(impressions)::bigint, sum(clicks)::bigint, min(date), max(date), count(distinct date)
    from public.stackadapt_campaigns where date between p_start and p_end
  )
  select jsonb_build_object(
    'window', jsonb_build_object('start', p_start, 'end', p_end),
    'source', (select jsonb_build_object(
        'people_loaded', count(*), 'earliest_created', min(created_at), 'latest_created', max(created_at),
        'data_through', (select max(updated_at) from mk.person),
        'complete_from', (select min(window_start) from mk.sync_run where object = 'person_created' and status = 'ok'),
        'last_sync', (select max(finished_at) from mk.sync_run where status = 'ok'))
      from mk.mv_person_funnel),
    'totals', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from (select stage, count(*) as n from ev group by stage) t),
    'by_channel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'leads', leads, 'mqls', mqls, 'sqls', sqls, 'won', won) order by leads desc), '[]'::jsonb)
      from (select channel,
              count(*) filter (where stage = 'lead') as leads, count(*) filter (where stage = 'mql') as mqls,
              count(*) filter (where stage = 'sql') as sqls, count(*) filter (where stage = 'won') as won
            from ev group by channel) c),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'channel', channel, 'stage', stage, 'n', n) order by m, channel, stage), '[]'::jsonb)
      from (select date_trunc('month', ts)::date as m, channel, stage, count(*) as n from ev group by 1, 2, 3) x),
    'cohort', (select coalesce(jsonb_agg(jsonb_build_object(
        'channel', channel, 'leads', leads, 'mqls', mqls, 'sqls', sqls, 'won', won,
        'days_to_mql', d_mql, 'days_mql_to_sql', d_sql, 'days_sql_to_won', d_won, 'days_created_to_won', d_total) order by leads desc), '[]'::jsonb)
      from (select channel, count(*) as leads, count(date_mql) as mqls, count(date_sql) as sqls, count(date_closed_won) as won,
              round((percentile_cont(0.5) within group (order by days_to_mql))::numeric, 1) as d_mql,
              round((percentile_cont(0.5) within group (order by days_mql_to_sql))::numeric, 1) as d_sql,
              round((percentile_cont(0.5) within group (order by days_sql_to_won))::numeric, 1) as d_won,
              round((percentile_cont(0.5) within group (order by days_created_to_won))::numeric, 1) as d_total
            from coh group by channel) k),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'lead_source', ls, 'utm_medium', um, 'utm_source', us,
        'leads', leads, 'mqls', mqls, 'sqls', sqls, 'won', won) order by leads desc), '[]'::jsonb)
      from (select channel, coalesce(lead_source, '') as ls, coalesce(utm_medium, '') as um, coalesce(utm_source, '') as us,
              count(*) as leads, count(date_mql) as mqls, count(date_sql) as sqls, count(date_closed_won) as won
            from coh group by 1, 2, 3, 4 order by count(*) desc limit 40) s),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('event', us, 'leads', leads, 'mqls', mqls, 'sqls', sqls, 'won', won) order by leads desc), '[]'::jsonb)
      from (select coalesce(utm_source, '(unnamed)') as us, count(*) as leads, count(date_mql) as mqls, count(date_sql) as sqls, count(date_closed_won) as won
            from coh where channel = 'event' group by 1 order by count(*) desc limit 20) e),
    'spend', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'spend', round(spend), 'impressions', impressions, 'clicks', clicks,
        'first_day', first_day, 'last_day', last_day, 'days', days) order by platform), '[]'::jsonb) from spend_all where days > 0),
    'campaigns', (
      select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.spend desc nulls last), '[]'::jsonb) from (
        select 'Meta'::text as platform, s.campaign, round(s.spend) as spend, s.clicks, s.impressions,
               coalesce(f.leads, 0) as leads, coalesce(f.mqls, 0) as mqls, coalesce(f.sqls, 0) as sqls, coalesce(f.won, 0) as won
        from meta_s s left join meta_f f using (cid) where s.spend > 0
        union all
        select 'Google', s.campaign, round(s.spend), s.clicks, s.impressions,
               coalesce(f.leads, 0), coalesce(f.mqls, 0), coalesce(f.sqls, 0), coalesce(f.won, 0)
        from goog_s s left join goog_f f using (k) where s.spend > 0
      ) r),
    'match', jsonb_build_object(
      'meta_people_matched', (select coalesce(sum(f.leads), 0) from meta_f f join meta_s s using (cid)),
      'meta_people_total', (select count(*) from coh where channel = 'paid_social'),
      'google_people_matched', (select coalesce(sum(f.leads), 0) from goog_f f join goog_s s using (k)),
      'google_people_total', (select count(*) from coh where channel = 'paid_search'),
      'meta_spend_matched', (select coalesce(round(sum(s.spend)), 0) from meta_s s join meta_f f using (cid)),
      'google_spend_matched', (select coalesce(round(sum(s.spend)), 0) from goog_s s join goog_f f using (k)))
  ) into result;
  return result;
end;
$$;

revoke all on function public.prepass_sales_overview(date, date) from public, anon, authenticated;
grant execute on function public.prepass_sales_overview(date, date) to service_role;
