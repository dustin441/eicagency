import React from 'react';
import { fetchDashboardData, paramsFromSearch } from '@/services/analytics';
import DashboardClient from '@/components/DashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const data = await fetchDashboardData(params);

  return <DashboardClient initialData={data} />;
}
