begin;

-- pgTAP-independent verification for an already-applied atomic-refresh proposal.
-- Run as postgres in EIC only. All fixtures and pointer changes roll back.
do $$
declare
  v_client uuid := '90000000-0000-4000-8000-000000000001';
  v_run uuid;
  v_expired_run uuid;
  v_replacement_run uuid;
  v_blocked_run uuid;
  v_validated_run uuid;
  v_validated_replacement uuid;
  v_stale_source uuid := '91000000-0000-4000-8000-000000000003';
  v_stale_snapshot uuid := '91000000-0000-4000-8000-000000000004';
  v_source uuid := '90000000-0000-4000-8000-000000000004';
  v_task_source uuid := '90000000-0000-4000-8000-000000000014';
  v_failed_source uuid := '90000000-0000-4000-8000-000000000024';
  v_invocation uuid := '90000000-0000-4000-8000-000000000005';
  v_attempt uuid := '90000000-0000-4000-8000-000000000006';
  v_other_attempt uuid := '90000000-0000-4000-8000-000000000007';
  v_run_attempt uuid := '90000000-0000-4000-8000-00000000000c';
  v_other_run_attempt uuid := '90000000-0000-4000-8000-00000000000d';
  v_third_run_attempt uuid := '90000000-0000-4000-8000-00000000000e';
  v_snapshot uuid := '90000000-0000-8000-8000-000000000008';
  v_activation uuid := '90000000-0000-4000-8000-000000000020';
  v_later_activation uuid := '90000000-0000-4000-8000-000000000021';
  v_bad_activation uuid := '90000000-0000-4000-8000-000000000022';
  v_base timestamptz := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());
  v_grant jsonb; v_retry jsonb; v_snapshot_json jsonb; v_tasks jsonb; v_bundle jsonb; v_receipt jsonb; v_activation_receipt jsonb;
  v_idempotency text; v_identity text; v_identity_21 text; v_identity_22 text; v_failed boolean; v_proc regprocedure; v_role name;
  v_bad jsonb; v_bad_hash text; v_bad_id uuid;
  v_revision_id uuid := 'c89ee41c-d09a-8a8e-a481-911278e20333';
  v_revision_hash text := 'c89ee41cd09a2a8e2481911278e2033377a98eecc54942334e98bf4c66bf6a8e';
  v_revision jsonb := $revision${"schemaVersion":2,"calculationVersion":"verify-v2","sourceContractVersion":"verify-s2","clients":[{"clientId":"90000000-0000-4000-8000-000000000001","clientKey":"atomic_verify_fixture","displayName":"Atomic verify fixture","dashboardHref":"/dashboard/atomic_verify_fixture","reportingTimezone":"America/Phoenix","clickupListIds":[],"marginAliases":[],"configStatus":"approved","fixedValues":{"monthlyBudget":100,"monthlyHoursAllotment":10},"metrics":[{"key":"budget_pacing","label":"budget_pacing","adapterKey":"approved.budget_pacing","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":10,"yellowThreshold":20,"sourceKeys":["paid"]},{"key":"hours","label":"hours","adapterKey":"approved.hours","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":80,"yellowThreshold":100,"sourceKeys":["paid"]},{"key":"margin","label":"margin","adapterKey":"approved.margin","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":50,"yellowThreshold":25,"sourceKeys":["paid"]},{"key":"north_star","label":"north_star","adapterKey":"approved.north_star","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":10,"yellowThreshold":5,"sourceKeys":["paid"]},{"key":"overdue_tasks","label":"overdue_tasks","adapterKey":"approved.overdue_tasks","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":0,"yellowThreshold":1,"sourceKeys":["paid"]}],"sources":[{"sourceKey":"failed","requestFingerprint":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","permittedFactFields":[],"freshnessPolicy":{"maximumLagDays":0},"provider":"supabase","project":"eic","relation":"failed_facts"},{"sourceKey":"paid","requestFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","permittedFactFields":["currentRows","fulfillmentCost","hoursUsed","monthSpend","overdueTaskCount","previousRows","revenue"],"freshnessPolicy":{"maximumLagDays":3},"provider":"supabase","project":"eic","relation":"budget_pacing_facts"},{"sourceKey":"tasks","requestFingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","permittedFactFields":["hoursUsed","overdueTaskCount"],"freshnessPolicy":{"maximumLagDays":0},"provider":"clickup","endpointFamily":"team-time-entries-and-overdue-tasks","permitsTasks":true,"allowedListIds":["1"]}]}]}$revision$::jsonb;
  v_later_revision_id uuid := 'ffe1613d-263a-80df-af44-b18e62290762';
  v_later_revision_hash text := 'ffe1613d263a90df6f44b18e62290762aa63c9194114ae22edf9e3632b791c5e';
  v_later_revision jsonb := $revision${"schemaVersion":2,"calculationVersion":"verify-v2","sourceContractVersion":"verify-s2","clients":[{"clientId":"90000000-0000-4000-8000-000000000001","clientKey":"atomic_verify_fixture","displayName":"Atomic verify fixture later","dashboardHref":"/dashboard/atomic_verify_fixture","reportingTimezone":"America/Phoenix","clickupListIds":[],"marginAliases":[],"configStatus":"approved","fixedValues":{"monthlyBudget":100,"monthlyHoursAllotment":10},"metrics":[{"key":"budget_pacing","label":"budget_pacing","adapterKey":"approved.budget_pacing","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":10,"yellowThreshold":20,"sourceKeys":["paid"]},{"key":"hours","label":"hours","adapterKey":"approved.hours","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":80,"yellowThreshold":100,"sourceKeys":["paid"]},{"key":"margin","label":"margin","adapterKey":"approved.margin","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":50,"yellowThreshold":25,"sourceKeys":["paid"]},{"key":"north_star","label":"north_star","adapterKey":"approved.north_star","required":true,"weight":20,"direction":"higher_is_better","greenThreshold":10,"yellowThreshold":5,"sourceKeys":["paid"]},{"key":"overdue_tasks","label":"overdue_tasks","adapterKey":"approved.overdue_tasks","required":true,"weight":20,"direction":"lower_is_better","greenThreshold":0,"yellowThreshold":1,"sourceKeys":["paid"]}],"sources":[{"sourceKey":"failed","requestFingerprint":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","permittedFactFields":[],"freshnessPolicy":{"maximumLagDays":0},"provider":"supabase","project":"eic","relation":"failed_facts"},{"sourceKey":"paid","requestFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","permittedFactFields":["currentRows","fulfillmentCost","hoursUsed","monthSpend","overdueTaskCount","previousRows","revenue"],"freshnessPolicy":{"maximumLagDays":3},"provider":"supabase","project":"eic","relation":"budget_pacing_facts"},{"sourceKey":"tasks","requestFingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","permittedFactFields":["hoursUsed","overdueTaskCount"],"freshnessPolicy":{"maximumLagDays":0},"provider":"clickup","endpointFamily":"team-time-entries-and-overdue-tasks","permitsTasks":true,"allowedListIds":["1"]}]}]}$revision$::jsonb;
begin
  if to_regclass('public.master_spartaco') is null or to_regprocedure('public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)') is null then
    raise exception 'VERIFY FAILED: EIC atomic-refresh functions are not installed';
  end if;

  update public.client_health_clients set active=false where active;
  insert into public.client_health_clients(id,client_key,display_name,active,config_status,reporting_timezone)
    values(v_client,'atomic_verify_fixture','Atomic verify mutable authoring',true,'approved','America/Phoenix');

  -- Runtime is blocked until an operator has explicitly activated a staged revision.
  delete from private.client_health_active_config_revision where singleton;
  if public.client_health_get_active_config_revision() is not null then raise exception 'VERIFY FAILED: empty active pointer returned content'; end if;
  v_identity:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotDate','2026-08-20','calculationVersion','verify-v2','sourceContractVersion','verify-s2')),'UTF8'),'sha256'),'hex');
  v_run:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(pg_catalog.jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity,'runAttemptId',v_run_attempt::text)),'UTF8'),'sha256'),'hex'));
  v_failed:=false; begin perform public.client_health_create_refresh_run(v_run,v_revision_id,v_revision_hash,v_identity,v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: runtime accepted a refresh without an active revision'; end if;

  -- Reject v1, arbitrary keys, secret-bearing keys, and malformed v2 content using each candidate's exact hash-derived identity.
  foreach v_bad in array array[
    '{"schemaVersion":1,"clients":[]}'::jsonb,
    pg_catalog.jsonb_set(v_revision,'{clients,0,arbitrary}','true'::jsonb),
    pg_catalog.jsonb_set(v_revision,'{clients,0,apiToken}','"forbidden"'::jsonb),
    pg_catalog.jsonb_set(v_revision,'{clients,0,metrics}','[]'::jsonb)
  ] loop
    v_bad_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(v_bad),'UTF8'),'sha256'),'hex'); v_bad_id:=public.client_health_revision_id(v_bad_hash);
    v_failed:=false; begin perform private.client_health_stage_config_revision(v_bad_id,v_bad_hash,v_bad); exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'VERIFY FAILED: invalid configuration revision was staged: %',v_bad; end if;
  end loop;

  v_receipt:=private.client_health_stage_config_revision(v_revision_id,v_revision_hash,v_revision);
  if private.client_health_stage_config_revision(v_revision_id,v_revision_hash,v_revision)<>v_receipt or v_receipt->'content'<>v_revision then
    raise exception 'VERIFY FAILED: exact stage retry changed its receipt';
  end if;
  v_failed:=false; begin perform private.client_health_stage_config_revision(v_revision_id,v_revision_hash,pg_catalog.jsonb_set(v_revision,'{clients,0,displayName}','"Tampered"')); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: revision collision/hash mismatch was accepted'; end if;
  v_failed:=false; begin perform private.client_health_stage_config_revision(v_revision_id,repeat('0',64),v_revision); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: mismatched revision identity was accepted'; end if;
  perform private.client_health_stage_config_revision(v_later_revision_id,v_later_revision_hash,v_later_revision);

  v_activation_receipt:=private.client_health_activate_config_revision(v_activation,v_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Verify reviewed v2 operator activation',null);
  if private.client_health_activate_config_revision(v_activation,v_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Verify reviewed v2 operator activation',null)<>v_activation_receipt then
    raise exception 'VERIFY FAILED: exact activation retry changed provenance receipt';
  end if;
  v_failed:=false; begin perform private.client_health_activate_config_revision(v_bad_activation,v_later_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Reject stale activation CAS','90000000-0000-4000-8000-000000000099'); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: activation compare-and-set mismatch was accepted'; end if;
  if public.client_health_get_active_config_revision()->'revision'<>pg_catalog.jsonb_build_object('id',v_revision_id,'hash',v_revision_hash,'content',v_revision)
     or public.client_health_get_active_config_revision()->'activation'->>'activationId'<>v_activation::text then raise exception 'VERIFY FAILED: active getter is not exact'; end if;

  -- Wrong revision/hash/identity/run UUID/future date/caller versions are all rejected.
  foreach v_bad in array array[
    pg_catalog.jsonb_build_object('kind','wrong-revision'),pg_catalog.jsonb_build_object('kind','wrong-hash'),pg_catalog.jsonb_build_object('kind','wrong-identity'),
    pg_catalog.jsonb_build_object('kind','wrong-run'),pg_catalog.jsonb_build_object('kind','future-date'),pg_catalog.jsonb_build_object('kind','wrong-versions')
  ] loop
    v_failed:=false;
    begin
      if v_bad->>'kind'='wrong-revision' then perform public.client_health_create_refresh_run(v_run,v_later_revision_id,v_later_revision_hash,v_identity,v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base);
      elsif v_bad->>'kind'='wrong-hash' then perform public.client_health_create_refresh_run(v_run,v_revision_id,repeat('f',64),v_identity,v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base);
      elsif v_bad->>'kind'='wrong-identity' then perform public.client_health_create_refresh_run(v_run,v_revision_id,v_revision_hash,repeat('f',64),v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base);
      elsif v_bad->>'kind'='wrong-run' then perform public.client_health_create_refresh_run('90000000-0000-4000-8000-000000000099',v_revision_id,v_revision_hash,v_identity,v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base);
      elsif v_bad->>'kind'='future-date' then perform public.client_health_create_refresh_run(v_run,v_revision_id,v_revision_hash,v_identity,v_run_attempt,(pg_catalog.clock_timestamp() at time zone 'America/Phoenix')::date+1,'verify-v2','verify-s2',v_base);
      else perform public.client_health_create_refresh_run(v_run,v_revision_id,v_revision_hash,v_identity,v_run_attempt,date '2026-08-20','caller-version','caller-contract',v_base); end if;
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'VERIFY FAILED: malformed refresh identity case accepted: %',v_bad->>'kind'; end if;
  end loop;

  v_receipt:=public.client_health_create_refresh_run(v_run,v_revision_id,v_revision_hash,v_identity,v_run_attempt,date '2026-08-20','verify-v2','verify-s2',v_base);
  if v_receipt->>'calculationVersion'<>'verify-v2' or v_receipt->>'sourceContractVersion'<>'verify-s2' or v_receipt->>'refreshIdentityHash'<>v_identity then
    raise exception 'VERIFY FAILED: refresh receipt versions/identity were not revision-derived';
  end if;
  if (select config_revision_activation_id from public.client_health_refresh_runs where id=v_run)<>v_activation then raise exception 'VERIFY FAILED: run did not pin activation provenance'; end if;

  v_grant:=public.client_health_acquire_refresh_lease(v_run,v_invocation,v_attempt,5000);
  if v_grant is null or (v_grant->>'fencingToken')::bigint<>1 or extract(epoch from ((v_grant->>'leaseExpiresAt')::timestamptz-(v_grant->>'leaseGrantedAt')::timestamptz))<>5 then raise exception 'VERIFY FAILED: first lease grant is invalid'; end if;
  v_retry:=public.client_health_acquire_refresh_lease(v_run,v_invocation,v_attempt,5000);
  if v_retry<>v_grant then raise exception 'VERIFY FAILED: exact lease retry changed grant'; end if;
  v_failed:=false; begin perform public.client_health_acquire_refresh_lease(v_run,v_invocation,v_other_attempt,5000); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: second claim attempt also won'; end if;
  v_failed:=false; begin perform public.client_health_renew_refresh_lease(v_run,v_invocation,v_attempt,2,5000); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: stale fence renewal was accepted'; end if;

  perform public.client_health_create_source_run(v_source,v_run,v_client,'paid',date '2026-08-01',date '2026-08-20',v_base,v_invocation,v_attempt,1);
  foreach v_bad in array array[
    pg_catalog.jsonb_build_object('kind','null-fingerprint'),
    pg_catalog.jsonb_build_object('kind','wrong-fingerprint'),
    pg_catalog.jsonb_build_object('kind','forged-provider'),
    pg_catalog.jsonb_build_object('kind','extra-evidence-key')
  ] loop
    v_failed:=false; begin
      perform public.client_health_complete_source_run(v_source,v_run,'succeeded',v_base+interval '1 second',date '2026-08-20',1,
        case when v_bad->>'kind'='null-fingerprint' then null when v_bad->>'kind'='wrong-fingerprint' then repeat('f',64) else repeat('a',64) end,
        case when v_bad->>'kind'='forged-provider' then jsonb_build_object('sourceKey','paid','provider','google-sheets','spreadsheetId','forged','range','forged','valueRenderOption','UNFORMATTED_VALUE','dateTimeRenderOption','FORMATTED_STRING','sourceContractVersion','verify-s2','approvedClientAliasHash',repeat('a',64),'requestFingerprint',repeat('a',64),'matchedRowCount',1)
             else jsonb_build_object('sourceKey','paid','provider','supabase','project','eic','relation','budget_pacing_facts','retrievedAt',pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceContractVersion','verify-s2','requestFingerprint',repeat('a',64),'selectedRowCount',1)
               || case when v_bad->>'kind'='extra-evidence-key' then '{"forged":true}'::jsonb else '{}'::jsonb end end,
        null,null,v_invocation,v_attempt,1);
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'VERIFY FAILED: wrong/null fingerprint or forged provider evidence was accepted: %',v_bad->>'kind'; end if;
  end loop;
  foreach v_bad in array array[
    jsonb_build_object('kind','numeric-count-string'),
    jsonb_build_object('kind','nonfinite-retrievedAt'),
    jsonb_build_object('kind','finished-before-started'),
    jsonb_build_object('kind','failed-with-count'),
    jsonb_build_object('kind','oversized-error')
  ] loop
    v_failed:=false; begin
      perform public.client_health_complete_source_run(v_source,v_run,
        case when v_bad->>'kind' in ('failed-with-count','oversized-error') then 'failed' else 'succeeded' end,
        case when v_bad->>'kind'='finished-before-started' then v_base-interval '1 second' else v_base+interval '1 second' end,
        case when v_bad->>'kind' in ('failed-with-count','oversized-error') then null else date '2026-08-20' end,
        case when v_bad->>'kind'='oversized-error' then null else 1 end,repeat('a',64),
        jsonb_build_object('sourceKey','paid','provider','supabase','project','eic','relation','budget_pacing_facts',
          'retrievedAt',case when v_bad->>'kind'='nonfinite-retrievedAt' then 'infinity' else pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
          'sourceContractVersion','verify-s2','requestFingerprint',repeat('a',64),
          'selectedRowCount',case when v_bad->>'kind'='numeric-count-string' then '"1"'::jsonb when v_bad->>'kind'='oversized-error' then 'null'::jsonb else '1'::jsonb end),
        case when v_bad->>'kind' in ('failed-with-count','oversized-error') then 'query_failed' else null end,
        case when v_bad->>'kind'='oversized-error' then repeat('x',2001) when v_bad->>'kind'='failed-with-count' then 'Sanitized failure.' else null end,
        v_invocation,v_attempt,1);
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'VERIFY FAILED: malformed evidence type/time/status/error bound was accepted: %',v_bad->>'kind'; end if;
  end loop;
  perform pg_catalog.set_config('TimeZone','America/Los_Angeles',true);
  perform public.client_health_complete_source_run(v_source,v_run,'succeeded',v_base+interval '1 second',date '2026-08-20',1,repeat('a',64),
    jsonb_build_object('sourceKey','paid','provider','supabase','project','eic','relation','budget_pacing_facts','retrievedAt',pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceContractVersion','verify-s2','requestFingerprint',repeat('a',64),'selectedRowCount',1),null,null,v_invocation,v_attempt,1);
  if (select data_through from public.client_health_source_runs where id=v_source) is distinct from timestamptz '2026-08-20 00:00:00+00' then raise exception 'VERIFY FAILED: source data-through is not UTC midnight'; end if;
  perform pg_catalog.set_config('TimeZone','UTC',true);
  perform public.client_health_create_source_run(v_task_source,v_run,v_client,'tasks',date '2026-08-01',date '2026-08-20',v_base,v_invocation,v_attempt,1);
  foreach v_bad in array array[jsonb_build_object('kind','numeric-duration'),jsonb_build_object('kind','noncanonical-duration'),jsonb_build_object('kind','mixed-null-counts')] loop
    v_failed:=false; begin
      perform public.client_health_complete_source_run(v_task_source,v_run,'succeeded',v_base+interval '1 second',date '2026-08-20',3,repeat('b',64),
        jsonb_build_object('sourceKey','tasks','provider','clickup','endpointFamily','team-time-entries-and-overdue-tasks','retrievedAt',pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceContractVersion','verify-s2','requestFingerprint',repeat('b',64),
          'timeEntryCount',case when v_bad->>'kind'='mixed-null-counts' then 'null'::jsonb else '2'::jsonb end,
          'totalDurationMs',case when v_bad->>'kind'='numeric-duration' then '1000'::jsonb when v_bad->>'kind'='noncanonical-duration' then '"01000"'::jsonb else '"1000"'::jsonb end,
          'overdueTaskCount','1'::jsonb),null,null,v_invocation,v_attempt,1);
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'VERIFY FAILED: malformed ClickUp count/duration evidence was accepted: %',v_bad->>'kind'; end if;
  end loop;
  perform public.client_health_complete_source_run(v_task_source,v_run,'succeeded',v_base+interval '1 second',date '2026-08-20',3,repeat('b',64),
    jsonb_build_object('sourceKey','tasks','provider','clickup','endpointFamily','team-time-entries-and-overdue-tasks','retrievedAt',pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceContractVersion','verify-s2','requestFingerprint',repeat('b',64),'timeEntryCount',2,'totalDurationMs','1000','overdueTaskCount',1),null,null,v_invocation,v_attempt,1);
  perform public.client_health_create_source_run(v_failed_source,v_run,v_client,'failed',date '2026-08-01',date '2026-08-20',v_base,v_invocation,v_attempt,1);
  perform public.client_health_complete_source_run(v_failed_source,v_run,'failed',v_base+interval '1 second',null,null,repeat('c',64),
    jsonb_build_object('sourceKey','failed','provider','supabase','project','eic','relation','failed_facts','retrievedAt',pg_catalog.to_char(v_base at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'sourceContractVersion','verify-s2','requestFingerprint',repeat('c',64),'selectedRowCount',null),'query_failed','Sanitized failure.',v_invocation,v_attempt,1);

  v_snapshot_json:=pg_catalog.jsonb_build_object('refreshRunId',v_run::text,'clientId',v_client::text,'snapshotDate','2026-08-20','dataThrough','2026-08-20','budget',100,'monthSpend',50,'expectedSpend',60,'currentWindowStart','2026-08-14','currentWindowEnd','2026-08-20','currentSpend',10,'currentResultCount',2,'currentCostPerResult',5,'previousWindowStart','2026-08-07','previousWindowEnd','2026-08-13','previousSpend',9,'previousResultCount',1,'previousCostPerResult',9,'hoursUsed',2,'hoursAllotted',10,'projectedHours',4,'overdueTaskCount',2,'revenue',20,'fulfillmentCost',5,'marginPercent',75,'dimensionStatuses',pg_catalog.jsonb_build_object('budget_pacing',jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),'north_star',jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),'hours',jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),'overdue_tasks',jsonb_build_object('status','watch','value',1,'reason','Verified.','required',true,'weight',20),'margin',jsonb_build_object('status','healthy','value',75,'reason','Verified.','required',true,'weight',20)),'sourceStatuses',pg_catalog.jsonb_build_object('failed',jsonb_build_object('status','failed','dataThrough',null,'stale',true,'rowCount',null),'paid',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',1),'tasks',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',3)),'overallStatus','watch','overallScore',80,'reasons',pg_catalog.jsonb_build_array('Verified fixture.'),'calculatedAt',pg_catalog.to_char((v_base+interval '2 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'evidenceHash',repeat('a',64));

  -- Isolated source-reconciliation negatives: zero tasks ensure the reviewer exact
  -- exploit cannot be hidden behind malformed task timestamps, duplicate IDs, or ranks.
  foreach v_bad in array array[
    jsonb_build_object('kind','succeeded-paid-represented-failed','status',jsonb_build_object('status','failed','dataThrough',null,'stale',true,'rowCount',null)),
    jsonb_build_object('kind','committed-failed-represented-succeeded','status',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',0)),
    jsonb_build_object('kind','wrong-paid-dataThrough','status',jsonb_build_object('status','succeeded','dataThrough','2026-08-19','stale',false,'rowCount',1)),
    jsonb_build_object('kind','wrong-paid-rowCount','status',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',2)),
    jsonb_build_object('kind','wrong-paid-stale','status',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',true,'rowCount',1))
  ] loop
    v_tasks:='[]'::jsonb;
    v_bad_hash:=case when v_bad->>'kind'='committed-failed-represented-succeeded' then 'failed' else 'paid' end;
    v_snapshot_json:=pg_catalog.jsonb_set(pg_catalog.jsonb_set(v_snapshot_json,'{overdueTaskCount}','0'::jsonb),array['sourceStatuses',v_bad_hash],v_bad->'status');
    v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex');
    v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
    v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end;
    if not v_failed or exists(select 1 from public.client_health_snapshots where id=v_snapshot) or exists(select 1 from public.client_health_snapshot_tasks where snapshot_id=v_snapshot) then
      raise exception 'VERIFY FAILED: isolated source reconciliation contradiction was accepted or persisted: %',v_bad->>'kind';
    end if;
    -- Restore the otherwise-valid canonical source map before the next contradiction.
    v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{sourceStatuses}',jsonb_build_object('failed',jsonb_build_object('status','failed','dataThrough',null,'stale',true,'rowCount',null),'paid',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',1),'tasks',jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',3)));
  end loop;

  -- Isolated task authorization: valid timestamp/ID/rank, but an unauthorized list.
  v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{overdueTaskCount}','1'::jsonb);
  v_tasks:=jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','UNAUTH1','listId','999','taskName','Unauthorized list task','taskUrl','https://app.clickup.com/t/UNAUTH1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex'); v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end;
  if not v_failed or exists(select 1 from public.client_health_snapshots where id=v_snapshot) or exists(select 1 from public.client_health_snapshot_tasks where snapshot_id=v_snapshot) then raise exception 'VERIFY FAILED: unauthorized ClickUp list task was accepted atomically'; end if;

  -- A permitsTasks=false revision candidate cannot authorize even an otherwise valid task.
  v_failed:=false; begin perform public.client_health_assert_task_authorized(pg_catalog.jsonb_set(v_revision,'{clients,0,sources,2,permitsTasks}','false'::jsonb),v_run,v_client,'1'); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: permitsTasks=false ClickUp revision candidate authorized tasks'; end if;

  -- A partial/failed ClickUp source cannot authorize task persistence. Keep snapshot
  -- reconciliation exact so authorization is the first and only rejection cause.
  update public.client_health_source_runs set run_status='partial',error_code='partial_page',error_message='Sanitized partial page.' where id=v_task_source;
  v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{sourceStatuses,tasks,status}','"partial"'::jsonb);
  v_tasks:=jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','PARTIAL1','listId','1','taskName','Partial source task','taskUrl','https://app.clickup.com/t/PARTIAL1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex'); v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end;
  if not v_failed or exists(select 1 from public.client_health_snapshots where id=v_snapshot) or exists(select 1 from public.client_health_snapshot_tasks where snapshot_id=v_snapshot) then raise exception 'VERIFY FAILED: nonsucceeded ClickUp task source authorized tasks'; end if;
  update public.client_health_source_runs set run_status='succeeded',error_code=null,error_message=null where id=v_task_source;
  v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{sourceStatuses,tasks,status}','"succeeded"'::jsonb);

  -- Preserve malformed timestamp, duplicate-ID, and rank/count checks below.
  v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{overdueTaskCount}','2'::jsonb);
  v_tasks:=pg_catalog.jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/TASK1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1),jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK2','listId','1','taskName','Task two','taskUrl','https://app.clickup.com/t/TASK2','dueAt','not-a-timestamp','displayRank',2));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex');
  v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end;
  if not v_failed or exists(select 1 from public.client_health_snapshots where id=v_snapshot) or exists(select 1 from public.client_health_snapshot_tasks where snapshot_id=v_snapshot) then raise exception 'VERIFY FAILED: bad-task bundle was not atomically rolled back'; end if;

  v_tasks:=pg_catalog.jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','DUP1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/DUP1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1),jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','DUP1','listId','1','taskName','Task two','taskUrl','https://app.clickup.com/t/DUP1','dueAt','2026-08-20T13:00:00.000Z','displayRank',2));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex'); v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end; if not v_failed then raise exception 'VERIFY FAILED: duplicate task IDs were accepted'; end if;

  v_tasks:=pg_catalog.jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','RANK1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/RANK1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1),jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','RANK2','listId','1','taskName','Task two','taskUrl','https://app.clickup.com/t/RANK2','dueAt','2026-08-20T13:00:00.000Z','displayRank',1));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex'); v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed:=false; begin perform public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); exception when others then v_failed:=true; end; if not v_failed then raise exception 'VERIFY FAILED: noncanonical task ranks were accepted'; end if;

  v_snapshot_json:=pg_catalog.jsonb_set(v_snapshot_json,'{overdueTaskCount}','1'::jsonb); v_tasks:=pg_catalog.jsonb_build_array(jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/TASK1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1));
  v_idempotency:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)),'UTF8'),'sha256'),'hex'); v_bundle:=jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_receipt:=public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1); if public.client_health_persist_snapshot_bundle(v_bundle,v_invocation,v_attempt,1)<>v_receipt then raise exception 'VERIFY FAILED: exact snapshot retry changed receipt'; end if;

  -- Privileged pre-validation corruption is possible by design while collecting,
  -- but validate/publish must re-prove committed source evidence and snapshot keys.
  update public.client_health_source_runs set evidence=pg_catalog.jsonb_set(evidence,'{provider}','"google-sheets"'::jsonb) where id=v_source;
  v_failed:=false; begin perform public.client_health_validate_refresh_run(v_run,v_base+interval '3 seconds',repeat('c',64),v_invocation,v_attempt,1); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: pre-validation committed source evidence corruption escaped integrity revalidation'; end if;
  update public.client_health_source_runs set evidence=pg_catalog.jsonb_set(evidence,'{provider}','"supabase"'::jsonb) where id=v_source;
  update public.client_health_snapshots set source_statuses=source_statuses-'failed' where id=v_snapshot;
  v_failed:=false; begin perform public.client_health_assert_refresh_integrity(v_run); exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: pre-validation snapshot source key corruption escaped exact-key integrity validation'; end if;
  update public.client_health_snapshots set source_statuses=v_snapshot_json->'sourceStatuses' where id=v_snapshot;

  update public.client_health_clients set active=false,display_name='Mutable edit before validation' where id=v_client;
  insert into public.client_health_clients(id,client_key,display_name,active,config_status,reporting_timezone) values('90000000-0000-4000-8000-000000000090','late_authoring_fixture','Late mutable authoring member',true,'configuration_required','America/Phoenix');
  perform public.client_health_validate_refresh_run(v_run,v_base+interval '3 seconds',repeat('c',64),v_invocation,v_attempt,1);
  v_failed:=false; begin perform public.client_health_create_source_run('90000000-0000-4000-8000-000000000009',v_run,v_client,'late',null,null,v_base+interval '4 seconds',v_invocation,v_attempt,1); exception when others then v_failed:=true; end; if not v_failed then raise exception 'VERIFY FAILED: validated refresh accepted source mutation'; end if;
  update public.client_health_clients set display_name='Mutable edit between validate and publish' where id=v_client;
  perform public.client_health_publish_refresh_run(v_run,v_base+interval '4 seconds',v_invocation,v_attempt,1);
  v_failed:=false; begin update public.client_health_source_runs set evidence=evidence||'{"forged":true}'::jsonb where id=v_source; exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'VERIFY FAILED: published source immutability trigger allowed privileged corruption'; end if;
  if public.client_health_get_refresh_lease(v_run) is not null then raise exception 'VERIFY FAILED: terminal lease remains visible'; end if;
  update public.client_health_clients set display_name='Mutable edit after publish' where id=v_client;
  if not exists(select 1 from public.client_health_latest where id=v_snapshot and refresh_run_id=v_run and config_revision_id=v_revision_id and config_revision_hash=v_revision_hash and revision_client_id=v_client::text and revision_client_key='atomic_verify_fixture' and revision_display_name='Atomic verify fixture' and revision_dashboard_href='/dashboard/atomic_verify_fixture' and revision_config_status='approved' and revision_reporting_timezone='America/Phoenix' and revision_monthly_hours_allotment=10 and revision_clickup_list_ids='[]'::jsonb and revision_margin_aliases='[]'::jsonb and pg_catalog.jsonb_array_length(revision_metric_config)=5) then raise exception 'VERIFY FAILED: published snapshot is not exact safe latest-visible revision'; end if;
  perform public.client_health_release_refresh_lease(v_run,v_invocation,v_attempt,1,(v_grant->>'leaseGrantedAt')::timestamptz,(v_grant->>'leaseExpiresAt')::timestamptz);
  perform public.client_health_release_refresh_lease(v_run,v_invocation,v_attempt,1,(v_grant->>'leaseGrantedAt')::timestamptz,(v_grant->>'leaseExpiresAt')::timestamptz);

  -- A later activation changes only the pointer; the completed run remains pinned to its original activation.
  perform private.client_health_activate_config_revision(v_later_activation,v_later_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Verify later activation isolation',v_activation);
  if public.client_health_get_active_config_revision()->'revision'->>'id'<>v_later_revision_id::text or (select config_revision_activation_id from public.client_health_refresh_runs where id=v_run)<>v_activation or public.client_health_get_refresh_run(v_run)->>'configRevisionId'<>v_revision_id::text then raise exception 'VERIFY FAILED: later activation contaminated existing run provenance'; end if;

  -- Reactivate the fixture revision for lifecycle supersession checks.
  perform private.client_health_activate_config_revision('90000000-0000-4000-8000-000000000023',v_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Restore fixture activation',v_later_activation);
  v_identity_21:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotDate','2026-08-21','calculationVersion','verify-v2','sourceContractVersion','verify-s2')),'UTF8'),'sha256'),'hex');
  v_expired_run:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity_21,'runAttemptId',v_other_run_attempt::text)),'UTF8'),'sha256'),'hex'));
  perform public.client_health_create_refresh_run(v_expired_run,v_revision_id,v_revision_hash,v_identity_21,v_other_run_attempt,date '2026-08-21','verify-v2','verify-s2',v_base); perform public.client_health_acquire_refresh_lease(v_expired_run,v_invocation,v_other_attempt,1);
  insert into public.client_health_source_runs(id,refresh_run_id,client_id,source_key,run_status,started_at,finished_at,evidence) values(v_stale_source,v_expired_run,v_client,'paid','succeeded',v_base,v_base+interval '1 millisecond','{}'::jsonb);
  insert into public.client_health_snapshots(id,refresh_run_id,client_id,snapshot_date,overall_status,config_revision_id,config_revision_hash,persistence_evidence_hash,persistence_idempotency_key) values(v_stale_snapshot,v_expired_run,v_client,date '2026-08-21','healthy',v_revision_id,v_revision_hash,repeat('3',64),repeat('4',64));
  perform pg_catalog.pg_sleep(0.01); if public.client_health_get_refresh_lease(v_expired_run) is not null then raise exception 'VERIFY FAILED: expired lease is visible'; end if;
  v_replacement_run:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity_21,'runAttemptId',v_third_run_attempt::text)),'UTF8'),'sha256'),'hex'));
  perform public.client_health_create_refresh_run(v_replacement_run,v_revision_id,v_revision_hash,v_identity_21,v_third_run_attempt,date '2026-08-21','verify-v2','verify-s2',v_base+interval '1 second');
  if not exists(select 1 from public.client_health_refresh_runs where id=v_expired_run and run_status='failed' and error_code='refresh_attempt_superseded' and lease_invocation_id is null) or (select count(*) from public.client_health_refresh_runs where refresh_identity_hash=v_identity_21 and run_status in ('collecting','validated'))<>1 or not exists(select 1 from public.client_health_source_runs where id=v_stale_source) or not exists(select 1 from public.client_health_snapshots where id=v_stale_snapshot) or exists(select 1 from public.client_health_latest where id=v_stale_snapshot) then raise exception 'VERIFY FAILED: stale supersession/audit behavior is invalid'; end if;
  perform public.client_health_acquire_refresh_lease(v_replacement_run,v_invocation,v_attempt,5000);
  v_blocked_run:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity_21,'runAttemptId','90000000-0000-4000-8000-00000000000f')),'UTF8'),'sha256'),'hex'));
  v_failed:=false; begin perform public.client_health_create_refresh_run(v_blocked_run,v_revision_id,v_revision_hash,v_identity_21,'90000000-0000-4000-8000-00000000000f',date '2026-08-21','verify-v2','verify-s2',v_base+interval '2 seconds'); exception when others then v_failed:=true; end; if not v_failed then raise exception 'VERIFY FAILED: active lease did not block fresh attempt'; end if;

  v_identity_22:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('configRevisionId',v_revision_id::text,'configRevisionHash',v_revision_hash,'snapshotDate','2026-08-22','calculationVersion','verify-v2','sourceContractVersion','verify-s2')),'UTF8'),'sha256'),'hex');
  v_validated_run:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity_22,'runAttemptId','91000000-0000-4000-8000-000000000005')),'UTF8'),'sha256'),'hex'));
  perform public.client_health_create_refresh_run(v_validated_run,v_revision_id,v_revision_hash,v_identity_22,'91000000-0000-4000-8000-000000000005',date '2026-08-22','verify-v2','verify-s2',v_base); update public.client_health_refresh_runs set run_status='validated',validated_at=v_base+interval '1 millisecond' where id=v_validated_run;
  v_validated_replacement:=public.client_health_revision_id(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.client_health_canonical_json(jsonb_build_object('type','client-health-refresh-attempt','refreshIdentityHash',v_identity_22,'runAttemptId','91000000-0000-4000-8000-000000000006')),'UTF8'),'sha256'),'hex'));
  perform public.client_health_create_refresh_run(v_validated_replacement,v_revision_id,v_revision_hash,v_identity_22,'91000000-0000-4000-8000-000000000006',date '2026-08-22','verify-v2','verify-s2',v_base+interval '1 second');
  if not exists(select 1 from public.client_health_refresh_runs where id=v_validated_run and run_status='failed' and error_code='refresh_attempt_superseded') then raise exception 'VERIFY FAILED: validated stale attempt was resumed'; end if;

  -- API role trust boundary: getter only; no private schema/table access or operator execution.
  if not pg_catalog.has_function_privilege('service_role','public.client_health_get_active_config_revision()','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE')
     or pg_catalog.has_schema_privilege('service_role','private','USAGE')
     or pg_catalog.has_table_privilege('service_role','private.client_health_config_revisions','SELECT')
     or pg_catalog.has_table_privilege('service_role','private.client_health_config_revision_activations','SELECT')
     or pg_catalog.has_table_privilege('service_role','private.client_health_active_config_revision','SELECT') then raise exception 'VERIFY FAILED: service_role private/operator ACL mismatch'; end if;
  v_failed:=false; begin
    execute 'set local role service_role';
    perform private.client_health_stage_config_revision(v_revision_id,v_revision_hash,v_revision);
  exception when others then v_failed:=true; end;
  if not v_failed then execute 'reset role'; raise exception 'VERIFY FAILED: service_role staged a private revision'; end if;
  v_failed:=false; begin
    execute 'set local role service_role';
    perform private.client_health_activate_config_revision(v_activation,v_revision_id,'1fc1e89c01322e55015e4ace498a3188c88953ee','postgres-verify-fixture','Verify reviewed v2 operator activation',null);
  exception when others then v_failed:=true; end;
  if not v_failed then execute 'reset role'; raise exception 'VERIFY FAILED: service_role activated a private revision'; end if;
  foreach v_role in array array['client_health_config_revisions'::name,'client_health_config_revision_activations'::name,'client_health_active_config_revision'::name] loop
    v_failed:=false; begin execute 'set local role service_role'; execute pg_catalog.format('select 1 from private.%I limit 1',v_role); exception when others then v_failed:=true; end;
    if not v_failed then execute 'reset role'; raise exception 'VERIFY FAILED: service_role directly read private.%',v_role; end if;
  end loop;
  execute 'set local role service_role'; v_receipt:=public.client_health_get_active_config_revision(); execute 'reset role';
  if v_receipt->'revision'->>'id'<>v_revision_id::text then raise exception 'VERIFY FAILED: service_role getter did not return exact active revision'; end if;

  foreach v_proc in array array['public.client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)'::regprocedure,'public.client_health_get_refresh_run(uuid)'::regprocedure,'public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint)'::regprocedure,'public.client_health_get_refresh_lease(uuid)'::regprocedure,'public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint)'::regprocedure,'public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz)'::regprocedure,'public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)'::regprocedure,'public.client_health_get_source_run(uuid,uuid,uuid,bigint)'::regprocedure,'public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint)'::regprocedure,'public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure,'public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint)'::regprocedure,'public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint)'::regprocedure,'public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint)'::regprocedure] loop
    if not pg_catalog.has_function_privilege('service_role',v_proc,'EXECUTE') or pg_catalog.has_function_privilege('anon',v_proc,'EXECUTE') or pg_catalog.has_function_privilege('authenticated',v_proc,'EXECUTE') then raise exception 'VERIFY FAILED: runtime RPC ACL mismatch for %',v_proc; end if;
  end loop;
  foreach v_proc in array array['public.client_health_assert_exact_keys(jsonb,text[],text)'::regprocedure,'public.client_health_canonical_json(jsonb)'::regprocedure,'public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint)'::regprocedure,'public.client_health_assert_run_provenance(uuid)'::regprocedure,'public.client_health_assert_refresh_integrity(uuid)'::regprocedure,'public.client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,text,text)'::regprocedure,'public.client_health_assert_task_authorized(jsonb,uuid,uuid,text)'::regprocedure] loop
    foreach v_role in array array['service_role'::name,'anon'::name,'authenticated'::name] loop if pg_catalog.has_function_privilege(v_role,v_proc,'EXECUTE') then raise exception 'VERIFY FAILED: helper % executable by %',v_proc,v_role; end if; end loop;
  end loop;
  foreach v_role in array array['service_role'::name,'anon'::name,'authenticated'::name] loop
    if pg_catalog.has_table_privilege(v_role,'public.client_health_refresh_runs','INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege(v_role,'public.client_health_source_runs','INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege(v_role,'public.client_health_snapshots','INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege(v_role,'public.client_health_snapshot_tasks','INSERT,UPDATE,DELETE') then raise exception 'VERIFY FAILED: direct lifecycle/evidence DML granted to %',v_role; end if;
  end loop;
  raise notice 'client_health_atomic_refresh_verify: all transactional v2 operator checks passed';
end
$$;
rollback;
