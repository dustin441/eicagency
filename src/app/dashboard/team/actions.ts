'use server';

import { revalidatePath } from 'next/cache';
import { teamAdminError } from '@/lib/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  ASSIGNABLE_PARTNER_ROLES,
  TEAM_PATH,
  getDeploymentTenant,
  type AssignablePartnerRole,
} from '@/lib/tenant';

// Team management for partner tenants. Every action re-checks the caller, only
// assigns partner roles, only grants clients inside the tenant portfolio, and never
// touches EIC staff rows (agency / super_admin), which are managed by EIC.

type ActionResult = { error?: string; notice?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAccess(role: string, clients: string[]): { role: AssignablePartnerRole; clients: string[] | null } | string {
  if (!(ASSIGNABLE_PARTNER_ROLES as readonly string[]).includes(role)) return 'Invalid role';
  if (role === 'partner_admin') return { role: 'partner_admin', clients: null };
  const portfolio = getDeploymentTenant().allowedClients ?? [];
  const unique = [...new Set(clients)];
  if (unique.length === 0) return 'Select at least one client';
  if (unique.some(id => !portfolio.includes(id))) return 'Invalid client';
  return { role: 'client', clients: unique };
}

/** The target's profile, refusing anything this screen must not manage. */
async function loadManagedProfile(userId: string, callerId: string): Promise<string | null> {
  if (userId === callerId) return 'You cannot change your own access';
  const db = createServerSupabaseClient();
  const { data, error } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return error.message;
  if (!data) return 'User not found';
  if (!(ASSIGNABLE_PARTNER_ROLES as readonly string[]).includes(data.role)) return 'This user is managed by the agency';
  return null;
}

export async function addTeamMember(input: {
  email: string;
  fullName: string;
  role: string;
  clients: string[];
}): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email' };
  const fullName = input.fullName.trim().slice(0, 120) || null;
  const access = validateAccess(input.role, input.clients);
  if (typeof access === 'string') return { error: access };

  const db = createServerSupabaseClient();
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  let userId = created.data.user?.id ?? null;
  if (created.error) {
    // The address may already have a login in this auth project (but no access yet).
    const existing = await findUserIdByEmail(email);
    if (!existing) return { error: created.error.message };
    const { data: profile } = await db.from('profiles').select('id').eq('id', existing).maybeSingle();
    if (profile) return { error: 'This email already has access' };
    userId = existing;
  }
  if (!userId) return { error: 'Could not create the user' };

  const { error } = await db.from('profiles').insert({
    id: userId,
    role: access.role,
    client_access: access.clients,
    full_name: fullName,
  });
  if (error) return { error: error.message };

  revalidatePath(TEAM_PATH);
  return { notice: `${email} added. They set their password with "Forgot password?" on the sign-in page.` };
}

export async function updateTeamMember(input: {
  userId: string;
  fullName: string;
  role: string;
  clients: string[];
}): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };
  const refusal = await loadManagedProfile(input.userId, auth.identity.userId);
  if (refusal) return { error: refusal };
  const access = validateAccess(input.role, input.clients);
  if (typeof access === 'string') return { error: access };

  const db = createServerSupabaseClient();
  const { error } = await db
    .from('profiles')
    .update({
      role: access.role,
      client_access: access.clients,
      full_name: input.fullName.trim().slice(0, 120) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.userId)
    .in('role', [...ASSIGNABLE_PARTNER_ROLES]);
  if (error) return { error: error.message };

  revalidatePath(TEAM_PATH);
  return { notice: 'Access updated' };
}

export async function removeTeamMember(userId: string): Promise<ActionResult> {
  const auth = await teamAdminError();
  if ('error' in auth) return { error: auth.error };
  const refusal = await loadManagedProfile(userId, auth.identity.userId);
  if (refusal) return { error: refusal };

  // Removing access deletes the profile (the login stops working on this dashboard)
  // and the auth user, so the email can be re-added cleanly later.
  const db = createServerSupabaseClient();
  const { error } = await db.from('profiles').delete().eq('id', userId).in('role', [...ASSIGNABLE_PARTNER_ROLES]);
  if (error) return { error: error.message };
  const deleted = await db.auth.admin.deleteUser(userId);
  if (deleted.error) return { error: deleted.error.message };

  revalidatePath(TEAM_PATH);
  return { notice: 'User removed' };
}

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
