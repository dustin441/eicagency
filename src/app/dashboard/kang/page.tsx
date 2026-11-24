import { redirect } from 'next/navigation';
import { requireClientAccess } from '@/lib/auth-guard';
import { kangDateRange } from '@/services/kang-metrics';
import { fetchKangData } from '@/services/kang-analytics';
import KangDashboardClient from '@/components/KangDashboardClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kang Foods | Meta Traffic' };

export default async function KangPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireClientAccess('kang');
  const raw = await searchParams;
  const start = typeof raw.start === 'string' ? raw.start : undefined;
  const end = typeof raw.end === 'string' ? raw.end : undefined;
  const params = kangDateRange({ start, end });
  // Canonical dates keep the shared URL-driven FilterBar aligned with server defaults.
  if (start !== params.start || end !== params.end) {
    redirect(`/dashboard/kang?${new URLSearchParams(params)}`);
  }
  const data = await fetchKangData(params);
  return <KangDashboardClient data={data} />;
}
