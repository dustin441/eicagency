import React from 'react';
import { fetchDashboardData, fetchPrepassWeeklyExecutiveReadout, paramsFromSearch } from '@/services/analytics';
import DashboardClient from '@/components/DashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const [data, weeklyReadout] = await Promise.all([
    fetchDashboardData(params),
    fetchPrepassWeeklyExecutiveReadout(),
  ]);

  return <DashboardClient initialData={data} weeklyReadout={weeklyReadout} />;
}
