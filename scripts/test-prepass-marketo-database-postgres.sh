#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="prepass-marketo-database-pg-${RANDOM}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres postgres:16-alpine >/dev/null
ready=false
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != "true" ]; then docker logs "$container"; exit 1; fi
  sleep 1
done
if [ "$ready" != "true" ]; then docker logs "$container"; exit 1; fi
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create table public.master_marketing_performance(date date,focus text,mqls numeric,sqls numeric,closed_won numeric);
" >/dev/null
for sql in supabase/prepass_marketo_ingestion.sql supabase/prepass_marketo_database_reporting.sql supabase/prepass_marketo_database_reporting.test.sql; do
  docker cp "$repo_root/$sql" "$container:/tmp/test.sql"
  docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/test.sql >/dev/null
done
# Idempotent reporting migration must preserve its least-privilege grants.
docker cp "$repo_root/supabase/prepass_marketo_database_reporting.sql" "$container:/tmp/test.sql"
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/test.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  do \$\$ begin
    if not has_function_privilege('service_role','public.prepass_marketo_database_report(date,date,text,text,text)','execute') then raise exception 'service role cannot execute report'; end if;
    if has_function_privilege('anon','public.prepass_marketo_database_report(date,date,text,text,text)','execute') or has_function_privilege('authenticated','public.prepass_marketo_database_report(date,date,text,text,text)','execute') then raise exception 'public role can execute report'; end if;
  end \$\$;
" >/dev/null
printf 'Marketo database PostgreSQL migration, real aggregate fixtures, idempotence and privileges passed.\n'
