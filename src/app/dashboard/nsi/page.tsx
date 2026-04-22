import React from 'react';
import NsiDashboardClient from '@/components/NsiDashboardClient';
import { fetchNsiDashboardData, nsiParamsFromSearch } from '@/services/nsi-analytics';

export default async function NsiDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = nsiParamsFromSearch(await searchParams);
  const data = await fetchNsiDashboardData(params);
  return <NsiDashboardClient data={data} />;
}
