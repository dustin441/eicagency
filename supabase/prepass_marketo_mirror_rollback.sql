begin;
select pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));

drop function if exists public.prepass_marketo_focus_comparison(date,date);
drop function if exists public.prepass_marketo_mirror_comparison(date,date);
drop view if exists public.prepass_marketo_paid_lifecycle_events;
drop view if exists public.prepass_marketo_person_attribution;
drop view if exists public.prepass_marketo_lifecycle_events;
drop view if exists public.prepass_marketo_active_contacts;
drop function if exists public.prepass_finalize_marketo_mirror_run(uuid);
drop function if exists public.prepass_fail_marketo_mirror_run(uuid,text,text);
drop function if exists public.prepass_record_marketo_mirror_receipt(uuid,text,text,integer,text,text,bigint,bigint,bigint,text,jsonb);
drop function if exists public.prepass_stage_marketo_mirror_rows(uuid,jsonb);
drop function if exists public.prepass_begin_marketo_mirror_run(bigint,jsonb);
drop table if exists public.prepass_marketo_attribution_evidence;
drop table if exists public.prepass_marketo_campaign_map;
drop table if exists public.prepass_marketo_active_snapshot;
drop table if exists public.prepass_marketo_mirror_history;
drop function if exists public.prepass_marketo_reject_history_mutation();
drop table if exists public.prepass_marketo_mirror_contacts;
drop function if exists public.prepass_marketo_reject_snapshot_mutation();
drop table if exists public.prepass_marketo_mirror_staging;
drop table if exists public.prepass_marketo_mirror_runs;
drop table if exists public.prepass_marketo_source_contract;
drop function if exists public.prepass_marketo_safe_timestamptz(text);
drop function if exists public.prepass_marketo_safe_date(text);

commit;
