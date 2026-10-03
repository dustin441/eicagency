begin;
select pg_advisory_xact_lock(hashtext('prepass_utm_attribution_2026_ytd'));
create or replace view public._mmp_source as
select date,platform,campaign_name,focus,spend,impressions,clicks,platform_conversions,
 mqls,sqls,closed_won,product,call_mqls,call_sqls,call_won,enrollment_mqls,enrollment_sqls,enrollment_won
from prepass_utm_attribution_20261003.raw_mmp_source;
refresh materialized view public.master_marketing_performance;
commit;
