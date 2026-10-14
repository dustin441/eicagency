import AtaEventDashboardClient from '@/components/AtaEventDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { ATA_BUDGET_MONTH_END, ATA_BUDGET_MONTH_START } from '@/lib/prepass-ata-scope';
import { paramsFromSearch } from '@/services/analytics';
import { fetchAtaEventData } from '@/services/prepass-ata-event';

export default async function AtaEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');

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
  return <AtaEventDashboardClient data={data} />;
}