begin;

-- Post-apply readback showed Supabase default privileges had granted
-- service_role REFERENCES, TRIGGER, and TRUNCATE in addition to runtime CRUD.
-- Remove inherited/default explicit grants and restore the approved least-privilege set.
revoke all on table public.client_health_clients from service_role;
revoke all on table public.client_health_refresh_runs from service_role;
revoke all on table public.client_health_metric_config from service_role;
revoke all on table public.client_health_source_runs from service_role;
revoke all on table public.client_health_snapshots from service_role;
revoke all on table public.client_health_snapshot_tasks from service_role;
revoke all on table public.client_health_latest from service_role;

revoke all on function public.client_health_guard_refresh_run_immutable() from service_role;
revoke all on function public.client_health_guard_refresh_child_immutable() from service_role;
revoke all on function public.client_health_guard_snapshot_task_immutable() from service_role;

grant select, insert, update, delete on table public.client_health_clients to service_role;
grant select, insert, update, delete on table public.client_health_refresh_runs to service_role;
grant select, insert, update, delete on table public.client_health_metric_config to service_role;
grant select, insert, update, delete on table public.client_health_source_runs to service_role;
grant select, insert, update, delete on table public.client_health_snapshots to service_role;
grant select, insert, update, delete on table public.client_health_snapshot_tasks to service_role;
grant select on table public.client_health_latest to service_role;

commit;
