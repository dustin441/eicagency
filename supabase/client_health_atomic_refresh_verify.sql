begin;

-- pgTAP-independent verification for an already-applied atomic-refresh proposal.
-- Run as postgres in EIC only. All fixtures and configuration changes roll back.
do $$
declare
  v_client uuid := '90000000-0000-4000-8000-000000000001';
  v_run uuid := '90000000-0000-4000-8000-000000000002';
  v_expired_run uuid := '90000000-0000-4000-8000-000000000003';
  v_replacement_run uuid := '90000000-0000-4000-8000-00000000000a';
  v_blocked_run uuid := '90000000-0000-4000-8000-00000000000b';
  v_validated_run uuid := '91000000-0000-4000-8000-000000000001';
  v_validated_replacement uuid := '91000000-0000-4000-8000-000000000002';
  v_stale_source uuid := '91000000-0000-4000-8000-000000000003';
  v_stale_snapshot uuid := '91000000-0000-4000-8000-000000000004';
  v_source uuid := '90000000-0000-4000-8000-000000000004';
  v_invocation uuid := '90000000-0000-4000-8000-000000000005';
  v_attempt uuid := '90000000-0000-4000-8000-000000000006';
  v_other_attempt uuid := '90000000-0000-4000-8000-000000000007';
  v_run_attempt uuid := '90000000-0000-4000-8000-00000000000c';
  v_other_run_attempt uuid := '90000000-0000-4000-8000-00000000000d';
  v_third_run_attempt uuid := '90000000-0000-4000-8000-00000000000e';
  v_snapshot uuid := '90000000-0000-8000-8000-000000000008';
  v_base timestamptz := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());
  v_grant jsonb;
  v_retry jsonb;
  v_snapshot_json jsonb;
  v_tasks jsonb;
  v_bundle jsonb;
  v_receipt jsonb;
  v_idempotency text;
  v_failed boolean;
  v_proc regprocedure;
  v_role name;
begin
  if to_regclass('public.master_spartaco') is null then
    raise exception 'VERIFY FAILED: not the EIC Clients project';
  end if;
  if to_regprocedure('public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)') is null then
    raise exception 'VERIFY FAILED: atomic-refresh functions are not installed';
  end if;

  -- Isolate exact configured-active coverage without persisting any configuration change.
  update public.client_health_clients set active = false where active;
  insert into public.client_health_clients (
    id, client_key, display_name, active, config_status, reporting_timezone
  ) values (
    v_client, 'atomic_verify_fixture', 'Atomic verify fixture', true, 'approved', 'America/Phoenix'
  );

  perform public.client_health_create_refresh_run(v_run, repeat('1',64), v_run_attempt, date '2026-08-20', 'verify-v1', 'verify-s1', v_base);
  v_grant := public.client_health_acquire_refresh_lease(v_run, v_invocation, v_attempt, 5000);
  if v_grant is null or (v_grant->>'fencingToken')::bigint <> 1 then
    raise exception 'VERIFY FAILED: first claim did not win with fence 1';
  end if;
  if extract(epoch from ((v_grant->>'leaseExpiresAt')::timestamptz - (v_grant->>'leaseGrantedAt')::timestamptz)) <> 5 then
    raise exception 'VERIFY FAILED: database grant duration is not exactly 5000ms';
  end if;

  -- Exact response-loss retry returns the committed grant; same invocation with a
  -- different process attempt cannot adopt it.
  v_retry := public.client_health_acquire_refresh_lease(v_run, v_invocation, v_attempt, 5000);
  if v_retry <> v_grant then
    raise exception 'VERIFY FAILED: exact lease retry changed the grant';
  end if;
  v_failed := false;
  begin
    perform public.client_health_acquire_refresh_lease(v_run, v_invocation, v_other_attempt, 5000);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY FAILED: second claim attempt also won'; end if;

  v_failed := false;
  begin
    perform public.client_health_renew_refresh_lease(v_run, v_invocation, v_attempt, 2, 5000);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY FAILED: stale fence renewal was accepted'; end if;

  perform public.client_health_create_source_run(
    v_source, v_run, v_client, 'paid', date '2026-08-01', date '2026-08-20', v_base,
    v_invocation, v_attempt, 1
  );
  -- A source date is an auditable UTC day boundary, independent of the caller's
  -- session timezone. Exercise a non-UTC caller so implicit date casts cannot pass.
  perform pg_catalog.set_config('TimeZone', 'America/Los_Angeles', true);
  perform public.client_health_complete_source_run(
    v_source, v_run, 'succeeded', v_base + interval '1 second', date '2026-08-20', 1,
    repeat('b', 64), '{}'::jsonb, null, null, v_invocation, v_attempt, 1
  );
  if (select data_through from public.client_health_source_runs where id = v_source)
     is distinct from timestamptz '2026-08-20 00:00:00+00' then
    raise exception 'VERIFY FAILED: source data-through is not UTC midnight';
  end if;
  perform pg_catalog.set_config('TimeZone', 'UTC', true);

  v_snapshot_json := pg_catalog.jsonb_build_object(
    'refreshRunId', v_run::text,
    'clientId', v_client::text,
    'snapshotDate', '2026-08-20',
    'dataThrough', '2026-08-20',
    'budget', 100, 'monthSpend', 50, 'expectedSpend', 60,
    'currentWindowStart', '2026-08-14', 'currentWindowEnd', '2026-08-20',
    'currentSpend', 10, 'currentResultCount', 2, 'currentCostPerResult', 5,
    'previousWindowStart', '2026-08-07', 'previousWindowEnd', '2026-08-13',
    'previousSpend', 9, 'previousResultCount', 1, 'previousCostPerResult', 9,
    'hoursUsed', 2, 'hoursAllotted', 10, 'projectedHours', 4,
    'overdueTaskCount', 1, 'revenue', 20, 'fulfillmentCost', 5, 'marginPercent', 75,
    'dimensionStatuses', pg_catalog.jsonb_build_object(
      'budget_pacing', jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),
      'north_star', jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),
      'hours', jsonb_build_object('status','healthy','value',1,'reason','Verified.','required',true,'weight',20),
      'overdue_tasks', jsonb_build_object('status','watch','value',1,'reason','Verified.','required',true,'weight',20),
      'margin', jsonb_build_object('status','healthy','value',75,'reason','Verified.','required',true,'weight',20)
    ),
    'sourceStatuses', pg_catalog.jsonb_build_object(
      'paid', jsonb_build_object('status','succeeded','dataThrough','2026-08-20','stale',false,'rowCount',1)
    ),
    'overallStatus', 'watch', 'overallScore', 80,
    'reasons', jsonb_build_array('Verified fixture.'),
    'calculatedAt', pg_catalog.to_char((v_base + interval '2 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'evidenceHash', repeat('a', 64)
  );

  -- Force a failure during the second task INSERT (not merely JSON preflight) and prove
  -- PostgreSQL rolled back the snapshot plus first task from the function statement.
  v_tasks := pg_catalog.jsonb_build_array(
    jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/TASK1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1),
    jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK2','listId','1','taskName','Task two','taskUrl','https://app.clickup.com/t/TASK2','dueAt','not-a-timestamp','displayRank',2)
  );
  v_snapshot_json := pg_catalog.jsonb_set(v_snapshot_json, '{overdueTaskCount}', '2'::jsonb);
  v_idempotency := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.client_health_canonical_json(jsonb_build_object('snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)), 'UTF8'), 'sha256'), 'hex');
  v_bundle := jsonb_build_object('idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed := false;
  begin
    perform public.client_health_persist_snapshot_bundle(v_bundle, v_invocation, v_attempt, 1);
  exception when others then v_failed := true;
  end;
  if not v_failed or exists (select 1 from public.client_health_snapshots where id = v_snapshot)
     or exists (select 1 from public.client_health_snapshot_tasks where snapshot_id = v_snapshot) then
    raise exception 'VERIFY FAILED: bad-task bundle was not atomically rolled back';
  end if;

  -- Duplicate task IDs are rejected explicitly before persistence.
  v_tasks := pg_catalog.jsonb_build_array(
    jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','DUP1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/DUP1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1),
    jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','DUP1','listId','1','taskName','Task two','taskUrl','https://app.clickup.com/t/DUP1','dueAt','2026-08-20T13:00:00.000Z','displayRank',2)
  );
  v_idempotency := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.client_health_canonical_json(jsonb_build_object('snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)), 'UTF8'), 'sha256'), 'hex');
  v_bundle := jsonb_build_object('idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_failed := false;
  begin
    perform public.client_health_persist_snapshot_bundle(v_bundle, v_invocation, v_attempt, 1);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY FAILED: duplicate task IDs were accepted'; end if;

  -- Persist valid content, then prove byte/content-exact idempotent retry.
  v_snapshot_json := pg_catalog.jsonb_set(v_snapshot_json, '{overdueTaskCount}', '1'::jsonb);
  v_tasks := pg_catalog.jsonb_build_array(
    jsonb_build_object('refreshRunId',v_run::text,'snapshotId',v_snapshot::text,'clickupTaskId','TASK1','listId','1','taskName','Task one','taskUrl','https://app.clickup.com/t/TASK1','dueAt','2026-08-20T12:00:00.000Z','displayRank',1)
  );
  v_idempotency := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.client_health_canonical_json(jsonb_build_object('snapshotId',v_snapshot::text,'evidenceHash',repeat('a',64),'snapshot',v_snapshot_json,'tasks',v_tasks)), 'UTF8'), 'sha256'), 'hex');
  v_bundle := jsonb_build_object('idempotencyKey',v_idempotency,'evidenceHash',repeat('a',64),'snapshotId',v_snapshot::text,'snapshot',v_snapshot_json,'tasks',v_tasks);
  v_receipt := public.client_health_persist_snapshot_bundle(v_bundle, v_invocation, v_attempt, 1);
  if public.client_health_persist_snapshot_bundle(v_bundle, v_invocation, v_attempt, 1) <> v_receipt then
    raise exception 'VERIFY FAILED: exact snapshot retry changed its receipt';
  end if;

  perform public.client_health_validate_refresh_run(v_run, v_base + interval '3 seconds', repeat('c',64), v_invocation, v_attempt, 1);
  v_failed := false;
  begin
    perform public.client_health_create_source_run(
      '90000000-0000-4000-8000-000000000009', v_run, v_client, 'late', null, null,
      v_base + interval '4 seconds', v_invocation, v_attempt, 1
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY FAILED: validated refresh accepted source mutation'; end if;

  perform public.client_health_publish_refresh_run(v_run, v_base + interval '4 seconds', v_invocation, v_attempt, 1);
  if exists (
    select 1 from public.client_health_refresh_runs where id = v_run
      and (lease_invocation_id is not null or lease_claim_attempt_id is not null or lease_granted_at is not null or lease_expires_at is not null)
  ) then raise exception 'VERIFY FAILED: publish did not atomically clear lease ownership'; end if;
  if public.client_health_get_refresh_lease(v_run) is not null then
    raise exception 'VERIFY FAILED: terminal lease remains visible';
  end if;
  if not exists (select 1 from public.client_health_latest where id = v_snapshot and refresh_run_id = v_run) then
    raise exception 'VERIFY FAILED: published snapshot is not latest-visible';
  end if;
  perform public.client_health_release_refresh_lease(
    v_run, v_invocation, v_attempt, 1,
    (v_grant->>'leaseGrantedAt')::timestamptz, (v_grant->>'leaseExpiresAt')::timestamptz
  );
  perform public.client_health_release_refresh_lease(
    v_run, v_invocation, v_attempt, 1,
    (v_grant->>'leaseGrantedAt')::timestamptz, (v_grant->>'leaseExpiresAt')::timestamptz
  );

  perform public.client_health_create_refresh_run(v_expired_run, repeat('2',64), v_other_run_attempt, date '2026-08-21', 'verify-v1', 'verify-s1', v_base);
  perform public.client_health_acquire_refresh_lease(v_expired_run, v_invocation, v_other_attempt, 1);
  insert into public.client_health_source_runs (
    id, refresh_run_id, client_id, source_key, run_status, started_at, finished_at, evidence
  ) values (
    v_stale_source, v_expired_run, v_client, 'paid', 'succeeded', v_base, v_base + interval '1 millisecond', '{}'::jsonb
  );
  insert into public.client_health_snapshots (
    id, refresh_run_id, client_id, snapshot_date, overall_status,
    persistence_evidence_hash, persistence_idempotency_key
  ) values (
    v_stale_snapshot, v_expired_run, v_client, date '2026-08-21', 'healthy', repeat('3',64), repeat('4',64)
  );
  perform pg_catalog.pg_sleep(0.01);
  if public.client_health_get_refresh_lease(v_expired_run) is not null then
    raise exception 'VERIFY FAILED: expired lease is visible';
  end if;
  perform public.client_health_create_refresh_run(v_replacement_run, repeat('2',64), v_third_run_attempt, date '2026-08-21', 'verify-v1', 'verify-s1', v_base + interval '1 second');
  if not exists (
    select 1 from public.client_health_refresh_runs
    where id = v_expired_run and run_status = 'failed'
      and error_code = 'refresh_attempt_superseded'
      and error_message = 'Client health refresh attempt was superseded.'
      and lease_invocation_id is null and lease_claim_attempt_id is null
      and lease_granted_at is null and lease_expires_at is null
  ) then raise exception 'VERIFY FAILED: expired stale attempt was not fixed-failed and cleared'; end if;
  if (select count(*) from public.client_health_refresh_runs where refresh_identity_hash = repeat('2',64) and run_status in ('collecting','validated')) <> 1 then
    raise exception 'VERIFY FAILED: supersession did not leave exactly one active identity';
  end if;
  if not exists (select 1 from public.client_health_source_runs where id = v_stale_source and run_status = 'succeeded')
     or not exists (select 1 from public.client_health_snapshots where id = v_stale_snapshot)
     or exists (select 1 from public.client_health_latest where id = v_stale_snapshot) then
    raise exception 'VERIFY FAILED: superseded evidence was not retained for audit or leaked into latest';
  end if;

  perform public.client_health_acquire_refresh_lease(v_replacement_run, v_invocation, v_attempt, 5000);
  v_failed := false;
  begin
    perform public.client_health_create_refresh_run(v_blocked_run, repeat('2',64), '90000000-0000-4000-8000-00000000000f', date '2026-08-21', 'verify-v1', 'verify-s1', v_base + interval '2 seconds');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY FAILED: active lease did not block a fresh attempt'; end if;

  -- A crash after validation is also superseded, never resumed. Preseed the active
  -- state as postgres to isolate create/supersession semantics from coverage validation.
  insert into public.client_health_refresh_runs (
    id, refresh_identity_hash, run_attempt_id, snapshot_date, run_status,
    calculation_version, source_contract_version, started_at, validated_at
  ) values (
    v_validated_run, repeat('5',64), '91000000-0000-4000-8000-000000000005', date '2026-08-22', 'collecting',
    'verify-v1', 'verify-s1', v_base, v_base + interval '1 millisecond'
  );
  update public.client_health_refresh_runs set run_status = 'validated' where id = v_validated_run;
  perform public.client_health_create_refresh_run(
    v_validated_replacement, repeat('5',64), '91000000-0000-4000-8000-000000000006',
    date '2026-08-22', 'verify-v1', 'verify-s1', v_base + interval '1 second'
  );
  if not exists (
    select 1 from public.client_health_refresh_runs
    where id = v_validated_run and run_status = 'failed' and error_code = 'refresh_attempt_superseded'
  ) then raise exception 'VERIFY FAILED: validated stale attempt was resumed instead of superseded'; end if;

  -- ACL matrix: service role may call runtime RPCs but no API/browser role can call
  -- helpers; anon/authenticated cannot call runtime RPCs or mutate evidence tables.
  foreach v_proc in array array[
    'public.client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz)'::regprocedure,
    'public.client_health_get_refresh_run(uuid)'::regprocedure,
    'public.client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_get_refresh_lease(uuid)'::regprocedure,
    'public.client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint)'::regprocedure,
    'public.client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz)'::regprocedure,
    'public.client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_get_source_run(uuid,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint)'::regprocedure,
    'public.client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint)'::regprocedure
  ] loop
    if not pg_catalog.has_function_privilege('service_role', v_proc, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_proc, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_proc, 'EXECUTE') then
      raise exception 'VERIFY FAILED: runtime RPC ACL mismatch for %', v_proc;
    end if;
  end loop;
  foreach v_proc in array array[
    'public.client_health_assert_exact_keys(jsonb,text[],text)'::regprocedure,
    'public.client_health_canonical_json(jsonb)'::regprocedure,
    'public.client_health_assert_owned_lease(uuid,uuid,uuid,bigint)'::regprocedure
  ] loop
    foreach v_role in array array['service_role'::name,'anon'::name,'authenticated'::name] loop
      if pg_catalog.has_function_privilege(v_role, v_proc, 'EXECUTE') then
        raise exception 'VERIFY FAILED: helper % executable by %', v_proc, v_role;
      end if;
    end loop;
  end loop;
  foreach v_role in array array['service_role'::name,'anon'::name,'authenticated'::name] loop
    if pg_catalog.has_table_privilege(v_role, 'public.client_health_refresh_runs', 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_table_privilege(v_role, 'public.client_health_source_runs', 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_table_privilege(v_role, 'public.client_health_snapshots', 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_table_privilege(v_role, 'public.client_health_snapshot_tasks', 'INSERT,UPDATE,DELETE') then
      raise exception 'VERIFY FAILED: direct lifecycle/evidence DML remains granted to %', v_role;
    end if;
  end loop;

  raise notice 'client_health_atomic_refresh_verify: all transactional checks passed';
end
$$;

rollback;
