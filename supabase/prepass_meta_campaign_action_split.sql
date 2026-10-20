-- Preserve Meta action families separately from unique CRM lead reporting.
-- Existing rows intentionally remain NULL until the ingestion backfill populates
-- the full campaign-day action split. The dashboard treats NULL as unavailable.

ALTER TABLE public.meta_campaigns
  ADD COLUMN IF NOT EXISTS lead_actions bigint,
  ADD COLUMN IF NOT EXISTS contact_actions bigint,
  ADD COLUMN IF NOT EXISTS total_conversion_actions bigint;

COMMENT ON COLUMN public.meta_campaigns.lead_actions IS
  'Canonical Meta Lead action count. Provider-attributed event actions, not unique CRM people.';
COMMENT ON COLUMN public.meta_campaigns.contact_actions IS
  'Canonical Meta website Contact action count. Provider-attributed event actions, not unique CRM people.';
COMMENT ON COLUMN public.meta_campaigns.total_conversion_actions IS
  'lead_actions + contact_actions. May contain overlapping people and must not be labelled unique Leads.';
