import React from 'react';
import { requireTeamAdmin } from '@/lib/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getDeploymentTenant, type ProfileRole } from '@/lib/tenant';
import TeamManagerClient, { type TeamMember } from '@/components/TeamManagerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLIENT_LABELS: Record<string, string> = {
  aurit: 'Aurit Mediation',
  arabella: 'Arabella Hotels',
  kinsey: 'Kinsey Design',
  bloom: 'Bloom Aesthetics',
  champagne: 'Champagne House',
};

export default async function TeamPage() {
  const me = await requireTeamAdmin();
  const tenant = getDeploymentTenant();
  const db = createServerSupabaseClient();

  // Only users with a profile in this deployment's auth project are listed.
  const { data: profiles } = await db
    .from('profiles')
    .select('id, role, client_access, full_name, created_at')
    .order('created_at', { ascending: true });

  const emails = new Map<string, { email: string; lastSignIn: string | null }>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) emails.set(u.id, { email: u.email ?? '', lastSignIn: u.last_sign_in_at ?? null });
    if (data.users.length < 200) break;
  }

  const rows = (profiles ?? []) as unknown as {
    id: string;
    role: ProfileRole;
    client_access: string[] | null;
    full_name: string | null;
  }[];
  const members: TeamMember[] = rows.map(p => ({
    id: p.id,
    email: emails.get(p.id)?.email ?? '',
    fullName: p.full_name ?? '',
    role: p.role,
    clients: p.client_access ?? [],
    lastSignIn: emails.get(p.id)?.lastSignIn ?? null,
    isSelf: p.id === me.userId,
  }));

  const clients = (tenant.allowedClients ?? []).map(id => ({ id, name: CLIENT_LABELS[id] ?? id }));

  return <TeamManagerClient members={members} clients={clients} agencyName={tenant.agencyName} />;
}
