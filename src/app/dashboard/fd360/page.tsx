import React from 'react';
import { fetchFocusData, paramsFromSearch } from '@/services/analytics';
import FocusDashboardClient from '@/components/FocusDashboardClient';

export default async function Fd360Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = paramsFromSearch(await searchParams);
  const data = await fetchFocusData('FD360', params);
  return <FocusDashboardClient data={data} />;
}
