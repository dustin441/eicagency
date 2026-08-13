alter table public.eic_meta
  add column if not exists campaign_id text;

create unique index if not exists eic_meta_date_campaign_id_uidx
  on public.eic_meta (date, campaign_id);

create index if not exists eic_meta_campaign_id_idx
  on public.eic_meta (campaign_id);

create or replace function public.replace_eic_ga4_window(p_rows jsonb)
returns table (
  deleted_rows bigint,
  inserted_rows bigint,
  window_start date,
  window_end date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_deleted bigint := 0;
  v_inserted bigint := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'replace_eic_ga4_window requires a non-empty JSON array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) item
    where item ? '_empty'
       or coalesce(item->>'row_key', '') = ''
       or coalesce(item->>'property_id', '') <> '399325751'
       or coalesce(item->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then
    raise exception 'replace_eic_ga4_window received an invalid row';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) item
    group by item->>'row_key'
    having count(*) > 1
  ) then
    raise exception 'replace_eic_ga4_window received duplicate row_key values';
  end if;

  select min((item->>'date')::date), max((item->>'date')::date)
    into v_start, v_end
  from jsonb_array_elements(p_rows) item;

  if v_start is null or v_end is null or v_end < v_start then
    raise exception 'replace_eic_ga4_window could not determine a valid date window';
  end if;

  if v_end - v_start > 31 then
    raise exception 'replace_eic_ga4_window window exceeds 32 calendar days: % to %', v_start, v_end;
  end if;

  delete from public.eic_ga4_daily
  where property_id = '399325751'
    and date between v_start and v_end;
  get diagnostics v_deleted = row_count;

  insert into public.eic_ga4_daily (
    row_key,
    property_id,
    date,
    platform,
    session_source,
    session_medium,
    session_default_channel_group,
    session_campaign_name,
    session_manual_ad_content,
    session_manual_term,
    landing_page,
    campaign_id,
    adset_id,
    ad_id,
    utm_adgroup_name,
    sessions,
    engaged_sessions,
    engagement_rate,
    bounce_rate,
    average_session_duration,
    screen_page_views,
    key_events,
    loaded_at
  )
  select
    row_key,
    property_id,
    date,
    platform,
    session_source,
    session_medium,
    session_default_channel_group,
    session_campaign_name,
    session_manual_ad_content,
    session_manual_term,
    landing_page,
    campaign_id,
    adset_id,
    ad_id,
    utm_adgroup_name,
    sessions,
    engaged_sessions,
    engagement_rate,
    bounce_rate,
    average_session_duration,
    screen_page_views,
    key_events,
    now()
  from jsonb_to_recordset(p_rows) as incoming (
    row_key text,
    property_id text,
    date date,
    platform text,
    session_source text,
    session_medium text,
    session_default_channel_group text,
    session_campaign_name text,
    session_manual_ad_content text,
    session_manual_term text,
    landing_page text,
    campaign_id text,
    adset_id text,
    ad_id text,
    utm_adgroup_name text,
    sessions numeric,
    engaged_sessions numeric,
    engagement_rate numeric,
    bounce_rate numeric,
    average_session_duration numeric,
    screen_page_views numeric,
    key_events numeric
  );
  get diagnostics v_inserted = row_count;

  if v_inserted <> jsonb_array_length(p_rows) then
    raise exception 'replace_eic_ga4_window inserted % of % rows', v_inserted, jsonb_array_length(p_rows);
  end if;

  return query select v_deleted, v_inserted, v_start, v_end;
end;
$$;
