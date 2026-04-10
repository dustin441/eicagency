import React from 'react';
import { fetchFocusData } from '@/services/analytics';
import FocusDashboardClient from '@/components/FocusDashboardClient';

export default async function SmbPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = 'month' } = await searchParams;
  const data = await fetchFocusData('SMB', period);
  return <FocusDashboardClient data={data} period={period} />;
}
