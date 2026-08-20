begin;

-- Safety guard: this rollback belongs only in the EIC Clients project.
do $$
begin
  if to_regclass('public.master_spartaco') is null then
    raise exception 'client health rollback must be applied to the EIC Clients project';
  end if;
end
$$;

drop view if exists public.client_health_latest;
drop table if exists public.client_health_snapshot_tasks;
drop table if exists public.client_health_snapshots;
drop table if exists public.client_health_source_runs;
drop table if exists public.client_health_metric_config;
drop table if exists public.client_health_refresh_runs;
drop table if exists public.client_health_clients;
drop function if exists public.client_health_guard_snapshot_task_immutable();
drop function if exists public.client_health_guard_refresh_child_immutable();
drop function if exists public.client_health_guard_refresh_run_immutable();

commit;
