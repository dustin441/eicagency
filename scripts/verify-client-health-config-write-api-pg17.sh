#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
name="client-health-config-write-api-pg17-${$}"
fixture="$(mktemp)"
signed="$(mktemp)"
cleanup(){ rm -f "$fixture" "$signed"; docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_USER=supabase_admin -e POSTGRES_PASSWORD=test -e POSTGRES_DB=postgres postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2

docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL' >/dev/null
create role postgres login nosuperuser bypassrls createrole createdb;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.master_spartaco(id bigint);
grant usage,create on schema public to postgres;
grant connect,create,temporary on database postgres to postgres;
grant usage on schema extensions to postgres;
grant execute on function extensions.digest(bytea,text),extensions.hmac(bytea,bytea,text) to postgres;
grant anon,authenticated,service_role to postgres;
SQL
apply(){ docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1" >/dev/null; }
apply "$root/supabase/client_health_foundation.sql"
apply "$root/supabase/client_health_foundation_privilege_hardening.sql"
apply "$root/supabase/client_health_atomic_refresh.sql"
apply "$root/supabase/client_health_config_v3.sql"
apply "$root/supabase/client_health_config_write_api.sql"

# A never-used installation rolls back exactly and can be reinstalled.
apply "$root/supabase/client_health_config_write_api_rollback.sql"
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
do $$begin
 if to_regclass('private.client_health_config_write_secrets') is not null
    or to_regclass('private.client_health_config_write_nonces') is not null
    or to_regprocedure('public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)') is not null then
   raise exception 'clean write API rollback left objects';
 end if;
end$$;
SQL
apply "$root/supabase/client_health_config_write_api.sql"

cd "$root"
node --no-warnings --experimental-strip-types --input-type=module > "$fixture" <<'NODE'
import { buildApprovedConfigRevision } from './src/services/client-health/config-revision.ts';
const sourceKeys=['paid'];
const metrics=[['budget_pacing','lower_is_better',10,20],['hours','lower_is_better',90,110],['margin','higher_is_better',80,60],['north_star','higher_is_better',5,0],['overdue_tasks','lower_is_better',0,2]].map(([key,direction,greenThreshold,yellowThreshold])=>({key,label:key,adapterKey:`approved.${key}`,required:true,weight:20,direction,greenThreshold,yellowThreshold,sourceKeys}));
const revision=buildApprovedConfigRevision({schemaVersion:3,calculationVersion:'verify-v3',sourceContractVersion:'verify-s3',clients:[{clientId:'90000000-0000-4000-8000-000000000001',clientKey:'alpha',displayName:'Alpha',dashboardHref:'/dashboard/alpha',reportingTimezone:'America/Phoenix',clickupListIds:[],marginAliases:[],configStatus:'approved',fixedValues:{monthlyBudget:100},economics:{effectiveMonth:'2026-09-01',monthlyRetainer:4600,deliveryModel:'custom',fulfillmentHourlyCost:46,targetMarginPercent:80},metrics,sources:[{sourceKey:'paid',provider:'supabase',project:'eic',relation:'paid_daily',requestFingerprint:'a'.repeat(64),permittedFactFields:['currentRows','hoursUsed','monthSpend','overdueTaskCount','previousRows'],freshnessPolicy:{maximumLagDays:3}}],northStarLanes:[{key:'cpl',label:'CPL trend',formula:'cost_per_result',evaluation:'period_over_period_change',required:true,weight:100,direction:'lower_is_better',greenThreshold:5,yellowThreshold:15,sourceKeys:['paid']}]}]});
console.log(JSON.stringify(revision));
NODE
rid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$fixture")"
rhash="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["hash"])' "$fixture")"
rjson="$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["content"],separators=(",",":")))' "$fixture")"
activation='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
operator='prepass-auth:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
commit='1111111111111111111111111111111111111111'
reason='PG17 signed settings verification'
secret="$(printf '11%.0s' {1..32})"
issued="$(python3 -c 'import time; print(int(time.time()*1000))')"

sign(){ ISSUED="$1" SIGN_REASON="$2" node --no-warnings --experimental-strip-types --input-type=module > "$signed" <<'NODE'
import { createHmac } from 'node:crypto'; import { readFileSync } from 'node:fs';
import { canonicalEvidenceJson } from './src/services/client-health/evidence.ts';
const revision=JSON.parse(readFileSync(process.env.FIXTURE,'utf8'));
const payload={action:'apply-client-health-config-v1',activationId:process.env.ACTIVATION,expectedCurrentActivationId:null,issuedAtUnixMs:Number(process.env.ISSUED),nonce:process.env.NONCE,operatorIdentity:process.env.OPERATOR,reason:process.env.SIGN_REASON,revision:revision.content,revisionHash:revision.hash,revisionId:revision.id,reviewedCommitSha:process.env.COMMIT};
process.stdout.write(createHmac('sha256',Buffer.from(process.env.SECRET,'hex')).update(canonicalEvidenceJson(payload)).digest('hex'));
NODE
}
export FIXTURE="$fixture" ACTIVATION="$activation" NONCE="$nonce" OPERATOR="$operator" COMMIT="$commit" SECRET="$secret"
call_sql="select public.client_health_apply_config_revision(:'rid'::uuid,:'rhash',:'rjson'::jsonb,:'activation'::uuid,:'commit',:'reason',null,:'operator',:'issued'::bigint,:'nonce'::uuid,:'signature');"
invoke(){ docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$rid" -v rhash="$rhash" -v rjson="$rjson" -v activation="$activation" -v commit="$commit" -v reason="$reason" -v operator="$operator" -v issued="$issued" -v nonce="$nonce" -v signature="$1" <<SQL 2>&1
begin; set local role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',true); $call_sql commit;
SQL
}

# No secret, invalid signature, and expired request all leave no durable revision.
sign "$issued" "$reason"; signature="$(cat "$signed")"
out="$(invoke "$signature" || true)"; [[ "$out" == *'config write secret is not provisioned'* ]] || { echo "$out" >&2; exit 1; }
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v secret="$secret" <<'SQL' >/dev/null
select private.client_health_set_config_write_secret(:'secret');
SQL
out="$(invoke "$(printf '00%.0s' {1..32})" || true)"; [[ "$out" == *'authentication failed'* ]] || { echo "$out" >&2; exit 1; }
expired=$((issued-600000)); issued_save="$issued"; issued="$expired"; out="$(invoke "$signature" || true)"; [[ "$out" == *'expired or from the future'* ]] || { echo "$out" >&2; exit 1; }; issued="$issued_save"

# Only service_role has transport execute; the dedicated HMAC remains mandatory.
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
do $$begin
 if not has_function_privilege('service_role','public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)','EXECUTE')
    or has_schema_privilege('service_role','private','USAGE') then raise exception 'write API ACL failed'; end if;
end$$;
SQL

# Exact signed request stages and activates atomically.
sign "$issued" "$reason"; signature="$(cat "$signed")"; invoke "$signature" >/dev/null
docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v rid="$rid" -v activation="$activation" -v nonce="$nonce" -v operator="$operator" <<'SQL' >/dev/null
select set_config('test.rid',:'rid',false),set_config('test.activation',:'activation',false),set_config('test.nonce',:'nonce',false),set_config('test.operator',:'operator',false);
do $$begin
 if not exists(select 1 from private.client_health_config_revisions where id=current_setting('test.rid')::uuid)
    or not exists(select 1 from private.client_health_active_config_revision where singleton and activation_id=current_setting('test.activation')::uuid)
    or not exists(select 1 from private.client_health_config_write_nonces where nonce=current_setting('test.nonce')::uuid and operator_identity=current_setting('test.operator')) then
   raise exception 'signed apply did not persist exact revision, activation, and nonce';
 end if;
end$$;
SQL
out="$(invoke "$signature" || true)"; [[ "$out" == *'nonce was already consumed'* ]] || { echo "$out" >&2; exit 1; }

# Used API cannot be rolled back because that would erase replay/audit state.
out="$(docker exec -i "$name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/client_health_config_write_api_rollback.sql" 2>&1 || true)"
[[ "$out" == *'rollback refuses after a signed mutation was consumed'* ]] || { echo "$out" >&2; exit 1; }

echo 'client-health signed config write API PostgreSQL 17 auth/replay/atomicity/rollback passed'
