#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-config-v3-pg17-${$}"
fixture="$(mktemp)"
cleanup() { rm -f "$fixture"; docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

image="${POSTGRES_IMAGE:-postgres:17-alpine}"
docker run -d --name "$name" -e POSTGRES_USER=supabase_admin -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres "$image" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 2

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL' >/dev/null
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.master_spartaco(id bigint);
grant usage, create on schema public to postgres;
grant connect, create, temporary on database postgres to postgres;
grant usage on schema extensions to postgres;
grant execute on function extensions.digest(bytea,text) to postgres;
grant anon,authenticated,service_role to postgres;
SQL

apply() { docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" >/dev/null; }
apply "$root/supabase/client_health_foundation.sql"
apply "$root/supabase/client_health_foundation_privilege_hardening.sql"
apply "$root/supabase/client_health_atomic_refresh.sql"
apply "$root/supabase/client_health_config_v3.sql"

# Prove clean rollback and exact v2 API restoration before storing any v3 rows.
apply "$root/supabase/client_health_config_v3_rollback.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
do $$begin
 if to_regprocedure('private.client_health_assert_config_revision_v3(uuid,text,jsonb)') is not null then
   raise exception 'clean v3 rollback left v3 functions';
 end if;
 if not exists(select 1 from pg_proc where oid='public.client_health_assert_config_revision(uuid,text,jsonb)'::regprocedure
   and prosecdef and proowner='postgres'::regrole) then raise exception 'v2 validator was not restored'; end if;
end$$;
SQL
apply "$root/supabase/client_health_config_v3.sql"

cd "$root"
node --no-warnings --experimental-strip-types --input-type=module > "$fixture" <<'NODE'
import { buildApprovedConfigRevision } from './src/services/client-health/config-revision.ts';
const metrics = [
 ['budget_pacing','lower_is_better',10,20],['hours','lower_is_better',90,110],['margin','higher_is_better',80,60],
 ['north_star','higher_is_better',5,0],['overdue_tasks','lower_is_better',0,2],
].map(([key,direction,greenThreshold,yellowThreshold])=>({key,label:key,adapterKey:`approved.${key}`,required:true,weight:20,direction,greenThreshold,yellowThreshold,sourceKeys:['leads','sales']}));
const source=(sourceKey)=>({sourceKey,provider:'supabase',project:'eic',relation:`${sourceKey}_daily`,requestFingerprint:(sourceKey==='leads'?'a':'b').repeat(64),permittedFactFields:['currentRows','hoursUsed','monthSpend','overdueTaskCount','previousRows'],freshnessPolicy:{maximumLagDays:3}});
const revision=buildApprovedConfigRevision({schemaVersion:3,calculationVersion:'verify-v3',sourceContractVersion:'verify-s3',clients:[{
 clientId:'90000000-0000-4000-8000-000000000001',clientKey:'spartaco',displayName:'Spartaco',dashboardHref:'/dashboard/spartaco',reportingTimezone:'America/Phoenix',clickupListIds:[],marginAliases:[],configStatus:'approved',
 fixedValues:{monthlyBudget:100},economics:{effectiveMonth:'2026-09-01',monthlyRetainer:4600,deliveryModel:'custom',fulfillmentHourlyCost:46,targetMarginPercent:80},
 metrics,sources:[source('leads'),source('sales')],northStarLanes:[
  {key:'lead-cpl',label:'Lead CPL trend',formula:'cost_per_result',evaluation:'period_over_period_change',required:true,weight:40,direction:'lower_is_better',greenThreshold:5,yellowThreshold:15,sourceKeys:['leads']},
  {key:'sales-roas',label:'Sales ROAS target',formula:'roas',evaluation:'absolute_target',required:true,weight:40,direction:'higher_is_better',greenThreshold:3,yellowThreshold:2,sourceKeys:['sales']},
  {key:'sales-roas-trend',label:'Sales ROAS trend',formula:'roas',evaluation:'period_over_period_change',required:false,weight:20,direction:'higher_is_better',greenThreshold:5,yellowThreshold:-5,sourceKeys:['sales']},
 ]
}]});
console.log(JSON.stringify(revision));
NODE
read -r rid rhash < <(python3 -c "import json,sys; x=json.load(open(sys.argv[1])); print(x['id'],x['hash'])" "$fixture")
rjson="$(python3 -c "import json,sys; x=json.load(open(sys.argv[1])); print(json.dumps(x['content'],separators=(',',':')))" "$fixture")"


# Direct validator accepts the exact TS canonical hash/UUID and rejects malformed v3 content with recomputed identities.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$rid" -v rhash="$rhash" -v rjson="$rjson" <<'SQL' >/dev/null
select public.client_health_assert_config_revision(:'rid'::uuid,:'rhash',:'rjson'::jsonb);
select set_config('test.client_health_v3_revision',:'rjson',false);
do $$
declare good jsonb := current_setting('test.client_health_v3_revision')::jsonb; bad jsonb; h text; i uuid; failed boolean;
begin
 foreach bad in array array[
   jsonb_set(good,'{clients,0,economics,targetMarginPercent}','100'::jsonb),
   jsonb_set(good,'{clients,0,northStarLanes,0,sourceKeys}','["unknown"]'::jsonb),
   jsonb_set(good,'{clients,0,metrics,3,sourceKeys}','[]'::jsonb)
 ] loop
   h:=encode(extensions.digest(convert_to(public.client_health_canonical_json(bad),'UTF8'),'sha256'),'hex');
   i:=public.client_health_revision_id(h); failed:=false;
   begin perform public.client_health_assert_config_revision(i,h,bad); exception when others then failed:=true; end;
   if not failed then raise exception 'malformed v3 revision was accepted'; end if;
 end loop;
end$$;
SQL

# Base v3 migration exposes no cross-project write API. Direct postgres stages
# and activates; the separately versioned signed API is responsible for agency auth.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$rid" -v rhash="$rhash" -v rjson="$rjson" <<'SQL' >/dev/null
select private.client_health_stage_config_revision(:'rid'::uuid,:'rhash',:'rjson'::jsonb);
select private.client_health_activate_config_revision('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'rid'::uuid,'1111111111111111111111111111111111111111','prepass-auth:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PG17 internal verification',null);
do $$begin
 if (select operator_identity from private.client_health_config_revision_activations where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'prepass-auth:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then raise exception 'operator identity was not stored exactly'; end if;
 if to_regprocedure('public.client_health_stage_config_revision(uuid,text,jsonb)') is not null
    or to_regprocedure('public.client_health_activate_config_revision(uuid,uuid,text,text,uuid)') is not null
    or has_schema_privilege('authenticated','private','USAGE')
    or has_schema_privilege('service_role','private','USAGE') then raise exception 'v3 privilege boundary is incorrect'; end if;
end$$;
SQL

# Rollback must refuse after v3 durable state exists.
out="$(docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/client_health_config_v3_rollback.sql" 2>&1 || true)"
[[ "$out" == *"rollback refuses while v3 revisions or activations exist"* ]] || { printf '%s\n' "$out" >&2; exit 1; }

echo "client-health config v3 PostgreSQL 17 forward/internal-boundary/validation/clean-rollback/refusal passed"
