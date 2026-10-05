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
  if not exists (
    select 1 from pg_constraint
    where conname = 'prepass_campaign_aliases_campaign_id_chk'
      and conrelid = 'public.prepass_campaign_name_aliases'::regclass
  ) then
    alter table public.prepass_campaign_name_aliases
      add constraint prepass_campaign_aliases_campaign_id_chk check (btrim(campaign_id) <> '');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'prepass_campaign_aliases_alias_name_chk'
      and conrelid = 'public.prepass_campaign_name_aliases'::regclass
  ) then
    alter table public.prepass_campaign_name_aliases
      add constraint prepass_campaign_aliases_alias_name_chk check (btrim(alias_name) <> '');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'prepass_campaign_aliases_canonical_name_chk'
      and conrelid = 'public.prepass_campaign_name_aliases'::regclass
  ) then
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

create or replace function public.upsert_prepass_campaign_alias(
  p_platform text, p_campaign_id text, p_alias_name text, p_seen date
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_canonical_name text;
begin
  if p_platform not in ('Meta', 'Google')
     or nullif(btrim(p_campaign_id), '') is null
     or nullif(btrim(p_alias_name), '') is null then
    return;
  end if;

  if p_platform = 'Meta' then
    select campaign_name into v_canonical_name
    from public.meta_campaigns
    where campaign_id::text = p_campaign_id
      and date is not null
      and nullif(btrim(campaign_name), '') is not null
    order by date desc, campaign_name desc
    limit 1;
  else
    select campaign_name into v_canonical_name
    from public.google_campaigns
    where campaign_id::text = p_campaign_id
      and date is not null
      and nullif(btrim(campaign_name), '') is not null
    order by date desc, campaign_name desc
    limit 1;
  end if;

  if v_canonical_name is null then return; end if;

  update public.prepass_campaign_name_aliases
     set canonical_name = v_canonical_name,
         updated_at = now()
   where platform = p_platform
     and campaign_id = p_campaign_id
     and canonical_name is distinct from v_canonical_name;

  insert into public.prepass_campaign_name_aliases
    (platform, campaign_id, alias_name, canonical_name, first_seen, last_seen, updated_at)
  values
    (p_platform, p_campaign_id, p_alias_name, v_canonical_name, p_seen, p_seen, now())
  on conflict (platform, campaign_id, alias_name) do update
    set canonical_name = excluded.canonical_name,
        first_seen = coalesce(least(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
                              public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
        last_seen = coalesce(greatest(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
                             public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
        updated_at = now();
end;
$$;

create or replace function public.capture_prepass_campaign_name_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_platform text;
begin
  v_platform := case tg_table_name
    when 'meta_campaigns' then 'Meta'
    when 'google_campaigns' then 'Google'
    else null
  end;
  if v_platform is null then
    raise exception 'Unsupported PrePass campaign source table: %', tg_table_name;
  end if;

  -- Inserts are first-class alias observations. Canonical selection happens only
  -- after the source write and always uses the greatest source date.
  perform public.upsert_prepass_campaign_alias(
    v_platform, new.campaign_id::text, new.campaign_name, new.date
  );
  if tg_op = 'UPDATE'
     and row(old.campaign_id, old.campaign_name, old.date)
         is distinct from row(new.campaign_id, new.campaign_name, new.date) then
    perform public.upsert_prepass_campaign_alias(
      v_platform, old.campaign_id::text, old.campaign_name, old.date
    );
  end if;

  return new;
end;
$$;

revoke all on function public.upsert_prepass_campaign_alias(text,text,text,date) from public, anon, authenticated;
revoke all on function public.capture_prepass_campaign_name_change() from public, anon, authenticated;

drop trigger if exists capture_prepass_campaign_name_change on public.meta_campaigns;
create trigger capture_prepass_campaign_name_change
after insert or update on public.meta_campaigns
for each row
execute function public.capture_prepass_campaign_name_change();

drop trigger if exists capture_prepass_campaign_name_change on public.google_campaigns;
create trigger capture_prepass_campaign_name_change
after insert or update on public.google_campaigns
for each row
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
      order by campaign_id::text, date desc, campaign_name desc
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
      order by campaign_id::text, date desc, campaign_name desc
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
          first_seen = coalesce(least(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
                                public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
          last_seen = coalesce(greatest(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
                               public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
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
      order by campaign_id::text, date desc, campaign_name desc
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
      order by campaign_id::text, date desc, campaign_name desc
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
          first_seen = coalesce(least(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
                                public.prepass_campaign_name_aliases.first_seen, excluded.first_seen),
          last_seen = coalesce(greatest(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
                               public.prepass_campaign_name_aliases.last_seen, excluded.last_seen),
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
  set first_seen = least(coalesce(public.prepass_campaign_name_aliases.first_seen, excluded.first_seen), excluded.first_seen),
      last_seen = greatest(coalesce(public.prepass_campaign_name_aliases.last_seen, excluded.last_seen), excluded.last_seen),
      updated_at = now();

-- Run last so rerunning this migration always restores the latest source name
-- as canonical, including for the historical seed above.
select public.sync_prepass_campaign_name_aliases('Meta');
select public.sync_prepass_campaign_name_aliases('Google');

commit;
