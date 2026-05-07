import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { bloomParamsFromSearch, fetchBloomDashboardData } from '@/services/bloom-analytics';
import BloomDashboardClient from '@/components/BloomDashboardClient';

export default async function BloomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('bloom');
  const params = await searchParams;
  const filterParams = bloomParamsFromSearch(params);
  const data = await fetchBloomDashboardData(filterParams);
  return <BloomDashboardClient data={data} />;
}
