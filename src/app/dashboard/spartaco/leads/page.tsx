import React from 'react';
import SpartacoDashboardClient from '@/components/SpartacoDashboardClient';
import {
  fetchSpartacoDashboardData,
  spartacoParamsFromSearch,
} from '@/services/spartaco-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function SpartacoLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('spartaco');
  const params = spartacoParamsFromSearch(await searchParams);
  const data = await fetchSpartacoDashboardData('LEAD', params);
  return <SpartacoDashboardClient data={data} />;
}
