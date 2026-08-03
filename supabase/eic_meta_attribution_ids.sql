alter table public.eic_meta_ads
  add column if not exists campaign_id text not null default '';

alter table public.eic_meta_ads
  add column if not exists adset_id text not null default '';

create index if not exists eic_meta_ads_campaign_id_idx
  on public.eic_meta_ads (campaign_id);

create index if not exists eic_meta_ads_adset_id_idx
  on public.eic_meta_ads (adset_id);
