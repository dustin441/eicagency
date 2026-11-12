-- Additive aggregate-only reporting. Apply only after operator approval, never from the app.
-- Full-population receipts MUST explicitly attest reporting_scope and full_field_dictionary.
-- full_replace alone only describes replacement semantics and is NOT proof of full population.
begin;
create or replace function public.prepass_marketo_database_report(
 p_start date default null,p_end date default null,p_source text default null,p_segment text default null,p_source_field text default 'leadSource'
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public set timezone='UTC' as $$
declare v_run public.prepass_marketo_mirror_runs%rowtype; v_result jsonb;
begin
 if p_start > p_end then raise exception 'Invalid acquisition cohort range'; end if;
 if p_source_field is null or p_source_field not in ('leadSource','originalutmsource','originalSourceType','utmsource') then raise exception 'Unsupported source field'; end if;
 select r.* into v_run from public.prepass_marketo_active_snapshot a
 join public.prepass_marketo_mirror_runs r on r.run_id=a.active_run_id where a.singleton and r.status='completed';
 if v_run.run_id is null or v_run.metadata->>'reporting_scope' is distinct from 'all_accessible_people'
 or v_run.metadata->>'full_field_dictionary' is distinct from 'true' then
 return jsonb_build_object('available',false,'reason','Full published Marketo database snapshot with verified population and all accessible fields is not available. Restricted or unverified mirrors are never used.');
 end if;
 with base as materialized (
  select source_created_at::date lead, date_mql mql,date_sql sql,date_won won,date_closed_lost lost,
   coalesce(nullif(btrim(case p_source_field when 'leadSource' then lead_source when 'originalutmsource' then original_utm_source when 'originalSourceType' then original_source_type when 'utmsource' then utm_source end),''),'Unknown') source,
   coalesce(nullif(btrim(utm_source),''),'Unknown') latest_source,
   coalesce(nullif(btrim(fleet_size_segment),''),'Unknown') segment
  from public.prepass_marketo_mirror_contacts where run_id=v_run.run_id
 ), cohort as materialized (
  select * from base where (p_start is null or lead>=p_start) and (p_end is null or lead<=p_end)
   and (p_source is null or source=p_source) and (p_segment is null or segment=p_segment)
 ), totals as (
  select count(*) people,count(mql) mql,count(sql) sql,count(won) won,
   count(*) filter(where mql is not null and sql is not null) mql_sql,
   count(*) filter(where sql is not null and won is not null) sql_won,
   count(*) filter(where source='Unknown') unknown_source,count(*) filter(where lead is null) missing_lead_date,
   count(*) filter(where mql<lead or sql<mql or won<sql or won<lead or lead>v_run.completed_at::date or mql>v_run.completed_at::date or sql>v_run.completed_at::date or won>v_run.completed_at::date) invalid_transitions,
   count(lead) lead_dates,count(mql) mql_dates,count(sql) sql_dates,count(won) won_dates from cohort
 ), intervals as (
  select x.label,x.days from cohort c cross join lateral (values
   ('Lead → MQL',case when c.lead<=c.mql and c.mql<=v_run.completed_at::date then c.mql-c.lead end),
   ('MQL → SQL',case when c.mql<=c.sql and c.sql<=v_run.completed_at::date then c.sql-c.mql end),
   ('SQL → Won',case when c.sql<=c.won and c.won<=v_run.completed_at::date then c.won-c.sql end),
   ('Lead → Won',case when c.lead<=c.won and c.won<=v_run.completed_at::date then c.won-c.lead end)
  ) x(label,days)
 ), velocity as (
  select label,count(days) n,percentile_cont(0.5) within group(order by days) median_days from intervals group by label
 ), open_stages as (
  select case when sql is not null then 'SQL' when mql is not null then 'MQL' else 'Lead' end stage,
   case when sql is not null then sql when mql is not null then mql else lead end entered
  from cohort where won is null and lost is null
 ), aging as (
  select stage,count(*) people,count(*) filter(where entered<=v_run.completed_at::date) valid_dates,
   percentile_cont(0.5) within group(order by v_run.completed_at::date-entered) filter(where entered<=v_run.completed_at::date) median_days,
   count(*) filter(where entered<=v_run.completed_at::date and v_run.completed_at::date-entered>90) over_90_days
  from open_stages group by stage
 )
 select jsonb_build_object('available',true,'completed_at',v_run.completed_at,'freshness_hours',extract(epoch from (now()-v_run.completed_at))/3600,'field_count',v_run.field_count,
  'lifetime',(select jsonb_build_object('people',count(*),'mql',count(mql),'sql',count(sql),'won',count(won)) from base),
  'cohort',(select to_jsonb(t) from totals t),
  'fields',jsonb_build_object('mql',coalesce(v_run.metadata->'requested_fields' ? 'dateMQL',false),'sql',coalesce(v_run.metadata->'requested_fields' ? 'dateSQL',false),'won',coalesce(v_run.metadata->'requested_fields' ? 'dateClosedWon',false)),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.people desc,s.label) from (select source label,count(*) people,count(mql) mql,count(sql) sql,count(won) won,count(*) filter(where lead<=won and won<=v_run.completed_at::date) won_pairs,percentile_cont(0.5) within group(order by won-lead) filter(where lead<=won and won<=v_run.completed_at::date) median_won_days from cohort group by source) s),'[]'::jsonb),
  'latest_sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.people desc,s.label) from (select latest_source label,count(*) people from cohort group by latest_source) s),'[]'::jsonb),
  'source_options',(select jsonb_agg(source order by source) from (select distinct source from base) s),
  'segment_options',(select jsonb_agg(segment order by segment) from (select distinct segment from base) s),
  'velocity',coalesce((select jsonb_agg(to_jsonb(v) order by case label when 'Lead → MQL' then 1 when 'MQL → SQL' then 2 when 'SQL → Won' then 3 else 4 end) from velocity v),'[]'::jsonb),
  'aging',coalesce((select jsonb_agg(to_jsonb(a) order by stage) from aging a),'[]'::jsonb),
  'missing_acquisition_dates',(select count(*) from base where lead is null)) into v_result;
 return v_result;
end $$;
revoke all on function public.prepass_marketo_database_report(date,date,text,text,text) from public,anon,authenticated;
grant execute on function public.prepass_marketo_database_report(date,date,text,text,text) to service_role;
comment on function public.prepass_marketo_database_report(date,date,text,text,text) is 'Aggregate-only full verified Marketo snapshot. Date filters are lead-created acquisition cohorts, never outcome windows. Source fields stay separate with no attribution fallback. No person identifiers or payloads returned.';
commit;
