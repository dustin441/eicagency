import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import { SegmentOverview } from '@/components/PrepassSegmentReport';
import { requireClientAccess } from '@/lib/auth-guard';
import { paramsFromSearch } from '@/services/analytics';
import { fetchPrepassSegmentReport } from '@/services/prepass-segment-report';

export default async function ReportingV2OverviewPage({
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
    <ReportingV2Shell title="Overview" description="SMB, ABM and FD360 side by side, from the Marketo mirror, with each person counted once.">
      <FilterBar showChannel={false} showCompare={false} />
      <SegmentOverview reports={{ SMB: smb, ABM: abm, FD360: fd360 }} base="/dashboard/reporting-v2" />
    </ReportingV2Shell>
  );
}
