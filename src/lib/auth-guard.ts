import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  canManageTenantUsers,
  canEditTenantBudget,
  getDeploymentTenant,
  hasTenantWideAccess,
  isClientAllowedForTenant,
  partnerAccessMap,
  type AccessLevel,
  type ClientMembership,
  type ProfileRole,
  type TenantConfig,
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

/** Who the caller is and what they may do on this deployment. */
export type AccessContext = {
  userId: string;
  role: ProfileRole;
  /** Master Admin on a partner tenant (all clients + global settings). */
  isMaster: boolean;
  /** Client id → level. EIC client grants are reported as 'viewer'. */
  levels: Map<string, AccessLevel>;
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

/**
 * Loads the caller's access. Partner tenants read per-client rows from
 * client_memberships (RLS: own rows only); EIC keeps profiles.client_access.
 */
export async function loadAccessContext(): Promise<AccessContext | null> {
  const tenant = getDeploymentTenant();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  const profile = data as Profile;

  if (tenant.internalFeatures) {
    const levels = new Map<string, AccessLevel>();
    if (!hasTenantWideAccess(tenant, profile.role)) {
      for (const id of profile.client_access ?? []) levels.set(id, 'viewer');
    }
    return { userId: user.id, role: profile.role, isMaster: false, levels };
  }

  const { data: rows } = await supabase
    .from('client_memberships')
    .select('client_id, access_level')
    .eq('user_id', user.id);
  return {
    userId: user.id,
    role: profile.role,
    isMaster: canManageTenantUsers(tenant, profile.role),
    levels: partnerAccessMap(tenant, profile.role, (rows ?? []) as unknown as ClientMembership[]),
  };
}

function canView(tenant: TenantConfig, ctx: AccessContext, clientId: string): boolean {
  if (!isClientAllowedForTenant(tenant, clientId)) return false;
  if (tenant.internalFeatures && hasTenantWideAccess(tenant, ctx.role)) return true;
  return ctx.levels.has(clientId);
}

function canAdmin(tenant: TenantConfig, ctx: AccessContext, clientId: string): boolean {
  if (tenant.internalFeatures) return false;
  return isClientAllowedForTenant(tenant, clientId) && ctx.levels.get(clientId) === 'admin';
}

/** Where to send a user who may not see the requested page. */
function fallbackPath(tenant: TenantConfig, ctx: AccessContext): string {
  // Partner tenants: Home is for Master Admins only; everyone else lands on their
  // first dashboard (in portfolio order).
  if (!tenant.internalFeatures && ctx.isMaster) return tenant.homePath;
  const order = tenant.internalFeatures ? [...ctx.levels.keys()] : (tenant.allowedClients ?? []).filter(id => ctx.levels.has(id));
  for (const id of order) {
    const href = CLIENT_DEFAULTS[id];
    if (href && isClientAllowedForTenant(tenant, id)) return href;
  }
  return '/login';
}

export async function requireAgencyIdentity(): Promise<AgencyIdentity> {
  const tenant = getDeploymentTenant();
  // Agency tools are EIC-internal; partner tenants never expose them.
  if (!tenant.internalFeatures) redirect(tenant.homePath);

  const ctx = await loadAccessContext();
  if (!ctx) redirect('/login');
  if (ctx.role === 'super_admin' || ctx.role === 'agency') return { userId: ctx.userId, role: ctx.role };
  redirect(fallbackPath(tenant, ctx));
}

export async function requireAgencyAccess(): Promise<void> {
  await requireAgencyIdentity();
}

/**
 * Server-side access guard. Call at the top of any dashboard page that belongs
 * to a specific client. Redirects unauthorized users to their allowed default.
 * EIC: super_admin and agency bypass client restrictions. Partner tenants: Master
 * Admins see every tenant client; everyone else needs a client_memberships row.
 */
export async function requireClientAccess(clientId: string): Promise<AccessContext> {
  const tenant = getDeploymentTenant();
  // Hard tenant cap, checked before any role bypass: a partner deployment never
  // serves a client outside its portfolio, whatever the user's role.
  if (!isClientAllowedForTenant(tenant, clientId)) redirect(tenant.homePath);

  const ctx = await loadAccessContext();
  if (!ctx) redirect('/login');
  if (canView(tenant, ctx, clientId)) return ctx;
  redirect(fallbackPath(tenant, ctx));
}

/** Per-dashboard Settings: Client Admins of this client and Master Admins only. */
export async function requireClientAdmin(clientId: string): Promise<AccessContext> {
  const tenant = getDeploymentTenant();
  const ctx = await requireClientAccess(clientId);
  if (!canAdmin(tenant, ctx, clientId)) redirect(CLIENT_DEFAULTS[clientId] ?? tenant.homePath);
  return ctx;
}

/** Home page: Master Admins only; anyone else goes to their own dashboard. */
export async function requireHomeAccess(): Promise<AccessContext> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) redirect('/dashboard');
  const ctx = await loadAccessContext();
  if (!ctx) redirect('/login');
  if (!ctx.isMaster) redirect(fallbackPath(tenant, ctx));
  return ctx;
}

/**
 * Non-redirecting check for API routes and server actions: whether the signed-in
 * user may read/write this client's data on this deployment.
 */
export async function checkClientAccess(clientId: string): Promise<'ok' | 'unauthorized' | 'forbidden'> {
  const tenant = getDeploymentTenant();
  if (!isClientAllowedForTenant(tenant, clientId)) return 'forbidden';
  const ctx = await loadAccessContext();
  if (!ctx) return 'unauthorized';
  return canView(tenant, ctx, clientId) ? 'ok' : 'forbidden';
}

/** Budget edits: EIC keeps client access; partner tenants require a Master Admin. */
export async function checkBudgetEditor(clientId: string): Promise<'ok' | 'unauthorized' | 'forbidden'> {
  const tenant = getDeploymentTenant();
  if (!isClientAllowedForTenant(tenant, clientId)) return 'forbidden';
  const ctx = await loadAccessContext();
  if (!ctx) return 'unauthorized';
  if (!canView(tenant, ctx, clientId)) return 'forbidden';
  return canEditTenantBudget(tenant, ctx.role, ctx.isMaster) ? 'ok' : 'forbidden';
}

/** Route-handler variant: a Response to return when access is denied, otherwise null. */
export async function denyClientApiAccess(clientId: string): Promise<Response | null> {
  const access = await checkClientAccess(clientId);
  if (access === 'unauthorized') return new Response('Unauthorized', { status: 401 });
  if (access === 'forbidden') return new Response('Forbidden', { status: 403 });
  return null;
}

/** Master Admin settings (Home → Settings). Redirects anyone else away. */
export async function requireTeamAdmin(): Promise<TeamAdminIdentity> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) redirect('/dashboard');
  const ctx = await loadAccessContext();
  if (!ctx) redirect('/login');
  if (!ctx.isMaster) redirect(fallbackPath(tenant, ctx));
  return { userId: ctx.userId, role: ctx.role };
}

/** Server-action variant of requireTeamAdmin: the identity, or an error message. */
export async function teamAdminError(): Promise<{ error: string } | { identity: TeamAdminIdentity }> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) return { error: 'Not available on this deployment' };
  const ctx = await loadAccessContext();
  if (!ctx) return { error: 'Unauthorized' };
  if (!ctx.isMaster) return { error: 'Forbidden' };
  return { identity: { userId: ctx.userId, role: ctx.role } };
}

/** Server-action check for per-dashboard user management (Client Admin or Master). */
export async function clientAdminError(clientId: string): Promise<{ error: string } | { ctx: AccessContext }> {
  const tenant = getDeploymentTenant();
  if (tenant.internalFeatures) return { error: 'Not available on this deployment' };
  const ctx = await loadAccessContext();
  if (!ctx) return { error: 'Unauthorized' };
  if (!canAdmin(tenant, ctx, clientId)) return { error: 'Forbidden' };
  return { ctx };
}
