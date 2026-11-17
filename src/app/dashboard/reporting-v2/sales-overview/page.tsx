import { redirect } from 'next/navigation';
import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import PrepassSalesOverviewClient from '@/components/PrepassSalesOverviewClient';
import PrepassCostPerWinPanel from '@/components/PrepassCostPerWinPanel';
import PrepassEnrollmentTrackingPanel from '@/components/PrepassEnrollmentTrackingPanel';
import { ReportingV2Unavailable } from '@/components/ReportingV2Comparison';
import { requireClientAccess } from '@/lib/auth-guard';
import { paramsFromSearch } from '@/services/analytics';
import { fetchPrepassEnrollmentTracking, fetchPrepassSalesOverview, fetchPrepassSalesYoY } from '@/services/prepass-sales-overview';

const BASE = '/dashboard/reporting-v2/sales-overview';

/** Default view is the last 12 months (calendar months, including the current one). */
function twelveMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

export default async function PrepassSalesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const sp = await searchParams;

  if (!sp.start && !sp.end) {
    const w = twelveMonthWindow();
    redirect(`${BASE}?start=${w.start}&end=${w.end}`);
  }

  const params = paramsFromSearch(sp);
  const [result, yoy, tracking] = await Promise.all([
    fetchPrepassSalesOverview(params.start, params.end),
    fetchPrepassSalesYoY(params.start, params.end),
    fetchPrepassEnrollmentTracking(params.start, params.end),
  ]);

  return (
    <ReportingV2Shell
      title="Sales Overview"
      description="Leads, MQLs, SQLs and closed-won from Marketo, and which sources and campaigns they came from. Paid ads are one of several sources."
    >
      <FilterBar showChannel={false} showCompare={false} />
      {result.available ? (
        <PrepassSalesOverviewClient
          data={result.data}
          yoy={yoy}
          afterYoy={
            <>
              <PrepassCostPerWinPanel yoy={yoy} />
              <PrepassEnrollmentTrackingPanel tracking={tracking} />
            </>
          }
        />
      ) : (
        <ReportingV2Unavailable reason={result.reason} />
      )}
    </ReportingV2Shell>
  );
}
