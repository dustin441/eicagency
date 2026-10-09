\set ON_ERROR_STOP on

insert into public.master_marketing_performance(date,focus,mqls,sqls,closed_won)
values ('2026-10-02','ABM',44,27,17);

insert into public.prepass_marketo_campaign_map(platform,campaign_alias,canonical_campaign,focus,evidence)
values ('Google','Search | ABM | Brand Defense','Search | ABM | Brand Defense','ABM','fixture');

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000001','incremental','2026-10-01','2026-10-03',2,2,repeat('a',64));

select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000001',
  '[
    {"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-03T01:00:00Z","dateMQL":"2026-10-01T08:30:00Z","dateSQL":"2026-10-02T09:45:00Z","dateClosedWon":"2026-10-02T18:00:00Z","email":"one@example.test","leadStatus":"Qualified","lifecycleStage":"Customer","acquisitionProgramId":"77","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"g-1","uTMHistory":"first,paid"},
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

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000002','incremental','2026-10-03','2026-10-04',1,1,repeat('b',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000002',
  '[{"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-04T01:00:00Z","dateMQL":"2026-10-01","dateSQL":"","dateClosedWon":"2026-10-02","email":"one@example.test","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"g-1"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000002');

do $$
begin
  if (select date_sql from public.prepass_marketo_mirror_contacts where marketo_id=101) is not null then raise exception 'blank Marketo field did not clear SQL date'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events where marketo_id=101 and stage='SQL') <> 0 then raise exception 'cleared SQL event still exists'; end if;
  if (select count(*) from public.prepass_marketo_mirror_history where marketo_id=101) <> 2 then raise exception 'history did not preserve both payload states'; end if;
end $$;

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000003','incremental','2026-10-04','2026-10-05',2,2,repeat('c',64));
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

insert into public.prepass_marketo_mirror_runs(run_id,run_kind,window_start,window_end,provider_count,parsed_count,source_checksum)
values ('00000000-0000-0000-0000-000000000004','full_snapshot','2026-10-05','2026-10-06',1,1,repeat('d',64));
select public.prepass_stage_marketo_mirror_rows(
  '00000000-0000-0000-0000-000000000004',
  '[{"id":101,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-10-06T01:00:00Z","dateMQL":"2026-10-01","dateClosedWon":"2026-10-02","email":"one@example.test","utmsource":"google","utmmedium":"cpc","utmcampaign":"Search | ABM | Brand Defense","gclid":"g-1"}]'::jsonb
);
select public.prepass_finalize_marketo_mirror_run('00000000-0000-0000-0000-000000000004');

do $$
begin
  if (select is_present from public.prepass_marketo_mirror_contacts where marketo_id=202) then raise exception 'full snapshot did not mark absent contact'; end if;
  if (select count(*) from public.prepass_marketo_lifecycle_events where marketo_id=202) <> 0 then raise exception 'absent contact remains in lifecycle events'; end if;
  if (select count(*) from public.prepass_marketo_mirror_history where marketo_id=202) <> 1 then raise exception 'absent contact history was lost'; end if;
end $$;

select 'prepass_marketo_mirror_sql_tests_passed' as result;
