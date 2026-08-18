import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchEicAgencyDashboardData, eicAgencyMofParamsFromSearch } from '@/services/eicagency-analytics';
import EicAgencyMofDashboardClient from '@/components/EicAgencyMofDashboardClient';

export default async function EicAgencyMofPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('eicagency');

  const params = eicAgencyMofParamsFromSearch(await searchParams);
  const data = await fetchEicAgencyDashboardData(params);

  return <EicAgencyMofDashboardClient data={data} />;
}
