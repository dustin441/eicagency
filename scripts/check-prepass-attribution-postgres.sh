#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
name="prepass-attribution-postgres-${RANDOM}-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do
  if docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$name" pg_isready -U postgres -d postgres >/dev/null

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.meta_campaigns (
  id bigint generated always as identity primary key,
  date date not null,
  campaign_id text,
  campaign_name text,
  impressions bigint default 0,
  clicks bigint default 0,
  spend numeric default 0,
  leads bigint default 0,
  created_at timestamptz default now()
);
create table public.google_campaigns (
  date date not null,
  campaign_id bigint,
  campaign_name text,
  campaign_status text,
  cost numeric default 0,
  conversions numeric default 0,
  clicks integer default 0,
  impressions bigint default 0
);

create table public.prepass_mmp_fixture (
  date text, platform text, campaign_name text, focus text,
  spend numeric, impressions numeric, clicks numeric, platform_conversions numeric,
  mqls numeric, sqls numeric, closed_won numeric, product text,
  call_mqls numeric, call_sqls numeric, call_won numeric,
  enrollment_mqls numeric, enrollment_sqls numeric, enrollment_won numeric
);
insert into public.prepass_mmp_fixture values
  ('2026-01-02','Unattributed','abm_brand_defense','ABM',0,0,0,0,2,1,1,null,1,0,0,1,1,1),
  ('2026-01-03','Google','Search | ABM | Brand Defense','ABM',10,100,5,1,1,1,0,null,0,0,0,0,0,0),
  ('2025-12-31','Unattributed','legacy','SMB',0,0,0,0,1,0,0,null,0,0,0,0,0,0);
create view public._mmp_source as select * from public.prepass_mmp_fixture;
create materialized view public.master_marketing_performance as select * from public._mmp_source;

create schema prepass_reporting_20260910;
create table prepass_reporting_20260910.forward_events (
  event_date date, platform text, campaign_name text, focus text,
  canonical_id text, unit_id text, route text, stage text
);
create materialized view prepass_reporting_20260910.forward_events_cache as
select * from prepass_reporting_20260910.forward_events;
SQL

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_campaign_name_aliases.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_campaign_name_aliases.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd_test.sql"

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
insert into public.meta_campaigns(date,campaign_id,campaign_name)
values ('2026-01-01','meta-rename','Historical Meta Name');
insert into public.meta_campaigns(date,campaign_id,campaign_name)
values ('2026-02-01','meta-rename','Current Meta Name');
update public.meta_campaigns
set campaign_name='Historical Backfill Name'
where campaign_id='meta-rename' and date='2026-01-01';
insert into public.meta_campaigns(date,campaign_id,campaign_name)
values ('2026-03-01','meta-rename','Newest Meta Name');

insert into public.google_campaigns(date,campaign_id,campaign_name)
values ('2026-01-01',123,'Historical Google Name');
insert into public.google_campaigns(date,campaign_id,campaign_name)
values ('2026-02-01',123,'Current Google Name');
update public.google_campaigns
set campaign_name='Historical Google Backfill'
where campaign_id=123 and date='2026-01-01';

do $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.prepass_campaign_name_aliases
  where platform='Meta' and campaign_id='meta-rename'
    and canonical_name is distinct from 'Newest Meta Name';
  if v_count <> 0 then raise exception 'Meta canonical recency failed'; end if;

  select count(*) into v_count
  from public.prepass_campaign_name_aliases
  where platform='Meta' and campaign_id='meta-rename'
    and alias_name in ('Historical Meta Name','Historical Backfill Name','Current Meta Name','Newest Meta Name');
  if v_count <> 4 then raise exception 'Meta insert/update alias capture failed: %', v_count; end if;

  select count(*) into v_count
  from public.prepass_campaign_name_aliases
  where platform='Google' and campaign_id='123'
    and canonical_name is distinct from 'Current Google Name';
  if v_count <> 0 then raise exception 'Google historical update replaced canonical'; end if;

  select count(*) into v_count
  from public.prepass_campaign_name_aliases
  where platform='Google' and campaign_id='123'
    and alias_name in ('Historical Google Name','Historical Google Backfill','Current Google Name');
  if v_count <> 3 then raise exception 'Google insert/update alias capture failed: %', v_count; end if;
end $$;
SQL

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd_rollback.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
do $$
declare v_count integer;
begin
  if to_regprocedure('public.prepass_resolve_paid_attribution(text,text,text,text,text,text)') is not null then
    raise exception 'attribution resolver survived rollback';
  end if;
  if to_regclass('public.prepass_utm_campaign_attribution') is not null then
    raise exception 'attribution policy table survived rollback';
  end if;
  select count(*) into v_count from (
    select * from public.master_marketing_performance
    except all
    select * from prepass_utm_attribution_20261003.raw_mmp_source
  ) d;
  if v_count <> 0 then raise exception 'rollback introduced extra MMP rows'; end if;
  select count(*) into v_count from (
    select * from prepass_utm_attribution_20261003.raw_mmp_source
    except all
    select * from public.master_marketing_performance
  ) d;
  if v_count <> 0 then raise exception 'rollback lost baseline MMP rows'; end if;
end $$;
SQL

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/prepass_utm_attribution_2026_ytd_test.sql"

echo "PASS: executable PrePass attribution, rollback, idempotency, and rename PostgreSQL fixtures"
