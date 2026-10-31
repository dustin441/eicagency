import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { auritParamsFromSearch, fetchAuritDashboardData } from '@/services/aurit-analytics';
import AuritDashboardClient from '@/components/AuritDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuritDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('aurit');

  const params = auritParamsFromSearch(await searchParams);
  const data = await fetchAuritDashboardData(params);

  return <AuritDashboardClient data={data} />;
}
