import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import { SegmentTab } from '@/components/PrepassSegmentReport';
import { requireClientAccess } from '@/lib/auth-guard';
import { paramsFromSearch } from '@/services/analytics';
import { fetchPrepassSegmentExtras, fetchPrepassSegmentReport } from '@/services/prepass-segment-report';

export default async function ReportingV2Fd360Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const sp = await searchParams;
  const params = paramsFromSearch(sp);
  const [data, comp, extras] = await Promise.all([
    fetchPrepassSegmentReport('FD360', params.start, params.end),
    fetchPrepassSegmentReport('FD360', params.compStart, params.compEnd),
    fetchPrepassSegmentExtras('FD360', params.start, params.end),
  ]);
  const view = sp.view === 'cohort' ? 'cohort' : 'events';
  return (
    <ReportingV2Shell title="FD360" description="FD360 campaigns: spend, leads and stages from Marketo, one person in one segment, with two ways to count.">
      <FilterBar showChannel={false} />
      {data ? (
        <SegmentTab data={data} comp={comp} extras={extras} view={view} basePath="/dashboard/reporting-v2/fd360" search={sp} />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">This segment report is not available right now. Existing PrePass reports are unaffected.</section>
      )}
    </ReportingV2Shell>
  );
}
