#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-atomic-pg16-${$}"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_USER=supabase_admin -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres postgres:16-alpine >/dev/null
ready=false
for _ in $(seq 1 60); do
  logs="$(docker logs "$name" 2>&1 || true)"
  if [[ "$logs" == *"PostgreSQL init process complete; ready for start up."* ]] \
     && docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$name" >&2
  echo 'final PostgreSQL server did not become ready' >&2
  exit 1
fi
# Require a second stable probe after the final-server marker. This prevents the
# temporary init server from satisfying readiness immediately before its restart.
sleep 1
docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL'
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role wrong_installer login;
create role attacker_owner nologin;
grant postgres to wrong_installer;
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.master_spartaco(id bigint);
grant usage, create on schema public to postgres;
grant connect, create, temporary on database postgres to postgres;
grant usage on schema extensions to postgres;
grant execute on function extensions.digest(bytea,text) to postgres;
grant anon, authenticated, service_role to postgres;
SQL

apply() {
  local file="$1"
  echo "--- ${file#$root/}"
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < "$file"
}
apply "$root/supabase/client_health_foundation.sql"
apply "$root/supabase/client_health_foundation_privilege_hardening.sql"

expect_forward_failure() {
  local role="$1"
  local expected="$2"
  local output
  if output="$(docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U "$role" -d postgres < "$root/supabase/client_health_atomic_refresh.sql" 2>&1)"; then
    echo "forward migration unexpectedly passed as $role" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    printf '%s\n' "$output" >&2
    echo "forward migration failed without expected message: $expected" >&2
    exit 1
  fi
}

# A role that is a member of postgres still cannot choose the SECURITY DEFINER owner.
expect_forward_failure wrong_installer 'requires a direct postgres session'

# Reproduce each insufficient managed-role property independently and prove fail-closed.
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'alter role postgres nobypassrls;' >/dev/null
expect_forward_failure postgres 'requires postgres with BYPASSRLS and CREATEROLE'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'alter role postgres bypassrls nocreaterole;' >/dev/null
expect_forward_failure postgres 'requires postgres with BYPASSRLS and CREATEROLE'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'alter role postgres createrole;' >/dev/null

# PostgreSQL privilege lists are any-of; prove USAGE and CREATE are each required.
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'revoke create on schema public from postgres;' >/dev/null
expect_forward_failure postgres 'requires postgres database CREATE, public CREATE/USAGE'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'grant create on schema public to postgres; revoke usage on schema public from postgres; revoke usage on schema public from public;' >/dev/null
expect_forward_failure postgres 'permission denied for schema public'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'grant usage on schema public to postgres; grant usage on schema public to public;' >/dev/null

# An attacker-controlled foundation owner is rejected before any table read or DDL.
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'alter table public.client_health_snapshots owner to attacker_owner;' >/dev/null
expect_forward_failure postgres 'requires postgres-owned trusted foundation objects'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c 'alter table public.client_health_snapshots owner to postgres;' >/dev/null

apply "$root/supabase/client_health_atomic_refresh.sql"

# Managed-Supabase role flags, fixed ownership, SECURITY DEFINER, and search_path
# are runtime assertions rather than assumptions hidden in static text checks.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres <<'SQL'
do $$
declare v_postgres oid;
begin
  select oid into v_postgres from pg_catalog.pg_roles
  where rolname='postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres is null then
    raise exception 'managed Supabase postgres role fixture does not match production flags';
  end if;
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'managed Supabase fixture is not a direct postgres session';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relname like 'client_health_%' and c.relowner<>v_postgres
  ) then raise exception 'client health relation/view owner is not postgres'; end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname like 'client_health_%'
      and (p.proowner<>v_postgres or not p.prosecdef
        or not exists (select 1 from pg_catalog.unnest(p.proconfig) setting where setting like 'search_path=%'))
  ) then raise exception 'client health function owner/SECURITY DEFINER/search_path is unsafe'; end if;
  raise notice 'managed Supabase non-superuser LOGIN postgres owner fixture passed';
end
$$;
SQL

# Stage and operator-activate the exact canonical v2 fixture before racing attempts.
revision_id="2ee9145b-aa03-8201-99d1-54af04e8a32f"
revision_hash="2ee9145baa03d20119d154af04e8a32f6dd9d6828ca32f3b79cbef5f28719b96"
activation_id="92000000-0000-4000-8000-000000000020"
reviewed_sha="1fc1e89c01322e55015e4ace498a3188c88953ee"
race_revision='{"schemaVersion":2,"calculationVersion":"verify-v2","sourceContractVersion":"verify-s2","clients":[{"clientId":"90000000-0000-4000-8000-000000000001","clientKey":"atomic_verify_fixture","displayName":"Atomic verify fixture","dashboardHref":"/dashboard/atomic_verify_fixture","reportingTimezone":"America/Phoenix","clickupListIds":[],"marginAliases":[],"configStatus":"approved","fixedValues":{"monthlyBudget":100,"monthlyHoursAllotment":10},"metrics":[{"key":"budget_pacing","label":"budget_pacing","adapterKey":"approved.budget_pacing","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":10,"yellowThreshold":20,"sourceKeys":["paid"]},{"key":"hours","label":"hours","adapterKey":"approved.hours","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":80,"yellowThreshold":100,"sourceKeys":["paid"]},{"key":"margin","label":"margin","adapterKey":"approved.margin","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":50,"yellowThreshold":25,"sourceKeys":["paid"]},{"key":"north_star","label":"north_star","adapterKey":"approved.north_star","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":10,"yellowThreshold":5,"sourceKeys":["paid"]},{"key":"overdue_tasks","label":"overdue_tasks","adapterKey":"approved.overdue_tasks","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":0,"yellowThreshold":1,"sourceKeys":["paid"]}],"sources":[{"sourceKey":"paid","requestFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","permittedFactFields":["currentRows","fulfillmentCost","hoursUsed","monthSpend","overdueTaskCount","previousRows","revenue"],"freshnessPolicy":{"maximumLagDays":3},"provider":"supabase","project":"eic","relation":"budget_pacing_facts"}]}]}'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -c \
  "select private.client_health_stage_config_revision('$revision_id','$revision_hash','$race_revision'::jsonb); select private.client_health_activate_config_revision('$activation_id','$revision_id','$reviewed_sha','postgres-concurrency-fixture','Verify concurrent refresh creation',null);" >/dev/null

# Two independently generated attempts race for one database-derived logical identity.
# Serialization plus the partial unique index must leave one active winner and one
# fixed-failed auditable loser, both pinned to the exact active revision.
identity="$(docker exec "$name" psql -At -U postgres -c "select encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId','$revision_id','configRevisionHash','$revision_hash','snapshotDate','2026-08-23','calculationVersion','verify-v2','sourceContractVersion','verify-s2')),'UTF8'),'sha256'),'hex')")"
run_a="$(docker exec "$name" psql -At -U postgres -c "select public.client_health_revision_id(encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash','$identity','runAttemptId','92000000-0000-4000-8000-000000000011')),'UTF8'),'sha256'),'hex'))")"
run_b="$(docker exec "$name" psql -At -U postgres -c "select public.client_health_revision_id(encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash','$identity','runAttemptId','92000000-0000-4000-8000-000000000012')),'UTF8'),'sha256'),'hex'))")"
call_a="select public.client_health_create_refresh_run('$run_a','$revision_id','$revision_hash','$identity','92000000-0000-4000-8000-000000000011','2026-08-23','verify-v2','verify-s2',clock_timestamp());"
call_b="select public.client_health_create_refresh_run('$run_b','$revision_id','$revision_hash','$identity','92000000-0000-4000-8000-000000000012','2026-08-23','verify-v2','verify-s2',clock_timestamp());"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -c "$call_a" >/tmp/client-health-race-a-$$.log &
pid_a=$!
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -c "$call_b" >/tmp/client-health-race-b-$$.log &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
rm -f /tmp/client-health-race-a-$$.log /tmp/client-health-race-b-$$.log

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres <<SQL
DO \$\$
begin
  if (select count(*) from public.client_health_refresh_runs where refresh_identity_hash = '$identity' and run_status in ('collecting','validated')) <> 1
     or (select count(*) from public.client_health_refresh_runs where refresh_identity_hash = '$identity' and run_status = 'failed' and error_code = 'refresh_attempt_superseded') <> 1
     or exists (select 1 from public.client_health_refresh_runs where refresh_identity_hash = '$identity' and (config_revision_id <> '$revision_id' or config_revision_hash <> '$revision_hash' or config_revision_activation_id <> '$activation_id'))
     or public.client_health_get_active_config_revision()->'revision'->>'id' <> '$revision_id' then
    raise exception 'concurrent fresh attempts did not preserve one exact active-revision winner and one auditable loser';
  end if;
end
\$\$;
SQL

apply "$root/supabase/client_health_atomic_refresh_verify.sql"
if [[ "${CLIENT_HEALTH_PREFIX_ONLY:-0}" == "1" ]]; then
  echo 'client-health PostgreSQL 16 foundation→hardening→forward→concurrency→verify passed'
  exit 0
fi
apply "$root/supabase/client_health_atomic_refresh_rollback.sql"

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres <<SQL
set role service_role;
insert into public.client_health_refresh_runs(snapshot_date,calculation_version,source_contract_version)
values (current_date,'legacy-v1','legacy-s1');
reset role;
DO \$\$
declare v_failed boolean; v_definition text;
begin
  if not exists (
    select 1 from public.client_health_refresh_runs
    where calculation_version = 'legacy-v1'
      and config_revision_id is null and config_revision_hash is null
      and config_revision_activation_id is null
      and refresh_identity_hash is null and run_attempt_id is null
  ) then raise exception 'compatibility rollback did not restore legacy refresh writes with null atomic metadata'; end if;

  if not exists (select 1 from private.client_health_config_revisions where id = '$revision_id')
     or not exists (select 1 from private.client_health_config_revision_activations where id = '$activation_id' and revision_id = '$revision_id')
     or not exists (select 1 from private.client_health_active_config_revision where singleton and activation_id = '$activation_id')
     or (select count(*) from public.client_health_refresh_runs where config_revision_id = '$revision_id') <> 2 then
    raise exception 'compatibility rollback did not preserve revision, activation, pointer, or lifecycle audit rows';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'client_health_refresh_runs' and column_name in ('config_revision_id','config_revision_hash','config_revision_activation_id','refresh_identity_hash','run_attempt_id'))
        or (table_name = 'client_health_snapshots' and column_name in ('config_revision_id','config_revision_hash','persistence_evidence_hash','persistence_idempotency_key')))
      and is_nullable <> 'YES'
  ) then raise exception 'compatibility rollback did not relax every v2 legacy-writer column'; end if;

  if to_regprocedure('public.client_health_get_active_config_revision()') is not null
     or to_regprocedure('private.client_health_stage_config_revision(uuid,text,jsonb)') is not null
     or to_regprocedure('private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)') is not null
     or to_regprocedure('public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)') is not null then
    raise exception 'compatibility rollback left getter, operator, or runtime functions installed';
  end if;

  if pg_catalog.has_schema_privilege('service_role','private','USAGE')
     or pg_catalog.has_table_privilege('service_role','private.client_health_config_revisions','SELECT,INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('service_role','private.client_health_config_revision_activations','SELECT,INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('service_role','private.client_health_active_config_revision','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'compatibility rollback granted service_role private access';
  end if;

  v_failed := false; begin update private.client_health_config_revisions set revision_hash=revision_hash where id='$revision_id'; exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'preserved revision row became mutable'; end if;
  v_failed := false; begin delete from private.client_health_config_revision_activations where id='$activation_id'; exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'preserved activation row became mutable'; end if;

  select pg_catalog.pg_get_viewdef('public.client_health_latest'::regclass,true) into v_definition;
  if v_definition not like '%JOIN client_health_clients c ON c.id = s.client_id%'
     or v_definition like '%private.client_health_config_revisions%'
     or not exists (select 1 from pg_catalog.pg_class where oid='public.client_health_latest'::regclass and reloptions @> array['security_invoker=true']) then
    raise exception 'compatibility rollback did not restore the foundation latest view';
  end if;

  if pg_catalog.has_function_privilege('anon','public.client_health_guard_refresh_run_immutable()','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated','public.client_health_guard_refresh_run_immutable()','EXECUTE')
     or pg_catalog.has_schema_privilege('anon','private','USAGE')
     or pg_catalog.has_schema_privilege('authenticated','private','USAGE')
     or pg_catalog.has_table_privilege('anon','public.client_health_refresh_runs','INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.client_health_refresh_runs','INSERT,UPDATE,DELETE') then
    raise exception 'compatibility rollback granted a browser role extra access';
  end if;
end
\$\$;
SQL

echo 'client-health PostgreSQL 16 foundation→hardening→forward→concurrency→verify→rollback compatibility passed'
