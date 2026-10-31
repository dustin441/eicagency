import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { AccessLevel, ProfileRole } from '@/lib/tenant';

// Users of a partner deployment (auth project lozgnyxixzfxokllevtb for Scott):
// only accounts with a profile row are listed. Server-only: callers must have
// passed requireTeamAdmin / requireClientAdmin first.

export type PartnerUser = {
  id: string;
  email: string;
  fullName: string;
  role: ProfileRole;
  /** Client id → level; empty for Master Admins (they see every client). */
  access: Record<string, AccessLevel>;
  lastSignIn: string | null;
};

export async function listPartnerUsers(): Promise<PartnerUser[]> {
  const db = createServerSupabaseClient();
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    db.from('profiles').select('id, role, full_name, created_at').order('created_at', { ascending: true }),
    db.from('client_memberships').select('user_id, client_id, access_level'),
  ]);

  const logins = new Map<string, { email: string; lastSignIn: string | null }>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) logins.set(u.id, { email: u.email ?? '', lastSignIn: u.last_sign_in_at ?? null });
    if (data.users.length < 200) break;
  }

  const access = new Map<string, Record<string, AccessLevel>>();
  for (const m of (memberships ?? []) as unknown as { user_id: string; client_id: string; access_level: AccessLevel }[]) {
    const entry = access.get(m.user_id) ?? {};
    entry[m.client_id] = m.access_level;
    access.set(m.user_id, entry);
  }

  return ((profiles ?? []) as unknown as { id: string; role: ProfileRole; full_name: string | null }[]).map(p => ({
    id: p.id,
    email: logins.get(p.id)?.email ?? '',
    fullName: p.full_name ?? '',
    role: p.role,
    access: p.role === 'client' ? access.get(p.id) ?? {} : {},
    lastSignIn: logins.get(p.id)?.lastSignIn ?? null,
  }));
}
