-- Read-only verification for the fail-closed PrePass attribution correction.
do $$
declare
  v_count bigint;
  v_raw record;
  v_corrected record;
begin
  -- Aggregate source parity is intentional until complete event-level evidence is
  -- available from 2026-01-01 onward. This also proves spend cannot be remapped by name.
  select count(*)::bigint rows,
         coalesce(sum(mqls),0)::numeric mqls,
         coalesce(sum(sqls),0)::numeric sqls,
         coalesce(sum(closed_won),0)::numeric won
    into v_raw
    from prepass_utm_attribution_20261003.raw_mmp_source
   where date::date >= date '2026-01-01';

  select count(*)::bigint rows,
         coalesce(sum(mqls),0)::numeric mqls,
         coalesce(sum(sqls),0)::numeric sqls,
         coalesce(sum(closed_won),0)::numeric won
    into v_corrected
    from public.master_marketing_performance
   where date::date >= date '2026-01-01';

  if row(v_corrected.rows,v_corrected.mqls,v_corrected.sqls,v_corrected.won)
     is distinct from row(v_raw.rows,v_raw.mqls,v_raw.sqls,v_raw.won) then
    raise exception 'YTD lifecycle parity failed: corrected %, raw %', v_corrected, v_raw;
  end if;

  select count(*) into v_count from (
    select * from prepass_utm_attribution_20261003.raw_mmp_source
    except all
    select * from public.master_marketing_performance
  ) d;
  if v_count <> 0 then raise exception 'MMP missing baseline rows: %', v_count; end if;

  select count(*) into v_count from (
    select * from public.master_marketing_performance
    except all
    select * from prepass_utm_attribution_20261003.raw_mmp_source
  ) d;
  if v_count <> 0 then raise exception 'MMP contains name-only remapped or stale rows: %', v_count; end if;

  -- Missing evidence must not resolve merely because a known campaign label exists.
  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('abm_brand_defense');
  if v_count <> 0 then raise exception 'Campaign name alone resolved paid attribution'; end if;

  -- Technical registration codes remain explicitly unattributed.
  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('tempRegistrationCode')
  where target_platform = 'Unattributed' and evidence_kind = 'technical-unattributed';
  if v_count <> 1 then raise exception 'tempRegistrationCode technical handling failed'; end if;
end $$;

-- Diagnostic only: retained Unattributed lifecycle rows are expected under the
-- approved fail-closed policy and must not make verification fail.
select campaign_name,
       sum(mqls) as mqls,
       sum(sqls) as sqls,
       sum(closed_won) as won
from public.master_marketing_performance
where date::date >= date '2026-01-01'
  and lower(platform) = 'unattributed'
group by campaign_name
order by campaign_name;
