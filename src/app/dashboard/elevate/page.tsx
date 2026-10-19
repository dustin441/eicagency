import { redirect } from 'next/navigation';
import ElevateDashboardClient from '@/components/ElevateDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { ELEVATE_CHANNELS, fetchElevateData, type ElevateParams } from '@/services/elevate-analytics';

const CAMPAIGN_START = '2026-10-14';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ElevatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireClientAccess('elevate');
  const raw = await searchParams;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const defaultEnd = yesterday.toISOString().slice(0, 10);
  const datesValid = Boolean(raw.start && raw.end && ISO_DATE.test(raw.start) && ISO_DATE.test(raw.end) && raw.start <= raw.end);
  const channelValid = !raw.channel || raw.channel === 'all' || ELEVATE_CHANNELS.includes(raw.channel as (typeof ELEVATE_CHANNELS)[number]);
  if (!datesValid || !channelValid) {
    const canonical = new URLSearchParams({
      start: datesValid ? raw.start! : CAMPAIGN_START,
      end: datesValid ? raw.end! : defaultEnd,
      channel: channelValid ? raw.channel || 'all' : 'all',
    });
    redirect(`/dashboard/elevate?${canonical.toString()}`);
  }
  const params: ElevateParams = {
    start: raw.start!,
    end: raw.end!,
    channel: raw.channel || 'all',
  };
  const data = await fetchElevateData(params);
  return <ElevateDashboardClient data={data} />;
}
