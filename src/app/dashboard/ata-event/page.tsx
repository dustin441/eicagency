import AtaEventDashboardClient from '@/components/AtaEventDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchAtaEventData } from '@/services/prepass-ata-event';

const ATA_EVENT_PARAMS = {
  start: '2026-10-05',
  end: '2026-10-20',
  compStart: '2026-09-19',
  compEnd: '2026-10-04',
  channel: 'all',
};

export default async function AtaEventPage() {
  await requireClientAccess('prepass');
  const data = await fetchAtaEventData(ATA_EVENT_PARAMS);
  return <AtaEventDashboardClient data={data} />;
}