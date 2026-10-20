-- NSI: split HubSpot form fills out of Google Ads conversions.
-- Project: lozgnyxixzfxokllevtb. Idempotent — safe to re-run.
--
-- nsi_google_ads_daily.conversions keeps the full Google Ads total (submittals +
-- HubSpot form fills). hubspot_conversions is the subset coming from the
-- "Go.NSI Pages (web) hs_form_submission" conversion action, written by the
-- n8n workflow "NSI Google Ads Campaign Data Pull To Supabase" (ATyPRkCG2pr3HALB).
-- Google submittals = conversions - hubspot_conversions.

alter table public.nsi_google_ads_daily
  add column if not exists hubspot_conversions numeric not null default 0;

alter table public.nsi_master_campaign_daily
  add column if not exists hubspot_conversions numeric not null default 0;

CREATE OR REPLACE FUNCTION public.refresh_nsi_master_campaign_daily()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  begin
    truncate table public.nsi_master_campaign_daily;

    insert into public.nsi_master_campaign_daily (
      brand, date, campaign_name, impressions, clicks, cost, conversions, hubspot_conversions,
      audience, ad_channel, sub_campaign, ad_type, torpedo, type, identifier,
      total_users, sessions, engaged_sessions, source_tables, refreshed_at
    )
    with source_rows as (
      select
        g.brand, g.date,
        upper(trim(g.campaign_name)) as campaign_name,
        coalesce(g.impressions, 0)::numeric as impressions,
        coalesce(g.clicks, 0)::numeric as clicks,
        coalesce(g.cost, 0)::numeric as cost,
        coalesce(g.conversions, 0)::numeric as conversions,
        coalesce(g.hubspot_conversions, 0)::numeric as hubspot_conversions,
        null::text as audience,
        nullif(g.ad_channel, '')::text as ad_channel,
        nullif(g.sub_campaign, '')::text as sub_campaign,
        nullif(g.campaign_type, '')::text as ad_type,
        nullif(g.torpedo, '')::text as torpedo,
        null::text as identifier,
        0::numeric as total_users, 0::numeric as sessions, 0::numeric as engaged_sessions,
        'nsi_google_ads_daily'::text as source_table
      from public.nsi_google_ads_daily g
      where g.date is not null
        and coalesce(g.ad_channel, '') in ('Google', 'Google Pmax')

      union all

      select
        m.brand, m.date,
        upper(trim(m.campaign_name)) as campaign_name,
        coalesce(m.impressions, 0)::numeric, coalesce(m.clicks, 0)::numeric,
        coalesce(m.cost, 0)::numeric, coalesce(m.leads, 0)::numeric, 0::numeric,
        null::text, 'Facebook'::text,
        nullif(m.sub_campaign, '')::text, nullif(m.campaign_type, '')::text,
        nullif(m.torpedo, '')::text, null::text,
        0::numeric, 0::numeric, 0::numeric,
        'nsi_meta_ads_daily'::text
      from public.nsi_meta_ads_daily m
      where m.date is not null

      union all

      select
        l.brand, l.date,
        upper(trim(l.campaign_name)) as campaign_name,
        coalesce(l.impressions, 0)::numeric, coalesce(l.clicks, 0)::numeric,
        coalesce(l.spend, 0)::numeric, coalesce(l.conversions, 0)::numeric, 0::numeric,
        null::text, 'LinkedIn'::text,
        nullif(l.sub_campaign, '')::text, nullif(l.campaign_type, '')::text,
        nullif(l.torpedo, '')::text, null::text,
        0::numeric, 0::numeric, 0::numeric,
        'nsi_linkedin_ads_daily'::text
      from public.nsi_linkedin_ads_daily l
      where l.date is not null

      union all

      select
        ga.brand, ga.date,
        upper(trim(ga.session_campaign_name)) as campaign_name,
        0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
        null::text,
        nullif(ga.ad_channel, '')::text,
        nullif(ga.sub_campaign, '')::text,
        case
          when ga.session_campaign_name ~* 'youtube|ctv|video' then 'Video'
          when ga.session_campaign_name ~* 'ppc|search|dsa' then 'PPC'
          when ga.session_campaign_name ~* 'email' then 'Email'
          else 'Banner'
        end::text,
        nullif(ga.torpedo, '')::text,
        nullif(ga.identifier, '')::text,
        coalesce(ga.total_users, 0)::numeric,
        coalesce(ga.sessions, 0)::numeric,
        coalesce(ga.engaged_sessions, 0)::numeric,
        'nsi_google_analytics_daily'::text
      from public.nsi_google_analytics_daily ga
      where ga.date is not null
        and coalesce(ga.session_campaign_name, '') <> ''
        and coalesce(ga.ad_channel, '') in (
          'Google', 'Google Pmax', 'Facebook', 'LinkedIn',
          'EW', 'EC&M', 'EC', 'tED', 'CI', 'IAEI'
        )

      union all

      select
        p.brand, p.date,
        upper(trim(p.campaign_name)) as campaign_name,
        coalesce(p.impressions, 0)::numeric, coalesce(p.clicks, 0)::numeric,
        coalesce(p.cost, 0)::numeric, coalesce(p.conversions, 0)::numeric, 0::numeric,
        nullif(p.audience, '')::text, nullif(p.ad_channel, '')::text,
        nullif(p.sub_campaign, '')::text, nullif(p.ad_type, '')::text,
        nullif(p.torpedo, '')::text, nullif(p.identifier, '')::text,
        0::numeric, 0::numeric, 0::numeric,
        'nsi_publishers_daily'::text
      from public.nsi_publishers_daily p
      where p.date is not null
        and coalesce(p.campaign_name, '') <> ''
        and coalesce(p.ad_channel, '') in ('EW', 'EC&M', 'EC', 'tED', 'CI', 'IAEI')
    ),
    normalized_source_rows as (
      select
        brand, date, campaign_name,
        impressions, clicks, cost, conversions, hubspot_conversions,
        audience, ad_channel,
        case
          when coalesce(sub_campaign, '') <> ''
           and sub_campaign <> 'Default text if none found' then sub_campaign
          -- New campaigns added 2026-08
          when campaign_name like 'NEL-END-360%' then 'NEL-END-360'
          when campaign_name like 'CCF-END-OOPS%' then 'CCF-END-OOPS'
          -- Existing mappings
          when campaign_name like 'CON-CON-POL2%' then 'CON-CON-POL2'
          when campaign_name like 'CCF-CON-BPT2%' then 'CCF-CON-BPT2'
          when campaign_name like 'CON-END-CMP%' then 'CON-END-CMP'
          when campaign_name like 'CON-CON-CMP%' then 'CON-CON-CMP'
          when campaign_name like 'CON-CON-MCH%' then 'CON-CON-MCH'
          when campaign_name like 'CON-CON-TRM%' then 'CON-CON-TRM'
          when campaign_name like 'CON-CON-LSS%' then 'CON-CON-LSS'
          when campaign_name like 'CCF-CON-SOL%' then 'CCF-CON-SOL'
          when campaign_name like 'CCF-CON-LQT%' then 'CCF-CON-LQT'
          when campaign_name like 'CCF-CON-RMK%' then 'CCF-CON-RMK'
          when campaign_name like 'CCF-CON-ACQ%' then 'CCF-CON-ACQ'
          when campaign_name like 'CCF-PEN-EZL%' then 'CCF-PEN-EZL'
          when campaign_name like 'CCF-PEN-100%' then 'CCF-PEN-100'
          when campaign_name like 'CCF-PEN%' then 'CCF-PEN'
          when campaign_name like 'CCF-CON-PEN%' then 'CCF-CON-PEN'
          when campaign_name like 'CCF-END-EZL%' then 'CCF-END-EZL'
          when campaign_name like 'SUP-CON-GRP%' then 'SUP-CON-GRP'
          when campaign_name like 'SUP-CON-TRK%' then 'SUP-CON-TRK'
          when campaign_name like 'SUP-CON-MTL%' then 'SUP-CON-MTL'
          when campaign_name like 'SUP-CON-MRC%' then 'SUP-CON-MRC'
          when campaign_name like 'SUP-CON-MET%' then 'SUP-CON-MET'
          when campaign_name like 'SUP-CON-SLY%' then 'SUP-CON-SLY'
          when campaign_name like 'SUP-PEN-TRM%' then 'SUP-PEN-TRM'
          when campaign_name like 'CON-PEN-POL%' then 'CON-PEN-POL'
          when campaign_name like 'CON-PEN-TRM%' then 'CON-PEN-TRM'
          when campaign_name like 'CON-CES-POL%' then 'CON-CES-POL'
          when campaign_name like 'CON-CON-ETT%' then 'CON-CON-ETT'
          when campaign_name like 'NEL-CON-IIJA%' then 'NEL-CON-IIJA'
          when campaign_name like 'GENERAL BRAND%' then 'General Brand'
          when campaign_name like '%IIJ%' then 'NEL-CON-IIJA'
          else 'Default text if none found'
        end as sub_campaign,
        ad_type,
        case
          when coalesce(torpedo, '') <> ''
           and torpedo <> 'Default text if none found' then torpedo
          when campaign_name like '%CCF-CON-%' or campaign_name like '%CCF-PEN%' or campaign_name like 'CCF-%' then 'CCF'
          when campaign_name like '%SUP-CON-%' or campaign_name like '%SUP-PEN%' or campaign_name like 'SUP-%' then 'SUP'
          when campaign_name like '%CON-CON-%' or campaign_name like '%CON-END-%' or campaign_name like '%CON-PEN-%' or campaign_name like 'CON-%' then 'CON'
          when campaign_name like 'NEL-%' then 'NEL'
          when campaign_name like '%GENERAL BRAND%' then 'NEL'
          when campaign_name like '%IIJ%' then 'NEL'
          else 'Default text if none found'
        end as torpedo,
        identifier, total_users, sessions, engaged_sessions, source_table
      from source_rows
    ),
    grouped as (
      select
        brand, date, campaign_name,
        coalesce(audience, '') as audience_key,
        coalesce(ad_channel, '') as ad_channel_key,
        coalesce(sub_campaign, '') as sub_campaign_key,
        coalesce(ad_type, '') as ad_type_key,
        coalesce(torpedo, '') as torpedo_key,
        sum(impressions) as impressions,
        sum(clicks) as clicks,
        sum(cost) as cost,
        sum(conversions) as conversions,
        sum(hubspot_conversions) as hubspot_conversions,
        sum(total_users) as total_users,
        sum(sessions) as sessions,
        sum(engaged_sessions) as engaged_sessions,
        array_agg(distinct source_table order by source_table) as source_tables
      from normalized_source_rows
      where campaign_name <> ''
        and campaign_name not in (
          '(ORGANIC)', '(REFERRAL)', '(NOT SET)',
          'DUROLINE50OFF', 'SCREW', 'SCREWS',
          'DYNA-TITE SUSPENSION STRUT KIT'
        )
      group by
        brand, date, campaign_name,
        coalesce(audience, ''), coalesce(ad_channel, ''),
        coalesce(sub_campaign, ''), coalesce(ad_type, ''), coalesce(torpedo, '')
    )
    select
      brand, date, campaign_name,
      impressions, clicks, cost, conversions, hubspot_conversions,
      nullif(audience_key, '') as audience,
      nullif(ad_channel_key, '') as ad_channel,
      nullif(sub_campaign_key, '') as sub_campaign,
      nullif(ad_type_key, '') as ad_type,
      nullif(torpedo_key, '') as torpedo,
      case when campaign_name like '%-END-%' then 'Contractor' else 'Distributor' end as type,
      (
        (date - date '1899-12-30')::integer::text || '-' ||
        sub_campaign_key || '-' ||
        ad_channel_key || '-' ||
        torpedo_key
      )::text as identifier,
      total_users, sessions, engaged_sessions,
      source_tables,
      now() as refreshed_at
    from grouped;
  end;
  $function$;

-- One-time backfill of HubSpot form fills (all occurrences 2026-01-01 → 2026-10-19,
-- pulled from Google Ads by conversion action). The n8n workflow keeps the rolling
-- 90-day window current from here on.
update public.nsi_google_ads_daily g
set hubspot_conversions = v.hs
from (values
  ('2026-09-21'::date, '24117625614', 1),
  ('2026-09-05'::date, '24192236872', 1),
  ('2026-09-06'::date, '24192236872', 3),
  ('2026-09-08'::date, '24192236872', 1),
  ('2026-09-18'::date, '24192236872', 1),
  ('2026-09-19'::date, '24192236872', 1),
  ('2026-09-21'::date, '24192236872', 1),
  ('2026-09-28'::date, '24192236872', 1),
  ('2026-10-02'::date, '24192236872', 1)
) as v(date, campaign_id, hs)
where g.date = v.date and g.campaign_id = v.campaign_id;

select public.refresh_nsi_master_campaign_daily();
