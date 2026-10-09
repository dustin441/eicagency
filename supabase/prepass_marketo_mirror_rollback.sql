begin;
select pg_advisory_xact_lock(hashtext('prepass_marketo_mirror_v1'));

drop function if exists public.prepass_marketo_focus_comparison(date,date);
drop function if exists public.prepass_marketo_mirror_comparison(date,date);
drop view if exists public.prepass_marketo_paid_lifecycle_events;
drop view if exists public.prepass_marketo_person_attribution;
drop view if exists public.prepass_marketo_lifecycle_events;
drop function if exists public.prepass_finalize_marketo_mirror_run(uuid);
drop function if exists public.prepass_stage_marketo_mirror_rows(uuid,jsonb);
drop table if exists public.prepass_marketo_attribution_evidence;
drop table if exists public.prepass_marketo_campaign_map;
drop table if exists public.prepass_marketo_mirror_history;
drop table if exists public.prepass_marketo_mirror_contacts;
drop table if exists public.prepass_marketo_mirror_staging;
drop table if exists public.prepass_marketo_mirror_runs;
drop function if exists public.prepass_marketo_safe_timestamptz(text);
drop function if exists public.prepass_marketo_safe_date(text);

commit;
