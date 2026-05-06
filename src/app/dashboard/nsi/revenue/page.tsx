import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchNsiRevenueData, revenueParamsFromSearch } from '@/services/nsi-revenue-analytics';
import NsiRevenueClient from '@/components/NsiRevenueClient';

export default async function NsiRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('nsi');
  const params = revenueParamsFromSearch(await searchParams);
  const result = await fetchNsiRevenueData(params);
  return <NsiRevenueClient data={result.data} comp={result.comp} params={params} />;
}
