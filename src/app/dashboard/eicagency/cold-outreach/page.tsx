import ColdOutreachDashboardClient from '@/components/ColdOutreachDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { eicAgencyParamsFromSearch } from '@/services/eicagency-analytics';
import { fetchEicInstantlyPerformance } from '@/services/instantly-analytics';

export default async function ColdOutreachPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('eicagency');

  const params = eicAgencyParamsFromSearch(await searchParams);
  const data = await fetchEicInstantlyPerformance(params.start, params.end);

  return <ColdOutreachDashboardClient data={data} />;
}
