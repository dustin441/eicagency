import React from 'react';
import { fetchFocusData, paramsFromSearch } from '@/services/analytics';
import FocusDashboardClient from '@/components/FocusDashboardClient';

export default async function AbmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = paramsFromSearch(await searchParams);
  const data = await fetchFocusData('ABM', params);
  return <FocusDashboardClient data={data} />;
}
