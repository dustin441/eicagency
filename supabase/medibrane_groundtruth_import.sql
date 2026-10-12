begin;

create table if not exists public.medibrane_groundtruth_imports (
  id bigint generated always as identity primary key,
  collected_at date not null,
  data_start date,
  data_end date,
  file_names text[] not null check (cardinality(file_names) between 1 and 5),
  file_hashes text[],
  campaign_count integer not null check (campaign_count > 0),
  location_count integer not null check (location_count >= 0),
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

alter table public.medibrane_groundtruth_imports
  add column if not exists file_hashes text[];

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medibrane_groundtruth_imports_file_hashes_check_v1'
      and conrelid = 'public.medibrane_groundtruth_imports'::regclass
  ) then
    alter table public.medibrane_groundtruth_imports
      add constraint medibrane_groundtruth_imports_file_hashes_check_v1
      check (
        file_hashes is null
        or (
          cardinality(file_hashes) between 1 and 5
          and array_to_string(file_hashes, ',', 'NULL') ~ '^[0-9a-f]{64}(,[0-9a-f]{64}){0,4}$'
        )
      );
  end if;
end
$constraint$;

alter table public.medibrane_groundtruth_imports enable row level security;
revoke all on table public.medibrane_groundtruth_imports from public, anon, authenticated;
grant select, insert on table public.medibrane_groundtruth_imports to service_role;

comment on table public.medibrane_groundtruth_imports is
  'Audit trail for agency-initiated GroundTruth XLSX refreshes. Source workbooks remain outside the database.';

drop function if exists public.import_medibrane_groundtruth_snapshot(jsonb, jsonb, date, text[], text);

create or replace function public.import_medibrane_groundtruth_snapshot(
  p_campaigns jsonb,
  p_locations jsonb,
  p_collected_at date,
  p_file_names text[],
  p_file_hashes text[],
  p_uploaded_by text
)
returns table (
  import_id bigint,
  campaign_count integer,
  location_count integer,
  batch_timestamp timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_timestamp timestamptz := clock_timestamp();
  v_campaign_count integer;
  v_location_count integer;
  v_import_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('medibrane_groundtruth_snapshot', 0));

  if p_campaigns is null or jsonb_typeof(p_campaigns) <> 'array' or jsonb_array_length(p_campaigns) = 0 then
    raise exception 'At least one campaign row is required';
  end if;
  if p_locations is null or jsonb_typeof(p_locations) <> 'array' then
    raise exception 'Locations must be a JSON array';
  end if;
  if p_collected_at is null or p_uploaded_by is null or btrim(p_uploaded_by) = '' then
    raise exception 'Collected date and uploader are required';
  end if;
  if p_file_names is null or cardinality(p_file_names) not between 1 and 5 then
    raise exception 'One to five source file names are required';
  end if;
  if p_file_hashes is null
    or cardinality(p_file_hashes) <> cardinality(p_file_names)
    or exists (
      select 1 from unnest(p_file_hashes) as hash
      where hash is null or hash !~ '^[0-9a-f]{64}$'
    ) then
    raise exception 'Each source file requires a valid SHA-256 hash';
  end if;
  if cardinality(p_file_hashes) <> (
    select count(distinct hash)
    from unnest(p_file_hashes) as hash
  ) then
    raise exception 'Source file hashes must be unique within an import';
  end if;
  if exists (
    select 1
    from public.medibrane_groundtruth_imports existing
    where existing.file_hashes && p_file_hashes
  ) then
    raise exception 'One or more workbooks were already imported';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_campaigns) as x(
      campaign_id text, campaign_name text, spend numeric, impressions bigint, clicks bigint,
      reach bigint, data_start date, data_end date
    )
    where campaign_id is null or btrim(campaign_id) = ''
      or campaign_name is null or btrim(campaign_name) = ''
      or (spend is not null and spend < 0)
      or impressions is null or impressions < 0
      or clicks is null or clicks < 0
      or (reach is not null and reach < 0)
      or data_start is null or data_end is null or data_start > data_end
  ) then
    raise exception 'Campaign payload failed validation';
  end if;

  select count(*) into v_campaign_count
  from jsonb_to_recordset(p_campaigns) as x(campaign_id text);
  if v_campaign_count <> (
    select count(distinct campaign_id)
    from jsonb_to_recordset(p_campaigns) as x(campaign_id text)
  ) then
    raise exception 'Campaign payload contains duplicate campaign IDs';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_locations) as x(
      campaign_id text, region_type text, region text, state text,
      city text, impressions bigint, clicks bigint
    )
    where campaign_id is null or btrim(campaign_id) = ''
      or region_type not in ('state', 'dma', 'county', 'zip')
      or region is null or btrim(region) = ''
      or state is null
      or impressions is null or impressions < 0
      or clicks is null or clicks < 0
  ) then
    raise exception 'Location payload failed validation';
  end if;

  select count(*) into v_location_count
  from jsonb_to_recordset(p_locations) as x(campaign_id text);
  if v_location_count <> (
    select count(*)
    from (
      select distinct campaign_id, region_type, region, state
      from jsonb_to_recordset(p_locations) as x(campaign_id text, region_type text, region text, state text)
    ) distinct_locations
  ) then
    raise exception 'Location payload contains duplicate keys';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_locations) as l(campaign_id text)
    where not exists (
      select 1 from jsonb_to_recordset(p_campaigns) as c(campaign_id text)
      where c.campaign_id = l.campaign_id
    )
  ) then
    raise exception 'Every location campaign must be present in the campaign payload';
  end if;

  insert into public.medibrane_groundtruth_campaigns (
    campaign_id, campaign_name, currency, spend, impressions, clicks, reach,
    data_start, data_end, collected_at, updated_at
  )
  select
    x.campaign_id, x.campaign_name, 'USD',
    coalesce(x.spend, existing.spend, 0),
    x.impressions,
    x.clicks,
    coalesce(x.reach, existing.reach, 0),
    x.data_start, x.data_end, p_collected_at, v_batch_timestamp
  from jsonb_to_recordset(p_campaigns) as x(
    campaign_id text, campaign_name text, spend numeric, impressions bigint, clicks bigint,
    reach bigint, data_start date, data_end date
  )
  left join public.medibrane_groundtruth_campaigns existing
    on existing.campaign_id = x.campaign_id
  on conflict (campaign_id) do update set
    campaign_name = excluded.campaign_name,
    currency = excluded.currency,
    spend = excluded.spend,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    reach = excluded.reach,
    data_start = excluded.data_start,
    data_end = excluded.data_end,
    collected_at = excluded.collected_at,
    updated_at = excluded.updated_at;

  insert into public.medibrane_groundtruth_locations (
    campaign_id, region_type, region, state, city, impressions, clicks, collected_at, updated_at
  )
  select
    x.campaign_id, x.region_type, x.region, x.state, x.city,
    x.impressions, x.clicks, p_collected_at, v_batch_timestamp
  from jsonb_to_recordset(p_locations) as x(
    campaign_id text, region_type text, region text, state text,
    city text, impressions bigint, clicks bigint
  )
  on conflict (campaign_id, region_type, region, state) do update set
    city = excluded.city,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    collected_at = excluded.collected_at,
    updated_at = excluded.updated_at;

  delete from public.medibrane_groundtruth_locations existing
  using (
    select distinct campaign_id, region_type
    from jsonb_to_recordset(p_locations) as x(campaign_id text, region_type text)
  ) refreshed_scope
  where existing.campaign_id = refreshed_scope.campaign_id
    and existing.region_type = refreshed_scope.region_type
    and not exists (
      select 1
      from jsonb_to_recordset(p_locations) as incoming(
        campaign_id text, region_type text, region text, state text
      )
      where incoming.campaign_id = existing.campaign_id
        and incoming.region_type = existing.region_type
        and incoming.region = existing.region
        and incoming.state = existing.state
    );

  if v_campaign_count <> (
    select count(*)
    from public.medibrane_groundtruth_campaigns existing
    where exists (
      select 1 from jsonb_to_recordset(p_campaigns) as incoming(campaign_id text)
      where incoming.campaign_id = existing.campaign_id
    )
  ) then
    raise exception 'Campaign read-back verification failed';
  end if;
  if v_location_count <> (
    select count(*)
    from public.medibrane_groundtruth_locations existing
    where exists (
      select 1
      from (
        select distinct campaign_id, region_type
        from jsonb_to_recordset(p_locations) as x(campaign_id text, region_type text)
      ) refreshed_scope
      where refreshed_scope.campaign_id = existing.campaign_id
        and refreshed_scope.region_type = existing.region_type
    )
  ) then
    raise exception 'Location read-back verification failed';
  end if;

  insert into public.medibrane_groundtruth_imports (
    collected_at, data_start, data_end, file_names, file_hashes,
    campaign_count, location_count, uploaded_by, created_at
  )
  select
    p_collected_at,
    min(x.data_start),
    max(x.data_end),
    p_file_names,
    p_file_hashes,
    v_campaign_count,
    v_location_count,
    p_uploaded_by,
    v_batch_timestamp
  from jsonb_to_recordset(p_campaigns) as x(data_start date, data_end date)
  returning id into v_import_id;

  return query select v_import_id, v_campaign_count, v_location_count, v_batch_timestamp;
end;
$$;

revoke all on function public.import_medibrane_groundtruth_snapshot(jsonb, jsonb, date, text[], text[], text) from public, anon, authenticated;
grant execute on function public.import_medibrane_groundtruth_snapshot(jsonb, jsonb, date, text[], text[], text) to service_role;

commit;
