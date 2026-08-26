begin;

-- PROPOSAL ONLY. Compatibility rollback for the EIC Clients project.
-- It removes the atomic RPC write surface without deleting lifecycle/evidence rows or
-- additive metadata. Dustin's explicit approval is required before any apply.
do $$
begin
  if to_regclass('public.master_spartaco') is null then
    raise exception 'client health atomic refresh rollback must be applied to the EIC Clients project';
  end if;
  if to_regclass('public.client_health_refresh_runs') is null
     or to_regclass('public.client_health_source_runs') is null
     or to_regclass('public.client_health_snapshots') is null
     or to_regclass('public.client_health_snapshot_tasks') is null then
    raise exception 'client health atomic refresh rollback requires the approved EIC foundation';
  end if;
  if to_regprocedure('public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)') is null
     or to_regprocedure('public.client_health_canonical_json(jsonb)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'client_health_refresh_runs'
         and column_name = 'lease_fencing_token'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'client_health_snapshots'
         and column_name = 'persistence_idempotency_key'
     ) then
    raise exception 'client health atomic refresh rollback requires a complete atomic-refresh installation';
  end if;
end
$$;

-- Revoke the complete runtime/helper surface before dropping it. Helpers were never
-- API-callable, but explicit revocation keeps rollback fail-closed if a later DROP fails.
revoke all on function public.client_health_create_config_revision(uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_config_revision(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_refresh_run(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_refresh_lease(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_source_run(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_refresh_integrity(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_config_revision(uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_safe_revision_json(jsonb,text,integer) from public, anon, authenticated, service_role;
revoke all on function public.client_health_revision_id(text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_exact_keys(jsonb,text[],text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_canonical_json(jsonb) from public, anon, authenticated, service_role;

-- Drop callers before callees. No CASCADE: an unexpected dependent aborts rollback.
drop function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint);
drop function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint);
drop function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint);
drop function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint);
drop function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint);
drop function public.client_health_get_source_run(uuid,uuid,uuid,bigint);
drop function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint);
drop function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz);
drop function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint);
drop function public.client_health_get_refresh_lease(uuid);
drop function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint);
drop function public.client_health_get_refresh_run(uuid);
drop function public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz);
drop function public.client_health_get_config_revision(uuid);
drop function public.client_health_create_config_revision(uuid,text,jsonb);
drop function public.client_health_assert_refresh_integrity(uuid);
drop function public.client_health_assert_config_revision(uuid,text,jsonb);
drop function public.client_health_assert_safe_revision_json(jsonb,text,integer);
drop function public.client_health_revision_id(text);
drop function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint);
drop function public.client_health_assert_exact_keys(jsonb,text[],text);
drop function public.client_health_canonical_json(jsonb);

-- Restore the approved foundation trigger body for legacy mutable-authoring publication.
create or replace function public.client_health_guard_refresh_run_immutable()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 20260820));
    if new.run_status <> 'collecting' then raise exception 'client health refreshes must be inserted in collecting state'; end if;
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.id::text, 20260820));
  if old.run_status = 'published' then raise exception 'published client health refreshes are immutable'; end if;
  if tg_op = 'UPDATE' and new.run_status = 'published' then
    if not exists (select 1 from public.client_health_snapshots s where s.refresh_run_id = new.id) then raise exception 'a client health refresh cannot publish without snapshots'; end if;
    if exists (select 1 from public.client_health_clients c where c.active and not exists (select 1 from public.client_health_snapshots s where s.refresh_run_id=new.id and s.client_id=c.id)) then raise exception 'a client health refresh cannot publish without a snapshot for every active client'; end if;
    if exists (select 1 from public.client_health_clients c where c.active and not exists (select 1 from public.client_health_source_runs sr where sr.refresh_run_id=new.id and sr.client_id=c.id)) then raise exception 'a client health refresh cannot publish without source evidence for every active client'; end if;
    if exists (select 1 from public.client_health_source_runs sr where sr.refresh_run_id=new.id and sr.run_status='running') then raise exception 'a client health refresh cannot publish while source collection is running'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
alter function public.client_health_guard_refresh_run_immutable() owner to postgres;
revoke all on function public.client_health_guard_refresh_run_immutable() from public, anon, authenticated, service_role;

-- Preserve every row, additive column, constraint, and index. Old approved direct writers
-- do not populate atomic content hashes, so only their NOT NULL requirement is relaxed.
-- Hash-format checks and uniqueness remain effective for non-null atomic metadata.
alter table public.client_health_snapshots
  alter column config_revision_id drop not null,
  alter column config_revision_hash drop not null,
  alter column persistence_evidence_hash drop not null,
  alter column persistence_idempotency_key drop not null;
alter table public.client_health_refresh_runs
  alter column config_revision_id drop not null,
  alter column config_revision_hash drop not null,
  alter column refresh_identity_hash drop not null,
  alter column run_attempt_id drop not null;

-- Restore the exact foundation latest view so new nullable legacy rows remain visible.
-- The immutable revision table and additive provenance columns remain preserved separately.
drop view public.client_health_latest;
create view public.client_health_latest with (security_invoker = true) as
select distinct on (s.client_id)
  s.id, s.refresh_run_id, s.client_id, s.snapshot_date, s.data_through,
  s.budget, s.month_spend, s.expected_spend,
  s.current_window_start, s.current_window_end, s.current_spend,
  s.current_result_count, s.current_cost_per_result,
  s.previous_window_start, s.previous_window_end, s.previous_spend,
  s.previous_result_count, s.previous_cost_per_result,
  s.hours_used, s.hours_allotted, s.projected_hours, s.overdue_task_count,
  s.revenue, s.fulfillment_cost, s.margin_percent,
  s.dimension_statuses, s.source_statuses, s.overall_status, s.overall_score,
  s.reasons, s.calculated_at, s.created_at, s.updated_at,
  r.calculation_version, r.source_contract_version, r.evidence_hash
from public.client_health_snapshots s
join public.client_health_clients c on c.id = s.client_id
join public.client_health_refresh_runs r on r.id = s.refresh_run_id
where c.active = true and r.run_status = 'published'
order by s.client_id, r.snapshot_date desc, r.published_at desc, r.id desc, s.id desc;
revoke all on table public.client_health_latest from public, anon, authenticated, service_role;
grant select on table public.client_health_latest to service_role;

-- Restore the exact approved foundation service-role CRUD set. RLS and immutability
-- triggers remain in place; browser roles still receive no direct DML privileges.
grant insert, update, delete on table public.client_health_refresh_runs to service_role;
grant insert, update, delete on table public.client_health_source_runs to service_role;
grant insert, update, delete on table public.client_health_snapshots to service_role;
grant insert, update, delete on table public.client_health_snapshot_tasks to service_role;

comment on column public.client_health_snapshots.persistence_evidence_hash is
  'Residual inert atomic-refresh metadata after compatibility rollback; nullable for legacy direct writers. Preserve for forward repair.';
comment on column public.client_health_snapshots.persistence_idempotency_key is
  'Residual inert atomic-refresh metadata after compatibility rollback; nullable for legacy direct writers. Preserve for forward repair.';
comment on column public.client_health_refresh_runs.lease_fencing_token is
  'Residual inert monotonic fence after compatibility rollback. Do not reset; forward repair reuses preserved values.';
comment on column public.client_health_refresh_runs.refresh_identity_hash is
  'Residual immutable logical-plan SHA-256 after compatibility rollback. Preserve for audit and forward repair.';
comment on column public.client_health_refresh_runs.run_attempt_id is
  'Residual per-execution attempt UUID after compatibility rollback. Preserve for audit and forward repair.';

commit;
