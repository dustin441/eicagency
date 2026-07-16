import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchNsiCompletedQuarterYtdData,
  fetchNsiRevenueData,
  revenueParamsFromSearch,
} from '@/services/nsi-revenue-analytics';
import NsiRevenueClient from '@/components/NsiRevenueClient';

export default async function NsiRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('nsi');
  const params = revenueParamsFromSearch(await searchParams);
  const [result, quarterYtd] = await Promise.all([
    fetchNsiRevenueData(params),
    fetchNsiCompletedQuarterYtdData(),
  ]);

  return (
    <NsiRevenueClient
      data={result.data}
      comp={result.comp}
      quarterYtd={quarterYtd.data}
      quarterYtdComp={quarterYtd.comp}
      params={params}
    />
  );
}
