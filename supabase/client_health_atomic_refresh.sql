begin;

-- PROPOSAL ONLY. Dustin's explicit approval is required before any EIC Management API apply.
-- This migration is intentionally EIC-only and assumes the approved foundation is installed.
do $$
declare
  v_missing text[];
  v_owner name;
begin
  if to_regclass('public.master_spartaco') is null then
    raise exception 'client health atomic refresh must be applied to the EIC Clients project';
  end if;

  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pgcrypto')
     or to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'client health atomic refresh requires pgcrypto digest in the extensions schema';
  end if;

  select array_agg(required_object order by required_object)
  into v_missing
  from unnest(array[
    'public.client_health_clients',
    'public.client_health_refresh_runs',
    'public.client_health_source_runs',
    'public.client_health_snapshots',
    'public.client_health_snapshot_tasks',
    'public.client_health_latest'
  ]) required_object
  where to_regclass(required_object) is null;
  if v_missing is not null then
    raise exception 'client health atomic refresh preflight missing objects: %', v_missing;
  end if;

  if to_regprocedure('public.client_health_guard_refresh_run_immutable()') is null
     or to_regprocedure('public.client_health_guard_refresh_child_immutable()') is null
     or to_regprocedure('public.client_health_guard_snapshot_task_immutable()') is null then
    raise exception 'client health atomic refresh preflight requires approved immutability functions';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_health_refresh_runs'
      and column_name in ('refresh_identity_hash', 'run_attempt_id', 'lease_invocation_id', 'lease_claim_attempt_id', 'lease_granted_at', 'lease_expires_at', 'lease_fencing_token')
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_health_snapshots'
      and column_name in ('persistence_evidence_hash', 'persistence_idempotency_key')
  ) then
    raise exception 'client health atomic refresh preflight found a partial or prior atomic-refresh installation';
  end if;

  -- Caller-generated identities and content hashes cannot be reconstructed safely.
  -- Abort instead of silently grandfathering rows that could bypass exact reconciliation.
  if exists (select 1 from public.client_health_refresh_runs)
     or exists (select 1 from public.client_health_source_runs)
     or exists (select 1 from public.client_health_snapshots)
     or exists (select 1 from public.client_health_snapshot_tasks) then
    raise exception 'client health atomic refresh preflight requires empty lifecycle/evidence tables';
  end if;

  select r.rolname into v_owner
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres' and not r.rolsuper is false;
  if v_owner is null then
    raise exception 'client health atomic refresh requires the non-login-safe postgres owner role';
  end if;

  if not pg_catalog.pg_has_role(current_user, 'postgres', 'MEMBER') then
    raise exception 'client health atomic refresh must be installed by postgres or a postgres member';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.client_health_refresh_runs'::regclass
      and tgname = 'client_health_refresh_runs_immutable' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.client_health_source_runs'::regclass
      and tgname = 'client_health_source_runs_immutable' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.client_health_snapshots'::regclass
      and tgname = 'client_health_snapshots_immutable' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.client_health_snapshot_tasks'::regclass
      and tgname = 'client_health_snapshot_tasks_immutable' and not tgisinternal
  ) then
    raise exception 'client health atomic refresh preflight requires approved immutability triggers';
  end if;
end
$$;

alter table public.client_health_refresh_runs
  add column refresh_identity_hash text not null,
  add column run_attempt_id uuid not null,
  add column lease_invocation_id uuid,
  add column lease_claim_attempt_id uuid,
  add column lease_granted_at timestamptz,
  add column lease_expires_at timestamptz,
  add column lease_fencing_token bigint not null default 0,
  add constraint client_health_refresh_runs_lease_fence_nonnegative
    check (lease_fencing_token >= 0),
  add constraint client_health_refresh_runs_identity_hash
    check (refresh_identity_hash ~ '^[0-9a-f]{64}$'),
  add constraint client_health_refresh_runs_attempt_unique unique (run_attempt_id),
  add constraint client_health_refresh_runs_lease_shape
    check (
      (lease_invocation_id is null and lease_claim_attempt_id is null and lease_granted_at is null and lease_expires_at is null)
      or
      (lease_invocation_id is not null and lease_claim_attempt_id is not null and lease_granted_at is not null
       and lease_expires_at is not null and lease_expires_at > lease_granted_at and lease_fencing_token > 0)
    );

alter table public.client_health_snapshots
  add column persistence_evidence_hash text not null,
  add column persistence_idempotency_key text not null,
  add constraint client_health_snapshots_persistence_evidence_hash
    check (persistence_evidence_hash ~ '^[0-9a-f]{64}$'),
  add constraint client_health_snapshots_persistence_idempotency_key
    check (persistence_idempotency_key ~ '^[0-9a-f]{64}$'),
  add constraint client_health_snapshots_idempotency_unique unique (persistence_idempotency_key);

create index client_health_refresh_runs_lease_expiry_idx
  on public.client_health_refresh_runs (lease_expires_at)
  where lease_invocation_id is not null;

create unique index client_health_refresh_runs_active_identity_unique
  on public.client_health_refresh_runs (refresh_identity_hash)
  where run_status in ('collecting', 'validated');

create function public.client_health_assert_exact_keys(p_value jsonb, p_keys text[], p_field text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actual text[];
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    raise exception '% must be a JSON object', p_field;
  end if;
  select pg_catalog.array_agg(key order by key) into v_actual
  from pg_catalog.jsonb_object_keys(p_value) key;
  if coalesce(v_actual, '{}'::text[]) <> (
    select pg_catalog.array_agg(key order by key) from pg_catalog.unnest(p_keys) key
  ) then
    raise exception '% has an incompatible key set', p_field;
  end if;
end
$$;

-- Matches evidence.ts for the supported JSON domain: null, booleans, strings, finite
-- ordinary-decimal numbers, arrays, and objects. jsonb rejects unsupported JS values.
create function public.client_health_canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
strict
security definer
set search_path = pg_catalog
as $$
declare
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_text text;
begin
  if v_type in ('null', 'boolean', 'string') then return p_value::text; end if;
  if v_type = 'number' then
    v_text := p_value::text;
    if v_text ~ '[eE]' then raise exception 'canonical JSON does not support exponent-form bundle numbers'; end if;
    if pg_catalog.strpos(v_text, '.') > 0 then v_text := pg_catalog.rtrim(pg_catalog.rtrim(v_text, '0'), '.'); end if;
    if v_text = '-0' then v_text := '0'; end if;
    return v_text;
  end if;
  if v_type = 'array' then
    return '[' || coalesce((select pg_catalog.string_agg(public.client_health_canonical_json(value), ',' order by ordinal)
      from pg_catalog.jsonb_array_elements(p_value) with ordinality item(value, ordinal)), '') || ']';
  end if;
  if v_type = 'object' then
    return '{' || coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(key)::text || ':' || public.client_health_canonical_json(value), ',' order by key)
      from pg_catalog.jsonb_each(p_value)), '') || '}';
  end if;
  raise exception 'unsupported canonical JSON type: %', v_type;
end
$$;

create function public.client_health_assert_owned_lease(
  p_refresh_run_id uuid,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns public.client_health_refresh_runs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
begin
  if p_fencing_token is null or p_fencing_token < 1 then
    raise exception 'client health lease fence must be positive';
  end if;
  select * into v_run
  from public.client_health_refresh_runs
  where id = p_refresh_run_id
  for update;
  if not found then
    raise exception 'client health refresh run not found';
  end if;
  if v_run.run_status not in ('collecting', 'validated')
     or v_run.lease_invocation_id is distinct from p_invocation_id
     or v_run.lease_claim_attempt_id is distinct from p_claim_attempt_id
     or v_run.lease_fencing_token <> p_fencing_token
     or v_run.lease_expires_at is null
     or v_run.lease_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'client health lease is expired, stale, or owned by another execution';
  end if;
  return v_run;
end
$$;

create function public.client_health_create_refresh_run(
  p_id uuid,
  p_refresh_identity_hash text,
  p_run_attempt_id uuid,
  p_snapshot_date date,
  p_calculation_version text,
  p_source_contract_version text,
  p_started_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
  v_active public.client_health_refresh_runs%rowtype;
  v_now timestamptz;
begin
  if p_refresh_identity_hash is null or p_refresh_identity_hash !~ '^[0-9a-f]{64}$' or p_run_attempt_id is null
     or p_calculation_version is null or p_calculation_version = '' or p_calculation_version <> pg_catalog.btrim(p_calculation_version)
     or p_source_contract_version is null or p_source_contract_version = '' or p_source_contract_version <> pg_catalog.btrim(p_source_contract_version)
     or p_started_at is null then
    raise exception 'client health refresh identity is malformed';
  end if;

  -- Serialize the logical identity with both 32-bit halves of 64 hash bits. The
  -- partial unique index is the final invariant backstop if an advisory collision occurs.
  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(p_refresh_identity_hash, 1, 8))::bit(32)::int),
    (('x' || pg_catalog.substr(p_refresh_identity_hash, 9, 8))::bit(32)::int)
  );
  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());

  select * into v_run from public.client_health_refresh_runs where id = p_id or run_attempt_id = p_run_attempt_id for update;
  if found then
    if v_run.id <> p_id or v_run.refresh_identity_hash <> p_refresh_identity_hash
       or v_run.run_attempt_id <> p_run_attempt_id or v_run.snapshot_date <> p_snapshot_date
       or v_run.calculation_version <> p_calculation_version
       or v_run.source_contract_version <> p_source_contract_version or v_run.started_at <> p_started_at then
      raise exception 'client health refresh caller ID or attempt exists with incompatible identity';
    end if;
    return pg_catalog.jsonb_build_object(
      'id', v_run.id, 'refreshIdentityHash', v_run.refresh_identity_hash, 'runAttemptId', v_run.run_attempt_id,
      'status', v_run.run_status, 'snapshotDate', v_run.snapshot_date,
      'calculationVersion', v_run.calculation_version, 'sourceContractVersion', v_run.source_contract_version,
      'startedAt', pg_catalog.to_char(v_run.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  select * into v_active from public.client_health_refresh_runs
  where refresh_identity_hash = p_refresh_identity_hash and run_status in ('collecting', 'validated')
  for update;
  if found then
    if v_active.lease_expires_at is not null and v_active.lease_expires_at > v_now then
      raise exception 'client health refresh identity has an active leased attempt';
    end if;
    update public.client_health_refresh_runs set
      run_status = 'failed', finished_at = case when v_now > v_active.started_at then v_now else v_active.started_at end,
      error_code = 'refresh_attempt_superseded',
      error_message = 'Client health refresh attempt was superseded.',
      lease_invocation_id = null, lease_claim_attempt_id = null,
      lease_granted_at = null, lease_expires_at = null
    where id = v_active.id;
  end if;

  insert into public.client_health_refresh_runs (
    id, refresh_identity_hash, run_attempt_id, snapshot_date, run_status, calculation_version, source_contract_version, started_at
  ) values (
    p_id, p_refresh_identity_hash, p_run_attempt_id, p_snapshot_date, 'collecting', p_calculation_version, p_source_contract_version, p_started_at
  );

  select * into v_run from public.client_health_refresh_runs where id = p_id;
  if v_run.id is null
     or v_run.snapshot_date <> p_snapshot_date
     or v_run.refresh_identity_hash <> p_refresh_identity_hash
     or v_run.run_attempt_id <> p_run_attempt_id
     or v_run.run_status <> 'collecting'
     or v_run.calculation_version <> p_calculation_version
     or v_run.source_contract_version <> p_source_contract_version
     or v_run.started_at <> p_started_at then
    raise exception 'client health refresh caller ID exists with incompatible identity or state';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_run.id, 'refreshIdentityHash', v_run.refresh_identity_hash, 'runAttemptId', v_run.run_attempt_id,
    'status', v_run.run_status, 'snapshotDate', v_run.snapshot_date,
    'calculationVersion', v_run.calculation_version, 'sourceContractVersion', v_run.source_contract_version,
    'startedAt', pg_catalog.to_char(v_run.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$$;

create function public.client_health_get_refresh_run(p_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select pg_catalog.jsonb_build_object(
    'id', r.id, 'refreshIdentityHash', r.refresh_identity_hash, 'runAttemptId', r.run_attempt_id,
    'status', r.run_status, 'snapshotDate', r.snapshot_date,
    'calculationVersion', r.calculation_version, 'sourceContractVersion', r.source_contract_version,
    'startedAt', pg_catalog.to_char(r.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
  from public.client_health_refresh_runs r where r.id = p_id
$$;

create function public.client_health_acquire_refresh_lease(
  p_refresh_run_id uuid,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_lease_duration_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
  v_now timestamptz;
begin
  if p_lease_duration_ms is null or p_lease_duration_ms < 1 or p_lease_duration_ms > 600000 then
    raise exception 'client health lease duration must be between 1 and 600000 milliseconds';
  end if;
  select * into v_run from public.client_health_refresh_runs where id = p_refresh_run_id for update;
  if not found or v_run.run_status <> 'collecting' then
    raise exception 'client health refresh is not claimable';
  end if;
  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());

  if v_run.lease_invocation_id = p_invocation_id
     and v_run.lease_claim_attempt_id = p_claim_attempt_id
     and v_run.lease_expires_at > v_now then
    null; -- exact response-loss retry: return the committed grant unchanged
  elsif v_run.lease_invocation_id is null or v_run.lease_expires_at <= v_now then
    update public.client_health_refresh_runs
    set lease_invocation_id = p_invocation_id,
        lease_claim_attempt_id = p_claim_attempt_id,
        lease_granted_at = v_now,
        lease_expires_at = v_now + (p_lease_duration_ms * interval '1 millisecond'),
        lease_fencing_token = lease_fencing_token + 1
    where id = p_refresh_run_id
    returning * into v_run;
  else
    raise exception 'client health refresh lease is held by another execution';
  end if;

  return pg_catalog.jsonb_build_object(
    'refreshRunId', v_run.id, 'invocationId', v_run.lease_invocation_id,
    'claimAttemptId', v_run.lease_claim_attempt_id,
    'leaseGrantedAt', pg_catalog.to_char(v_run.lease_granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'leaseExpiresAt', pg_catalog.to_char(v_run.lease_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'fencingToken', v_run.lease_fencing_token
  );
end
$$;

create function public.client_health_get_refresh_lease(p_refresh_run_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
volatile
as $$
  select pg_catalog.jsonb_build_object(
    'refreshRunId', r.id, 'invocationId', r.lease_invocation_id,
    'claimAttemptId', r.lease_claim_attempt_id,
    'leaseGrantedAt', pg_catalog.to_char(r.lease_granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'leaseExpiresAt', pg_catalog.to_char(r.lease_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'fencingToken', r.lease_fencing_token
  )
  from public.client_health_refresh_runs r
  where r.id = p_refresh_run_id and r.lease_invocation_id is not null
    and r.run_status in ('collecting', 'validated')
    and r.lease_expires_at > pg_catalog.clock_timestamp()
$$;

create function public.client_health_renew_refresh_lease(
  p_refresh_run_id uuid,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint,
  p_lease_duration_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
  v_now timestamptz;
begin
  if p_lease_duration_ms is null or p_lease_duration_ms < 1 or p_lease_duration_ms > 600000 then
    raise exception 'client health lease duration must be between 1 and 600000 milliseconds';
  end if;
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());
  if v_now <= v_run.lease_granted_at then
    v_now := v_run.lease_granted_at + interval '1 millisecond';
  end if;
  update public.client_health_refresh_runs
  set lease_granted_at = v_now,
      lease_expires_at = v_now + (p_lease_duration_ms * interval '1 millisecond')
  where id = p_refresh_run_id
  returning * into v_run;
  return pg_catalog.jsonb_build_object(
    'refreshRunId', v_run.id, 'invocationId', v_run.lease_invocation_id,
    'claimAttemptId', v_run.lease_claim_attempt_id,
    'leaseGrantedAt', pg_catalog.to_char(v_run.lease_granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'leaseExpiresAt', pg_catalog.to_char(v_run.lease_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'fencingToken', v_run.lease_fencing_token
  );
end
$$;

create function public.client_health_release_refresh_lease(
  p_refresh_run_id uuid,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint,
  p_lease_granted_at timestamptz,
  p_lease_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
begin
  select * into v_run from public.client_health_refresh_runs where id = p_refresh_run_id for update;
  if not found or v_run.run_status not in ('published', 'failed') or v_run.lease_fencing_token <> p_fencing_token then
    raise exception 'client health terminal lease release does not match the refresh';
  end if;
  if v_run.lease_invocation_id is null and v_run.lease_claim_attempt_id is null
     and v_run.lease_granted_at is null and v_run.lease_expires_at is null then
    return; -- terminal transition already cleared ownership atomically; retries are safe no-ops
  end if;
  raise exception 'client health terminal transition retained unexpected lease ownership';
end
$$;

create function public.client_health_create_source_run(
  p_id uuid,
  p_refresh_run_id uuid,
  p_client_id uuid,
  p_source_key text,
  p_window_start date,
  p_window_end date,
  p_started_at timestamptz,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.client_health_source_runs%rowtype;
begin
  if (public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token)).run_status <> 'collecting' then
    raise exception 'client health source creation requires a collecting refresh';
  end if;
  if p_source_key is null or p_source_key !~ '^[a-z0-9][a-z0-9_.-]*$' or p_started_at is null
     or ((p_window_start is null) <> (p_window_end is null)) then
    raise exception 'client health source identity is malformed';
  end if;
  insert into public.client_health_source_runs (
    id, refresh_run_id, client_id, source_key, run_status, window_start, window_end, started_at
  ) values (
    p_id, p_refresh_run_id, p_client_id, p_source_key, 'running', p_window_start, p_window_end, p_started_at
  ) on conflict (id) do nothing;
  select * into v_source from public.client_health_source_runs where id = p_id;
  if v_source.id is null or v_source.run_status <> 'running'
     or v_source.refresh_run_id <> p_refresh_run_id or v_source.client_id <> p_client_id
     or v_source.source_key <> p_source_key or v_source.window_start is distinct from p_window_start
     or v_source.window_end is distinct from p_window_end or v_source.started_at <> p_started_at then
    raise exception 'client health source caller ID exists with incompatible identity or state';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_source.id, 'status', v_source.run_status, 'refreshRunId', v_source.refresh_run_id,
    'clientId', v_source.client_id, 'sourceKey', v_source.source_key,
    'windowStart', v_source.window_start, 'windowEnd', v_source.window_end,
    'startedAt', pg_catalog.to_char(v_source.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$$;

create function public.client_health_get_source_run(
  p_id uuid,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_source public.client_health_source_runs%rowtype;
begin
  select * into v_source from public.client_health_source_runs where id = p_id;
  if not found then return null; end if;
  if (public.client_health_assert_owned_lease(v_source.refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token)).run_status <> 'collecting' then
    raise exception 'client health source read requires a collecting refresh';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_source.id, 'status', v_source.run_status, 'refreshRunId', v_source.refresh_run_id,
    'clientId', v_source.client_id, 'sourceKey', v_source.source_key,
    'windowStart', v_source.window_start, 'windowEnd', v_source.window_end,
    'startedAt', pg_catalog.to_char(v_source.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$$;

create function public.client_health_complete_source_run(
  p_id uuid,
  p_refresh_run_id uuid,
  p_status text,
  p_finished_at timestamptz,
  p_data_through date,
  p_row_count bigint,
  p_request_fingerprint text,
  p_evidence jsonb,
  p_error_code text,
  p_error_message text,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_source public.client_health_source_runs%rowtype;
begin
  if (public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token)).run_status <> 'collecting' then
    raise exception 'client health source completion requires a collecting refresh';
  end if;
  if p_status not in ('succeeded', 'partial', 'failed') or p_finished_at is null
     or (p_row_count is not null and p_row_count < 0)
     or (p_request_fingerprint is not null and p_request_fingerprint !~ '^[0-9a-f]{64}$')
     or p_evidence is null or pg_catalog.jsonb_typeof(p_evidence) <> 'object' then
    raise exception 'client health source completion is malformed';
  end if;
  select * into v_source from public.client_health_source_runs
  where id = p_id and refresh_run_id = p_refresh_run_id for update;
  if not found then raise exception 'client health source run not found'; end if;
  if v_source.run_status = 'running' then
    update public.client_health_source_runs set
      run_status = p_status, finished_at = p_finished_at,
      data_through = case when p_data_through is null then null else p_data_through::timestamptz end,
      row_count = p_row_count, request_fingerprint = p_request_fingerprint,
      evidence = p_evidence, error_code = p_error_code, error_message = p_error_message
    where id = p_id;
  elsif v_source.run_status <> p_status or v_source.finished_at <> p_finished_at
     or v_source.data_through is distinct from (case when p_data_through is null then null else p_data_through::timestamptz end)
     or v_source.row_count is distinct from p_row_count or v_source.request_fingerprint is distinct from p_request_fingerprint
     or v_source.evidence <> p_evidence or v_source.error_code is distinct from p_error_code
     or v_source.error_message is distinct from p_error_message then
    raise exception 'client health source completion retry differs from committed content';
  end if;
end
$$;

create function public.client_health_persist_snapshot_bundle(
  p_bundle jsonb,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_snapshot jsonb;
  v_tasks jsonb;
  v_task jsonb;
  v_dimensions jsonb;
  v_sources jsonb;
  v_item record;
  v_refresh_id uuid;
  v_client_id uuid;
  v_snapshot_id uuid;
  v_snapshot_date date;
  v_existing public.client_health_snapshots%rowtype;
  v_task_count integer;
  v_inserted boolean := false;
  v_computed_idempotency_key text;
begin
  perform public.client_health_assert_exact_keys(p_bundle,
    array['idempotencyKey','evidenceHash','snapshotId','snapshot','tasks'], 'bundle');
  v_snapshot := p_bundle->'snapshot';
  v_tasks := p_bundle->'tasks';
  perform public.client_health_assert_exact_keys(v_snapshot, array[
    'refreshRunId','clientId','snapshotDate','dataThrough','budget','monthSpend','expectedSpend',
    'currentWindowStart','currentWindowEnd','currentSpend','currentResultCount','currentCostPerResult',
    'previousWindowStart','previousWindowEnd','previousSpend','previousResultCount','previousCostPerResult',
    'hoursUsed','hoursAllotted','projectedHours','overdueTaskCount','revenue','fulfillmentCost','marginPercent',
    'dimensionStatuses','sourceStatuses','overallStatus','overallScore','reasons','calculatedAt','evidenceHash'
  ], 'bundle.snapshot');
  if pg_catalog.jsonb_typeof(v_tasks) <> 'array' then raise exception 'bundle.tasks must be an array'; end if;
  if (p_bundle->>'evidenceHash') !~ '^[0-9a-f]{64}$'
     or (p_bundle->>'idempotencyKey') !~ '^[0-9a-f]{64}$' then
    raise exception 'bundle hashes must be lowercase SHA-256';
  end if;
  if v_snapshot->>'evidenceHash' is distinct from p_bundle->>'evidenceHash' then
    raise exception 'bundle snapshot evidenceHash does not match bundle evidenceHash';
  end if;
  v_computed_idempotency_key := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.client_health_canonical_json(
        pg_catalog.jsonb_build_object(
          'snapshotId', p_bundle->'snapshotId',
          'evidenceHash', p_bundle->'evidenceHash',
          'snapshot', v_snapshot,
          'tasks', v_tasks
        )
      ), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  if v_computed_idempotency_key <> p_bundle->>'idempotencyKey' then
    raise exception 'bundle idempotencyKey does not match canonical snapshot/task content';
  end if;

  begin
    v_refresh_id := (v_snapshot->>'refreshRunId')::uuid;
    v_client_id := (v_snapshot->>'clientId')::uuid;
    v_snapshot_id := (p_bundle->>'snapshotId')::uuid;
    v_snapshot_date := (v_snapshot->>'snapshotDate')::date;
  exception when others then
    raise exception 'bundle identity fields are malformed';
  end;
  if v_snapshot->>'snapshotDate' <> pg_catalog.to_char(v_snapshot_date, 'YYYY-MM-DD') then
    raise exception 'bundle snapshotDate is not canonical';
  end if;
  if (public.client_health_assert_owned_lease(v_refresh_id, p_invocation_id, p_claim_attempt_id, p_fencing_token)).run_status <> 'collecting' then
    raise exception 'client health snapshot persistence requires a collecting refresh';
  end if;

  -- Exact scalar JSON types; SQL casts below are allowed only after this allowlist passes.
  for v_item in select * from (values
    ('budget'),('monthSpend'),('expectedSpend'),('currentSpend'),('currentResultCount'),('currentCostPerResult'),
    ('previousSpend'),('previousResultCount'),('previousCostPerResult'),('hoursUsed'),('hoursAllotted'),
    ('projectedHours'),('overdueTaskCount'),('revenue'),('fulfillmentCost'),('marginPercent'),('overallScore')
  ) fields(key) loop
    if pg_catalog.jsonb_typeof(v_snapshot->v_item.key) not in ('number','null') then
      raise exception 'bundle.snapshot.% must be a number or null', v_item.key;
    end if;
  end loop;
  for v_item in select * from (values
    ('dataThrough'),('currentWindowStart'),('currentWindowEnd'),('previousWindowStart'),('previousWindowEnd')
  ) fields(key) loop
    if pg_catalog.jsonb_typeof(v_snapshot->v_item.key) not in ('string','null') then
      raise exception 'bundle.snapshot.% must be a string or null', v_item.key;
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(v_snapshot->'overallStatus') <> 'string'
     or pg_catalog.jsonb_typeof(v_snapshot->'calculatedAt') <> 'string'
     or pg_catalog.jsonb_typeof(v_snapshot->'reasons') <> 'array' then
    raise exception 'bundle snapshot string/array fields are malformed';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_snapshot->'reasons') x
             where pg_catalog.jsonb_typeof(x) <> 'string' or x #>> '{}' = '' or x #>> '{}' <> pg_catalog.btrim(x #>> '{}')) then
    raise exception 'bundle.snapshot.reasons must contain trimmed nonempty strings';
  end if;

  v_dimensions := v_snapshot->'dimensionStatuses';
  perform public.client_health_assert_exact_keys(v_dimensions,
    array['budget_pacing','north_star','hours','overdue_tasks','margin'], 'bundle.snapshot.dimensionStatuses');
  for v_item in select key, value from pg_catalog.jsonb_each(v_dimensions) loop
    perform public.client_health_assert_exact_keys(v_item.value,
      array['status','value','reason','required','weight'], 'bundle.snapshot.dimensionStatuses.' || v_item.key);
    if pg_catalog.jsonb_typeof(v_item.value->'status') <> 'string'
       or v_item.value->>'status' not in ('healthy','watch','at_risk','incomplete','unavailable','configuration_required')
       or pg_catalog.jsonb_typeof(v_item.value->'value') not in ('number','null')
       or pg_catalog.jsonb_typeof(v_item.value->'reason') <> 'string'
       or v_item.value->>'reason' = '' or v_item.value->>'reason' <> pg_catalog.btrim(v_item.value->>'reason')
       or pg_catalog.jsonb_typeof(v_item.value->'required') <> 'boolean'
       or pg_catalog.jsonb_typeof(v_item.value->'weight') not in ('number','null') then
      raise exception 'bundle snapshot dimension content is malformed';
    end if;
  end loop;

  v_sources := v_snapshot->'sourceStatuses';
  if pg_catalog.jsonb_typeof(v_sources) <> 'object' then raise exception 'bundle.snapshot.sourceStatuses must be an object'; end if;
  for v_item in select key, value from pg_catalog.jsonb_each(v_sources) loop
    if v_item.key !~ '^[a-z0-9][a-z0-9_.-]*$' then raise exception 'bundle source key is malformed'; end if;
    perform public.client_health_assert_exact_keys(v_item.value,
      array['status','dataThrough','stale','rowCount'], 'bundle.snapshot.sourceStatuses.' || v_item.key);
    if pg_catalog.jsonb_typeof(v_item.value->'status') <> 'string'
       or v_item.value->>'status' not in ('succeeded','partial','failed','missing')
       or pg_catalog.jsonb_typeof(v_item.value->'dataThrough') not in ('string','null')
       or pg_catalog.jsonb_typeof(v_item.value->'stale') <> 'boolean'
       or pg_catalog.jsonb_typeof(v_item.value->'rowCount') not in ('number','null')
       or (pg_catalog.jsonb_typeof(v_item.value->'rowCount') = 'number'
           and ((v_item.value->>'rowCount')::numeric < 0 or pg_catalog.trunc((v_item.value->>'rowCount')::numeric) <> (v_item.value->>'rowCount')::numeric)) then
      raise exception 'bundle snapshot source content is malformed';
    end if;
  end loop;

  v_task_count := pg_catalog.jsonb_array_length(v_tasks);
  if v_task_count > 5 then raise exception 'bundle.tasks cannot exceed five rows'; end if;
  for v_task in select value from pg_catalog.jsonb_array_elements(v_tasks) loop
    perform public.client_health_assert_exact_keys(v_task, array[
      'refreshRunId','snapshotId','clickupTaskId','listId','taskName','taskUrl','dueAt','displayRank'
    ], 'bundle.tasks[]');
    if pg_catalog.jsonb_typeof(v_task->'refreshRunId') <> 'string'
       or pg_catalog.jsonb_typeof(v_task->'snapshotId') <> 'string'
       or pg_catalog.jsonb_typeof(v_task->'clickupTaskId') <> 'string'
       or (v_task->>'clickupTaskId') !~ '^[A-Za-z0-9]+$'
       or pg_catalog.jsonb_typeof(v_task->'listId') <> 'string' or (v_task->>'listId') !~ '^[1-9][0-9]*$'
       or pg_catalog.jsonb_typeof(v_task->'taskName') <> 'string' or v_task->>'taskName' = ''
       or v_task->>'taskName' <> pg_catalog.btrim(v_task->>'taskName')
       or pg_catalog.jsonb_typeof(v_task->'taskUrl') <> 'string'
       or v_task->>'taskUrl' <> 'https://app.clickup.com/t/' || (v_task->>'clickupTaskId')
       or pg_catalog.jsonb_typeof(v_task->'dueAt') not in ('string','null')
       or pg_catalog.jsonb_typeof(v_task->'displayRank') <> 'number'
       or pg_catalog.trunc((v_task->>'displayRank')::numeric) <> (v_task->>'displayRank')::numeric
       or (v_task->>'displayRank')::integer not between 1 and 5
       or (v_task->>'refreshRunId')::uuid <> v_refresh_id or (v_task->>'snapshotId')::uuid <> v_snapshot_id then
      raise exception 'bundle task content is malformed';
    end if;
  end loop;
  if v_task_count <> coalesce(least((v_snapshot->>'overdueTaskCount')::integer, 5), 0)
     or exists (
       select 1 from pg_catalog.generate_series(1, v_task_count) rank
       where not exists (select 1 from pg_catalog.jsonb_array_elements(v_tasks) t where (t->>'displayRank')::integer = rank)
     ) then
    raise exception 'bundle task count/ranks do not match overdueTaskCount';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_tasks) task
    group by task->>'clickupTaskId'
    having count(*) > 1
  ) then
    raise exception 'bundle tasks contain a duplicate clickupTaskId';
  end if;

  select * into v_existing from public.client_health_snapshots
  where id = v_snapshot_id or (refresh_run_id = v_refresh_id and client_id = v_client_id)
  for update;

  if not found then
    insert into public.client_health_snapshots (
      id, refresh_run_id, client_id, snapshot_date, data_through, budget, month_spend, expected_spend,
      current_window_start, current_window_end, current_spend, current_result_count, current_cost_per_result,
      previous_window_start, previous_window_end, previous_spend, previous_result_count, previous_cost_per_result,
      hours_used, hours_allotted, projected_hours, overdue_task_count, revenue, fulfillment_cost, margin_percent,
      dimension_statuses, source_statuses, overall_status, overall_score, reasons, calculated_at,
      persistence_evidence_hash, persistence_idempotency_key
    ) values (
      v_snapshot_id, v_refresh_id, v_client_id, v_snapshot_date,
      ((v_snapshot->>'dataThrough')::date::timestamp at time zone 'UTC'),
      (v_snapshot->>'budget')::numeric, (v_snapshot->>'monthSpend')::numeric, (v_snapshot->>'expectedSpend')::numeric,
      (v_snapshot->>'currentWindowStart')::date, (v_snapshot->>'currentWindowEnd')::date,
      (v_snapshot->>'currentSpend')::numeric, (v_snapshot->>'currentResultCount')::numeric, (v_snapshot->>'currentCostPerResult')::numeric,
      (v_snapshot->>'previousWindowStart')::date, (v_snapshot->>'previousWindowEnd')::date,
      (v_snapshot->>'previousSpend')::numeric, (v_snapshot->>'previousResultCount')::numeric, (v_snapshot->>'previousCostPerResult')::numeric,
      (v_snapshot->>'hoursUsed')::numeric, (v_snapshot->>'hoursAllotted')::numeric, (v_snapshot->>'projectedHours')::numeric,
      (v_snapshot->>'overdueTaskCount')::integer, (v_snapshot->>'revenue')::numeric,
      (v_snapshot->>'fulfillmentCost')::numeric, (v_snapshot->>'marginPercent')::numeric,
      v_dimensions, v_sources, v_snapshot->>'overallStatus', (v_snapshot->>'overallScore')::numeric,
      v_snapshot->'reasons', (v_snapshot->>'calculatedAt')::timestamptz,
      p_bundle->>'evidenceHash', p_bundle->>'idempotencyKey'
    );
    v_inserted := true;
    for v_task in select value from pg_catalog.jsonb_array_elements(v_tasks) loop
      insert into public.client_health_snapshot_tasks (
        refresh_run_id, snapshot_id, clickup_task_id, list_id, task_name, task_url, due_at, display_rank
      ) values (
        v_refresh_id, v_snapshot_id, v_task->>'clickupTaskId', v_task->>'listId', v_task->>'taskName',
        v_task->>'taskUrl', (v_task->>'dueAt')::timestamptz, (v_task->>'displayRank')::smallint
      );
    end loop;
  else
    if v_existing.id <> v_snapshot_id or v_existing.refresh_run_id <> v_refresh_id or v_existing.client_id <> v_client_id
       or v_existing.snapshot_date <> v_snapshot_date
       or v_existing.data_through is distinct from ((v_snapshot->>'dataThrough')::date::timestamp at time zone 'UTC')
       or v_existing.budget is distinct from (v_snapshot->>'budget')::numeric
       or v_existing.month_spend is distinct from (v_snapshot->>'monthSpend')::numeric
       or v_existing.expected_spend is distinct from (v_snapshot->>'expectedSpend')::numeric
       or v_existing.current_window_start is distinct from (v_snapshot->>'currentWindowStart')::date
       or v_existing.current_window_end is distinct from (v_snapshot->>'currentWindowEnd')::date
       or v_existing.current_spend is distinct from (v_snapshot->>'currentSpend')::numeric
       or v_existing.current_result_count is distinct from (v_snapshot->>'currentResultCount')::numeric
       or v_existing.current_cost_per_result is distinct from (v_snapshot->>'currentCostPerResult')::numeric
       or v_existing.previous_window_start is distinct from (v_snapshot->>'previousWindowStart')::date
       or v_existing.previous_window_end is distinct from (v_snapshot->>'previousWindowEnd')::date
       or v_existing.previous_spend is distinct from (v_snapshot->>'previousSpend')::numeric
       or v_existing.previous_result_count is distinct from (v_snapshot->>'previousResultCount')::numeric
       or v_existing.previous_cost_per_result is distinct from (v_snapshot->>'previousCostPerResult')::numeric
       or v_existing.hours_used is distinct from (v_snapshot->>'hoursUsed')::numeric
       or v_existing.hours_allotted is distinct from (v_snapshot->>'hoursAllotted')::numeric
       or v_existing.projected_hours is distinct from (v_snapshot->>'projectedHours')::numeric
       or v_existing.overdue_task_count is distinct from (v_snapshot->>'overdueTaskCount')::integer
       or v_existing.revenue is distinct from (v_snapshot->>'revenue')::numeric
       or v_existing.fulfillment_cost is distinct from (v_snapshot->>'fulfillmentCost')::numeric
       or v_existing.margin_percent is distinct from (v_snapshot->>'marginPercent')::numeric
       or v_existing.dimension_statuses <> v_dimensions or v_existing.source_statuses <> v_sources
       or v_existing.overall_status <> v_snapshot->>'overallStatus'
       or v_existing.overall_score is distinct from (v_snapshot->>'overallScore')::numeric
       or v_existing.reasons <> v_snapshot->'reasons'
       or v_existing.calculated_at <> (v_snapshot->>'calculatedAt')::timestamptz
       or v_existing.persistence_evidence_hash <> p_bundle->>'evidenceHash'
       or v_existing.persistence_idempotency_key <> p_bundle->>'idempotencyKey' then
      raise exception 'client health snapshot retry differs from committed content';
    end if;
  end if;

  if not v_inserted then
    if (select count(*) from public.client_health_snapshot_tasks where snapshot_id = v_snapshot_id) <> v_task_count
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(v_tasks) t
         where not exists (
           select 1 from public.client_health_snapshot_tasks st
           where st.snapshot_id = v_snapshot_id and st.refresh_run_id = v_refresh_id
             and st.clickup_task_id = t->>'clickupTaskId' and st.list_id = t->>'listId'
             and st.task_name = t->>'taskName' and st.task_url = t->>'taskUrl'
             and st.due_at is not distinct from (t->>'dueAt')::timestamptz
             and st.display_rank = (t->>'displayRank')::smallint
         )
       ) then
      raise exception 'client health snapshot task retry differs from committed content';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'refreshRunId', v_refresh_id, 'clientId', v_client_id, 'snapshotId', v_snapshot_id,
    'taskCount', v_task_count, 'evidenceHash', p_bundle->>'evidenceHash',
    'idempotencyKey', p_bundle->>'idempotencyKey'
  );
end
$$;

create function public.client_health_validate_refresh_run(
  p_refresh_run_id uuid,
  p_validated_at timestamptz,
  p_evidence_hash text,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_run public.client_health_refresh_runs%rowtype;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if p_evidence_hash !~ '^[0-9a-f]{64}$' or p_validated_at is null then raise exception 'client health validation is malformed'; end if;
  if v_run.run_status = 'collecting' then
    if exists (
      select 1 from public.client_health_clients c
      where c.active
        and not exists (
          select 1 from public.client_health_snapshots s
          where s.refresh_run_id = p_refresh_run_id and s.client_id = c.id
        )
    ) or exists (
      select 1 from public.client_health_snapshots s
      join public.client_health_clients c on c.id = s.client_id
      where s.refresh_run_id = p_refresh_run_id and not c.active
    ) then
      raise exception 'client health refresh snapshots must exactly cover configured active clients';
    end if;
    if not exists (select 1 from public.client_health_snapshots where refresh_run_id = p_refresh_run_id) then
      raise exception 'client health refresh cannot validate without active-client snapshots';
    end if;
    if exists (
      select 1 from public.client_health_source_runs sr
      where sr.refresh_run_id = p_refresh_run_id and sr.run_status = 'running'
    ) then
      raise exception 'client health refresh cannot validate while source collection is running';
    end if;
    if exists (
      select 1
      from public.client_health_snapshots s
      cross join lateral pg_catalog.jsonb_object_keys(s.source_statuses) expected(source_key)
      where s.refresh_run_id = p_refresh_run_id
        and not exists (
          select 1 from public.client_health_source_runs sr
          where sr.refresh_run_id = p_refresh_run_id and sr.client_id = s.client_id
            and sr.source_key = expected.source_key and sr.run_status <> 'running'
        )
    ) or exists (
      select 1 from public.client_health_source_runs sr
      where sr.refresh_run_id = p_refresh_run_id
        and not exists (
          select 1 from public.client_health_snapshots s
          where s.refresh_run_id = p_refresh_run_id and s.client_id = sr.client_id
            and s.source_statuses ? sr.source_key
        )
    ) then
      raise exception 'client health refresh source runs must exactly cover configured snapshot sources';
    end if;
    update public.client_health_refresh_runs
    set run_status = 'validated', validated_at = p_validated_at, evidence_hash = p_evidence_hash
    where id = p_refresh_run_id;
  elsif v_run.run_status <> 'validated' or v_run.validated_at <> p_validated_at or v_run.evidence_hash <> p_evidence_hash then
    raise exception 'client health validation retry differs from committed transition';
  end if;
end
$$;

create function public.client_health_publish_refresh_run(
  p_refresh_run_id uuid,
  p_published_at timestamptz,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_run public.client_health_refresh_runs%rowtype;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'validated' or p_published_at is null then
    raise exception 'client health refresh is not publishable';
  end if;
  update public.client_health_refresh_runs set
    run_status = 'published', published_at = p_published_at, finished_at = p_published_at,
    lease_invocation_id = null, lease_claim_attempt_id = null,
    lease_granted_at = null, lease_expires_at = null
  where id = p_refresh_run_id;
end
$$;

create function public.client_health_fail_refresh_run(
  p_refresh_run_id uuid,
  p_finished_at timestamptz,
  p_error_code text,
  p_error_message text,
  p_invocation_id uuid,
  p_claim_attempt_id uuid,
  p_fencing_token bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_run public.client_health_refresh_runs%rowtype;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if p_finished_at is null or p_error_code is null or p_error_code = '' or p_error_code <> pg_catalog.btrim(p_error_code)
     or p_error_message is null or p_error_message = '' or p_error_message <> pg_catalog.btrim(p_error_message) then
    raise exception 'client health failure transition is malformed';
  end if;
  update public.client_health_refresh_runs set
    run_status = 'failed', finished_at = p_finished_at, error_code = p_error_code, error_message = p_error_message,
    lease_invocation_id = null, lease_claim_attempt_id = null,
    lease_granted_at = null, lease_expires_at = null
  where id = p_refresh_run_id;
end
$$;

-- Security-definer ownership is pinned to postgres; helper/trigger functions are never callable by API roles.
alter function public.client_health_assert_exact_keys(jsonb,text[],text) owner to postgres;
alter function public.client_health_canonical_json(jsonb) owner to postgres;
alter function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz) owner to postgres;
alter function public.client_health_get_refresh_run(uuid) owner to postgres;
alter function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_get_refresh_lease(uuid) owner to postgres;
alter function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) owner to postgres;
alter function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) owner to postgres;
alter function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_get_source_run(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint) owner to postgres;

revoke all on function public.client_health_assert_exact_keys(jsonb,text[],text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;

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

grant execute on function public.client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz) to service_role;
grant execute on function public.client_health_get_refresh_run(uuid) to service_role;
grant execute on function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_get_refresh_lease(uuid) to service_role;
grant execute on function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) to service_role;
grant execute on function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) to service_role;
grant execute on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_get_source_run(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint) to service_role;

-- Remove all direct lifecycle/evidence mutation paths. RLS and published immutability remain enabled.
revoke insert, update, delete on table public.client_health_refresh_runs from service_role;
revoke insert, update, delete on table public.client_health_source_runs from service_role;
revoke insert, update, delete on table public.client_health_snapshots from service_role;
revoke insert, update, delete on table public.client_health_snapshot_tasks from service_role;

comment on column public.client_health_refresh_runs.lease_fencing_token is
  'Monotonic per-refresh fence. Ownership may clear, but this token never decreases or resets.';
comment on column public.client_health_refresh_runs.refresh_identity_hash is
  'Lowercase SHA-256 of normalized logical plan identity; excludes invocation, claim attempt, and run attempt.';
comment on column public.client_health_refresh_runs.run_attempt_id is
  'Cryptographic per-execution UUID generated inside runClientHealthRefresh; unique and auditable.';
comment on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) is
  'Fenced, exact-shape, idempotent atomic snapshot plus task persistence. Service role only.';

commit;
