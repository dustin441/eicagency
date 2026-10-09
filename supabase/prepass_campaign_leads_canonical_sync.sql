-- Canonical Marketo campaign-contact lifecycle fields for PrePass Campaign Performance.
-- Non-destructive: historical rows remain in campaign_leads and are marked inactive.

begin;

alter table public.campaign_leads
  add column if not exists marketo_updated_at timestamptz,
  add column if not exists date_mql date,
  add column if not exists date_sql date,
  add column if not exists date_won date,
  add column if not exists is_current_marketo_attributed boolean not null default true,
  add column if not exists last_marketo_sync_at timestamptz;

create table if not exists public.prepass_campaign_leads_sync_audit (
  run_id uuid not null,
  captured_at timestamptz not null default now(),
  change_type text not null check (change_type in ('insert', 'update', 'inactive')),
  id_marketo text not null,
  previous_state jsonb,
  current_state jsonb,
  primary key (run_id, id_marketo)
);

create index if not exists campaign_leads_current_created_idx
  on public.campaign_leads (is_current_marketo_attributed, marketo_created_at);
create index if not exists campaign_leads_current_mql_idx
  on public.campaign_leads (is_current_marketo_attributed, date_mql);
create index if not exists campaign_leads_current_sql_idx
  on public.campaign_leads (is_current_marketo_attributed, date_sql);
create index if not exists campaign_leads_current_won_idx
  on public.campaign_leads (is_current_marketo_attributed, date_won);
create index if not exists campaign_leads_marketo_updated_idx
  on public.campaign_leads (marketo_updated_at);

comment on column public.campaign_leads.is_current_marketo_attributed is
  'True when the latest canonical Marketo snapshot has utm_campaign_id or utm_campaign.';
comment on table public.prepass_campaign_leads_sync_audit is
  'Non-PII before/after attribution snapshots for canonical Marketo campaign-lead synchronization.';

commit;
