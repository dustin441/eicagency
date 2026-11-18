-- PrePass Sales Overview: opportunity outcomes and why deals are lost. ADDITIVE and read-only.
-- Uses Marketo "Update Opportunity" activity (custom types 100002 contact, 100005 account) loaded in mk.activity from 2026-05-18.
-- mk.mv_person_pipeline summarizes each person's opportunity changes: phase times, Won/Lost, type, last loss reason.
-- LIMIT: Marketo writes Discovery, Forecasted Sale and Close almost at the same moment, so time in stage is NOT measurable.
-- Cohort starts 2026-06-01 (earliest date with full update coverage). service_role only.
-- mk.refresh_summaries() also refreshes mv_person_opp and mv_person_pipeline each night.
-- Rollback: drop function public.prepass_opportunity_pipeline(date, date); drop materialized view mk.mv_person_pipeline;

create materialized view if not exists mk.mv_person_pipeline as
with ch as (
  select a.person_id, a.occurred_at as t, c->>'Attribute Name' as attr, c->>'New Value' as nv
  from mk.activity a cross join lateral jsonb_array_elements(a.attrs->'Data Value Changes') c
  where a.type_id in (100002, 100005) and a.person_id is not null and jsonb_typeof(a.attrs->'Data Value Changes') = 'array'
    and c->>'Attribute Name' in ('Pipeline Phase','Stage','Status Reason','Opportunity Type')
)
select person_id,
  min(t) filter (where attr = 'Pipeline Phase' and nv ~* 'discovery') as t_discovery,
  min(t) filter (where attr = 'Pipeline Phase' and nv ~* 'proposal') as t_proposal,
  min(t) filter (where attr = 'Pipeline Phase' and nv ~* 'negotiation') as t_negotiation,
  min(t) filter (where attr = 'Pipeline Phase' and nv ~* 'forecasted') as t_forecast,
  min(t) filter (where attr = 'Pipeline Phase' and nv ~* 'close') as t_close,
  min(t) filter (where attr = 'Stage' and nv = 'Won') as t_won,
  min(t) filter (where attr = 'Stage' and nv = 'Lost') as t_lost,
  (array_agg(nv order by t) filter (where attr = 'Opportunity Type'))[1] as opp_type,
  (array_agg(nv order by t desc) filter (where attr = 'Status Reason' and nv not in ('In Progress','Won')))[1] as lost_reason
from ch group by person_id;
create unique index if not exists mv_person_pipeline_pk on mk.mv_person_pipeline (person_id);
revoke all on mk.mv_person_pipeline from anon, authenticated;

create or replace function public.prepass_opportunity_pipeline(p_start date, p_end date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public', 'mk'
 set statement_timeout to '45s'
as $function$
declare
  v_start date := greatest(p_start, date '2026-06-01');
  v_end date := p_end;
  result jsonb;
begin
  with base as (
    select f.id, f.created_at, p.*,
      case when p.t_won is not null then 'won' when p.t_lost is not null then 'lost' else 'open' end as outcome,
      case when p.t_discovery is not null then 'sales' else 'auto' end as path
    from mk.mv_person_funnel f join mk.mv_person_pipeline p on p.person_id = f.id
    where f.created_at >= v_start and f.created_at < v_end + 1
  ),
  d as (select *, extract(epoch from t_won - created_at) / 86400 as d_won, extract(epoch from t_discovery - created_at) / 86400 as d_disc,
          extract(epoch from t_forecast - t_discovery) / 86400 as d_disc_fc, extract(epoch from t_close - t_forecast) / 86400 as d_fc_close from base)
  select jsonb_build_object(
    'window', jsonb_build_object('start', v_start, 'end', v_end),
    'people_with_opportunity', (select count(*) from base),
    'paths', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'people', n, 'won', w, 'lost', l, 'open', o, 'median_days_to_win', md) order by n desc), '[]'::jsonb)
      from (select path, count(*) n, count(*) filter (where outcome = 'won') w, count(*) filter (where outcome = 'lost') l, count(*) filter (where outcome = 'open') o,
              round((percentile_cont(0.5) within group (order by d_won) filter (where outcome = 'won'))::numeric, 1) md from d group by path) x),
    'types', (select coalesce(jsonb_agg(jsonb_build_object('type', coalesce(opp_type, 'Not set'), 'people', n, 'won', w, 'lost', l, 'open', o) order by n desc), '[]'::jsonb)
      from (select opp_type, count(*) n, count(*) filter (where outcome = 'won') w, count(*) filter (where outcome = 'lost') l, count(*) filter (where outcome = 'open') o from base group by opp_type) x),
    'lost_reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', r, 'people', n, 'sales_path', s) order by n desc), '[]'::jsonb)
      from (select coalesce(lost_reason, 'No reason recorded') r, count(*) n, count(*) filter (where path = 'sales') s from base where outcome = 'lost' group by 1 order by 2 desc limit 10) x),
    'stage_days', jsonb_build_object(
      'created_to_discovery', (select round((percentile_cont(0.5) within group (order by d_disc))::numeric, 1) from d where d_disc is not null and d_disc >= 0),
      'discovery_to_forecast', (select round((percentile_cont(0.5) within group (order by d_disc_fc))::numeric, 1) from d where d_disc_fc is not null and d_disc_fc >= 0),
      'forecast_to_close', (select round((percentile_cont(0.5) within group (order by d_fc_close))::numeric, 1) from d where d_fc_close is not null and d_fc_close >= 0))
  ) into result;
  return result;
end;
$function$;
revoke all on function public.prepass_opportunity_pipeline(date, date) from public, anon, authenticated;
grant execute on function public.prepass_opportunity_pipeline(date, date) to service_role;
