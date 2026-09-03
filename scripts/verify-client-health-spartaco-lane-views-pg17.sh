#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-spartaco-lanes-pg17-${$}"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" -e POSTGRES_USER=supabase_admin -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL' >/dev/null
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage,create on schema public to postgres; grant connect,create,temporary on database postgres to postgres; grant anon,authenticated,service_role to postgres;
set role postgres;
create table public.master_spartaco(id bigint primary key,date date,cost numeric,conversions numeric,revenue numeric,type text);
insert into public.master_spartaco values
 (1,'2026-09-01',100,5,0,'LEAD'),(2,'2026-09-01',50,3,0,'LEAD'),
 (3,'2026-09-01',80,0,320,'SALES'),(4,'2026-09-01',20,0,80,'SALES'),
 (5,'2026-09-01',999,999,999,'OTHER'),(6,'2026-09-02',-1,1,0,'LEAD');
SQL
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/client_health_spartaco_lane_views.sql" >/dev/null
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
do $$begin
 if (select count(*) from public.client_health_spartaco_leads_daily)<>1
    or (select spend from public.client_health_spartaco_leads_daily where date='2026-09-01')<>150
    or (select results from public.client_health_spartaco_leads_daily where date='2026-09-01')<>8 then raise exception 'lead lane scope/rollup mismatch';end if;
 if (select count(*) from public.client_health_spartaco_sales_daily)<>1
    or (select spend from public.client_health_spartaco_sales_daily where date='2026-09-01')<>100
    or (select results from public.client_health_spartaco_sales_daily where date='2026-09-01')<>400 then raise exception 'sales lane scope/rollup mismatch';end if;
 if has_table_privilege('anon','public.client_health_spartaco_leads_daily','select')
    or has_table_privilege('authenticated','public.client_health_spartaco_sales_daily','select')
    or not has_table_privilege('service_role','public.client_health_spartaco_leads_daily','select')
    or not has_table_privilege('service_role','public.client_health_spartaco_sales_daily','select') then raise exception 'lane view ACL mismatch';end if;
 if exists(select 1 from public.client_health_spartaco_leads_daily where date='2026-09-02') then raise exception 'negative source row was exposed';end if;
end$$;
SQL
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/client_health_spartaco_lane_views_rollback.sql" >/dev/null
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "select 1 where to_regclass('public.client_health_spartaco_leads_daily') is null and to_regclass('public.client_health_spartaco_sales_daily') is null" >/dev/null
echo "client-health Spartaco lane views PostgreSQL 17 scope/rollup/ACL/fail-closed/rollback passed"
