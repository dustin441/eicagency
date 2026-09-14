BEGIN;

ALTER TABLE public.ihh_meta
  ADD COLUMN IF NOT EXISTS closer_appointments numeric;

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
  link_clicks,
  closer_appointments
FROM public.ihh_meta;

COMMENT ON COLUMN public.ihh_meta.closer_appointments IS
  'IHH-only Meta Ads Insights action value for custom conversion offsite_conversion.custom.1794339368427062 (IHH | Closer Appointment Booked), using 7-day click and 1-day view attribution.';

COMMIT;
