import React from 'react';
import { requireTeamAdmin } from '@/lib/auth-guard';
import { getDeploymentTenant } from '@/lib/tenant';
import { listPartnerUsers } from '@/services/partner-users';
import TeamManagerClient from '@/components/TeamManagerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Master Admin settings (Home → Settings): every user and every dashboard permission.
export default async function TeamPage() {
  const me = await requireTeamAdmin();
  const tenant = getDeploymentTenant();
  const users = await listPartnerUsers();
  const clients = (tenant.allowedClients ?? []).map(id => ({ id, name: tenant.clientLabels[id] ?? id }));

  return (
    <TeamManagerClient
      members={users.map(u => ({ ...u, isSelf: u.id === me.userId }))}
      clients={clients}
      agencyName={tenant.agencyName}
    />
  );
}
