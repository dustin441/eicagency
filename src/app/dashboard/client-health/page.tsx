import ClientHealthDashboardClient from '@/components/ClientHealthDashboardClient';
import { requireAgencyAccess } from '@/lib/auth-guard';
import { fetchClientHealthDashboard } from '@/services/client-health';

export const dynamic = 'force-dynamic';

export default async function ClientHealthPage() {
  await requireAgencyAccess();
  const data = await fetchClientHealthDashboard();

  return <ClientHealthDashboardClient data={data} />;
}
