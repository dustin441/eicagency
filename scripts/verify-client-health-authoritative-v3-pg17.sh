#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-authoritative-v3-pg17-${$}"
fixture="$(mktemp)"
cleanup(){ rm -f "$fixture"; docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_USER=supabase_admin -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres "${POSTGRES_IMAGE:-postgres:17-alpine}" >/dev/null
for _ in $(seq 1 60); do docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL' >/dev/null
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create extension pgcrypto with schema extensions;
create table public.master_spartaco(id bigint);
grant usage,create on schema public to postgres; grant connect,create,temporary on database postgres to postgres;
grant usage on schema extensions to postgres; grant execute on function extensions.digest(bytea,text) to postgres;
grant anon,authenticated,service_role to postgres;
SQL
apply(){ docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" >/dev/null; }
apply "$root/supabase/client_health_foundation.sql"
apply "$root/supabase/client_health_foundation_privilege_hardening.sql"
apply "$root/supabase/client_health_atomic_refresh.sql"
apply "$root/supabase/client_health_config_v3.sql"

cd "$root"
node --no-warnings --experimental-strip-types --input-type=module > "$fixture" <<'NODE'
import { buildApprovedConfigRevision } from './src/services/client-health/config-revision.ts';
const metric=(key,label,sourceKeys,direction,greenThreshold,yellowThreshold,weight)=>({key,label,adapterKey:`approved.${key}`,required:true,weight,direction,greenThreshold,yellowThreshold,sourceKeys});
const supabase=(sourceKey,fingerprint,fields)=>({sourceKey,provider:'supabase',project:'eic',relation:`${sourceKey}_daily`,requestFingerprint:fingerprint.repeat(64),permittedFactFields:fields,freshnessPolicy:{maximumLagDays:0}});
const clickup={sourceKey:'clickup',provider:'clickup',endpointFamily:'team-time-entries-and-overdue-tasks',requestFingerprint:'c'.repeat(64),permittedFactFields:['hoursUsed','overdueTaskCount'],freshnessPolicy:{maximumLagDays:0},permitsTasks:false,allowedListIds:[]};
const v2=buildApprovedConfigRevision({schemaVersion:2,calculationVersion:'verify-v2',sourceContractVersion:'verify-s2',clients:[{clientId:'80000000-0000-4000-8000-000000000001',clientKey:'v2-pending',displayName:'V2 Pending',dashboardHref:null,reportingTimezone:'America/Phoenix',clickupListIds:[],marginAliases:[],configStatus:'configuration_required',fixedValues:{monthlyBudget:null,monthlyHoursAllotment:null},metrics:[],sources:[]}]});
const v3=buildApprovedConfigRevision({schemaVersion:3,calculationVersion:'verify-v3',sourceContractVersion:'verify-s3',clients:[
 {clientId:'90000000-0000-4000-8000-000000000001',clientKey:'spartaco',displayName:'Spartaco',dashboardHref:'/dashboard/spartaco',reportingTimezone:'America/Phoenix',clickupListIds:[],marginAliases:['Spartaco'],configStatus:'approved',fixedValues:{monthlyBudget:1000},economics:{effectiveMonth:'2026-09-01',monthlyRetainer:4600,deliveryModel:'custom',fulfillmentHourlyCost:46,targetMarginPercent:80},metrics:[
  metric('budget_pacing','Budget pacing',['sales'],'lower_is_better',10,20,20),metric('north_star','North Star',['leads','sales'],'higher_is_better',1,0,30),metric('hours','Hours utilization',['clickup'],'lower_is_better',90,110,20),metric('overdue_tasks','Overdue tasks',['clickup'],'lower_is_better',0,2,10),metric('margin','Margin',['clickup'],'higher_is_better',80,75,20)
 ],sources:[clickup,supabase('leads','a',['currentRows','previousRows']),supabase('sales','b',['currentRows','monthSpend','previousRows'])],northStarLanes:[
  {key:'lead-cpl',label:'Lead CPL trend',formula:'cost_per_result',evaluation:'period_over_period_change',required:true,weight:40,direction:'lower_is_better',greenThreshold:-10,yellowThreshold:10,sourceKeys:['leads']},
  {key:'sales-roas',label:'Sales ROAS target',formula:'roas',evaluation:'absolute_target',required:true,weight:40,direction:'higher_is_better',greenThreshold:3,yellowThreshold:2,sourceKeys:['sales']},
  {key:'sales-roas-trend',label:'Sales ROAS trend',formula:'roas',evaluation:'period_over_period_change',required:false,weight:20,direction:'higher_is_better',greenThreshold:5,yellowThreshold:-5,sourceKeys:['sales']}
 ]},
 {clientId:'90000000-0000-4000-8000-000000000002',clientKey:'aurit',displayName:'Aurit',dashboardHref:null,reportingTimezone:'America/Phoenix',clickupListIds:[],marginAliases:['Scott - Aurit'],configStatus:'configuration_required',fixedValues:{monthlyBudget:null},economics:{effectiveMonth:'2026-08-01',monthlyRetainer:500,deliveryModel:'custom',fulfillmentHourlyCost:46,targetMarginPercent:80},metrics:[],sources:[],northStarLanes:[]}
]});
console.log(JSON.stringify({v2,v3}));
NODE
v2id="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['v2']['id'])" "$fixture")"
v2hash="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['v2']['hash'])" "$fixture")"
v2json="$(python3 -c "import json,sys;print(json.dumps(json.load(open(sys.argv[1]))['v2']['content'],separators=(',',':')))" "$fixture")"
v3id="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['v3']['id'])" "$fixture")"
v3hash="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['v3']['hash'])" "$fixture")"
v3json="$(python3 -c "import json,sys;print(json.dumps(json.load(open(sys.argv[1]))['v3']['content'],separators=(',',':')))" "$fixture")"

# Create a frozen v2 baseline under the original calculator.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$v2id" -v rhash="$v2hash" -v rjson="$v2json" <<'SQL' >/dev/null
select private.client_health_stage_config_revision(:'rid'::uuid,:'rhash',:'rjson'::jsonb);
select private.client_health_activate_config_revision('81111111-1111-4111-8111-111111111111',:'rid'::uuid,'1111111111111111111111111111111111111111','verify:v2','authoritative v3 v2 baseline',null);
insert into public.client_health_clients(id,client_key,display_name,active,config_status) values('80000000-0000-4000-8000-000000000001','v2-pending','V2 Pending',true,'configuration_required');
select set_config('test.rid',:'rid',false),set_config('test.rhash',:'rhash',false);
do $$declare h text; run_id uuid;begin
 h:=encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',current_setting('test.rid'),'configRevisionHash',current_setting('test.rhash'),'snapshotDate','2026-09-02','calculationVersion','verify-v2','sourceContractVersion','verify-s2')),'UTF8'),'sha256'),'hex');
 run_id:=public.client_health_revision_id(encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',h,'runAttemptId','81111111-1111-4111-8111-111111111112')),'UTF8'),'sha256'),'hex'));
 perform public.client_health_create_refresh_run(run_id,current_setting('test.rid')::uuid,current_setting('test.rhash'),h,'81111111-1111-4111-8111-111111111112','2026-09-02','verify-v2','verify-s2','2026-09-03T00:00:00.000Z');
 create table public._client_health_v2_baseline(payload jsonb not null); insert into public._client_health_v2_baseline values(public.client_health_calculate_snapshot(run_id,'80000000-0000-4000-8000-000000000001',null));
end$$;
SQL

apply "$root/supabase/client_health_authoritative_v3.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
do $$declare run_id uuid; actual jsonb;begin
 select id into run_id from public.client_health_refresh_runs where run_attempt_id='81111111-1111-4111-8111-111111111112';
 actual:=public.client_health_calculate_snapshot(run_id,'80000000-0000-4000-8000-000000000001',null);
 if actual<>(select payload from public._client_health_v2_baseline) then raise exception 'v2 calculator output/hash changed';end if;
end$$;
SQL
apply "$root/supabase/client_health_authoritative_v3_rollback.sql"
apply "$root/supabase/client_health_authoritative_v3.sql"

# Activate v3, create a real refresh/lease, and commit deterministic source facts.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$v3id" -v rhash="$v3hash" -v rjson="$v3json" <<'SQL' >/dev/null
select private.client_health_stage_config_revision(:'rid'::uuid,:'rhash',:'rjson'::jsonb);
select private.client_health_activate_config_revision('92222222-2222-4222-8222-222222222221',:'rid'::uuid,'2222222222222222222222222222222222222222','verify:v3','authoritative v3 verification','81111111-1111-4111-8111-111111111111');
insert into public.client_health_clients(id,client_key,display_name,active,config_status) values
 ('90000000-0000-4000-8000-000000000001','spartaco','Spartaco',true,'approved'),
 ('90000000-0000-4000-8000-000000000002','aurit','Aurit',true,'configuration_required');
create table public._client_health_v3_ids(run_id uuid not null,invocation_id uuid not null,claim_id uuid not null);
select set_config('test.rid',:'rid',false),set_config('test.rhash',:'rhash',false);
do $$declare h text; run_id uuid;begin
 h:=encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',current_setting('test.rid'),'configRevisionHash',current_setting('test.rhash'),'snapshotDate','2026-09-02','calculationVersion','verify-v3','sourceContractVersion','verify-s3')),'UTF8'),'sha256'),'hex');
 run_id:=public.client_health_revision_id(encode(extensions.digest(convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',h,'runAttemptId','92222222-2222-4222-8222-222222222222')),'UTF8'),'sha256'),'hex'));
 perform public.client_health_create_refresh_run(run_id,current_setting('test.rid')::uuid,current_setting('test.rhash'),h,'92222222-2222-4222-8222-222222222222','2026-09-02','verify-v3','verify-s3','2026-09-03T00:00:00.000Z');
 perform public.client_health_acquire_refresh_lease(run_id,'93333333-3333-4333-8333-333333333333','94444444-4444-4444-8444-444444444444',600000);
 insert into public._client_health_v3_ids values(run_id,'93333333-3333-4333-8333-333333333333','94444444-4444-4444-8444-444444444444');
 insert into public.client_health_source_runs(id,refresh_run_id,client_id,source_key,run_status,window_start,window_end,started_at,finished_at,data_through,row_count,request_fingerprint,evidence,facts) values
 ('a0000000-0000-4000-8000-000000000001',run_id,'90000000-0000-4000-8000-000000000001','clickup','succeeded','2026-09-01','2026-09-02','2026-09-03T00:01:00Z','2026-09-03T00:03:00Z','2026-09-02T00:00:00Z',1,repeat('c',64),'{}',jsonb_build_object('hoursUsed',2,'overdueTaskCount',0)),
 ('a0000000-0000-4000-8000-000000000002',run_id,'90000000-0000-4000-8000-000000000001','leads','succeeded','2026-09-01','2026-09-02','2026-09-03T00:01:00Z','2026-09-03T00:03:00Z','2026-09-02T00:00:00Z',2,repeat('a',64),'{}','{"currentRows":[{"results":12,"spend":120}],"previousRows":[{"results":5,"spend":100}]}'::jsonb),
 ('a0000000-0000-4000-8000-000000000003',run_id,'90000000-0000-4000-8000-000000000001','sales','succeeded','2026-09-01','2026-09-02','2026-09-03T00:01:00Z','2026-09-03T00:03:00Z','2026-09-02T00:00:00Z',2,repeat('b',64),'{}','{"currentRows":[{"results":400,"spend":100}],"monthSpend":500,"previousRows":[{"results":300,"spend":100}]}'::jsonb);
end$$;
SQL

# Assert economics, lane isolation/order/reducers, setup-state bypass, and caller-tamper rejection.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$v3id" -v rhash="$v3hash" <<'SQL' >/dev/null
select set_config('test.rid',:'rid',false),set_config('test.rhash',:'rhash',false);
do $$declare ids record; calc jsonb; snap jsonb; lanes jsonb; setup jsonb; bundle jsonb; receipt jsonb; requested uuid:='95555555-5555-4555-8555-555555555555';begin
 select * into ids from public._client_health_v3_ids;
 calc:=public.client_health_calculate_snapshot(ids.run_id,'90000000-0000-4000-8000-000000000001',null); snap:=calc->'snapshot'; lanes:=snap->'dimensionStatuses'->'north_star'->'facts'->'lanes';
 if (snap->>'hoursAllotted')::numeric<>20 or (snap->>'projectedHours')::numeric<>30 or (snap->>'revenue')::numeric<>4600 or (snap->>'fulfillmentCost')::numeric<>1380 or (snap->>'marginPercent')::numeric<>70 then raise exception 'derived v3 economics mismatch: %',snap;end if;
 if jsonb_array_length(lanes)<>3 or lanes->0->>'key'<>'lead-cpl' or lanes->1->>'key'<>'sales-roas' or lanes->2->>'key'<>'sales-roas-trend' then raise exception 'lane ordering/bounds mismatch';end if;
 if (lanes->0->>'evaluationValue')::numeric<>-50 or (lanes->1->>'evaluationValue')::numeric<>4 or abs((lanes->2->>'evaluationValue')::numeric-33.3333333333333)>.0000000001 then raise exception 'lane ratio/source isolation mismatch: %',lanes;end if;
 if snap->'dimensionStatuses'->'north_star'->>'status'<>'healthy' or snap->'dimensionStatuses'->'north_star'->'value'<>'null'::jsonb then raise exception 'multi-lane parent reduction mismatch';end if;
 if snap->'dimensionStatuses'->'margin'->>'status'<>'at_risk' or snap->>'overallStatus'<>'at_risk' then raise exception 'critical margin precedence mismatch';end if;
 setup:=public.client_health_calculate_snapshot(ids.run_id,'90000000-0000-4000-8000-000000000002',null);
 if setup->'snapshot'->>'overallStatus'<>'configuration_required' then raise exception 'setup-state economics did not bypass scoring';end if;
 bundle:=jsonb_build_object('configRevisionId',current_setting('test.rid'),'configRevisionHash',current_setting('test.rhash'),'idempotencyKey',repeat('d',64),'evidenceHash',calc->>'proofHash','snapshotId',requested::text,'snapshot',jsonb_set(calc->'snapshot','{marginPercent}','1'::jsonb),'tasks','[]'::jsonb);
 receipt:=public.client_health_persist_snapshot_bundle(bundle,ids.invocation_id,ids.claim_id,1);
 if receipt->>'snapshotId'=requested::text then raise exception 'caller snapshot id was trusted';end if;
 if (select margin_percent from public.client_health_snapshots where id=(receipt->>'snapshotId')::uuid)<>70 then raise exception 'caller margin tamper reached persistence';end if;
 update public.client_health_source_runs set facts=jsonb_set(facts,'{previousRows}','null'::jsonb) where refresh_run_id=ids.run_id and source_key='sales';
 calc:=public.client_health_calculate_snapshot(ids.run_id,'90000000-0000-4000-8000-000000000001',null); lanes:=calc->'snapshot'->'dimensionStatuses'->'north_star'->'facts'->'lanes';
 if lanes->2->>'status'<>'unavailable' or calc->'snapshot'->'dimensionStatuses'->'north_star'->>'status'<>'healthy' then raise exception 'optional unavailable lane changed required parent reduction';end if;
 update public.client_health_source_runs set data_through='2026-09-01T00:00:00Z' where refresh_run_id=ids.run_id and source_key='leads';
 calc:=public.client_health_calculate_snapshot(ids.run_id,'90000000-0000-4000-8000-000000000001',null);
 if calc->'snapshot'->'dimensionStatuses'->'north_star'->>'status'<>'incomplete' or calc->'snapshot'->>'overallStatus'<>'incomplete' then raise exception 'required stale lane did not fail closed';end if;
end$$;
SQL

out="$(docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/client_health_authoritative_v3_rollback.sql" 2>&1 || true)"
[[ "$out" == *"rollback refuses while any v3 refresh or snapshot exists"* ]] || { printf '%s\n' "$out" >&2; exit 1; }
echo "client-health authoritative v3 PostgreSQL 17 v2 parity/economics/lanes/setup-state/persistence/rollback passed"
