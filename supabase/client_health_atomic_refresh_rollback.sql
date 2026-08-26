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
revoke all on function public.client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz) from public, anon, authenticated, service_role;
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
drop function public.client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz);
drop function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint);
drop function public.client_health_assert_exact_keys(jsonb,text[],text);
drop function public.client_health_canonical_json(jsonb);

-- Preserve every row, additive column, constraint, and index. Old approved direct writers
-- do not populate atomic content hashes, so only their NOT NULL requirement is relaxed.
-- Hash-format checks and uniqueness remain effective for non-null atomic metadata.
alter table public.client_health_snapshots
  alter column persistence_evidence_hash drop not null,
  alter column persistence_idempotency_key drop not null;
alter table public.client_health_refresh_runs
  alter column refresh_identity_hash drop not null,
  alter column run_attempt_id drop not null;

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
