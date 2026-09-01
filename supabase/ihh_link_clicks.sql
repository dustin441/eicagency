-- Add canonical Meta link-click reporting without changing the existing all-click metric.
ALTER TABLE public.ihh_meta
  ADD COLUMN IF NOT EXISTS link_clicks bigint NOT NULL DEFAULT 0;

ALTER TABLE public.ihh_meta_ads
  ADD COLUMN IF NOT EXISTS link_clicks bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.ihh_master AS
SELECT
  date,
  campaign_name,
  impressions,
  clicks,
  cost,
  conversions,
  purchases,
  revenue,
  COALESCE(ad_channel, 'Meta'::character varying) AS ad_channel,
  focus,
  type,
  scheduled_appointments,
  link_clicks
FROM public.ihh_meta;

COMMENT ON COLUMN public.ihh_meta.link_clicks IS
  'Canonical Meta Ads Insights action value for action_type=link_click.';

COMMENT ON COLUMN public.ihh_meta_ads.link_clicks IS
  'Canonical Meta Ads Insights action value for action_type=link_click.';
