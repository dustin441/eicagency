import ReportingV2Shell from '@/components/ReportingV2Shell';
import { ReportingV2Focus } from '@/components/ReportingV2Comparison';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchPrepassMarketoMirrorComparison, paramsFromSearch } from '@/services/analytics';

export default async function ReportingV2Fd360Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const data = await fetchPrepassMarketoMirrorComparison(paramsFromSearch(await searchParams));
  return <ReportingV2Shell title="FD360" description="FD360 lifecycle-stage comparison between approved v2 paid attribution and the unchanged existing dashboard."><ReportingV2Focus data={data} focus="FD360" /></ReportingV2Shell>;
}
