-- Distinguish current Marketo UTM state from retained historical campaign attribution.
begin;

alter table public.campaign_leads
  add column if not exists is_campaign_attributed boolean not null default true,
  add column if not exists attribution_status text not null default 'current',
  add column if not exists historical_attribution_preserved_at timestamptz;

alter table public.campaign_leads
  drop constraint if exists campaign_leads_attribution_status_check;
alter table public.campaign_leads
  add constraint campaign_leads_attribution_status_check
  check (attribution_status in ('current', 'historical'));

alter table public.prepass_campaign_leads_sync_audit
  drop constraint if exists prepass_campaign_leads_sync_audit_change_type_check;
alter table public.prepass_campaign_leads_sync_audit
  add constraint prepass_campaign_leads_sync_audit_change_type_check
  check (change_type in ('insert', 'update', 'inactive', 'restore_historical'));

create index if not exists campaign_leads_effective_attribution_idx
  on public.campaign_leads (is_campaign_attributed, attribution_status);

comment on column public.campaign_leads.is_campaign_attributed is
  'True when campaign attribution is deterministic, whether current or historically preserved.';
comment on column public.campaign_leads.attribution_status is
  'current when Marketo currently has campaign UTM; historical when a known prior attribution is retained after UTM removal.';

commit;
