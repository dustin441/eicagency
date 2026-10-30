import React from 'react';
import { requireClientAdmin } from '@/lib/auth-guard';
import { getDeploymentTenant } from '@/lib/tenant';
import { listPartnerUsers } from '@/services/partner-users';
import ClientSettingsClient from '@/components/ClientSettingsClient';

// Server component behind /dashboard/<client>/settings. Client Admins of this client
// and Master Admins only; lists only this client's members (Master Admins are not shown).
export default async function ClientSettingsPage({ clientId }: { clientId: string }) {
  const ctx = await requireClientAdmin(clientId);
  const tenant = getDeploymentTenant();
  const users = (await listPartnerUsers())
    .filter(u => u.role === 'client' && u.access[clientId])
    .map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      level: u.access[clientId],
      lastSignIn: u.lastSignIn,
      isSelf: u.id === ctx.userId,
    }));

  return <ClientSettingsClient clientId={clientId} clientName={tenant.clientLabels[clientId] ?? clientId} users={users} />;
}
