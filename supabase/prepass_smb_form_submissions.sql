-- Qualified PrePass landing-page submissions for SMB Mobile App and FD360.
--
-- SMB is additive to its existing native Lead Ads pipeline. FD360 replaces only
-- the FD360.html contacts' Created-at placement across the available history;
-- FD360 contacts from every other origin remain unchanged. Both RPCs return
-- contact-deduplicated adjustments split by date/platform for reconciliation.

begin;

create table if not exists public.prepass_smb_form_submissions (
  marketo_guid text primary key,
  id_marketo text not null,
  activity_date timestamptz not null,
  form_id text not null,
  landing_page text not null,
  marketo_created_at timestamptz,
  fleet_size text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_adgroup_name text,
  utm_campaign_id text,
  utm_adset_id text,
  utm_ad_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prepass_smb_form_submissions_activity_date_idx
  on public.prepass_smb_form_submissions(activity_date);
create index if not exists prepass_smb_form_submissions_lead_idx
  on public.prepass_smb_form_submissions(id_marketo);
create index if not exists prepass_smb_form_submissions_page_idx
  on public.prepass_smb_form_submissions(lower(landing_page));

alter table public.prepass_smb_form_submissions enable row level security;
grant select, insert, update on public.prepass_smb_form_submissions to service_role;

create or replace function public.prepass_safe_date(p_value text)
returns date
language plpgsql
immutable
strict
security invoker
as $function$
begin
  if p_value !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_value, 10)::date;
exception when others then
  return null;
end;
$function$;

revoke execute on function public.prepass_safe_date(text) from public, anon, authenticated;
grant execute on function public.prepass_safe_date(text) to service_role;

create or replace function public.prepass_smb_lp_adjustments(
  p_start date,
  p_end date,
  p_channel text default null
)
returns table(
  adjustment_date date,
  platform text,
  lp_leads bigint,
  add_mqls bigint,
  add_sqls bigint,
  add_won bigint
)
language sql
stable
security invoker
as $function$
  with mobile_events as (
    select
      s.*,
      case
        when lower(coalesce(s.utm_source, '')) like '%google%' then 'Google'
        when lower(coalesce(s.utm_source, '')) ~ '(meta|facebook|instagram|fb)' then 'Meta'
        else 'Direct / Unknown'
      end as attributed_platform
    from public.prepass_smb_form_submissions s
    where s.form_id = '1040'
      and lower(s.landing_page) = 'mobile-app.html'
  ),
  mobile_contacts as (
    select distinct id_marketo from mobile_events
  ),
  period_lp_leads as (
    select distinct on (id_marketo)
      id_marketo,
      (activity_date at time zone 'UTC')::date as event_date,
      attributed_platform as event_platform
    from mobile_events
    where activity_date >= p_start::timestamp at time zone 'UTC'
      and activity_date < (p_end + 1)::timestamp at time zone 'UTC'
      and (p_channel is null or attributed_platform = p_channel)
    order by id_marketo, activity_date desc, marketo_guid desc
  ),
  mmp_smb_campaigns as (
    select distinct
      platform,
      regexp_replace(lower(coalesce(campaign_name, '')), '[^a-z0-9]', '', 'g') as campaign_norm
    from public.master_marketing_performance
    where focus = 'SMB'
      and (p_channel is null or platform = p_channel)
  ),
  mql_raw as (
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Meta'::text as row_platform,
      public.prepass_safe_date(date_mql) as stage_date
    from public."Meta MQL"
    union all
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Google'::text as row_platform,
      public.prepass_safe_date(date_mql) as stage_date
    from public."Google MQL"
  ),
  sql_raw as (
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Meta'::text as row_platform,
      public.prepass_safe_date(date_sql) as stage_date
    from public."Meta SQL"
    union all
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Google'::text as row_platform,
      public.prepass_safe_date(date_sql) as stage_date
    from public."Google SQL"
  ),
  won_raw as (
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Meta'::text as row_platform,
      public.prepass_safe_date(date_won) as stage_date
    from public."Meta WON"
    union all
    select
      id_marketo,
      utm_campaign,
      original_campaign,
      'Google'::text as row_platform,
      public.prepass_safe_date(date_won) as stage_date
    from public."Google WON"
  ),
  mql_rows as (
    select * from mql_raw
    where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  sql_rows as (
    select * from sql_raw
    where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  won_rows as (
    select * from won_raw
    where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  mql_lp_candidates as (
    select distinct on (r.id_marketo)
      r.id_marketo,
      r.stage_date,
      r.row_platform
    from mql_rows r
    join mobile_contacts c using (id_marketo)
    where exists (
      select 1 from mobile_events e
      where e.id_marketo = r.id_marketo
        and (e.activity_date at time zone 'UTC')::date <= r.stage_date
    )
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  sql_lp_candidates as (
    select distinct on (r.id_marketo)
      r.id_marketo,
      r.stage_date,
      r.row_platform
    from sql_rows r
    join mobile_contacts c using (id_marketo)
    where exists (
      select 1 from mobile_events e
      where e.id_marketo = r.id_marketo
        and (e.activity_date at time zone 'UTC')::date <= r.stage_date
    )
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  won_lp_candidates as (
    select distinct on (r.id_marketo)
      r.id_marketo,
      r.stage_date,
      r.row_platform
    from won_rows r
    join mobile_contacts c using (id_marketo)
    where exists (
      select 1 from mobile_events e
      where e.id_marketo = r.id_marketo
        and (e.activity_date at time zone 'UTC')::date <= r.stage_date
    )
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  mql_existing_smb as (
    select distinct r.id_marketo
    from mql_rows r
    where exists (
      select 1 from mmp_smb_campaigns m
      where m.platform = r.row_platform
        and m.campaign_norm = regexp_replace(
          lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')),
          '[^a-z0-9]', '', 'g'
        )
    )
  ),
  sql_existing_smb as (
    select distinct r.id_marketo
    from sql_rows r
    where exists (
      select 1 from mmp_smb_campaigns m
      where m.platform = r.row_platform
        and m.campaign_norm = regexp_replace(
          lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')),
          '[^a-z0-9]', '', 'g'
        )
    )
  ),
  won_existing_smb as (
    select distinct r.id_marketo
    from won_rows r
    where exists (
      select 1 from mmp_smb_campaigns m
      where m.platform = r.row_platform
        and m.campaign_norm = regexp_replace(
          lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')),
          '[^a-z0-9]', '', 'g'
        )
    )
  ),
  mql_additions as (
    select c.* from mql_lp_candidates c
    where not exists (select 1 from mql_existing_smb e where e.id_marketo = c.id_marketo)
  ),
  sql_additions as (
    select c.* from sql_lp_candidates c
    where not exists (select 1 from sql_existing_smb e where e.id_marketo = c.id_marketo)
  ),
  won_additions as (
    select c.* from won_lp_candidates c
    where not exists (select 1 from won_existing_smb e where e.id_marketo = c.id_marketo)
  ),
  adjustment_events as (
    select event_date, event_platform, 1::bigint as leads, 0::bigint as mqls, 0::bigint as sqls, 0::bigint as won
    from period_lp_leads
    union all
    select stage_date, row_platform, 0, 1, 0, 0 from mql_additions
    union all
    select stage_date, row_platform, 0, 0, 1, 0 from sql_additions
    union all
    select stage_date, row_platform, 0, 0, 0, 1 from won_additions
  )
  select
    event_date,
    event_platform,
    sum(leads)::bigint,
    sum(mqls)::bigint,
    sum(sqls)::bigint,
    sum(won)::bigint
  from adjustment_events
  group by event_date, event_platform
  order by event_date, event_platform;
$function$;

revoke execute on function public.prepass_smb_lp_adjustments(date, date, text) from public, anon, authenticated;
grant execute on function public.prepass_smb_lp_adjustments(date, date, text) to service_role;

create or replace function public.prepass_fd360_lp_adjustments(
  p_start date,
  p_end date,
  p_channel text default null
)
returns table(
  adjustment_date date,
  platform text,
  lp_leads bigint,
  add_mqls bigint,
  add_sqls bigint,
  add_won bigint
)
language sql
stable
security invoker
as $function$
  with fd_events as (
    select
      s.*,
      case
        when lower(coalesce(s.utm_source, '')) like '%google%' then 'Google'
        when lower(coalesce(s.utm_source, '')) ~ '(meta|facebook|instagram|fb)' then 'Meta'
        else 'Direct / Unknown'
      end as attributed_platform
    from public.prepass_smb_form_submissions s
    where s.form_id = '1040'
      and lower(s.landing_page) = 'fd360.html'
  ),
  fd_contacts as (
    select distinct id_marketo from fd_events
  ),
  first_submissions as (
    select distinct on (id_marketo)
      id_marketo,
      (activity_date at time zone 'UTC')::date as event_date,
      attributed_platform as event_platform
    from fd_events
    order by id_marketo, activity_date, marketo_guid
  ),
  submitted_leads as (
    select *
    from first_submissions
    where event_date between p_start and p_end
      and (p_channel is null or event_platform = p_channel)
  ),
  created_at_first as (
    select distinct on (l.id_marketo)
      l.id_marketo,
      (l.created_at at time zone 'UTC')::date as event_date,
      case
        when lower(coalesce(l.utm_source, '')) like '%google%' then 'Google'
        when lower(coalesce(l.utm_source, '')) ~ '(meta|facebook|instagram|fb)' then 'Meta'
        else 'Direct / Unknown'
      end as event_platform
    from public.leads_fd360 l
    join fd_contacts c on c.id_marketo = l.id_marketo
    where regexp_replace(split_part(lower(btrim(coalesce(l.landing_page_url, ''))), '?', 1), '/+$', '')
        in ('fd360', 'fd360.html', 'https://pages.prepass.com/fd360.html')
    order by l.id_marketo, l.created_at
  ),
  created_at_leads as (
    select *
    from created_at_first
    where event_date between p_start and p_end
      and (p_channel is null or event_platform = p_channel)
  ),
  fd_campaigns as (
    select distinct
      platform,
      regexp_replace(lower(coalesce(campaign_name, '')), '[^a-z0-9]', '', 'g') as campaign_norm
    from public.master_marketing_performance
    where focus = 'FD360'
  ),
  mql_raw as (
    select id_marketo, utm_campaign, original_campaign, 'Meta'::text as row_platform,
      public.prepass_safe_date(date_mql) as stage_date from public."Meta MQL"
    union all
    select id_marketo, utm_campaign, original_campaign, 'Google'::text,
      public.prepass_safe_date(date_mql) from public."Google MQL"
  ),
  sql_raw as (
    select id_marketo, utm_campaign, original_campaign, 'Meta'::text as row_platform,
      public.prepass_safe_date(date_sql) as stage_date from public."Meta SQL"
    union all
    select id_marketo, utm_campaign, original_campaign, 'Google'::text,
      public.prepass_safe_date(date_sql) from public."Google SQL"
  ),
  won_raw as (
    select id_marketo, utm_campaign, original_campaign, 'Meta'::text as row_platform,
      public.prepass_safe_date(date_won) as stage_date from public."Meta WON"
    union all
    select id_marketo, utm_campaign, original_campaign, 'Google'::text,
      public.prepass_safe_date(date_won) from public."Google WON"
  ),
  mql_first as (
    select distinct on (r.id_marketo) r.id_marketo, r.stage_date, r.row_platform
    from mql_raw r join fd_contacts c using (id_marketo)
    where exists (select 1 from fd_events e where e.id_marketo = r.id_marketo and (e.activity_date at time zone 'UTC')::date <= r.stage_date)
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  sql_first as (
    select distinct on (r.id_marketo) r.id_marketo, r.stage_date, r.row_platform
    from sql_raw r join fd_contacts c using (id_marketo)
    where exists (select 1 from fd_events e where e.id_marketo = r.id_marketo and (e.activity_date at time zone 'UTC')::date <= r.stage_date)
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  won_first as (
    select distinct on (r.id_marketo) r.id_marketo, r.stage_date, r.row_platform
    from won_raw r join fd_contacts c using (id_marketo)
    where exists (select 1 from fd_events e where e.id_marketo = r.id_marketo and (e.activity_date at time zone 'UTC')::date <= r.stage_date)
    order by r.id_marketo, r.stage_date, r.row_platform
  ),
  mql_candidates as (
    select * from mql_first where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  sql_candidates as (
    select * from sql_first where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  won_candidates as (
    select * from won_first where stage_date between p_start and p_end
      and (p_channel is null or row_platform = p_channel)
  ),
  mql_existing as (
    select distinct r.id_marketo from mql_raw r where exists (
      select 1 from fd_campaigns f where f.platform = r.row_platform
        and f.campaign_norm = regexp_replace(lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')), '[^a-z0-9]', '', 'g')
    )
  ),
  sql_existing as (
    select distinct r.id_marketo from sql_raw r where exists (
      select 1 from fd_campaigns f where f.platform = r.row_platform
        and f.campaign_norm = regexp_replace(lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')), '[^a-z0-9]', '', 'g')
    )
  ),
  won_existing as (
    select distinct r.id_marketo from won_raw r where exists (
      select 1 from fd_campaigns f where f.platform = r.row_platform
        and f.campaign_norm = regexp_replace(lower(coalesce(nullif(btrim(r.utm_campaign), ''), nullif(btrim(r.original_campaign), ''), '')), '[^a-z0-9]', '', 'g')
    )
  ),
  adjustment_events as (
    select event_date, event_platform, 1::bigint as leads, 0::bigint as mqls, 0::bigint as sqls, 0::bigint as won from submitted_leads
    union all
    select event_date, event_platform, (-1)::bigint, 0, 0, 0 from created_at_leads
    union all
    select stage_date, row_platform, 0, 1, 0, 0 from mql_candidates c where not exists (select 1 from mql_existing e where e.id_marketo = c.id_marketo)
    union all
    select stage_date, row_platform, 0, 0, 1, 0 from sql_candidates c where not exists (select 1 from sql_existing e where e.id_marketo = c.id_marketo)
    union all
    select stage_date, row_platform, 0, 0, 0, 1 from won_candidates c where not exists (select 1 from won_existing e where e.id_marketo = c.id_marketo)
  )
  select event_date, event_platform, sum(leads)::bigint, sum(mqls)::bigint, sum(sqls)::bigint, sum(won)::bigint
  from adjustment_events
  group by event_date, event_platform
  having sum(leads) <> 0 or sum(mqls) <> 0 or sum(sqls) <> 0 or sum(won) <> 0
  order by event_date, event_platform;
$function$;

revoke execute on function public.prepass_fd360_lp_adjustments(date, date, text) from public, anon, authenticated;
grant execute on function public.prepass_fd360_lp_adjustments(date, date, text) to service_role;

commit;
