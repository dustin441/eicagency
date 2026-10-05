begin;
select pg_advisory_xact_lock(hashtext('prepass_utm_attribution_2026_ytd'));

-- Restore the immutable pre-correction aggregate source exactly. No lifecycle
-- dates or counts are synthesized during rollback.
create or replace view public._mmp_source as
select date,platform,campaign_name,focus,spend,impressions,clicks,platform_conversions,
 mqls,sqls,closed_won,product,call_mqls,call_sqls,call_won,enrollment_mqls,enrollment_sqls,enrollment_won
from prepass_utm_attribution_20261003.raw_mmp_source;

refresh materialized view public.master_marketing_performance;

drop view if exists prepass_utm_attribution_20261003.incremental_corrections;
drop view if exists prepass_utm_attribution_20261003.mapped_events;
drop view if exists prepass_utm_attribution_20261003.corrected_source;
drop function if exists public.prepass_resolve_paid_attribution(text,text,text,text,text,text);
-- Keep raw_mmp_source as rollback evidence. Remove only policy metadata created by
-- this migration; it never contains authoritative lifecycle facts.
drop table if exists public.prepass_utm_campaign_attribution;
commit;
