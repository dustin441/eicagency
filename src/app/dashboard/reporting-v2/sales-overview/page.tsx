import { redirect } from 'next/navigation';
import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import PrepassSalesOverviewClient from '@/components/PrepassSalesOverviewClient';
import PrepassCostPerWinPanel from '@/components/PrepassCostPerWinPanel';
import PrepassEnrollmentTrackingPanel from '@/components/PrepassEnrollmentTrackingPanel';
import PrepassSpendEnrollmentPanel from '@/components/PrepassSpendEnrollmentPanel';
import PrepassConversionPathsPanel from '@/components/PrepassConversionPathsPanel';
import PrepassCallCampaignsPanel from '@/components/PrepassCallCampaignsPanel';
import PrepassOpportunityPathsPanel from '@/components/PrepassOpportunityPathsPanel';
import PrepassLostReasonsPanel from '@/components/PrepassLostReasonsPanel';
import PrepassEmailTouchpointsPanel from '@/components/PrepassEmailTouchpointsPanel';
import PrepassStageJourneyPanel from '@/components/PrepassStageJourneyPanel';
import PrepassSalesReadoutCard from '@/components/PrepassSalesReadoutCard';
import { canEditSalesNotes } from './actions';
import { ReportingV2Unavailable } from '@/components/ReportingV2Comparison';
import { requireClientAccess } from '@/lib/auth-guard';
import { paramsFromSearch } from '@/services/analytics';
import {
  fetchPrepassCallCampaigns,
  fetchPrepassConversionPaths,
  fetchPrepassEmailTouchpoints,
  fetchPrepassEnrollmentTracking,
  fetchPrepassOpportunityPaths,
  fetchPrepassOpportunityPipeline,
  fetchPrepassSalesNotes,
  fetchPrepassSalesOverview,
  fetchPrepassSalesReadout,
  fetchPrepassSalesYoY,
  fetchPrepassStageJourney,
  fetchPrepassSpendEnrollment,
} from '@/services/prepass-sales-overview';

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <summary className="cursor-pointer text-lg font-semibold text-gray-950">{title}</summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  );
}

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
  const [result, yoy, tracking, spendEnrollment, conversionPaths, callCampaigns, oppPaths, oppPipeline, emailTouch, stageJourney, readout, notes, canEdit] = await Promise.all([
    fetchPrepassSalesOverview(params.start, params.end),
    fetchPrepassSalesYoY(params.start, params.end),
    fetchPrepassEnrollmentTracking(params.start, params.end),
    fetchPrepassSpendEnrollment(params.start, params.end),
    fetchPrepassConversionPaths(params.start, params.end),
    fetchPrepassCallCampaigns(params.start, params.end),
    fetchPrepassOpportunityPaths(params.start, params.end),
    fetchPrepassOpportunityPipeline(params.start, params.end),
    fetchPrepassEmailTouchpoints(params.start, params.end),
    fetchPrepassStageJourney(params.start, params.end),
    fetchPrepassSalesReadout(),
    fetchPrepassSalesNotes(),
    canEditSalesNotes(),
  ]);

  return (
    <ReportingV2Shell
      title="Sales Overview"
      description="Leads, MQLs, SQLs and closed-won from Marketo, and which sources and campaigns they came from. Paid ads are one of several sources."
    >
      <PrepassSalesReadoutCard readout={readout} notes={notes} canEdit={canEdit} />
      <FilterBar showChannel={false} showCompare={false} />
      {result.available ? (
        <PrepassSalesOverviewClient
          data={result.data}
          yoy={yoy}
          journey={<PrepassStageJourneyPanel data={stageJourney} />}
          afterYoy={
            <>
              <DetailGroup title="Detail: traffic, spend and cost per win">
                <PrepassCostPerWinPanel yoy={yoy} />
                <PrepassSpendEnrollmentPanel data={spendEnrollment} tracking={tracking} />
                <PrepassEnrollmentTrackingPanel tracking={tracking} />
              </DetailGroup>
              <DetailGroup title="Detail: how people convert and why deals are lost">
                <PrepassConversionPathsPanel data={conversionPaths} />
                <PrepassCallCampaignsPanel data={callCampaigns} />
                <PrepassOpportunityPathsPanel data={oppPaths} />
                <PrepassLostReasonsPanel data={oppPipeline} />
              </DetailGroup>
              <DetailGroup title="Detail: email programs and follow-up gaps">
                <PrepassEmailTouchpointsPanel data={emailTouch} />
              </DetailGroup>
            </>
          }
        />
      ) : (
        <ReportingV2Unavailable reason={result.reason} />
      )}
    </ReportingV2Shell>
  );
}
