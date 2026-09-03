begin;

-- Additive normalized source contracts for EIC Client Health. Apply directly as
-- postgres. This migration neither mutates source facts nor activates config.
do $$
declare
  v_postgres_oid oid;
  v_source record;
  v_column record;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'normalized client health source views require a direct postgres session';
  end if;

  select oid into v_postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'normalized client health source views require the managed postgres owner role';
  end if;
  if to_regclass('public.master_spartaco') is null then
    raise exception 'normalized client health source views must be applied to the EIC Clients project';
  end if;
  if exists (
    select 1 from (values ('anon'), ('authenticated'), ('service_role')) expected(role_name)
    where not exists (select 1 from pg_catalog.pg_roles r where r.rolname = expected.role_name)
  ) then
    raise exception 'normalized client health source views require anon, authenticated, and service_role roles';
  end if;

  if exists (
    select 1 from (values
      ('client_health_bloom_daily'),
      ('client_health_nsi_daily'),
      ('client_health_durodyne_daily'),
      ('client_health_kinsey_daily'),
      ('client_health_arabella_daily'),
      ('client_health_champagne_daily'),
      ('client_health_goodgame_ecommerce_daily')
    ) expected(view_name)
    where to_regclass(pg_catalog.format('public.%I', expected.view_name)) is not null
  ) then
    raise exception 'normalized client health source views preflight found a prior or conflicting installation';
  end if;

  for v_source in
    select * from (values
      ('bloom_meta_ads'),
      ('nsi_master_campaign_daily'),
      ('durodyne_master'),
      ('kinsey_master'),
      ('arabella_master'),
      ('champagne_google'),
      ('champagne_meta'),
      ('goodgame_master')
    ) required(relation_name)
  loop
    if to_regclass(pg_catalog.format('public.%I', v_source.relation_name)) is null
       or not exists (
         select 1
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = v_source.relation_name
           and c.relkind in ('r', 'p', 'v', 'm') and c.relowner = v_postgres_oid
       ) then
      raise exception 'normalized client health source views require postgres-owned source relation public.%', v_source.relation_name;
    end if;
  end loop;

  for v_column in
    select * from (values
      ('bloom_meta_ads', 'date', 'date'), ('bloom_meta_ads', 'cost', 'numeric'), ('bloom_meta_ads', 'website_chats', 'numeric'),
      ('nsi_master_campaign_daily', 'date', 'date'), ('nsi_master_campaign_daily', 'cost', 'numeric'), ('nsi_master_campaign_daily', 'conversions', 'numeric'),
      ('durodyne_master', 'date', 'date'), ('durodyne_master', 'cost', 'numeric'), ('durodyne_master', 'conversions', 'numeric'),
      ('kinsey_master', 'date', 'date'), ('kinsey_master', 'cost', 'numeric'), ('kinsey_master', 'revenue', 'numeric'),
      ('arabella_master', 'date', 'date'), ('arabella_master', 'cost', 'numeric'), ('arabella_master', 'revenue', 'numeric'),
      ('champagne_google', 'date', 'date'), ('champagne_google', 'cost', 'numeric'), ('champagne_google', 'conversions', 'numeric'),
      ('champagne_meta', 'date', 'date'), ('champagne_meta', 'cost', 'numeric'), ('champagne_meta', 'conversions', 'numeric'),
      ('goodgame_master', 'date', 'date'), ('goodgame_master', 'campaign_name', 'string'), ('goodgame_master', 'cost', 'numeric'), ('goodgame_master', 'revenue', 'numeric')
    ) required(relation_name, column_name, type_kind)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_type t on t.oid = a.atttypid
      where n.nspname = 'public' and c.relname = v_column.relation_name
        and a.attname = v_column.column_name and a.attnum > 0 and not a.attisdropped
        and ((v_column.type_kind = 'date' and a.atttypid = 'date'::pg_catalog.regtype)
          or (v_column.type_kind = 'numeric' and t.typcategory = 'N')
          or (v_column.type_kind = 'string' and t.typcategory = 'S'))
    ) then
      raise exception 'normalized client health source views require public.%.% with % type',
        v_column.relation_name, v_column.column_name, v_column.type_kind;
    end if;
  end loop;

  -- Null measures normalize to zero. Null dates and negative/non-finite measures
  -- fail closed for every row in each normalized contract's effective scope.
  if exists (select 1 from public.bloom_meta_ads where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(website_chats::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or website_chats::numeric < 0) then
    raise exception 'normalized Bloom source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (select 1 from public.nsi_master_campaign_daily where date is null or (date >= date '2026-01-01' and (lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0))) then
    raise exception 'normalized NSI source contains an invalid date or negative/non-finite in-contract measure';
  end if;
  if exists (select 1 from public.durodyne_master where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0) then
    raise exception 'normalized Duro Dyne source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (select 1 from public.kinsey_master where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0) then
    raise exception 'normalized Kinsey source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (select 1 from public.arabella_master where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0) then
    raise exception 'normalized Arabella source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (select 1 from public.champagne_google where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0)
     or exists (select 1 from public.champagne_meta where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0) then
    raise exception 'normalized Champagne source contains an invalid date or negative/non-finite measure';
  end if;
  if exists (
    select 1 from public.goodgame_master
    where date is null
       or ((btrim(campaign_name) ~* '(sales|e-?commerce)'
         or btrim(campaign_name) in (
           'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
           'MT-MOF-Retargeting Catalog',
           'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
           'MT | TOF | IC Opt | Headline Test | Sep 14 2025'
         )) and (lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0))
  ) then
    raise exception 'normalized Good Game source contains an invalid date or negative/non-finite eCommerce measure';
  end if;
end
$$;

create view public.client_health_bloom_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(website_chats::numeric, 0::numeric))::numeric as results
from public.bloom_meta_ads group by date;

create view public.client_health_nsi_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(conversions::numeric, 0::numeric))::numeric as results
from public.nsi_master_campaign_daily where date >= date '2026-01-01' group by date;

create view public.client_health_durodyne_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(conversions::numeric, 0::numeric))::numeric as results
from public.durodyne_master group by date;

create view public.client_health_kinsey_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(revenue::numeric, 0::numeric))::numeric as results
from public.kinsey_master group by date;

create view public.client_health_arabella_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(revenue::numeric, 0::numeric))::numeric as results
from public.arabella_master group by date;

create view public.client_health_champagne_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(cost)::numeric as spend, sum(conversions)::numeric as results
from (
  select date, coalesce(cost::numeric, 0::numeric) as cost, coalesce(conversions::numeric, 0::numeric) as conversions from public.champagne_google
  union all
  select date, coalesce(cost::numeric, 0::numeric) as cost, coalesce(conversions::numeric, 0::numeric) as conversions from public.champagne_meta
) source group by date;

create view public.client_health_goodgame_ecommerce_daily with (security_invoker = false, security_barrier = true) as
select to_char(date, 'YYYY-MM-DD')::text as row_key, date::date as date,
  sum(coalesce(cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(revenue::numeric, 0::numeric))::numeric as results
from public.goodgame_master
where btrim(campaign_name) ~* '(sales|e-?commerce)'
   or btrim(campaign_name) in (
     'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
     'MT-MOF-Retargeting Catalog',
     'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
     'MT | TOF | IC Opt | Headline Test | Sep 14 2025'
   )
group by date;

alter view public.client_health_bloom_daily owner to postgres;
alter view public.client_health_nsi_daily owner to postgres;
alter view public.client_health_durodyne_daily owner to postgres;
alter view public.client_health_kinsey_daily owner to postgres;
alter view public.client_health_arabella_daily owner to postgres;
alter view public.client_health_champagne_daily owner to postgres;
alter view public.client_health_goodgame_ecommerce_daily owner to postgres;

revoke all on table public.client_health_bloom_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_nsi_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_durodyne_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_kinsey_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_arabella_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_champagne_daily from public, anon, authenticated, service_role;
revoke all on table public.client_health_goodgame_ecommerce_daily from public, anon, authenticated, service_role;
grant select on table public.client_health_bloom_daily to service_role;
grant select on table public.client_health_nsi_daily to service_role;
grant select on table public.client_health_durodyne_daily to service_role;
grant select on table public.client_health_kinsey_daily to service_role;
grant select on table public.client_health_arabella_daily to service_role;
grant select on table public.client_health_champagne_daily to service_role;
grant select on table public.client_health_goodgame_ecommerce_daily to service_role;

comment on view public.client_health_bloom_daily is 'Service-role-only deterministic daily Bloom Client Health source contract aggregated from bloom_meta_ads.';
comment on view public.client_health_nsi_daily is 'Service-role-only deterministic daily NSI Client Health source contract aggregated from nsi_master_campaign_daily on and after 2026-01-01.';
comment on view public.client_health_durodyne_daily is 'Service-role-only deterministic daily Duro Dyne Client Health source contract aggregated from durodyne_master.';
comment on view public.client_health_kinsey_daily is 'Service-role-only deterministic daily Kinsey Client Health source contract aggregated from kinsey_master.';
comment on view public.client_health_arabella_daily is 'Service-role-only deterministic daily Arabella Client Health source contract aggregated from arabella_master.';
comment on view public.client_health_champagne_daily is 'Service-role-only deterministic daily Champagne Client Health source contract aggregated across champagne_google and champagne_meta.';
comment on view public.client_health_goodgame_ecommerce_daily is 'Service-role-only deterministic daily Good Game eCommerce Client Health source contract using the shared approved campaign taxonomy.';
comment on column public.client_health_bloom_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_nsi_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_durodyne_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_kinsey_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_arabella_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_champagne_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_goodgame_ecommerce_daily.row_key is 'Canonical YYYY-MM-DD text for date; unique within this view.';
comment on column public.client_health_bloom_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_nsi_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_durodyne_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_kinsey_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_arabella_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_champagne_daily.spend is 'Daily paid-media spend in source currency.';
comment on column public.client_health_goodgame_ecommerce_daily.spend is 'Daily paid-media spend in source currency for approved eCommerce campaigns.';
comment on column public.client_health_bloom_daily.results is 'Daily website chat count.';
comment on column public.client_health_nsi_daily.results is 'Daily conversion count on and after 2026-01-01.';
comment on column public.client_health_durodyne_daily.results is 'Daily conversion count.';
comment on column public.client_health_kinsey_daily.results is 'Daily revenue in source currency.';
comment on column public.client_health_arabella_daily.results is 'Daily revenue in source currency.';
comment on column public.client_health_champagne_daily.results is 'Daily conversion count across Google and Meta.';
comment on column public.client_health_goodgame_ecommerce_daily.results is 'Daily revenue in source currency for approved eCommerce campaigns.';

commit;
