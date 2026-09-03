begin;

do $$
declare v_referenced boolean := false;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'Spartaco Client Health lane-view rollback requires direct postgres';
  end if;
  if to_regclass('public.client_health_spartaco_leads_daily') is null
     or to_regclass('public.client_health_spartaco_sales_daily') is null then
    raise exception 'Spartaco Client Health lane-view rollback requires the complete installation';
  end if;
  if to_regclass('private.client_health_config_revisions') is not null then
    execute $q$select exists(select 1 from private.client_health_config_revisions cr
      cross join lateral jsonb_array_elements(cr.revision->'clients') c
      cross join lateral jsonb_array_elements(c->'sources') s
      where s->>'relation' in ('client_health_spartaco_leads_daily','client_health_spartaco_sales_daily'))$q$
      into v_referenced;
  end if;
  if v_referenced then
    raise exception 'Spartaco Client Health lane-view rollback refuses while a revision references the views';
  end if;
end$$;

drop view public.client_health_spartaco_sales_daily;
drop view public.client_health_spartaco_leads_daily;
commit;
