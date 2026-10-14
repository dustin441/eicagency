import ReportingV2Shell from '@/components/ReportingV2Shell';
import { ReportingV2Overview } from '@/components/ReportingV2Comparison';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchPrepassMarketoMirrorComparison, paramsFromSearch } from '@/services/analytics';

export default async function ReportingV2OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const data = await fetchPrepassMarketoMirrorComparison(paramsFromSearch(await searchParams));

  return (
    <ReportingV2Shell title="Overview" description="Lifecycle totals, mirror health, and links into the comparison-only Reporting v2 workspace.">
      <ReportingV2Overview data={data} />
    </ReportingV2Shell>
  );
}
