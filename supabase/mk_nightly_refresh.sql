-- Marketo mirror: nightly refresh of the summary tables the Sales Overview reads. ADDITIVE (schema mk only).
-- Runs mk.refresh_summaries() at 07:10 UTC (about 1 AM US Central) through pg_cron. Each table refreshes without
-- blocking readers. Takes about 1.5 minutes. If it fails, the old numbers stay in place; see mk.refresh_log.
-- Rollback: select cron.unschedule('mk-refresh-summaries-nightly'); drop function mk.refresh_summaries(); drop table mk.refresh_log;

create table if not exists mk.refresh_log (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  detail text
);
alter table mk.refresh_log enable row level security;
revoke all on mk.refresh_log from anon, authenticated;

create or replace function mk.refresh_summaries() returns text
language plpgsql security definer
set search_path = pg_catalog, mk
set statement_timeout = '20min'
as $$
declare v_id bigint; v_obj text; v_ts timestamptz;
begin
  insert into mk.refresh_log default values returning id into v_id;
  foreach v_obj in array array['mv_person_funnel','mv_person_segments','mv_person_phone','mv_cohort','mv_stage_events'] loop
    v_ts := clock_timestamp();
    execute format('refresh materialized view concurrently mk.%I', v_obj);
    update mk.refresh_log set detail = coalesce(detail || ', ', '') || v_obj || ' ' || round(extract(epoch from clock_timestamp() - v_ts)::numeric, 1) || 's' where id = v_id;
  end loop;
  update mk.refresh_log set status = 'ok', finished_at = now() where id = v_id;
  return 'ok';
exception when others then
  update mk.refresh_log set status = 'failed', finished_at = now(), detail = coalesce(detail || ' | ', '') || sqlerrm where id = v_id;
  raise;
end $$;
revoke all on function mk.refresh_summaries() from public, anon, authenticated;

select cron.schedule('mk-refresh-summaries-nightly', '10 7 * * *', $$select mk.refresh_summaries()$$);
