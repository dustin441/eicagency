import EicSeoDashboardClient from '@/components/EicSeoDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchEicSeoDashboard } from '@/services/eic-seo';

export default async function EicSeoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('eicagency');
  const params = await searchParams;
  const data = await fetchEicSeoDashboard(params.start, params.end);
  return <EicSeoDashboardClient data={data} />;
}
