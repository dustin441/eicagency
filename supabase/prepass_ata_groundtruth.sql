begin;

-- GroundTruth does not expose an approved API connection for this account.
-- Store one current campaign-to-date snapshot per ATA campaign. The dashboard
-- treats a missing snapshot as unavailable, never as zero spend.
create table if not exists public.prepass_ata_groundtruth_campaigns (
  campaign_id text primary key,
  campaign_name text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  spend numeric(14, 2) not null check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  reach bigint not null default 0 check (reach >= 0),
  data_start date not null,
  data_end date not null,
  collected_at date not null,
  updated_at timestamptz not null default now(),
  check (data_start <= data_end)
);

alter table public.prepass_ata_groundtruth_campaigns enable row level security;
revoke all on table public.prepass_ata_groundtruth_campaigns from public, anon, authenticated;
grant select, insert, update, delete on table public.prepass_ata_groundtruth_campaigns to service_role;

comment on table public.prepass_ata_groundtruth_campaigns is
  'Current campaign-to-date GroundTruth delivery snapshots for the PrePass ATA MCE 2026 event. Source exports remain outside the database.';

commit;

-- Refresh example after exporting current GroundTruth campaign totals:
-- insert into public.prepass_ata_groundtruth_campaigns
--   (campaign_id, campaign_name, spend, impressions, clicks, reach, data_start, data_end, collected_at)
-- values
--   ('<airport campaign id>', 'PrePass ATA | Airport', 0, 0, 0, 0, '2026-10-15', '2026-10-16', current_date),
--   ('<event campaign id>', 'PrePass ATA | Event Area', 0, 0, 0, 0, '2026-10-17', '2026-10-20', current_date)
-- on conflict (campaign_id) do update set
--   campaign_name = excluded.campaign_name,
--   spend = excluded.spend,
--   impressions = excluded.impressions,
--   clicks = excluded.clicks,
--   reach = excluded.reach,
--   data_start = excluded.data_start,
--   data_end = excluded.data_end,
--   collected_at = excluded.collected_at,
--   updated_at = now();
