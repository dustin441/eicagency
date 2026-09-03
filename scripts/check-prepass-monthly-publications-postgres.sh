#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="prepass-monthly-publications-pg17-${$}"
postgres_image="${POSTGRES_IMAGE:-postgres:17}"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=postgres \
  "$postgres_image" >/dev/null

ready=false
for _ in $(seq 1 60); do
  logs="$(docker logs "$name" 2>&1 || true)"
  if [[ "$logs" == *"PostgreSQL init process complete; ready for start up."* ]] \
     && docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$name" >&2
  echo 'PostgreSQL 17 did not become ready' >&2
  exit 1
fi
sleep 1
docker exec "$name" pg_isready -U postgres -d postgres >/dev/null
server_version_num="$(docker exec "$name" psql -At -U postgres -d postgres -c 'show server_version_num')"
if [[ "$server_version_num" != 17* ]]; then
  echo "Expected PostgreSQL 17, got server_version_num=${server_version_num}" >&2
  exit 1
fi

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.master_marketing_performance(id bigint);
SQL

echo '--- supabase/prepass_monthly_publications.sql'
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$root/supabase/prepass_monthly_publications.sql"

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
do $$
declare
  v_revision_1_id uuid;
  v_revision_2_id uuid;
  v_retry_id uuid;
  v_retry_revision integer;
  v_retry_source_hash text;
  v_retry_payload_hash text;
  v_retry_published_at timestamptz;
  v_retry_idempotent boolean;
  v_revision_1_published_at timestamptz;
  v_active_id uuid;
  v_activated_at timestamptz;
  v_activated_by text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', 'publisher-one', true);
  select publication_id, publication_published_at
  into v_revision_1_id, v_revision_1_published_at
  from public.prepass_publish_monthly_publication(
    '2020-01-01', '2020-01-01', '2020-01-31', '2020-02-01 00:00:00+00', 10,
    repeat('1', 64), repeat('a', 64), '{"revision":1}'::jsonb, null
  );

  perform pg_catalog.set_config('request.jwt.claim.sub', 'publisher-two', true);
  select publication_id
  into v_revision_2_id
  from public.prepass_publish_monthly_publication(
    '2020-01-01', '2020-01-01', '2020-01-31', '2020-02-01 00:00:00+00', 11,
    repeat('2', 64), repeat('b', 64), '{"revision":2}'::jsonb, 'Corrected source data'
  );

  select publication_id, activated_at, activated_by
  into v_active_id, v_activated_at, v_activated_by
  from public.prepass_monthly_publication_active
  where report_month = '2020-01-01';
  if v_active_id is distinct from v_revision_2_id then
    raise exception 'revision 2 was not activated before stale retry';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', 'stale-retry', true);
  select publication_id, publication_revision, publication_source_hash,
         publication_payload_hash, publication_published_at, idempotent
  into v_retry_id, v_retry_revision, v_retry_source_hash,
       v_retry_payload_hash, v_retry_published_at, v_retry_idempotent
  from public.prepass_publish_monthly_publication(
    '2020-01-01', '2020-01-01', '2020-01-31', '2020-02-01 00:00:00+00', 10,
    repeat('1', 64), repeat('a', 64), '{"ignored-on-idempotent-retry":true}'::jsonb, null
  );

  if v_retry_id is distinct from v_revision_1_id
     or v_retry_revision is distinct from 1
     or v_retry_source_hash is distinct from repeat('1', 64)
     or v_retry_payload_hash is distinct from repeat('a', 64)
     or v_retry_published_at is distinct from v_revision_1_published_at
     or v_retry_idempotent is distinct from true then
    raise exception 'stale idempotent retry did not return the historical revision 1 receipt';
  end if;

  if not exists (
    select 1
    from public.prepass_monthly_publication_active
    where report_month = '2020-01-01'
      and publication_id = v_revision_2_id
      and activated_at = v_activated_at
      and activated_by = v_activated_by
  ) then
    raise exception 'stale idempotent revision 1 retry rolled back or rewrote the active revision 2 pointer';
  end if;

  raise notice 'stale retry returned revision 1 receipt and preserved active revision 2';
end
$$;
SQL

echo "PrePass monthly-publication PostgreSQL regression passed (${postgres_image}, server_version_num=${server_version_num})"
