import React from 'react';
import SpartacoDashboardClient from '@/components/SpartacoDashboardClient';
import {
  fetchSpartacoDashboardData,
  spartacoParamsFromSearch,
} from '@/services/spartaco-analytics';

export default async function SpartacoLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = spartacoParamsFromSearch(await searchParams);
  const data = await fetchSpartacoDashboardData('LEAD', params);
  return <SpartacoDashboardClient data={data} />;
}
