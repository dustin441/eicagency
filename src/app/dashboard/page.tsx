import React from 'react';
import { fetchDashboardData, paramsFromSearch } from '@/services/analytics';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = paramsFromSearch(await searchParams);
  const data = await fetchDashboardData(params);

  return <DashboardClient initialData={data} />;
}
