import ReportingV2Shell from '@/components/ReportingV2Shell';
import FilterBar from '@/components/FilterBar';
import { SegmentTab } from '@/components/PrepassSegmentReport';
import { Suspense } from 'react';
import PrepassSegmentCreatives from '@/components/PrepassSegmentCreatives';
import { requireClientAccess } from '@/lib/auth-guard';
import { BudgetPacing } from '@/components/FocusDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updatePrepassBudget } from '../../actions';
import { paramsFromSearch } from '@/services/analytics';
import { fetchPrepassSegmentCrossover, fetchPrepassSegmentBudget, fetchPrepassSegmentExtras, fetchPrepassSegmentReport } from '@/services/prepass-segment-report';

export default async function ReportingV2SmbPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const sp = await searchParams;
  const params = paramsFromSearch(sp);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';
  const [data, comp, extras, budget, crossover] = await Promise.all([
    fetchPrepassSegmentReport('SMB', params.start, params.end),
    fetchPrepassSegmentReport('SMB', params.compStart, params.compEnd),
    fetchPrepassSegmentExtras('SMB', params.start, params.end),
    fetchPrepassSegmentBudget('SMB'),
    fetchPrepassSegmentCrossover('SMB', params.start, params.end),
  ]);
  const view = sp.view === 'cohort' ? 'cohort' : 'events';
  return (
    <ReportingV2Shell title="SMB" description="Small and mid-size fleets: spend, leads and stages from Marketo, one person in one segment, with two ways to count.">
      <FilterBar showChannel={false} />
      {budget && budget.budget > 0 && <BudgetPacing d={budget} isAdmin={isAdmin} updateBudget={updatePrepassBudget} />}
      {data ? (
        <SegmentTab crossover={crossover} data={data} comp={comp} extras={extras} view={view} basePath="/dashboard/reporting-v2/smb" search={sp} />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">This segment report is not available right now. Existing PrePass reports are unaffected.</section>
      )}
      <Suspense fallback={<p className="text-xs text-gray-500">Loading ad creatives…</p>}>
        <PrepassSegmentCreatives segment="SMB" params={params} />
      </Suspense>
    </ReportingV2Shell>
  );
}
