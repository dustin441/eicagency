begin;

-- Additive normalized source contracts for EIC Client Health. Apply directly as
-- postgres. This migration neither mutates source facts nor activates config.
do $$
declare
  v_postgres_oid oid;
  v_source record;
  v_column record;
  v_existing_count integer;
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

  select pg_catalog.count(*) into v_existing_count
  from (values
    ('client_health_bloom_daily'), ('client_health_nsi_daily'), ('client_health_durodyne_daily'),
    ('client_health_kinsey_daily'), ('client_health_arabella_daily'), ('client_health_champagne_daily'),
    ('client_health_goodgame_ecommerce_daily')
  ) expected(view_name)
  where to_regclass(pg_catalog.format('public.%I', expected.view_name)) is not null;
  if v_existing_count not in (0, 7) then
    raise exception 'normalized client health source views preflight found a partial installation';
  end if;
  if v_existing_count = 7 and exists (
    select 1
    from (values
      ('client_health_arabella_daily', array['c8a486ad40581c25709f11898e3f44005a685259946be172fe2fa287cf1d81e0','dced2da2251b1fe3e963b747953590ca6bce4efa5cbd46a7985ef2711d6f656b']),
      ('client_health_bloom_daily', array['b4ae22a97d7a7d73079e4148f62bda7c9ab1a090da5a4919a055b9737bc7e83e','6721321962a35b8276920aabfb0db9bd3b51da7176022e68c4bb0cd3923940a7']),
      ('client_health_champagne_daily', array['174680e28f690746ac03ce4cc832650f1ddeaa50cbf42067edc82410a922dc10','847e14a0fbf1fad3701e456c2f4ab634c791c2690e3c615634a8558c2cc713cf']),
      ('client_health_durodyne_daily', array['bf0a5b8dc68dfab0a0efdee5ef25e7f310bc30bdc8b58c8d77f9ce782334f505','7f19852c0673e5a6309a9f770bfaecce6e08076213601561ff5dd88355a054d1']),
      ('client_health_goodgame_ecommerce_daily', array['8b4acdfdb45b7c2715f3cfaf9edda9e7b4a66f13262e757fe2edc1fc4a31978b','623a9cb12eb690ac44317a4df3a66cd5f94abeb543429e882855e8cd60e9755f']),
      ('client_health_kinsey_daily', array['17a2c0efefd6ff4719ba7eedfbb4a2bf58e6b21886f260ea722ac27b834517ed','785daf6b87ad62d332df2ed7ca78650061343e5956fca0d7c5d5933f819975d9']),
      ('client_health_nsi_daily', array['61d7256e6f2f3eb8fdf5786e8ad1974613c1818f379d5c38cd477a8acc84ec75','231de4061780e17fa09c1aa6a35757324d7d6ed29c592464701142000fa18623'])
    ) expected(view_name, definition_hashes)
    left join pg_catalog.pg_class c on c.oid = to_regclass(pg_catalog.format('public.%I', expected.view_name))
    where c.relkind <> 'v' or c.relowner <> v_postgres_oid
      or not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=false', 'security_barrier=true']
      or not (pg_catalog.encode(extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256'), 'hex') = any(expected.definition_hashes))
  ) then
    raise exception 'normalized client health source views preflight found definition, owner, type, or security drift';
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

  -- Prevent ingestion writes from racing the validation below and committing
  -- between source validation and view creation. Locks are released at commit.
  lock table public.bloom_meta_ads in share mode;
  lock table public.nsi_master_campaign_daily in share mode;
  lock table public.durodyne_master in share mode;
  lock table public.kinsey_master in share mode;
  lock table public.arabella_master in share mode;
  lock table public.champagne_google in share mode;
  lock table public.champagne_meta in share mode;
  lock table public.goodgame_master in share mode;

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

create or replace view public.client_health_bloom_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(website_chats::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or website_chats::numeric < 0) as invalid_count from public.bloom_meta_ads
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.website_chats::numeric, 0::numeric))::numeric as results
from public.bloom_meta_ads source cross join guard where guard.ok = 1 group by source.date;

create or replace view public.client_health_nsi_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or (date >= date '2026-01-01' and (lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0))) as invalid_count from public.nsi_master_campaign_daily
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.conversions::numeric, 0::numeric))::numeric as results
from public.nsi_master_campaign_daily source cross join guard where guard.ok = 1 and source.date >= date '2026-01-01' group by source.date;

create or replace view public.client_health_durodyne_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0) as invalid_count from public.durodyne_master
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.conversions::numeric, 0::numeric))::numeric as results
from public.durodyne_master source cross join guard where guard.ok = 1 group by source.date;

create or replace view public.client_health_kinsey_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0) as invalid_count from public.kinsey_master
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.revenue::numeric, 0::numeric))::numeric as results
from public.kinsey_master source cross join guard where guard.ok = 1 group by source.date;

create or replace view public.client_health_arabella_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0) as invalid_count from public.arabella_master
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.revenue::numeric, 0::numeric))::numeric as results
from public.arabella_master source cross join guard where guard.ok = 1 group by source.date;

create or replace view public.client_health_champagne_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select sum(invalid_count) as invalid_count from (
    select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0) as invalid_count from public.champagne_google
    union all
    select count(*) filter (where date is null or lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(conversions::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or conversions::numeric < 0) from public.champagne_meta
  ) checks
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
), source as (
  select date, coalesce(cost::numeric, 0::numeric) as cost, coalesce(conversions::numeric, 0::numeric) as conversions from public.champagne_google
  union all
  select date, coalesce(cost::numeric, 0::numeric) as cost, coalesce(conversions::numeric, 0::numeric) as conversions from public.champagne_meta
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(source.cost)::numeric as spend, sum(source.conversions)::numeric as results
from source cross join guard where guard.ok = 1 group by source.date;

create or replace view public.client_health_goodgame_ecommerce_daily with (security_invoker = false, security_barrier = true) as
with invalid as materialized (
  select count(*) filter (where date is null or ((btrim(campaign_name) ~* '(sales|e-?commerce)' or btrim(campaign_name) in (
    'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain', 'MT-MOF-Retargeting Catalog',
    'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)', 'MT | TOF | IC Opt | Headline Test | Sep 14 2025'
  )) and (lower(cost::text) in ('nan','infinity','-infinity','inf','-inf') or lower(revenue::text) in ('nan','infinity','-infinity','inf','-inf') or cost::numeric < 0 or revenue::numeric < 0))) as invalid_count from public.goodgame_master
), guard as materialized (
  select case when invalid_count = 0 then 1 else 1 / (invalid_count - invalid_count) end as ok from invalid
)
select to_char(source.date, 'YYYY-MM-DD')::text as row_key, source.date::date as date,
  sum(coalesce(source.cost::numeric, 0::numeric))::numeric as spend,
  sum(coalesce(source.revenue::numeric, 0::numeric))::numeric as results
from public.goodgame_master source cross join guard
where guard.ok = 1 and (btrim(source.campaign_name) ~* '(sales|e-?commerce)'
   or btrim(source.campaign_name) in (
     'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
     'MT-MOF-Retargeting Catalog',
     'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
     'MT | TOF | IC Opt | Headline Test | Sep 14 2025'
   ))
group by source.date;

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
