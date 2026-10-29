-- Login profiles for white-label partner deployments (project lozgnyxixzfxokllevtb).
-- The Scott Social deployment authenticates against THIS project, never the EIC/PrePass
-- auth project (hdaftbqteexugqakgdbx). Same shape the app already reads:
-- profiles(role, client_access, full_name). The deployment's tenant config
-- (src/lib/tenant.ts) caps every role to the tenant's client portfolio, so even an
-- 'agency' row here can only see Scott Social clients.
-- Rows are managed server-side (service role); users can only read their own row.
-- Safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('super_admin', 'agency', 'client')),
  client_access text[],
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Partner-deployment login profiles. role agency = all clients of the deployment tenant; client = only client_access.';

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
