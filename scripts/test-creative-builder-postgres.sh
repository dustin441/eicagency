#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="creative-builder-pg-${RANDOM}-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting disposable PostgreSQL 17 container $container"
docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres postgres:17-alpine >/dev/null
for attempt in $(seq 1 60); do
  docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && break
  if [ "$attempt" = 60 ]; then docker logs "$container"; exit 1; fi
  sleep 1
done

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL,client_access text[] NOT NULL DEFAULT '{}');
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
INSERT INTO auth.users SELECT ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid FROM generate_series(1,12) g;
INSERT INTO public.profiles SELECT id,'agency','{}'::text[] FROM auth.users;
SQL

docker cp "$repo_root/supabase/creative_builder.sql" "$container:/tmp/creative_builder.sql"
docker cp "$repo_root/supabase/creative_studio.sql" "$container:/tmp/creative_studio.sql"
docker cp "$repo_root/supabase/creative_builder_studio_handoff.sql" "$container:/tmp/creative_builder_studio_handoff.sql"
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/creative_studio.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/creative_builder.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/creative_builder_studio_handoff.sql >/dev/null

# A second application must fail on the first collision; it must not silently replace drift.
if docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/creative_builder.sql >/tmp/creative-builder-collision.log 2>&1; then
  echo "ERROR: second migration application unexpectedly succeeded" >&2
  exit 1
fi

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null
DO $$
DECLARE r record;
BEGIN
 IF has_schema_privilege('anon','creative_builder','USAGE') OR has_schema_privilege('authenticated','creative_builder','USAGE') OR has_schema_privilege('service_role','creative_builder','USAGE') THEN RAISE EXCEPTION 'browser/service role schema access'; END IF;
 FOR r IN SELECT unnest(ARRAY['anon','authenticated','service_role','creative_builder_repository','creative_builder_worker']) role_name LOOP
  IF has_table_privilege(r.role_name,'creative_builder.projects','SELECT') OR has_table_privilege(r.role_name,'creative_builder.projects','INSERT') OR has_table_privilege(r.role_name,'creative_builder.jobs','UPDATE') THEN RAISE EXCEPTION 'table grant leaked to %',r.role_name; END IF;
 END LOOP;
 IF NOT has_function_privilege('creative_builder_repository','creative_builder.create_project(text,text)','EXECUTE')
 OR has_function_privilege('creative_builder_repository','creative_builder.commit_analysis(uuid,uuid,integer,uuid,integer,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE')
 OR NOT has_function_privilege('creative_builder_worker','creative_builder.commit_analysis(uuid,uuid,integer,uuid,integer,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('creative_builder_worker','creative_builder.create_project(text,text)','EXECUTE') THEN RAISE EXCEPTION 'incorrect exact RPC grants'; END IF;
 IF NOT has_function_privilege('creative_builder_worker','creative_builder.reserve_studio_handoff(uuid,integer,uuid,text,text,text)','EXECUTE')
 OR has_function_privilege('creative_builder_repository','creative_builder.reserve_studio_handoff(uuid,integer,uuid,text,text,text)','EXECUTE')
 OR NOT has_function_privilege('creative_studio_repository','creative_studio.create_handoff_artwork(text,text,jsonb,jsonb,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('creative_studio_repository','creative_studio.save_version(uuid,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'handoff RPC allowlist leaked'; END IF;
END $$;

-- Forged/missing claims fail closed.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
DO $$BEGIN
 PERFORM creative_builder.create_project('https://example.com/forged','forged-create-1');
 RAISE EXCEPTION 'missing claims accepted';
EXCEPTION WHEN insufficient_privilege THEN NULL; END$$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
DO $$BEGIN
 PERFORM creative_builder.create_project('https://example.com/forged','forged-create-2');
 RAISE EXCEPTION 'browser role claim accepted';
EXCEPTION WHEN insufficient_privilege THEN NULL; END$$;
ROLLBACK;

-- Owner one: create, reserve, lease, analysis commit, edit, confirm, generate, import and select.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT (creative_builder.create_project('https://example.com/landing','analysis-create-1')->>'project_id')::uuid AS p1 \gset
SELECT set_config('test.p1',:'p1',false);
DO $$DECLARE replay uuid; BEGIN
 replay:=(creative_builder.create_project('https://example.com/landing','analysis-create-1')->>'project_id')::uuid;
 IF replay IS DISTINCT FROM current_setting('test.p1')::uuid THEN RAISE EXCEPTION 'create replay produced a duplicate project'; END IF;
 BEGIN PERFORM creative_builder.create_project('https://example.com/other','analysis-create-1'); RAISE EXCEPTION 'create idempotency mismatch accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END$$;
SELECT creative_builder.reserve_job(:'p1',0,'analysis','analysis-key-0001',1,0) AS reservation \gset
SELECT (:'reservation'::jsonb->>'job_id')::uuid AS analysis_job, (:'reservation'::jsonb->>'lease_token')::uuid AS analysis_token, (:'reservation'::jsonb->>'fencing_generation')::integer AS analysis_gen \gset
SELECT set_config('test.analysis_job',:'analysis_job',false);
-- Exact idempotent replay returns the same job and does not double charge.
SELECT creative_builder.reserve_job(:'p1',0,'analysis','analysis-key-0001',1,0) AS replay \gset
SELECT set_config('test.replay',:'replay',false);
DO $$BEGIN
 IF (current_setting('test.analysis_job'))::uuid IS DISTINCT FROM ((current_setting('test.replay'))::jsonb->>'job_id')::uuid THEN RAISE EXCEPTION 'idempotency changed job'; END IF;
END$$;
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.transition_job(:'analysis_job',:'analysis_token',:analysis_gen,:'p1','analysis',0,'scanning',NULL);
SELECT creative_builder.renew_job(:'analysis_job',:'analysis_token',:analysis_gen,:'p1','analysis',0,180);
SELECT creative_builder.transition_job(:'analysis_job',:'analysis_token',:analysis_gen,:'p1','analysis',0,'committing',NULL);
SELECT gen_random_uuid() AS scan_id \gset
SELECT jsonb_build_object('id',:'scan_id','canonical_url','https://example.com/landing','title','Secret receipt title','assets',jsonb_build_array(jsonb_build_object('id','candidate_1'))) AS receipt,
       '{"audience":{"recommendation":"operators","observedPageExcerptIds":[],"confirmed":false},"message":{"recommendation":"bounded","observedPageExcerptIds":[],"confirmed":false},"claims":[{"id":"price-1","kind":"price","text":"Confirmed price","status":"page-observed","pageExcerptIds":[]}]}'::jsonb AS assumptions,
       '[{"channel":"meta"}]'::jsonb AS channels \gset
SELECT encode(sha256(convert_to((:'receipt'::jsonb)::text,'UTF8')),'hex') AS receipt_hash,
       encode(sha256(convert_to((:'assumptions'::jsonb)::text||(:'channels'::jsonb)::text,'UTF8')),'hex') AS assumptions_hash \gset
SELECT creative_builder.commit_analysis(:'analysis_job',:'analysis_token',:analysis_gen,:'p1',0,:'scan_id',:'receipt',:'assumptions',:'channels','[]') AS analysis_result \gset
SELECT set_config('test.analysis_result',:'analysis_result',false),set_config('test.assumptions',:'assumptions',false),set_config('test.channels',:'channels',false),set_config('test.assumptions_hash',:'assumptions_hash',false);
SET LOCAL ROLE creative_builder_repository;
SELECT (:'analysis_result'::jsonb->>'plan_revision_id')::uuid AS plan1 \gset
SELECT set_config('test.plan1',:'plan1',false);
-- Stale optimistic write must fail without adding a revision.
DO $$BEGIN
 PERFORM creative_builder.edit_plan(current_setting('test.p1')::uuid,current_setting('test.plan1')::uuid,0,(current_setting('test.analysis_result')::jsonb->>'scan_id')::uuid,current_setting('test.assumptions')::jsonb,current_setting('test.channels')::jsonb);
 RAISE EXCEPTION 'stale revision accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END$$;
SELECT creative_builder.edit_plan(:'p1',:'plan1',1,(:'analysis_result'::jsonb->>'scan_id')::uuid,:'assumptions',:'channels') AS edited \gset
SELECT (:'edited'::jsonb->>'plan_revision_id')::uuid AS plan2 \gset
SELECT set_config('test.plan2',:'plan2',false);
DO $$BEGIN PERFORM creative_builder.confirm_plan(current_setting('test.p1')::uuid,current_setting('test.plan2')::uuid,2,'{}'::text[]); RAISE EXCEPTION 'missing exact claim confirmation accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END$$;
SELECT creative_builder.confirm_plan(:'p1',:'plan2',2,ARRAY['price-1']) AS confirmed \gset
SELECT (:'confirmed'::jsonb->>'plan_revision_id')::uuid AS plan3 \gset
SELECT set_config('test.plan3',:'plan3',false);
RESET ROLE;
DO $$DECLARE r creative_builder.plan_revisions; plan_receipt jsonb; claim_receipt jsonb; BEGIN
 SELECT * INTO r FROM creative_builder.plan_revisions WHERE id=current_setting('test.plan3')::uuid;
 SELECT value INTO plan_receipt FROM jsonb_array_elements(r.confirmation_receipts) WHERE value->>'scope'='plan';
 SELECT value INTO claim_receipt FROM jsonb_array_elements(r.confirmation_receipts) WHERE value->>'scope'='claim';
 IF r.assumptions#>>'{audience,confirmed}' IS DISTINCT FROM 'true' OR r.assumptions#>>'{claims,0,status}' IS DISTINCT FROM 'user-confirmed'
  OR r.assumptions#>>'{claims,0,confirmationReceiptId}' IS DISTINCT FROM claim_receipt->>'id'
  OR plan_receipt->>'planRevisionId' IS DISTINCT FROM r.id::text OR plan_receipt->>'contentSha256' IS DISTINCT FROM r.assumptions_hash
  OR r.assumptions_hash IS DISTINCT FROM encode(sha256(convert_to(r.assumptions::text||r.channels::text,'UTF8')),'hex')
  OR claim_receipt->'claimIds' IS DISTINCT FROM '["price-1"]'::jsonb THEN RAISE EXCEPTION 'confirmation receipts do not bind canonical plan and claims'; END IF;
END$$;
-- A browser-shaped edit cannot arrive pre-confirmed with a forged receipt reference.
SAVEPOINT forged_confirmation;
WITH forged AS (
 SELECT jsonb_set(jsonb_set(:'assumptions'::jsonb,'{claims,0,status}','"user-confirmed"'::jsonb,false),'{claims,0,confirmationReceiptId}',to_jsonb(gen_random_uuid()),true) AS assumptions
), inserted AS (
 INSERT INTO creative_builder.plan_revisions(project_id,parent_id,scan_id,project_revision,assumptions,channels,assumptions_hash,created_by)
 SELECT :'p1',:'plan3',r.scan_id,4,f.assumptions,:'channels'::jsonb,encode(sha256(convert_to(f.assumptions::text||(:'channels'::jsonb)::text,'UTF8')),'hex'),'00000000-0000-4000-8000-000000000001'::uuid FROM forged f, creative_builder.plan_revisions r WHERE r.id=:'plan3' RETURNING id
), updated AS (
 UPDATE creative_builder.projects SET revision=4,latest_plan_revision_id=inserted.id FROM inserted WHERE projects.id=:'p1' RETURNING inserted.id
) SELECT set_config('test.forged_plan',id::text,false) FROM updated;
SET LOCAL ROLE creative_builder_repository;
DO $$BEGIN PERFORM creative_builder.confirm_plan(current_setting('test.p1')::uuid,current_setting('test.forged_plan')::uuid,4,'{}'::text[]); RAISE EXCEPTION 'forged pre-confirmed claim accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END$$;
RESET ROLE;
ROLLBACK TO SAVEPOINT forged_confirmation;
SET LOCAL ROLE creative_builder_repository;
SELECT creative_builder.reserve_job(:'p1',3,'generation','generation-key-01',1,0,'plan',:'plan3') AS genres \gset
SELECT (:'genres'::jsonb->>'job_id')::uuid AS genjob,(:'genres'::jsonb->>'lease_token')::uuid AS gentoken,(:'genres'::jsonb->>'fencing_generation')::integer AS gengen \gset
SELECT set_config('test.genjob',:'genjob',false);
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.transition_job(:'genjob',:'gentoken',:gengen,:'p1','generation',3,'model_started',300);
-- A live model deadline blocks reclaim even if the ordinary lease is made stale.
RESET ROLE;
UPDATE creative_builder.jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=:'genjob';
SET LOCAL ROLE creative_builder_worker;
DO $$BEGIN PERFORM creative_builder.recover_job(current_setting('test.genjob')::uuid,current_setting('test.p1')::uuid,'generation',3); RAISE EXCEPTION 'live model reclaimed'; EXCEPTION WHEN serialization_failure THEN NULL; END$$;
SELECT creative_builder.transition_job(:'genjob',:'gentoken',:gengen,:'p1','generation',3,'committing',NULL);
SELECT jsonb_agg(jsonb_build_object('handle','concept_'||g,'content',jsonb_build_object('headline','Headline '||g,'body','Body '||g)) ORDER BY g) AS portfolio FROM generate_series(1,6) g \gset
SELECT creative_builder.commit_concepts(:'genjob',:'gentoken',:gengen,:'p1',3,:'plan3',:'portfolio') AS concepts \gset
SELECT (:'concepts'::jsonb->>'concept_set_id')::uuid AS conceptset \gset
SELECT set_config('test.conceptset',:'conceptset',false);
SET LOCAL ROLE creative_builder_repository;
SELECT creative_builder.reserve_job(:'p1',4,'source_import','source-import-001',1,8388608) AS impres \gset
SELECT (:'impres'::jsonb->>'job_id')::uuid AS impjob,(:'impres'::jsonb->>'lease_token')::uuid AS imptoken,(:'impres'::jsonb->>'fencing_generation')::integer AS impgen \gset
SELECT set_config('test.impjob',:'impjob',false),set_config('test.imptoken',:'imptoken',false),set_config('test.impgen',:'impgen',false),set_config('test.scan_id',(:'analysis_result'::jsonb->>'scan_id'),false);
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.transition_job(:'impjob',:'imptoken',:impgen,:'p1','source_import',4,'scanning',NULL);
SELECT creative_builder.transition_job(:'impjob',:'imptoken',:impgen,:'p1','source_import',4,'committing',NULL);
DO $$BEGIN
 PERFORM creative_builder.import_asset_receipt(current_setting('test.impjob')::uuid,current_setting('test.imptoken')::uuid,current_setting('test.impgen')::int,current_setting('test.p1')::uuid,4,current_setting('test.scan_id')::uuid,'candidate_missing','eicagency/00000000-0000-4000-8000-000000000001/'||current_setting('test.p1')||'/'||current_setting('test.impjob')||'/'||current_setting('test.impgen')||'/asset.webp',repeat('a',64),'image/webp',800,600,1024);
 RAISE EXCEPTION 'unknown candidate accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END$$;
SELECT creative_builder.import_asset_receipt(:'impjob',:'imptoken',:impgen,:'p1',4,(:'analysis_result'::jsonb->>'scan_id')::uuid,'candidate_1','eicagency/00000000-0000-4000-8000-000000000001/'||:'p1'||'/'||:'impjob'||'/'||:impgen||'/asset.webp',repeat('a',64),'image/webp',800,600,1024) AS imported \gset
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM creative_builder.daily_usage WHERE usage_date=current_date AND operation='source_import' AND completed_bytes<>1024) THEN RAISE EXCEPTION 'source import completed-byte accounting used reservation rather than exact receipt'; END IF;
END$$;
SELECT (:'imported'::jsonb->>'asset_id')::uuid AS asset1 \gset
SET LOCAL ROLE creative_builder_repository;
SELECT creative_builder.select_concept(:'p1',4,:'conceptset',NULL,'concept_1',ARRAY[:'asset1'::uuid]) AS selected \gset
SELECT (:'selected'::jsonb->>'selection_id')::uuid AS selection1 \gset
SELECT encode(sha256(convert_to(:'p1'||':'||:'selection1'||':'||(:'selected'::jsonb->>'content_hash'),'UTF8')),'hex') AS handoff_key, repeat('f',64) AS artifact_hash, (:'selected'::jsonb->>'content_hash') AS selection_hash \gset
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.reserve_studio_handoff(:'p1',5,:'selection1',:'handoff_key',:'artifact_hash',:'selection_hash');
SET LOCAL ROLE creative_studio_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_studio_tenant":"eicagency","creative_studio_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_studio.create_handoff_artwork(:'handoff_key',:'artifact_hash','{"pack":"meta-images","title":"Handoff","audience":"Audience","objective":"Objective","hypothesis":"Hypothesis","stage":"Action","sourceIds":[]}'::jsonb,'{"template":"generated-native-v1"}'::jsonb,'{"sources":[],"warnings":[]}'::jsonb,jsonb_build_object('1:1',jsonb_build_object('html','<main>exact</main>','sha256',encode(sha256(convert_to('<main>exact</main>','UTF8')),'hex'),'placement',jsonb_build_object('width',1080,'height',1080,'maxBytes',1000000,'mimeType','image/png')))) AS studio_handoff \gset
SELECT set_config('test.studio_handoff',:'studio_handoff',false);
SELECT creative_studio.create_handoff_artwork(:'handoff_key',:'artifact_hash','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb) AS studio_replay \gset
SELECT set_config('test.studio_replay',:'studio_replay',false),set_config('test.handoff_key',:'handoff_key',false);
SELECT (:'studio_handoff'::jsonb->>'project_id')::uuid AS studio_project,(:'studio_handoff'::jsonb->>'version_id')::uuid AS studio_version \gset
SET LOCAL ROLE creative_builder_worker;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.link_studio_handoff(:'handoff_key',:'artifact_hash',:'studio_project',:'studio_version');
RESET ROLE;
DO $$DECLARE h jsonb:=creative_builder.read_studio_handoff(current_setting('test.handoff_key')); BEGIN
 IF current_setting('test.studio_handoff')::jsonb->>'version_id' IS DISTINCT FROM current_setting('test.studio_replay')::jsonb->>'version_id'
 OR h->>'studio_version_id' IS DISTINCT FROM current_setting('test.studio_handoff')::jsonb->>'version_id'
 OR (SELECT count(*) FROM creative_builder.studio_handoffs WHERE handoff_key=current_setting('test.handoff_key'))<>1
 OR (SELECT count(*) FROM creative_studio.builder_handoffs WHERE handoff_key=current_setting('test.handoff_key'))<>1 THEN RAISE EXCEPTION 'durable handoff reconciliation failed'; END IF;
END$$;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
-- An asset belonging to another project can never be substituted.
DO $$BEGIN
 PERFORM creative_builder.select_concept(current_setting('test.p1')::uuid,5,current_setting('test.conceptset')::uuid,NULL,'concept_1',ARRAY['00000000-0000-4000-8000-999999999999'::uuid]);
 RAISE EXCEPTION 'foreign asset accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END$$;
COMMIT;

-- Cross-owner reads and writes are denied; safe projection excludes receipts and object keys.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000002"}',true);
DO $$BEGIN PERFORM creative_builder.read_project(current_setting('test.p1')::uuid); RAISE EXCEPTION 'cross-owner read accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END$$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.read_project(:'p1') AS dto \gset
SELECT set_config('test.dto',:'dto',false);
DO $$DECLARE d text:=current_setting('test.dto'); BEGIN
 IF d LIKE '%Secret receipt title%' OR d LIKE '%/asset.webp%' OR d LIKE '%lease_token%' THEN RAISE EXCEPTION 'private data leaked'; END IF;
END$$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
DO $$BEGIN PERFORM creative_builder.read_project_canonical(current_setting('test.p1')::uuid); RAISE EXCEPTION 'repository read canonical receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END$$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE creative_builder_worker;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.read_project_canonical(:'p1') AS canonical_dto \gset
SELECT set_config('test.canonical_dto',:'canonical_dto',false);
DO $$BEGIN IF current_setting('test.canonical_dto') NOT LIKE '%Secret receipt title%' THEN RAISE EXCEPTION 'worker canonical receipt missing'; END IF; END$$;
ROLLBACK;

-- Quota limit-1 boundary, idempotency, one-owner concurrency, no refunds, and tenant boundary.
BEGIN;
RESET ROLE;
INSERT INTO creative_builder.daily_usage(scope,subject_id,usage_date,operation,reserved_units)
VALUES('owner','00000000-0000-4000-8000-000000000002',current_date,'analysis',9),('tenant','00000000-0000-0000-0000-000000000000',current_date,'analysis',99)
ON CONFLICT(scope,subject_id,usage_date,operation) DO UPDATE SET reserved_units=excluded.reserved_units;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000002"}',true);
SELECT (creative_builder.create_project('https://example.org/quota','quota-create-2')->>'project_id')::uuid AS p2 \gset
SELECT set_config('test.p2',:'p2',false);
SELECT creative_builder.reserve_job(:'p2',0,'analysis','quota-boundary-01',1,0) AS qres \gset
DO $$BEGIN PERFORM creative_builder.reserve_job(current_setting('test.p2')::uuid,0,'analysis','quota-overflow-01',1,0); RAISE EXCEPTION 'owner/concurrency cap exceeded'; EXCEPTION WHEN program_limit_exceeded OR object_not_in_prerequisite_state THEN NULL; END$$;
SELECT (:'qres'::jsonb->>'job_id')::uuid AS qjob,(:'qres'::jsonb->>'lease_token')::uuid AS qtoken,(:'qres'::jsonb->>'fencing_generation')::int AS qgen \gset
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.fail_job(:'qjob',:'qtoken',:qgen,:'p2','analysis',0,'scan_failed');
RESET ROLE;
DO $$BEGIN
 IF (SELECT reserved_units FROM creative_builder.daily_usage WHERE scope='owner' AND subject_id='00000000-0000-4000-8000-000000000002' AND operation='analysis' AND usage_date=current_date)<>10 THEN RAISE EXCEPTION 'failed job refunded'; END IF;
 IF (SELECT completed_units FROM creative_builder.daily_usage WHERE scope='owner' AND subject_id='00000000-0000-4000-8000-000000000002' AND operation='analysis' AND usage_date=current_date)<>0 THEN RAISE EXCEPTION 'failed job completed units'; END IF;
END$$;
ROLLBACK;

-- The ninth tenant-wide live lease and a second live lease for one owner are denied.
BEGIN;
RESET ROLE;
INSERT INTO creative_builder.projects(owner_id,normalized_url,creation_idempotency_key)
SELECT ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'https://concurrency.example/'||g,'concurrency-seed-'||g FROM generate_series(3,10) g;
INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,reserved_units,lease_token,lease_expires_at)
SELECT owner_id,id,'analysis','seed-live-job-'||right(owner_id::text,2),0,1,gen_random_uuid(),clock_timestamp()+interval '10 minutes'
FROM creative_builder.projects WHERE owner_id BETWEEN '00000000-0000-4000-8000-000000000003'::uuid AND '00000000-0000-4000-8000-000000000010'::uuid;
SELECT id AS p3 FROM creative_builder.projects WHERE owner_id='00000000-0000-4000-8000-000000000003' \gset
SELECT set_config('test.p3',:'p3',false);
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000003"}',true);
DO $$BEGIN PERFORM creative_builder.reserve_job(current_setting('test.p3')::uuid,0,'analysis','owner-live-denied',1,0); RAISE EXCEPTION 'second owner lease accepted'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END$$;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000011"}',true);
SELECT (creative_builder.create_project('https://concurrency.example/11','concurrency-create-11')->>'project_id')::uuid AS p11 \gset
SELECT set_config('test.p11',:'p11',false);
DO $$BEGIN PERFORM creative_builder.reserve_job(current_setting('test.p11')::uuid,0,'analysis','tenant-live-denied',1,0); RAISE EXCEPTION 'ninth tenant lease accepted'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END$$;
ROLLBACK;

-- Expired reclaim increments fencing; old fence cannot renew. Model deadline also expires before reclaim.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.reserve_job(:'p1',5,'revision','recovery-key-001',1,0,'portfolio',:'conceptset') AS rres \gset
SELECT (:'rres'::jsonb->>'job_id')::uuid AS rjob,(:'rres'::jsonb->>'lease_token')::uuid AS rtoken,(:'rres'::jsonb->>'fencing_generation')::int AS rgen \gset
SELECT set_config('test.rjob',:'rjob',false),set_config('test.rtoken',:'rtoken',false),set_config('test.rgen',:'rgen',false);
RESET ROLE;
UPDATE creative_builder.jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=:'rjob';
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.recover_job(:'rjob',:'p1','revision',5) AS recovered \gset
SELECT (:'recovered'::jsonb->>'lease_token')::uuid AS rtoken2,(:'recovered'::jsonb->>'fencing_generation')::int AS rgen2 \gset
DO $$BEGIN PERFORM creative_builder.renew_job(current_setting('test.rjob')::uuid,current_setting('test.rtoken')::uuid,current_setting('test.rgen')::int,current_setting('test.p1')::uuid,'revision',5,120); RAISE EXCEPTION 'stale fence renewed'; EXCEPTION WHEN serialization_failure THEN NULL; END$$;
SELECT creative_builder.transition_job(:'rjob',:'rtoken2',:rgen2,:'p1','revision',5,'model_started',30);
RESET ROLE;
UPDATE creative_builder.jobs SET lease_expires_at=clock_timestamp()-interval '2 seconds',model_deadline=clock_timestamp()-interval '1 second' WHERE id=:'rjob';
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.recover_job(:'rjob',:'p1','revision',5) AS recovered2 \gset
SELECT set_config('test.recovered2',:'recovered2',false);
DO $$BEGIN IF (current_setting('test.recovered2')::jsonb->>'attempts')::int<>3 THEN RAISE EXCEPTION 'attempt count wrong'; END IF; END$$;
SELECT creative_builder.fail_job(:'rjob',(:'recovered2'::jsonb->>'lease_token')::uuid,(:'recovered2'::jsonb->>'fencing_generation')::int,:'p1','revision',5,'provider_failed');
COMMIT;

-- Zero partial commit: malformed revised portfolio inserts neither messages nor set and leaves project/job unchanged.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.reserve_job(:'p1',5,'revision','bad-portfolio-001',1,0,'portfolio',:'conceptset') AS badres \gset
SELECT (:'badres'::jsonb->>'job_id')::uuid AS badjob,(:'badres'::jsonb->>'lease_token')::uuid AS badtoken,(:'badres'::jsonb->>'fencing_generation')::int AS badgen \gset
SELECT set_config('test.badjob',:'badjob',false),set_config('test.badtoken',:'badtoken',false),set_config('test.badgen',:'badgen',false);
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.transition_job(:'badjob',:'badtoken',:badgen,:'p1','revision',5,'model_started',60);
SELECT creative_builder.transition_job(:'badjob',:'badtoken',:badgen,:'p1','revision',5,'committing',NULL);
RESET ROLE;
DO $$DECLARE before_sets int;before_messages int; BEGIN
 SELECT count(*) INTO before_sets FROM creative_builder.concept_sets WHERE project_id=current_setting('test.p1')::uuid;
 SELECT count(*) INTO before_messages FROM creative_builder.messages WHERE project_id=current_setting('test.p1')::uuid;
 BEGIN
  PERFORM creative_builder.commit_revision(current_setting('test.badjob')::uuid,current_setting('test.badtoken')::uuid,current_setting('test.badgen')::int,current_setting('test.p1')::uuid,5,'portfolio',current_setting('test.conceptset')::uuid,NULL,'[]'::jsonb,'user','assistant');
  RAISE EXCEPTION 'invalid portfolio committed';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM creative_builder.concept_sets WHERE project_id=current_setting('test.p1')::uuid)<>before_sets OR (SELECT count(*) FROM creative_builder.messages WHERE project_id=current_setting('test.p1')::uuid)<>before_messages OR (SELECT revision FROM creative_builder.projects WHERE id=current_setting('test.p1')::uuid)<>5 OR (SELECT state FROM creative_builder.jobs WHERE id=current_setting('test.badjob')::uuid)<>'committing' THEN RAISE EXCEPTION 'partial commit observed'; END IF;
END$$;
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.fail_job(:'badjob',:'badtoken',:badgen,:'p1','revision',5,'invalid_result');
COMMIT;

-- A plan-targeted chat revision is unconfirmed and clears concepts, selection and nullable handoff links.
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
SELECT creative_builder.link_studio_output(:'p1',5,:'selection1','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
SELECT creative_builder.reserve_job(:'p1',6,'revision','plan-revision-001',1,0,'plan',:'plan3') AS pres \gset
SELECT (:'pres'::jsonb->>'job_id')::uuid AS pjob,(:'pres'::jsonb->>'lease_token')::uuid AS ptoken,(:'pres'::jsonb->>'fencing_generation')::int AS pgen \gset
SET LOCAL ROLE creative_builder_worker;
SELECT creative_builder.transition_job(:'pjob',:'ptoken',:pgen,:'p1','revision',6,'model_started',60);
SELECT creative_builder.transition_job(:'pjob',:'ptoken',:pgen,:'p1','revision',6,'committing',NULL);
SELECT creative_builder.commit_revision(:'pjob',:'ptoken',:pgen,:'p1',6,'plan',:'plan3',NULL,jsonb_build_object('assumptions',:'assumptions'::jsonb,'channels',:'channels'::jsonb),'Change audience','Updated assumptions') AS planrev \gset
SELECT set_config('test.planrev',:'planrev',false);
RESET ROLE;
DO $$DECLARE p creative_builder.projects; r creative_builder.plan_revisions; BEGIN
 SELECT * INTO p FROM creative_builder.projects WHERE id=current_setting('test.p1')::uuid; SELECT * INTO r FROM creative_builder.plan_revisions WHERE id=(current_setting('test.planrev')::jsonb->>'target_revision_id')::uuid;
 IF p.latest_concept_set_id IS NOT NULL OR p.latest_selection_id IS NOT NULL OR p.linked_studio_project_id IS NOT NULL OR p.linked_studio_version_id IS NOT NULL OR jsonb_array_length(r.confirmation_receipts)<>0 THEN RAISE EXCEPTION 'plan invalidation failed'; END IF;
END$$;
COMMIT;

-- Append-only enforcement and tombstone visibility.
DO $$BEGIN
 BEGIN UPDATE creative_builder.scans SET receipt='{}' WHERE project_id=current_setting('test.p1')::uuid; RAISE EXCEPTION 'scan mutated'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
 BEGIN DELETE FROM creative_builder.plan_revisions WHERE project_id=current_setting('test.p1')::uuid; RAISE EXCEPTION 'plan deleted'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
 BEGIN UPDATE creative_builder.selections SET concept_handle='changed' WHERE project_id=current_setting('test.p1')::uuid; RAISE EXCEPTION 'selection mutated'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END$$;
UPDATE creative_builder.projects SET tombstoned_at=clock_timestamp(),cleanup_state='pending_objects',cleanup_after=clock_timestamp()+interval '30 days' WHERE id=:'p1';
BEGIN;
SET LOCAL ROLE creative_builder_repository;
SELECT set_config('request.jwt.claims','{"role":"service_role","creative_builder_tenant":"eicagency","creative_builder_owner":"00000000-0000-4000-8000-000000000001"}',true);
DO $$BEGIN PERFORM creative_builder.read_project(current_setting('test.p1')::uuid); RAISE EXCEPTION 'tombstone visible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END$$;
ROLLBACK;
SQL

# Real parallel sessions verify that cross-operation owner/tenant capacity and
# identical idempotency keys serialize across serverless callers.
owner='00000000-0000-4000-8000-000000000012'
read -r owner_p1 owner_p2 < <(docker exec "$container" psql -qAt -U postgres -d postgres -F ' ' -c "WITH a AS (INSERT INTO creative_builder.projects(owner_id,normalized_url,creation_idempotency_key) VALUES('$owner','https://parallel.example/a','parallel-create-a') RETURNING id), b AS (INSERT INTO creative_builder.projects(owner_id,normalized_url,creation_idempotency_key) VALUES('$owner','https://parallel.example/b','parallel-create-b') RETURNING id) SELECT a.id,b.id FROM a,b")
claims="{\"role\":\"service_role\",\"creative_builder_tenant\":\"eicagency\",\"creative_builder_owner\":\"$owner\"}"
parallel_reserve(){
  local project="$1" operation="$2" key="$3" output="$4" sleep_sql="${5:-}"
  docker exec "$container" psql -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c "BEGIN; SET LOCAL ROLE creative_builder_repository; SELECT set_config('request.jwt.claims','${claims}',true); SELECT creative_builder.reserve_job('${project}',0,'${operation}','${key}',1,0)->>'job_id'; ${sleep_sql} COMMIT;" >"$output" 2>&1
}
set +e
parallel_reserve "$owner_p1" analysis parallel-owner-analysis /tmp/builder-owner-a.out 'SELECT pg_sleep(1);' & owner_a_pid=$!
sleep 0.1
parallel_reserve "$owner_p2" source_import parallel-owner-import /tmp/builder-owner-b.out '' & owner_b_pid=$!
wait "$owner_a_pid"; owner_a_rc=$?; wait "$owner_b_pid"; owner_b_rc=$?
set -e
if [ $(( (owner_a_rc==0) + (owner_b_rc==0) )) -ne 1 ]; then echo "ERROR: cross-operation owner concurrency race" >&2; cat /tmp/builder-owner-*.out >&2; exit 1; fi
docker exec "$container" psql -qAt -U postgres -d postgres -c "UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,error_code='cancelled' WHERE owner_id='$owner' AND state NOT IN ('completed','failed')" >/dev/null

# An expired recovery and a new reservation for the same owner share the same lock.
owner_recover_job=$(docker exec "$container" psql -qAt -U postgres -d postgres -c "INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,reserved_units,lease_token,lease_expires_at) VALUES('$owner','$owner_p1','analysis','owner-recover-race',0,1,gen_random_uuid(),clock_timestamp()-interval '1 second') RETURNING id")
parallel_recover(){
  local job="$1" project="$2" owner_id="$3" output="$4"
  local recover_claims="{\"role\":\"service_role\",\"creative_builder_tenant\":\"eicagency\",\"creative_builder_owner\":\"${owner_id}\"}"
  docker exec "$container" psql -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c "BEGIN; SET LOCAL ROLE creative_builder_worker; SELECT set_config('request.jwt.claims','${recover_claims}',true); SELECT creative_builder.recover_job('${job}','${project}','analysis',0)->>'job_id'; SELECT pg_sleep(0.5); COMMIT;" >"$output" 2>&1
}
set +e
parallel_recover "$owner_recover_job" "$owner_p1" "$owner" /tmp/builder-owner-recover.out & owner_recover_pid=$!
parallel_reserve "$owner_p2" source_import owner-recovery-compete /tmp/builder-owner-reserve.out '' & owner_reserve_pid=$!
wait "$owner_recover_pid"; owner_recover_rc=$?; wait "$owner_reserve_pid"; owner_reserve_rc=$?
set -e
if [ $(( (owner_recover_rc==0) + (owner_reserve_rc==0) )) -ne 1 ]; then echo "ERROR: owner recovery/reservation race" >&2; cat /tmp/builder-owner-recover.out /tmp/builder-owner-reserve.out >&2; exit 1; fi
docker exec "$container" psql -qAt -U postgres -d postgres -c "UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,error_code='cancelled' WHERE owner_id='$owner' AND state NOT IN ('completed','failed')" >/dev/null

# Seed seven tenant slots, then race two expired recoveries for the final slot.
docker exec -i "$container" psql -qAt -U postgres -d postgres <<'SQL' >/tmp/builder-tenant-projects.out
INSERT INTO creative_builder.projects(owner_id,normalized_url,creation_idempotency_key)
SELECT ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'https://tenant-race.example/'||g,'tenant-race-seed-'||g FROM generate_series(3,11) g;
INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,reserved_units,lease_token,lease_expires_at)
SELECT owner_id,id,'analysis','tenant-seed-'||right(owner_id::text,2),0,1,gen_random_uuid(),clock_timestamp()+interval '10 minutes' FROM creative_builder.projects WHERE normalized_url LIKE 'https://tenant-race.example/%' AND owner_id<'00000000-0000-4000-8000-000000000010'::uuid;
SELECT id,owner_id FROM creative_builder.projects WHERE normalized_url LIKE 'https://tenant-race.example/%' AND owner_id>='00000000-0000-4000-8000-000000000010'::uuid ORDER BY owner_id;
SQL
mapfile -t tenant_projects </tmp/builder-tenant-projects.out
p10="${tenant_projects[0]%%|*}"; p11="${tenant_projects[1]%%|*}"
tenant_recover_a=$(docker exec "$container" psql -qAt -U postgres -d postgres -c "INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,reserved_units,lease_token,lease_expires_at) VALUES('00000000-0000-4000-8000-000000000010','$p10','analysis','tenant-recover-a',0,1,gen_random_uuid(),clock_timestamp()-interval '1 second') RETURNING id")
tenant_recover_b=$(docker exec "$container" psql -qAt -U postgres -d postgres -c "INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,reserved_units,lease_token,lease_expires_at) VALUES('00000000-0000-4000-8000-000000000011','$p11','analysis','tenant-recover-b',0,1,gen_random_uuid(),clock_timestamp()-interval '1 second') RETURNING id")
set +e
parallel_recover "$tenant_recover_a" "$p10" 00000000-0000-4000-8000-000000000010 /tmp/builder-tenant-a.out & tenant_a_pid=$!
parallel_recover "$tenant_recover_b" "$p11" 00000000-0000-4000-8000-000000000011 /tmp/builder-tenant-b.out & tenant_b_pid=$!
wait "$tenant_a_pid"; tenant_a_rc=$?; wait "$tenant_b_pid"; tenant_b_rc=$?
set -e
if [ $(( (tenant_a_rc==0) + (tenant_b_rc==0) )) -ne 1 ]; then echo "ERROR: tenant recovery concurrency race" >&2; cat /tmp/builder-tenant-*.out >&2; exit 1; fi
docker exec "$container" psql -qAt -U postgres -d postgres -c "UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,error_code='cancelled' WHERE state NOT IN ('completed','failed')" >/dev/null

# Two exact retries race and both resolve to one durable reservation.
parallel_reserve "$owner_p1" analysis parallel-idempotency /tmp/builder-idem-a.out '' & idem_a_pid=$!
parallel_reserve "$owner_p1" analysis parallel-idempotency /tmp/builder-idem-b.out '' & idem_b_pid=$!
set +e; wait "$idem_a_pid"; idem_a_rc=$?; wait "$idem_b_pid"; idem_b_rc=$?; set -e
if [ "$idem_a_rc" -ne 0 ] || [ "$idem_b_rc" -ne 0 ]; then echo "ERROR: concurrent idempotency replay failed" >&2; cat /tmp/builder-idem-*.out >&2; exit 1; fi
idem_a="$(grep -E '^[0-9a-f-]{36}$' /tmp/builder-idem-a.out | head -1)"; idem_b="$(grep -E '^[0-9a-f-]{36}$' /tmp/builder-idem-b.out | head -1)"
if [ -z "$idem_a" ] || [ "$idem_a" != "$idem_b" ]; then echo "ERROR: idempotency race produced different jobs" >&2; cat /tmp/builder-idem-*.out >&2; exit 1; fi

echo "Creative Builder PostgreSQL clean install, collision, grants, ownership, parallel quotas, jobs, immutable history, idempotent Studio handoff, selection, invalidation, tombstone, and atomicity tests passed."
