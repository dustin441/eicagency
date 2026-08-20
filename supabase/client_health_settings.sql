create table if not exists public.client_health_settings (
  client_id text primary key,
  monthly_hours_allotment numeric check (monthly_hours_allotment is null or monthly_hours_allotment > 0),
  updated_at timestamptz not null default now()
);

alter table public.client_health_settings enable row level security;

comment on table public.client_health_settings is
  'Agency-only configuration used by the client health dashboard. Read with the server service role.';
comment on column public.client_health_settings.monthly_hours_allotment is
  'Contracted monthly hours. Null intentionally renders as missing data instead of guessing.';

insert into public.client_health_settings (client_id)
values
  ('prepass'), ('spartaco'), ('nsi'), ('turfli'), ('durodyne'), ('goodgame'),
  ('bridgeway'), ('arabella'), ('kinsey'), ('state48'), ('cba'), ('liferep'),
  ('bloom'), ('eicagency'), ('champagne'), ('ihh')
on conflict (client_id) do nothing;
