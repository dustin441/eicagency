-- Per-dashboard permissions for partner deployments (project lozgnyxixzfxokllevtb).
-- One row per (user, client): access_level 'viewer' (read the dashboard) or 'admin'
-- (read + manage that client's users). Master Admins (profiles.role partner_admin /
-- agency / super_admin) see every client of the tenant and need no rows here.
-- Users can read only their own rows; every write goes through the app's server
-- actions with the service role, which check the caller first. No anon/authenticated
-- writes are possible, so a modified request from the browser cannot grant access.
-- Safe to re-run.

create table if not exists public.client_memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  access_level text not null check (access_level in ('viewer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (user_id, client_id)
);

create index if not exists client_memberships_client_idx on public.client_memberships (client_id);

comment on table public.client_memberships is
  'Partner-deployment dashboard permissions: viewer or admin per client. Masters (profiles.role) need no rows.';

alter table public.client_memberships enable row level security;

drop policy if exists client_memberships_select_own on public.client_memberships;
create policy client_memberships_select_own on public.client_memberships
  for select to authenticated
  using (auth.uid() = user_id);

revoke all on table public.client_memberships from anon, authenticated;
grant select on table public.client_memberships to authenticated;
grant all on table public.client_memberships to service_role;

-- Carry over any legacy client_access grants as viewer rows (keeps existing users working).
insert into public.client_memberships (user_id, client_id, access_level)
select p.id, unnest(p.client_access), 'viewer'
from public.profiles p
where p.role = 'client' and p.client_access is not null
on conflict (user_id, client_id) do nothing;
