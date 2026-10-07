begin;

-- GroundTruth has no API connection yet: these campaign-to-date totals are
-- collected manually from the GroundTruth UI. Reach is not additive across
-- days, so we store one campaign-level snapshot per campaign instead of daily rows.
create table if not exists public.medibrane_groundtruth_campaigns (
  campaign_id text primary key,
  campaign_name text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  spend numeric(14, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  reach bigint not null default 0 check (reach >= 0),
  data_start date,
  data_end date,
  collected_at date not null,
  updated_at timestamptz not null default now()
);

alter table public.medibrane_groundtruth_campaigns enable row level security;
revoke all on table public.medibrane_groundtruth_campaigns from public, anon, authenticated;
grant select, insert, update, delete on table public.medibrane_groundtruth_campaigns to service_role;

comment on table public.medibrane_groundtruth_campaigns is
  'Manually collected GroundTruth campaign-to-date totals for Medibrane (USD). collected_at = date the numbers were copied from GroundTruth.';

commit;

-- Manual refresh example (upsert):
-- insert into public.medibrane_groundtruth_campaigns
--   (campaign_id, campaign_name, spend, impressions, clicks, reach, data_start, data_end, collected_at)
-- values ('1658454', 'MED | TOF | ABM + Geo | USA | Draft', 513.86, 96003, 491, 4656, '2026-09-17', '2026-10-07', '2026-10-07')
-- on conflict (campaign_id) do update set
--   campaign_name = excluded.campaign_name, spend = excluded.spend, impressions = excluded.impressions,
--   clicks = excluded.clicks, reach = excluded.reach, data_start = excluded.data_start,
--   data_end = excluded.data_end, collected_at = excluded.collected_at, updated_at = now();
