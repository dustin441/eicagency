import ReportingV2Shell from '@/components/ReportingV2Shell';
import { ReportingV2CampaignPerformance } from '@/components/ReportingV2Comparison';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchPrepassMarketoMirrorComparison, paramsFromSearch } from '@/services/analytics';
import { fetchReportingV2CampaignMappings } from '@/services/prepass-reporting-v2';

export default async function ReportingV2CampaignPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const [data, mappings] = await Promise.all([
    fetchPrepassMarketoMirrorComparison(params),
    fetchReportingV2CampaignMappings(params.start, params.end),
  ]);

  return (
    <ReportingV2Shell title="Campaign Performance" description="Available focus allocation comparison and the approved campaign mapping that will power campaign-level v2 detail.">
      <ReportingV2CampaignPerformance data={data} mappings={mappings} />
    </ReportingV2Shell>
  );
}
