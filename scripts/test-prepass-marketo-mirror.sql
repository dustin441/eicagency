\set ON_ERROR_STOP on

insert into public.master_marketing_performance(date,focus,mqls,sqls,closed_won)
values ('2026-10-02','ABM',44,27,17);

insert into public.prepass_marketo_source_contract(
  singleton,smart_list_id,smart_list_name,smart_list_rules_checksum,minimum_provider_count,maximum_drop_fraction,approved_by,notes)
values (true,9001,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),1,0.5000,'fixture','Count two to one is intentionally allowed by the fixture.');

do $$
begin
  if not has_table_privilege('service_role','public.prepass_marketo_source_contract','SELECT') then raise exception 'service role cannot read approved source contract'; end if;
  if has_table_privilege('service_role','public.prepass_marketo_source_contract','INSERT')
     or has_table_privilege('service_role','public.prepass_marketo_source_contract','UPDATE')
     or has_table_privilege('service_role','public.prepass_marketo_source_contract','DELETE') then raise exception 'service role can mutate approved source contract'; end if;
  if has_table_privilege('service_role','public.prepass_marketo_mirror_runs','INSERT')
     or has_table_privilege('service_role','public.prepass_marketo_mirror_runs','UPDATE')
     or has_table_privilege('service_role','public.prepass_marketo_mirror_runs','DELETE') then raise exception 'service role can bypass run RPC validation'; end if;
  if has_table_privilege('service_role','public.prepass_marketo_mirror_staging','INSERT')
     or has_table_privilege('service_role','public.prepass_marketo_mirror_staging','UPDATE')
     or has_table_privilege('service_role','public.prepass_marketo_mirror_staging','DELETE') then raise exception 'service role can bypass staging RPC validation'; end if;
end $$;

insert into public.prepass_marketo_campaign_map(platform,campaign_alias,canonical_campaign,focus,evidence)
values ('Google','Search | ABM | Brand Defense','Search | ABM | Brand Defense','ABM','fixture');

-- First complete full-population snapshot.
insert into public.prepass_marketo_mirror_runs(
  run_id,smart_list_id,smart_list_name,smart_list_rules_checksum,field_count,field_dictionary_checksum,
  provider_export_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000001',9001,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),292,repeat('2',64),'fixture-1',2,2,2,repeat('a',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000001',
  '[
    {"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-03T01:00:00Z","dateMQL":"2026-10-01T08:30:00Z","dateSQL":"2026-10-02T09:45:00Z","dateClosedWon":"2026-10-02T18:00:00Z","email":"one@example.test","leadStatus":"Qualified","lifecycleStage":"Customer","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"valid_gclid_101_abcdef","uTMHistory":"first,paid"},
    {"id":202,"createdAt":"2026-09-02T00:00:00Z","updatedAt":"2026-10-03T02:00:00Z","dateMQL":"2026-10-02","email":"two@example.test"}
  ]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000001');

do $$
begin
  if (select active_run_id from public.prepass_marketo_active_snapshot where singleton) <> '00000000-0000-0000-0000-000000000001'::uuid then raise exception 'first snapshot was not activated'; end if;
  if (select count(*) from public.prepass_marketo_active_contacts) <> 2 then raise exception 'expected two active contacts'; end if;
  if exists(select 1 from public.prepass_marketo_mirror_staging where run_id='00000000-0000-0000-0000-000000000001') then raise exception 'completed run retained duplicate staging rows'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events) <> 4 then raise exception 'expected four lifecycle events'; end if;
  if (select count(*) from public.prepass_marketo_paid_lifecycle_events where focus='ABM') <> 3 then raise exception 'expected ABM mapping'; end if;
  if (select marketo_crm from public.prepass_marketo_mirror_comparison('2026-10-01','2026-10-02') where stage='MQL') <> 2 then raise exception 'CRM MQL mismatch'; end if;
end $$;

-- Second full snapshot omits person 202. Atomic pointer replacement removes that person from current reporting.
insert into public.prepass_marketo_mirror_runs(
  run_id,smart_list_id,smart_list_name,smart_list_rules_checksum,field_count,field_dictionary_checksum,
  provider_export_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000002',9001,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),292,repeat('2',64),'fixture-2',1,1,1,repeat('b',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000002',
  '[{"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-04T01:00:00Z","dateMQL":"2026-10-01","dateSQL":"","dateClosedWon":"2026-10-02","email":"one@example.test","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"valid_gclid_101_abcdef"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000002');

do $$
begin
  if (select active_run_id from public.prepass_marketo_active_snapshot where singleton) <> '00000000-0000-0000-0000-000000000002'::uuid then raise exception 'second snapshot was not activated'; end if;
  if exists(select 1 from public.prepass_marketo_active_contacts where marketo_id=202) then raise exception 'person absent from replacement snapshot remains current'; end if;
  if exists(select 1 from public.prepass_marketo_lifecycle_events where marketo_id=202) then raise exception 'absent person remains in current lifecycle reporting'; end if;
  if exists(select 1 from public.prepass_marketo_mirror_contacts where run_id='00000000-0000-0000-0000-000000000001') then raise exception 'prior raw snapshot rows were not replaced'; end if;
  if (select count(*) from public.prepass_marketo_mirror_contacts) <> 1 then raise exception 'raw snapshot replacement count mismatch'; end if;
  if (select count(*) from public.prepass_marketo_mirror_history where run_id='00000000-0000-0000-0000-000000000002') <> 2 then raise exception 'change-only payload history count mismatch'; end if;
  if not exists(select 1 from public.prepass_marketo_mirror_history where run_id='00000000-0000-0000-0000-000000000002' and marketo_id=101 and change_type='changed' and previous_payload is not null and current_payload is not null) then raise exception 'changed payload history missing'; end if;
  if not exists(select 1 from public.prepass_marketo_mirror_history where run_id='00000000-0000-0000-0000-000000000002' and marketo_id=202 and change_type='removed' and previous_payload is not null and current_payload is null) then raise exception 'removed payload history missing'; end if;
end $$;

-- A count-gate failure must retain the prior active pointer and dataset.
insert into public.prepass_marketo_mirror_runs(
  run_id,smart_list_id,smart_list_name,smart_list_rules_checksum,field_count,field_dictionary_checksum,
  provider_export_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000003',9001,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),292,repeat('2',64),'fixture-3',2,2,2,repeat('c',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000003',
  '[{"id":303,"updatedAt":"2026-10-05T01:00:00Z"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000003');

do $$
begin
  if (select status from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000003') <> 'blocked' then raise exception 'count mismatch did not block publish'; end if;
  if (select active_run_id from public.prepass_marketo_active_snapshot where singleton) <> '00000000-0000-0000-0000-000000000002'::uuid then raise exception 'blocked run changed active pointer'; end if;
  if (select count(*) from public.prepass_marketo_active_contacts) <> 1 then raise exception 'blocked run changed current dataset'; end if;
  if exists(select 1 from public.prepass_marketo_mirror_contacts where run_id='00000000-0000-0000-0000-000000000003') then raise exception 'blocked run published snapshot rows'; end if;
end $$;

-- Missing receipt is blocked and immutable published rows reject mutation.
insert into public.prepass_marketo_mirror_runs(run_id,smart_list_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000004',9001,0,0,0,repeat('d',64));
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000004');
do $$
begin
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000004') <> 'SOURCE_RECEIPT_MISSING' then raise exception 'missing source receipt was not blocked'; end if;
  begin
    update public.prepass_marketo_mirror_contacts set email='mutated@example.test' where run_id='00000000-0000-0000-0000-000000000002' and marketo_id=101;
    raise exception 'immutable snapshot accepted update';
  exception when raise_exception then
    if sqlerrm <> 'published Marketo snapshot rows are immutable' then raise; end if;
  end;
  begin
    delete from public.prepass_marketo_mirror_history where run_id='00000000-0000-0000-0000-000000000002' and marketo_id=202;
    raise exception 'immutable history accepted delete';
  exception when raise_exception then
    if sqlerrm <> 'Marketo payload history rows are immutable' then raise; end if;
  end;
end $$;

-- A complete-looking but empty export must never replace the active snapshot.
insert into public.prepass_marketo_mirror_runs(
  run_id,smart_list_id,smart_list_name,smart_list_rules_checksum,field_count,field_dictionary_checksum,
  provider_export_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000006',9001,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),292,repeat('2',64),'fixture-empty',0,0,0,repeat('e',64));
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000006');

do $$
begin
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000006') <> 'POPULATION_TOO_SMALL' then raise exception 'empty export was not blocked'; end if;
  if (select active_run_id from public.prepass_marketo_active_snapshot where singleton) <> '00000000-0000-0000-0000-000000000002'::uuid then raise exception 'empty export changed active pointer'; end if;
end $$;

-- A changed smart-list definition must fail even when all counts match.
insert into public.prepass_marketo_mirror_runs(
  run_id,smart_list_id,smart_list_name,smart_list_rules_checksum,field_count,field_dictionary_checksum,
  provider_export_id,provider_count,parsed_count,unique_count,source_checksum)
values ('00000000-0000-0000-0000-000000000007',9001,'Reporting v2 | Full Marketo Snapshot',repeat('9',64),292,repeat('2',64),'fixture-wrong-rules',1,1,1,repeat('f',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000007',
  '[{"id":707,"updatedAt":"2026-10-06T01:00:00Z"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000007');

do $$
begin
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000007') <> 'SOURCE_CONTRACT_MISMATCH' then raise exception 'changed source rules were not blocked'; end if;
  begin
    perform public.prepass_begin_marketo_mirror_run(9002,'{}'::jsonb);
    raise exception 'unapproved smart-list ID was accepted';
  exception when raise_exception then
    if sqlerrm not like 'smart-list ID 9002 does not match approved source contract 9001%' then raise; end if;
  end;
end $$;

-- Stale staging lease is auditable and reclaimable.
insert into public.prepass_marketo_mirror_runs(run_id,smart_list_id,started_at)
values ('00000000-0000-0000-0000-000000000005',9001,now()-interval '3 hours');
insert into public.prepass_marketo_mirror_staging(run_id,marketo_id,source_updated_at,payload_sha256,payload)
values ('00000000-0000-0000-0000-000000000005',505,'2026-10-06T01:00:00Z',repeat('5',64),'{"id":505,"updatedAt":"2026-10-06T01:00:00Z"}'::jsonb);
do $$
declare v_new uuid;
begin
  v_new:=public.prepass_begin_marketo_mirror_run(9001,'{"fixture":true}'::jsonb);
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000005') <> 'STALE_LEASE' then raise exception 'stale lease was not reclaimed'; end if;
  if exists(select 1 from public.prepass_marketo_mirror_staging where run_id='00000000-0000-0000-0000-000000000005') then raise exception 'stale lease staging was not cleared'; end if;
  perform public.prepass_record_marketo_mirror_receipt(
    v_new,'Reporting v2 | Full Marketo Snapshot',repeat('1',64),292,repeat('2',64),
    'fixture-rpc',1,1,1,repeat('a',64),'{"fixture":"receipt-rpc"}'::jsonb);
  if (select provider_export_id from public.prepass_marketo_mirror_runs where run_id=v_new) <> 'fixture-rpc' then raise exception 'receipt RPC did not record receipt'; end if;
  perform public.prepass_stage_marketo_mirror_rows(v_new,'[{"id":808,"updatedAt":"2026-10-06T01:00:00Z"}]'::jsonb);
  perform public.prepass_fail_marketo_mirror_run(v_new,'FIXTURE_CLEANUP','fixture completed');
  if (select status from public.prepass_marketo_mirror_runs where run_id=v_new) <> 'failed' then raise exception 'failure RPC did not close staging run'; end if;
  if exists(select 1 from public.prepass_marketo_mirror_staging where run_id=v_new) then raise exception 'failure RPC did not clear staging'; end if;
end $$;

select 'prepass_marketo_mirror_sql_tests_passed' as result;
