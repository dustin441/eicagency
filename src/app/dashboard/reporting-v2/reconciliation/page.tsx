import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import { SegmentReconciliation } from '@/components/PrepassSegmentReport';
import { requireClientAccess } from '@/lib/auth-guard';
import { paramsFromSearch } from '@/services/analytics';
import { fetchPrepassSegmentReport } from '@/services/prepass-segment-report';

export default async function ReportingV2ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const [smb, abm, fd360] = await Promise.all([
    fetchPrepassSegmentReport('SMB', params.start, params.end),
    fetchPrepassSegmentReport('ABM', params.start, params.end),
    fetchPrepassSegmentReport('FD360', params.start, params.end),
  ]);
  return (
    <ReportingV2Shell title="Reconciliation" description="Do the ad platforms and Marketo tell the same story? Platform-reported leads against the people who reached Marketo, by segment.">
      <FilterBar showChannel={false} showCompare={false} />
      <SegmentReconciliation reports={{ SMB: smb, ABM: abm, FD360: fd360 }} />
    </ReportingV2Shell>
  );
}
