begin;

create table if not exists public.prepass_campaign_name_aliases (
  platform text not null constraint prepass_campaign_aliases_platform_chk check (platform in ('Meta', 'Google')),
  campaign_id text not null constraint prepass_campaign_aliases_campaign_id_chk check (btrim(campaign_id) <> ''),
  alias_name text not null constraint prepass_campaign_aliases_alias_name_chk check (btrim(alias_name) <> ''),
  canonical_name text not null constraint prepass_campaign_aliases_canonical_name_chk check (btrim(canonical_name) <> ''),
  first_seen date,
  last_seen date,
  updated_at timestamptz not null default now(),
  primary key (platform, campaign_id, alias_name)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prepass_campaign_aliases_campaign_id_chk') then
    alter table public.prepass_campaign_name_aliases
      add constraint prepass_campaign_aliases_campaign_id_chk check (btrim(campaign_id) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prepass_campaign_aliases_alias_name_chk') then
    alter table public.prepass_campaign_name_aliases
      add constraint prepass_campaign_aliases_alias_name_chk check (btrim(alias_name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prepass_campaign_aliases_canonical_name_chk') then
    alter table public.prepass_campaign_name_aliases
      add constraint prepass_campaign_aliases_canonical_name_chk check (btrim(canonical_name) <> '');
  end if;
end;
$$;

create index if not exists prepass_campaign_name_aliases_lookup_idx
  on public.prepass_campaign_name_aliases (platform, lower(alias_name));

alter table public.prepass_campaign_name_aliases enable row level security;
revoke all on public.prepass_campaign_name_aliases from public, anon, authenticated;
grant select on public.prepass_campaign_name_aliases to service_role;

create or replace function public.capture_prepass_campaign_name_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_platform text;
begin
  if old.campaign_id is distinct from new.campaign_id
     or old.campaign_name is not distinct from new.campaign_name
     or nullif(btrim(old.campaign_name), '') is null
     or nullif(btrim(new.campaign_name), '') is null then
    return new;
  end if;

  v_platform := case tg_table_name
    when 'meta_campaigns' then 'Meta'
    when 'google_campaigns' then 'Google'
    else null
  end;
  if v_platform is null then
    raise exception 'Unsupported PrePass campaign source table: %', tg_table_name;
  end if;

  update public.prepass_campaign_name_aliases
     set canonical_name = new.campaign_name,
         updated_at = now()
   where platform = v_platform
     and campaign_id = new.campaign_id::text
     and canonical_name is distinct from new.campaign_name;

  insert into public.prepass_campaign_name_aliases
    (platform, campaign_id, alias_name, canonical_name, first_seen, last_seen, updated_at)
  values
    (v_platform, new.campaign_id::text, old.campaign_name, new.campaign_name, old.date, old.date, now()),
    (v_platform, new.campaign_id::text, new.campaign_name, new.campaign_name, new.date, new.date, now())
  on conflict (platform, campaign_id, alias_name) do update
    set canonical_name = excluded.canonical_name,
        first_seen = least(coalesce(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen), excluded.first_seen),
        last_seen = greatest(coalesce(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen), excluded.last_seen),
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_prepass_campaign_name_change() from public, anon, authenticated;

drop trigger if exists capture_prepass_campaign_name_change on public.meta_campaigns;
create trigger capture_prepass_campaign_name_change
before update of campaign_name on public.meta_campaigns
for each row
when (old.campaign_name is distinct from new.campaign_name)
execute function public.capture_prepass_campaign_name_change();

drop trigger if exists capture_prepass_campaign_name_change on public.google_campaigns;
create trigger capture_prepass_campaign_name_change
before update of campaign_name on public.google_campaigns
for each row
when (old.campaign_name is distinct from new.campaign_name)
execute function public.capture_prepass_campaign_name_change();

create or replace function public.sync_prepass_campaign_name_aliases(p_platform text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if p_platform = 'Meta' then
    with latest as (
      select distinct on (campaign_id::text)
        campaign_id::text as campaign_id,
        campaign_name as canonical_name
      from public.meta_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      order by campaign_id::text, date desc
    )
    update public.prepass_campaign_name_aliases a
       set canonical_name = l.canonical_name,
           updated_at = now()
      from latest l
     where a.platform = 'Meta'
       and a.campaign_id = l.campaign_id
       and a.canonical_name is distinct from l.canonical_name;

    with latest as (
      select distinct on (campaign_id::text)
        campaign_id::text as campaign_id,
        campaign_name as canonical_name
      from public.meta_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      order by campaign_id::text, date desc
    ), observed as (
      select
        campaign_id::text as campaign_id,
        campaign_name as alias_name,
        min(date) as first_seen,
        max(date) as last_seen
      from public.meta_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      group by campaign_id::text, campaign_name
    )
    insert into public.prepass_campaign_name_aliases
      (platform, campaign_id, alias_name, canonical_name, first_seen, last_seen, updated_at)
    select 'Meta', o.campaign_id, o.alias_name, l.canonical_name,
           o.first_seen, o.last_seen, now()
      from observed o
      join latest l using (campaign_id)
    on conflict (platform, campaign_id, alias_name) do update
      set canonical_name = excluded.canonical_name,
          first_seen = least(coalesce(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen), excluded.first_seen),
          last_seen = greatest(coalesce(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen), excluded.last_seen),
          updated_at = now();

  elsif p_platform = 'Google' then
    with latest as (
      select distinct on (campaign_id::text)
        campaign_id::text as campaign_id,
        campaign_name as canonical_name
      from public.google_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      order by campaign_id::text, date desc
    )
    update public.prepass_campaign_name_aliases a
       set canonical_name = l.canonical_name,
           updated_at = now()
      from latest l
     where a.platform = 'Google'
       and a.campaign_id = l.campaign_id
       and a.canonical_name is distinct from l.canonical_name;

    with latest as (
      select distinct on (campaign_id::text)
        campaign_id::text as campaign_id,
        campaign_name as canonical_name
      from public.google_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      order by campaign_id::text, date desc
    ), observed as (
      select
        campaign_id::text as campaign_id,
        campaign_name as alias_name,
        min(date) as first_seen,
        max(date) as last_seen
      from public.google_campaigns
      where campaign_id is not null
        and date is not null
        and nullif(btrim(campaign_name), '') is not null
      group by campaign_id::text, campaign_name
    )
    insert into public.prepass_campaign_name_aliases
      (platform, campaign_id, alias_name, canonical_name, first_seen, last_seen, updated_at)
    select 'Google', o.campaign_id, o.alias_name, l.canonical_name,
           o.first_seen, o.last_seen, now()
      from observed o
      join latest l using (campaign_id)
    on conflict (platform, campaign_id, alias_name) do update
      set canonical_name = excluded.canonical_name,
          first_seen = least(coalesce(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen), excluded.first_seen),
          last_seen = greatest(coalesce(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen), excluded.last_seen),
          updated_at = now();
  else
    raise exception 'Unsupported PrePass ads platform: %', p_platform;
  end if;

  select count(*)::integer into v_count
    from public.prepass_campaign_name_aliases
   where platform = p_platform;
  return v_count;
end;
$$;

revoke all on function public.sync_prepass_campaign_name_aliases(text) from public, anon, authenticated;
grant execute on function public.sync_prepass_campaign_name_aliases(text) to service_role;

select public.sync_prepass_campaign_name_aliases('Meta');
select public.sync_prepass_campaign_name_aliases('Google');

-- Confirmed 2026-09-29 Meta rename: retain the old UTM label even though it no
-- longer survives in the rolling source window.
insert into public.prepass_campaign_name_aliases
  (platform, campaign_id, alias_name, canonical_name, first_seen, last_seen, updated_at)
values (
  'Meta',
  '120249350732760438',
  'ABM | PrePass | Website leads - FMCSA 200+ & BEST INTERESTS',
  'ABM | PrePass | Website leads - BEST INTERESTS',
  '2026-09-29',
  '2026-09-29',
  now()
)
on conflict (platform, campaign_id, alias_name) do update
  set canonical_name = excluded.canonical_name,
      first_seen = least(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
      last_seen = greatest(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
      updated_at = now();

commit;
