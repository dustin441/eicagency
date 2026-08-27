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
      and column_name in ('config_revision_id','config_revision_hash','refresh_identity_hash', 'run_attempt_id', 'lease_invocation_id', 'lease_claim_attempt_id', 'lease_granted_at', 'lease_expires_at', 'lease_fencing_token')
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_health_snapshots'
      and column_name in ('config_revision_id','config_revision_hash','persistence_evidence_hash', 'persistence_idempotency_key')
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_health_source_runs' and column_name = 'facts'
  ) or to_regclass('private.client_health_config_revisions') is not null
     or to_regclass('private.client_health_config_revision_activations') is not null
     or to_regclass('private.client_health_active_config_revision') is not null then
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

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated, service_role;

create table private.client_health_config_revisions (
  id uuid primary key,
  revision_hash text not null unique check (revision_hash ~ '^[0-9a-f]{64}$'),
  revision jsonb not null check (pg_catalog.jsonb_typeof(revision) = 'object'),
  created_at timestamptz not null default pg_catalog.now(),
  constraint client_health_config_revisions_id_hash_unique unique (id, revision_hash)
);
create table private.client_health_config_revision_activations (
  id uuid primary key,
  revision_id uuid not null,
  revision_hash text not null check (revision_hash ~ '^[0-9a-f]{64}$'),
  reviewed_commit_sha text not null check (reviewed_commit_sha ~ '^[0-9a-f]{40}$'),
  operator_identity text not null check (operator_identity <> '' and operator_identity = pg_catalog.btrim(operator_identity) and pg_catalog.length(operator_identity) <= 256),
  reason text not null check (reason <> '' and reason = pg_catalog.btrim(reason) and pg_catalog.length(reason) <= 1024),
  activated_at timestamptz not null,
  constraint client_health_config_revision_activations_revision_fk foreign key (revision_id, revision_hash)
    references private.client_health_config_revisions(id, revision_hash)
);
create table private.client_health_active_config_revision (
  singleton boolean primary key default true check (singleton),
  activation_id uuid not null unique references private.client_health_config_revision_activations(id)
);
revoke all on all tables in schema private from public, anon, authenticated, service_role;

alter table public.client_health_refresh_runs
  add column config_revision_id uuid not null,
  add column config_revision_hash text not null,
  add column config_revision_activation_id uuid not null,
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
  add constraint client_health_refresh_runs_config_hash check (config_revision_hash ~ '^[0-9a-f]{64}$'),
  add constraint client_health_refresh_runs_config_fk foreign key (config_revision_id, config_revision_hash)
    references private.client_health_config_revisions(id, revision_hash),
  add constraint client_health_refresh_runs_activation_fk foreign key (config_revision_activation_id)
    references private.client_health_config_revision_activations(id),
  add constraint client_health_refresh_runs_attempt_unique unique (run_attempt_id),
  add constraint client_health_refresh_runs_lease_shape
    check (
      (lease_invocation_id is null and lease_claim_attempt_id is null and lease_granted_at is null and lease_expires_at is null)
      or
      (lease_invocation_id is not null and lease_claim_attempt_id is not null and lease_granted_at is not null
       and lease_expires_at is not null and lease_expires_at > lease_granted_at and lease_fencing_token > 0)
    );

alter table public.client_health_source_runs
  add column facts jsonb not null default '{}'::jsonb,
  add constraint client_health_source_runs_facts_object
    check (pg_catalog.jsonb_typeof(facts) = 'object');

alter table public.client_health_snapshots
  add column config_revision_id uuid not null,
  add column config_revision_hash text not null,
  add column persistence_evidence_hash text not null,
  add column persistence_idempotency_key text not null,
  add constraint client_health_snapshots_persistence_evidence_hash
    check (persistence_evidence_hash ~ '^[0-9a-f]{64}$'),
  add constraint client_health_snapshots_persistence_idempotency_key
    check (persistence_idempotency_key ~ '^[0-9a-f]{64}$'),
  add constraint client_health_snapshots_idempotency_unique unique (persistence_idempotency_key),
  add constraint client_health_snapshots_config_fk foreign key (config_revision_id, config_revision_hash)
    references private.client_health_config_revisions(id, revision_hash);

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

create function public.client_health_revision_id(p_hash text)
returns uuid language sql immutable strict security definer set search_path = pg_catalog as $$
  select (pg_catalog.substr(p_hash,1,12) || '8' || pg_catalog.substr(p_hash,14,3) ||
    pg_catalog.substr('89ab', ((('x'||pg_catalog.substr(p_hash,17,1))::bit(4)::int) % 4)+1, 1) ||
    pg_catalog.substr(p_hash,18,15))::uuid
$$;

create function public.client_health_assert_safe_revision_json(p_value jsonb, p_field text, p_depth integer default 0)
returns void language plpgsql immutable security definer set search_path = pg_catalog, public as $$
declare v record; v_text text;
begin
  if p_depth > 8 then raise exception '% exceeds maximum JSON depth', p_field; end if;
  if pg_catalog.jsonb_typeof(p_value) = 'string' then
    v_text := p_value #>> '{}'; if pg_catalog.length(v_text) > 2048 then raise exception '% contains an overlong string', p_field; end if;
  elsif pg_catalog.jsonb_typeof(p_value) = 'number' then
    if pg_catalog.abs((p_value::text)::numeric) > 1000000000000 then raise exception '% contains an unsafe number', p_field; end if;
  elsif pg_catalog.jsonb_typeof(p_value) = 'array' then
    if pg_catalog.jsonb_array_length(p_value) > 100 then raise exception '% contains an oversized array', p_field; end if;
    for v in select value, ordinal from pg_catalog.jsonb_array_elements(p_value) with ordinality x(value,ordinal) loop
      perform public.client_health_assert_safe_revision_json(v.value, p_field || '[' || v.ordinal || ']', p_depth + 1);
    end loop;
  elsif pg_catalog.jsonb_typeof(p_value) = 'object' then
    if (select count(*) from pg_catalog.jsonb_object_keys(p_value)) > 64 then raise exception '% contains too many keys', p_field; end if;
    for v in select key,value from pg_catalog.jsonb_each(p_value) loop
      if v.key = '' or pg_catalog.length(v.key) > 64 or v.key ~* '(secret|token|password|credential|authorization|cookie|private.?key|api.?key|access.?key|refresh.?token)' then
        raise exception '% contains a forbidden or malformed key', p_field;
      end if;
      perform public.client_health_assert_safe_revision_json(v.value, p_field || '.' || v.key, p_depth + 1);
    end loop;
  end if;
end
$$;

create function public.client_health_assert_config_revision(p_id uuid, p_hash text, p_revision jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  c jsonb; m jsonb; s jsonb; fixed jsonb; fresh jsonb;
  v record; v_computed text; v_ids text[] := '{}'; v_client_keys text[] := '{}';
  v_metric_keys text[]; v_source_keys text[]; v_values text[]; v_task_list_ids text[];
begin
  if p_revision is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or p_id is null or p_id <> public.client_health_revision_id(p_hash) then
    raise exception 'configuration revision identity is malformed';
  end if;
  if pg_catalog.octet_length(p_revision::text) > 1000000 then raise exception 'configuration revision is oversized'; end if;
  perform public.client_health_assert_safe_revision_json(p_revision, 'revision');
  perform public.client_health_assert_exact_keys(p_revision,array['schemaVersion','calculationVersion','sourceContractVersion','clients'],'revision');
  if p_revision->'schemaVersion' <> '2'::jsonb
     or p_revision->>'calculationVersion' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(p_revision->>'calculationVersion') > 128
     or p_revision->>'sourceContractVersion' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(p_revision->>'sourceContractVersion') > 128
     or pg_catalog.jsonb_typeof(p_revision->'clients') <> 'array'
     or pg_catalog.jsonb_array_length(p_revision->'clients') not between 1 and 100 then
    raise exception 'configuration revision v2 root is malformed';
  end if;
  for c in select value from pg_catalog.jsonb_array_elements(p_revision->'clients') loop
    perform public.client_health_assert_exact_keys(c,array['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','fixedValues','metrics','sources'],'revision.clients[]');
    if c->>'clientId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or c->>'clientKey' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(c->>'clientKey') > 128
       or pg_catalog.jsonb_typeof(c->'displayName') <> 'string' or c->>'displayName' = '' or c->>'displayName' <> pg_catalog.btrim(c->>'displayName') or pg_catalog.length(c->>'displayName') > 256
       or pg_catalog.jsonb_typeof(c->'dashboardHref') not in ('string','null')
       or (pg_catalog.jsonb_typeof(c->'dashboardHref')='string' and (c->>'dashboardHref'='' or c->>'dashboardHref'<>pg_catalog.btrim(c->>'dashboardHref') or pg_catalog.length(c->>'dashboardHref')>512 or c->>'dashboardHref' !~ '^/[^/]'))
       or pg_catalog.jsonb_typeof(c->'reportingTimezone') <> 'string' or c->>'reportingTimezone'='' or c->>'reportingTimezone'<>pg_catalog.btrim(c->>'reportingTimezone') or pg_catalog.length(c->>'reportingTimezone')>128
       or c->>'configStatus' not in ('approved','configuration_required')
       or pg_catalog.jsonb_typeof(c->'clickupListIds') <> 'array' or pg_catalog.jsonb_array_length(c->'clickupListIds') > 100
       or pg_catalog.jsonb_typeof(c->'marginAliases') <> 'array' or pg_catalog.jsonb_array_length(c->'marginAliases') > 100
       or pg_catalog.jsonb_typeof(c->'metrics') <> 'array' or pg_catalog.jsonb_typeof(c->'sources') <> 'array' then
      raise exception 'configuration revision client display is malformed';
    end if;
    v_ids := pg_catalog.array_append(v_ids,c->>'clientId'); v_client_keys := pg_catalog.array_append(v_client_keys,c->>'clientKey');
    for v in
      select values_array from (values
        (coalesce((select array_agg(x#>>'{}' order by ord) from pg_catalog.jsonb_array_elements(c->'clickupListIds') with ordinality q(x,ord)),'{}'::text[])),
        (coalesce((select array_agg(x#>>'{}' order by ord) from pg_catalog.jsonb_array_elements(c->'marginAliases') with ordinality q(x,ord)),'{}'::text[]))
      ) q(values_array)
    loop
      v_values := v.values_array;
      if exists(select 1 from pg_catalog.unnest(v_values) x where x='' or x<>pg_catalog.btrim(x) or pg_catalog.length(x)>256)
         or v_values <> (select coalesce(array_agg(x order by x),'{}') from pg_catalog.unnest(v_values)x)
         or pg_catalog.cardinality(v_values) <> (select count(distinct x) from pg_catalog.unnest(v_values)x) then
        raise exception 'configuration revision display string array is noncanonical';
      end if;
    end loop;
    fixed := c->'fixedValues';
    perform public.client_health_assert_exact_keys(fixed,array['monthlyBudget','monthlyHoursAllotment'],'fixedValues');
    if pg_catalog.jsonb_typeof(fixed->'monthlyBudget') not in ('number','null') or pg_catalog.jsonb_typeof(fixed->'monthlyHoursAllotment') not in ('number','null')
       or (fixed->>'monthlyBudget' is not null and (fixed->>'monthlyBudget')::numeric not between 0 and 1000000000)
       or (fixed->>'monthlyHoursAllotment' is not null and (fixed->>'monthlyHoursAllotment')::numeric not between 0 and 1000000000) then
      raise exception 'configuration revision fixed values are malformed';
    end if;
    select coalesce(array_agg(value->>'sourceKey' order by ord),'{}') into v_source_keys
      from pg_catalog.jsonb_array_elements(c->'sources') with ordinality q(value,ord);
    if v_source_keys <> (select coalesce(array_agg(x order by x),'{}') from pg_catalog.unnest(v_source_keys)x)
       or pg_catalog.cardinality(v_source_keys) <> (select count(distinct x) from pg_catalog.unnest(v_source_keys)x) then
      raise exception 'configuration revision sources are duplicate or noncanonical';
    end if;
    for s in select value from pg_catalog.jsonb_array_elements(c->'sources') loop
      if s->>'provider'='supabase' then perform public.client_health_assert_exact_keys(s,array['sourceKey','provider','requestFingerprint','permittedFactFields','freshnessPolicy','project','relation'],'source');
      elsif s->>'provider'='google-sheets' then perform public.client_health_assert_exact_keys(s,array['sourceKey','provider','requestFingerprint','permittedFactFields','freshnessPolicy','spreadsheetId','range','approvedClientAliasHash','valueRenderOption','dateTimeRenderOption'],'source');
      elsif s->>'provider'='clickup' then perform public.client_health_assert_exact_keys(s,array['sourceKey','provider','requestFingerprint','permittedFactFields','freshnessPolicy','endpointFamily','permitsTasks','allowedListIds'],'source');
      else raise exception 'configuration revision source provider is invalid'; end if;
      fresh := s->'freshnessPolicy'; perform public.client_health_assert_exact_keys(fresh,array['maximumLagDays'],'freshnessPolicy');
      select coalesce(array_agg(x#>>'{}' order by ord),'{}') into v_values from pg_catalog.jsonb_array_elements(s->'permittedFactFields') with ordinality q(x,ord);
      if s->>'sourceKey' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(s->>'sourceKey')>128
         or s->>'requestFingerprint' !~ '^[0-9a-f]{64}$'
         or pg_catalog.jsonb_typeof(s->'permittedFactFields')<>'array' or pg_catalog.jsonb_array_length(s->'permittedFactFields')>100
         or exists(select 1 from pg_catalog.unnest(v_values)x where x not in ('monthSpend','currentRows','previousRows','hoursUsed','overdueTaskCount','revenue','fulfillmentCost'))
         or v_values<>(select coalesce(array_agg(x order by x),'{}') from pg_catalog.unnest(v_values)x)
         or pg_catalog.cardinality(v_values)<>(select count(distinct x) from pg_catalog.unnest(v_values)x)
         or pg_catalog.jsonb_typeof(fresh->'maximumLagDays')<>'number' or (fresh->>'maximumLagDays')::numeric not between 0 and 365
         or (s->>'provider'='supabase' and (s->>'project' not in ('eic','prepass') or s->>'relation' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(s->>'relation')>128))
         or (s->>'provider'='google-sheets' and (s->>'spreadsheetId'='' or s->>'spreadsheetId'<>pg_catalog.btrim(s->>'spreadsheetId') or pg_catalog.length(s->>'spreadsheetId')>256 or s->>'range'='' or s->>'range'<>pg_catalog.btrim(s->>'range') or pg_catalog.length(s->>'range')>512 or s->>'approvedClientAliasHash' !~ '^[0-9a-f]{64}$' or s->>'valueRenderOption'<>'UNFORMATTED_VALUE' or s->>'dateTimeRenderOption'<>'FORMATTED_STRING'))
         or (s->>'provider'='clickup' and (s->>'endpointFamily'<>'team-time-entries-and-overdue-tasks' or pg_catalog.jsonb_typeof(s->'permitsTasks')<>'boolean' or pg_catalog.jsonb_typeof(s->'allowedListIds')<>'array' or pg_catalog.jsonb_array_length(s->'allowedListIds')>100)) then
        raise exception 'configuration revision source binding is malformed';
      end if;
      if s->>'provider'='clickup' then
        select coalesce(array_agg(x#>>'{}' order by ord),'{}') into v_values from pg_catalog.jsonb_array_elements(s->'allowedListIds') with ordinality q(x,ord);
        if exists(select 1 from pg_catalog.unnest(v_values)x where x='' or x<>pg_catalog.btrim(x) or pg_catalog.length(x)>256)
           or v_values<>(select coalesce(array_agg(x order by x),'{}') from pg_catalog.unnest(v_values)x)
           or pg_catalog.cardinality(v_values)<>(select count(distinct x) from pg_catalog.unnest(v_values)x) then raise exception 'ClickUp allowedListIds is noncanonical'; end if;
      end if;
    end loop;
    select coalesce(array_agg(list_id order by list_id),'{}') into v_task_list_ids
    from pg_catalog.jsonb_array_elements(c->'sources') source
    cross join lateral pg_catalog.jsonb_array_elements_text(source->'allowedListIds') list_id
    where source->>'provider'='clickup' and (source->>'permitsTasks')::boolean;
    if pg_catalog.cardinality(v_task_list_ids)<>(select count(distinct list_id) from pg_catalog.unnest(v_task_list_ids) list_id) then
      raise exception 'ClickUp allowedListIds must be unique across task-enabled sources';
    end if;
    select coalesce(array_agg(value->>'key' order by ord),'{}') into v_metric_keys from pg_catalog.jsonb_array_elements(c->'metrics') with ordinality q(value,ord);
    if c->>'configStatus'='configuration_required' then
      if fixed <> '{"monthlyBudget":null,"monthlyHoursAllotment":null}'::jsonb or v_metric_keys<>'{}' or v_source_keys<>'{}' then raise exception 'configuration-required revision client contains approved configuration'; end if;
    elsif v_metric_keys <> array['budget_pacing','hours','margin','north_star','overdue_tasks'] or pg_catalog.cardinality(v_source_keys)<1 then
      raise exception 'approved revision client must contain exact five metrics and nonempty sources';
    end if;
    for m in select value from pg_catalog.jsonb_array_elements(c->'metrics') loop
      perform public.client_health_assert_exact_keys(m,array['key','label','adapterKey','required','weight','direction','greenThreshold','yellowThreshold','sourceKeys'],'metric');
      select coalesce(array_agg(x#>>'{}' order by ord),'{}') into v_values from pg_catalog.jsonb_array_elements(m->'sourceKeys') with ordinality q(x,ord);
      if m->>'key' not in ('budget_pacing','north_star','hours','overdue_tasks','margin')
         or m->>'label'='' or m->>'label'<>pg_catalog.btrim(m->>'label') or pg_catalog.length(m->>'label')>256
         or m->>'adapterKey' !~ '^[a-z0-9][a-z0-9_.-]*$' or pg_catalog.length(m->>'adapterKey')>128
         or pg_catalog.jsonb_typeof(m->'required')<>'boolean' or pg_catalog.jsonb_typeof(m->'weight')<>'number' or (m->>'weight')::numeric not between 0 and 100
         or m->>'direction' not in ('lower_is_better','higher_is_better')
         or pg_catalog.jsonb_typeof(m->'greenThreshold')<>'number' or (m->>'greenThreshold')::numeric not between 0 and 1000000000
         or pg_catalog.jsonb_typeof(m->'yellowThreshold')<>'number' or (m->>'yellowThreshold')::numeric not between 0 and 1000000000
         or pg_catalog.jsonb_typeof(m->'sourceKeys')<>'array' or pg_catalog.cardinality(v_values)<1
         or v_values<>(select coalesce(array_agg(x order by x),'{}') from pg_catalog.unnest(v_values)x)
         or pg_catalog.cardinality(v_values)<>(select count(distinct x) from pg_catalog.unnest(v_values)x)
         or exists(select 1 from pg_catalog.unnest(v_values)x where not (x=any(v_source_keys))) then raise exception 'configuration revision metric is malformed'; end if;
    end loop;
  end loop;
  if v_ids<>(select array_agg(x order by x) from pg_catalog.unnest(v_ids)x)
     or pg_catalog.cardinality(v_ids)<>(select count(distinct x) from pg_catalog.unnest(v_ids)x)
     or pg_catalog.cardinality(v_client_keys)<>(select count(distinct x) from pg_catalog.unnest(v_client_keys)x) then raise exception 'configuration revision clients are duplicate or noncanonical'; end if;
  v_computed:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(p_revision),'UTF8'),'sha256'),'hex');
  if v_computed<>p_hash then raise exception 'configuration revision hash mismatch'; end if;
end $$;

create function public.client_health_guard_config_revision_immutable() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'client health configuration revisions are immutable'; end $$;
create trigger client_health_config_revisions_immutable before update or delete on private.client_health_config_revisions
for each row execute function public.client_health_guard_config_revision_immutable();
create function private.client_health_guard_activation_immutable() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'client health configuration activations are append-only'; end $$;
create trigger client_health_config_revision_activations_immutable before update or delete on private.client_health_config_revision_activations
for each row execute function private.client_health_guard_activation_immutable();

create function private.client_health_stage_config_revision(p_id uuid,p_revision_hash text,p_revision jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v private.client_health_config_revisions%rowtype;
begin
  perform public.client_health_assert_config_revision(p_id,p_revision_hash,p_revision);
  insert into private.client_health_config_revisions(id,revision_hash,revision) values(p_id,p_revision_hash,p_revision) on conflict (id) do nothing;
  select * into v from private.client_health_config_revisions where id=p_id;
  if not found or v.revision_hash<>p_revision_hash or v.revision<>p_revision then raise exception 'configuration revision collision or incompatible retry'; end if;
  perform public.client_health_assert_config_revision(v.id,v.revision_hash,v.revision);
  return pg_catalog.jsonb_build_object('id',v.id,'hash',v.revision_hash,'content',v.revision);
end $$;

create function private.client_health_activate_config_revision(p_activation_id uuid,p_revision_id uuid,p_reviewed_commit_sha text,p_operator_identity text,p_reason text,p_expected_current_activation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_revision private.client_health_config_revisions%rowtype; v_activation private.client_health_config_revision_activations%rowtype; v_current uuid; v_now timestamptz;
begin
  if p_activation_id is null or p_reviewed_commit_sha !~ '^[0-9a-f]{40}$' or p_operator_identity is null or p_operator_identity='' or p_operator_identity<>pg_catalog.btrim(p_operator_identity) or pg_catalog.length(p_operator_identity)>256
     or p_reason is null or p_reason='' or p_reason<>pg_catalog.btrim(p_reason) or pg_catalog.length(p_reason)>1024 then raise exception 'configuration activation provenance is malformed'; end if;
  select * into v_revision from private.client_health_config_revisions where id=p_revision_id;
  if not found then raise exception 'staged configuration revision not found'; end if;
  perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  select * into v_activation from private.client_health_config_revision_activations where id=p_activation_id;
  if found then
    if v_activation.revision_id<>p_revision_id or v_activation.revision_hash<>v_revision.revision_hash or v_activation.reviewed_commit_sha<>p_reviewed_commit_sha or v_activation.operator_identity<>p_operator_identity or v_activation.reason<>p_reason
       or not exists(select 1 from private.client_health_active_config_revision where singleton and activation_id=p_activation_id) then raise exception 'configuration activation ID collision or incompatible retry'; end if;
  else
    select activation_id into v_current from private.client_health_active_config_revision where singleton for update;
    if v_current is distinct from p_expected_current_activation_id then raise exception 'configuration activation compare-and-set failed'; end if;
    v_now:=pg_catalog.date_trunc('milliseconds',pg_catalog.clock_timestamp());
    insert into private.client_health_config_revision_activations(id,revision_id,revision_hash,reviewed_commit_sha,operator_identity,reason,activated_at)
      values(p_activation_id,p_revision_id,v_revision.revision_hash,p_reviewed_commit_sha,p_operator_identity,p_reason,v_now) returning * into v_activation;
    insert into private.client_health_active_config_revision(singleton,activation_id) values(true,p_activation_id)
      on conflict(singleton) do update set activation_id=excluded.activation_id;
  end if;
  return pg_catalog.jsonb_build_object('revisionId',v_activation.revision_id,'revisionHash',v_activation.revision_hash,'activationId',v_activation.id,'reviewedCommitSha',v_activation.reviewed_commit_sha,'operatorIdentity',v_activation.operator_identity,'reason',v_activation.reason,'activatedAt',pg_catalog.to_char(v_activation.activated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.client_health_get_active_config_revision() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v_revision private.client_health_config_revisions%rowtype; v_activation private.client_health_config_revision_activations%rowtype;
begin
  select cr.* into v_revision from private.client_health_active_config_revision active
    join private.client_health_config_revision_activations a on a.id=active.activation_id
    join private.client_health_config_revisions cr on cr.id=a.revision_id and cr.revision_hash=a.revision_hash where active.singleton;
  if not found then return null; end if;
  select a.* into v_activation from private.client_health_active_config_revision active
    join private.client_health_config_revision_activations a on a.id=active.activation_id where active.singleton;
  perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  return pg_catalog.jsonb_build_object('revision',pg_catalog.jsonb_build_object('id',v_revision.id,'hash',v_revision.revision_hash,'content',v_revision.revision),'activation',pg_catalog.jsonb_build_object('revisionId',v_activation.revision_id,'revisionHash',v_activation.revision_hash,'activationId',v_activation.id,'reviewedCommitSha',v_activation.reviewed_commit_sha,'operatorIdentity',v_activation.operator_identity,'reason',v_activation.reason,'activatedAt',pg_catalog.to_char(v_activation.activated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
end $$;

create function public.client_health_assert_run_provenance(p_refresh_run_id uuid)
returns public.client_health_refresh_runs language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v_run public.client_health_refresh_runs%rowtype; v_revision private.client_health_config_revisions%rowtype; v_hash text; v_id uuid;
begin
  select * into v_run from public.client_health_refresh_runs where id=p_refresh_run_id;
  if not found then raise exception 'client health refresh run not found'; end if;
  select * into v_revision from private.client_health_config_revisions where id=v_run.config_revision_id and revision_hash=v_run.config_revision_hash;
  if not found or not exists(select 1 from private.client_health_config_revision_activations a where a.id=v_run.config_revision_activation_id and a.revision_id=v_run.config_revision_id and a.revision_hash=v_run.config_revision_hash) then raise exception 'client health refresh activation provenance is invalid'; end if;
  perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  if v_run.calculation_version<>v_revision.revision->>'calculationVersion' or v_run.source_contract_version<>v_revision.revision->>'sourceContractVersion' then raise exception 'client health refresh versions do not match its revision'; end if;
  v_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('configRevisionId',v_run.config_revision_id::text,'configRevisionHash',v_run.config_revision_hash,'snapshotDate',v_run.snapshot_date::text,'calculationVersion',v_run.calculation_version,'sourceContractVersion',v_run.source_contract_version)),'UTF8'),'sha256'),'hex');
  v_id:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_hash,'runAttemptId',v_run.run_attempt_id::text)),'UTF8'),'sha256'),'hex'));
  if v_run.refresh_identity_hash<>v_hash or v_run.id<>v_id then raise exception 'client health refresh identity/run UUID derivation is invalid'; end if;
  return v_run;
end $$;

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
  perform public.client_health_assert_run_provenance(p_refresh_run_id);
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
  p_config_revision_id uuid,
  p_config_revision_hash text,
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
  v_revision private.client_health_config_revisions%rowtype;
  v_activation private.client_health_config_revision_activations%rowtype;
  v_expected_identity_hash text;
  v_expected_run_id uuid;
  v_calculation_version text;
  v_source_contract_version text;
  v_now timestamptz;
begin
  if p_config_revision_hash is null or p_config_revision_hash !~ '^[0-9a-f]{64}$'
     or p_refresh_identity_hash is null or p_refresh_identity_hash !~ '^[0-9a-f]{64}$'
     or p_run_attempt_id is null or p_snapshot_date is null or p_started_at is null then
    raise exception 'client health refresh identity is malformed';
  end if;
  if p_snapshot_date > (pg_catalog.clock_timestamp() at time zone 'America/Phoenix')::date then
    raise exception 'client health refresh snapshot date cannot be in the future relative to database Phoenix date';
  end if;
  select cr.* into v_revision
  from private.client_health_active_config_revision active
  join private.client_health_config_revision_activations a on a.id=active.activation_id
  join private.client_health_config_revisions cr on cr.id=a.revision_id and cr.revision_hash=a.revision_hash
  where active.singleton and cr.id=p_config_revision_id and cr.revision_hash=p_config_revision_hash
  for share of active,a,cr;
  if not found then raise exception 'client health refresh revision is not the currently active activation'; end if;
  select a.* into v_activation from private.client_health_active_config_revision active
    join private.client_health_config_revision_activations a on a.id=active.activation_id
    where active.singleton and a.revision_id=p_config_revision_id and a.revision_hash=p_config_revision_hash;
  perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  v_calculation_version:=v_revision.revision->>'calculationVersion';
  v_source_contract_version:=v_revision.revision->>'sourceContractVersion';
  if p_calculation_version is distinct from v_calculation_version or p_source_contract_version is distinct from v_source_contract_version then
    raise exception 'client health refresh caller versions do not match active revision';
  end if;
  v_expected_identity_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object(
    'configRevisionId',p_config_revision_id::text,'configRevisionHash',p_config_revision_hash,'snapshotDate',p_snapshot_date::text,
    'calculationVersion',v_calculation_version,'sourceContractVersion',v_source_contract_version
  )),'UTF8'),'sha256'),'hex');
  if p_refresh_identity_hash<>v_expected_identity_hash then raise exception 'client health refresh identity hash does not match database derivation'; end if;
  v_expected_run_id:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object(
    'type','client-health-refresh-attempt','refreshIdentityHash',v_expected_identity_hash,'runAttemptId',p_run_attempt_id::text
  )),'UTF8'),'sha256'),'hex'));
  if p_id<>v_expected_run_id then raise exception 'client health refresh run ID does not match database derivation'; end if;

  -- Serialize the logical identity with both 32-bit halves of 64 hash bits. The
  -- partial unique index is the final invariant backstop if an advisory collision occurs.
  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(p_refresh_identity_hash, 1, 8))::bit(32)::int),
    (('x' || pg_catalog.substr(p_refresh_identity_hash, 9, 8))::bit(32)::int)
  );
  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());

  select * into v_run from public.client_health_refresh_runs where id = p_id or run_attempt_id = p_run_attempt_id for update;
  if found then
    if v_run.id <> v_expected_run_id or v_run.config_revision_id <> p_config_revision_id or v_run.config_revision_hash <> p_config_revision_hash
       or v_run.config_revision_activation_id <> v_activation.id or v_run.refresh_identity_hash <> v_expected_identity_hash
       or v_run.run_attempt_id <> p_run_attempt_id or v_run.snapshot_date <> p_snapshot_date
       or v_run.calculation_version <> v_calculation_version
       or v_run.source_contract_version <> v_source_contract_version or v_run.started_at <> p_started_at then
      raise exception 'client health refresh caller ID or attempt exists with incompatible identity';
    end if;
    return pg_catalog.jsonb_build_object(
      'id', v_run.id, 'configRevisionId',v_run.config_revision_id,'configRevisionHash',v_run.config_revision_hash,
      'refreshIdentityHash', v_expected_identity_hash, 'runAttemptId', v_run.run_attempt_id,
      'status', v_run.run_status, 'snapshotDate', v_run.snapshot_date,
      'calculationVersion', v_calculation_version, 'sourceContractVersion', v_source_contract_version,
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
    id, config_revision_id, config_revision_hash, config_revision_activation_id, refresh_identity_hash, run_attempt_id, snapshot_date, run_status, calculation_version, source_contract_version, started_at
  ) values (
    v_expected_run_id, p_config_revision_id, p_config_revision_hash, v_activation.id, v_expected_identity_hash, p_run_attempt_id, p_snapshot_date, 'collecting', v_calculation_version, v_source_contract_version, p_started_at
  );

  select * into v_run from public.client_health_refresh_runs where id = p_id;
  if v_run.id is null
     or v_run.config_revision_id <> p_config_revision_id or v_run.config_revision_hash <> p_config_revision_hash or v_run.config_revision_activation_id<>v_activation.id
     or v_run.snapshot_date <> p_snapshot_date
     or v_run.refresh_identity_hash <> v_expected_identity_hash
     or v_run.run_attempt_id <> p_run_attempt_id
     or v_run.run_status <> 'collecting'
     or v_run.calculation_version <> v_calculation_version
     or v_run.source_contract_version <> v_source_contract_version
     or v_run.started_at <> p_started_at then
    raise exception 'client health refresh caller ID exists with incompatible identity or state';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_run.id, 'configRevisionId',v_run.config_revision_id,'configRevisionHash',v_run.config_revision_hash,
    'refreshIdentityHash', v_expected_identity_hash, 'runAttemptId', v_run.run_attempt_id,
    'status', v_run.run_status, 'snapshotDate', v_run.snapshot_date,
    'calculationVersion', v_calculation_version, 'sourceContractVersion', v_source_contract_version,
    'startedAt', pg_catalog.to_char(v_run.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$$;

create function public.client_health_get_refresh_run(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare r public.client_health_refresh_runs%rowtype;
begin
  select * into r from public.client_health_refresh_runs where id=p_id;
  if not found then return null; end if;
  r:=public.client_health_assert_run_provenance(p_id);
  return pg_catalog.jsonb_build_object(
    'id', r.id, 'configRevisionId',r.config_revision_id,'configRevisionHash',r.config_revision_hash,
    'refreshIdentityHash', r.refresh_identity_hash, 'runAttemptId', r.run_attempt_id,
    'status', r.run_status, 'snapshotDate', r.snapshot_date,
    'calculationVersion', r.calculation_version, 'sourceContractVersion', r.source_contract_version,
    'startedAt', pg_catalog.to_char(r.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
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
  perform public.client_health_assert_run_provenance(p_refresh_run_id);
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
returns jsonb language plpgsql security definer set search_path = pg_catalog, public volatile as $$
declare r public.client_health_refresh_runs%rowtype;
begin
  select * into r from public.client_health_refresh_runs where id=p_refresh_run_id;
  if not found or r.lease_invocation_id is null or r.run_status not in ('collecting','validated') or r.lease_expires_at<=pg_catalog.clock_timestamp() then return null; end if;
  r:=public.client_health_assert_run_provenance(p_refresh_run_id);
  return pg_catalog.jsonb_build_object(
    'refreshRunId', r.id, 'invocationId', r.lease_invocation_id,
    'claimAttemptId', r.lease_claim_attempt_id,
    'leaseGrantedAt', pg_catalog.to_char(r.lease_granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'leaseExpiresAt', pg_catalog.to_char(r.lease_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'fencingToken', r.lease_fencing_token
  );
end
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
  perform public.client_health_assert_run_provenance(p_refresh_run_id);
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
  v_run public.client_health_refresh_runs%rowtype;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'collecting' then
    raise exception 'client health source creation requires a collecting refresh';
  end if;
  if p_source_key is null or p_source_key !~ '^[a-z0-9][a-z0-9_.-]*$' or p_started_at is null
     or ((p_window_start is null) <> (p_window_end is null)) then
    raise exception 'client health source identity is malformed';
  end if;
  perform public.client_health_assert_config_revision(v_run.config_revision_id,v_run.config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_run.config_revision_id));
  if (select count(*)
      from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
      cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
      where cr.id=v_run.config_revision_id and cr.revision_hash=v_run.config_revision_hash
        and c->>'clientId'=p_client_id::text and x->>'sourceKey'=p_source_key) <> 1 then
    raise exception 'source client/key is not exactly authorized by run-pinned revision';
  end if;
  if p_window_start is distinct from pg_catalog.date_trunc('month',v_run.snapshot_date)::date
     or p_window_end is distinct from v_run.snapshot_date then
    raise exception 'source window does not match the run materialized date window';
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

create function public.client_health_assert_source_evidence(
  p_id uuid,
  p_status text,
  p_finished_at timestamptz,
  p_data_through timestamptz,
  p_row_count bigint,
  p_request_fingerprint text,
  p_evidence jsonb,
  p_facts jsonb,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.client_health_source_runs%rowtype;
  v_run public.client_health_refresh_runs%rowtype;
  v_binding jsonb;
  v_provider text;
  v_count numeric;
  v_timestamp_text text;
  v_count_type text;
  v_permitted_fields text[];
  v_fact record;
begin
  select * into v_source from public.client_health_source_runs where id=p_id;
  if not found then raise exception 'client health source run not found'; end if;
  select * into v_run from public.client_health_refresh_runs where id=v_source.refresh_run_id;
  if not found then raise exception 'client health source refresh run not found'; end if;
  if p_status not in ('succeeded','partial','failed') or p_finished_at is null
     or not pg_catalog.isfinite(p_finished_at) or not pg_catalog.isfinite(v_source.started_at)
     or p_finished_at<v_source.started_at
     or p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_evidence is null or pg_catalog.jsonb_typeof(p_evidence)<>'object'
     or p_facts is null or pg_catalog.jsonb_typeof(p_facts)<>'object' then
    raise exception 'client health source evidence envelope is malformed';
  end if;
  select source into strict v_binding
  from private.client_health_config_revisions cr
  cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
  cross join lateral pg_catalog.jsonb_array_elements(client->'sources') source
  where cr.id=v_run.config_revision_id and cr.revision_hash=v_run.config_revision_hash
    and client->>'clientId'=v_source.client_id::text and source->>'sourceKey'=v_source.source_key;
  v_provider:=v_binding->>'provider';
  select coalesce(pg_catalog.array_agg(value #>> '{}' order by value #>> '{}'),'{}'::text[])
  into v_permitted_fields from pg_catalog.jsonb_array_elements(v_binding->'permittedFactFields') value;
  perform public.client_health_assert_exact_keys(p_facts,v_permitted_fields,'source facts');
  for v_fact in select key,value from pg_catalog.jsonb_each(p_facts) loop
    if v_fact.key in ('monthSpend','hoursUsed','overdueTaskCount','revenue','fulfillmentCost') then
      if pg_catalog.jsonb_typeof(v_fact.value) not in ('number','null')
         or (pg_catalog.jsonb_typeof(v_fact.value)='number' and ((v_fact.value #>> '{}')::numeric<0
           or (v_fact.key='overdueTaskCount' and pg_catalog.trunc((v_fact.value #>> '{}')::numeric)<>(v_fact.value #>> '{}')::numeric))) then
        raise exception 'source scalar fact must be a finite nonnegative number or null (overdueTaskCount must be an integer)';
      end if;
    elsif v_fact.key in ('currentRows','previousRows') then
      if pg_catalog.jsonb_typeof(v_fact.value) not in ('array','null')
         or (pg_catalog.jsonb_typeof(v_fact.value)='array' and pg_catalog.jsonb_array_length(v_fact.value)>100000) then
        raise exception 'source ratio fact must be null or an array of at most 100000 rows';
      end if;
      if pg_catalog.jsonb_typeof(v_fact.value)='array' and exists (
        select 1 from pg_catalog.jsonb_array_elements(v_fact.value) row
        where pg_catalog.jsonb_typeof(row)<>'object'
           or (select coalesce(pg_catalog.array_agg(key order by key),'{}') from pg_catalog.jsonb_object_keys(row) keys(key))<>array['results','spend']::text[]
           or pg_catalog.jsonb_typeof(row->'spend')<>'number' or pg_catalog.jsonb_typeof(row->'results')<>'number'
           or (row->>'spend')::numeric<0 or (row->>'results')::numeric<0
      ) then raise exception 'source ratio fact rows must have exact nonnegative numeric spend/results keys'; end if;
      if pg_catalog.jsonb_typeof(v_fact.value)='array' and exists (
        select 1 from (
          select public.client_health_canonical_json(row) canonical,
            pg_catalog.lag(public.client_health_canonical_json(row)) over (order by ordinality) previous
          from pg_catalog.jsonb_array_elements(v_fact.value) with ordinality item(row,ordinality)
        ) ordered where previous>canonical
      ) then raise exception 'source ratio fact rows are not in canonical order'; end if;
    else raise exception 'source fact key is unsupported'; end if;
  end loop;
  if p_status<>'succeeded' and exists (select 1 from pg_catalog.jsonb_each(p_facts) fact where pg_catalog.jsonb_typeof(fact.value)<>'null') then
    raise exception 'partial/failed source facts must contain only null values';
  end if;
  if p_status='succeeded' and exists (
    select 1 from unnest(array['monthSpend','hoursUsed','overdueTaskCount','revenue','fulfillmentCost']) scalar(key)
    where pg_catalog.jsonb_typeof(p_facts->scalar.key)='number' and exists (
      select 1 from public.client_health_source_runs other where other.refresh_run_id=v_source.refresh_run_id
        and other.client_id=v_source.client_id and other.id<>v_source.id and other.run_status='succeeded'
        and pg_catalog.jsonb_typeof(other.facts->scalar.key)='number')
  ) then raise exception 'source scalar fact has multiple succeeded providers'; end if;
  if p_request_fingerprint<>v_binding->>'requestFingerprint'
     or p_evidence->>'sourceKey' is distinct from v_source.source_key
     or p_evidence->>'provider' is distinct from v_provider
     or p_evidence->>'sourceContractVersion' is distinct from v_run.source_contract_version
     or p_evidence->>'requestFingerprint' is distinct from v_binding->>'requestFingerprint' then
    raise exception 'source evidence identity/fingerprint/version does not match run-pinned revision';
  end if;
  if v_provider='supabase' then
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','project','relation','retrievedAt','sourceContractVersion','requestFingerprint','selectedRowCount'],'source evidence');
    if p_evidence->>'project' is distinct from v_binding->>'project' or p_evidence->>'relation' is distinct from v_binding->>'relation' then raise exception 'forged Supabase source evidence'; end if;
    v_count_type:=pg_catalog.jsonb_typeof(p_evidence->'selectedRowCount');
    if v_count_type not in ('number','null') then raise exception 'Supabase selectedRowCount must be a JSON number or null'; end if;
    v_count:=case when v_count_type='number' then (p_evidence->>'selectedRowCount')::numeric else null end;
    if pg_catalog.jsonb_typeof(p_evidence->'retrievedAt')<>'string' then raise exception 'Supabase retrievedAt must be a string'; end if;
    v_timestamp_text:=p_evidence->>'retrievedAt';
  elsif v_provider='google-sheets' then
    -- Google Sheets evidence intentionally has no retrievedAt key, matching the TypeScript contract.
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','spreadsheetId','range','valueRenderOption','dateTimeRenderOption','sourceContractVersion','approvedClientAliasHash','requestFingerprint','matchedRowCount'],'source evidence');
    if p_evidence->>'spreadsheetId' is distinct from v_binding->>'spreadsheetId' or p_evidence->>'range' is distinct from v_binding->>'range'
       or p_evidence->>'valueRenderOption' is distinct from v_binding->>'valueRenderOption' or p_evidence->>'dateTimeRenderOption' is distinct from v_binding->>'dateTimeRenderOption'
       or p_evidence->>'approvedClientAliasHash' is distinct from v_binding->>'approvedClientAliasHash' then raise exception 'forged Google Sheets source evidence'; end if;
    v_count_type:=pg_catalog.jsonb_typeof(p_evidence->'matchedRowCount');
    if v_count_type not in ('number','null') then raise exception 'Google Sheets matchedRowCount must be a JSON number or null'; end if;
    v_count:=case when v_count_type='number' then (p_evidence->>'matchedRowCount')::numeric else null end;
  elsif v_provider='clickup' then
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','endpointFamily','retrievedAt','sourceContractVersion','requestFingerprint','timeEntryCount','totalDurationMs','overdueTaskCount'],'source evidence');
    if p_evidence->>'endpointFamily' is distinct from v_binding->>'endpointFamily' then raise exception 'forged ClickUp source evidence'; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'timeEntryCount') not in ('number','null')
       or pg_catalog.jsonb_typeof(p_evidence->'overdueTaskCount') not in ('number','null')
       or pg_catalog.jsonb_typeof(p_evidence->'timeEntryCount')<>pg_catalog.jsonb_typeof(p_evidence->'overdueTaskCount') then
      raise exception 'ClickUp evidence counts must both be JSON numbers or both be null';
    end if;
    if pg_catalog.jsonb_typeof(p_evidence->'timeEntryCount')='number' then
      v_count:=(p_evidence->>'timeEntryCount')::numeric+(p_evidence->>'overdueTaskCount')::numeric;
    else v_count:=null; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs') not in ('string','null')
       or (pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')='string' and p_evidence->>'totalDurationMs' !~ '^(0|[1-9][0-9]*)$') then
      raise exception 'ClickUp totalDurationMs must be a nonnegative canonical integer string or null';
    end if;
    if pg_catalog.jsonb_typeof(p_evidence->'retrievedAt')<>'string' then raise exception 'ClickUp retrievedAt must be a string'; end if;
    v_timestamp_text:=p_evidence->>'retrievedAt';
  else raise exception 'source evidence provider is invalid'; end if;
  if v_timestamp_text is not null and (
       v_timestamp_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
       or not pg_catalog.isfinite(v_timestamp_text::timestamptz)
       or pg_catalog.to_char(v_timestamp_text::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>v_timestamp_text) then
    raise exception 'source evidence retrievedAt must be a finite canonical UTC timestamp';
  end if;
  if v_count is not null and (v_count<0 or pg_catalog.trunc(v_count)<>v_count or v_count>9223372036854775807) then
    raise exception 'source evidence count is not a nonnegative bigint JSON number';
  end if;
  if p_data_through is not null and (not pg_catalog.isfinite(p_data_through)
     or p_data_through<>(p_data_through at time zone 'UTC')::date::timestamp at time zone 'UTC'
     or (p_data_through at time zone 'UTC')::date>v_run.snapshot_date) then
    raise exception 'source dataThrough must be finite UTC midnight no later than snapshotDate';
  end if;
  if p_error_code is not null and (p_error_code='' or p_error_code<>pg_catalog.btrim(p_error_code) or pg_catalog.length(p_error_code)>128) then raise exception 'source error code is malformed or oversized'; end if;
  if p_error_message is not null and (p_error_message='' or p_error_message<>pg_catalog.btrim(p_error_message) or pg_catalog.length(p_error_message)>2000) then raise exception 'source error message is malformed or oversized'; end if;
  if p_status='succeeded' then
    if p_data_through is null or p_row_count is null or p_error_code is not null or p_error_message is not null
       or v_count is null or v_count<>p_row_count
       or (v_provider='clickup' and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'string') then
      raise exception 'succeeded source status/dataThrough/count/error/evidence shape is invalid';
    end if;
  elsif p_status='partial' then
    if p_error_code is null or p_error_message is null or (p_row_count is null)<>(v_count is null)
       or (p_row_count is not null and p_row_count<>v_count)
       or (v_provider='clickup' and ((p_row_count is null and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'null')
         or (p_row_count is not null and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'string'))) then
      raise exception 'partial source status/dataThrough/count/error/evidence shape is invalid';
    end if;
  else
    if p_data_through is not null or p_row_count is not null or p_error_code is null or p_error_message is null or v_count is not null
       or (v_provider='clickup' and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'null') then
      raise exception 'failed source status/dataThrough/count/error/evidence shape is invalid';
    end if;
  end if;
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
  p_facts jsonb,
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
declare
  v_source public.client_health_source_runs%rowtype;
  v_run public.client_health_refresh_runs%rowtype;
  v_binding jsonb;
  v_provider text;
  v_count numeric;
  v_timestamp_text text;
begin
  v_run := public.client_health_assert_owned_lease(p_refresh_run_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'collecting' then raise exception 'client health source completion requires a collecting refresh'; end if;
  if p_status not in ('succeeded', 'partial', 'failed') or p_finished_at is null or not pg_catalog.isfinite(p_finished_at)
     or p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_evidence is null or pg_catalog.jsonb_typeof(p_evidence) <> 'object'
     or p_facts is null or pg_catalog.jsonb_typeof(p_facts) <> 'object' then
    raise exception 'client health source completion is malformed';
  end if;
  select * into v_source from public.client_health_source_runs
  where id = p_id and refresh_run_id = p_refresh_run_id for update;
  if not found then raise exception 'client health source run not found'; end if;
  if not pg_catalog.isfinite(v_source.started_at) or p_finished_at<v_source.started_at then
    raise exception 'source finishedAt must be finite and no earlier than startedAt';
  end if;
  select source into v_binding
  from private.client_health_config_revisions cr
  cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
  cross join lateral pg_catalog.jsonb_array_elements(client->'sources') source
  where cr.id=v_run.config_revision_id and cr.revision_hash=v_run.config_revision_hash
    and client->>'clientId'=v_source.client_id::text and source->>'sourceKey'=v_source.source_key;
  if not found then raise exception 'source completion is not authorized by run-pinned revision'; end if;
  v_provider := v_binding->>'provider';
  if p_request_fingerprint <> v_binding->>'requestFingerprint'
     or p_evidence->>'sourceKey' is distinct from v_source.source_key
     or p_evidence->>'provider' is distinct from v_provider
     or p_evidence->>'sourceContractVersion' is distinct from v_run.source_contract_version
     or p_evidence->>'requestFingerprint' is distinct from v_binding->>'requestFingerprint' then
    raise exception 'source completion evidence identity/fingerprint/version does not match run-pinned revision';
  end if;
  if v_provider='supabase' then
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','project','relation','retrievedAt','sourceContractVersion','requestFingerprint','selectedRowCount'],'source evidence');
    if p_evidence->>'project' is distinct from v_binding->>'project' or p_evidence->>'relation' is distinct from v_binding->>'relation' then raise exception 'forged Supabase source evidence'; end if;
    v_count := case when pg_catalog.jsonb_typeof(p_evidence->'selectedRowCount')='number' then (p_evidence->>'selectedRowCount')::numeric else null end;
    v_timestamp_text := p_evidence->>'retrievedAt';
  elsif v_provider='google-sheets' then
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','spreadsheetId','range','valueRenderOption','dateTimeRenderOption','sourceContractVersion','approvedClientAliasHash','requestFingerprint','matchedRowCount'],'source evidence');
    if p_evidence->>'spreadsheetId' is distinct from v_binding->>'spreadsheetId' or p_evidence->>'range' is distinct from v_binding->>'range'
       or p_evidence->>'valueRenderOption' is distinct from v_binding->>'valueRenderOption' or p_evidence->>'dateTimeRenderOption' is distinct from v_binding->>'dateTimeRenderOption'
       or p_evidence->>'approvedClientAliasHash' is distinct from v_binding->>'approvedClientAliasHash' then raise exception 'forged Google Sheets source evidence'; end if;
    v_count := case when pg_catalog.jsonb_typeof(p_evidence->'matchedRowCount')='number' then (p_evidence->>'matchedRowCount')::numeric else null end;
  elsif v_provider='clickup' then
    perform public.client_health_assert_exact_keys(p_evidence,array['sourceKey','provider','endpointFamily','retrievedAt','sourceContractVersion','requestFingerprint','timeEntryCount','totalDurationMs','overdueTaskCount'],'source evidence');
    if p_evidence->>'endpointFamily' is distinct from v_binding->>'endpointFamily' then raise exception 'forged ClickUp source evidence'; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'timeEntryCount')='number' and pg_catalog.jsonb_typeof(p_evidence->'overdueTaskCount')='number' then
      v_count := (p_evidence->>'timeEntryCount')::numeric + (p_evidence->>'overdueTaskCount')::numeric;
    else v_count := null; end if;
    if pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs') not in ('string','null')
       or (pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')='string' and p_evidence->>'totalDurationMs' !~ '^(0|[1-9][0-9]*)$') then
      raise exception 'ClickUp totalDurationMs must be a nonnegative canonical integer string or null';
    end if;
    v_timestamp_text := p_evidence->>'retrievedAt';
  else raise exception 'source completion provider is invalid'; end if;
  if v_timestamp_text is not null and (pg_catalog.jsonb_typeof(pg_catalog.to_jsonb(v_timestamp_text))<>'string'
     or pg_catalog.to_char(v_timestamp_text::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>v_timestamp_text) then
    raise exception 'source evidence retrievedAt must be a canonical UTC timestamp';
  end if;
  if (v_provider in ('supabase','clickup') and v_timestamp_text is null)
     or v_count is not null and (v_count<0 or pg_catalog.trunc(v_count)<>v_count or v_count>9223372036854775807) then
    raise exception 'source evidence count/timestamp is malformed';
  end if;
  if p_status='succeeded' then
    if p_data_through is null or p_data_through>v_run.snapshot_date or p_row_count is null or p_row_count<0
       or p_error_code is not null or p_error_message is not null or v_count is null or v_count<>p_row_count
       or (v_provider='clickup' and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'string') then
      raise exception 'succeeded source completion status/dataThrough/count/error/evidence shape is invalid';
    end if;
  elsif p_status='partial' then
    if p_data_through>v_run.snapshot_date or p_row_count<0 or p_error_code is null or p_error_code='' or p_error_code<>pg_catalog.btrim(p_error_code)
       or p_error_message is null or p_error_message='' or p_error_message<>pg_catalog.btrim(p_error_message)
       or (p_row_count is null)<>(v_count is null) or (p_row_count is not null and p_row_count<>v_count) then
      raise exception 'partial source completion status/dataThrough/count/error/evidence shape is invalid';
    end if;
  else
    if p_data_through is not null or p_row_count is not null or p_error_code is null or p_error_code='' or p_error_code<>pg_catalog.btrim(p_error_code)
       or p_error_message is null or p_error_message='' or p_error_message<>pg_catalog.btrim(p_error_message) or v_count is not null
       or (v_provider='clickup' and pg_catalog.jsonb_typeof(p_evidence->'totalDurationMs')<>'null') then
      raise exception 'failed source completion status/dataThrough/count/error/evidence shape is invalid';
    end if;
  end if;
  if v_source.run_status = 'running' then
    update public.client_health_source_runs set
      run_status = p_status, finished_at = p_finished_at,
      data_through = case when p_data_through is null then null else p_data_through::timestamp at time zone 'UTC' end,
      row_count = p_row_count, request_fingerprint = p_request_fingerprint,
      evidence = p_evidence, facts = p_facts, error_code = p_error_code, error_message = p_error_message
    where id = p_id;
  elsif v_source.run_status <> p_status or v_source.finished_at <> p_finished_at
     or v_source.data_through is distinct from (case when p_data_through is null then null else p_data_through::timestamp at time zone 'UTC' end)
     or v_source.row_count is distinct from p_row_count or v_source.request_fingerprint is distinct from p_request_fingerprint
     or v_source.evidence <> p_evidence or v_source.facts <> p_facts or v_source.error_code is distinct from p_error_code
     or v_source.error_message is distinct from p_error_message then
    raise exception 'client health source completion retry differs from committed content';
  end if;
  perform public.client_health_assert_source_evidence(
    p_id,p_status,p_finished_at,
    case when p_data_through is null then null else p_data_through::timestamp at time zone 'UTC' end,
    p_row_count,p_request_fingerprint,p_evidence,p_facts,p_error_code,p_error_message
  );
end
$$;

create function public.client_health_assert_task_authorized(
  p_revision jsonb,
  p_refresh_run_id uuid,
  p_client_id uuid,
  p_list_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_list_id is null or p_list_id !~ '^[1-9][0-9]*$' or (
    select count(*)
    from pg_catalog.jsonb_array_elements(p_revision->'clients') client
    cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
    join public.client_health_source_runs sr on sr.refresh_run_id=p_refresh_run_id and sr.client_id=p_client_id
      and sr.source_key=binding->>'sourceKey' and sr.run_status='succeeded'
    where client->>'clientId'=p_client_id::text and binding->>'provider'='clickup'
      and (binding->>'permitsTasks')::boolean and binding->'allowedListIds' ? p_list_id
  ) <> 1 then
    raise exception 'task list is not authorized by exactly one succeeded run-pinned ClickUp source';
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
  v_config_revision_id uuid;
  v_config_revision_hash text;
  v_run public.client_health_refresh_runs%rowtype;
  v_client_id uuid;
  v_snapshot_id uuid;
  v_snapshot_date date;
  v_existing public.client_health_snapshots%rowtype;
  v_task_count integer;
  v_inserted boolean := false;
  v_computed_idempotency_key text;
begin
  perform public.client_health_assert_exact_keys(p_bundle,
    array['configRevisionId','configRevisionHash','idempotencyKey','evidenceHash','snapshotId','snapshot','tasks'], 'bundle');
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
          'configRevisionId',p_bundle->'configRevisionId','configRevisionHash',p_bundle->'configRevisionHash',
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
    v_config_revision_id := (p_bundle->>'configRevisionId')::uuid;
    v_config_revision_hash := p_bundle->>'configRevisionHash';
    v_client_id := (v_snapshot->>'clientId')::uuid;
    v_snapshot_id := (p_bundle->>'snapshotId')::uuid;
    v_snapshot_date := (v_snapshot->>'snapshotDate')::date;
  exception when others then
    raise exception 'bundle identity fields are malformed';
  end;
  if v_snapshot->>'snapshotDate' <> pg_catalog.to_char(v_snapshot_date, 'YYYY-MM-DD') then
    raise exception 'bundle snapshotDate is not canonical';
  end if;
  v_run := public.client_health_assert_owned_lease(v_refresh_id, p_invocation_id, p_claim_attempt_id, p_fencing_token);
  if v_run.run_status <> 'collecting' then
    raise exception 'client health snapshot persistence requires a collecting refresh';
  end if;
  if v_run.config_revision_id <> v_config_revision_id or v_run.config_revision_hash <> v_config_revision_hash then raise exception 'snapshot revision does not match refresh revision'; end if;
  perform public.client_health_assert_config_revision(v_config_revision_id,v_config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_config_revision_id));
  if not exists (select 1 from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
    where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text) then raise exception 'snapshot client is not authorized by revision'; end if;

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
           and ((v_item.value->>'rowCount')::numeric < 0 or (v_item.value->>'rowCount')::numeric > 9223372036854775807
             or pg_catalog.trunc((v_item.value->>'rowCount')::numeric) <> (v_item.value->>'rowCount')::numeric)) then
      raise exception 'bundle snapshot source content is malformed';
    end if;
  end loop;
  if (select coalesce(pg_catalog.array_agg(source_key order by source_key),'{}') from pg_catalog.jsonb_object_keys(v_sources) keys(source_key)) <>
     (select coalesce(pg_catalog.array_agg(x->>'sourceKey' order by x->>'sourceKey'),'{}')
      from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
      cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
      where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text) then
    raise exception 'snapshot sources do not exactly match revision authorization: presented %, authorized %',
      (select coalesce(pg_catalog.array_agg(source_key order by source_key),'{}') from pg_catalog.jsonb_object_keys(v_sources) keys(source_key)),
      (select coalesce(pg_catalog.array_agg(x->>'sourceKey' order by x->>'sourceKey'),'{}')
       from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') c
       cross join lateral pg_catalog.jsonb_array_elements(c->'sources') x
       where cr.id=v_config_revision_id and c->>'clientId'=v_client_id::text);
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_each(v_sources) presented(source_key, source_status)
    where not exists (
      select 1
      from public.client_health_source_runs sr
      join private.client_health_config_revisions cr on cr.id=v_config_revision_id and cr.revision_hash=v_config_revision_hash
      cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
      cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
      where sr.refresh_run_id=v_refresh_id and sr.client_id=v_client_id and sr.source_key=presented.source_key
        and client->>'clientId'=v_client_id::text and binding->>'sourceKey'=sr.source_key
        and sr.window_start=pg_catalog.date_trunc('month',v_run.snapshot_date)::date and sr.window_end=v_run.snapshot_date
        and presented.source_status->>'status'=sr.run_status
        and presented.source_status->>'dataThrough' is not distinct from case when sr.data_through is null then null else pg_catalog.to_char(sr.data_through at time zone 'UTC','YYYY-MM-DD') end
        and presented.source_status->>'rowCount' is not distinct from case when sr.row_count is null then null else sr.row_count::text end
        and (presented.source_status->>'stale')::boolean = case when sr.data_through is null then true else v_run.snapshot_date-(sr.data_through at time zone 'UTC')::date > (binding->'freshnessPolicy'->>'maximumLagDays')::integer end
    )
  ) then raise exception 'snapshot source status/dataThrough/rowCount/stale does not reconcile to committed source run'; end if;

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
    perform public.client_health_assert_task_authorized(
      (select revision from private.client_health_config_revisions where id=v_config_revision_id and revision_hash=v_config_revision_hash),
      v_refresh_id,v_client_id,v_task->>'listId'
    );
  end loop;
  if v_task_count <> (case when exists (
       select 1 from private.client_health_config_revisions cr
       cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') client
       cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
       join public.client_health_source_runs sr on sr.refresh_run_id=v_refresh_id and sr.client_id=v_client_id and sr.source_key=binding->>'sourceKey' and sr.run_status='succeeded'
       where cr.id=v_config_revision_id and client->>'clientId'=v_client_id::text and binding->>'provider'='clickup' and (binding->>'permitsTasks')::boolean
     ) then coalesce(least((v_snapshot->>'overdueTaskCount')::integer, 5), 0) else 0 end)
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
      config_revision_id, config_revision_hash, persistence_evidence_hash, persistence_idempotency_key
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
      v_config_revision_id, v_config_revision_hash, p_bundle->>'evidenceHash', p_bundle->>'idempotencyKey'
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
       or v_existing.config_revision_id <> v_config_revision_id or v_existing.config_revision_hash <> v_config_revision_hash
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
    'refreshRunId', v_refresh_id, 'configRevisionId',v_config_revision_id,'configRevisionHash',v_config_revision_hash,
    'clientId', v_client_id, 'snapshotId', v_snapshot_id,
    'taskCount', v_task_count, 'evidenceHash', p_bundle->>'evidenceHash',
    'idempotencyKey', p_bundle->>'idempotencyKey'
  );
end
$$;

create function public.client_health_assert_refresh_integrity(p_refresh_run_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.client_health_refresh_runs%rowtype;
  v_revision private.client_health_config_revisions%rowtype;
  v_expected_hash text;
  v_expected_id uuid;
  v_item record;
begin
  select * into v_run from public.client_health_refresh_runs where id = p_refresh_run_id;
  if not found then raise exception 'client health refresh run not found'; end if;
  select * into v_revision from private.client_health_config_revisions where id=v_run.config_revision_id and revision_hash=v_run.config_revision_hash;
  if not found or not exists(select 1 from private.client_health_config_revision_activations a where a.id=v_run.config_revision_activation_id and a.revision_id=v_run.config_revision_id and a.revision_hash=v_run.config_revision_hash) then
    raise exception 'client health refresh activation provenance is invalid';
  end if;
  perform public.client_health_assert_config_revision(v_revision.id,v_revision.revision_hash,v_revision.revision);
  if v_run.calculation_version<>v_revision.revision->>'calculationVersion' or v_run.source_contract_version<>v_revision.revision->>'sourceContractVersion'
     or v_run.snapshot_date>(pg_catalog.clock_timestamp() at time zone 'America/Phoenix')::date then raise exception 'client health refresh derived revision fields are invalid'; end if;
  v_expected_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object(
    'configRevisionId',v_run.config_revision_id::text,'configRevisionHash',v_run.config_revision_hash,'snapshotDate',v_run.snapshot_date::text,
    'calculationVersion',v_run.calculation_version,'sourceContractVersion',v_run.source_contract_version)),'UTF8'),'sha256'),'hex');
  v_expected_id:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object(
    'type','client-health-refresh-attempt','refreshIdentityHash',v_expected_hash,'runAttemptId',v_run.run_attempt_id::text)),'UTF8'),'sha256'),'hex'));
  if v_run.refresh_identity_hash<>v_expected_hash or v_run.id<>v_expected_id then raise exception 'client health refresh identity/run UUID derivation is invalid'; end if;
  if not exists (select 1 from public.client_health_snapshots where refresh_run_id = p_refresh_run_id)
     or exists (
       select 1 from private.client_health_config_revisions cr
       cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
       where cr.id = v_run.config_revision_id and not exists (
         select 1 from public.client_health_snapshots s where s.refresh_run_id = p_refresh_run_id
           and s.client_id = (rc->>'clientId')::uuid
           and s.snapshot_date = v_run.snapshot_date
           and s.config_revision_id = v_run.config_revision_id and s.config_revision_hash = v_run.config_revision_hash)
     ) or exists (
       select 1 from public.client_health_snapshots s where s.refresh_run_id = p_refresh_run_id
         and (s.snapshot_date <> v_run.snapshot_date or s.config_revision_id <> v_run.config_revision_id
           or s.config_revision_hash <> v_run.config_revision_hash or not exists (
             select 1 from private.client_health_config_revisions cr
             cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
             where cr.id = v_run.config_revision_id and rc->>'clientId' = s.client_id::text))
     ) then raise exception 'client health refresh snapshots must exactly cover revision clients'; end if;
  if exists (select 1 from public.client_health_source_runs where refresh_run_id = p_refresh_run_id and run_status = 'running')
     or exists (
       select 1 from private.client_health_config_revisions cr
       cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
       cross join lateral pg_catalog.jsonb_array_elements(rc->'sources') source
       where cr.id = v_run.config_revision_id and not exists (
         select 1 from public.client_health_source_runs sr where sr.refresh_run_id = p_refresh_run_id
           and sr.client_id = (rc->>'clientId')::uuid and sr.source_key = source->>'sourceKey' and sr.run_status <> 'running')
     ) or exists (
       select 1 from public.client_health_source_runs sr where sr.refresh_run_id = p_refresh_run_id and not exists (
         select 1 from private.client_health_config_revisions cr
         cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
         cross join lateral pg_catalog.jsonb_array_elements(rc->'sources') source
         where cr.id = v_run.config_revision_id and rc->>'clientId' = sr.client_id::text and source->>'sourceKey' = sr.source_key)
     ) then raise exception 'client health refresh source runs must exactly cover revision sources'; end if;
  -- Revalidate committed provider identity, fingerprint, evidence, status semantics,
  -- finite timestamp ordering, and exact retry-compatible values at validate/publish.
  for v_item in select * from public.client_health_source_runs where refresh_run_id=p_refresh_run_id loop
    perform public.client_health_assert_source_evidence(
      v_item.id,v_item.run_status,v_item.finished_at,v_item.data_through,v_item.row_count,
      v_item.request_fingerprint,v_item.evidence,v_item.facts,v_item.error_code,v_item.error_message
    );
  end loop;
  for v_item in
    select snapshot.client_id, snapshot.source_statuses
    from public.client_health_snapshots snapshot where snapshot.refresh_run_id=p_refresh_run_id
  loop
    if pg_catalog.jsonb_typeof(v_item.source_statuses)<>'object'
       or (select coalesce(pg_catalog.array_agg(source_key order by source_key),'{}')
           from pg_catalog.jsonb_object_keys(v_item.source_statuses) keys(source_key)) <>
          (select coalesce(pg_catalog.array_agg(binding->>'sourceKey' order by binding->>'sourceKey'),'{}')
           from pg_catalog.jsonb_array_elements(v_revision.revision->'clients') client
           cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
           where client->>'clientId'=v_item.client_id::text) then
      raise exception 'client health snapshot source key set does not exactly match revision sources';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_each(v_item.source_statuses) presented(source_key,source_status)
      where pg_catalog.jsonb_typeof(source_status)<>'object'
         or (select coalesce(pg_catalog.array_agg(key order by key),'{}') from pg_catalog.jsonb_object_keys(source_status) keys(key))
            <> array['dataThrough','rowCount','stale','status']::text[]
         or pg_catalog.jsonb_typeof(source_status->'status')<>'string'
         or source_status->>'status' not in ('succeeded','partial','failed')
         or pg_catalog.jsonb_typeof(source_status->'dataThrough') not in ('string','null')
         or pg_catalog.jsonb_typeof(source_status->'rowCount') not in ('number','null')
         or pg_catalog.jsonb_typeof(source_status->'stale')<>'boolean'
    ) then raise exception 'client health snapshot source status shape is malformed'; end if;
  end loop;
  if exists (
    select 1
    from public.client_health_snapshots snapshot
    cross join lateral pg_catalog.jsonb_each(snapshot.source_statuses) presented(source_key, source_status)
    where snapshot.refresh_run_id=p_refresh_run_id and not exists (
      select 1
      from public.client_health_source_runs sr
      cross join lateral pg_catalog.jsonb_array_elements(v_revision.revision->'clients') client
      cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
      where sr.refresh_run_id=p_refresh_run_id and sr.client_id=snapshot.client_id and sr.source_key=presented.source_key
        and client->>'clientId'=snapshot.client_id::text and binding->>'sourceKey'=sr.source_key
        and sr.window_start=pg_catalog.date_trunc('month',v_run.snapshot_date)::date and sr.window_end=v_run.snapshot_date
        and presented.source_status->>'status'=sr.run_status
        and presented.source_status->>'dataThrough' is not distinct from case when sr.data_through is null then null else pg_catalog.to_char(sr.data_through at time zone 'UTC','YYYY-MM-DD') end
        and presented.source_status->>'rowCount' is not distinct from case when sr.row_count is null then null else sr.row_count::text end
        and (presented.source_status->>'stale')::boolean = case when sr.data_through is null then true else v_run.snapshot_date-(sr.data_through at time zone 'UTC')::date > (binding->'freshnessPolicy'->>'maximumLagDays')::integer end
    )
  ) then raise exception 'client health snapshot/source reconciliation mismatch'; end if;
  if exists (
    select 1 from public.client_health_snapshot_tasks task
    join public.client_health_snapshots snapshot on snapshot.id=task.snapshot_id and snapshot.refresh_run_id=p_refresh_run_id
    where (select count(*)
      from pg_catalog.jsonb_array_elements(v_revision.revision->'clients') client
      cross join lateral pg_catalog.jsonb_array_elements(client->'sources') binding
      join public.client_health_source_runs sr on sr.refresh_run_id=p_refresh_run_id and sr.client_id=snapshot.client_id
        and sr.source_key=binding->>'sourceKey' and sr.run_status='succeeded'
      where client->>'clientId'=snapshot.client_id::text and binding->>'provider'='clickup'
        and (binding->>'permitsTasks')::boolean and binding->'allowedListIds' ? task.list_id) <> 1
  ) then raise exception 'client health persisted task is not authorized by exactly one succeeded run-pinned ClickUp source'; end if;
end
$$;

-- Replace the foundation publication trigger body so publication is authorized only
-- by the immutable revision, never by mutable authoring tables.
create or replace function public.client_health_guard_refresh_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 20260820));
    if new.run_status <> 'collecting' then raise exception 'client health refreshes must be inserted in collecting state'; end if;
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.id::text, 20260820));
  if old.run_status = 'published' then raise exception 'published client health refreshes are immutable'; end if;
  if tg_op = 'UPDATE' and new.run_status = 'published' then
    perform public.client_health_assert_refresh_integrity(new.id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
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
  perform public.client_health_assert_config_revision(v_run.config_revision_id,v_run.config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_run.config_revision_id));
  if p_evidence_hash !~ '^[0-9a-f]{64}$' or p_validated_at is null then raise exception 'client health validation is malformed'; end if;
  perform public.client_health_assert_refresh_integrity(p_refresh_run_id);
  if v_run.run_status = 'collecting' then
    if exists (
      select 1 from private.client_health_config_revisions cr
      cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
      where cr.id=v_run.config_revision_id and not exists (
        select 1 from public.client_health_snapshots s where s.refresh_run_id=p_refresh_run_id
          and s.client_id=(rc->>'clientId')::uuid
          and s.config_revision_id=v_run.config_revision_id and s.config_revision_hash=v_run.config_revision_hash)
    ) or exists (
      select 1 from public.client_health_snapshots s where s.refresh_run_id=p_refresh_run_id and
        (s.config_revision_id<>v_run.config_revision_id or s.config_revision_hash<>v_run.config_revision_hash or not exists (
          select 1 from private.client_health_config_revisions cr cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') rc
          where cr.id=v_run.config_revision_id and rc->>'clientId'=s.client_id::text))
    ) then
      raise exception 'client health refresh snapshots must exactly cover revision clients';
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
  perform public.client_health_assert_config_revision(v_run.config_revision_id,v_run.config_revision_hash,
    (select revision from private.client_health_config_revisions where id=v_run.config_revision_id));
  if v_run.run_status <> 'validated' or p_published_at is null then
    raise exception 'client health refresh is not publishable';
  end if;
  -- Reassert the frozen revision, client membership, source coverage, and snapshot
  -- provenance immediately before the terminal publication update.
  perform public.client_health_assert_refresh_integrity(p_refresh_run_id);
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

create or replace view public.client_health_latest with (security_invoker = false) as
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
  r.calculation_version, r.source_contract_version, r.evidence_hash,
  s.config_revision_id, s.config_revision_hash,
  revision_client.value->>'clientId' as revision_client_id,
  revision_client.value->>'clientKey' as revision_client_key,
  revision_client.value->>'displayName' as revision_display_name,
  revision_client.value->>'dashboardHref' as revision_dashboard_href,
  revision_client.value->>'configStatus' as revision_config_status,
  revision_client.value->>'reportingTimezone' as revision_reporting_timezone,
  (revision_client.value->'fixedValues'->>'monthlyHoursAllotment')::numeric as revision_monthly_hours_allotment,
  revision_client.value->'clickupListIds' as revision_clickup_list_ids,
  revision_client.value->'marginAliases' as revision_margin_aliases,
  revision_client.value->'metrics' as revision_metric_config
from public.client_health_snapshots s
join public.client_health_refresh_runs r on r.id = s.refresh_run_id
  and r.config_revision_id = s.config_revision_id
  and r.config_revision_hash = s.config_revision_hash
join private.client_health_config_revisions cr on cr.id = s.config_revision_id
  and cr.revision_hash = s.config_revision_hash
cross join lateral pg_catalog.jsonb_array_elements(cr.revision->'clients') revision_client(value)
where r.run_status = 'published'
  and revision_client.value->>'clientId' = s.client_id::text
order by s.client_id, r.snapshot_date desc, r.published_at desc, r.id desc, s.id desc;
revoke all on table public.client_health_latest from public,anon,authenticated,service_role;
grant select on table public.client_health_latest to service_role;

-- Security-definer ownership is pinned to postgres; helper/trigger functions are never callable by API roles.
alter table private.client_health_config_revisions owner to postgres;
alter table private.client_health_config_revision_activations owner to postgres;
alter table private.client_health_active_config_revision owner to postgres;
alter function public.client_health_revision_id(text) owner to postgres;
alter function public.client_health_assert_safe_revision_json(jsonb,text,integer) owner to postgres;
alter function public.client_health_assert_config_revision(uuid,text,jsonb) owner to postgres;
alter function public.client_health_guard_config_revision_immutable() owner to postgres;
alter function private.client_health_guard_activation_immutable() owner to postgres;
alter function private.client_health_stage_config_revision(uuid,text,jsonb) owner to postgres;
alter function private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid) owner to postgres;
alter function public.client_health_get_active_config_revision() owner to postgres;
alter function public.client_health_assert_run_provenance(uuid) owner to postgres;
alter function public.client_health_assert_exact_keys(jsonb,text[],text) owner to postgres;
alter function public.client_health_canonical_json(jsonb) owner to postgres;
alter function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz) owner to postgres;
alter function public.client_health_get_refresh_run(uuid) owner to postgres;
alter function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_get_refresh_lease(uuid) owner to postgres;
alter function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) owner to postgres;
alter function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) owner to postgres;
alter function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_get_source_run(uuid,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text) owner to postgres;
alter function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,jsonb,text,text,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_assert_task_authorized(jsonb,uuid,uuid,text) owner to postgres;
alter function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_assert_refresh_integrity(uuid) owner to postgres;
alter function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint) owner to postgres;
alter function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint) owner to postgres;

revoke all on function public.client_health_revision_id(text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_safe_revision_json(jsonb,text,integer) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_config_revision(uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.client_health_guard_config_revision_immutable() from public, anon, authenticated, service_role;
revoke all on function private.client_health_guard_activation_immutable() from public, anon, authenticated, service_role;
revoke all on function private.client_health_stage_config_revision(uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_active_config_revision() from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_run_provenance(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_exact_keys(jsonb,text[],text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_refresh_integrity(uuid) from public, anon, authenticated, service_role;

revoke all on function public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_refresh_run(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_refresh_lease(uuid) from public, anon, authenticated, service_role;
revoke all on function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_get_source_run(uuid,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,jsonb,text,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_assert_task_authorized(jsonb,uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint) from public, anon, authenticated, service_role;

grant execute on function public.client_health_get_active_config_revision() to service_role;
grant execute on function public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz) to service_role;
grant execute on function public.client_health_get_refresh_run(uuid) to service_role;
grant execute on function public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_get_refresh_lease(uuid) to service_role;
grant execute on function public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint) to service_role;
grant execute on function public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz) to service_role;
grant execute on function public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_get_source_run(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,jsonb,text,text,uuid,uuid,bigint) to service_role;
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
