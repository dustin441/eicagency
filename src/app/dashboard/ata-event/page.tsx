import AtaEventDashboardClient from '@/components/AtaEventDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { ATA_BUDGET_MONTH_END, ATA_BUDGET_MONTH_START } from '@/lib/prepass-ata-scope';
import { paramsFromSearch } from '@/services/analytics';
import { fetchAtaEventData } from '@/services/prepass-ata-event';
import { createClient } from '@/utils/supabase/server';
import { updatePrepassBudget } from '../actions';

export default async function AtaEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const rawParams = await searchParams;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  const defaultEnd = yesterdayIso < ATA_BUDGET_MONTH_START
    ? ATA_BUDGET_MONTH_START
    : yesterdayIso > ATA_BUDGET_MONTH_END
      ? ATA_BUDGET_MONTH_END
      : yesterdayIso;
  const params = paramsFromSearch(rawParams.start || rawParams.end
    ? rawParams
    : { ...rawParams, start: ATA_BUDGET_MONTH_START, end: defaultEnd });
  const data = await fetchAtaEventData(params);
  return <AtaEventDashboardClient data={data} isAdmin={isAdmin} updateBudget={updatePrepassBudget} />;
}