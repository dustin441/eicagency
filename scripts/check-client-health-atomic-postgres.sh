#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-atomic-pg16-${$}"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
ready=false
for _ in $(seq 1 60); do
  logs="$(docker logs "$name" 2>&1 || true)"
  if [[ "$logs" == *"PostgreSQL init process complete; ready for start up."* ]] \
     && docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then
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
docker exec "$name" pg_isready -U postgres >/dev/null

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.master_spartaco(id bigint);
SQL

apply() {
  local file="$1"
  echo "--- ${file#$root/}"
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres < "$file"
}
apply "$root/supabase/client_health_foundation.sql"
apply "$root/supabase/client_health_foundation_privilege_hardening.sql"
apply "$root/supabase/client_health_atomic_refresh.sql"

# Create the exact immutable revision before racing attempts that bind to it.
revision_id="d0dad387-3a0f-8eb0-b5c5-e79ae36edb16"
revision_hash="d0dad3873a0f8eb075c5e79ae36edb16b16cc7ce182ee02182cf4c356e6f2343"
race_revision='{"schemaVersion":1,"clients":[{"display":{"displayName":"Race fixture","dashboardHref":null,"configStatus":"configuration_required","reportingTimezone":"America/Phoenix","monthlyHoursAllotment":null,"clickupListIds":[],"marginAliases":[],"metadata":{}},"metricDisplayConfig":[],"assemblyInput":{"clientId":"92000000-0000-4000-8000-000000000010","clientKey":"race","configApproved":false,"calculationVersion":"verify-v1","sourceContractVersion":"verify-s1","snapshotDate":"2026-08-23","phoenix":{"month":{"start":"2026-08-01","end":"2026-08-23"},"current":{"start":"2026-08-10","end":"2026-08-23"},"previous":{"start":"2026-07-27","end":"2026-08-09"},"elapsedMonthDays":23,"daysInMonth":31,"comparisonDays":14},"metricConfig":[],"requiredSourceKeys":[],"optionalSourceKeys":[],"sourceBindings":{},"fixedValues":{}},"collectors":[]}]}'
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -c \
  "select public.client_health_create_config_revision('$revision_id','$revision_hash','$race_revision'::jsonb);" >/dev/null

# Two independently generated attempts race for one logical identity. Both transactions
# may receive a create receipt, but serialization plus the partial unique index must
# leave exactly one active winner and one fixed-failed auditable loser.
identity="$(printf '6%.0s' {1..64})"
call_a="select public.client_health_create_refresh_run('92000000-0000-4000-8000-000000000001','$revision_id','$revision_hash','$identity','92000000-0000-4000-8000-000000000011','2026-08-23','verify-v1','verify-s1',clock_timestamp());"
call_b="select public.client_health_create_refresh_run('92000000-0000-4000-8000-000000000002','$revision_id','$revision_hash','$identity','92000000-0000-4000-8000-000000000012','2026-08-23','verify-v1','verify-s1',clock_timestamp());"
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
     or (select count(*) from public.client_health_refresh_runs where refresh_identity_hash = '$identity' and run_status = 'failed' and error_code = 'refresh_attempt_superseded') <> 1 then
    raise exception 'concurrent fresh attempts did not leave one active winner and one auditable loser';
  end if;
end
\$\$;
SQL

apply "$root/supabase/client_health_atomic_refresh_verify.sql"
apply "$root/supabase/client_health_atomic_refresh_rollback.sql"

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres <<'SQL'
set role service_role;
insert into public.client_health_refresh_runs(snapshot_date,calculation_version,source_contract_version)
values (current_date,'legacy-v1','legacy-s1');
reset role;
DO $$
begin
  if not exists (
    select 1 from public.client_health_refresh_runs
    where calculation_version = 'legacy-v1'
      and config_revision_id is null and config_revision_hash is null
      and refresh_identity_hash is null and run_attempt_id is null
  ) then
    raise exception 'compatibility rollback did not restore legacy refresh writes with null revision metadata';
  end if;
  if to_regclass('public.client_health_config_revisions') is null
     or not exists (select 1 from public.client_health_config_revisions where id = 'd0dad387-3a0f-8eb0-b5c5-e79ae36edb16')
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name in ('client_health_refresh_runs','client_health_snapshots')
         and column_name in ('config_revision_id','config_revision_hash') and is_nullable <> 'YES'
     ) then
    raise exception 'compatibility rollback did not preserve revision audit metadata or relax legacy columns';
  end if;
  if to_regprocedure('public.client_health_create_config_revision(uuid,text,jsonb)') is not null
     or to_regprocedure('public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)') is not null then
    raise exception 'compatibility rollback left revision/runtime writer RPCs installed';
  end if;
end
$$;
SQL

echo 'client-health PostgreSQL 16 foundation→hardening→forward→concurrency→verify→rollback compatibility passed'
