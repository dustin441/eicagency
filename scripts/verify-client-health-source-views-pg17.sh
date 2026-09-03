#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="client-health-source-views-pg17-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --rm -d --name "$container" \
  -e POSTGRES_USER=supabase_admin \
  -e POSTGRES_PASSWORD=postgres \
  -v "$repo_root:/repo:ro" \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U supabase_admin >/dev/null 2>&1; then break; fi
  sleep 0.25
done
docker exec "$container" pg_isready -U supabase_admin >/dev/null

admin_exec=(docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d postgres)

"${admin_exec[@]}" <<'SQL'
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

grant usage, create on schema public to postgres;
grant connect, create, temporary on database postgres to postgres;
grant anon, authenticated, service_role to postgres;
set role postgres;

create table public.master_spartaco (id bigint);
create table public.bridgeway_google (
  date date,
  cost numeric,
  conversions numeric
);
create table public.ihh_master (
  date date,
  cost double precision,
  scheduled_appointments bigint
);
create table public.cba_master (
  date date,
  cost real,
  conversions integer
);

insert into public.bridgeway_google values
  (date '2026-08-18', 10.25, 2),
  (date '2026-08-18', null, 1),
  (date '2026-08-19', 7.75, null);
insert into public.ihh_master values
  (date '2026-08-18', 99, 99),
  (date '2026-08-19', 20.5, 3),
  (date '2026-08-19', null, null),
  (date '2026-08-20', 11, 1);
insert into public.cba_master values
  (date '2026-08-19', 4.5, 2),
  (date '2026-08-19', 5.5, null),
  (date '2026-08-20', null, 0);

create schema private authorization postgres;
create table private.client_health_config_revisions (
  id uuid primary key,
  revision jsonb not null
);
SQL

psql_exec=(docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres)

# Migration must fail closed and leave no partial objects when a consumed source
# contains a negative measure.
"${psql_exec[@]}" -c "insert into public.bridgeway_google values (date '2026-08-21', -1, 1)" >/dev/null
if "${psql_exec[@]}" -f /repo/supabase/client_health_source_views.sql >/tmp/client-health-source-views-negative.log 2>&1; then
  echo 'expected negative-source migration preflight to fail' >&2
  exit 1
fi
"${psql_exec[@]}" -c "delete from public.bridgeway_google where date=date '2026-08-21'" >/dev/null
"${psql_exec[@]}" -Atqc "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'client_health_%_daily'" | grep -qx '0'

"${psql_exec[@]}" -f /repo/supabase/client_health_source_views.sql
"${psql_exec[@]}" -f /repo/supabase/client_health_source_views_verify.sql

# Fixed fixture vectors independently confirm null-to-zero and daily aggregation.
"${psql_exec[@]}" -Atqc "select row_key||'|'||spend||'|'||results from public.client_health_bridgeway_daily order by date" \
  | diff -u <(printf '%s\n' '2026-08-18|10.25|3' '2026-08-19|7.75|0') -
"${psql_exec[@]}" -Atqc "select row_key||'|'||spend||'|'||results from public.client_health_ihh_daily order by date" \
  | diff -u <(printf '%s\n' '2026-08-19|20.5|3' '2026-08-20|11|1') -
"${psql_exec[@]}" -Atqc "select row_key||'|'||spend||'|'||results from public.client_health_cba_daily order by date" \
  | diff -u <(printf '%s\n' '2026-08-19|10.0|2' '2026-08-20|0|0') -

# Rollback must refuse a staged/active-style JSON reference and preserve all views.
"${psql_exec[@]}" -c "insert into private.client_health_config_revisions values ('00000000-0000-4000-8000-000000000001', '{\"sources\":[{\"relation\":\"client_health_bridgeway_daily\"}]}')" >/dev/null
if "${psql_exec[@]}" -f /repo/supabase/client_health_source_views_rollback.sql >/tmp/client-health-source-views-referenced.log 2>&1; then
  echo 'expected referenced-view rollback preflight to fail' >&2
  exit 1
fi
"${psql_exec[@]}" -Atqc "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'client_health_%_daily'" | grep -qx '3'

"${psql_exec[@]}" -c 'truncate private.client_health_config_revisions' >/dev/null
"${psql_exec[@]}" -f /repo/supabase/client_health_source_views_rollback.sql
"${psql_exec[@]}" -Atqc "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'client_health_%_daily'" | grep -qx '0'

printf '%s\n' 'verify-client-health-source-views-pg17: migration, parity, ACL, fail-closed, and rollback checks passed'
