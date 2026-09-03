begin;

-- pgTAP-independent, read-only verification for the applied normalized source
-- views. Run directly as postgres in the EIC Clients project.
do $$
declare
  v_postgres_oid oid;
  v_service_role_oid oid;
  v_view record;
  v_columns text[];
  v_types text[];
  v_definition text;
  v_source_name text;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'VERIFY FAILED: normalized source-view verification requires a direct postgres session';
  end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles where rolname = 'postgres';
  select oid into v_service_role_oid from pg_catalog.pg_roles where rolname = 'service_role';
  if v_postgres_oid is null or v_service_role_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'VERIFY FAILED: EIC sentinel or required owner/API role is missing';
  end if;

  for v_view in
    select * from (values
      ('client_health_bloom_daily', array['bloom_meta_ads']::text[]),
      ('client_health_nsi_daily', array['nsi_master_campaign_daily']::text[]),
      ('client_health_durodyne_daily', array['durodyne_master']::text[]),
      ('client_health_kinsey_daily', array['kinsey_master']::text[]),
      ('client_health_arabella_daily', array['arabella_master']::text[]),
      ('client_health_champagne_daily', array['champagne_google','champagne_meta']::text[]),
      ('client_health_goodgame_ecommerce_daily', array['goodgame_master']::text[])
    ) expected(view_name, source_names)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_view.view_name)) is null
       or not exists (
         select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = v_view.view_name and c.relkind = 'v'
           and c.relowner = v_postgres_oid
           and c.reloptions @> array['security_invoker=false', 'security_barrier=true']::text[]
       ) then
      raise exception 'VERIFY FAILED: public.% is not a postgres-owned fixed-option security-definer barrier view', v_view.view_name;
    end if;

    select pg_catalog.array_agg(a.attname order by a.attnum),
           pg_catalog.array_agg(pg_catalog.format_type(a.atttypid, a.atttypmod) order by a.attnum)
      into v_columns, v_types
    from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
      and a.attnum > 0 and not a.attisdropped;
    if v_columns <> array['row_key','date','spend','results']::text[]
       or v_types <> array['text','date','numeric','numeric']::text[] then
      raise exception 'VERIFY FAILED: public.% columns/types are %, %', v_view.view_name, v_columns, v_types;
    end if;

    v_definition := pg_catalog.pg_get_viewdef(pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass, true);
    foreach v_source_name in array v_view.source_names loop
      if pg_catalog.strpos(v_definition, v_source_name) = 0 then
        raise exception 'VERIFY FAILED: public.% does not use required source %', v_view.view_name, v_source_name;
      end if;
    end loop;

    if not pg_catalog.has_table_privilege('service_role', pg_catalog.format('public.%I', v_view.view_name), 'SELECT')
       or pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', v_view.view_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or exists (
         select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) acl
         where c.oid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and (acl.grantee = 0
             or acl.grantee not in (v_postgres_oid, v_service_role_oid)
             or (acl.grantee = v_service_role_oid and acl.privilege_type <> 'SELECT'))
       )
       or exists (
         select 1 from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.format('public.%I', v_view.view_name)::pg_catalog.regclass
           and a.attnum > 0 and a.attacl is not null
       ) then
      raise exception 'VERIFY FAILED: public.% is not service-role-only SELECT', v_view.view_name;
    end if;
  end loop;

  if exists (select 1 from public.client_health_bloom_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_nsi_daily where row_key is null or date is null or date < date '2026-01-01' or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_durodyne_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_kinsey_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_arabella_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_champagne_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf'))
     or exists (select 1 from public.client_health_goodgame_ecommerce_daily where row_key is null or date is null or spend is null or results is null or row_key <> pg_catalog.to_char(date,'YYYY-MM-DD') or spend < 0 or results < 0 or lower(spend::text) in ('nan','infinity','-infinity','inf','-inf') or lower(results::text) in ('nan','infinity','-infinity','inf','-inf')) then
    raise exception 'VERIFY FAILED: normalized view canonical/null/nonnegative/finite contract failed';
  end if;

  if (select count(*) from public.client_health_bloom_daily) <> (select count(distinct row_key) from public.client_health_bloom_daily)
     or (select count(*) from public.client_health_nsi_daily) <> (select count(distinct row_key) from public.client_health_nsi_daily)
     or (select count(*) from public.client_health_durodyne_daily) <> (select count(distinct row_key) from public.client_health_durodyne_daily)
     or (select count(*) from public.client_health_kinsey_daily) <> (select count(distinct row_key) from public.client_health_kinsey_daily)
     or (select count(*) from public.client_health_arabella_daily) <> (select count(distinct row_key) from public.client_health_arabella_daily)
     or (select count(*) from public.client_health_champagne_daily) <> (select count(distinct row_key) from public.client_health_champagne_daily)
     or (select count(*) from public.client_health_goodgame_ecommerce_daily) <> (select count(distinct row_key) from public.client_health_goodgame_ecommerce_daily) then
    raise exception 'VERIFY FAILED: normalized view row_key uniqueness failed';
  end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_bloom_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(website_chats::numeric,0)) from public.bloom_meta_ads group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(website_chats::numeric,0)) from public.bloom_meta_ads group by date except all select row_key,date,spend,results from public.client_health_bloom_daily)
  ) then raise exception 'VERIFY FAILED: Bloom parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_nsi_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(conversions::numeric,0)) from public.nsi_master_campaign_daily where date >= date '2026-01-01' group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(conversions::numeric,0)) from public.nsi_master_campaign_daily where date >= date '2026-01-01' group by date except all select row_key,date,spend,results from public.client_health_nsi_daily)
  ) then raise exception 'VERIFY FAILED: NSI normalized-scope parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_durodyne_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(conversions::numeric,0)) from public.durodyne_master group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(conversions::numeric,0)) from public.durodyne_master group by date except all select row_key,date,spend,results from public.client_health_durodyne_daily)
  ) then raise exception 'VERIFY FAILED: Duro Dyne parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_kinsey_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.kinsey_master group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.kinsey_master group by date except all select row_key,date,spend,results from public.client_health_kinsey_daily)
  ) then raise exception 'VERIFY FAILED: Kinsey parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_arabella_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.arabella_master group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.arabella_master group by date except all select row_key,date,spend,results from public.client_health_arabella_daily)
  ) then raise exception 'VERIFY FAILED: Arabella parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_champagne_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(cost),sum(conversions) from (select date,coalesce(cost::numeric,0) cost,coalesce(conversions::numeric,0) conversions from public.champagne_google union all select date,coalesce(cost::numeric,0),coalesce(conversions::numeric,0) from public.champagne_meta) source group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(cost),sum(conversions) from (select date,coalesce(cost::numeric,0) cost,coalesce(conversions::numeric,0) conversions from public.champagne_google union all select date,coalesce(cost::numeric,0),coalesce(conversions::numeric,0) from public.champagne_meta) source group by date except all select row_key,date,spend,results from public.client_health_champagne_daily)
  ) then raise exception 'VERIFY FAILED: Champagne union parity totals differ'; end if;

  if exists (
    (select row_key,date,spend,results from public.client_health_goodgame_ecommerce_daily except all select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.goodgame_master where btrim(campaign_name) ~* '(sales|e-?commerce)' or btrim(campaign_name) in ('MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain','MT-MOF-Retargeting Catalog','MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)','MT | TOF | IC Opt | Headline Test | Sep 14 2025') group by date)
    union all
    (select to_char(date,'YYYY-MM-DD'),date,sum(coalesce(cost::numeric,0)),sum(coalesce(revenue::numeric,0)) from public.goodgame_master where btrim(campaign_name) ~* '(sales|e-?commerce)' or btrim(campaign_name) in ('MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain','MT-MOF-Retargeting Catalog','MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)','MT | TOF | IC Opt | Headline Test | Sep 14 2025') group by date except all select row_key,date,spend,results from public.client_health_goodgame_ecommerce_daily)
  ) then raise exception 'VERIFY FAILED: Good Game eCommerce normalized-scope parity totals differ'; end if;

  raise notice 'client_health_normalized_source_views_verify: all checks passed';
end
$$;

rollback;
