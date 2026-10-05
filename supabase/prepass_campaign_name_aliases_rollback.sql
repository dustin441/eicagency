begin;

drop trigger if exists capture_prepass_campaign_name_change on public.meta_campaigns;
drop trigger if exists capture_prepass_campaign_name_change on public.google_campaigns;
drop function if exists public.capture_prepass_campaign_name_change();
drop function if exists public.upsert_prepass_campaign_alias(text,text,text,date);
drop function if exists public.sync_prepass_campaign_name_aliases(text);
drop table if exists public.prepass_campaign_name_aliases;

commit;
