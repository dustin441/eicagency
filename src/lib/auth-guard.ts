import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  canManageTenantUsers,
  getDeploymentTenant,
  hasTenantWideAccess,
  isClientAllowedForTenant,
  type ProfileRole,
} from '@/lib/tenant';

type Profile = {
  role: ProfileRole;
  client_access: string[] | null;
};

export type TeamAdminIdentity = {
  userId: string;
  role: ProfileRole;
};

export type AgencyIdentity = {
  userId: string;
  role: 'super_admin' | 'agency';
};

const CLIENT_DEFAULTS: Record<string, string> = {
  spartaco: '/dashboard/spartaco/leads',
  nsi: '/dashboard/nsi',
  prepass: '/dashboard',
  turfli: '/dashboard/turfli',
  durodyne: '/dashboard/durodyne',
  goodgame: '/dashboard/goodgame',
  bridgeway: '/dashboard/bridgeway',
  arabella: '/dashboard/arabella',
  kinsey: '/dashboard/kinsey',
  state48: '/dashboard/state-forty-eight',
  cba: '/dashboard/cba',
  liferep: '/dashboard/liferep',
  bloom: '/dashboard/bloom',
  eicagency: '/dashboard/eicagency',
  champagne: '/dashboard/champagne',
  ihh: '/dashboard/ihh',
  medibrane: '/dashboard/medibrane',
  aurit: '/dashboard/aurit',
  elevate: '/dashboard/elevate',
};

export async function requireAgencyIdentity(): Promise<AgencyIdentity> {
  const tenant = getDeploymentTenant();
  // Agency tools are EIC-internal; partner tenants never expose them.
  if (!tenant.internalFeatures) redirect(tenant.homePath);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();
  const profile = data as Profile | null;
  if (error || !profile) redirect('/login');
  if (profile.role === 'super_admin' || profile.role === 'agency') return { userId: user.id, role: profile.role };

  for (const id of profile.client_access ?? []) {
    const href = CLIENT_DEFAULTS[id];
    if (href && isClientAllowedForTenant(tenant, id)) redirect(href);
  }
  redirect('/login');
}

export async function requireAgencyAccess(): Promise<void> {
  await requireAgencyIdentity();
}

/**
 * Server-side access guard. Call at the top of any dashboard page that belongs
 * to a specific client. Redirects unauthorized users to their allowed default.
 * super_admin and agency (and partner_admin on partner tenants) bypass client
 * restrictions within the tenant's portfolio.
 */
export async function requireClientAccess(clientId: string): Promise<void> {
  const tenant = getDeploymentTenant();
  // Hard tenant cap, checked before any role bypass: a partner deployment never
  // serves a client outside its portfolio, whatever the user's role.
  if (!isClientAllowedForTenant(tenant, clientId)) redirect(tenant.homePath);

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (error || !profile) redirect('/login');

  if (hasTenantWideAccess(tenant, profile.role)) {
    return;
  }

  const allowed = profile.client_access ?? [];
  if (allowed.includes(clientId)) return;

  // Redirect to the user's first allowed client on this tenant, or login if none
  for (const id of allowed) {
    const href = CLIENT_DEFAULTS[id];
    if (href && isClientAllowedForTenant(tenant, id)) redirect(href);
  }
  redirect('/login');
}

async function readProfile(): Promise<{ userId: string; profile: Profile } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return { userId: user.id, profile: data as Profile };
}

/**
 * Non-redirecting check for API routes and server actions: whether the signed-in
 * user may read/write this client's data on this deployment.
 */
export async function checkClientAccess(clientId: string): Promise<'ok' | 'unauthorized' | 'forbidden'> {
  const tenant = getDeploymentTenant();
  if (!isClientAllowedForTenant(tenant, clientId)) return 'forbidden';
  const result = await readProfile();
  if (!result) return 'unauthorized';
  const { profile } = result;
  if (hasTenantWideAccess(tenant, profile.role)) return 'ok';
  return (profile.client_access ?? []).includes(clientId) ? 'ok' : 'forbidden';
}

/** Route-handler variant: a Response to return when access is denied, otherwise null. */
export async function denyClientApiAccess(clientId: string): Promise<Response | null> {
  const access = await checkClientAccess(clientId);
  if (access === 'unauthorized') return new Response('Unauthorized', { status: 401 });
  if (access === 'forbidden') return new Response('Forbidden', { status: 403 });
  return null;
}

/** Partner-tenant user management (Team page). Redirects anyone else away. */
export async function requireTeamAdmin(): Promise<TeamAdminIdentity> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) redirect('/dashboard');
  const result = await readProfile();
  if (!result) redirect('/login');
  if (!canManageTenantUsers(tenant, result.profile.role)) redirect(tenant.homePath);
  return { userId: result.userId, role: result.profile.role };
}

/** Server-action variant of requireTeamAdmin: the identity, or an error message. */
export async function teamAdminError(): Promise<{ error: string } | { identity: TeamAdminIdentity }> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) return { error: 'Not available on this deployment' };
  const result = await readProfile();
  if (!result) return { error: 'Unauthorized' };
  if (!canManageTenantUsers(tenant, result.profile.role)) return { error: 'Forbidden' };
  return { identity: { userId: result.userId, role: result.profile.role } };
}
