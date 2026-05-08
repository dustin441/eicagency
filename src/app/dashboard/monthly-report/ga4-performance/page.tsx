import React from 'react';
import { fetchPrepassGa4PerformanceData, paramsFromSearch } from '@/services/analytics';
import Ga4PerformanceClient from '@/components/Ga4PerformanceClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function Ga4PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = await searchParams;
  const filterParams = paramsFromSearch(params);
  const data = await fetchPrepassGa4PerformanceData({
    start: filterParams.start,
    end: filterParams.end,
    compStart: filterParams.compStart,
    compEnd: filterParams.compEnd,
    sourceMedium: params.source_medium,
  });
  return <Ga4PerformanceClient data={data} />;
}
