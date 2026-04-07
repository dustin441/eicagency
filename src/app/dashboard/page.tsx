import React from 'react';
import { fetchDashboardData } from '@/services/analytics';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = 'month' } = await searchParams;
  const data = await fetchDashboardData(period);

  return <DashboardClient initialData={data} period={period} />;
}
