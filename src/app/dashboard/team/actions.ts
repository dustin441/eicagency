'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { clientAdminError, teamAdminError } from '@/lib/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  ACCESS_LEVELS,
  ASSIGNABLE_PARTNER_ROLES,
  TEAM_PATH,
  clientSettingsPath,
  getDeploymentTenant,
  type AccessLevel,
  type AssignablePartnerRole,
} from '@/lib/tenant';

// User management for partner tenants. Two entry points, both re-checked on every call:
// - Master Admin (Home → Settings): any user, any tenant client, Master or member role.
// - Client Admin / Master in a dashboard's Settings: only that client's membership rows,
//   only member users (never Masters), viewer or admin for that client only.
// Nobody changes their own access, and EIC staff rows (agency / super_admin) are never
// touched here. All writes use the service role after these checks; the database
// itself (RLS) lets users read only their own rows and write nothing.

type ActionResult = { error?: string; notice?: string };
type AccessMap = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLevel(value: string): value is AccessLevel {
  return (ACCESS_LEVELS as readonly string[]).includes(value);
}

function cleanName(value: string): string | null {
  return value.trim().slice(0, 120) || null;
}

/** Validates a Master's role + per-client levels; members need at least one client. */
function validateMasterInput(role: string, access: AccessMap):
  { role: AssignablePartnerRole; rows: { client_id: string; access_level: AccessLevel }[] } | string {
  if (!(ASSIGNABLE_PARTNER_ROLES as readonly string[]).includes(role)) return 'Invalid role';
  if (role === 'partner_admin') return { role: 'partner_admin', rows: [] };
  const portfolio = getDeploymentTenant().allowedClients ?? [];
  const rows: { client_id: string; access_level: AccessLevel }[] = [];
  for (const [clientId, level] of Object.entries(access)) {
    if (level === 'none' || level === '') continue;
    if (!portfolio.includes(clientId)) return 'Invalid client';
    if (!isLevel(level)) return 'Invalid permission';
    rows.push({ client_id: clientId, access_level: level });
  }
  if (rows.length === 0) return 'Give access to at least one dashboard';
  return { role: 'client', rows };
}

type TargetProfile = { role: string } | null;

async function targetProfile(userId: string): Promise<TargetProfile | 'error'> {
  const db = createServerSupabaseClient();
  const { data, error } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return 'error';
  return data as TargetProfile;
}

/**
 * Finds or invites the login for an email. Returns the user id and whether an
 * invite email went out (an existing login only gets access, no email).
 */
async function ensureLogin(email: string, fullName: string | null): Promise<{ userId: string; invited: boolean } | { error: string }> {
  const db = createServerSupabaseClient();
  const invited = await db.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${await inviteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (invited.data.user) return { userId: invited.data.user.id, invited: true };
  const existing = await findUserIdByEmail(email);
  if (!existing) return { error: invited.error?.message ?? 'Could not invite the user' };
  return { userId: existing, invited: false };
}

function addedNotice(email: string, invited: boolean): string {
  return invited
    ? `Invitation sent to ${email}.`
    : `${email} already had a login and now has access. If they don't know the password, they can use "Forgot password?".`;
}

/** Removes a member's login entirely once they have no dashboard left. */
async function deleteIfNoAccessLeft(userId: string): Promise<string | null> {
  const db = createServerSupabaseClient();
  const { count, error } = await db
    .from('client_memberships')
    .select('client_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return error.message;
  if ((count ?? 0) > 0) return null;
  const removed = await db.from('profiles').delete().eq('id', userId).eq('role', 'client');
  if (removed.error) return removed.error.message;
  const deleted = await db.auth.admin.deleteUser(userId);
  return deleted.error ? deleted.error.message : null;
}

function revalidateAll() {
  revalidatePath(TEAM_PATH);
  for (const id of getDeploymentTenant().allowedClients ?? []) revalidatePath(clientSettingsPath(id));
}

// ─── Master Admin (Home → Settings) ──────────────────────────────────────────

export async function addTeamMember(input: {
  email: string;
  fullName: string;
  role: string;
  access: AccessMap;
}): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email' };
  const fullName = cleanName(input.fullName);
  const valid = validateMasterInput(input.role, input.access);
  if (typeof valid === 'string') return { error: valid };

  const login = await ensureLogin(email, fullName);
  if ('error' in login) return login;
  const existing = await targetProfile(login.userId);
  if (existing === 'error') return { error: 'Could not read the user' };
  if (existing) return { error: 'This email already has access. Edit the user instead.' };

  const db = createServerSupabaseClient();
  const { error } = await db.from('profiles').insert({ id: login.userId, role: valid.role, client_access: null, full_name: fullName });
  if (error) return { error: error.message };
  if (valid.rows.length > 0) {
    const rows = valid.rows.map(r => ({ ...r, user_id: login.userId, created_by: auth.identity.userId }));
    const inserted = await db.from('client_memberships').insert(rows);
    if (inserted.error) return { error: inserted.error.message };
  }

  revalidateAll();
  return { notice: addedNotice(email, login.invited) };
}

export async function updateTeamMember(input: {
  userId: string;
  fullName: string;
  role: string;
  access: AccessMap;
}): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };
  if (input.userId === auth.identity.userId) return { error: 'You cannot change your own access' };
  const target = await targetProfile(input.userId);
  if (target === 'error' || !target) return { error: 'User not found' };
  if (!(ASSIGNABLE_PARTNER_ROLES as readonly string[]).includes(target.role)) return { error: 'This user is managed by EIC' };
  const valid = validateMasterInput(input.role, input.access);
  if (typeof valid === 'string') return { error: valid };

  const db = createServerSupabaseClient();
  const updated = await db
    .from('profiles')
    .update({ role: valid.role, client_access: null, full_name: cleanName(input.fullName), updated_at: new Date().toISOString() })
    .eq('id', input.userId)
    .in('role', [...ASSIGNABLE_PARTNER_ROLES]);
  if (updated.error) return { error: updated.error.message };

  // Replace this user's dashboard permissions with exactly what was submitted.
  const cleared = await db.from('client_memberships').delete().eq('user_id', input.userId);
  if (cleared.error) return { error: cleared.error.message };
  if (valid.rows.length > 0) {
    const rows = valid.rows.map(r => ({ ...r, user_id: input.userId, created_by: auth.identity.userId }));
    const inserted = await db.from('client_memberships').insert(rows);
    if (inserted.error) return { error: inserted.error.message };
  }

  revalidateAll();
  return { notice: 'Access updated' };
}

export async function removeTeamMember(userId: string): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };
  if (userId === auth.identity.userId) return { error: 'You cannot remove yourself' };
  const target = await targetProfile(userId);
  if (target === 'error' || !target) return { error: 'User not found' };
  if (!(ASSIGNABLE_PARTNER_ROLES as readonly string[]).includes(target.role)) return { error: 'This user is managed by EIC' };

  const db = createServerSupabaseClient();
  const removed = await db.from('profiles').delete().eq('id', userId).in('role', [...ASSIGNABLE_PARTNER_ROLES]);
  if (removed.error) return { error: removed.error.message };
  // Memberships go with the auth user (on delete cascade).
  const deleted = await db.auth.admin.deleteUser(userId);
  if (deleted.error) return { error: deleted.error.message };

  revalidateAll();
  return { notice: 'User removed' };
}

// ─── Dashboard Settings (Client Admin or Master, one client only) ────────────

export async function addClientUser(input: {
  clientId: string;
  email: string;
  fullName: string;
  level: string;
}): Promise<ActionResult> {
  const auth = await clientAdminError(input.clientId);
  if ('error' in auth) return { error: auth.error };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email' };
  if (!isLevel(input.level)) return { error: 'Invalid permission' };
  const fullName = cleanName(input.fullName);

  const login = await ensureLogin(email, fullName);
  if ('error' in login) return login;
  if (login.userId === auth.ctx.userId) return { error: 'You cannot change your own access' };
  const existing = await targetProfile(login.userId);
  if (existing === 'error') return { error: 'Could not read the user' };
  if (existing && existing.role !== 'client') return { error: 'This user already has access to every dashboard' };

  const db = createServerSupabaseClient();
  if (!existing) {
    const created = await db.from('profiles').insert({ id: login.userId, role: 'client', client_access: null, full_name: fullName });
    if (created.error) return { error: created.error.message };
  }
  const { data: current } = await db
    .from('client_memberships')
    .select('client_id')
    .eq('user_id', login.userId)
    .eq('client_id', input.clientId)
    .maybeSingle();
  if (current) return { error: 'This user already has access to this dashboard' };
  const inserted = await db.from('client_memberships').insert({
    user_id: login.userId,
    client_id: input.clientId,
    access_level: input.level,
    created_by: auth.ctx.userId,
  });
  if (inserted.error) return { error: inserted.error.message };

  revalidateAll();
  return { notice: addedNotice(email, login.invited) };
}

/** Shared guard for changing an existing user on one client. */
async function clientTargetError(clientId: string, userId: string, callerId: string): Promise<string | null> {
  if (userId === callerId) return 'You cannot change your own access';
  const target = await targetProfile(userId);
  if (target === 'error' || !target) return 'User not found';
  if (target.role !== 'client') return 'Master Admins are managed in the main Settings';
  return null;
}

export async function setClientUserLevel(input: { clientId: string; userId: string; level: string }): Promise<ActionResult> {
  const auth = await clientAdminError(input.clientId);
  if ('error' in auth) return { error: auth.error };
  if (!isLevel(input.level)) return { error: 'Invalid permission' };
  const refusal = await clientTargetError(input.clientId, input.userId, auth.ctx.userId);
  if (refusal) return { error: refusal };

  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from('client_memberships')
    .update({ access_level: input.level, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .eq('client_id', input.clientId)
    .select('client_id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'User not found on this dashboard' };

  revalidateAll();
  return { notice: 'Permission updated' };
}

export async function removeClientUser(input: { clientId: string; userId: string }): Promise<ActionResult> {
  const auth = await clientAdminError(input.clientId);
  if ('error' in auth) return { error: auth.error };
  const refusal = await clientTargetError(input.clientId, input.userId, auth.ctx.userId);
  if (refusal) return { error: refusal };

  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from('client_memberships')
    .delete()
    .eq('user_id', input.userId)
    .eq('client_id', input.clientId)
    .select('client_id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'User not found on this dashboard' };
  const cleanup = await deleteIfNoAccessLeft(input.userId);
  if (cleanup) return { error: cleanup };

  revalidateAll();
  return { notice: 'User removed from this dashboard' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findUserIdByEmail(email: string): Promise<string | null> {
  const db = createServerSupabaseClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find(u => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Where invite links point. In production always the tenant's own domain (never a
 * protected *.vercel.app URL, whatever page the admin used); in previews and locally
 * the current origin, so invites can be tested there.
 */
async function inviteOrigin(): Promise<string> {
  const domain = getDeploymentTenant().hostnames[0];
  if (process.env.VERCEL_ENV === 'production' && domain) return `https://${domain}`;
  // The proxy already rejected hosts owned by another tenant.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
