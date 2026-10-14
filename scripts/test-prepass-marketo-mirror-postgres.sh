#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="prepass-marketo-pg-${RANDOM}-$$"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting PostgreSQL 16 test container $container"
docker run -d --name "$container" \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16-alpine >/dev/null

ready=false
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != "true" ]; then
    echo "PostgreSQL container exited during startup."
    docker logs "$container" || true
    exit 1
  fi
  echo "Waiting for PostgreSQL, attempt $attempt/60"
  sleep 1
done
if [ "$ready" != "true" ]; then
  echo "PostgreSQL did not become ready."
  docker logs "$container" || true
  exit 1
fi
echo "PostgreSQL is ready"

docker exec "$container" mkdir -p /repo/supabase /repo/scripts
docker cp "$repo_root/supabase/prepass_marketo_mirror.sql" "$container:/repo/supabase/prepass_marketo_mirror.sql"
docker cp "$repo_root/supabase/prepass_marketo_mirror_rollback.sql" "$container:/repo/supabase/prepass_marketo_mirror_rollback.sql"
docker cp "$repo_root/scripts/test-prepass-marketo-mirror.sql" "$container:/repo/scripts/test-prepass-marketo-mirror.sql"

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create table public.master_marketing_performance(
    date date,
    focus text,
    mqls numeric,
    sqls numeric,
    closed_won numeric
  );
" >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /repo/supabase/prepass_marketo_mirror.sql >/dev/null

# Simulate the wider runtime grants from the earlier PR migration, then prove an
# idempotent upgrade removes them before restoring the intended read-only grants.
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  grant insert,update on public.prepass_marketo_mirror_runs to service_role;
  grant insert,update,delete on public.prepass_marketo_mirror_staging to service_role;
" >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /repo/supabase/prepass_marketo_mirror.sql >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  do \$\$
  begin
    if has_table_privilege('service_role','public.prepass_marketo_mirror_runs','INSERT')
       or has_table_privilege('service_role','public.prepass_marketo_mirror_runs','UPDATE')
       or has_table_privilege('service_role','public.prepass_marketo_mirror_staging','INSERT')
       or has_table_privilege('service_role','public.prepass_marketo_mirror_staging','UPDATE')
       or has_table_privilege('service_role','public.prepass_marketo_mirror_staging','DELETE') then
      raise exception 'legacy service_role write grants survived migration upgrade';
    end if;
    if not has_table_privilege('service_role','public.prepass_marketo_mirror_runs','SELECT')
       or not has_table_privilege('service_role','public.prepass_marketo_mirror_staging','SELECT') then
      raise exception 'required service_role read grants are missing after migration upgrade';
    end if;
  end \$\$;
" >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /repo/scripts/test-prepass-marketo-mirror.sql >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /repo/supabase/prepass_marketo_mirror_rollback.sql >/dev/null

remaining="$(docker exec "$container" psql -At -U postgres -d postgres -c \
  "select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'prepass_marketo%';")"
master_exists="$(docker exec "$container" psql -At -U postgres -d postgres -c \
  "select to_regclass('public.master_marketing_performance') is not null;")"

test "$remaining" = "0"
test "$master_exists" = "t"
echo "PrePass Marketo PostgreSQL migration, upgrade grants, fixtures, and rollback passed."
