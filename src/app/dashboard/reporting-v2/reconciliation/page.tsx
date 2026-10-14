import MarketoMirrorComparison from '@/components/MarketoMirrorComparison';
import ReportingV2Shell from '@/components/ReportingV2Shell';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchPrepassMarketoMirrorComparison, paramsFromSearch } from '@/services/analytics';

export default async function ReportingV2ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const data = await fetchPrepassMarketoMirrorComparison(paramsFromSearch(await searchParams));

  return (
    <ReportingV2Shell title="Reconciliation" description="Detailed legacy-to-v2 audit of CRM lifecycle reality, paid attribution, and the existing reporting model.">
      <MarketoMirrorComparison data={data} embedded />
    </ReportingV2Shell>
  );
}
