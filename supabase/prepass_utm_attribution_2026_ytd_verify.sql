do $$
declare v_count bigint;
begin
  select count(*) into v_count
  from public.master_marketing_performance
  where date::date between date '2026-01-01' and current_date
    and lower(platform) = 'unattributed'
    and regexp_replace(lower(coalesce(campaign_name,'')), '[^a-z0-9]', '', 'g') <> 'tempregistrationcode'
    and (coalesce(mqls,0) <> 0 or coalesce(sqls,0) <> 0 or coalesce(closed_won,0) <> 0);
  if v_count <> 0 then raise exception 'Unexpected YTD Unattributed rows: %', v_count; end if;

  select count(*) into v_count
  from public.master_marketing_performance
  where date::date between date '2026-01-01' and current_date
    and regexp_replace(lower(coalesce(campaign_name,'')), '[^a-z0-9]', '', 'g') = 'abmbranddefense';
  if v_count <> 0 then raise exception 'Legacy abm_brand_defense rows remain: %', v_count; end if;

  select count(*) into v_count
  from (
    select * from public._mmp_source
    except all
    select * from public.master_marketing_performance
  ) d;
  if v_count <> 0 then raise exception 'MMP missing source rows: %', v_count; end if;

  select count(*) into v_count
  from (
    select * from public.master_marketing_performance
    except all
    select * from public._mmp_source
  ) d;
  if v_count <> 0 then raise exception 'MMP has stale rows: %', v_count; end if;
end $$;
