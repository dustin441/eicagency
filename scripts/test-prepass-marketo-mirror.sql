\set ON_ERROR_STOP on

insert into public.master_marketing_performance(date,focus,mqls,sqls,closed_won)
values ('2026-10-02','ABM',44,27,17);

insert into public.prepass_marketo_campaign_map(platform,campaign_alias,canonical_campaign,focus,evidence)
values ('Google','Search | ABM | Brand Defense','Search | ABM | Brand Defense','ABM','fixture');

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_export_ids,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000001','incremental','2026-10-01','2026-10-03',array['fixture-1'],2,2,repeat('a',64));

select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000001',
  '[
    {"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-03T01:00:00Z","dateMQL":"2026-10-01T08:30:00Z","dateSQL":"2026-10-02T09:45:00Z","dateClosedWon":"2026-10-02T18:00:00Z","email":"one@example.test","leadStatus":"Qualified","lifecycleStage":"Customer","acquisitionProgramId":"77","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"valid_gclid_101_abcdef","uTMHistory":"first,paid"},
    {"id":202,"createdAt":"2026-09-02T00:00:00Z","updatedAt":"2026-10-03T02:00:00Z","dateMQL":"2026-10-02","email":"two@example.test"}
  ]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000001');

do $$
begin
  if (select count(*) from public.prepass_marketo_mirror_contacts) <> 2 then raise exception 'expected two mirror contacts'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events) <> 4 then raise exception 'expected four lifecycle events'; end if;
  if (select count(*) from public.prepass_marketo_paid_lifecycle_events) <> 3 then raise exception 'expected three directly paid lifecycle events'; end if;
  if (select count(*) from public.prepass_marketo_paid_lifecycle_events where focus='ABM') <> 3 then raise exception 'expected ABM mapping'; end if;
  if (select date_won from public.prepass_marketo_mirror_contacts where marketo_id=101) <> '2026-10-02'::date then raise exception 'timestamp stage date was not normalized'; end if;
  if (select lead_status from public.prepass_marketo_mirror_contacts where marketo_id=101) <> 'Qualified' then raise exception 'lead status was not extracted'; end if;
  if (select lifecycle_stage from public.prepass_marketo_mirror_contacts where marketo_id=101) <> 'Customer' then raise exception 'lifecycle stage was not extracted'; end if;
  if (select utm_history from public.prepass_marketo_mirror_contacts where marketo_id=101) <> 'first,paid' then raise exception 'UTM history was not preserved'; end if;
  if (select marketo_crm from public.prepass_marketo_mirror_comparison('2026-10-01','2026-10-02') where stage='MQL') <> 2 then raise exception 'CRM MQL mismatch'; end if;
  if (select mirror_paid from public.prepass_marketo_mirror_comparison('2026-10-01','2026-10-02') where stage='WON') <> 1 then raise exception 'paid WON mismatch'; end if;
  if (select legacy_mmp from public.prepass_marketo_mirror_comparison('2026-10-01','2026-10-02') where stage='WON') <> 17 then raise exception 'legacy WON mismatch'; end if;
end $$;

create schema prepass_daily_match_20261001;
create table prepass_daily_match_20261001.stage_matches(
  canonical_id text,stage text,event_date date,campaign_id text,campaign_name text,focus text,
  source_updated_at timestamptz,updated_at timestamptz,publication_disposition text
);
insert into prepass_daily_match_20261001.stage_matches
values ('202','MQL','2026-10-02',null,'Search | ABM | Brand Defense','ABM','2026-10-03','2026-10-03','ACTIVE');
\ir ../supabase/prepass_marketo_call_evidence_seed.sql

do $$
begin
  if (select count(*) from public.prepass_marketo_attribution_evidence where marketo_id=202 and active) <> 1 then raise exception 'validated call evidence was not imported'; end if;
  if (select count(distinct marketo_id) from public.prepass_marketo_paid_lifecycle_events where stage='MQL') <> 2 then raise exception 'validated call was not included'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_export_ids,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000002','incremental','2026-10-03','2026-10-04',array['fixture-2'],1,1,repeat('b',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000002',
  '[{"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-04T01:00:00Z","dateMQL":"2026-10-01","dateSQL":"","dateClosedWon":"2026-10-02","email":"one@example.test","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"valid_gclid_101_abcdef"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000002');

do $$
begin
  if (select date_sql from public.prepass_marketo_mirror_contacts where marketo_id=101) is not null then raise exception 'blank Marketo field did not clear SQL date'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events where marketo_id=101 and stage='SQL') <> 0 then raise exception 'cleared SQL event still exists'; end if;
  if (select count(*) from public.prepass_marketo_mirror_history where marketo_id=101) <> 2 then raise exception 'history did not preserve both payload states'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_export_ids,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000003','incremental','2026-10-04','2026-10-05',array['fixture-3'],2,2,repeat('c',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000003',
  '[{"id":101,"updatedAt":"2026-10-05T01:00:00Z"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000003');

do $$
begin
  if (select status from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000003') <> 'blocked' then raise exception 'count mismatch did not block publish'; end if;
  if (select source_updated_at from public.prepass_marketo_mirror_contacts where marketo_id=101) <> '2026-10-04T01:00:00Z'::timestamptz then raise exception 'blocked run mutated current mirror'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_export_ids,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000004','full_snapshot','2026-10-05','2026-10-06',array['fixture-4'],1,1,repeat('d',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000004',
  '[{"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-06T01:00:00Z","dateMQL":"2026-10-01","dateClosedWon":"2026-10-02","email":"one@example.test","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"valid_gclid_101_abcdef"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000004');

do $$
begin
  if (select is_present from public.prepass_marketo_mirror_contacts where marketo_id=202) then raise exception 'full snapshot did not mark absent contact'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events where marketo_id=202) <> 0 then raise exception 'absent contact remains in lifecycle events'; end if;
  if (select count(*) from public.prepass_marketo_mirror_history where marketo_id=202) <> 1 then raise exception 'absent contact history was lost'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_export_ids,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000005','incremental','2026-10-06','2026-10-07',array['fixture-5'],3,3,repeat('e',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000005',
  '[
    {"id":303,"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-07T01:00:00Z","dateMQL":"2026-10-01","gclid":"x"},
    {"id":404,"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-07T01:00:00Z","dateMQL":"2026-10-01","utmsource":"google","utmmedium":"","originalutmsource":"newsletter","originalutmmedium":"cpc"},
    {"id":505,"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-07T01:00:00Z","dateMQL":"2026-10-01","dateSQL":"2026-10-03"}
  ]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000005');
insert into public.prepass_marketo_attribution_evidence(
  marketo_id,route,platform,focus,campaign_name,evidence_kind,evidence_key,valid_from,source_updated_at)
values (505,'validated_call','Google',null,'Search | ABM | Brand Defense','validated_originating_call','fixture-window-call-505','2026-10-02','2026-10-07');

do $$
begin
  if (select attribution_status from public.prepass_marketo_person_attribution where marketo_id=303) <> 'not_paid' then raise exception 'invalid short click ID was accepted'; end if;
  if (select attribution_status from public.prepass_marketo_person_attribution where marketo_id=404) <> 'not_paid' then raise exception 'current and original UTM pairs were mixed'; end if;
  if exists(select 1 from public.prepass_marketo_paid_lifecycle_events where marketo_id=505 and stage='MQL') then raise exception 'call evidence was applied before valid_from'; end if;
  if not exists(select 1 from public.prepass_marketo_paid_lifecycle_events where marketo_id=505 and stage='SQL') then raise exception 'call evidence was not applied within its validity window'; end if;
  if (select attribution_status from public.prepass_marketo_paid_lifecycle_events where marketo_id=505 and stage='SQL') <> 'paid_unmapped' then raise exception 'call evidence without focus was not preserved as paid-unmapped'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000006','incremental','2026-10-07','2026-10-08',0,0,repeat('f',64));
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000006');
do $$
begin
  if (select status from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000006') <> 'blocked' then raise exception 'missing source receipt did not block publish'; end if;
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000006') <> 'SOURCE_RECEIPT_MISSING' then raise exception 'missing source receipt was not identified'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,started_at)
values ('00000000-0000-0000-0000-000000000007','incremental','2026-10-08','2026-10-09',now()-interval '3 hours');
do $$
declare v_new uuid;
begin
  v_new:=public.prepass_begin_marketo_mirror_run('incremental','2026-10-09','2026-10-10','{"fixture":true}'::jsonb);
  if (select status from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000007') <> 'failed' then raise exception 'stale writer lease was not reclaimed'; end if;
  if (select error_code from public.prepass_marketo_mirror_runs where run_id='00000000-0000-0000-0000-000000000007') <> 'STALE_LEASE' then raise exception 'stale writer lease lacked audit code'; end if;
  update public.prepass_marketo_mirror_runs set status='failed',completed_at=now(),error_code='FIXTURE_CLEANUP' where run_id=v_new;
end $$;

select 'prepass_marketo_mirror_sql_tests_passed' as result;
